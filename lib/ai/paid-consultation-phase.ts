import {
  getConsultationProgress,
  userIsFrustratedWithBot,
} from "./consultation-context";

export type PaidConsultationPhase =
  | "discuss_problem"
  | "explain_astro_cause"
  | "give_remedy"
  | "follow_up"
  | "reassure_and_answer";

type HistoryEntry = { role: string; content: string };

const PAYMENT_ACK = /दक्षिणा प्राप्त/;

function userShortAck(userMessage: string): boolean {
  const trimmed = userMessage.trim();
  if (trimmed.length > 50) return false;
  return /^(a+a?ch+h?a|ok|okay|ठीक|theek|हाँ|हां|samajh|समझ|haan|han|ji|जी)/i.test(
    trimmed,
  );
}

function userAsksRemedy(userMessage: string): boolean {
  return /उपाय|समाधान|निवारण|क्या करूँ|क्या करूं|kaise theek|upay|remedy|samadhan|ilaj|उपचार|theek kaise|rasta|रास्ता|कैसे दूर|समाधान बत|उपाय बत/i.test(
    userMessage,
  );
}

function userAsksWhyOrCause(userMessage: string): boolean {
  return /क्यों|kyu|kyun|कैसे हो|वजह|reason|cause|कारण|grah|ग्रह|kundli|कुंडली/i.test(
    userMessage,
  );
}

function isNewConcern(userMessage: string): boolean {
  return /नौकरी|शादी|पैसा|धन|प्रेम|धर्म|धार्मिक|स्वास्थ्य|करियर|विवाह|परिवार|job|marriage|money|career|religious/i.test(
    userMessage,
  );
}

/**
 * Phase from full chat progress — not just last bot message.
 * Client flow: problem (plain) → astro cause → remedy → follow-up.
 */
export function detectPaidConsultationPhase(
  history: HistoryEntry[],
  userMessage: string,
): PaidConsultationPhase {
  const trimmed = userMessage.trim();
  const progress = getConsultationProgress(history, userMessage);
  const asksRemedy = userAsksRemedy(trimmed);
  const asksCause = userAsksWhyOrCause(trimmed);

  if (userIsFrustratedWithBot(trimmed)) {
    return "reassure_and_answer";
  }

  if (progress.gaveRemedy) {
    if (isNewConcern(trimmed) && !userShortAck(trimmed) && !asksRemedy) {
      return "discuss_problem";
    }
    return "follow_up";
  }

  if (asksRemedy) {
    return progress.explainedCause ? "give_remedy" : "explain_astro_cause";
  }

  if (progress.explainedCause && !progress.gaveRemedy) {
    return userShortAck(trimmed) || asksCause ? "give_remedy" : "follow_up";
  }

  if (progress.discussedProblemPlain && !progress.explainedCause) {
    return "explain_astro_cause";
  }

  if (progress.userStatedProblem && !progress.discussedProblemPlain) {
    return "discuss_problem";
  }

  const lastAssistant = history.filter((m) => m.role === "assistant").at(-1);
  if (lastAssistant && PAYMENT_ACK.test(lastAssistant.content)) {
    return progress.userStatedProblem ? "discuss_problem" : "discuss_problem";
  }

  return "discuss_problem";
}

export function paidPhaseInstruction(phase: PaidConsultationPhase): string {
  switch (phase) {
    case "discuss_problem":
      return `
━━━ अभी: समस्या पर बात (जीवन की भाषा) ━━━
- User जो कह रहा है (धर्म, नौकरी, शादी...) — उसे सुनकर समझाओ कैसा महसूस होता है, क्या हो रहा है
- Chat में पहले से जो बातें हैं — उन्हें याद रखो, दोबारा data मत माँगो
- इस मैसेज में ग्रह/नक्षत्र/दशा/भाव/कुंडली — बिल्कुल नहीं
- उपाय भी नहीं — सिर्फ इंसानी, सहानुभूतिपूर्ण बात
- "दो लाइन में", "स्पष्ट बताएं", "कुंडली देखकर" — मना`;

    case "explain_astro_cause":
      return `
━━━ अभी: क्यों हो रहा है (ज्योतिषीय कारण) ━━━
- समस्या पहले हो चुकी — अब कुंडली से बताओ क्यों रुकावट है
- ग्रह, दशा, भाव — साधारण खड़ी बोली, एक-दो बिंदु
- उपाय/निवारण इस मैसेज में नहीं
- समस्या या जन्म विवरण दोबारा मत पढ़ाओ`;

    case "give_remedy":
      return `
━━━ अभी: निवारण / उपाय ━━━
- 1-2 सरल उपाय — पूजा, मंत्र, दान, व्रत
- कारण का लंबा lecture मत — अधिकतम एक पंक्ति
- HR/resume/apply advice मत`;

    case "follow_up":
      return `
━━━ अभी: उनके सवाल का सीधा जवाब ━━━
- सिर्फ जो अभी पूछा — समय, शक, और detail
- पूरा टेम्पलेट, सारे ग्रह, सारे उपाय — दोहराओ मत
- 2-4 पंक्तियाँ, natural`;

    case "reassure_and_answer":
      return `
━━━ User नाराज/शक में है — शांत, इंसानी जवाब ━━━
- छोटी सहानुभूति — "समझता हूँ" ठीक है, lecture नहीं
- कहो: आपकी जन्म कुंडली chat में है, देख चुके हैं — दोबारा विवरण मत माँगो
- उनकी असली समस्या (chat से) पर वापस लाओ — अगला logical कदम: समस्या/कारण/उपाय में से जो बाकी हो
- Defensive mat bolo, "दो लाइन में" mat bolo, ग्रह तभी जब उस चरण की बारी हो`;
  }
}
