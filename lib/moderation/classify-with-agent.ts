import { createXai } from "@ai-sdk/xai";
import { generateText } from "ai";
import type { FunnelStage } from "@/lib/db/conversations";
import { getXaiConfig } from "@/lib/ai/config";
import type { ViolationKind, ViolationResult } from "./types";

export type ModerationDecision = "allow" | "strike" | "block";

export type AgentModerationResult = {
  decision: ModerationDecision;
  category: ViolationKind | "on_topic";
  reason: string;
};

const MODERATION_SYSTEM = `You are a moderation agent for "Pandit G" — a WhatsApp Vedic astrology consultation service by Pandit Devdutt Joshi (Lucknow).

Your job: classify the user's latest message IN CONTEXT. Understand Hindi, Hinglish, and Devanagari. Words that look like jokes or insults may be legitimate life problems — judge by intent and sentence meaning, NOT keyword matching.

FIRST MESSAGE (no prior user messages in chat):
- People open with ANYTHING random: "hi", "hello", "?", emoji, nonsense, off-topic — ALWAYS decision "allow".
- Do NOT strike or block first message for off_topic, prank, repetitive, spam, or confused openers.
- ONLY block first message for direct severe abuse, slurs, sexual harassment, or clear hate AT pandit/service.

- Greetings, namaste, starting consultation
- Birth details: date, time, place
- Palm / hastrekha photos or questions
- Life problems: marriage delay, career, money, health, family tension, mental stress, enemies, obstacles
- Payment / dakshina questions
- Follow-up after reading, asking remedies/upay
- Emotional sharing using words like मज़ाक/majaak, ताना, insult FROM OTHERS toward the client — e.g. "लोग मेरा मज़ाक बनाते हैं" is ON-TOPIC (they describe being mocked, not trolling the pandit)
- Mild frustration with life or situation — not abuse at pandit

STRIKE (warn count toward block — not instant):
- Mild rudeness toward pandit without severe slurs
- Slightly off-topic but could be a confused user (redirectable)
- Repeating the same pointless message without substance
- Testing if bot is real — once or twice

BLOCK (instant — decision "block"):
- Direct severe abuse / slurs AT pandit or service
- Sexual harassment or explicit content
- Clear trolling/spam with zero consultation intent (random keyboard, meme flood, "asdfasdf")
- Demanding unrelated services: coding, homework, cricket scores, politics debate, translation jobs
- Persistent harassment after warnings implied by pattern

ALLOW when unsure — real clients often write imperfect Hindi.

Respond with ONLY valid JSON, no markdown:
{"decision":"allow"|"strike"|"block","category":"on_topic"|"mild_abuse"|"severe_abuse"|"off_topic"|"spam"|"repetitive"|"prank","reason":"one short English sentence for admin log"}`;

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
      decision,
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

  if (result.decision === "block") {
    return { kind, immediateBlock: true };
  }

  if (result.decision === "strike") {
    return { kind, immediateBlock: false };
  }

  return null;
}

function applyFirstMessageLeniency(
  result: AgentModerationResult,
): AgentModerationResult {
  if (result.category === "severe_abuse") {
    return result;
  }

  if (result.category === "mild_abuse" && result.decision !== "allow") {
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
