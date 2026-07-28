import type { PaymentRecord } from "@/lib/db/payments";
import { startConsultationSession } from "@/lib/db/sessions";
import { getRazorpayConfig } from "@/lib/razorpay/config";
import { notifyPaymentSuccessOnce } from "@/lib/payments/process-whatsapp-payment-status";

type RazorpayWebhookPayload = {
  event?: string;
  id?: string;
  payload?: {
    payment?: { entity?: Record<string, unknown> };
    payment_link?: { entity?: Record<string, unknown> };
  };
};

function readNotes(
  entity: Record<string, unknown> | undefined,
): { phone?: string; contactName?: string; referenceId?: string } {
  const notes = entity?.notes as Record<string, string> | undefined;
  return {
    phone: notes?.phone,
    contactName: notes?.contactName || undefined,
    referenceId: notes?.reference_id || notes?.referenceId || undefined,
  };
}

function extractPhoneFromWebhook(
  payload: RazorpayWebhookPayload,
): string | undefined {
  const paymentEntity = payload.payload?.payment?.entity;
  const linkEntity = payload.payload?.payment_link?.entity;

  return (
    readNotes(paymentEntity).phone ||
    readNotes(linkEntity).phone ||
    (linkEntity?.reference_id as string | undefined)
  );
}

function extractReferenceFromWebhook(
  payload: RazorpayWebhookPayload,
): string | undefined {
  const paymentEntity = payload.payload?.payment?.entity;
  const linkEntity = payload.payload?.payment_link?.entity;
  return (
    readNotes(paymentEntity).referenceId ||
    readNotes(linkEntity).referenceId ||
    (paymentEntity?.receipt as string | undefined) ||
    (linkEntity?.reference_id as string | undefined)
  );
}

export async function processRazorpayWebhookEvent(
  payload: RazorpayWebhookPayload,
): Promise<void> {
  const event = payload.event ?? "";
  const eventId = payload.id ?? `${event}_${Date.now()}`;

  const paidEvents = new Set([
    "payment.captured",
    "payment_link.paid",
    "order.paid",
  ]);

  if (!paidEvents.has(event)) {
    return;
  }

  const paymentEntity = payload.payload?.payment?.entity;
  const linkEntity = payload.payload?.payment_link?.entity;

  const phone = extractPhoneFromWebhook(payload);
  const referenceId = extractReferenceFromWebhook(payload);
  const paymentLinkId =
    (linkEntity?.id as string | undefined) ||
    (paymentEntity?.payment_link_id as string | undefined);
  const razorpayPaymentId = paymentEntity?.id as string | undefined;

  if (!phone && !paymentLinkId && !referenceId) {
    console.warn(
      "[razorpay webhook] No phone, payment link, or reference",
      event,
    );
    return;
  }

  const { markPaymentPaid } = await import("@/lib/db/payments");

  const paid: PaymentRecord | null = await markPaymentPaid({
    referenceId,
    paymentLinkId,
    razorpayPaymentId,
    phone,
    webhookEventId: eventId,
    returnIfAlreadyPaid: true,
  });

  if (!paid) {
    console.warn("[razorpay webhook] Payment record not found", {
      event,
      phone,
      paymentLinkId,
      referenceId,
    });
    return;
  }

  const { sessionMinutes } = getRazorpayConfig();

  await startConsultationSession({
    phone: paid.phone,
    durationMinutes: sessionMinutes,
    amountPaise: paid.amountPaise,
    paymentLinkId: paid.paymentLinkId,
    razorpayPaymentId: paid.razorpayPaymentId,
  });

  // Shared claim — won't duplicate if WhatsApp webhook already notified
  await notifyPaymentSuccessOnce(paid, {
    referenceId: referenceId ?? paid.referenceId,
  });
}
