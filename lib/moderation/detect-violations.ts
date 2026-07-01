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
  isFirstUserMessage?: boolean;
}): Promise<{ violation: ViolationResult | null; agentReason?: string }> {
  const {
    text,
    recentUserTexts,
    recentInboundAt,
    hasMedia,
    funnelStage,
    skipFlowViolationCheck,
    isFirstUserMessage = false,
  } = input;

  /** Mechanical flood — skip on first message; impossible to flood in one msg anyway. */
  if (!isFirstUserMessage && isMessageFlood(recentInboundAt)) {
    return { violation: { kind: "spam", immediateBlock: true } };
  }

  return classifyMessageWithAgent({
    text,
    hasMedia,
    funnelStage,
    recentUserTexts: skipFlowViolationCheck ? [] : recentUserTexts,
    skipFlowViolationCheck,
    isFirstUserMessage,
  });
}

export function violationToBlockReason(kind: ViolationResult["kind"]): string {
  return kind;
}
