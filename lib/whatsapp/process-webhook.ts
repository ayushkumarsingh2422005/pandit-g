import { handleAiMessage } from "./handlers/ai";
import { handleStatusUpdates } from "./handlers/status";
import {
  parseIncomingTextMessages,
  parseStatusUpdates,
} from "./parse-webhook";
import type { WhatsAppWebhookPayload } from "./types";

export async function processWhatsAppWebhook(payload: WhatsAppWebhookPayload) {
  const statuses = parseStatusUpdates(payload);
  handleStatusUpdates(statuses);

  const messages = parseIncomingTextMessages(payload);

  await Promise.all(messages.map((message) => handleAiMessage(message)));

  return {
    processed: messages.length,
    statuses: statuses.length,
  };
}
