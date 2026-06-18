import type { TelegramBridge } from "../bridge.js";
import type Database from "better-sqlite3";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("Telegram");

export type CallbackHandler = (data: {
  action: string;
  params: string[];
  queryId: bigint;
  chatId: string;
  messageId: number;
  userId: number;
}) => Promise<void>;

// SECURITY FIX C-05+H-12: Set of legacy (unbound) action prefixes
// These are actions that pre-date user-binding and cannot be authorized.
// New callbacks should always include userId binding.
const LEGACY_UNBOUND_ACTIONS = new Set(["copy_addr", "copy_memo", "refresh"]);

export class CallbackQueryHandler {
  private handlers: Map<string, CallbackHandler> = new Map();

  constructor(
    private bridge: TelegramBridge,
    private db: Database.Database
  ) {}

  register(actionPrefix: string, handler: CallbackHandler): void {
    this.handlers.set(actionPrefix, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GramJS raw update event shape
  async handle(event: any): Promise<void> {
    try {
      const queryId = event.queryId;
      const data = event.data?.toString() || "";
      const chatId = event.peer?.toString() || event.chatInstance?.toString() || "";
      const messageId = event.msgId || 0;
      const userId = Number(event.userId);

      log.info(`[Callback] Received: data="${data}" from user ${userId} in chat ${chatId}`);

      // SECURITY FIX C-05+H-12: Extract action and check user binding
      // Parse versioned format: "v2:action:dealId:userId" or legacy: "action:dealId"
      const parts = data.split(":");
      let action: string;
      let boundUserId: number | null = null;

      if (parts.length === 4 && parts[0] === "v2") {
        // Versioned format with userId binding
        action = parts[1];
        boundUserId = parseInt(parts[3], 10);
      } else if (parts.length >= 2) {
        // Legacy format: action is first part
        action = parts[0];
      } else {
        log.warn(`[Callback] Malformed data: "${data}"`);
        await this.answerCallback(queryId, "Invalid callback");
        return;
      }

      // SECURITY FIX C-05+H-12: Verify callback is bound to the clicking user
      // This prevents User A from triggering User B's callbacks (IDOR attack)
      if (boundUserId !== null && boundUserId !== userId) {
        if (!LEGACY_UNBOUND_ACTIONS.has(action)) {
          log.warn(
            `[Callback] Authorization failed: callback bound to user ${boundUserId} but clicked by user ${userId}`
          );
          await this.answerCallback(queryId, "⛔ This action is not for you.");
          return;
        }
      }

      const handler = this.handlers.get(action);
      if (!handler) {
        log.warn(`No handler for callback action: ${action}`);
        await this.answerCallback(queryId, "Unknown action");
        return;
      }

      // For non-legacy actions, require userId binding
      if (boundUserId === null && !LEGACY_UNBOUND_ACTIONS.has(action)) {
        log.warn(
          `[Callback] Rejecting unbound callback action "${action}" from user ${userId}`
        );
        await this.answerCallback(queryId, "⛔ Invalid callback format.");
        return;
      }

      await handler({
        action,
        params: parts.slice(1),
        queryId,
        chatId,
        messageId,
        userId,
      });
    } catch (error) {
      log.error({ err: error }, "Error handling callback query");
      if (event?.queryId) {
        await this.answerCallback(event.queryId, "An error occurred. Please try again.");
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GramJS BigInteger queryId
  private async answerCallback(queryId: any, message?: string, alert = false): Promise<void> {
    try {
      await this.bridge.getClient().answerCallbackQuery(queryId, { message, alert });
    } catch (error) {
      log.error({ err: error }, "Error answering callback");
    }
  }
}
