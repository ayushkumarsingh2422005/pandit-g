import { createXai } from "@ai-sdk/xai";
import type { ModelMessage, UserModelMessage } from "ai";
import { generateText } from "ai";
import { getConversationHistory } from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import type { UserImageInput } from "./generate-reply";
import { getXaiConfig } from "./config";
import { normalizeReplyNumerals } from "./normalize-numerals";
import {
  NO_PLANETS_BEFORE_PAYMENT,
  PANDIT_CITY,
  PANDIT_NAME,
  PANDIT_VOICE,
} from "./pandit-voice";

export type FunnelReplyStage = "welcome" | "ask_details" | "reading";

function buildWelcomePrompt(contactName?: string): string {
  let prompt = `${PANDIT_VOICE}

TASK — चरण 1: पहला जवाब (परिचय + विवरण मांगना):
- Introduce yourself: मैं ${PANDIT_NAME} हूँ, ${PANDIT_CITY} से — word freshly each time.
- Do NOT open with only "कल्याण हो" — intro first, then purpose.
- Say you help people clear life's complications / उलझनें.
- Ask them to send EITHER:
  • जन्म तिथि (दिन, महीना, साल), जन्म समय और जन्म स्थान, OR
  • हथेली की साफ तस्वीर (हस्तरेखा).
- Warm, short: 3-5 lines. Do NOT answer astrology questions yet — only intro + collection.`;

  if (contactName) {
    prompt += `\nClient name: ${contactName} — you may use "${contactName} जी" once if natural.`;
  }

  return prompt;
}

function buildAskDetailsPrompt(
  contactName?: string,
  missingFields?: string[],
): string {
  const missingLine =
    missingFields && missingFields.length > 0
      ? `Chat history shows these are STILL missing: ${missingFields.join(", ")}. Ask ONLY for these — do NOT re-confirm details already given in earlier messages.`
      : `User has NOT sent complete birth details or palm photo yet.`;

  let prompt = `${PANDIT_VOICE}

TASK — User wrote something but birth data is incomplete:
- Briefly acknowledge their latest message (1 line max).
- ${missingLine}
- Do NOT repeat or re-list birth date/time/place already shared in chat history.
- Do NOT guess their problems or give remedies.
- 2-4 lines, warm and human — not a template repeated every message.`;

  if (contactName) {
    prompt += `\nClient name: ${contactName}.`;
  }

  return prompt;
}

function buildReadingPrompt(contactName?: string): string {
  let prompt = `${PANDIT_VOICE}

TASK — चरण 2: Trust phase. User just shared palm photo OR birth details.

Write ONE message that:
1. Do NOT repeat birth date/time/place — user already shared; you have it in chat history.
2. Describe their current life problems in plain sympathetic Hindi — as if you truly see their pain.
   Use what they mentioned (नौकरी, शादी, पैसा, etc.) from the conversation.
   Pick 3-4 areas naturally: mental unrest, hard work not paying off, money not staying,
   family tension, marriage delay stress, obstacles in every task, inner worry.
3. End with empathy — e.g. feels like something is blocking every step — WITHOUT naming astrological causes.

STYLE: खड़ी बोली — simple, human.

${NO_PLANETS_BEFORE_PAYMENT}

CRITICAL — NEVER in this message:
- Payment, price, consultation offer, or "परामर्श लें" — payment comes in the NEXT separate message.
- "थोड़ा वक्त", "देख रहा हूँ", stalling, or asking for birth details again.
- 4-6 lines, flowing text.`;

  if (contactName) {
    prompt += `\nClient name: ${contactName}.`;
  }

  return prompt;
}

function buildUserMessage(
  userMessage: string,
  image?: UserImageInput,
  stage?: FunnelReplyStage,
): UserModelMessage {
  const trimmed = userMessage.trim();

  if (stage === "reading" && image) {
    const text =
      trimmed ||
      "उपयोगकर्ता ने हथेली की फोटो भेजी है — देखकर विश्लेषण कीजिए।";
    return {
      role: "user",
      content: [
        { type: "text", text },
        {
          type: "file",
          data: image.data,
          mediaType: image.mimeType || "image/jpeg",
        },
      ],
    };
  }

  if (stage === "reading") {
    return {
      role: "user",
      content:
        trimmed ||
        "उपयोगकर्ता ने जन्म तिथि, समय और स्थान की जानकारी साझा की है।",
    };
  }

  return {
    role: "user",
    content: trimmed || "नमस्ते",
  };
}

function systemForStage(
  stage: FunnelReplyStage,
  contactName?: string,
  missingFields?: string[],
): string {
  switch (stage) {
    case "welcome":
      return buildWelcomePrompt(contactName);
    case "ask_details":
      return buildAskDetailsPrompt(contactName, missingFields);
    case "reading":
      return buildReadingPrompt(contactName);
  }
}

export type GenerateFunnelReplyInput = {
  stage: FunnelReplyStage;
  phone: string;
  userMessage: string;
  contactName?: string;
  image?: UserImageInput;
  missingBirthFields?: string[];
};

export async function generateFunnelReply({
  stage,
  phone,
  userMessage,
  contactName,
  image,
  missingBirthFields,
}: GenerateFunnelReplyInput): Promise<string> {
  const { apiKey, model, visionModel } = getXaiConfig();
  const provider = createXai({ apiKey });

  const history = isDbConfigured()
    ? await getConversationHistory(phone)
    : [];

  const messages: ModelMessage[] = [
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    buildUserMessage(userMessage, image, stage),
  ];

  const useVision = stage === "reading" && Boolean(image);
  const languageModel = useVision
    ? provider.chat(visionModel)
    : provider.responses(model);

  const { text } = await generateText({
    model: languageModel,
    system: systemForStage(stage, contactName, missingBirthFields),
    messages,
    temperature: 0.88,
    maxRetries: 1,
  });

  const reply = text.trim();
  if (!reply) {
    throw new Error(`Empty funnel reply for stage: ${stage}`);
  }

  return normalizeReplyNumerals(reply);
}

export async function generateErrorReply(
  reason: "general" | "image_download",
): Promise<string> {
  const { apiKey, model } = getXaiConfig();
  const provider = createXai({ apiKey });

  const prompt =
    reason === "image_download"
      ? `User's photo could not be loaded. As ${PANDIT_NAME}, apologize briefly in Hindi Devanagari and ask them to resend a clear palm photo in good light. 2-3 lines.`
      : `As ${PANDIT_NAME}, apologize briefly in Hindi Devanagari that you could not reply right now and ask them to message again shortly. 2 lines.`;

  const { text } = await generateText({
    model: provider.responses(model),
    system: PANDIT_VOICE,
    prompt,
    temperature: 0.85,
    maxRetries: 1,
  });

  return normalizeReplyNumerals(
    text.trim() || "🙏 कृपया थोड़ी देर बाद फिर लिखिए।",
  );
}
