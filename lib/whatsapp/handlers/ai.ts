import {
  generateErrorReply,
  generateFunnelReply,
} from "@/lib/ai/generate-funnel-reply";
import { generatePanditGReply } from "@/lib/ai/generate-reply";
import { saveConversationTurn } from "@/lib/db/conversations";
import { userProvidedDetails } from "@/lib/funnel/detect-birth-details";
import { getFunnelReadingDelayMs, sleep } from "@/lib/funnel/config";
import { resolveFunnelStage } from "@/lib/funnel/state";
import { downloadWhatsAppMedia } from "../media";
import { sendTextMessage } from "../client";
import type { IncomingAiMessage } from "../types";

function buildStoredUserMessage(text: string, hasImage: boolean): string {
  const trimmed = text.trim();
  if (hasImage) return trimmed ? `[फोटो] ${trimmed}` : "[फोटो भेजी]";
  return trimmed || "[संदेश]";
}

async function persistTurn(
  phone: string,
  userMessage: string,
  reply: string,
  contactName: string | undefined,
  funnelStage: "awaiting_details" | "reading_delivered" | "active",
) {
  await saveConversationTurn(
    phone,
    userMessage,
    reply,
    contactName,
    funnelStage,
  );
}

/** Funnel + AI handler. Read receipt + typing are sent earlier in the webhook route. */
export async function handleAiMessage(message: IncomingAiMessage) {
  const hasImage = Boolean(message.imageMediaId);
  let image;

  if (hasImage) {
    try {
      image = await downloadWhatsAppMedia(message.imageMediaId!);
    } catch (error) {
      console.error("[whatsapp media]", error);
      try {
        const reply = await generateErrorReply("image_download");
        await sendTextMessage({ to: message.from, body: reply });
      } catch {
        await sendTextMessage({
          to: message.from,
          body: "🙏 फोटो नहीं खुली — कृपया साफ हथेली की फोटो दोबारा भेजिए।",
        });
      }
      return;
    }
  }

  const storedUserMessage = buildStoredUserMessage(message.text, hasImage);
  const detailsProvided = userProvidedDetails(message.text, hasImage);

  try {
    const stage = await resolveFunnelStage(message.from);

    if (stage === "initial") {
      const reply = await generateFunnelReply({
        stage: "welcome",
        phone: message.from,
        userMessage: message.text,
        contactName: message.contactName,
      });
      await persistTurn(
        message.from,
        storedUserMessage,
        reply,
        message.contactName,
        "awaiting_details",
      );
      await sendTextMessage({ to: message.from, body: reply });
      return;
    }

    if (stage === "awaiting_details" && !detailsProvided) {
      const reply = await generateFunnelReply({
        stage: "ask_details",
        phone: message.from,
        userMessage: message.text,
        contactName: message.contactName,
      });
      await persistTurn(
        message.from,
        storedUserMessage,
        reply,
        message.contactName,
        "awaiting_details",
      );
      await sendTextMessage({ to: message.from, body: reply });
      return;
    }

    if (stage === "awaiting_details" && detailsProvided) {
      await sleep(getFunnelReadingDelayMs());

      const reading = await generateFunnelReply({
        stage: "reading",
        phone: message.from,
        userMessage: message.text,
        contactName: message.contactName,
        image,
      });

      await persistTurn(
        message.from,
        storedUserMessage,
        reading,
        message.contactName,
        "reading_delivered",
      );
      await sendTextMessage({ to: message.from, body: reading });
      return;
    }

    const reply = await generatePanditGReply({
      phone: message.from,
      userMessage: message.text,
      contactName: message.contactName,
      image,
      funnelStage: stage,
    });

    await sendTextMessage({ to: message.from, body: reply });
  } catch (error) {
    console.error("[whatsapp ai]", error);
    try {
      const reply = await generateErrorReply("general");
      await sendTextMessage({ to: message.from, body: reply });
    } catch {
      await sendTextMessage({
        to: message.from,
        body: "🙏 कृपया थोड़ी देर बाद फिर लिखिए।",
      });
    }
  }
}
