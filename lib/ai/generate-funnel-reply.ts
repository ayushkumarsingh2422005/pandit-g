import { createXai } from "@ai-sdk/xai";
import type { ModelMessage, UserModelMessage } from "ai";
import { generateText } from "ai";
import { getConversationHistory } from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import { getXaiConfig } from "./config";
import { normalizeReplyNumerals } from "./normalize-numerals";
import {
  NO_PLANETS_BEFORE_PAYMENT,
  PANDIT_CITY,
  PANDIT_NAME,
  PANDIT_VOICE,
} from "./pandit-voice";
import {
  buildBirthProfileFromHistory,
  type BirthProfile,
} from "@/lib/funnel/birth-profile";

export type FunnelReplyStage = "welcome" | "ask_details" | "reading";

function nameUsageHint(contactName?: string): string {
  if (!contactName) return "";
  return `\nWhatsApp display name (do NOT open every reply with it): ${contactName}. Almost never use "${contactName} जी" — especially not as the first words.`;
}

function buildWelcomePrompt(contactName?: string): string {
  return `${PANDIT_VOICE}

TASK — चरण 1: पहला जवाब (परिचय + जन्म विवरण मांगना):
- Introduce yourself: मैं ${PANDIT_NAME} हूँ, ${PANDIT_CITY} से — word freshly each time.
- Say you help people clear life's complications / उलझनें.
- Ask ONLY for: जन्म तिथि (दिन, महीना, साल), जन्म समय, और जन्म स्थान.
- Do NOT ask for palm photo / हथेली / हस्तरेखा. We do not use photos.
- Warm, short: 3-5 lines. Do NOT answer astrology questions yet — only intro + collection.
${nameUsageHint(contactName)}`;
}

function buildAskDetailsPrompt(
  contactName?: string,
  missingFields?: string[],
): string {
  const missingLine =
    missingFields && missingFields.length > 0
      ? `Chat history shows these are STILL missing: ${missingFields.join(", ")}. Ask ONLY for these — do NOT re-confirm details already given in earlier messages.`
      : `User has NOT sent complete birth details yet (date, time, and place).`;

  return `${PANDIT_VOICE}

TASK — User wrote something but birth data is incomplete:
- Briefly acknowledge their latest message (1 line max).
- ${missingLine}
- If they sent a photo / हथेली: politely say we do not do हस्तरेखा — please type जन्म तिथि, समय, स्थान.
- If birth time/place/date still missing: say without those you cannot assess yet — ask ONLY for what's missing.
- Do NOT repeat or re-list birth date/time/place already shared in chat history.
- Do NOT guess their problems or give remedies — no graha, no reading yet.
- FORBIDDEN: "अपनी समस्या बताएं" / "क्या समस्या है" / "बताएं किस मुद्दे पर" — after details arrive YOU will tell THEM their problems (personalized reading comes next automatically).
- NEVER say "जन्म विवरण मिल गया, अब बताएं किस मुद्दे पर" — that is wrong.
- 2-4 lines, warm and human — not a template repeated every message.
${nameUsageHint(contactName)}`;
}

function buildReadingPrompt(
  contactName?: string,
  birthProfile?: BirthProfile,
): string {
  const ageLine = birthProfile?.ageYears
    ? `Client age (from DOB in chat): about ${birthProfile.ageYears} years — life stage: ${birthProfile.lifeStageLabel}.`
    : `Client age: estimate from birth date in chat history if possible.`;

  const hintLine = birthProfile?.readingHint
    ? `Age-based issues to weave in naturally:\n${birthProfile.readingHint}`
    : "";

  return `${PANDIT_VOICE}

TASK — चरण 4: मुफ़्त विश्वास वाला पढ़ाव (Trust reading). सारा जन्म डाटा (तिथि, समय, स्थान) मिल चुका है।

${ageLine}
${hintLine}

Write ONE message where YOU tell THEM their life problems — do NOT ask them anything.

REQUIRED:
- Proactively describe 3-4 genuine, relatable struggles — as if you sensed their situation from age and birth details (NOT palm/hastrekha).
- Use their age/life stage (young → career/education pressure; 25-35 → job/marriage/money; 40+ → family/health/responsibility).
- If they mentioned something earlier (नौकरी, शादी), weave it in — but still TELL problems, don't ask.
- Write so they feel: "हाँ, यही मेरी बात है" — conviction and trust.
- End with quiet empathy — something feels blocked in life — WITHOUT astrological jargon.

FORBIDDEN — never write:
- "किस मुद्दे पर मार्गदर्शन चाहिए" / "किस क्षेत्र में" / "स्वास्थ्य, शिक्षा या परिवार में से चुनें"
- "बताएं क्या समस्या है" / asking them to specify the problem
- Repeating full birth date, time, place in one line
- Payment, परामर्श, price, or stalling ("देख रहा हूँ")
- Any palm / हस्तरेखा claim

STYLE: खड़ी बोली, 4-6 lines, flowing — like a pandit speaking from the heart.

${NO_PLANETS_BEFORE_PAYMENT}
${nameUsageHint(contactName)}`;
}

function buildUserMessage(
  userMessage: string,
  stage?: FunnelReplyStage,
): UserModelMessage {
  const trimmed = userMessage.trim();

  if (stage === "reading") {
    const text =
      trimmed ||
      "जन्म विवरण पूरा हो गया है। बिना कुछ पूछे, उनकी उम्र और हालात के हिसाब से जीवन की असली समस्याएँ बताइए — सवाल मत पूछिए।";
    return { role: "user", content: text };
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
  birthProfile?: BirthProfile,
): string {
  switch (stage) {
    case "welcome":
      return buildWelcomePrompt(contactName);
    case "ask_details":
      return buildAskDetailsPrompt(contactName, missingFields);
    case "reading":
      return buildReadingPrompt(contactName, birthProfile);
  }
}

export type GenerateFunnelReplyInput = {
  stage: FunnelReplyStage;
  phone: string;
  userMessage: string;
  contactName?: string;
  missingBirthFields?: string[];
};

export async function generateFunnelReply({
  stage,
  phone,
  userMessage,
  contactName,
  missingBirthFields,
}: GenerateFunnelReplyInput): Promise<string> {
  const { apiKey, model } = getXaiConfig();
  const provider = createXai({ apiKey });

  const history = isDbConfigured()
    ? await getConversationHistory(phone)
    : [];

  const birthProfile =
    stage === "reading"
      ? buildBirthProfileFromHistory(history)
      : undefined;

  const messages: ModelMessage[] = [
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    buildUserMessage(userMessage, stage),
  ];

  const { text } = await generateText({
    model: provider.responses(model),
    system: systemForStage(stage, contactName, missingBirthFields, birthProfile),
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
      ? `User sent a photo. As ${PANDIT_NAME}, politely say in Hindi Devanagari that you do not read palms/photos — please send जन्म तिथि, जन्म समय, and जन्म स्थान in text. 2-3 lines. Do not open with their WhatsApp name.`
      : `As ${PANDIT_NAME}, apologize briefly in Hindi Devanagari that you could not reply right now and ask them to message again shortly. 2 lines. Do not open with a name.`;

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
