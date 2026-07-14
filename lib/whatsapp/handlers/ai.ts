import {
  generateErrorReply,
  generateFunnelReply,
} from "@/lib/ai/generate-funnel-reply";
import { generatePaymentReply } from "@/lib/ai/generate-payment-reply";
import type { PaymentReplyType } from "@/lib/ai/generate-payment-reply";
import { generatePanditGReply } from "@/lib/ai/generate-reply";
import { saveConversationTurn, getConversationHistory } from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import {
  hasCompleteBirthDetailsInHistory,
  missingBirthFields,
  userProvidedDetails,
} from "@/lib/funnel/detect-birth-details";
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
import { sendHumanTextMessage } from "../human-typing";
import type { IncomingAiMessage } from "../types";

/** AI reply with character-based typing delay (human feel). */
async function replyAsHuman(
  message: IncomingAiMessage,
  body: string,
  generationStartedAt?: number,
) {
  await sendHumanTextMessage({
    to: message.from,
    body,
    replyToMessageId: message.messageId,
    generationStartedAt,
  });
}

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

function requiresPaidSession(stage: string): boolean {
  return stage === "reading_delivered" || stage === "active";
}

async function resolvePaymentUrl(
  phone: string,
  contactName: string | undefined,
  existingUrl?: string,
): Promise<string | undefined> {
  if (existingUrl) return existingUrl;
  if (!isRazorpayConfigured()) return undefined;

  try {
    const link = await getOrCreateConsultationPaymentLink(phone, contactName);
    return link.shortUrl;
  } catch (error) {
    console.error("[payment link]", error);
    return undefined;
  }
}

async function handlePaidConsultationGate(
  message: IncomingAiMessage,
  storedUserMessage: string,
  stage: "reading_delivered" | "active",
  image?: { data: Uint8Array; mimeType: string },
) {
  const access = await getConsultationAccess(message.from);

  if (access.hasAccess) {
    const startedAt = Date.now();
    const reply = await generatePanditGReply({
      phone: message.from,
      userMessage: message.text,
      contactName: message.contactName,
      image,
      funnelStage: "active",
      sessionMinutesRemaining: access.minutesRemaining,
    });
    await replyAsHuman(message, reply, startedAt);
    return;
  }

  const pricing = getConsultationPricing();
  const paymentUrl = await resolvePaymentUrl(
    message.from,
    message.contactName,
    access.pendingPaymentUrl,
  );

  let replyType: PaymentReplyType;
  if (userClaimsTheyPaid(message.text)) {
    replyType = "claimed_paid_pending";
  } else if (access.reason === "expired") {
    replyType = "expired";
  } else if (stage === "reading_delivered" || isPaymentIntent(message.text)) {
    replyType = "offer";
  } else {
    replyType = "unpaid";
  }

  const startedAt = Date.now();
  const reply = await generatePaymentReply({
    type: replyType,
    phone: message.from,
    userMessage: message.text,
    contactName: message.contactName,
    paymentUrl,
    amountInr: pricing.priceInrFormatted,
    sessionMinutes: pricing.sessionMinutes,
  });

  await persistTurn(
    message.from,
    storedUserMessage,
    reply,
    message.contactName,
    "active",
  );
  await replyAsHuman(message, reply, startedAt);
}

async function sendPaymentOfferAfterReading(message: IncomingAiMessage) {
  const pricing = getConsultationPricing();
  const paymentUrl = await resolvePaymentUrl(
    message.from,
    message.contactName,
  );

  const paymentOffer = await generatePaymentReply({
    type: "offer",
    phone: message.from,
    userMessage: "गहन परामर्श के लिए भुगतान",
    contactName: message.contactName,
    paymentUrl,
    amountInr: pricing.priceInrFormatted,
    sessionMinutes: pricing.sessionMinutes,
  });

  await saveConversationTurn(
    message.from,
    "[भुगतान लिंक भेजा]",
    paymentOffer,
    message.contactName,
    "reading_delivered",
  );

  await replyAsHuman(message, paymentOffer);
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
        const startedAt = Date.now();
        const reply = await generateErrorReply("image_download");
        await replyAsHuman(message, reply, startedAt);
      } catch {
        await replyAsHuman(
          message,
          "🙏 फोटो नहीं खुली — कृपया साफ हथेली की फोटो दोबारा भेजिए।",
        );
      }
      return;
    }
  }

  const storedUserMessage = buildStoredUserMessage(message.text, hasImage);
  const history = isDbConfigured()
    ? await getConversationHistory(message.from)
    : [];
  const detailsInMessage = userProvidedDetails(message.text, hasImage);
  const detailsComplete = hasCompleteBirthDetailsInHistory(
    history,
    message.text,
    hasImage,
  );
  const stage = await resolveFunnelStage(message.from);

  const moderated = await handleConversationModeration({
    phone: message.from,
    text: message.text,
    hasMedia: hasImage,
    funnelStage: stage,
    skipFlowViolationCheck: detailsInMessage || detailsComplete,
  });
  if (moderated) return;

  try {

    if (stage === "initial") {
      const startedAt = Date.now();
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
      await replyAsHuman(message, reply, startedAt);
      return;
    }

    if (stage === "awaiting_details" && !detailsComplete) {
      const startedAt = Date.now();
      const reply = await generateFunnelReply({
        stage: "ask_details",
        phone: message.from,
        userMessage: message.text,
        contactName: message.contactName,
        missingBirthFields: missingBirthFields(
          history,
          message.text,
          hasImage,
        ),
      });
      await persistTurn(
        message.from,
        storedUserMessage,
        reply,
        message.contactName,
        "awaiting_details",
      );
      await replyAsHuman(message, reply, startedAt);
      return;
    }

    if (stage === "awaiting_details" && detailsComplete) {
      // Kundli "study" pause — then age-based reading (extra long feel).
      await sleep(getFunnelReadingDelayMs());

      const startedAt = Date.now();
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
      await replyAsHuman(message, reading, startedAt);
      await sendPaymentOfferAfterReading(message);
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

    const startedAt = Date.now();
    const reply = await generatePanditGReply({
      phone: message.from,
      userMessage: message.text,
      contactName: message.contactName,
      image,
      funnelStage: stage,
    });

    await replyAsHuman(message, reply, startedAt);
  } catch (error) {
    console.error("[whatsapp ai]", error);
    try {
      const startedAt = Date.now();
      const reply = await generateErrorReply("general");
      await replyAsHuman(message, reply, startedAt);
    } catch {
      await replyAsHuman(message, "🙏 कृपया थोड़ी देर बाद फिर लिखिए।");
    }
  }
}
