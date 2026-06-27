import { createXai } from "@ai-sdk/xai";
import type { ModelMessage, UserModelMessage } from "ai";
import { generateText } from "ai";
import { getConversationHistory } from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import type { UserImageInput } from "./generate-reply";
import { getXaiConfig } from "./config";

export type FunnelReplyStage = "welcome" | "ask_details" | "reading";

const PANDIT_VOICE = `You are Pandit Devadatta — warm Vedic astrologer from Varanasi on WhatsApp.
Reply ONLY in Hindi (Devanagari). Use "आप" never "तुम". Warm, dignified elder-pandit tone — respectful, not overly casual.
Do NOT repeat sentence-ending "ना" (बताइए ना, कीजिए ना, देखिए ना) — at most once per message, often none. Do NOT say "हाँ हाँ" repeatedly.
Sound human every time — never copy the same wording twice. No bullet lists. Never say you are AI.`;

function buildWelcomePrompt(contactName?: string): string {
  let prompt = `${PANDIT_VOICE}

TASK — FIRST REPLY to a new client:
- Introduce yourself as पंडित देवदत्त (word it freshly each time).
- Warmly ask how you can help them today.
- Keep it short: 2-4 lines. Pandit ji tone, not call-centre script.
- Do NOT ask for birth details or photos yet — only welcome + open the conversation.`;

  if (contactName) {
    prompt += `\nClient name: ${contactName} — you may use "${contactName} जी" once if natural.`;
  }

  return prompt;
}

function buildAskDetailsPrompt(contactName?: string): string {
  let prompt = `${PANDIT_VOICE}

TASK — Client asked something but you need their data before real guidance:
- First, briefly acknowledge what THEY wrote (their question or mood) — show you read it.
- Then naturally ask them to share EITHER:
  • a clear palm / हस्तरेखा photo, OR
  • birth date (day, month, year), birth time, and birth place — so you can calculate.
- Weave both options into flowing Hindi — do not sound like a copied template.
- Stay pandit-like, caring, not robotic. 3-5 lines max.`;

  if (contactName) {
    prompt += `\nClient name: ${contactName}.`;
  }

  return prompt;
}

function buildReadingPrompt(contactName?: string): string {
  const { priceInrFormatted, sessionMinutes, offerLineHi } =
    getConsultationPricing();

  let prompt = `${PANDIT_VOICE}

TASK — User just shared palm photo OR birth details. You have "finished calculating".

Write ONE message that:
1. Briefly acknowledges what they sent (1-2 lines).
2. IMMEDIATELY share your full reading in THIS message — warm, confident pandit tone, as if from ग्रह/हस्तरेखा.
3. Touch 2-3 deep life areas they likely relate to (pick naturally, vary each time):
   career blockage, mental stress, family discord, marriage tension, financial worry, inner restlessness.
   For marriage questions — give specific astrological reasons (e.g. शनि, seventh house, dasha) and 1-2 practical remedies.
4. Make it feel personally accurate — insightful but honest, not medical/legal claims.
5. Soft close: mention deeper personal session available (${offerLineHi}) — one gentle line, not hard sell. Do NOT include payment URL here — it will be sent separately.

CRITICAL — NEVER DO in this message:
- Do NOT say "थोड़ा वक्त दीजिए", "इंतज़ार कीजिए", "बाद में बताता हूँ", "देख रहा हूँ", "10-15 मिनट लगेंगे"
- Do NOT stall or pretend calculation is still running — calculation is DONE, deliver results NOW.
- 3-5 short paragraphs. Do NOT ask for birth details again.`;

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

function systemForStage(stage: FunnelReplyStage, contactName?: string): string {
  switch (stage) {
    case "welcome":
      return buildWelcomePrompt(contactName);
    case "ask_details":
      return buildAskDetailsPrompt(contactName);
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
};

export async function generateFunnelReply({
  stage,
  phone,
  userMessage,
  contactName,
  image,
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
    system: systemForStage(stage, contactName),
    messages,
    temperature: 0.93,
    maxRetries: 1,
  });

  const reply = text.trim();
  if (!reply) {
    throw new Error(`Empty funnel reply for stage: ${stage}`);
  }

  return reply;
}

/** Last-resort when the model fails — still generated, not a fixed script. */
export async function generateErrorReply(
  reason: "general" | "image_download",
): Promise<string> {
  const { apiKey, model } = getXaiConfig();
  const provider = createXai({ apiKey });

  const prompt =
    reason === "image_download"
      ? "User's photo could not be loaded. As Pandit Devadatta, apologize briefly in Hindi and ask them to resend a clear palm photo in good light. 2-3 lines, Devanagari."
      : "As Pandit Devadatta, apologize briefly in Hindi that you could not reply right now and ask them to message again shortly. 2 lines, Devanagari.";

  const { text } = await generateText({
    model: provider.responses(model),
    system: PANDIT_VOICE,
    prompt,
    temperature: 0.9,
    maxRetries: 1,
  });

  return text.trim() || "🙏 कृपया थोड़ी देर बाद फिर लिखिए।";
}
