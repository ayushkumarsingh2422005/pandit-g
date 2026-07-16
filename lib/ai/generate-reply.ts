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
import {
  redactPaymentUrlsInHistory,
  stripPaymentUrls,
} from "@/lib/payments/payment-link-text";

export type GeneratePanditGReplyInput = {
  phone: string;
  userMessage: string;
  contactName?: string;
  funnelStage?: FunnelStage;
  sessionMinutesRemaining?: number;
};

function buildUserModelMessage(userMessage: string): UserModelMessage {
  return { role: "user", content: userMessage.trim() || "नमस्ते" };
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
  funnelStage,
  sessionMinutesRemaining,
}: GeneratePanditGReplyInput): Promise<string> {
  const { apiKey, model } = getXaiConfig();
  const provider = createXai({ apiKey });

  const history = isDbConfigured()
    ? await getConversationHistory(phone)
    : [];

  const isContinuingConversation = history.length > 0;
  const safeHistory = redactPaymentUrlsInHistory(history);

  const messages: ModelMessage[] = [
    ...safeHistory.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    buildUserModelMessage(userMessage),
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
    isPaidSession,
    paidConsultationPhase,
    paidSessionContext,
    sessionMinutesRemaining,
    recentAssistantTexts,
  });

  const languageModel = provider.responses(model);

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

  // Paid session must never paste Razorpay links (model often copies from history)
  reply = stripPaymentUrls(reply);

  if (isDbConfigured()) {
    const nextStage: FunnelStage =
      funnelStage === "reading_delivered" ? "active" : funnelStage ?? "active";

    await saveConversationTurn(
      phone,
      userMessage.trim() || "[संदेश]",
      reply,
      contactName,
      nextStage,
    );
  }

  return normalizeReplyNumerals(reply);
}
