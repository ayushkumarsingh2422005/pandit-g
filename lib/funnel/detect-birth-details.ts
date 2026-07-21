const MONTH_NUMBER: Record<string, number> = {
  jan: 1,
  january: 1,
  जनवरी: 1,
  feb: 2,
  february: 2,
  फरवरी: 2,
  mar: 3,
  march: 3,
  मार्च: 3,
  apr: 4,
  april: 4,
  अप्रैल: 4,
  may: 5,
  मई: 5,
  jun: 6,
  june: 6,
  जून: 6,
  jul: 7,
  july: 7,
  जुलाई: 7,
  aug: 8,
  august: 8,
  अगस्त: 8,
  sep: 9,
  sept: 9,
  september: 9,
  सितंबर: 9,
  सितम्बर: 9,
  oct: 10,
  october: 10,
  अक्टूबर: 10,
  nov: 11,
  november: 11,
  नवंबर: 11,
  नवम्बर: 11,
  dec: 12,
  december: 12,
  दिसंबर: 12,
  दिसम्बर: 12,
};

const MONTH_TOKEN = Object.keys(MONTH_NUMBER)
  .sort((a, b) => b.length - a.length)
  .join("|");

/**
 * Broad matcher used only to remove a date before place inference.
 * Actual date detection/parsing always uses parseBirthDateFromText.
 */
export const DATE_PATTERN =
  /(?:\d{4}\s*[\/\-.:]\s*\d{1,2}\s*[\/\-.:]\s*\d{1,2}|\d{1,2}\s*[\/\-.:]\s*\d{1,2}\s*[\/\-.:]\s*\d{2,4}|\d{1,2}\s+\d{1,2}\s+\d{2,4}|\d{6,8})/;

const TIME_PATTERN =
  /(?:[01]?\d|2[0-3])\s*[:.]\s*[0-5]\d|\d{1,2}\s*(am|pm|baje|बजे|vahe|vaje|baje|baj)|सुबह|शाम|दोपहर|doapar|doaphar|dopahar|dopehar|dopeher|noon|dopahar|रात|मध्यरात्रि|subah|shaam|morning|evening|afternoon/i;

const PLACE_PATTERN =
  /(जन्म\s*स्थान|जन्मस्थान|place|city|गाँव|शहर|मुंबई|दिल्ली|बेंगलुरु|कोलकाता|चेन्नई|हैदराबाद|पुणे|जयपुर|लखनऊ|कानपुर|नागपुर|इंदौर|भोपाल|वाराणसी|वारानसी|पटना|अहमदाबाद|सूरत|आगरा|मेरठ|भिलाई|रायपुर|varanasi|varansi|banaras|kashi|mirzapur|mumbai|delhi|bangalore|kolkata|chennai|hyderabad|pune|jaipur|lucknow|patna|ahmedabad|bhilai|raipur)/i;

const BIRTH_KEYWORDS =
  /(जन्म\s*तिथि|जन्मतिथि|date\s*of\s*birth|\bdob\b|जन्म\s*का\s*समय|जन्म\s*समय|जन्म\s*स्थान|जन्म)/i;

const PLACE_SKIP_WORDS =
  /^(am|pm|baje|बजे|vahe|vaje|baj|doapar|doaphar|dopahar|dopehar|subah|shaam|सुबह|शाम|दोपहर|रात|hello|hi|hey|namaste|नमस्ते|naukri|नौकरी|job|aap|आप|mera|मेरा|me|में|hai|है|the|and|for)$/i;

/** Normalize common Hinglish typos before parsing birth details. */
function normalizeBirthText(text: string): string {
  const latinDigits = text.replace(/[०-९]/g, (digit) =>
    String("०१२३४५६७८९".indexOf(digit)),
  );

  return latinDigits
    .replace(/\bvahe\b/gi, "baje")
    .replace(/\bvaje\b/gi, "baje")
    .replace(/\bdoapar\b/gi, "dopahar")
    .replace(/\bdoaphar\b/gi, "dopahar")
    .replace(/\bdopehar\b/gi, "dopahar")
    .replace(/\bvaransi\b/gi, "varanasi")
    .replace(/\bbanaras\b/gi, "varanasi");
}

function normalizedYear(raw: number): number {
  if (raw >= 1000) return raw;
  const currentYear = new Date().getFullYear();
  const currentTwoDigits = currentYear % 100;
  return raw <= currentTwoDigits ? 2000 + raw : 1900 + raw;
}

function validDate(day: number, month: number, rawYear: number): Date | null {
  const year = normalizedYear(rawYear);
  if (
    year < 1900 ||
    year > new Date().getFullYear() ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function namedMonth(token: string): number | undefined {
  const normalized = token.toLowerCase();
  return MONTH_NUMBER[normalized] ?? MONTH_NUMBER[normalized.slice(0, 3)];
}

/**
 * Accept common Indian DOB input without requiring one fixed format:
 * DD-MM-YYYY, YYYY-MM-DD, DD MM YYYY, DDMMYYYY,
 * 26 August 1984, August 26 1984, and Hindi digits/month names.
 */
export function parseBirthDateFromText(input: string): Date | null {
  const text = normalizeBirthText(input.trim());
  if (!text || text.startsWith("[फोटो")) return null;

  const yearFirst = text.match(
    /(?:^|[^\d])((?:19|20)\d{2})\s*[\/\-.:]\s*(\d{1,2})\s*[\/\-.:]\s*(\d{1,2})(?:[^\d]|$)/,
  );
  if (yearFirst) {
    const parsed = validDate(
      Number(yearFirst[3]),
      Number(yearFirst[2]),
      Number(yearFirst[1]),
    );
    if (parsed) return parsed;
  }

  const dayFirst = text.match(
    /(?:^|[^\d])(\d{1,2})\s*(?:[\/\-.:]|\s)\s*(\d{1,2})\s*(?:[\/\-.:]|\s)\s*(\d{2,4})(?:[^\d]|$)/,
  );
  if (dayFirst) {
    const parsed = validDate(
      Number(dayFirst[1]),
      Number(dayFirst[2]),
      Number(dayFirst[3]),
    );
    if (parsed) return parsed;
  }

  const dayNamed = text.match(
    new RegExp(
      `(?:^|[^\\d])(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s*)?(${MONTH_TOKEN})[,]?\\s*(\\d{2,4})(?:[^\\d]|$)`,
      "i",
    ),
  );
  if (dayNamed) {
    const month = namedMonth(dayNamed[2]);
    if (month) {
      const parsed = validDate(
        Number(dayNamed[1]),
        month,
        Number(dayNamed[3]),
      );
      if (parsed) return parsed;
    }
  }

  const monthNamed = text.match(
    new RegExp(
      `(?:^|[^\\p{L}])(${MONTH_TOKEN})\\s*(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s*(\\d{2,4})(?:[^\\d]|$)`,
      "iu",
    ),
  );
  if (monthNamed) {
    const month = namedMonth(monthNamed[1]);
    if (month) {
      const parsed = validDate(
        Number(monthNamed[2]),
        month,
        Number(monthNamed[3]),
      );
      if (parsed) return parsed;
    }
  }

  const compact = text.match(/(?:^|[^\d])(\d{6}|\d{8})(?:[^\d]|$)/);
  if (compact) {
    const digits = compact[1];
    if (digits.length === 8 && /^(?:19|20)/.test(digits)) {
      const parsed = validDate(
        Number(digits.slice(6, 8)),
        Number(digits.slice(4, 6)),
        Number(digits.slice(0, 4)),
      );
      if (parsed) return parsed;
    }

    const yearLength = digits.length === 8 ? 4 : 2;
    const parsed = validDate(
      Number(digits.slice(0, 2)),
      Number(digits.slice(2, 4)),
      Number(digits.slice(4, 4 + yearLength)),
    );
    if (parsed) return parsed;
  }

  return null;
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

  const hasDate = parseBirthDateFromText(trimmed) !== null;
  // A colon-formatted DOB such as 12:02:1996 must not also count as birth time.
  const textWithoutDate = trimmed.replace(DATE_PATTERN, " ");
  const hasTime = TIME_PATTERN.test(textWithoutDate);
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
  void _hasImage;
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
  void _hasImage;
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
