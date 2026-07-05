import { createXai } from "@ai-sdk/xai";
import { generateText } from "ai";
import type { FunnelStage } from "@/lib/db/conversations";
import { getXaiConfig } from "@/lib/ai/config";
import type { ViolationKind, ViolationResult } from "./types";

export type ModerationDecision = "allow" | "strike";

export type AgentModerationResult = {
  decision: ModerationDecision;
  category: ViolationKind | "on_topic";
  reason: string;
};

const MODERATION_SYSTEM = `You are a moderation agent for "Pandit G" — a WhatsApp Vedic astrology consultation service by Pandit Devdutt Joshi (Lucknow).

Your job: classify the user's latest message IN CONTEXT. Understand Hindi, Hinglish, and Devanagari.

CRITICAL — NO keyword blocking:
- Judge by INTENT and full sentence meaning, NEVER single words or keywords.
- Words like मज़ाक, gaali-looking text, or slang may describe the user's LIFE (e.g. "लोग मेरा मज़ाक बनाते हैं" = on_topic).
- When unsure → decision "allow". Real clients write imperfect Hindi.

THREE-STRIKE SYSTEM (never instant block from your decision):
- "block" is NOT used — only "allow" or "strike".
- First bad behavior → strike (user gets warning, chat continues).
- Third strike blocks elsewhere — you only flag strike-worthy messages.

FIRST MESSAGE (no prior user messages):
- Random openers: hi, hello, ?, emoji, nonsense, off-topic → ALWAYS "allow".
- Do NOT strike first message for off_topic, prank, repetitive, or confused openers.
- Only strike first message for clear abuse AT pandit/service (not life-story words).

ON-TOPIC (decision "allow"):
- Greetings, namaste, birth details, palm photos
- Life problems: marriage, career, money, health, family, stress, enemies
- Payment / dakshina questions, remedies, follow-ups
- Emotional sharing about how others treat them
- Mild frustration with life — not abuse at pandit

STRIKE (warn — chat continues):
- Mild rudeness toward pandit
- Off-topic requests: coding, homework, cricket, politics (once or twice)
- Repetitive pointless messages, bot-testing
- Slightly abusive language toward pandit (not life description)

ALLOW when unsure — prefer giving users full chance to consult.

Respond with ONLY valid JSON, no markdown:
{"decision":"allow"|"strike","category":"on_topic"|"mild_abuse"|"severe_abuse"|"off_topic"|"spam"|"repetitive"|"prank","reason":"one short English sentence for admin log"}`;

function getModerationModel(): string {
  return process.env.MODERATION_MODEL ?? process.env.XAI_MODEL ?? "grok-4.3";
}

function parseAgentJson(raw: string): AgentModerationResult | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as {
      decision?: string;
      category?: string;
      reason?: string;
    };

    const decision = parsed.decision;
    if (decision !== "allow" && decision !== "strike" && decision !== "block") {
      return null;
    }

    const normalizedDecision: ModerationDecision =
      decision === "block" ? "strike" : decision;

    const validCategories = [
      "on_topic",
      "mild_abuse",
      "severe_abuse",
      "off_topic",
      "spam",
      "repetitive",
      "prank",
    ] as const;

    const category = validCategories.includes(
      parsed.category as (typeof validCategories)[number],
    )
      ? (parsed.category as AgentModerationResult["category"])
      : "on_topic";

    return {
      decision: normalizedDecision,
      category,
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  } catch {
    return null;
  }
}

function agentResultToViolation(
  result: AgentModerationResult,
): ViolationResult | null {
  if (result.decision === "allow" || result.category === "on_topic") {
    return null;
  }

  const kind = result.category as ViolationKind;

  return { kind, immediateBlock: false };
}

function applyFirstMessageLeniency(
  result: AgentModerationResult,
): AgentModerationResult {
  if (result.decision === "allow" || result.category === "on_topic") {
    return result;
  }

  if (
    result.category === "severe_abuse" ||
    result.category === "mild_abuse"
  ) {
    return result;
  }

  return {
    decision: "allow",
    category: "on_topic",
    reason: `first message allowed: ${result.reason}`,
  };
}

export async function classifyMessageWithAgent(input: {
  text: string;
  hasMedia?: boolean;
  funnelStage?: FunnelStage | null;
  recentUserTexts: string[];
  skipFlowViolationCheck?: boolean;
  isFirstUserMessage?: boolean;
}): Promise<{ violation: ViolationResult | null; agentReason?: string }> {
  const {
    text,
    hasMedia,
    funnelStage,
    recentUserTexts,
    skipFlowViolationCheck,
    isFirstUserMessage = false,
  } = input;

  if (!process.env.XAI_API_KEY) {
    console.warn("[moderation] XAI_API_KEY missing — skipping agent moderation");
    return { violation: null };
  }

  const trimmed = text.trim();
  if (!trimmed && hasMedia) {
    return { violation: null };
  }

  let apiKey: string;
  try {
    apiKey = getXaiConfig().apiKey;
  } catch {
    return { violation: null };
  }

  const recentBlock =
    recentUserTexts.length > 0
      ? `Recent user messages (oldest first):\n${recentUserTexts.map((m, i) => `${i + 1}. ${m}`).join("\n")}`
      : "No prior user messages.";

  const userPrompt = `Funnel stage: ${funnelStage ?? "unknown"}
User sent media (photo): ${hasMedia ? "yes" : "no"}
Birth/palm details message: ${skipFlowViolationCheck ? "yes — be lenient on flow violations" : "no"}
First user message in this chat: ${isFirstUserMessage ? "YES — allow random/off-topic openers; only block severe abuse" : "no"}

${recentBlock}

Latest message to classify:
"""
${trimmed || "(empty text)"}
"""`;

  try {
    const provider = createXai({ apiKey });
    const { text: raw } = await generateText({
      model: provider(getModerationModel()),
      system: MODERATION_SYSTEM,
      prompt: userPrompt,
      maxOutputTokens: 120,
      temperature: 0.1,
    });

    const parsed = parseAgentJson(raw);
    if (!parsed) {
      console.warn("[moderation] Could not parse agent JSON:", raw.slice(0, 200));
      return { violation: null };
    }

    const judged = isFirstUserMessage
      ? applyFirstMessageLeniency(parsed)
      : parsed;

    if (
      skipFlowViolationCheck &&
      judged.decision !== "allow" &&
      judged.category !== "severe_abuse" &&
      judged.category !== "mild_abuse" &&
      judged.category !== "spam"
    ) {
      return {
        violation: null,
        agentReason: `skipped (details): ${judged.reason}`,
      };
    }

    return {
      violation: agentResultToViolation(judged),
      agentReason: judged.reason,
    };
  } catch (error) {
    console.error("[moderation agent]", error);
    return { violation: null };
  }
}
