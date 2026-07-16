const PAYMENT_KEYWORDS =
  /(?:\b(pay|payment|paid|link|upi)\b|भुगतान|शुल्क|पेमेंट|पे\s*कर|पेमेन्ट|परामर्श\s*शुरू|सत्र\s*शुरू|consultation\s*start|लिंक\s*भेज|link\s*भेज|फिर\s*से\s*सत्र|नया\s*सत्र|ready\s*to\s*pay)/i;

const CLAIMED_PAYMENT_KEYWORDS =
  /(?:pay\s*kar|payment\s*kar|भुगतान\s*कर|पे\s*कर\s*दिया|भेज\s*दिया|कर\s*दिया|done\s*pay|paid\s*already)/i;

export function isPaymentIntent(text: string): boolean {
  return PAYMENT_KEYWORDS.test(text.trim());
}

export function userClaimsTheyPaid(text: string): boolean {
  return CLAIMED_PAYMENT_KEYWORDS.test(text.trim());
}
