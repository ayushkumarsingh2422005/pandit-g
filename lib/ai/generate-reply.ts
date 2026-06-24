import { createXai } from "@ai-sdk/xai";
import { generateText } from "ai";
import { getXaiConfig } from "./config";
import { PANDIT_G_SYSTEM_PROMPT } from "./prompts";

export async function generatePanditGReply(
  userMessage: string,
  contactName?: string,
): Promise<string> {
  const { apiKey, model } = getXaiConfig();
  const provider = createXai({ apiKey });

  const userContext = contactName
    ? `Client name: ${contactName}\n\nMessage: ${userMessage}`
    : userMessage;

  const { text } = await generateText({
    model: provider.responses(model),
    system: PANDIT_G_SYSTEM_PROMPT,
    prompt: userContext,
    temperature: 0.7,
    maxRetries: 1,
  });

  const reply = text.trim();

  if (!reply) {
    throw new Error("xAI API returned an empty response");
  }

  return reply;
}
