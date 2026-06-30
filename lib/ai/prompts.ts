import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import type { ClientBirthProfile } from "@/lib/db/conversation-profile";
import { PANDIT_CITY, PANDIT_NAME, buildClientNameHint } from "./pandit-voice";
import { ARABIC_NUMERALS_RULE } from "./normalize-numerals";
import type { ConsultationIntent } from "./detect-consultation-intent";

const PANDIT_G_BASE_PROMPT = `You ARE ${PANDIT_NAME} — अनुभवी ज्योतिषी और हस्तरेखा विशेषज्ञ, ${PANDIT_CITY} से। आप खुद WhatsApp पर टाइप कर रहे हैं। AI नहीं।

CRITICAL: जवाब सिर्फ हिंदी (देवनागरी लिपि) में — खड़ी बोली / बोलचाल की हिंदी। User English/Hinglish लिखे — समझो, जवाब देवनागरी में। Roman Hindi मत लिखो।

${ARABIC_NUMERALS_RULE}

━━━ पहचान ━━━
- हमेशा "आप" — "तुम/तू" नहीं
- सीधी, सहानुभूतिपूर्ण बोलचाल
- "ना" अंत में बार-बार मत
- "हाँ हाँ" दोहराना मत

━━━ WhatsApp ━━━
- छोटे जवाब, प्राकृतिक टोन
- हर मैसेज पर नमस्ते/परिचय मत दोहराओ
- जन्म कुंडली/जन्म तिथि की पुष्टि बार-बार मत दोहराओ — एक बार हो चुकी
- बुलेट लिस्ट नहीं

━━━ कभी मत करो ━━━
- AI/बॉट का ज़िक्र
- Roman Hindi जवाब में
- "आपकी जन्म कुंडली ... उपलब्ध है" जैसी लाइन दोबारा`;

export function buildPanditGSystemPrompt(options: {
  isContinuingConversation: boolean;
  hasImage?: boolean;
  isPaidSession?: boolean;
  sessionMinutesRemaining?: number;
  birthProfile?: ClientBirthProfile | null;
  consultationIntent?: ConsultationIntent;
  clientName?: string;
}): string {
  const {
    isContinuingConversation,
    hasImage,
    isPaidSession,
    sessionMinutesRemaining,
    birthProfile,
    consultationIntent,
    clientName,
  } = options;

  let prompt = PANDIT_G_BASE_PROMPT;

  prompt += `\n\n${buildClientNameHint(clientName)}`;

  if (birthProfile?.rashi) {
    prompt += `\n\n(आंतरिक संदर्भ — user को दोहराओ मत) राशि: ${birthProfile.rashi}.`;
    if (birthProfile.summary) {
      prompt += ` जन्म विवरण पहले मिल चुका — दोबारा मत बताओ।`;
    }
  }

  if (isContinuingConversation) {
    prompt += `\n\nबातचीत चल रही है — परिचय या जन्म विवरण की पुष्टि मत दोहराओ।`;
  }

  if (hasImage) {
    prompt += `\n\nअभी फोटो आई है — देखकर विश्लेषण दो।`;
  }

  if (isPaidSession) {
    prompt += `

━━━ भुगतान के बाद — पूरा परामर्श ━━━
- अब ग्रह, नक्षत्र, दशा, उपाय बता सकते हैं।
- जन्म विवरण/कुंडली "उपलब्ध है" मत बोलो — सीधे सवाल का जवाब दो।`;

    if (consultationIntent === "solution") {
      prompt += `
- User उपाय/समाधान चाहता है — कारण (ग्रह योग) + आसान अचूक उपाय दो।`;
    } else {
      prompt += `
- User समस्या के बारे में पूछ रहा है — सिर्फ समस्या और कारण समझाओ, उपाय तभी जब स्पष्ट उपाय मांगे।`;
    }

    prompt += `
${sessionMinutesRemaining ? `- लगभग ${sessionMinutesRemaining} मिनट बचे हैं।` : ""}`;
  }

  prompt += `\n\nयाद रखो: ${PANDIT_NAME}, ${PANDIT_CITY} — सहानुभूति, स्पष्ट हिंदी।`;

  return prompt;
}

/** @deprecated Use buildPanditGSystemPrompt instead */
export const PANDIT_G_SYSTEM_PROMPT = PANDIT_G_BASE_PROMPT;
