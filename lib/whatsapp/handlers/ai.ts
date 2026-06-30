import {
  generateErrorReply,
  generateFunnelReply,
} from "@/lib/ai/generate-funnel-reply";
import { detectConsultationIntent } from "@/lib/ai/detect-consultation-intent";
import { generateFreeFollowupReply } from "@/lib/ai/generate-free-followup-reply";
import { generatePaymentReply } from "@/lib/ai/generate-payment-reply";
import type { PaymentReplyType } from "@/lib/ai/generate-payment-reply";
import { generatePanditGReply } from "@/lib/ai/generate-reply";
import { getSuryaRashiFromDate } from "@/lib/astro/rashi";
import { saveConversationTurn, type FunnelStage } from "@/lib/db/conversations";
import {
  getClientBirthProfile,
  getClientName,
  saveClientBirthProfile,
  saveClientName,
} from "@/lib/db/conversation-profile";
import { parseClientName } from "@/lib/funnel/detect-client-name";
import { userProvidedDetails } from "@/lib/funnel/detect-birth-details";
import { parseBirthDetailsFromText } from "@/lib/funnel/parse-birth-details";
import { getFunnelReadingDelayMs, sleep } from "@/lib/funnel/config";
import { resolveFunnelStage } from "@/lib/funnel/state";
import { getConsultationAccess } from "@/lib/payments/consultation-access";
import {
  isPaymentIntent,
  userClaimsTheyPaid,
} from "@/lib/payments/payment-intent";
import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import { getOrCreateConsultationPaymentLink } from "@/lib/razorpay/create-payment-link";
import { isRazorpayConfigured } from "@/lib/razorpay/is-configured";
import { handleConversationModeration } from "@/lib/moderation/handle-moderation";
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
  funnelStage: FunnelStage,
) {
  await saveConversationTurn(phone, userMessage, reply, undefined, funnelStage);
}

function requiresPaidSession(stage: string): boolean {
  return stage === "reading_delivered" || stage === "active";
}

async function resolvePaymentUrl(
  phone: string,
  existingUrl?: string,
): Promise<string | undefined> {
  if (existingUrl) return existingUrl;
  if (!isRazorpayConfigured()) return undefined;

  const clientName = (await getClientName(phone)) ?? undefined;

  try {
    const link = await getOrCreateConsultationPaymentLink(phone, clientName);
    return link.shortUrl;
  } catch (error) {
    console.error("[payment link]", error);
    return undefined;
  }
}

async function buildBirthProfileFromMessage(text: string, hasImage: boolean) {
  if (hasImage && !text.trim()) {
    return { fromPalmPhoto: true } as const;
  }

  const parsed = parseBirthDetailsFromText(text);
  const rashi = parsed.dob ? getSuryaRashiFromDate(parsed.dob) : undefined;

  return {
    dobLabel: parsed.dobLabel,
    timeLabel: parsed.timeLabel,
    place: parsed.place,
    rashi,
    summary: parsed.summary,
    fromPalmPhoto: hasImage && !parsed.dob,
  };
}

async function deliverReadingFlow(
  message: IncomingAiMessage,
  storedUserMessage: string,
  clientName: string | null,
  image?: { data: Uint8Array; mimeType: string },
) {
  const birthProfile = await buildBirthProfileFromMessage(
    message.text,
    Boolean(image),
  );
  await saveClientBirthProfile(message.from, birthProfile);

  await sleep(getFunnelReadingDelayMs());

  const reading = await generateFunnelReply({
    stage: "reading",
    phone: message.from,
    userMessage: message.text,
    image,
    birthProfile,
    clientName: clientName ?? undefined,
  });

  await persistTurn(
    message.from,
    storedUserMessage,
    reading,
    "reading_delivered",
  );
  await sendTextMessage({ to: message.from, body: reading });
  await sendPaymentOfferAfterReading(message, clientName);
}

async function handlePaidConsultationGate(
  message: IncomingAiMessage,
  storedUserMessage: string,
  stage: "reading_delivered" | "active",
  image?: { data: Uint8Array; mimeType: string },
) {
  const access = await getConsultationAccess(message.from);
  const birthProfile = await getClientBirthProfile(message.from);
  const clientName = await getClientName(message.from);
  const intent = detectConsultationIntent(message.text);

  if (access.hasAccess) {
    const reply = await generatePanditGReply({
      phone: message.from,
      userMessage: message.text,
      image,
      funnelStage: "active",
      sessionMinutesRemaining: access.minutesRemaining,
      birthProfile,
      consultationIntent: intent,
      clientName: clientName ?? undefined,
    });
    await sendTextMessage({ to: message.from, body: reply });
    return;
  }

  const pricing = getConsultationPricing();

  let replyType: PaymentReplyType | null = null;
  if (userClaimsTheyPaid(message.text)) {
    replyType = "claimed_paid_pending";
  } else if (access.reason === "expired") {
    replyType = "expired";
  } else if (isPaymentIntent(message.text)) {
    replyType = "offer";
  }

  if (replyType) {
    const paymentUrl = await resolvePaymentUrl(
      message.from,
      access.pendingPaymentUrl,
    );

    const reply = await generatePaymentReply({
      type: replyType,
      phone: message.from,
      userMessage: message.text,
      paymentUrl,
      amountInr: pricing.priceInrFormatted,
      sessionMinutes: pricing.sessionMinutes,
      clientName: clientName ?? undefined,
    });

    await persistTurn(message.from, storedUserMessage, reply, "active");
    await sendTextMessage({ to: message.from, body: reply });
    return;
  }

  const reply = await generateFreeFollowupReply({
    phone: message.from,
    userMessage: message.text,
    intent,
    birthProfile,
    clientName: clientName ?? undefined,
  });

  await persistTurn(
    message.from,
    storedUserMessage,
    reply,
    stage === "reading_delivered" ? "reading_delivered" : "active",
  );
  await sendTextMessage({ to: message.from, body: reply });
}

async function sendPaymentOfferAfterReading(
  message: IncomingAiMessage,
  clientName: string | null,
) {
  const pricing = getConsultationPricing();
  const paymentUrl = await resolvePaymentUrl(message.from);

  const paymentOffer = await generatePaymentReply({
    type: "offer",
    phone: message.from,
    userMessage: "गहन परामर्श के लिए भुगतान",
    paymentUrl,
    amountInr: pricing.priceInrFormatted,
    sessionMinutes: pricing.sessionMinutes,
    clientName: clientName ?? undefined,
  });

  await saveConversationTurn(
    message.from,
    "[भुगतान लिंक भेजा]",
    paymentOffer,
    undefined,
    "reading_delivered",
  );

  await sendTextMessage({ to: message.from, body: paymentOffer });
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
  const parsedName = parseClientName(message.text);

  const moderated = await handleConversationModeration({
    phone: message.from,
    text: message.text,
    skipStrikeCheck: detailsProvided,
  });
  if (moderated) return;

  try {
    const stage = await resolveFunnelStage(message.from);
    let clientName = await getClientName(message.from);

    if (stage === "initial") {
      const reply = await generateFunnelReply({
        stage: "welcome",
        phone: message.from,
        userMessage: message.text,
      });
      await persistTurn(message.from, storedUserMessage, reply, "awaiting_name");
      await sendTextMessage({ to: message.from, body: reply });
      return;
    }

    if (stage === "awaiting_name") {
      if (parsedName) {
        await saveClientName(message.from, parsedName);
        clientName = parsedName;

        if (detailsProvided) {
          await deliverReadingFlow(message, storedUserMessage, clientName, image);
          return;
        }

        const reply = await generateFunnelReply({
          stage: "ask_details",
          phone: message.from,
          userMessage: message.text,
          clientName,
        });
        await persistTurn(
          message.from,
          storedUserMessage,
          reply,
          "awaiting_details",
        );
        await sendTextMessage({ to: message.from, body: reply });
        return;
      }

      const reply = await generateFunnelReply({
        stage: "ask_name",
        phone: message.from,
        userMessage: message.text,
        hintBirthDetailsPending: detailsProvided,
      });
      await persistTurn(message.from, storedUserMessage, reply, "awaiting_name");
      await sendTextMessage({ to: message.from, body: reply });
      return;
    }

    if (stage === "awaiting_details" && !detailsProvided) {
      const reply = await generateFunnelReply({
        stage: "ask_details",
        phone: message.from,
        userMessage: message.text,
        clientName: clientName ?? undefined,
      });
      await persistTurn(
        message.from,
        storedUserMessage,
        reply,
        "awaiting_details",
      );
      await sendTextMessage({ to: message.from, body: reply });
      return;
    }

    if (stage === "awaiting_details" && detailsProvided) {
      await deliverReadingFlow(message, storedUserMessage, clientName, image);
      return;
    }

    if (requiresPaidSession(stage)) {
      await handlePaidConsultationGate(
        message,
        storedUserMessage,
        stage as "reading_delivered" | "active",
        image,
      );
      return;
    }

    const birthProfile = await getClientBirthProfile(message.from);
    const reply = await generatePanditGReply({
      phone: message.from,
      userMessage: message.text,
      image,
      funnelStage: stage,
      birthProfile,
      consultationIntent: detectConsultationIntent(message.text),
      clientName: clientName ?? undefined,
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
