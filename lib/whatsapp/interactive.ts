import { getWhatsAppConfig } from "./config";

export type InteractiveListRow = {
  id: string;
  title: string;
  description?: string;
};

export type InteractiveListSection = {
  title?: string;
  rows: InteractiveListRow[];
};

export type InteractiveButton = {
  id: string;
  title: string;
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

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * WhatsApp List Message — tap "विकल्प देखें" → pick a row.
 * Limits: ≤10 rows, title ≤24, description ≤72, button ≤20.
 */
export async function sendInteractiveListMessage(input: {
  to: string;
  body: string;
  buttonText: string;
  sections: InteractiveListSection[];
  header?: string;
  footer?: string;
}) {
  return postToMessagesApi({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "interactive",
    interactive: {
      type: "list",
      ...(input.header
        ? { header: { type: "text", text: truncate(input.header, 60) } }
        : {}),
      body: { text: truncate(input.body, 1024) },
      ...(input.footer
        ? { footer: { text: truncate(input.footer, 60) } }
        : {}),
      action: {
        button: truncate(input.buttonText, 20),
        sections: input.sections.map((section) => ({
          ...(section.title
            ? { title: truncate(section.title, 24) }
            : {}),
          rows: section.rows.map((row) => ({
            id: truncate(row.id, 200),
            title: truncate(row.title, 24),
            ...(row.description
              ? { description: truncate(row.description, 72) }
              : {}),
          })),
        })),
      },
    },
  });
}

/**
 * WhatsApp Reply Buttons — max 3 buttons, title ≤20 chars each.
 */
export async function sendInteractiveButtonMessage(input: {
  to: string;
  body: string;
  buttons: InteractiveButton[];
  header?: string;
  footer?: string;
}) {
  const buttons = input.buttons.slice(0, 3);

  return postToMessagesApi({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "interactive",
    interactive: {
      type: "button",
      ...(input.header
        ? { header: { type: "text", text: truncate(input.header, 60) } }
        : {}),
      body: { text: truncate(input.body, 1024) },
      ...(input.footer
        ? { footer: { text: truncate(input.footer, 60) } }
        : {}),
      action: {
        buttons: buttons.map((btn) => ({
          type: "reply",
          reply: {
            id: truncate(btn.id, 256),
            title: truncate(btn.title, 20),
          },
        })),
      },
    },
  });
}
