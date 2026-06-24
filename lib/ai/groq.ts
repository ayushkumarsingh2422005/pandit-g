import { getGroqConfig } from "./config";
import { PANDIT_G_SYSTEM_PROMPT } from "./prompts";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqChatResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

export async function generatePanditGReply(
  userMessage: string,
  contactName?: string,
): Promise<string> {
  const { apiKey, model } = getGroqConfig();

  const userContext = contactName
    ? `Client name: ${contactName}\n\nMessage: ${userMessage}`
    : userMessage;

  const messages: ChatMessage[] = [
    { role: "system", content: PANDIT_G_SYSTEM_PROMPT },
    { role: "user", content: userContext },
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  const data = (await response.json()) as GroqChatResponse;

  if (!response.ok) {
    throw new Error(
      `Groq API failed (${response.status}): ${data.error?.message ?? JSON.stringify(data)}`,
    );
  }

  const reply = data.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error("Groq API returned an empty response");
  }

  return reply;
}
