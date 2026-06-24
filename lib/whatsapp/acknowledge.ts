import { markMessageAsRead } from "./client";
import { parseIncomingMessageIds } from "./parse-webhook";
import type { WhatsAppWebhookPayload } from "./types";

/**
 * Immediately mark incoming messages as read (blue ticks) and show typing.
 * Call this before AI work so the user sees feedback right away on Vercel.
 */
export async function acknowledgeIncomingMessages(
  payload: WhatsAppWebhookPayload,
) {
  const messageIds = parseIncomingMessageIds(payload);

  await Promise.all(
    messageIds.map(async (messageId) => {
      try {
        await markMessageAsRead(messageId);
      } catch (error) {
        console.error("[whatsapp acknowledge]", messageId, error);
      }
    }),
  );

  return messageIds.length;
}
