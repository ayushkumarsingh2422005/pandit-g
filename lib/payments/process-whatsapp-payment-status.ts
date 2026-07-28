import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import {
  findReusableWhatsAppPayment,
  markPaymentPaid,
  type PaymentRecord,
} from "@/lib/db/payments";
import { saveConversationTurn } from "@/lib/db/conversations";
import { startConsultationSession } from "@/lib/db/sessions";
import { sendHumanTextMessage } from "@/lib/whatsapp/human-typing";
import {
  lookupWhatsAppPayment,
  sendOrderStatusUpdate,
} from "@/lib/whatsapp/send-order-details";
import type { WhatsAppStatusUpdate } from "@/lib/whatsapp/types";

export function paymentSuccessMessage(): string {
  return `दक्षिणा प्राप्त हुई। अब जो भी दिल पर लगा हो वो लिखिए — सुनकर आगे बात करते हैं।`;
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

/**
 * Mark paid → start session → order_status(captured) → success WhatsApp text.
 * Shared by webhook + on-chat reconciliation.
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
  });

  if (!paid) {
    return null;
  }

  const { sessionMinutes } = getConsultationPricing();

  await startConsultationSession({
    phone: paid.phone,
    durationMinutes: sessionMinutes,
    amountPaise: paid.amountPaise,
    paymentLinkId: paid.paymentLinkId,
    razorpayPaymentId: paid.razorpayPaymentId,
  });

  const reply = paymentSuccessMessage();

  await saveConversationTurn(
    paid.phone,
    "[भुगतान सफल — WhatsApp Pay]",
    reply,
    paid.contactName ?? input.contactName,
    "active",
  );

  try {
    // Meta PG order_status uses captured/failed/pending — not "completed"
    await sendOrderStatusUpdate({
      to: paid.phone,
      referenceId: input.referenceId,
      status: "captured",
      bodyText: "भुगतान सफल — आपका परामर्श सत्र शुरू हो गया है।",
      description: "Payment captured",
    });
  } catch (error) {
    console.warn("[whatsapp payment] order_status update failed", error);
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

  return paid;
}

/**
 * Handle WhatsApp statuses of type "payment" (Native Pay Now).
 * Confirms via Meta lookup when possible; falls back to webhook txn success.
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

  // Unlock when lookup confirms OR webhook already reports captured/success.
  // (UI can show Paid while lookup briefly lags or fails.)
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
      "[whatsapp payment] fulfill skipped (already paid or unknown ref)",
      referenceId,
    );
  }
}

/**
 * If user paid but webhook/fulfill missed, re-check pending WA invoice via Meta
 * and unlock on the next message.
 */
export async function reconcilePendingWhatsAppPayment(
  phone: string,
): Promise<boolean> {
  const pending = await findReusableWhatsAppPayment(phone);
  if (!pending) return false;

  const referenceId = pending.referenceId ?? pending.paymentLinkId;
  if (!referenceId) return false;

  try {
    const lookup = await lookupWhatsAppPayment(referenceId);
    if (!lookup || !isLookupPaid(lookup)) {
      return false;
    }

    const paid = await fulfillWhatsAppConsultationPayment({
      referenceId,
      phone: pending.phone,
      razorpayPaymentId: lookup.razorpayPaymentId,
      razorpayOrderId: lookup.razorpayOrderId,
      webhookEventId: `reconcile_${referenceId}_${Date.now()}`,
      contactName: pending.contactName,
    });

    return Boolean(paid);
  } catch (error) {
    console.warn("[whatsapp payment] reconcile failed", referenceId, error);
    return false;
  }
}
