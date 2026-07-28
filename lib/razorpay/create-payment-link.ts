import {
  createPaymentRecord,
  findReusablePaymentLink,
} from "@/lib/db/payments";
import { getRazorpayClient } from "./client";
import { formatPriceInr, getRazorpayConfig } from "./config";

export type PaymentLinkResult = {
  paymentLinkId: string;
  shortUrl: string;
  amountPaise: number;
  amountInr: string;
  reused: boolean;
};

function formatWhatsAppContact(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("91") ? `+${digits}` : `+91${digits}`;
}

export async function getOrCreateConsultationPaymentLink(
  phone: string,
  contactName?: string,
  amountPaiseOverride?: number,
): Promise<PaymentLinkResult> {
  const existing = await findReusablePaymentLink(phone);
  if (
    existing?.shortUrl &&
    existing.paymentLinkId &&
    (amountPaiseOverride == null ||
      existing.amountPaise === amountPaiseOverride)
  ) {
    return {
      paymentLinkId: existing.paymentLinkId,
      shortUrl: existing.shortUrl,
      amountPaise: existing.amountPaise,
      amountInr: formatPriceInr(existing.amountPaise),
      reused: true,
    };
  }

  const { pricePaise: defaultPaise, sessionMinutes, paymentLinkExpirySeconds } =
    getRazorpayConfig();
  const pricePaise = amountPaiseOverride ?? defaultPaise;
  const razorpay = getRazorpayClient();

  const link = await razorpay.paymentLink.create({
    amount: pricePaise,
    currency: "INR",
    description: `देवदत्त जोशी — परामर्श (₹${Math.round(pricePaise / 100)})`,
    customer: {
      contact: formatWhatsAppContact(phone),
      name: contactName || undefined,
    },
    notes: {
      phone,
      contactName: contactName || "",
      product: "consultation_session",
      amountInr: String(Math.round(pricePaise / 100)),
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
    expire_by: Math.floor(Date.now() / 1000) + paymentLinkExpirySeconds,
  });

  const shortUrl = link.short_url;
  const paymentLinkId = link.id;

  if (!shortUrl || !paymentLinkId) {
    throw new Error("Razorpay did not return a payment link URL");
  }

  await createPaymentRecord({
    phone,
    paymentLinkId,
    shortUrl,
    amountPaise: pricePaise,
    contactName,
    expiresAt: new Date(Date.now() + paymentLinkExpirySeconds * 1000),
  });

  return {
    paymentLinkId,
    shortUrl,
    amountPaise: pricePaise,
    amountInr: formatPriceInr(pricePaise),
    reused: false,
  };
}
