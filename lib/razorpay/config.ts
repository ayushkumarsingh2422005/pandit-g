function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getRazorpayConfig() {
  return {
    keyId: requireEnv("RAZORPAY_KEY_ID"),
    keySecret: requireEnv("RAZORPAY_KEY_SECRET"),
    webhookSecret: requireEnv("RAZORPAY_WEBHOOK_SECRET"),
    pricePaise:
      Number(process.env.CONSULTATION_PRICE_PAISE) > 0
        ? Number(process.env.CONSULTATION_PRICE_PAISE)
        : 15100,
    sessionMinutes:
      Number(process.env.CONSULTATION_DURATION_MINUTES) > 0
        ? Number(process.env.CONSULTATION_DURATION_MINUTES)
        : 30,
    paymentLinkExpirySeconds:
      Number(process.env.PAYMENT_LINK_EXPIRY_SECONDS) > 0
        ? Number(process.env.PAYMENT_LINK_EXPIRY_SECONDS)
        : 3600,
  };
}

export function formatPriceInr(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}
