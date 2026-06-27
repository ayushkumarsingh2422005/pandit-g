import {
  blockConversation,
  getAbuseStrikeThreshold,
  incrementAbuseStrike,
  isConversationBlocked,
} from "@/lib/db/conversation-moderation";
import { sendTextMessage } from "@/lib/whatsapp/client";
import { BLOCKED_CONVERSATION_MESSAGE } from "./block-message";
import { detectAbuseSeverity } from "./detect-abuse";

export async function sendBlockedMessage(to: string): Promise<void> {
  await sendTextMessage({ to, body: BLOCKED_CONVERSATION_MESSAGE });
}

/**
 * Returns true if the message was handled (blocked user — no AI reply needed).
 */
export async function handleConversationModeration(input: {
  phone: string;
  text: string;
  skipStrikeCheck?: boolean;
}): Promise<boolean> {
  const { phone, text, skipStrikeCheck = false } = input;

  if (await isConversationBlocked(phone)) {
    await sendBlockedMessage(phone);
    return true;
  }

  if (skipStrikeCheck) return false;

  const severity = detectAbuseSeverity(text);

  if (severity === "severe") {
    await blockConversation(phone, "severe_abuse");
    await sendBlockedMessage(phone);
    return true;
  }

  if (severity === "mild") {
    const strikes = await incrementAbuseStrike(phone);
    if (strikes >= getAbuseStrikeThreshold()) {
      await blockConversation(phone, "repeated_abuse");
      await sendBlockedMessage(phone);
      return true;
    }
  }

  return false;
}
