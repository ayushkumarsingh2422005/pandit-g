import { createXai } from "@ai-sdk/xai";
import type { ModelMessage, UserModelMessage } from "ai";
import { generateText } from "ai";
import {
  getConversationHistory,
  saveConversationTurn,
  type FunnelStage,
} from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import { getXaiConfig } from "./config";
import { normalizeReplyNumerals } from "./normalize-numerals";
import { buildPanditGSystemPrompt } from "./prompts";

export type UserImageInput = {
  data: Uint8Array;
  mimeType: string;
};

export type GeneratePanditGReplyInput = {
  phone: string;
  userMessage: string;
  contactName?: string;
  image?: UserImageInput;
  funnelStage?: FunnelStage;
  sessionMinutesRemaining?: number;
};

function buildUserModelMessage(
  userMessage: string,
  image?: UserImageInput,
): UserModelMessage {
  const trimmed = userMessage.trim();
  const textForModel = image
    ? trimmed || "उपयोगकर्ता ने यह फोटो भेजी है — पंडित जी की नज़र से देखकर बताइए।"
    : trimmed;

  if (!image) {
    return { role: "user", content: textForModel };
  }

  return {
    role: "user",
    content: [
      { type: "text", text: textForModel },
      {
        type: "file",
        data: image.data,
        mediaType: image.mimeType || "image/jpeg",
      },
    ],
  };
}

function buildStoredUserMessage(userMessage: string, hasImage: boolean): string {
  const trimmed = userMessage.trim();

  if (hasImage) {
    return trimmed ? `[फोटो] ${trimmed}` : "[फोटो भेजी]";
  }

  return trimmed;
}

export async function generatePanditGReply({
  phone,
  userMessage,
  contactName,
  image,
  funnelStage,
  sessionMinutesRemaining,
}: GeneratePanditGReplyInput): Promise<string> {
  const { apiKey, model, visionModel } = getXaiConfig();
  const provider = createXai({ apiKey });
  const hasImage = Boolean(image);

  const history = isDbConfigured()
    ? await getConversationHistory(phone)
    : [];

  const isContinuingConversation = history.length > 0;

  const messages: ModelMessage[] = [
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    buildUserModelMessage(userMessage, image),
  ];

  const languageModel = hasImage
    ? provider.chat(visionModel)
    : provider.responses(model);

  const { text } = await generateText({
    model: languageModel,
    system: buildPanditGSystemPrompt({
      contactName,
      isContinuingConversation,
      hasImage,
      isPaidSession: funnelStage === "active",
      sessionMinutesRemaining,
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
    const nextStage: FunnelStage =
      funnelStage === "reading_delivered" ? "active" : funnelStage ?? "active";

    await saveConversationTurn(
      phone,
      buildStoredUserMessage(userMessage, hasImage),
      reply,
      contactName,
      nextStage,
    );
  }

  return normalizeReplyNumerals(reply);
}
