/**
 * Native WhatsApp Pay (In-Chat) configuration.
 * Requires Meta payment configuration linked to Razorpay (Active).
 */

export function isWhatsAppPaymentsEnabled(): boolean {
  const flag = process.env.WHATSAPP_PAYMENTS_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  return Boolean(
    process.env.WHATSAPP_PAYMENT_CONFIGURATION_NAME?.trim() &&
      (flag === "true" || flag === "1" || flag === "on" || flag === undefined || flag === ""),
  );
}

export function isPaymentLinkFallbackEnabled(): boolean {
  const flag = process.env.WHATSAPP_PAYMENT_LINK_FALLBACK?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "on";
}

export function getWhatsAppPaymentConfig() {
  const configurationName =
    process.env.WHATSAPP_PAYMENT_CONFIGURATION_NAME?.trim() ?? "";
  if (!configurationName) {
    throw new Error(
      'Missing required environment variable: "WHATSAPP_PAYMENT_CONFIGURATION_NAME"',
    );
  }

  return {
    configurationName,
    wabaId: process.env.WHATSAPP_WABA_ID?.trim() || undefined,
    merchantId: process.env.RAZORPAY_MERCHANT_ID?.trim() || undefined,
    enabled: isWhatsAppPaymentsEnabled(),
    linkFallback: isPaymentLinkFallbackEnabled(),
  };
}

export function getWhatsAppPaymentConfigOptional() {
  return {
    configurationName:
      process.env.WHATSAPP_PAYMENT_CONFIGURATION_NAME?.trim() || undefined,
    wabaId: process.env.WHATSAPP_WABA_ID?.trim() || undefined,
    merchantId: process.env.RAZORPAY_MERCHANT_ID?.trim() || undefined,
    enabled: isWhatsAppPaymentsEnabled(),
    linkFallback: isPaymentLinkFallbackEnabled(),
  };
}
