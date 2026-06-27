import { createXai } from "@ai-sdk/xai";
import { generateText } from "ai";
import { getConversationHistory } from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import { getXaiConfig } from "./config";

const PANDIT_VOICE = `You are Pandit Devadatta — warm Vedic astrologer on WhatsApp.
Reply ONLY in Hindi (Devanagari). Use "आप". Warm dignified pandit tone — respectful, not chatty.
Do NOT overuse "ना" at sentence ends (बताइए ना, कीजिए ना) or repeat "हाँ हाँ". Never sound robotic. Never say you are AI.`;

export type PaymentReplyType =
  | "offer"
  | "unpaid"
  | "expired"
  | "claimed_paid_pending"
  | "success";

export type GeneratePaymentReplyInput = {
  type: PaymentReplyType;
  phone: string;
  userMessage: string;
  contactName?: string;
  paymentUrl?: string;
  amountInr?: string;
  sessionMinutes?: number;
  minutesRemaining?: number;
};

function buildPrompt(input: GeneratePaymentReplyInput): string {
  const pricing = getConsultationPricing();
  const {
    type,
    contactName,
    paymentUrl,
    amountInr = pricing.priceInrFormatted,
    sessionMinutes = pricing.sessionMinutes,
    minutesRemaining,
  } = input;

  let prompt = PANDIT_VOICE + "\n\n";

  switch (type) {
    case "offer":
      prompt += `TASK — User finished free reading. Offer paid consultation:
- Explain gently that deeper personal guidance needs a paid session (${amountInr} for ${sessionMinutes} minutes on WhatsApp).
${paymentUrl ? `- Include this EXACT payment link on its own line: ${paymentUrl}` : "- Say payment link will be sent shortly — भुगतान लिंक जल्द भेज रहे हैं."}
- Warm pandit tone, 3-5 lines. React to what they wrote if anything.`;
      break;

    case "unpaid":
      prompt += `TASK — User is asking for guidance but payment is NOT confirmed yet:
- First briefly acknowledge their question/concern (show you read it) — do NOT answer the astrology question fully.
- Tell them naturally that आपका भुगतान अभी तक नहीं मिला / भुगतान की पुष्टि नहीं हुई — say it in fresh words each time.
- Do NOT stall with "कुंडली देख रहा हूँ" or "थोड़ा वक्त" — payment is the blocker, say so clearly.
${paymentUrl ? `- Ask them to complete payment using the link below to start the ${sessionMinutes}-minute session.\n- Include this EXACT payment link on its own line: ${paymentUrl}` : "- Ask them to wait for payment link or try again shortly."}
- Caring, not rude. 3-5 lines.`;
      break;

    case "expired":
      prompt += `TASK — Their paid session time ended:
- Acknowledge what they wrote.
- Say session समाप्त हो गया / समय पूरा हो गया — freshly worded.
${paymentUrl ? `- Offer to continue with a new payment (${amountInr}, ${sessionMinutes} min).\n- Include this EXACT payment link on its own line: ${paymentUrl}` : "- Offer new payment when link is available."}`;
      break;

    case "claimed_paid_pending":
      prompt += `TASK — User says they paid but we have NOT received confirmation yet:
- Politely say भुगतान अभी हमें confirm नहीं हुआ / सिस्टम में नहीं दिखा — vary wording.
- Ask to wait 1-2 minutes or retry payment if money was deducted.
${paymentUrl ? `- Include payment link again: ${paymentUrl}` : "- Payment link unavailable — ask them to message again shortly."}
- Do NOT start full consultation yet.`;
      break;

    case "success":
      prompt += `TASK — Payment just confirmed! Session started (${sessionMinutes} minutes).
- Warmly confirm भुगतान मिल गया / सत्र शुरू — fresh words.
- Invite them to ask their real questions now. 2-4 lines.
- ${minutesRemaining ? `They have ~${minutesRemaining} minutes.` : ""}`;
      break;
  }

  if (contactName) {
    prompt += `\nClient name: ${contactName}.`;
  }

  if (paymentUrl) {
    prompt +=
      "\nIMPORTANT: Payment URL must appear exactly as given. Do not invent a different URL.";
  }

  return prompt;
}

export async function generatePaymentReply(
  input: GeneratePaymentReplyInput,
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
    system: buildPrompt(input),
    messages,
    temperature: 0.93,
    maxRetries: 1,
  });

  const reply = text.trim();
  if (!reply) {
    throw new Error("Empty payment reply");
  }

  if (input.paymentUrl && !reply.includes(input.paymentUrl)) {
    return `${reply}\n\n${input.paymentUrl}`;
  }

  return reply;
}
