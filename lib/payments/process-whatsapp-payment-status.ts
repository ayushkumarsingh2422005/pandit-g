import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import {
  claimPaymentSuccessNotification,
  findLatestWhatsAppPayment,
  findReusableWhatsAppPayment,
  markPaymentPaid,
  type PaymentRecord,
} from "@/lib/db/payments";
import {
  getConversationIntakeState,
  saveConversationTurn,
} from "@/lib/db/conversations";
import {
  getActiveSession,
  startConsultationSession,
} from "@/lib/db/sessions";
import { askPaymentScreenshotMessage, type IntakeProfile } from "@/lib/funnel/intake-script";
import { sendHumanTextMessage } from "@/lib/whatsapp/human-typing";
import {
  lookupWhatsAppPayment,
  sendOrderStatusUpdate,
} from "@/lib/whatsapp/send-order-details";
import type { WhatsAppStatusUpdate } from "@/lib/whatsapp/types";
import { isDbConfigured } from "@/lib/db/is-configured";

export function paymentSuccessMessage(): string {
  return askPaymentScreenshotMessage();
}

function isSuccessfulWebhook(statusUpdate: WhatsAppStatusUpdate): boolean {
  const status = (statusUpdate.status || "").toLowerCase();
  const txnStatus = (
    statusUpdate.payment?.transaction?.status || ""
  ).toLowerCase();
  return (
    status === "captured" ||
    status === "paid" ||
    status === "success" ||
    txnStatus === "success"
  );
}

function isLookupPaid(lookup: {
  status: string;
  razorpayPaymentId?: string;
}): boolean {
  const status = (lookup.status || "").toLowerCase();
  return (
    status === "captured" ||
    status === "paid" ||
    status === "success" ||
    Boolean(lookup.razorpayPaymentId)
  );
}

async function ensureActiveSession(paid: PaymentRecord) {
  const active = await getActiveSession(paid.phone);
  if (active) return;

  const { sessionMinutes } = getConsultationPricing();
  await startConsultationSession({
    phone: paid.phone,
    durationMinutes: sessionMinutes,
    amountPaise: paid.amountPaise,
    paymentLinkId: paid.paymentLinkId,
    razorpayPaymentId: paid.razorpayPaymentId,
  });
}

/**
 * Send success WhatsApp text at most once per payment (WA + Razorpay safe).
 */
export async function notifyPaymentSuccessOnce(
  paid: PaymentRecord,
  options?: { referenceId?: string },
): Promise<boolean> {
  const claimed = await claimPaymentSuccessNotification(paid.paymentLinkId);
  if (!claimed) return false;

  const reply = paymentSuccessMessage();
  const referenceId =
    options?.referenceId ?? paid.referenceId ?? paid.paymentLinkId;

  let intakeProfile: IntakeProfile = {
    awaitingPaymentScreenshot: true,
  };
  if (isDbConfigured()) {
    try {
      const intake = await getConversationIntakeState(paid.phone);
      intakeProfile = {
        ...intake.intakeProfile,
        awaitingPaymentScreenshot: true,
      };
    } catch {
      // keep minimal flag
    }
  }

  await saveConversationTurn(
    paid.phone,
    "[भुगतान सफल — WhatsApp Pay]",
    reply,
    paid.contactName,
    "active",
    {
      funnelStage: "active",
      intakeStep: null,
      intakeProfile,
    },
  );

  if (referenceId) {
    try {
      await sendOrderStatusUpdate({
        to: paid.phone,
        referenceId,
        status: "captured",
        bodyText: "भुगतान सफल — आपका परामर्श सत्र शुरू हो गया है।",
        description: "Payment captured",
      });
    } catch (error) {
      console.warn("[whatsapp payment] order_status update failed", error);
    }
  }

  try {
    await sendHumanTextMessage({
      to: paid.phone,
      body: reply,
      waitUntilSent: true,
    });
  } catch (error) {
    console.error("[whatsapp payment] success message failed", error);
  }

  return true;
}

/**
 * Mark paid → start session → one success message.
 */
export async function fulfillWhatsAppConsultationPayment(input: {
  referenceId: string;
  phone: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  webhookEventId: string;
  contactName?: string;
}): Promise<PaymentRecord | null> {
  const paid = await markPaymentPaid({
    referenceId: input.referenceId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpayOrderId: input.razorpayOrderId,
    phone: input.phone,
    webhookEventId: input.webhookEventId,
    returnIfAlreadyPaid: true,
  });

  if (!paid) return null;

  await ensureActiveSession({
    ...paid,
    contactName: paid.contactName ?? input.contactName,
  });

  await notifyPaymentSuccessOnce(paid, { referenceId: input.referenceId });
  return paid;
}

/**
 * Handle WhatsApp statuses of type "payment" (Native Pay Now).
 */
export async function processWhatsAppPaymentStatus(
  statusUpdate: WhatsAppStatusUpdate,
): Promise<void> {
  if (statusUpdate.type !== "payment") return;

  const referenceId = statusUpdate.payment?.reference_id?.trim();
  if (!referenceId) {
    console.warn("[whatsapp payment] Missing reference_id", statusUpdate.id);
    return;
  }

  const webhookStatus = (statusUpdate.status || "").toLowerCase();
  const phone = statusUpdate.recipient_id;
  const eventId = statusUpdate.id || `wa_pay_${referenceId}_${webhookStatus}`;

  console.info(
    `[whatsapp payment] ${webhookStatus} | ref: ${referenceId} | to: ${phone}`,
  );

  const webhookLooksPaid = isSuccessfulWebhook(statusUpdate);
  if (
    !webhookLooksPaid &&
    webhookStatus !== "pending" &&
    webhookStatus !== "captured"
  ) {
    return;
  }

  let lookupPaid = false;
  let razorpayPaymentId =
    statusUpdate.payment?.transaction?.pg_transaction_id;
  let razorpayOrderId = statusUpdate.payment?.transaction?.id;

  try {
    const lookup = await lookupWhatsAppPayment(referenceId);
    if (lookup) {
      console.info(
        `[whatsapp payment] lookup status=${lookup.status} ref=${referenceId}`,
      );
      lookupPaid = isLookupPaid(lookup);
      razorpayPaymentId = lookup.razorpayPaymentId ?? razorpayPaymentId;
      razorpayOrderId = lookup.razorpayOrderId ?? razorpayOrderId;
    } else {
      console.warn("[whatsapp payment] Lookup failed", referenceId);
    }
  } catch (error) {
    console.warn("[whatsapp payment] Lookup error", referenceId, error);
  }

  if (!lookupPaid && !webhookLooksPaid) {
    console.info(
      `[whatsapp payment] not confirmed yet — waiting`,
      referenceId,
    );
    return;
  }

  const paid = await fulfillWhatsAppConsultationPayment({
    referenceId,
    phone,
    razorpayPaymentId,
    razorpayOrderId,
    webhookEventId: eventId,
  });

  if (!paid) {
    console.info(
      "[whatsapp payment] fulfill skipped (unknown ref)",
      referenceId,
    );
  }
}

/**
 * If user paid but webhook/fulfill missed, re-check on next message.
 */
export async function reconcilePendingWhatsAppPayment(
  phone: string,
): Promise<boolean> {
  const pending = await findReusableWhatsAppPayment(phone);
  const latest = pending ?? (await findLatestWhatsAppPayment(phone));
  if (!latest) return false;

  const referenceId = latest.referenceId ?? latest.paymentLinkId;
  if (!referenceId) return false;

  if (latest.status === "paid") {
    await ensureActiveSession(latest);
    await notifyPaymentSuccessOnce(latest, { referenceId });
    return true;
  }

  try {
    const lookup = await lookupWhatsAppPayment(referenceId);
    if (!lookup || !isLookupPaid(lookup)) {
      return false;
    }

    const paid = await fulfillWhatsAppConsultationPayment({
      referenceId,
      phone: latest.phone,
      razorpayPaymentId: lookup.razorpayPaymentId,
      razorpayOrderId: lookup.razorpayOrderId,
      webhookEventId: `reconcile_${referenceId}_${Date.now()}`,
      contactName: latest.contactName,
    });

    return Boolean(paid);
  } catch (error) {
    console.warn("[whatsapp payment] reconcile failed", referenceId, error);
    return false;
  }
}
