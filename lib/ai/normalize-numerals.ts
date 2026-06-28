/** Convert Devanagari digits (०–९) to Arabic (0–9) for natural WhatsApp Hindi. */
const DEVANAGARI_DIGITS = "०१२३४५६७८९";

export function normalizeReplyNumerals(text: string): string {
  return text.replace(/[०-९]/g, (digit) => {
    const index = DEVANAGARI_DIGITS.indexOf(digit);
    return index >= 0 ? String(index) : digit;
  });
}

export const ARABIC_NUMERALS_RULE = `NUMBERS: Always use Arabic/Western digits (0-9) — e.g. 151, 15, 24, 1991. Never Devanagari numerals (१५१, १५, २४). Dates, times, prices, minutes — all in 0-9.`;
