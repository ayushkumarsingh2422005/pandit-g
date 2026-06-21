function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getWhatsAppConfig() {
  return {
    verifyToken: requireEnv("WHATSAPP_VERIFY_TOKEN"),
    accessToken: requireEnv("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: requireEnv("WHATSAPP_PHONE_NUMBER_ID"),
    apiVersion: process.env.WHATSAPP_API_VERSION ?? "v21.0",
  };
}

export function getWhatsAppConfigOptional() {
  return {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: process.env.WHATSAPP_API_VERSION ?? "v21.0",
  };
}
