import {
  blockConversation,
  getAbuseStrikeThreshold,
  getRecentUserMessageTexts,
  incrementAbuseStrike,
  isConversationBlocked,
  recordInboundMessage,
} from "@/lib/db/conversation-moderation";
import type { FunnelStage } from "@/lib/db/conversations";
import { sendTextMessage } from "@/lib/whatsapp/client";
import { BLOCKED_CONVERSATION_MESSAGE } from "./block-message";
import {
  detectViolationsAsync,
  violationToBlockReason,
} from "./detect-violations";
import { getModerationWarningForStrike } from "./warning-messages";

export async function sendBlockedMessage(to: string): Promise<void> {
  await sendTextMessage({ to, body: BLOCKED_CONVERSATION_MESSAGE });
}

/**
 * Returns true if the message was handled (blocked user — no AI reply needed).
 * Strikes 1–2 send a warning and the conversation continues.
 */
export async function handleConversationModeration(input: {
  phone: string;
  text: string;
  hasMedia?: boolean;
  funnelStage?: FunnelStage | null;
  /** Skip off-topic/repetitive checks when user sends birth details. */
  skipFlowViolationCheck?: boolean;
}): Promise<boolean> {
  const {
    phone,
    text,
    hasMedia = false,
    funnelStage,
    skipFlowViolationCheck = false,
  } = input;

  if (await isConversationBlocked(phone)) {
    await sendBlockedMessage(phone);
    return true;
  }

  const recentInboundAt = await recordInboundMessage(phone);
  const recentUserTexts = await getRecentUserMessageTexts(phone);
  const isFirstUserMessage = recentUserTexts.length === 0;

  const { violation, agentReason } = await detectViolationsAsync({
    text,
    recentUserTexts,
    recentInboundAt,
    hasMedia,
    funnelStage,
    skipFlowViolationCheck,
    isFirstUserMessage,
  });

  if (!violation) return false;

  if (agentReason) {
    console.info(`[moderation] ${phone}: ${violation.kind} — ${agentReason}`);
  }

  const strikes = await incrementAbuseStrike(phone);
  const threshold = getAbuseStrikeThreshold();

  if (strikes >= threshold) {
    await blockConversation(phone, violationToBlockReason(violation.kind));
    await sendBlockedMessage(phone);
    return true;
  }

  const warning = getModerationWarningForStrike(strikes);
  if (warning) {
    await sendTextMessage({ to: phone, body: warning });
  }

  return false;
}
