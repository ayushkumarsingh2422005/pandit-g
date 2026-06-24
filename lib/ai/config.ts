function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getXaiConfig() {
  return {
    apiKey: requireEnv("XAI_API_KEY"),
    model: process.env.XAI_MODEL ?? "grok-4.3",
  };
}
