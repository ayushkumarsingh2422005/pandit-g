import { classifyMessageWithAgent } from "./classify-with-agent";
import { isMessageFlood } from "./detect-spam";
import type { ViolationResult } from "./types";
import type { FunnelStage } from "@/lib/db/conversations";

export async function detectViolationsAsync(input: {
  text: string;
  recentUserTexts: string[];
  recentInboundAt: Date[];
  hasMedia?: boolean;
  funnelStage?: FunnelStage | null;
  skipFlowViolationCheck?: boolean;
}): Promise<{ violation: ViolationResult | null; agentReason?: string }> {
  const { text, recentUserTexts, recentInboundAt, hasMedia, funnelStage, skipFlowViolationCheck } =
    input;

  /** Mechanical flood — not semantic; keep without LLM. */
  if (isMessageFlood(recentInboundAt)) {
    return { violation: { kind: "spam", immediateBlock: true } };
  }

  return classifyMessageWithAgent({
    text,
    hasMedia,
    funnelStage,
    recentUserTexts: skipFlowViolationCheck ? [] : recentUserTexts,
    skipFlowViolationCheck,
  });
}

export function violationToBlockReason(kind: ViolationResult["kind"]): string {
  return kind;
}
