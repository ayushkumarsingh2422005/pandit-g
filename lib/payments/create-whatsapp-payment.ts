import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import {
  createPaymentRecord,
  findReusableWhatsAppPayment,
  type PaymentRecord,
} from "@/lib/db/payments";
import { sendOrderDetailsPayNow } from "@/lib/whatsapp/send-order-details";

export type WhatsAppPayOfferResult = {
  referenceId: string;
  amountPaise: number;
  reused: boolean;
  messageId?: string;
};

function paymentExpirySeconds(): number {
  const n = Number(process.env.PAYMENT_LINK_EXPIRY_SECONDS);
  return Number.isFinite(n) && n > 0 ? n : 3600;
}

/** Meta reference_id: letters/numbers/_-./ only, max 35 chars. */
export function buildWhatsAppPaymentReferenceId(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  const stamp = Date.now().toString(36);
  const raw = `pg${digits}${stamp}`;
  return raw.slice(0, 35);
}

/**
 * Create (or reuse) a pending native WhatsApp Pay invoice and send Pay Now.
 */
export async function sendConsultationPayNow(input: {
  phone: string;
  contactName?: string;
  bodyText: string;
  forceNew?: boolean;
}): Promise<WhatsAppPayOfferResult> {
  const pricing = getConsultationPricing();
  const paymentLinkExpirySeconds = paymentExpirySeconds();

  if (!input.forceNew) {
    const existing = await findReusableWhatsAppPayment(input.phone);
    if (existing?.referenceId || existing?.paymentLinkId) {
      const referenceId = existing.referenceId ?? existing.paymentLinkId;
      const sent = await sendOrderDetailsPayNow({
        to: input.phone,
        referenceId,
        bodyText: input.bodyText,
        contactName: input.contactName,
        expiresInSeconds: paymentLinkExpirySeconds,
      });
      return {
        referenceId,
        amountPaise: existing.amountPaise,
        reused: true,
        messageId: sent.messageId,
      };
    }
  }

  const referenceId = buildWhatsAppPaymentReferenceId(input.phone);
  const expiresAt = new Date(Date.now() + paymentLinkExpirySeconds * 1000);

  await createPaymentRecord({
    phone: input.phone,
    paymentLinkId: referenceId,
    shortUrl: `whatsapp:pay:${referenceId}`,
    amountPaise: pricing.pricePaise,
    contactName: input.contactName,
    expiresAt,
    channel: "whatsapp_pay",
    referenceId,
  });

  const sent = await sendOrderDetailsPayNow({
    to: input.phone,
    referenceId,
    bodyText: input.bodyText,
    contactName: input.contactName,
    expiresInSeconds: paymentLinkExpirySeconds,
  });

  return {
    referenceId,
    amountPaise: pricing.pricePaise,
    reused: false,
    messageId: sent.messageId,
  };
}

export function isNativeWhatsAppPayment(
  record: PaymentRecord | null | undefined,
): boolean {
  return (
    record?.channel === "whatsapp_pay" ||
    Boolean(record?.shortUrl?.startsWith("whatsapp:pay:"))
  );
}
