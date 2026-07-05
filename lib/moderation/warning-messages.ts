/** First strike — polite warning, conversation continues. */
export const MODERATION_WARNING_FIRST =
  "🙏 कृपया शिष्ट और सही भाषा में बात करें। हम यहाँ आपकी जीवन की समस्याओं और ज्योतिष परामर्श के लिए हैं। ऐसा बर्ताव बार-बार होगा तो बातचीत बंद करनी पड़ सकती है।";

/** Second strike — final warning before block. */
export const MODERATION_WARNING_LAST =
  "⚠️ यह आपकी अंतिम चेतावनी है। कृपया आदरपूर्वक बात करें — अगली बार गलत बर्ताव पर यह संवाद स्थायी रूप से बंद कर दिया जाएगा।";

export function getModerationWarningForStrike(strikes: number): string | null {
  if (strikes === 1) return MODERATION_WARNING_FIRST;
  if (strikes === 2) return MODERATION_WARNING_LAST;
  return null;
}
