import {
  generateErrorReply,
} from "@/lib/ai/generate-funnel-reply";
import {
  generatePaymentReplyDetailed,
} from "@/lib/ai/generate-payment-reply";
import type { PaymentReplyType } from "@/lib/ai/generate-payment-reply";
import { generatePanditGReply } from "@/lib/ai/generate-reply";
import {
  getConversationHistory,
  getConversationIntakeState,
  saveConversationTurn,
} from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import {
  advanceScriptedIntake,
  persistIntakeReply,
  startScriptedIntake,
} from "@/lib/funnel/intake-handler";
import { resolveFunnelStage } from "@/lib/funnel/state";
import { getConsultationAccess } from "@/lib/payments/consultation-access";
import { sendConsultationPayNow } from "@/lib/payments/create-whatsapp-payment";
import {
  isPaymentIntent,
  userClaimsTheyPaid,
} from "@/lib/payments/payment-intent";
import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import { getOrCreateConsultationPaymentLink } from "@/lib/razorpay/create-payment-link";
import { isRazorpayConfigured } from "@/lib/razorpay/is-configured";
import { handleConversationModeration } from "@/lib/moderation/handle-moderation";
import {
  isPaymentLinkFallbackEnabled,
  isWhatsAppPaymentsEnabled,
} from "../payments-config";
import { sendHumanTextMessage } from "../human-typing";
import type { IncomingAiMessage } from "../types";

/** AI reply with character-based typing delay (human feel). */
async function replyAsHuman(
  message: IncomingAiMessage,
  body: string,
  generationStartedAt?: number,
  options?: { waitUntilSent?: boolean },
) {
  await sendHumanTextMessage({
    to: message.from,
    body,
    replyToMessageId: message.messageId,
    generationStartedAt,
    waitUntilSent: options?.waitUntilSent,
  });
}

function buildStoredUserMessage(text: string, hasImage: boolean): string {
  const trimmed = text.trim();
  if (hasImage) return trimmed ? `[फोटो] ${trimmed}` : "[फोटो भेजी]";
  return trimmed || "[संदेश]";
}

function requiresPaidSession(stage: string): boolean {
  return stage === "reading_delivered" || stage === "active";
}

function useNativePay(): boolean {
  return isWhatsAppPaymentsEnabled();
}

function usePaymentLink(): boolean {
  if (useNativePay()) return isPaymentLinkFallbackEnabled();
  return isRazorpayConfigured();
}

async function resolvePaymentUrl(
  phone: string,
  contactName: string | undefined,
  existingUrl?: string,
): Promise<string | undefined> {
  if (!usePaymentLink()) return undefined;
  if (existingUrl && !existingUrl.startsWith("whatsapp:pay:")) {
    return existingUrl;
  }
  if (!isRazorpayConfigured()) return undefined;

  try {
    const link = await getOrCreateConsultationPaymentLink(phone, contactName);
    return link.shortUrl;
  } catch (error) {
    console.error("[payment link]", error);
    return undefined;
  }
}

async function sendNativePayNowSafe(
  phone: string,
  contactName: string | undefined,
  bodyText: string,
) {
  try {
    await sendConsultationPayNow({
      phone,
      contactName,
      bodyText: bodyText.slice(0, 1024),
    });
  } catch (error) {
    console.error("[whatsapp pay now]", error);
  }
}

async function handlePaidConsultationGate(
  message: IncomingAiMessage,
  storedUserMessage: string,
  stage: "reading_delivered" | "active",
) {
  const access = await getConsultationAccess(message.from);

  if (access.hasAccess) {
    const startedAt = Date.now();
    const reply = await generatePanditGReply({
      phone: message.from,
      userMessage: message.text,
      contactName: message.contactName,
      funnelStage: "active",
      sessionMinutesRemaining: access.minutesRemaining,
    });
    await replyAsHuman(message, reply, startedAt);
    return;
  }

  const pricing = getConsultationPricing();
  const native = useNativePay();
  const paymentUrl = native
    ? undefined
    : await resolvePaymentUrl(
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
  const { text: reply, offerPayment } = await generatePaymentReplyDetailed({
    type: replyType,
    phone: message.from,
    userMessage: message.text,
    contactName: message.contactName,
    paymentUrl,
    paymentMode: native ? "native" : "link",
    amountInr: pricing.priceInrFormatted,
    sessionMinutes: pricing.sessionMinutes,
  });

  await saveConversationTurn(
    message.from,
    storedUserMessage,
    reply,
    message.contactName,
    "active",
  );
  await replyAsHuman(message, reply, startedAt, {
    waitUntilSent: offerPayment && native,
  });

  if (offerPayment && native) {
    await sendNativePayNowSafe(
      message.from,
      message.contactName,
      "नीचे Review and pay दबाकर दक्षिणा पूर्ण करें।",
    );
  }
}

async function sendPaymentOfferAfterIntake(message: IncomingAiMessage) {
  const pricing = getConsultationPricing();
  const native = useNativePay();

  if (native) {
    const bodyText =
      `गहन परामर्श के लिए ${pricing.priceInrFormatted} — ${pricing.sessionMinutes} मिनट WhatsApp बातचीत। ` +
      `नीचे Review and pay दबाकर दक्षिणा पूर्ण करें।`;

    await saveConversationTurn(
      message.from,
      "[Pay Now भेजा]",
      bodyText,
      message.contactName,
      "reading_delivered",
      { funnelStage: "reading_delivered", intakeStep: null },
    );

    await sendNativePayNowSafe(
      message.from,
      message.contactName,
      bodyText,
    );
    return;
  }

  const paymentUrl = await resolvePaymentUrl(
    message.from,
    message.contactName,
  );

  const { text: paymentOffer } = await generatePaymentReplyDetailed({
    type: "offer",
    phone: message.from,
    userMessage: "गहन परामर्श के लिए भुगतान",
    contactName: message.contactName,
    paymentUrl,
    paymentMode: "link",
    amountInr: pricing.priceInrFormatted,
    sessionMinutes: pricing.sessionMinutes,
  });

  await saveConversationTurn(
    message.from,
    "[भुगतान लिंक भेजा]",
    paymentOffer,
    message.contactName,
    "reading_delivered",
    { funnelStage: "reading_delivered", intakeStep: null },
  );

  await replyAsHuman(message, paymentOffer);
}

async function handleScriptedIntake(
  message: IncomingAiMessage,
  storedUserMessage: string,
  hasImage: boolean,
) {
  const history = isDbConfigured()
    ? await getConversationHistory(message.from)
    : [];
  const intake = isDbConfigured()
    ? await getConversationIntakeState(message.from)
    : {
        intakeStep: null,
        intakeProfile: {},
        clientName: undefined,
        funnelStage: null,
      };

  const stage = await resolveFunnelStage(message.from);
  const startedAt = Date.now();

  // First contact — fixed welcome (ask name). Ignore first message content.
  if (stage === "initial") {
    const start = startScriptedIntake();
    if (start.kind !== "reply") return;

    await persistIntakeReply({
      phone: message.from,
      userMessage: storedUserMessage,
      reply: start.reply,
      contactName: message.contactName,
      result: start,
    });
    await replyAsHuman(message, start.reply, startedAt);
    return;
  }

  // Legacy awaiting_details without intakeStep → collect name next
  const step = intake.intakeStep ?? "awaiting_name";

  const result = await advanceScriptedIntake({
    step,
    profile: intake.intakeProfile,
    userText: message.text,
    hasImage,
    history,
  });

  if (result.kind === "ready_for_payment") {
    await saveConversationTurn(
      message.from,
      storedUserMessage,
      result.reply,
      message.contactName,
      "reading_delivered",
      {
        funnelStage: "reading_delivered",
        intakeStep: null,
        intakeProfile: result.intakeProfile,
        clientName: result.clientName,
      },
    );
    await replyAsHuman(message, result.reply, startedAt, {
      waitUntilSent: true,
    });
    await sendPaymentOfferAfterIntake(message);
    return;
  }

  await persistIntakeReply({
    phone: message.from,
    userMessage: storedUserMessage,
    reply: result.reply,
    contactName: message.contactName,
    result,
  });
  await replyAsHuman(message, result.reply, startedAt);
}

/** Funnel + AI handler. Read receipt + typing are sent earlier in the webhook route. */
export async function handleAiMessage(message: IncomingAiMessage) {
  const hasImage = Boolean(message.imageMediaId);
  const storedUserMessage = buildStoredUserMessage(message.text, hasImage);
  const stage = await resolveFunnelStage(message.from);

  const inScriptedIntake =
    stage === "initial" || stage === "awaiting_details";

  const moderated = await handleConversationModeration({
    phone: message.from,
    text: message.text,
    hasMedia: hasImage,
    funnelStage: stage,
    // Scripted intake answers (name, problem #, dates) must not trip flow checks
    skipFlowViolationCheck: inScriptedIntake,
  });
  if (moderated) return;

  try {
    if (stage === "initial" || stage === "awaiting_details") {
      await handleScriptedIntake(message, storedUserMessage, hasImage);
      return;
    }

    if (requiresPaidSession(stage)) {
      await handlePaidConsultationGate(
        message,
        storedUserMessage,
        stage as "reading_delivered" | "active",
      );
      return;
    }

    const startedAt = Date.now();
    const reply = await generatePanditGReply({
      phone: message.from,
      userMessage: hasImage
        ? message.text.trim() ||
          "उपयोगकर्ता ने फोटो भेजी। हस्तरेखा मत करो — जन्म विवरण या उनकी बात पर जवाब दो।"
        : message.text,
      contactName: message.contactName,
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
