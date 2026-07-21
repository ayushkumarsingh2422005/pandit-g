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

const INVALID_FREE_READING =
  /[?？]|क्या जानना|क्या जानना चाहते|आगे क्या|बताइए|बताएं|किस बारे|किस विषय|किस मुद्दे|कुंडली तैयार|देख रहा|देखकर बताऊ|ग्रह|नक्षत्र|दशा|भाव|शनि|राहु|केतु|गुरु|शुक्र|मंगल|बुध|चंद्र|सूर्य|उपाय|मंत्र|दान|पूजा|भुगतान|दक्षिणा|परामर्श|rzp\.io/i;

function freeReadingFallback(profile?: BirthProfile): string {
  const age = profile?.ageYears;

  if (typeof age === "number" && age <= 22) {
    return "इस समय पढ़ाई और आगे की दिशा को लेकर मन बार-बार बदलता है। मेहनत करने के बाद भी ध्यान टिकता नहीं और घर की अपेक्षाएँ दबाव बढ़ाती हैं। भीतर से आप अपनी बात कम कहते हैं, इसलिए बेचैनी जमा होती रहती है।";
  }
  if (typeof age === "number" && age <= 35) {
    return "काम और आमदनी को लेकर स्थिरता देर से बनती दिख रही है। रिश्तों और परिवार की अपेक्षाएँ भी मन पर दबाव डालती हैं। मेहनत बहुत होती है, पर परिणाम रुक-रुककर मिलने से आत्मविश्वास कमजोर पड़ता है।";
  }
  if (typeof age === "number" && age <= 55) {
    return "इस समय घर और काम की जिम्मेदारियाँ एक साथ भारी पड़ रही हैं। मेहनत के अनुपात में पैसा या सम्मान देर से मिलता है और परिवार की चिंता मन को खाली नहीं रहने देती। अपनी परेशानी भीतर रखने से थकान और चिड़चिड़ापन भी बढ़ रहा है।";
  }
  if (typeof age === "number") {
    return "परिवार और स्वास्थ्य की चिंता मन पर अधिक रहती है। अपने लोगों के लिए बहुत कुछ करने के बाद भी भीतर अकेलापन और अधूरापन महसूस होता है। पुराने तनाव छूटते नहीं और मन को स्थिर शांति मिलने में रुकावट बनी रहती है।";
  }

  return "मेहनत के बाद भी चीज़ें रुक-रुककर आगे बढ़ती हैं और मन में अनिश्चितता बनी रहती है। घर की जिम्मेदारियाँ तथा पैसों की चिंता दबाव बढ़ाती हैं। अपनी बात भीतर रखने के कारण थकान और बेचैनी भी जमा होती जा रही है।";
}

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
- NEVER say "विवरण आ गए हैं", "अब यहाँ की चाल देखकर बताऊँगा", "देख रहा हूँ", or ask them to wait. If anything is missing, explicitly ask for that exact missing field.
- STRICTLY FORBIDDEN before payment: ग्रह, ग्रहों, दशा, नक्षत्र, कुंडली analysis, उपाय.
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
  birthDetailsContext?: string;
};

export async function generateFunnelReply({
  stage,
  phone,
  userMessage,
  contactName,
  missingBirthFields,
  birthDetailsContext,
}: GenerateFunnelReplyInput): Promise<string> {
  const { apiKey, model } = getXaiConfig();
  const provider = createXai({ apiKey });

  const history = isDbConfigured()
    ? await getConversationHistory(phone)
    : [];

  const historyWithCurrentMessage = [
    ...history,
    { role: "user", content: userMessage },
    ...(birthDetailsContext
      ? [{ role: "user", content: `[सत्यापित जन्म विवरण]\n${birthDetailsContext}` }]
      : []),
  ];
  const birthProfile =
    stage === "reading"
      ? buildBirthProfileFromHistory(historyWithCurrentMessage)
      : undefined;

  const messages: ModelMessage[] = [
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    buildUserMessage(userMessage, stage),
  ];

  const languageModel = provider.responses(model);
  const systemPrompt = systemForStage(
    stage,
    contactName,
    missingBirthFields,
    birthProfile,
  );
  const { text } = await generateText({
    model: languageModel,
    system: systemPrompt,
    messages,
    temperature: 0.88,
    maxRetries: 1,
  });

  let reply = text.trim();
  if (!reply) {
    throw new Error(`Empty funnel reply for stage: ${stage}`);
  }

  if (stage === "reading" && INVALID_FREE_READING.test(reply)) {
    const { text: retryText } = await generateText({
      model: languageModel,
      system: `${systemPrompt}

REWRITE REQUIRED: The draft broke the free-reading flow. State 3-4 likely real-life problems based on age/life stage. Make statements only. No question, no "बताइए", no astrology terms, no remedy, no payment, and no promise to inspect later.`,
      messages,
      temperature: 0.9,
      maxRetries: 1,
    });
    const retried = retryText.trim();
    reply =
      retried && !INVALID_FREE_READING.test(retried)
        ? retried
        : freeReadingFallback(birthProfile);
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
