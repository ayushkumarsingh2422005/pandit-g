import { createXai } from "@ai-sdk/xai";
import { generateText } from "ai";
import { getConversationHistory } from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import { getXaiConfig } from "./config";
import { normalizeReplyNumerals } from "./normalize-numerals";
import { NO_PLANETS_BEFORE_PAYMENT, PANDIT_VOICE } from "./pandit-voice";
import { isPaymentIntent } from "@/lib/payments/payment-intent";

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

function recentAssistantHadPaymentLink(
  history: { role: string; content: string }[],
  paymentUrl?: string,
): boolean {
  const recent = history.filter((m) => m.role === "assistant").slice(-4);
  return recent.some((m) => {
    if (paymentUrl && m.content.includes(paymentUrl)) return true;
    return /rzp\.io|razorpay\.com\/l\//i.test(m.content);
  });
}

function nameUsageHint(contactName?: string): string {
  if (!contactName) return "";
  return `\nWhatsApp name (do NOT open replies with it): ${contactName}. Never start with "${contactName} जी".`;
}

function buildPrompt(
  input: GeneratePaymentReplyInput,
  opts: { includePaymentLink: boolean },
): string {
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
      prompt += `TASK — चरण 3: Payment CTA after free trust reading (problems already described, NO planets yet).

Write ONE message in this spirit (fresh wording each time, do NOT copy verbatim):
- Reassure: घबराइए मत / चिंता न करें — इन परेशानियों का निश्चित समाधान है।
- Invite: इन दिक्कतों को खत्म करने, जीवन को सही दिशा देने, और मुझसे सीधे जुड़कर उपाय जानने के लिए अभी परामर्श लें।
- Price line: ${amountInr} — ${sessionMinutes} मिनट की सीधी WhatsApp बातचीत।
${
  opts.includePaymentLink && paymentUrl
    ? `- Put this EXACT payment link on its own line:\n${paymentUrl}`
    : "- Softly invite them to say हाँ when ready — do NOT paste a payment URL this turn."
}

${NO_PLANETS_BEFORE_PAYMENT}
- 4-6 lines, confident caring tone — not hard sell.`;
      break;

    case "unpaid":
      prompt += `TASK — User wants guidance but payment is NOT confirmed yet.

Be a calm human, not a payment bot:
- Acknowledge what they just wrote with empathy (their worry, anger, or question).
- Explain gently that detailed उपाय / ग्रह चर्चा शुरू करने से पहले दक्षिणा की पुष्टि चाहिए।
- Do NOT dump the same hard-sell paragraph every message.
- Do NOT start every reply with their name.
${
  opts.includePaymentLink && paymentUrl
    ? `- This turn you MAY include the payment link once, naturally:\n${paymentUrl}\nPrice: ${amountInr} for ${sessionMinutes} minutes.`
    : `- Payment link was already shared recently OR they have not asked to pay yet.
- Do NOT include any rzp.io / payment URL this turn.
- Talk calmly; if they seem ready, invite them to say "भुगतान" / "link भेजो" or quietly remind the amount (${amountInr} / ${sessionMinutes} min) without pasting a link.`
}
${NO_PLANETS_BEFORE_PAYMENT}
- 3-5 lines. Vary wording from earlier messages in history.`;
      break;

    case "expired":
      prompt += `TASK — Paid session time ended. User may be upset that the last session felt short or empty.

Be a calm, respectful human — NOT a payment-link spam machine:
- Read their last message carefully. Answer THAT first (anger, "why again", "we didn't talk", etc.).
- Acknowledge calmly if the previous session felt short / incomplete — do not argue.
- Briefly explain: पिछला सत्र समाप्त हो चुका है; नया सत्र शुरू करने के लिए दक्षिणा लगती है (${amountInr} / ${sessionMinutes} मिनट).
- Sound like a patient pandit on WhatsApp — soft ask, not pressure.
${
  opts.includePaymentLink && paymentUrl
    ? `- Include this EXACT payment link once, at the end, only because they seem ready or it has not been sent recently:\n${paymentUrl}`
    : `- Do NOT paste any payment URL / rzp.io link this turn (already sent recently, or they are still venting).
- Invite them gently: जब तैयार हों तो बता दें — मैं लिंक भेज दूँगा / फिर से परामर्श शुरू करेंगे.
- Still NO graha/upay until payment is confirmed.`
}
${NO_PLANETS_BEFORE_PAYMENT}
- 3-5 lines. NEVER open with their WhatsApp name. NEVER repeat the identical payment paragraph.`;
      break;

    case "claimed_paid_pending":
      prompt += `TASK — User claims they paid but not confirmed:
- Politely say भुगतान सिस्टम में confirm नहीं हुआ — vary wording.
- Ask to wait 1-2 minutes or retry if money deducted.
${
  opts.includePaymentLink && paymentUrl
    ? `- If helpful, share link once:\n${paymentUrl}`
    : "- Do not paste a payment URL unless necessary; ask them to wait or message again shortly."
}
- Do NOT start full consultation yet.`;
      break;

    case "success":
      prompt += `TASK — Payment confirmed, session started (${sessionMinutes} min).
- Confirm दक्षिणा/भुगतान मिला, session शुरू — fresh words.
- Invite real questions. ${minutesRemaining ? `~${minutesRemaining} min left.` : ""}
- 2-4 lines. Do not open with their name.`;
      break;
  }

  prompt += nameUsageHint(contactName);

  if (opts.includePaymentLink && paymentUrl) {
    prompt +=
      "\nIMPORTANT: If you include a payment URL, it must appear exactly as given. Do not invent a different URL.";
  } else {
    prompt +=
      "\nIMPORTANT: Do NOT include any payment URL, rzp.io link, or fake link in this reply.";
  }

  return prompt;
}

function shouldIncludePaymentLink(
  type: PaymentReplyType,
  userMessage: string,
  history: { role: string; content: string }[],
  paymentUrl?: string,
): boolean {
  if (!paymentUrl) return false;
  if (type === "offer" || type === "success") return type === "offer";
  if (type === "claimed_paid_pending") {
    return !recentAssistantHadPaymentLink(history, paymentUrl);
  }

  // unpaid / expired — only when user asks for pay OR link not sent recently
  const alreadySent = recentAssistantHadPaymentLink(history, paymentUrl);
  if (alreadySent) {
    // Re-send only if they explicitly ask for the link / want to pay
    return isPaymentIntent(userMessage);
  }

  // First soft ask after expiry may include link once; if user is only venting, still allow one calm link ask on first expired turn
  if (type === "expired") {
    const angryOnly =
      /नहीं चाह|नही चाह|मत भेज|don't want|link क्यों|क्यों.*लिंक|फिर.*लिंक|again.*link|पैसे ले|पैसे लेकर|कुछ नहीं|कुछ नही/i.test(
        userMessage,
      );
    if (angryOnly) return false;
  }

  return true;
}

export async function generatePaymentReply(
  input: GeneratePaymentReplyInput,
): Promise<string> {
  const { apiKey, model } = getXaiConfig();
  const provider = createXai({ apiKey });

  const history = isDbConfigured()
    ? await getConversationHistory(input.phone)
    : [];

  const includePaymentLink = shouldIncludePaymentLink(
    input.type,
    input.userMessage,
    history,
    input.paymentUrl,
  );

  const messages = [
    ...history.map((entry) => ({
      role: entry.role as "user" | "assistant",
      content: entry.content,
    })),
    { role: "user" as const, content: input.userMessage.trim() || "नमस्ते" },
  ];

  const { text } = await generateText({
    model: provider.responses(model),
    system: buildPrompt(input, { includePaymentLink }),
    messages,
    temperature: 0.9,
    maxRetries: 1,
  });

  let reply = text.trim();
  if (!reply) {
    throw new Error("Empty payment reply");
  }

  // Strip accidental links when we decided not to include one
  if (!includePaymentLink) {
    reply = reply
      .replace(/https?:\/\/\S*rzp\.io\S*/gi, "")
      .replace(/https?:\/\/\S*razorpay\.com\/\S*/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } else if (
    input.paymentUrl &&
    includePaymentLink &&
    !reply.includes(input.paymentUrl)
  ) {
    reply = `${reply}\n\n${input.paymentUrl}`;
  }

  return normalizeReplyNumerals(reply);
}
