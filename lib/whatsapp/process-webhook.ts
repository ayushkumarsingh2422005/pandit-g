import { handleAiMessage } from "./handlers/ai";
import { handleStatusUpdates } from "./handlers/status";
import {
  parseIncomingAiMessages,
  parseStatusUpdates,
} from "./parse-webhook";
import type { WhatsAppWebhookPayload } from "./types";

export async function processWhatsAppWebhook(payload: WhatsAppWebhookPayload) {
  const statuses = parseStatusUpdates(payload);
  await handleStatusUpdates(statuses);

  const messages = parseIncomingAiMessages(payload);

  await Promise.all(messages.map((message) => handleAiMessage(message)));

  return {
    processed: messages.length,
    statuses: statuses.length,
  };
}
