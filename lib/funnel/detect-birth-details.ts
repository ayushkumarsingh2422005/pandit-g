const MONTH_NAMES =
  /(january|february|march|april|may|june|july|august|september|october|november|december|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)/i;

export const DATE_PATTERN =
  /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+\w+\s+\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|(?:^|[^\d])(?:0?[1-9]|[12]\d|3[01])(?:0?[1-9]|1[0-2])(?:19|20)\d{2}(?:[^\d]|$)/;

const TIME_PATTERN =
  /\d{1,2}\s*:\s*\d{2}|\d{1,2}\s*(am|pm|baje|बजे|vahe|vaje|baje|baj)|सुबह|शाम|दोपहर|doapar|doaphar|dopahar|dopehar|dopeher|noon|dopahar|रात|मध्यरात्रि|subah|shaam|morning|evening|afternoon/i;

const PLACE_PATTERN =
  /(जन्म\s*स्थान|जन्मस्थान|place|city|गाँव|शहर|मुंबई|दिल्ली|बेंगलुरु|कोलकाता|चेन्नई|हैदराबाद|पुणे|जयपुर|लखनऊ|कानपुर|नागपुर|इंदौर|भोपाल|वाराणसी|वारानसी|पटना|अहमदाबाद|सूरत|आगरा|मेरठ|भिलाई|रायपुर|varanasi|varansi|banaras|kashi|mirzapur|mumbai|delhi|bangalore|kolkata|chennai|hyderabad|pune|jaipur|lucknow|patna|ahmedabad|bhilai|raipur)/i;

const BIRTH_KEYWORDS =
  /(जन्म\s*तिथि|जन्मतिथि|date\s*of\s*birth|\bdob\b|जन्म\s*का\s*समय|जन्म\s*समय|जन्म\s*स्थान|जन्म)/i;

const PLACE_SKIP_WORDS =
  /^(am|pm|baje|बजे|vahe|vaje|baj|doapar|doaphar|dopahar|dopehar|subah|shaam|सुबह|शाम|दोपहर|रात|hello|hi|hey|namaste|नमस्ते|naukri|नौकरी|job|aap|आप|mera|मेरा|me|में|hai|है|the|and|for)$/i;

/** Normalize common Hinglish typos before parsing birth details. */
function normalizeBirthText(text: string): string {
  return text
    .replace(/\bvahe\b/gi, "baje")
    .replace(/\bvaje\b/gi, "baje")
    .replace(/\bdoapar\b/gi, "dopahar")
    .replace(/\bdoaphar\b/gi, "dopahar")
    .replace(/\bdopehar\b/gi, "dopahar")
    .replace(/\bvaransi\b/gi, "varanasi")
    .replace(/\bbanaras\b/gi, "varanasi");
}

export type BirthSignals = {
  hasDate: boolean;
  hasTime: boolean;
  hasPlace: boolean;
};

export function extractBirthSignals(text: string): BirthSignals {
  const trimmed = normalizeBirthText(text.trim());
  if (!trimmed || trimmed.startsWith("[फोटो")) {
    return { hasDate: false, hasTime: false, hasPlace: false };
  }

  const hasDate =
    DATE_PATTERN.test(trimmed) ||
    MONTH_NAMES.test(trimmed) ||
    /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}/i.test(
      trimmed,
    ) ||
    // Compact DOB like 27061995 / 270695
    /(?:^|[^\d])(\d{8}|\d{6})(?:[^\d]|$)/.test(trimmed);
  const hasTime = TIME_PATTERN.test(trimmed);
  const hasPlace = hasPlaceInText(trimmed);
  const hasBirthKeyword = BIRTH_KEYWORDS.test(trimmed);

  const completeInOne =
    (hasDate && (hasTime || hasPlace)) ||
    (hasDate && hasTime) ||
    (hasDate &&
      /paida|पैदा|hua|हुआ|mirzapur|mirzapaur|मिर्जापुर/i.test(trimmed)) ||
    (hasBirthKeyword && hasDate) ||
    (hasBirthKeyword && hasTime && hasPlace) ||
    (hasBirthKeyword && (trimmed.match(/\d+/g) ?? []).length >= 3);

  return {
    hasDate: hasDate || (completeInOne && hasBirthKeyword),
    hasTime: hasTime || (completeInOne && hasBirthKeyword),
    hasPlace: hasPlace || (completeInOne && hasBirthKeyword),
  };
}

function hasPlaceInText(trimmed: string): boolean {
  if (PLACE_PATTERN.test(trimmed)) return true;

  const stripped = trimmed
    .replace(DATE_PATTERN, " ")
    .replace(TIME_PATTERN, " ")
    .replace(/\d+/g, " ");

  const words = stripped.match(/[A-Za-z\u0900-\u097F]{3,}/g) ?? [];
  return words.some((word) => !PLACE_SKIP_WORDS.test(word));
}

/** True when the user shared enough birth info in one text message. */
export function hasBirthDetailsInText(text: string): boolean {
  const signals = extractBirthSignals(text);
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("[फोटो")) return false;

  if (signals.hasDate && signals.hasTime && signals.hasPlace) return true;
  if (signals.hasDate && signals.hasTime) return true;

  const hasBirthKeyword = BIRTH_KEYWORDS.test(trimmed);
  const digitGroups = trimmed.match(/\d+/g) ?? [];
  if (hasBirthKeyword && digitGroups.length >= 3) return true;
  if (hasBirthKeyword && signals.hasDate) return true;

  return false;
}

/** Birth details may arrive across several messages — combine from history. */
export function hasCompleteBirthDetailsInHistory(
  messages: { role: string; content: string }[],
  currentText = "",
  _hasImage = false,
): boolean {
  // Photos / palm images never complete birth details — only date, time, place.
  if (hasBirthDetailsInText(currentText)) return true;

  let hasDate = false;
  let hasTime = false;
  let hasPlace = false;

  const userTexts = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  if (currentText.trim()) userTexts.push(currentText);

  for (const text of userTexts) {
    const signals = extractBirthSignals(text);
    hasDate ||= signals.hasDate;
    hasTime ||= signals.hasTime;
    hasPlace ||= signals.hasPlace;
    if (hasBirthDetailsInText(text)) return true;
  }

  return hasDate && hasTime && hasPlace;
}

export function userProvidedDetails(
  text: string,
  _hasImage: boolean,
): boolean {
  return hasBirthDetailsInText(text);
}

/** What's still missing when details are partial across the chat. */
export function missingBirthFields(
  messages: { role: string; content: string }[],
  currentText = "",
  hasImage = false,
): string[] {
  if (hasCompleteBirthDetailsInHistory(messages, currentText, hasImage)) {
    return [];
  }

  let hasDate = false;
  let hasTime = false;
  let hasPlace = false;

  const userTexts = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  if (currentText.trim()) userTexts.push(currentText);

  for (const text of userTexts) {
    const signals = extractBirthSignals(text);
    hasDate ||= signals.hasDate;
    hasTime ||= signals.hasTime;
    hasPlace ||= signals.hasPlace;
  }

  const missing: string[] = [];
  if (!hasDate) missing.push("जन्म तिथि");
  if (!hasTime) missing.push("जन्म समय");
  if (!hasPlace) missing.push("जन्म स्थान");
  return missing;
}
