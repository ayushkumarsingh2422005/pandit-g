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
import { detectPaidConsultationPhase } from "./paid-consultation-phase";
import { buildPaidSessionContextBlock, BANNED_ROBOTIC_PHRASES } from "./consultation-context";
import {
  buildPhaseRetryInstruction,
  replyViolatesPhase,
} from "./phase-reply-validator";

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

function containsBannedRoboticPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_ROBOTIC_PHRASES.some((phrase) =>
    lower.includes(phrase.toLowerCase()),
  );
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

  const isPaidSession = funnelStage === "active";
  const recentAssistantTexts = history
    .filter((e) => e.role === "assistant")
    .map((e) => e.content)
    .slice(-5);
  const paidConsultationPhase = isPaidSession
    ? detectPaidConsultationPhase(history, userMessage)
    : undefined;
  const paidSessionContext = isPaidSession
    ? buildPaidSessionContextBlock(history, userMessage)
    : undefined;

  const systemPrompt = buildPanditGSystemPrompt({
    contactName,
    isContinuingConversation,
    hasImage,
    isPaidSession,
    paidConsultationPhase,
    paidSessionContext,
    sessionMinutesRemaining,
    recentAssistantTexts,
  });

  const languageModel = hasImage
    ? provider.chat(visionModel)
    : provider.responses(model);

  let { text } = await generateText({
    model: languageModel,
    system: systemPrompt,
    messages,
    temperature: isPaidSession ? 0.93 : 0.88,
    maxRetries: 1,
  });

  let reply = text.trim();

  if (isPaidSession && reply && paidConsultationPhase) {
    const phaseViolation = replyViolatesPhase(paidConsultationPhase, reply);
    if (phaseViolation) {
      const { text: retryText } = await generateText({
        model: languageModel,
        system: `${systemPrompt}\n\n${buildPhaseRetryInstruction(phaseViolation)}`,
        messages,
        temperature: 0.95,
        maxRetries: 1,
      });
      const retryReply = retryText.trim();
      if (
        retryReply &&
        !replyViolatesPhase(paidConsultationPhase, retryReply)
      ) {
        reply = retryReply;
      }
    }
  }

  if (
    isPaidSession &&
    reply &&
    containsBannedRoboticPhrase(reply)
  ) {
    const { text: retryText } = await generateText({
      model: languageModel,
      system: `${systemPrompt}\n\nREWRITE — your last draft used banned robotic phrases. Reply naturally in 3-4 lines WITHOUT asking for "दो लाइन", birth details again, or "कुंडली देखकर बताऊँगा".`,
      messages,
      temperature: 0.97,
      maxRetries: 1,
    });
    const retryReply = retryText.trim();
    if (retryReply && !containsBannedRoboticPhrase(retryReply)) {
      reply = retryReply;
    }
  }

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
