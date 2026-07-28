import type {
  IncomingAiMessage,
  IncomingTextMessage,
  WhatsAppIncomingMessage,
  WhatsAppStatusUpdate,
  WhatsAppWebhookPayload,
} from "./types";

export function parseIncomingTextMessages(
  payload: WhatsAppWebhookPayload,
): IncomingTextMessage[] {
  return parseIncomingAiMessages(payload).filter(
    (message) => !message.imageMediaId,
  );
}

export function parseIncomingAiMessages(
  payload: WhatsAppWebhookPayload,
): IncomingAiMessage[] {
  if (payload.object !== "whatsapp_business_account" || !payload.entry) {
    return [];
  }

  const messages: IncomingAiMessage[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;

      const value = change.value;
      if (!value) continue;

      const contactName = value.contacts?.[0]?.profile?.name;

      for (const message of value.messages ?? []) {
        const parsed = parseMessage(message, contactName);
        if (parsed) messages.push(parsed);
      }
    }
  }

  return messages;
}

export function parseStatusUpdates(
  payload: WhatsAppWebhookPayload,
): WhatsAppStatusUpdate[] {
  if (payload.object !== "whatsapp_business_account" || !payload.entry) {
    return [];
  }

  const statuses: WhatsAppStatusUpdate[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      statuses.push(...(change.value.statuses ?? []));
    }
  }

  return statuses;
}

/** All incoming message IDs — used for read receipts + typing before AI reply. */
export function parseIncomingMessageIds(
  payload: WhatsAppWebhookPayload,
): string[] {
  if (payload.object !== "whatsapp_business_account" || !payload.entry) {
    return [];
  }

  const ids: string[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      for (const message of change.value.messages ?? []) {
        if (message?.id) ids.push(message.id);
      }
    }
  }

  return ids;
}

function parseMessage(
  message: WhatsAppIncomingMessage,
  contactName?: string,
): IncomingAiMessage | null {
  if (!message?.id || !message.from) {
    return null;
  }

  if (message.type === "text" && message.text?.body) {
    return {
      from: message.from,
      messageId: message.id,
      text: message.text.body,
      contactName,
    };
  }

  if (message.type === "image" && message.image?.id) {
    return {
      from: message.from,
      messageId: message.id,
      text: message.image.caption?.trim() ?? "",
      contactName,
      imageMediaId: message.image.id,
      imageMimeType: message.image.mime_type,
    };
  }

  // List / reply-button taps — use id so intake parsers can map choices.
  if (message.type === "interactive" && message.interactive) {
    const list = message.interactive.list_reply;
    const button = message.interactive.button_reply;
    const id = list?.id?.trim() || button?.id?.trim();
    const title = list?.title?.trim() || button?.title?.trim();
    if (!id && !title) return null;

    return {
      from: message.from,
      messageId: message.id,
      // Prefer stable id (problem_love / pkg_a); title as fallback
      text: id || title || "",
      contactName,
    };
  }

  return null;
}
