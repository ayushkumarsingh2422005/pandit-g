import type {
  IncomingTextMessage,
  WhatsAppIncomingMessage,
  WhatsAppWebhookPayload,
} from "./types";

export function parseIncomingTextMessages(
  payload: WhatsAppWebhookPayload,
): IncomingTextMessage[] {
  if (payload.object !== "whatsapp_business_account" || !payload.entry) {
    return [];
  }

  const messages: IncomingTextMessage[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;

      const value = change.value;
      const contactName = value.contacts?.[0]?.profile.name;

      for (const message of value.messages ?? []) {
        const parsed = parseMessage(message, contactName);
        if (parsed) messages.push(parsed);
      }
    }
  }

  return messages;
}

function parseMessage(
  message: WhatsAppIncomingMessage,
  contactName?: string,
): IncomingTextMessage | null {
  if (message.type !== "text" || !message.text?.body) {
    return null;
  }

  return {
    from: message.from,
    messageId: message.id,
    text: message.text.body,
    contactName,
  };
}
