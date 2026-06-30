import { createXai } from "@ai-sdk/xai";
import { generateText } from "ai";
import { getConversationHistory } from "@/lib/db/conversations";
import type { ClientBirthProfile } from "@/lib/db/conversation-profile";
import { isDbConfigured } from "@/lib/db/is-configured";
import type { ConsultationIntent } from "./detect-consultation-intent";
import { getXaiConfig } from "./config";
import { normalizeReplyNumerals } from "./normalize-numerals";
import { buildClientNameHint, NO_PLANETS_BEFORE_PAYMENT, PANDIT_VOICE } from "./pandit-voice";

export type GenerateFreeFollowupInput = {
  phone: string;
  userMessage: string;
  intent: ConsultationIntent;
  birthProfile?: ClientBirthProfile | null;
  clientName?: string;
};

function buildFreeFollowupPrompt(
  intent: ConsultationIntent,
  birthProfile?: ClientBirthProfile | null,
  clientName?: string,
): string {
  let prompt = `${PANDIT_VOICE}

${buildClientNameHint(clientName)}

TASK — User already got free reading + payment offer. They have NOT paid yet.

${NO_PLANETS_BEFORE_PAYMENT}

STRICT — NEVER repeat birth confirmation lines like:
"आपकी जन्म कुंडली ... उपलब्ध है", "जन्म तिथि ... मिल गई", or re-state DOB/time/place.
Birth details were confirmed ONCE — do NOT mention them again.`;

  if (birthProfile?.rashi) {
    prompt += `\n\nKnown (internal only — do NOT repeat unless user asks राशि): राशि ${birthProfile.rashi}.`;
  }

  if (intent === "solution") {
    prompt += `

USER WANTS SOLUTION / उपाय:
- Give practical, caring guidance in plain Hindi — still NO graha names before payment.
- Suggest lifestyle/mindset steps only at high level.
- Gently remind that पूरा व्यक्तिगत उपाय और गहन मार्गदर्शन paid परामर्श में मिलेगा — one short line, not pushy.
- 3-5 lines.`;
  } else {
    prompt += `

USER IS ASKING ABOUT PROBLEMS / life areas:
- Answer ONLY about problems, feelings, struggles — expand on what they asked (career, money, life, family).
- Do NOT give remedies, उपाय, or solutions unless they explicitly asked.
- Do NOT repeat birth/kundali confirmation.
- Sympathetic खड़ी बोली, 3-5 lines.`;
  }

  return prompt;
}

export async function generateFreeFollowupReply(
  input: GenerateFreeFollowupInput,
): Promise<string> {
  const { apiKey, model } = getXaiConfig();
  const provider = createXai({ apiKey });

  const history = isDbConfigured()
    ? await getConversationHistory(input.phone)
    : [];

  const messages = [
    ...history.map((entry) => ({
      role: entry.role as "user" | "assistant",
      content: entry.content,
    })),
    { role: "user" as const, content: input.userMessage.trim() || "नमस्ते" },
  ];

  const { text } = await generateText({
    model: provider.responses(model),
    system: buildFreeFollowupPrompt(
      input.intent,
      input.birthProfile,
      input.clientName,
    ),
    messages,
    temperature: 0.85,
    maxRetries: 1,
  });

  const reply = text.trim();
  if (!reply) throw new Error("Empty free followup reply");

  return normalizeReplyNumerals(reply);
}
