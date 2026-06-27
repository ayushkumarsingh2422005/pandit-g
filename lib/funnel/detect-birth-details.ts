const MONTH_NAMES =
  /(january|february|march|april|may|june|july|august|september|october|november|december|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)/i;

const DATE_PATTERN =
  /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+\w+\s+\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/;

const TIME_PATTERN =
  /\d{1,2}\s*:\s*\d{2}|(\d{1,2}\s*(am|pm|baje|बजे))|सुबह|शाम|दोपहर|dopahar|रात|मध्यरात्रि/i;

const PLACE_PATTERN =
  /(जन्म\s*स्थान|जन्मस्थान|place|city|गाँव|शहर|मुंबई|दिल्ली|बेंगलुरु|कोलकाता|चेन्नई|हैदराबाद|पुणे|जयपुर|लखनऊ|कानपुर|नागपुर|इंदौर|भोपाल|वाराणसी|पटना|अहमदाबाद|सूरत|लखनऊ|आगरा|मेरठ|varanasi|mumbai|delhi|bangalore|kolkata|chennai|hyderabad|pune|jaipur|lucknow|patna|ahmedabad)/i;

const BIRTH_KEYWORDS =
  /(जन्म\s*तिथि|जन्मतिथि|date\s*of\s*birth|\bdob\b|जन्म\s*का\s*समय|जन्म\s*समय|जन्म\s*स्थान|जन्म)/i;

/** True when the user shared enough birth info in text (photo handled separately). */
export function hasBirthDetailsInText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // "24 feb 2005" or year + month name
  const hasDate =
    DATE_PATTERN.test(trimmed) ||
    MONTH_NAMES.test(trimmed) ||
    /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}/i.test(
      trimmed,
    );
  const hasTime = TIME_PATTERN.test(trimmed);
  const hasPlace = PLACE_PATTERN.test(trimmed);
  const hasBirthKeyword = BIRTH_KEYWORDS.test(trimmed);

  if (hasDate && (hasTime || hasPlace)) return true;
  // "24 feb 2005, 12 baje dopahar, mirzapaur me paida hua" — date + time + place words
  if (hasDate && hasTime) return true;
  if (hasDate && /paida|पैदा|hua|हुआ|mirzapur|mirzapaur|मिर्जापुर/i.test(trimmed))
    return true;
  if (hasBirthKeyword && hasDate) return true;
  if (hasBirthKeyword && hasTime && hasPlace) return true;

  // Long structured message with multiple numbers (e.g. DOB + time + city in one line)
  const digitGroups = trimmed.match(/\d+/g) ?? [];
  if (hasBirthKeyword && digitGroups.length >= 3) return true;

  return false;
}

export function userProvidedDetails(
  text: string,
  hasImage: boolean,
): boolean {
  return hasImage || hasBirthDetailsInText(text);
}
