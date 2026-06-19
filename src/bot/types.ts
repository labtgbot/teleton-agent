/**
 * Types for the deals inline bot
 */

import type { MtprotoProxyEntry } from "../config/schema.js";

export interface BotConfig {
  token: string;
  username: string;
  apiId?: number;
  apiHash?: string;
  gramjsSessionPath?: string;
  /** MTProto proxy servers (tried in order, failover to next on connection error) */
  mtprotoProxies?: MtprotoProxyEntry[];
}

export interface DealContext {
  dealId: string;
  userId: number;
  username?: string;
  chatId: string;
  userGivesType: "ton" | "gift";
  userGivesTonAmount?: number;
  userGivesGiftSlug?: string;
  userGivesValueTon: number;
  agentGivesType: "ton" | "gift";
  agentGivesTonAmount?: number;
  agentGivesGiftSlug?: string;
  agentGivesValueTon: number;
  profitTon: number;
  status: DealStatus;
  createdAt: number;
  expiresAt: number;
  inlineMessageId?: string;
  paymentClaimedAt?: number;
  verifiedAt?: number;
  completedAt?: number;
  agentWallet?: string;
}

export type DealStatus =
  | "proposed"
  | "accepted"
  | "payment_claimed"
  | "verified"
  | "completed"
  | "declined"
  | "expired"
  | "cancelled"
  | "failed";

export type MessageState =
  | "proposal" // Accept/Decline buttons
  | "accepted" // Payment/gift instructions + "I've sent"
  | "payment_claimed" // Verifying...
  | "verified" // Sending agent's part...
  | "completed" // Final recap
  | "declined" // Declined message
  | "expired" // Expired message
  | "failed"; // Error message

export interface CallbackData {
  action: "accept" | "decline" | "sent" | "copy_addr" | "copy_memo" | "refresh";
  dealId: string;
  /** SECURITY FIX C-05+H-12: User ID bound to callback to prevent unauthorized access */
  userId: number;
}

// SECURITY FIX C-05+H-12: Version prefix for callback data format
const CB_VERSION = "v2";

export function encodeCallback(data: CallbackData): string {
  return `${CB_VERSION}:${data.action}:${data.dealId}:${data.userId}`;
}

export function decodeCallback(raw: string): CallbackData | null {
  const parts = raw.split(":");

  // SECURITY FIX C-05+H-12: Support versioned format (v2:action:dealId:userId)
  // and legacy format (action:dealId) for backward compatibility
  let action: string;
  let dealId: string;
  let userId = 0; // 0 = unbound (legacy), will be rejected by authorization check

  if (parts.length === 4 && parts[0] === CB_VERSION) {
    action = parts[1];
    dealId = parts[2];
    const parsedUserId = parseInt(parts[3], 10);
    if (!Number.isFinite(parsedUserId)) return null;
    userId = parsedUserId;
  } else if (parts.length === 2) {
    // Legacy format — no userId binding (will fail authorization check)
    action = parts[0];
    dealId = parts[1];
  } else {
    return null;
  }

  if (!["accept", "decline", "sent", "copy_addr", "copy_memo", "refresh"].includes(action)) {
    return null;
  }

  return {
    action: action as CallbackData["action"],
    dealId,
    userId,
  };
}
