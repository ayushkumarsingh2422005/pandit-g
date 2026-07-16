import {
  hasBirthDetailsInText,
  hasCompleteBirthDetailsInHistory,
} from "./detect-birth-details";
import {
  getConversationHistory,
  getConversationFunnelStage,
  type FunnelStage,
} from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";

export type { FunnelStage };

function userSharedDetails(content: string): boolean {
  return hasBirthDetailsInText(content);
}

function inferStageFromHistory(
  messages: { role: string; content: string }[],
): FunnelStage {
  if (messages.length === 0) return "initial";

  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  if (assistantCount === 0) return "initial";

  const detailsComplete = hasCompleteBirthDetailsInHistory(messages);
  if (!detailsComplete) return "awaiting_details";

  let detailsMessageIndex = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "user" && userSharedDetails(messages[i].content)) {
      detailsMessageIndex = i;
      break;
    }
  }

  if (detailsMessageIndex < 0) {
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "user") {
        detailsMessageIndex = i;
        break;
      }
    }
  }

  if (detailsMessageIndex >= 0) {
    const assistantAfterDetails = messages
      .slice(detailsMessageIndex + 1)
      .some((m) => m.role === "assistant");
    if (assistantAfterDetails) return "active";
  }

  return "awaiting_details";
}

export async function resolveFunnelStage(phone: string): Promise<FunnelStage> {
  if (isDbConfigured()) {
    const stage = await getConversationFunnelStage(phone);
    if (stage) return stage;

    const history = await getConversationHistory(phone);
    return inferStageFromHistory(history);
  }

  return "initial";
}
