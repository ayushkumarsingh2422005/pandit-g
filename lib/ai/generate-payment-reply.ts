import { createXai } from "@ai-sdk/xai";
import { generateText } from "ai";
import { getConversationHistory } from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import { getXaiConfig } from "./config";
import { normalizeReplyNumerals } from "./normalize-numerals";
import { NO_PLANETS_BEFORE_PAYMENT, PANDIT_VOICE, buildClientNameHint } from "./pandit-voice";

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
  clientName?: string;
};

function buildPrompt(input: GeneratePaymentReplyInput): string {
  const pricing = getConsultationPricing();
  const {
    type,
    paymentUrl,
    amountInr = pricing.priceInrFormatted,
    sessionMinutes = pricing.sessionMinutes,
    minutesRemaining,
    clientName,
  } = input;

  let prompt = PANDIT_VOICE + "\n\n" + buildClientNameHint(clientName) + "\n\n";

  switch (type) {
    case "offer":
      prompt += `TASK — चरण 3: Payment CTA after free trust reading (problems already described, NO planets yet).

Write ONE message in this spirit (fresh wording each time, do NOT copy verbatim):
- Reassure: घबराइए मत / चिंता न करें — इन परेशानियों का निश्चित समाधान है।
- Invite: इन दिक्कतों को खत्म करने, जीवन को सही दिशा देने, और मुझसे सीधे जुड़कर उपाय जानने के लिए अभी परामर्श लें।
- Price line: ${amountInr} — ${sessionMinutes} मिनट की सीधी WhatsApp बातचीत (पंडित जी से सीधा संवाद).
${paymentUrl ? `- Put this EXACT payment link on its own line:\n${paymentUrl}` : "- Say payment link will be sent shortly."}

${NO_PLANETS_BEFORE_PAYMENT}
- 4-6 lines, confident caring tone — not hard sell.`;
      break;

    case "unpaid":
      prompt += `TASK — User wants guidance but payment is NOT confirmed:
- Briefly acknowledge their question — do NOT answer astrology fully (no graha/upay yet).
- Say भुगतान अभी पुष्टि नहीं हुआ — fresh words.
- Do NOT stall with "कुंडली देख रहा हूँ".
${paymentUrl ? `- Ask to pay via link for ${sessionMinutes}-minute session:\n${paymentUrl}` : "- Ask to wait for payment link."}
${NO_PLANETS_BEFORE_PAYMENT}
- 3-5 lines.`;
      break;

    case "expired":
      prompt += `TASK — Paid session time ended:
- Acknowledge what they wrote.
- Session समाप्त — offer new ${amountInr} / ${sessionMinutes} min session.
${paymentUrl ? `- Payment link:\n${paymentUrl}` : "- Payment link coming soon."}`;
      break;

    case "claimed_paid_pending":
      prompt += `TASK — User claims they paid but not confirmed:
- Politely say भुगतान सिस्टम में confirm नहीं हुआ — vary wording.
- Ask to wait 1-2 minutes or retry if money deducted.
${paymentUrl ? `- Link again:\n${paymentUrl}` : "- Ask to message again shortly."}
- Do NOT start full consultation yet.`;
      break;

    case "success":
      prompt += `TASK — Payment confirmed, session started (${sessionMinutes} min).
- Confirm दक्षिणा/भुगतान मिला, session शुरू — fresh words.
- Invite real questions. ${minutesRemaining ? `~${minutesRemaining} min left.` : ""}
- 2-4 lines.`;
      break;
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
    temperature: 0.85,
    maxRetries: 1,
  });

  const reply = text.trim();
  if (!reply) {
    throw new Error("Empty payment reply");
  }

  if (input.paymentUrl && !reply.includes(input.paymentUrl)) {
    return normalizeReplyNumerals(`${reply}\n\n${input.paymentUrl}`);
  }

  return normalizeReplyNumerals(reply);
}
