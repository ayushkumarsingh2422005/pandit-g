import { generatePanditGReply } from "@/lib/ai/generate-reply";
import { downloadWhatsAppMedia } from "../media";
import { sendTextMessage } from "../client";
import type { IncomingAiMessage } from "../types";

const FALLBACK_REPLY =
  "🙏 प्रणाम! अभी जवाब नहीं दे पाए। थोड़ी देर बाद फिर लिखिए या अपना सवाल दोबारा भेजिए।";

const IMAGE_DOWNLOAD_FAILED_REPLY =
  "फोटो खुल नहीं पाई 🙏 कृपया साफ फोटो दोबारा भेजिए — हथेली हो तो अच्छी रोशनी में, पूरी हथेली दिखे।";

/** Generate AI reply and send. Read receipt + typing are sent earlier in the webhook route. */
export async function handleAiMessage(message: IncomingAiMessage) {
  let reply: string;

  try {
    const image = message.imageMediaId
      ? await downloadWhatsAppMedia(message.imageMediaId)
      : undefined;

    reply = await generatePanditGReply({
      phone: message.from,
      userMessage: message.text,
      contactName: message.contactName,
      image,
    });
  } catch (error) {
    console.error("[whatsapp ai]", error);

    if (message.imageMediaId) {
      reply = IMAGE_DOWNLOAD_FAILED_REPLY;
    } else {
      reply = FALLBACK_REPLY;
    }
  }

  await sendTextMessage({
    to: message.from,
    body: reply,
  });
}
