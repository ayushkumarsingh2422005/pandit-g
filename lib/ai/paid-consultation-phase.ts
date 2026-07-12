import {
  getConsultationProgress,
  userIsFrustratedWithBot,
  type ConsultationProgress,
} from "./consultation-context";

export type PaidConsultationPhase =
  | "discuss_problem"
  | "explain_astro_cause"
  | "give_remedy"
  | "follow_up"
  | "reassure_and_answer";

type HistoryEntry = { role: string; content: string };

const PAYMENT_ACK = /दक्षिणा प्राप्त/;
const PAYMENT_OFFER = /rzp\.io|₹\s*\d+/;

export type PaidAssistantTurn =
  | "payment_ack"
  | "problem"
  | "cause"
  | "remedy"
  | "other";

function classifyAssistantTurn(content: string): PaidAssistantTurn {
  if (PAYMENT_ACK.test(content)) return "payment_ack";
  if (PAYMENT_OFFER.test(content)) return "other";
  if (
    /दान|पूजा|मंत्र|जाप|व्रत|पाठ|उपाय|निवारण|तिल|सिंदूर|चालीसा|समाधान/.test(
      content,
    )
  ) {
    return "remedy";
  }
  if (
    /ग्रह|दशा|भाव|नक्षत्र|कुंडली|शनि|राहु|केतु|गुरु|शुक्र|मंगल|बुध|चंद्र|सूर्य|दृष्टि|महादशा|लग्न/.test(
      content,
    )
  ) {
    return "cause";
  }
  return "problem";
}

function lastPaidAssistantTurn(
  history: HistoryEntry[],
): PaidAssistantTurn | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (msg?.role !== "assistant") continue;

    if (PAYMENT_ACK.test(msg.content)) return "payment_ack";
    if (PAYMENT_OFFER.test(msg.content)) continue;

    return classifyAssistantTurn(msg.content);
  }

  return null;
}

function userShortAck(userMessage: string): boolean {
  const trimmed = userMessage.trim();
  if (trimmed.length > 50) return false;
  return /^(a+a?ch+h?a|ok|okay|ठीक|theek|हाँ|हां|samajh|समझ|haan|han|ji|जी|batao|बताओ|aage|आगे|continue)/i.test(
    trimmed,
  );
}

function userAsksRemedy(userMessage: string): boolean {
  return /उपाय|समाधान|निवारण|क्या करूँ|क्या करूं|kaise theek|upay|remedy|samadhan|ilaj|उपचार|theek kaise|कैसे ठीक|ठीक कैसे/i.test(
    userMessage,
  );
}

function isNewConcern(userMessage: string): boolean {
  return /नौकरी|शादी|पैसा|धन|प्रेम|धर्म|धार्मिक|स्वास्थ्य|करियर|विवाह|परिवार|job|marriage|money|career|religious|समस्या|problem/i.test(
    userMessage,
  );
}

/**
 * Client flow — one step per reply, never pack graha + upay together:
 * payment → problem (plain) → cause (graha) → remedy (upay) → follow-up
 *
 * Free reading (pre-payment) already describes problems → after payment skip to cause.
 */
export function detectPaidConsultationPhase(
  history: HistoryEntry[],
  userMessage: string,
): PaidConsultationPhase {
  const trimmed = userMessage.trim();
  const progress = getConsultationProgress(history, userMessage);

  if (userIsFrustratedWithBot(trimmed)) {
    return "reassure_and_answer";
  }

  const lastTurn = lastPaidAssistantTurn(history);

  if (lastTurn === "remedy") {
    if (isNewConcern(trimmed) && !userShortAck(trimmed)) {
      return progress.freeReadingDone
        ? "explain_astro_cause"
        : "discuss_problem";
    }
    return "follow_up";
  }

  if (lastTurn === "cause") {
    return "give_remedy";
  }

  if (lastTurn === "problem") {
    return "explain_astro_cause";
  }

  if (lastTurn === "payment_ack") {
    if (progress.freeReadingDone) {
      if (isNewConcern(trimmed) && trimmed.length > 15) {
        return "discuss_problem";
      }
      return "explain_astro_cause";
    }
    return "discuss_problem";
  }

  if (userAsksRemedy(trimmed)) {
    if (!progress.paidCauseReplyDone && !progress.freeReadingDone) {
      return "discuss_problem";
    }
    if (!progress.paidCauseReplyDone) {
      return "explain_astro_cause";
    }
    return "give_remedy";
  }

  return progress.freeReadingDone ? "explain_astro_cause" : "discuss_problem";
}

export function paidPhaseInstruction(phase: PaidConsultationPhase): string {
  switch (phase) {
    case "discuss_problem":
      return `
━━━ चरण 1 / 3 — सिर्फ समस्या (आज की बातचीत का यही काम) ━━━
- User की परेशानी सुनो — दिल पर क्या बोझ है, क्या हो रहा है
- सहानुभूति, 3-4 पंक्तियाँ — जैसे पंडित बैठकर सुन रहा हो
- इस ONE message में: ग्रह, नक्षत्र, दशा, भाव, कुंडली — बिल्कुल नहीं
- इस ONE message में: उपाय, दान, पूजा, मंत्र — बिल्कुल नहीं
- अगला चरण (ग्रह/कारण) अगली बार — अभी नहीं`;

    case "explain_astro_cause":
      return `
━━━ चरण 2 / 3 — सिर्फ कारण (क्यों हो रहा है) ━━━
- अब बताओ: किस ग्रह / दशा / भाव से यह समस्या उत्पन्न हुई, गृह में क्या उलट-पुलट है
- साधारण खड़ी बोली — 1-2 ज्योतिष बिंदु
- इस ONE message में: उपाय, निवारण, दान, पूजा, मंत्र — बिल्कुल नहीं
- समस्या की लंबी दोहराई मत — अधिकतम एक पंक्ति`;

    case "give_remedy":
      return `
━━━ चरण 3 / 3 — सिर्फ निवारण / उपाय ━━━
- अब बताओ: इन ग्रहों को / समस्या को कैसे ठीक किया जाए
- 1-2 सरल उपाय — पूजा, मंत्र जाप, दान, व्रत, विशेष दिन
- कारण का lecture मत — अधिकतम एक छोटी पंक्ति
- HR/resume/apply advice मत`;

    case "follow_up":
      return `
━━━ चरण 4 — उनके सवाल का छोटा जवाब ━━━
- सिर्फ जो अभी पूछा
- पूरा कुंडली lecture या सारे उपाय दोबारा मत
- 2-3 पंक्तियाँ`;

    case "reassure_and_answer":
      return `
━━━ User नाराज है — शांत रहो, आगे बढ़ो ━━━
- छोटी सहानुभूति, lecture नहीं
- जन्म विवरण chat में है — दोबारा मत माँगो
- अगला सही चरण: समस्या / कारण / उपाय — जो बाकी हो, एक चरण only`;
  }
}

export function formatProgressForPrompt(progress: ConsultationProgress): string {
  return `अगla ज़रूरी चरण: ${
    !progress.problemsFullyDescribed
      ? "1 — समस्या (बिना ग्रह)"
      : !progress.paidCauseReplyDone
        ? "2 — कारण (ग्रह/दशा, बिना उपाय)"
        : !progress.paidRemedyReplyDone
          ? "3 — उपाय/निवारण"
          : "4 — follow-up"
  }`;
}
