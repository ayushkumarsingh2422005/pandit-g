import { getWhatsAppConfig } from "./config";

type SendTextMessageInput = {
  to: string;
  body: string;
};

export async function sendTextMessage({ to, body }: SendTextMessageInput) {
  const { accessToken, phoneNumberId, apiVersion } = getWhatsAppConfig();

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `WhatsApp send failed (${response.status}): ${JSON.stringify(data)}`,
    );
  }

  return data;
}
