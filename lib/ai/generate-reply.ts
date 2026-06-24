import { createXai } from "@ai-sdk/xai";
import type { ModelMessage } from "ai";
import { generateText } from "ai";
import {
  getConversationHistory,
  saveConversationTurn,
} from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import { getXaiConfig } from "./config";
import { buildPanditGSystemPrompt } from "./prompts";

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

  const isContinuingConversation = history.length > 0;

  const messages: ModelMessage[] = [
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    { role: "user", content: userMessage },
  ];

  const { text } = await generateText({
    model: provider.responses(model),
    system: buildPanditGSystemPrompt({
      contactName,
      isContinuingConversation,
    }),
    messages,
    temperature: 0.88,
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
