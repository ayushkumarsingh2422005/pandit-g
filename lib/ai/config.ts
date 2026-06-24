function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getXaiConfig() {
  const model = process.env.XAI_MODEL ?? "grok-4.3";

  return {
    apiKey: requireEnv("XAI_API_KEY"),
    model,
    /** Chat API — used when the user sends an image (vision input). */
    visionModel: process.env.XAI_VISION_MODEL ?? model,
  };
}
