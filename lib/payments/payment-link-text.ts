/** Shared helpers for payment URLs in chat text. */

const PAYMENT_URL_RE =
  /https?:\/\/(?:www\.)?(?:rzp\.io|razorpay\.com)\/\S*/gi;

export function containsPaymentUrl(text: string): boolean {
  return /rzp\.io|razorpay\.com\/(?:l\/|payment)/i.test(text);
}

export function stripPaymentUrls(text: string): string {
  return text
    .replace(PAYMENT_URL_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Keep history context but stop the model from copy-pasting old links. */
export function redactPaymentUrlsInHistory<
  T extends { role: string; content: string },
>(history: T[]): T[] {
  return history.map((entry) => {
    if (!containsPaymentUrl(entry.content)) return entry;
    return {
      ...entry,
      content: entry.content.replace(PAYMENT_URL_RE, "[पुराना भुगतान लिंक]"),
    };
  });
}

export function isSimpleGreeting(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 40) return false;
  return /^(hi+|hii+|hello|hey+|yo|namaste|namaskar|नमस्ते|नमस्कार|प्रणाम|हेलो|हाय|राम\s*राम|जय\s*श्री\s*राम|ok+|okay|जी+|haan|han|हां|हाँ)([\s,.!?]|$)/i.test(
    t,
  );
}

export function userIsQuestioningPaymentLink(text: string): boolean {
  return /link\s*kyu|kyu\s*link|क्यों.*लिंक|लिंक\s*क्यों|ye\s*kya\s*bhej|ये\s*क्या\s*भेज|kya\s*bhej|गलती|mat\s*bhej|मत\s*भेज|again.*link|फिर.*लिंक|to\s*link\s*kyu|लिंक\s*क्यूँ|pay\s*now\s*kyu|क्यों.*pay\s*now|बटन\s*क्यों/i.test(
    text,
  );
}

export function isShortRefusal(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized || normalized.length > 80) return false;

  return /^(?:nahi|nhi|nahin|no|नहीं|नही)(?:\s|$)|नहीं\s*(?:चाहिए|करनी|करना|होगा|है)|नही\s*(?:चाहिए|करनी|करना|होगा|है)|मत\s*(?:करो|भेजो)|मन\s*नहीं|mann?\s*nahi|don't\s*want/i.test(
    normalized,
  );
}
