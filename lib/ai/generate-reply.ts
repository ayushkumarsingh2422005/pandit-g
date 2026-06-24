import { createXai } from "@ai-sdk/xai";
import type { ModelMessage } from "ai";
import { generateText } from "ai";
import {
  getConversationHistory,
  saveConversationTurn,
} from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import { getXaiConfig } from "./config";
import { PANDIT_G_SYSTEM_PROMPT } from "./prompts";

export async function generatePanditGReply(
  phone: string,
  userMessage: string,
  contactName?: string,
): Promise<string> {
  const { apiKey, model } = getXaiConfig();
  const provider = createXai({ apiKey });

  const history = isDbConfigured()
    ? await getConversationHistory(phone)
    : [];

  const userContext = contactName
    ? `Client name: ${contactName}\n\nMessage: ${userMessage}`
    : userMessage;

  const messages: ModelMessage[] = [
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    { role: "user", content: userContext },
  ];

  const { text } = await generateText({
    model: provider.responses(model),
    system: PANDIT_G_SYSTEM_PROMPT,
    messages,
    temperature: 0.7,
    maxRetries: 1,
  });

  const reply = text.trim();

  if (!reply) {
    throw new Error("xAI API returned an empty response");
  }

  if (isDbConfigured()) {
    await saveConversationTurn(phone, userMessage, reply, contactName);
  }

  return reply;
}
