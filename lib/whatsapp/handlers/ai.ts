import { generatePanditGReply } from "@/lib/ai/generate-reply";
import { sendTextMessage } from "../client";
import type { IncomingTextMessage } from "../types";

const FALLBACK_REPLY =
  "🙏 नमस्ते! पंडित जी यहाँ हैं। कृपया थोड़ी देर बाद दोबारा लिखें या अपना सवाल फिर से भेजें।";

/** Generate AI reply and send. Read receipt + typing are sent earlier in the webhook route. */
export async function handleAiMessage(message: IncomingTextMessage) {
  let reply: string;

  try {
    reply = await generatePanditGReply(
      message.from,
      message.text,
      message.contactName,
    );
  } catch (error) {
    console.error("[whatsapp ai]", error);
    reply = FALLBACK_REPLY;
  }

  await sendTextMessage({
    to: message.from,
    body: reply,
  });
}
