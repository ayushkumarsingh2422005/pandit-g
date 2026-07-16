import type { PaymentRecord } from "@/lib/db/payments";
import { startConsultationSession } from "@/lib/db/sessions";
import { saveConversationTurn } from "@/lib/db/conversations";
import { getRazorpayConfig } from "@/lib/razorpay/config";
import { sendHumanTextMessage } from "@/lib/whatsapp/human-typing";

function buildPaymentSuccessMessage(_contactName: string | undefined): string {
  return `दक्षिणा प्राप्त हुई। अब जो भी दिल पर लगा हो वो लिखिए — सुनकर आगे बात करते हैं।`;
}

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
): { phone?: string; contactName?: string } {
  const notes = entity?.notes as Record<string, string> | undefined;
  return {
    phone: notes?.phone,
    contactName: notes?.contactName || undefined,
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
  const paymentLinkId =
    (linkEntity?.id as string | undefined) ||
    (paymentEntity?.payment_link_id as string | undefined);
  const razorpayPaymentId = paymentEntity?.id as string | undefined;

  if (!phone && !paymentLinkId) {
    console.warn("[razorpay webhook] No phone or payment link id", event);
    return;
  }

  const { markPaymentPaid } = await import("@/lib/db/payments");

  const paid: PaymentRecord | null = await markPaymentPaid({
    paymentLinkId,
    razorpayPaymentId,
    phone,
    webhookEventId: eventId,
  });

  if (!paid) {
    console.warn("[razorpay webhook] Payment record not found", {
      event,
      phone,
      paymentLinkId,
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

  const reply = buildPaymentSuccessMessage(paid.contactName);

  await saveConversationTurn(
    paid.phone,
    "[भुगतान सफल]",
    reply,
    paid.contactName,
    "active",
  );

  await sendHumanTextMessage({ to: paid.phone, body: reply });
}
