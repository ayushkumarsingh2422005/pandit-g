import { getConsultationPricing } from "@/lib/config/consultation-pricing";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getRazorpayConfig() {
  const pricing = getConsultationPricing();

  return {
    keyId: requireEnv("RAZORPAY_KEY_ID"),
    keySecret: requireEnv("RAZORPAY_KEY_SECRET"),
    webhookSecret: requireEnv("RAZORPAY_WEBHOOK_SECRET"),
    pricePaise: pricing.pricePaise,
    priceInr: pricing.priceInr,
    priceInrFormatted: pricing.priceInrFormatted,
    sessionMinutes: pricing.sessionMinutes,
    paymentLinkExpirySeconds:
      Number(process.env.PAYMENT_LINK_EXPIRY_SECONDS) > 0
        ? Number(process.env.PAYMENT_LINK_EXPIRY_SECONDS)
        : 3600,
  };
}

export function formatPriceInr(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}
