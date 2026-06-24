function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getGroqConfig() {
  return {
    apiKey: requireEnv("GROQ_API_KEY"),
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  };
}
