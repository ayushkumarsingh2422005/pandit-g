import { handleEchoMessage } from "./handlers/echo";
import { parseIncomingTextMessages } from "./parse-webhook";
import type { WhatsAppWebhookPayload } from "./types";

export async function processWhatsAppWebhook(payload: WhatsAppWebhookPayload) {
  const messages = parseIncomingTextMessages(payload);

  await Promise.all(messages.map((message) => handleEchoMessage(message)));

  return { processed: messages.length };
}
