import type { TonClient } from "@ton/ton";
import { WalletContractV5R1, toNano, internal } from "@ton/ton";
import { Address, SendMode } from "@ton/core";
import { getKeyPair, getCachedTonClient, invalidateTonClientCache } from "./wallet-service.js";
import { createLogger } from "../utils/logger.js";
import { withTxLock } from "./tx-lock.js";
import { getAuditInstance, type FinancialAuditDetails } from "../services/audit.js";

const log = createLogger("TON");

/** Wait for a transaction to appear on-chain after sendTransfer */
async function waitForTransactionHash(
  client: TonClient,
  walletAddress: Address,
  sentAt: number,
  maxWaitMs = 10_000,
  pollIntervalMs = 2_000
): Promise<string | null> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    try {
      const txs = await client.getTransactions(walletAddress, { limit: 5 });
      // Find the first transaction that appeared after we sent
      for (const tx of txs) {
        const txTimeMs = tx.now * 1000;
        if (txTimeMs >= sentAt) {
          return tx.hash().toString("hex");
        }
      }
    } catch {
      // Retry on next poll cycle
    }
  }

  return null;
}

export interface SendTonParams {
  toAddress: string;
  amount: number;
  comment?: string;
  bounce?: boolean;
}

export async function sendTon(params: SendTonParams): Promise<string | null> {
  return withTxLock(async () => {
    const { toAddress, amount, comment = "", bounce = false } = params;

    if (!Number.isFinite(amount) || amount <= 0) {
      log.error({ amount }, "Invalid transfer amount");
      _logFinancial({
        operation: "ton_transfer",
        amount,
        asset: "TON",
        recipient: toAddress,
        comment: comment || undefined,
        status: "failed",
        error: "Invalid transfer amount",
      });
      return null;
    }

    let recipientAddress: Address;
    try {
      recipientAddress = Address.parse(toAddress);
    } catch (e) {
      log.error({ err: e }, `Invalid recipient address: ${toAddress}`);
      return null;
    }

    const keyPair = await getKeyPair();
    if (!keyPair) {
      log.error("Wallet not initialized");
      return null;
    }

    const wallet = WalletContractV5R1.create({
      workchain: 0,
      publicKey: keyPair.publicKey,
    });

    const client = await getCachedTonClient();
    const contract = client.open(wallet);

    const seqno = await contract.getSeqno();

    try {
      const sentAt = Date.now();

      await contract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        messages: [
          internal({
            to: recipientAddress,
            value: toNano(amount),
            body: comment,
            bounce,
          }),
        ],
      });

      // Wait for the transaction to appear on-chain and get its real hash
      const realHash = await waitForTransactionHash(client, wallet.address, sentAt);
      const txHash = realHash ?? `pending_${seqno}_${sentAt}_${amount.toFixed(2)}`;

      log.info(
        `Sent ${amount} TON to ${toAddress.slice(0, 8)}... - seqno: ${seqno}, hash: ${txHash}`
      );

      _logFinancial({
        operation: "ton_transfer",
        amount,
        asset: "TON",
        recipient: toAddress,
        comment: comment || undefined,
        txId: txHash,
        status: "success",
      });

      return txHash;
    } catch (error: unknown) {
      // Invalidate node cache on 429/5xx so next attempt picks a fresh node
      const err = error as { status?: number; response?: { status?: number } };
      const status = err?.status || err?.response?.status;
      if (status === 429 || (status !== undefined && status >= 500)) {
        invalidateTonClientCache();
      }
      log.error({ err: error }, "Error sending TON");

      _logFinancial({
        operation: "ton_transfer",
        amount,
        asset: "TON",
        recipient: toAddress,
        comment: comment || undefined,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }); // withTxLock
}

/**
 * Write a financial audit entry via the AuditService singleton.
 * Silently skips if the audit service has not been initialized yet
 * (e.g. when running without WebUI/API). Errors are caught so they
 * never abort the financial operation itself.
 */
function _logFinancial(details: FinancialAuditDetails): void {
  try {
    getAuditInstance()?.logFinancial(details);
  } catch {
    // Audit failures must never interrupt financial operations
  }
}
