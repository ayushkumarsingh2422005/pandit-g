import { createXai } from "@ai-sdk/xai";
import { generateText } from "ai";
import { getConversationHistory } from "@/lib/db/conversations";
import { isDbConfigured } from "@/lib/db/is-configured";
import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import { getXaiConfig } from "./config";
import { normalizeReplyNumerals } from "./normalize-numerals";
import { NO_PLANETS_BEFORE_PAYMENT, PANDIT_VOICE } from "./pandit-voice";
import { isPaymentIntent } from "@/lib/payments/payment-intent";
import {
  containsPaymentUrl,
  isSimpleGreeting,
  redactPaymentUrlsInHistory,
  stripPaymentUrls,
  userIsQuestioningPaymentLink,
} from "@/lib/payments/payment-link-text";

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

const PRE_PAY_LEAK =
  /शनि|राहु|केतु|गुरु|शुक्र|मंगल|बुध|चंद्र|सूर्य|ग्रह|नक्षत्र|दशा|भाव|उपाय|मंत्र|चालीसा|हनुमान|saturn|mercury|jupiter|venus|mars|rahu|ketu/i;

function recentAssistantHadPaymentLink(
  history: { role: string; content: string }[],
  paymentUrl?: string,
): boolean {
  const recent = history.filter((m) => m.role === "assistant").slice(-6);
  return recent.some((m) => {
    if (paymentUrl && m.content.includes(paymentUrl)) return true;
    return containsPaymentUrl(m.content);
  });
}

function nameUsageHint(contactName?: string): string {
  if (!contactName) return "";
  return `\nWhatsApp name (do NOT open replies with it): ${contactName}. Never start with "${contactName} जी".`;
}

function buildPrompt(
  input: GeneratePaymentReplyInput,
  opts: { includePaymentLink: boolean; isGreeting: boolean },
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

  prompt += `FACT (do not contradict):
- There is NO active paid session right now.
- NEVER say "सेशन चल रहा है", "सत्र अभी सक्रिय है", or that time is still left.
- NEVER copy any payment URL from chat history. History may show [पुराना भुगतान लिंक] — ignore it.
- NEVER invent a Razorpay / rzp.io link.

`;

  switch (type) {
    case "offer":
      prompt += `TASK — Payment CTA after free trust reading (problems already described, NO planets yet).

Write ONE message (fresh wording):
- Reassure briefly.
- Invite paid consultation: ${amountInr} — ${sessionMinutes} मिनट WhatsApp बातचीत।
${
  opts.includePaymentLink && paymentUrl
    ? `- Put this EXACT payment link on its own line:\n${paymentUrl}`
    : "- Softly invite them to say हाँ when ready — do NOT paste a payment URL."
}

${NO_PLANETS_BEFORE_PAYMENT}
- 4-6 lines, caring — not hard sell.`;
      break;

    case "unpaid":
      if (opts.isGreeting) {
        prompt += `TASK — User just greeted after a gap. Payment not done yet.

- Warm short welcome back (1-2 lines). Do NOT dump a payment link.
- Softly: जब गहन परामर्श चाहिए तो बता दें — ${amountInr} / ${sessionMinutes} मिनट.
- Ask what is on their mind in plain words — but NO graha / उपाय yet.
${NO_PLANETS_BEFORE_PAYMENT}
- 2-4 lines.`;
      } else {
        prompt += `TASK — User wants guidance but payment is NOT confirmed.

Be a calm human, not a payment bot:
- Acknowledge what they just wrote with empathy.
- If they asked a life question: briefly empathize in plain words ONLY — no graha, no उपाय, no remedial mantra.
- Gently: विस्तृत ज्योतिष / उपाय के लिए दक्षिणा की पुष्टि चाहिए (${amountInr} / ${sessionMinutes} मिनट).
${
  opts.includePaymentLink && paymentUrl
    ? `- Include this EXACT payment link once at the end:\n${paymentUrl}`
    : `- Do NOT include any payment URL this turn.
- If they seem ready, invite them to say "लिंक भेजो" / "भुगतान".`
}
${NO_PLANETS_BEFORE_PAYMENT}
- 3-5 lines. Vary wording.`;
      }
      break;

    case "expired":
      if (opts.isGreeting) {
        prompt += `TASK — User returned after a long time with only a greeting. Previous paid session has ENDED.

- Warm welcome back. Do NOT paste any payment link on this greeting.
- Calmly: पिछला परामर्श सत्र समाप्त हो चुका था। नया सत्र चाहिए तो बता दें (${amountInr} / ${sessionMinutes} मिनट).
- Invite them to share what is on their mind — plain talk only until payment.
${NO_PLANETS_BEFORE_PAYMENT}
- 2-4 lines. Human, not salesy.`;
      } else {
        prompt += `TASK — Previous paid session ENDED. User may be upset, confused, or asking if session is still on.

CRITICAL FACTS:
- Session is NOT running. If they ask "session hai?", clearly say previous session समाप्त हो गया.
- Do NOT apologize by pasting the payment link again.
- Do NOT give graha / उपाय / मंत्र.

Be a calm pandit:
- Answer their latest message first (anger, "why link", "is session on", study worry, etc.).
- Empathize in plain Hindi if they share a problem — NO astrology jargon.
- Softly mention new session needs दक्षिणा (${amountInr} / ${sessionMinutes} मिनट) only if natural.
${
  opts.includePaymentLink && paymentUrl
    ? `- Include this EXACT payment link once at the very end:\n${paymentUrl}`
    : `- Do NOT paste any payment URL / rzp.io this turn.
- If they want to continue, ask them to say when ready for the link.`
}
${NO_PLANETS_BEFORE_PAYMENT}
- 3-5 lines. NEVER open with WhatsApp name.`;
      }
      break;

    case "claimed_paid_pending":
      prompt += `TASK — User claims they paid but not confirmed:
- Say भुगतान सिस्टम में confirm नहीं हुआ — vary wording.
- Ask to wait 1-2 minutes or retry if money deducted.
${
  opts.includePaymentLink && paymentUrl
    ? `- If helpful, share link once:\n${paymentUrl}`
    : "- Do not paste a payment URL unless necessary."
}
- Do NOT start full consultation yet.`;
      break;

    case "success":
      prompt += `TASK — Payment confirmed, session started (${sessionMinutes} min).
- Confirm दक्षिणा मिली, session शुरू.
- Invite real questions. ${minutesRemaining ? `~${minutesRemaining} min left.` : ""}
- 2-4 lines. No payment links.`;
      break;
  }

  prompt += nameUsageHint(contactName);

  if (opts.includePaymentLink && paymentUrl) {
    prompt +=
      "\nIMPORTANT: If you include a payment URL, it must appear exactly as given. Do not invent a different URL. Do not copy old links from history.";
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
  if (type === "success") return false;

  // Never dump a link on a bare greeting / "hi after long time"
  if (isSimpleGreeting(userMessage)) return false;

  // User is questioning why a link was sent — talk, don't re-send
  if (userIsQuestioningPaymentLink(userMessage)) return false;

  if (type === "offer") return true;

  if (type === "claimed_paid_pending") {
    return !recentAssistantHadPaymentLink(history, paymentUrl);
  }

  const alreadySent = recentAssistantHadPaymentLink(history, paymentUrl);
  if (alreadySent) {
    return isPaymentIntent(userMessage);
  }

  // First non-greeting unpaid/expired turn: only include link if they show pay intent
  // OR they clearly want to continue consultation (not just venting / asking questions)
  if (isPaymentIntent(userMessage)) return true;

  const wantsContinue =
    /परामर्श|सत्र\s*शुरू|session\s*start|नया\s*सत्र|continue|आगे\s*बात|लिंक|dakshina|दक्षिणा|भुगतान/i.test(
      userMessage,
    );
  return wantsContinue;
}

function safeFallbackReply(
  type: PaymentReplyType,
  amountInr: string,
  sessionMinutes: number,
): string {
  if (type === "expired") {
    return `पिछला परामर्श सत्र समाप्त हो चुका है। जब नया सत्र शुरू करना चाहें तो बता दीजिए — ${amountInr} में ${sessionMinutes} मिनट की सीधी बात होती है।`;
  }
  return `आपकी बात समझ सकता हूँ। विस्तृत उपाय और ज्योतिष चर्चा के लिए दक्षिणा की पुष्टि ज़रूरी है — ${amountInr} / ${sessionMinutes} मिनट। तैयार हों तो बता दें।`;
}

export async function generatePaymentReply(
  input: GeneratePaymentReplyInput,
): Promise<string> {
  const { apiKey, model } = getXaiConfig();
  const provider = createXai({ apiKey });
  const pricing = getConsultationPricing();
  const amountInr = input.amountInr ?? pricing.priceInrFormatted;
  const sessionMinutes = input.sessionMinutes ?? pricing.sessionMinutes;

  const history = isDbConfigured()
    ? await getConversationHistory(input.phone)
    : [];

  const isGreeting = isSimpleGreeting(input.userMessage);
  const includePaymentLink = shouldIncludePaymentLink(
    input.type,
    input.userMessage,
    history,
    input.paymentUrl,
  );

  const safeHistory = redactPaymentUrlsInHistory(history);

  const messages = [
    ...safeHistory.map((entry) => ({
      role: entry.role as "user" | "assistant",
      content: entry.content,
    })),
    { role: "user" as const, content: input.userMessage.trim() || "नमस्ते" },
  ];

  const { text } = await generateText({
    model: provider.responses(model),
    system: buildPrompt(input, { includePaymentLink, isGreeting }),
    messages,
    temperature: 0.88,
    maxRetries: 1,
  });

  let reply = text.trim();
  if (!reply) {
    throw new Error("Empty payment reply");
  }

  // Hard strip links unless this turn is allowed to send one
  if (!includePaymentLink) {
    reply = stripPaymentUrls(reply);
  } else if (input.paymentUrl && !reply.includes(input.paymentUrl)) {
    reply = stripPaymentUrls(reply);
    reply = `${reply}\n\n${input.paymentUrl}`;
  } else {
    // Remove any OTHER invented links; keep only the exact allowed URL
    const kept = input.paymentUrl ?? "";
    reply = stripPaymentUrls(reply);
    if (kept && !reply.includes(kept)) {
      reply = `${reply}\n\n${kept}`;
    }
  }

  // If model leaked astrology before payment, replace with safe message
  if (
    input.type !== "success" &&
    input.type !== "offer" &&
    PRE_PAY_LEAK.test(reply)
  ) {
    reply = safeFallbackReply(input.type, amountInr, sessionMinutes);
    if (includePaymentLink && input.paymentUrl) {
      reply = `${reply}\n\n${input.paymentUrl}`;
    }
  }

  return normalizeReplyNumerals(reply);
}
