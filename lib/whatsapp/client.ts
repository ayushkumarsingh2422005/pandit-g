import { getWhatsAppConfig } from "./config";

type SendTextMessageInput = {
  to: string;
  body: string;
};

async function postToMessagesApi(body: Record<string, unknown>) {
  const { accessToken, phoneNumberId, apiVersion } = getWhatsAppConfig();

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `WhatsApp API failed (${response.status}): ${JSON.stringify(data)}`,
    );
  }

  return data;
}

/**
 * Mark as read (blue ticks) + typing indicator.
 * Typing shows for up to ~25 seconds or until sendTextMessage() is called.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/typing-indicators
 */
export async function markMessageAsRead(messageId: string) {
  try {
    return await postToMessagesApi({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    });
  } catch {
    return postToMessagesApi({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });
  }
}

export async function sendTextMessage({ to, body }: SendTextMessageInput) {
  return postToMessagesApi({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body },
  });
}
