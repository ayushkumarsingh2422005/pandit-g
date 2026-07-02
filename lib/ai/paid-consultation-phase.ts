export type PaidConsultationPhase =
  | "explain_cause"
  | "give_remedy"
  | "follow_up";

type HistoryEntry = { role: string; content: string };

const ASTRO_CAUSE =
  /ग्रह|दशा|भाव|नक्षत्र|कुंडली|शनि|राहु|केतु|गुरु|शुक्र|मंगल|बुध|चंद्र|सूर्य|दृष्टि|महादशा|अंतर्दशा|योग/;
const REMEDY =
  /दान|पूजा|मंत्र|जाप|व्रत|पाठ|उपाय|तिल|सिंदूर|चालीसा|अर्चन|धूप|दीप|हवन/;
const PAYMENT_ACK = /दक्षिणा प्राप्त/;
const NEW_CONCERN =
  /नौकरी|नौकर|शादी|विवाह|पैसा|धन|प्रेम|रिश्त|परिवार|स्वास्थ्य|पढ़ाई|करियर|व्यापार|बिज़नेस|job|marriage|money|career/i;

function lastAssistantMessage(history: HistoryEntry[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === "assistant") return history[i].content;
  }
  return "";
}

function userEngagedAfterCause(userMessage: string): boolean {
  const trimmed = userMessage.trim();
  if (trimmed.length <= 45) {
    return /^(a+a?ch+h?a|ok|okay|ठीक|theek|हाँ|हां|samajh|समझ|haan|han)/i.test(
      trimmed,
    );
  }
  return /उपाय|समाधान|क्या कर|कैसे|kaise|upay|remedy|batao|बताओ|करूँ|करूं|theek kaise/i.test(
    trimmed,
  );
}

/** Decide paid-session reply shape: cause first, remedy later — not one robotic blob. */
export function detectPaidConsultationPhase(
  history: HistoryEntry[],
  userMessage: string,
): PaidConsultationPhase {
  const lastAssistant = lastAssistantMessage(history);
  const lastHadCause = ASTRO_CAUSE.test(lastAssistant);
  const lastHadRemedy = REMEDY.test(lastAssistant);
  const trimmedUser = userMessage.trim();

  if (PAYMENT_ACK.test(lastAssistant)) {
    return "explain_cause";
  }

  if (lastHadCause && !lastHadRemedy) {
    return "give_remedy";
  }

  if (lastHadCause && lastHadRemedy) {
    if (NEW_CONCERN.test(trimmedUser) && !userEngagedAfterCause(trimmedUser)) {
      return "explain_cause";
    }
    return "follow_up";
  }

  if (userEngagedAfterCause(trimmedUser) && lastHadCause) {
    return "give_remedy";
  }

  return "explain_cause";
}

export function paidPhaseInstruction(phase: PaidConsultationPhase): string {
  switch (phase) {
    case "explain_cause":
      return `
━━━ इस मैसेज का काम: सिर्फ कारण (वजह) ━━━
- कुंडली से समझाओ क्यों यह समस्या आ रही है — ग्रह, दशा, भाव (साधारण भाषा)
- सहानुभूति रखो, 3-5 पंक्तियाँ
- इस मैसेज में कोई उपाय मत दो — न दान, न पूजा, न मंत्र, न "शनिवार को..."
- अंत में एक छोटी, प्राकृतिक लाइन: जैसे "इसीलिए राह नहीं मिल पा रही" या "समाधान भी है, बताऊँ?" — ज़बरदस्ती नहीं`;

    case "give_remedy":
      return `
━━━ इस मैसेज का काम: समाधान (उपाय) ━━━
- पिछले मैसेज में जो कारण बताया, उसे लंबा दोहराओ मत — एक पंक्ति याद दिलाना काफी
- 1-2 सरल, विश्वसनीय उपाय — जैसा असली पंडित कहे (पूजा, दान, मंत्र, व्रत)
- नया कारण-विश्लेषण शुरू मत करो — वो हो चुका`;

    case "follow_up":
      return `
━━━ इस मैसेज का काम: उनके सवाल का सीधा जवाब ━━━
- सिर्फ जो अभी पूछा (समय, डाउट, और सवाल) — उसी पर जवाब
- पूरा टेम्पलेट दोहराओ मत: न पूरी कुंडली, न सारे ग्रह, न सारे उपाय फिर से
- छोटा, मानवीय जवाब — 2-4 पंक्तियाँ`;
  }
}
