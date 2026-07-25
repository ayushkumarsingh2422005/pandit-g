import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import { markPaymentPaid } from "@/lib/db/payments";
import { saveConversationTurn } from "@/lib/db/conversations";
import { startConsultationSession } from "@/lib/db/sessions";
import { sendHumanTextMessage } from "@/lib/whatsapp/human-typing";
import {
  lookupWhatsAppPayment,
  sendOrderStatusUpdate,
} from "@/lib/whatsapp/send-order-details";
import type { WhatsAppStatusUpdate } from "@/lib/whatsapp/types";

function successMessage(): string {
  return `दक्षिणा प्राप्त हुई। अब जो भी दिल पर लगा हो वो लिखिए — सुनकर आगे बात करते हैं।`;
}

/**
 * Handle WhatsApp statuses of type "payment" (Native Pay Now).
 * Always confirms via Meta payment lookup before unlocking the session.
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

  const webhookStatus = statusUpdate.status;
  const phone = statusUpdate.recipient_id;
  const eventId = statusUpdate.id || `wa_pay_${referenceId}_${webhookStatus}`;

  console.info(
    `[whatsapp payment] ${webhookStatus} | ref: ${referenceId} | to: ${phone}`,
  );

  if (webhookStatus !== "captured" && webhookStatus !== "pending") {
    return;
  }

  // Confirm with Meta lookup — never unlock on webhook alone
  const lookup = await lookupWhatsAppPayment(referenceId);
  if (!lookup) {
    console.warn("[whatsapp payment] Lookup failed", referenceId);
    return;
  }

  if (lookup.status !== "captured") {
    console.info(
      `[whatsapp payment] Lookup status=${lookup.status} — waiting`,
      referenceId,
    );
    return;
  }

  const paid = await markPaymentPaid({
    referenceId,
    razorpayPaymentId:
      lookup.razorpayPaymentId ??
      statusUpdate.payment?.transaction?.pg_transaction_id,
    razorpayOrderId:
      lookup.razorpayOrderId ?? statusUpdate.payment?.transaction?.id,
    phone,
    webhookEventId: eventId,
  });

  if (!paid) {
    // Already processed or unknown reference
    return;
  }

  const { sessionMinutes } = getConsultationPricing();

  await startConsultationSession({
    phone: paid.phone,
    durationMinutes: sessionMinutes,
    amountPaise: paid.amountPaise,
    paymentLinkId: paid.paymentLinkId,
    razorpayPaymentId: paid.razorpayPaymentId,
  });

  const reply = successMessage();

  await saveConversationTurn(
    paid.phone,
    "[भुगतान सफल — WhatsApp Pay]",
    reply,
    paid.contactName,
    "active",
  );

  try {
    await sendOrderStatusUpdate({
      to: paid.phone,
      referenceId,
      status: "completed",
      bodyText: "भुगतान सफल — आपका परामर्श सत्र शुरू हो गया है।",
      description: "Payment captured",
    });
  } catch (error) {
    console.warn("[whatsapp payment] order_status update failed", error);
  }

  await sendHumanTextMessage({ to: paid.phone, body: reply });
}
