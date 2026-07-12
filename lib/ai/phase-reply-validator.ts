import type { PaidConsultationPhase } from "./paid-consultation-phase";

export const ASTRO_TERMS =
  /ग्रह|दशा|भाव|नक्षत्र|कुंडली|शनि|राहु|केतु|गुरु|शुक्र|मंगल|बुध|चंद्र|सूर्य|दृष्टि|महादशा|अंतर्दशा|योग|लग्न|navam|नवम|दसव|saptam|सप्तम|अष्टम|अष्टम/;
export const REMEDY_TERMS =
  /दान|पूजा|मंत्र|जाप|व्रत|पाठ|उपाय|निवारण|तिल|सिंदूर|चालीसा|समाधान|अर्चन|हवन|दीप|शनिवार को|मंगलवार को|गुरुवार को/;

export function replyViolatesPhase(
  phase: PaidConsultationPhase,
  reply: string,
): string | null {
  const hasAstro = ASTRO_TERMS.test(reply);
  const hasRemedy = REMEDY_TERMS.test(reply);

  switch (phase) {
    case "discuss_problem":
    case "reassure_and_answer":
      if (hasAstro) return "इस जवाब में ग्रह/दशा/भाव/कुंडली हटाओ — सिर्फ समस्या पर बात करो";
      if (hasRemedy) return "इस जवाब में उपाय हटाओ — सिर्फ समस्या पर बात करो";
      return null;

    case "explain_astro_cause":
      if (hasRemedy) return "इस जवाब में उपाय/निवारण हटाओ — सिर्फ कारण (ग्रह/दशा) बताओ";
      if (!hasAstro) return "कुंडली से कारण बताओ — कम से कम एक ग्रह/दशा/भाव का ज़िक्र";
      return null;

    case "give_remedy":
      if (!hasRemedy) return "1-2 उपाय/निवारण बताओ — पूजा, मंत्र, दान, व्रत";
      return null;

    case "follow_up":
      return null;
  }
}

export function buildPhaseRetryInstruction(violation: string): string {
  return `REWRITE — पिछला draft गलत चरण में था: ${violation}. सिर्फ इसी चरण का काम करो, 3-4 पंक्तियाँ, natural Hindi।`;
}
