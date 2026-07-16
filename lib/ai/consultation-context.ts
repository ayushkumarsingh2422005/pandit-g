import { buildBirthProfileFromHistory } from "@/lib/funnel/birth-profile";
import type { StoredChatMessage } from "@/lib/db/conversations";

const CONCERN_PATTERN =
  /नौकरी|नौकर|शादी|विवाह|पैसा|धन|प्रेम|रिश्त|परिवार|स्वास्थ्य|पढ़ाई|करियर|व्यापार|धर्म|धार्मिक|religious|puja|पूजा|समस्या|problem|परेशान|दिक्कत|tension|शत्रु|dushman|job|marriage|money|career|business|health|family/i;

const ASTRO_TERMS =
  /ग्रह|दशा|भाव|नक्षत्र|कुंडली|शनि|राहु|केतु|गुरु|शुक्र|मंगल|बुध|चंद्र|सूर्य|दृष्टि|महादशा|अंतर्दशा|योग|लग्न/;
const REMEDY =
  /दान|पूजा|मंत्र|जाप|व्रत|पाठ|उपाय|निवारण|तिल|सिंदूर|चालीसा|समाधान/;
const PAYMENT_ACK = /दक्षिणा प्राप्त/;

export type ConsultationProgress = {
  userStatedProblem: boolean;
  discussedProblemPlain: boolean;
  explainedCause: boolean;
  gaveRemedy: boolean;
  hasBirthDetails: boolean;
  statedConcerns: string[];
  freeReadingSnippet?: string;
  freeReadingDone: boolean;
  paidProblemReplyDone: boolean;
  paidCauseReplyDone: boolean;
  paidRemedyReplyDone: boolean;
  problemsFullyDescribed: boolean;
};

export function userIsFrustratedWithBot(text: string): boolean {
  return /farji|फर्जी|fake|bot|बार.?बार|repeat|दो.?लाइन|robot|robotic|samajh nahi|समझ नहीं|time pass|टाइम.?पास|bekar|बेकार|block|ब्लॉक|kya pandit|pandit ho|पंडित हो|झूठ|jhoot|dhokha|धोखा|kuch bhi|कुछ भी|galat bol|गलत बोल/i.test(
    text,
  );
}

function isSubstantiveUserMessage(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 6) return false;
  if (trimmed.startsWith("[फोटो")) return false;
  if (/^(hi|hello|hey|ok|okay|ji|जी|haan|han|namaste|नमस्ते)$/i.test(trimmed)) {
    return false;
  }
  return true;
}

function messagesAfterPayment(
  history: { role: string; content: string }[],
): { role: string; content: string }[] {
  let paymentIdx = -1;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (
      history[i]?.role === "assistant" &&
      PAYMENT_ACK.test(history[i].content)
    ) {
      paymentIdx = i;
      break;
    }
  }
  if (paymentIdx === -1) return history;
  return history.slice(paymentIdx + 1);
}

function extractStatedConcerns(
  history: { role: string; content: string }[],
): string[] {
  const seen = new Set<string>();
  const concerns: string[] = [];

  for (const msg of history) {
    if (msg.role !== "user") continue;
    const text = msg.content.trim();
    if (!isSubstantiveUserMessage(text)) continue;
    if (!CONCERN_PATTERN.test(text) && text.length < 20) continue;
    const key = text.slice(0, 60).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    concerns.push(text.slice(0, 160));
  }

  return concerns.slice(-4);
}

function findFreeReadingSnippet(
  history: { role: string; content: string }[],
): string | undefined {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (msg?.role !== "assistant") continue;
    if (PAYMENT_ACK.test(msg.content)) continue;
    if (msg.content.includes("rzp.io") || msg.content.includes("₹")) continue;
    if (msg.content.length > 120 && !ASTRO_TERMS.test(msg.content)) {
      return msg.content.slice(0, 320);
    }
  }
  return undefined;
}

export function getConsultationProgress(
  history: { role: string; content: string }[],
  userMessage: string,
): ConsultationProgress {
  const afterPayment = messagesAfterPayment(history);
  const allUserText = [
    ...history.filter((m) => m.role === "user").map((m) => m.content),
    userMessage,
  ].join("\n");

  const statedConcerns = extractStatedConcerns(history);
  if (
    isSubstantiveUserMessage(userMessage) &&
    (CONCERN_PATTERN.test(userMessage) || userMessage.trim().length >= 12)
  ) {
    const latest = userMessage.trim().slice(0, 160);
    if (!statedConcerns.some((c) => c.startsWith(latest.slice(0, 40)))) {
      statedConcerns.push(latest);
    }
  }

  const userStatedProblem =
    CONCERN_PATTERN.test(allUserText) ||
    afterPayment.some(
      (m) => m.role === "user" && isSubstantiveUserMessage(m.content),
    ) ||
    isSubstantiveUserMessage(userMessage);

  let discussedProblemPlain = false;
  let explainedCause = false;
  let gaveRemedy = false;

  const assistantAfterPayment = afterPayment.filter((m) => m.role === "assistant");
  let paidProblemReplyDone = false;
  let paidCauseReplyDone = false;
  let paidRemedyReplyDone = false;

  for (const msg of assistantAfterPayment) {
    if (PAYMENT_ACK.test(msg.content)) continue;
    if (REMEDY.test(msg.content)) paidRemedyReplyDone = true;
    if (ASTRO_TERMS.test(msg.content)) paidCauseReplyDone = true;
    if (
      !ASTRO_TERMS.test(msg.content) &&
      !REMEDY.test(msg.content) &&
      !PAYMENT_ACK.test(msg.content) &&
      !msg.content.includes("rzp.io") &&
      msg.content.length > 40
    ) {
      paidProblemReplyDone = true;
      discussedProblemPlain = true;
    }
    if (REMEDY.test(msg.content)) gaveRemedy = true;
    if (ASTRO_TERMS.test(msg.content)) explainedCause = true;
  }

  const freeReadingSnippet = findFreeReadingSnippet(history);
  const freeReadingDone = Boolean(freeReadingSnippet);
  const problemsFullyDescribed =
    freeReadingDone || paidProblemReplyDone || discussedProblemPlain;

  const birthProfile = buildBirthProfileFromHistory(history);

  return {
    userStatedProblem,
    discussedProblemPlain,
    explainedCause,
    gaveRemedy,
    hasBirthDetails: Boolean(birthProfile.dobLabel),
    statedConcerns: statedConcerns.slice(-4),
    freeReadingSnippet,
    freeReadingDone,
    paidProblemReplyDone,
    paidCauseReplyDone,
    paidRemedyReplyDone,
    problemsFullyDescribed,
  };
}

export function buildPaidSessionContextBlock(
  history: StoredChatMessage[],
  userMessage: string,
): string {
  const progress = getConsultationProgress(history, userMessage);
  const birthProfile = buildBirthProfileFromHistory(history);

  const birthLine = birthProfile.dobLabel
    ? `${birthProfile.dobLabel} (लगभग ${birthProfile.ageYears} साल)`
    : "चैट में जन्म विवरण मौजूद है — दोबारा मत माँगो";

  const concernsLine =
    progress.statedConcerns.length > 0
      ? progress.statedConcerns.map((c, i) => `${i + 1}. "${c}"`).join("\n")
      : "User ने अभी बात शुरू की — जो लिखा सुनो";

  const readingLine = progress.freeReadingSnippet
    ? `\nमुफ़्त पढ़ाव (पहले बताया): "${progress.freeReadingSnippet.slice(0, 280)}..."`
    : "";

  return `
━━━ पूरी chat पढ़ चुके हो — याद रखो ━━━
जन्म: ${birthLine}
User की बातें:
${concernsLine}${readingLine}

Progress (एक समय पर एक चरण):
- मुफ़्त पढ़ाव (समस्याएँ): ${progress.freeReadingDone ? "✓ हो चुका" : "—"}
- भुगतान के बाद समस्या: ${progress.paidProblemReplyDone ? "✓" : progress.freeReadingDone ? "skip (पढ़ाव में हो चुका)" : "—"}
- कारण (ग्रह/दशा): ${progress.paidCauseReplyDone ? "✓" : "← अगला यही"}
- उपाय: ${progress.paidRemedyReplyDone ? "✓" : progress.paidCauseReplyDone ? "← अगला यही" : "—"}

पूरा flow: intro → जन्म विवरण → समस्याएँ (बिना ग्रह) → भुगतान → कारण (ग्रह) → उपाय → follow-up

सख्त मना — robotic loop:
- "दो लाइन में लिखें/बताएं" — कभी नहीं
- "बिना स्पष्ट सवाल के..." / "पहले समस्या साफ बताएं" — user ने कुछ भी कहा हो तो मत बोलो
- "कुंडली देखकर बताऊँगा" — जन्म विवरण पहले से chat में है, ऐसा mat kaho
- जन्म तिथि/समय/स्थान दोबारा मत माँगो
- हर जवाब में नाम + "समझ सकता हूँ" template मत`;
}

/** Phrases that make replies feel robotic — checked in prompts as hard ban. */
export const BANNED_ROBOTIC_PHRASES = [
  "दो लाइन",
  "दो लाइनों",
  "बिना स्पष्ट सवाल",
  "स्पष्ट रूप से बताएं",
  "पहले समस्या साफ",
  "कुंडली देखकर बताऊँगा",
  "कुंडली देखकर बताऊंगा",
  "जन्म विवरण भेज",
  "जन्म तिथि भेज",
  "हस्तरेखा",
  "हथेली देख",
];
