import { createXai } from "@ai-sdk/xai";
import type { ModelMessage, UserModelMessage } from "ai";
import { generateText } from "ai";
import { formatRashiLine } from "@/lib/astro/rashi";
import type { ClientBirthProfile } from "@/lib/db/conversation-profile";
import { getConversationHistory } from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import type { UserImageInput } from "./generate-reply";
import { getXaiConfig } from "./config";
import { normalizeReplyNumerals } from "./normalize-numerals";
import {
  buildClientNameHint,
  NO_PLANETS_BEFORE_PAYMENT,
  PANDIT_CITY,
  PANDIT_NAME,
  PANDIT_VOICE,
} from "./pandit-voice";

export type FunnelReplyStage =
  | "welcome"
  | "ask_name"
  | "ask_details"
  | "reading";

function buildWelcomePrompt(): string {
  return `${PANDIT_VOICE}

${buildClientNameHint()}

TASK — पहला जवाब (परिचय + नाम पूछना):
- Introduce yourself: मैं ${PANDIT_NAME} हूँ, ${PANDIT_CITY} से — word freshly each time.
- Do NOT open with only "कल्याण हो".
- Say you help people with life's complications — one warm line.
- Ask their name: "आपका नाम क्या है?" / "पहले अपना नाम बताइए" — natural Hindi.
- Do NOT ask for birth details or photos yet — ONLY name in this message.
- 3-4 lines.`;
}

function buildAskNamePrompt(hintBirthDetailsPending?: boolean): string {
  return `${PANDIT_VOICE}

${buildClientNameHint()}

TASK — User has NOT clearly shared their name yet.
${hintBirthDetailsPending ? "- They sent birth/palm info but name is still needed first — thank them briefly, ask name before continuing." : "- Politely ask again: अपना नाम बताइए (first name is enough)."}
- Do NOT use WhatsApp profile name. Do NOT guess a name.
- Do NOT give astrology reading yet.
- 2-3 lines.`;
}

function buildAskDetailsPrompt(clientName?: string): string {
  return `${PANDIT_VOICE}

${buildClientNameHint(clientName)}

TASK — Name received. Now collect birth data before any reading:
- Thank them by name once if natural (${clientName ? `${clientName} जी` : "आप"}).
- Ask for EITHER:
  • जन्म तिथि (दिन, महीना, साल), जन्म समय और जन्म स्थान, OR
  • हथेली की साफ तस्वीर (हस्तरेखा).
- If they asked a question, briefly acknowledge — but say you need birth/palm data first.
- 3-5 lines.`;
}

function buildReadingPrompt(
  birthProfile?: ClientBirthProfile | null,
  clientName?: string,
): string {
  const rashiHint = birthProfile?.rashi
    ? `3. MUST include: "${formatRashiLine(birthProfile.rashi)}"`
    : `3. If palm photo only (no DOB), skip rashi — problems from palm.`;

  const confirmHint = birthProfile?.summary
    ? `1. ONE short line confirming birth details (Arabic digits): ${birthProfile.summary} — only once ever.`
    : `1. ONE short line confirming palm/birth info received.`;

  return `${PANDIT_VOICE}

${buildClientNameHint(clientName)}

TASK — Trust phase. User shared palm OR birth details.

Write ONE message:
${confirmHint}
2. ${rashiHint}
4. Describe ONLY life problems in plain Hindi — 3-4 areas (mental stress, money, family, career blocks, marriage delay). Match their earlier questions.
5. Empathy close — blockage feeling — NO astrological causes.

${NO_PLANETS_BEFORE_PAYMENT}

NEVER: payment offer, stalling, repeat birth ask, WhatsApp profile name.
5-7 lines.`;
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
  options: {
    birthProfile?: ClientBirthProfile | null;
    clientName?: string;
    hintBirthDetailsPending?: boolean;
  },
): string {
  switch (stage) {
    case "welcome":
      return buildWelcomePrompt();
    case "ask_name":
      return buildAskNamePrompt(options.hintBirthDetailsPending);
    case "ask_details":
      return buildAskDetailsPrompt(options.clientName);
    case "reading":
      return buildReadingPrompt(options.birthProfile, options.clientName);
  }
}

export type GenerateFunnelReplyInput = {
  stage: FunnelReplyStage;
  phone: string;
  userMessage: string;
  image?: UserImageInput;
  birthProfile?: ClientBirthProfile | null;
  clientName?: string;
  hintBirthDetailsPending?: boolean;
};

export async function generateFunnelReply({
  stage,
  phone,
  userMessage,
  image,
  birthProfile,
  clientName,
  hintBirthDetailsPending,
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
    system: systemForStage(stage, {
      birthProfile,
      clientName,
      hintBirthDetailsPending,
    }),
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
