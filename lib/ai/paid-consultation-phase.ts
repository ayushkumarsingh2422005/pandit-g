export type PaidConsultationPhase =
  | "discuss_problem"
  | "explain_astro_cause"
  | "give_remedy"
  | "follow_up";

type HistoryEntry = { role: string; content: string };

const ASTRO_TERMS =
  /ग्रह|दशा|भाव|नक्षत्र|कुंडली|शनि|राहु|केतु|गुरु|शुक्र|मंगल|बुध|चंद्र|सूर्य|दृष्टि|महादशा|अंतर्दशा|योग|लग्न/;
const REMEDY =
  /दान|पूजा|मंत्र|जाप|व्रत|पाठ|उपाय|निवारण|तिल|सिंदूर|चालीसा|अर्चन|धूप|दीप|हवन|समाधान/;
const PAYMENT_ACK = /दक्षिणा प्राप्त/;
const NEW_CONCERN =
  /नौकरी|नौकर|शादी|विवाह|पैसा|धन|प्रेम|रिश्त|परिवार|स्वास्थ्य|पढ़ाई|करियर|व्यापार|बिज़नेस|job|marriage|money|career/i;

function lastAssistantMessage(history: HistoryEntry[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === "assistant") return history[i].content;
  }
  return "";
}

function userShortAck(userMessage: string): boolean {
  const trimmed = userMessage.trim();
  if (trimmed.length > 50) return false;
  return /^(a+a?ch+h?a|ok|okay|ठीक|theek|हाँ|हां|samajh|समझ|haan|han|ji|जी)/i.test(
    trimmed,
  );
}

function userAsksRemedy(userMessage: string): boolean {
  return /उपाय|समाधान|निवारण|क्या करूँ|क्या करूं|kaise theek|upay|remedy|samadhan|ilaj|उपचार|theek kaise|rasta|रास्ता|कैसे दूर/i.test(
    userMessage,
  );
}

/**
 * Paid session reply shape — client flow:
 * 1. Problem (plain life talk, no graha)
 * 2. Astro cause (why — graha/nakshatra)
 * 3. Remedy (nivaran/upay)
 * 4. Follow-up on their question
 */
export function detectPaidConsultationPhase(
  history: HistoryEntry[],
  userMessage: string,
): PaidConsultationPhase {
  const lastAssistant = lastAssistantMessage(history);
  const trimmed = userMessage.trim();
  const hadAstro = ASTRO_TERMS.test(lastAssistant);
  const hadRemedy = REMEDY.test(lastAssistant);
  const asksRemedy = userAsksRemedy(trimmed);

  if (hadRemedy) {
    if (NEW_CONCERN.test(trimmed) && !userShortAck(trimmed) && !asksRemedy) {
      return "discuss_problem";
    }
    return "follow_up";
  }

  if (asksRemedy) {
    return hadAstro ? "give_remedy" : "explain_astro_cause";
  }

  if (hadAstro) {
    return userShortAck(trimmed) ? "give_remedy" : "follow_up";
  }

  if (PAYMENT_ACK.test(lastAssistant)) {
    return "discuss_problem";
  }

  if (!hadAstro && lastAssistant.length > 0) {
    return "explain_astro_cause";
  }

  return "discuss_problem";
}

export function paidPhaseInstruction(phase: PaidConsultationPhase): string {
  switch (phase) {
    case "discuss_problem":
      return `
━━━ इस मैसेज का काम: सिर्फ समस्या (प्रॉब्लम) ━━━
- User ने जो परेशानी बताई (नौकरी, शादी, पैसा...) — उसी पर बात करो: कैसा लगता है, क्या हो रहा है, दिल पर क्या बोझ है
- सहानुभूति, 3-5 पंक्तियाँ — जैसे पंडित सुनकर समझा रहा हो
- इस मैसेज में ग्रह, नक्षत्र, दशा, कुंडली, शनि, राहु — कुछ भी मत लिखो
- उपाय/निवारण भी मत दो — सिर्फ समस्या की सीधी बात`;

    case "explain_astro_cause":
      return `
━━━ इस मैसेज का काम: क्यों हो रही है समस्या (ज्योतिषीय कारण) ━━━
- पिछली बात (समस्या) को लंबा दोहराओ मत — एक पंक्ति काफी
- अब बताओ कुंडली से क्यों रुकावट है — ग्रह, दशा, नक्षत्र, भाव (साधारण खड़ी बोली)
- इस मैसेज में उपाय/निवारण मत दो — न दान, न पूजा, न मंत्र
- अंत में छोटी लाइन चाहे: "इसीलिए राह अटकी है" — ज़बरदस्ती "समाधान बताऊँ?" मत`;

    case "give_remedy":
      return `
━━━ इस मैसेज का काम: निवारण / उपाय (समाधान) ━━━
- User ने समाधान माँगा या कारण समझ लिया — अब 1-2 सरल उपाय बताओ
- पूजा, मंत्र, दान, व्रत, पाठ — जैसा असली पंडित कहे
- पूरा कारण-विश्लेषण या समस्या दोबारा मत पढ़ाओ
- Resume, apply, interview जैसी worldly advice मत`;

    case "follow_up":
      return `
━━━ इस मैसेज का काम: उनके सवाल का सीधा जवाब ━━━
- सिर्फ जो अभी पूछा (समय, शक, और सवाल) — उसी पर जवाब
- पूरा टेम्पलेट दोहराओ मत: न सारी कुंडली, न सारे ग्रह, न सारे उपाय फिर से
- छोटा, मानवीय — 2-4 पंक्तियाँ`;
  }
}
