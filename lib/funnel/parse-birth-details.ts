const MONTH_MAP: Record<string, number> = {
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
  september: 9,
  सितंबर: 9,
  oct: 10,
  october: 10,
  अक्टूबर: 10,
  nov: 11,
  november: 11,
  नवंबर: 11,
  dec: 12,
  december: 12,
  दिसंबर: 12,
};

export type ParsedBirthDetails = {
  dob?: Date;
  dobLabel?: string;
  timeLabel?: string;
  place?: string;
  summary?: string;
};

function parseMonthToken(token: string): number | undefined {
  const key = token.toLowerCase().replace(/[^\w\u0900-\u097F]/g, "");
  return MONTH_MAP[key] ?? MONTH_MAP[key.slice(0, 3)];
}

export function parseBirthDetailsFromText(text: string): ParsedBirthDetails {
  const trimmed = text.trim();
  if (!trimmed) return {};

  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;
  let timeLabel: string | undefined;
  let place: string | undefined;

  const dmySlash = trimmed.match(
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,
  );
  if (dmySlash) {
    day = Number(dmySlash[1]);
    month = Number(dmySlash[2]);
    year = Number(dmySlash[3]);
    if (year < 100) year += year > 30 ? 1900 : 2000;
  }

  const dmyName = trimmed.match(/(\d{1,2})\s+([a-zA-Z\u0900-\u097F]+)\s+(\d{4})/i);
  if (dmyName) {
    day = Number(dmyName[1]);
    month = parseMonthToken(dmyName[2]);
    year = Number(dmyName[3]);
  }

  const timeMatch = trimmed.match(
    /(\d{1,2}\s*:\s*\d{2}|\d{1,2}\s*[\.:]\s*\d{2}|\d{1,2}\s*(?:baje|बजे)(?:\s*दोपहर|\s*dopahar|\s*सुबह|\s*शाम|\s*रात)?|सुबह\s*\d{1,2}\s*[\.:]?\s*\d{0,2}|दोपहर|शाम|रात)/i,
  );
  if (timeMatch) timeLabel = timeMatch[0].trim();

  const placeMatch = trimmed.match(
    /(?:mein|में|स्थान|place|city)\s+([a-zA-Z\u0900-\u097F]{3,})/i,
  );
  if (placeMatch) {
    place = placeMatch[1].trim();
  } else {
    const cityTokens =
      trimmed.match(
        /(भिलाई|मुंबई|दिल्ली|लखनऊ|वाराणसी|मिर्जापुर|भोपाल|इंदौर|पुणे|जयपुर|bhilai|mumbai|delhi|lucknow|varanasi|mirzapur)/i,
      );
    if (cityTokens) place = cityTokens[1];
  }

  if (!day || !month || !year) {
    return { timeLabel, place };
  }

  const dob = new Date(year, month - 1, day);
  const dobLabel = `${day}-${String(month).padStart(2, "0")}-${year}`;

  const parts = [`जन्म तिथि ${dobLabel}`];
  if (timeLabel) parts.push(timeLabel);
  if (place) parts.push(`स्थान ${place}`);

  return {
    dob,
    dobLabel,
    timeLabel,
    place,
    summary: parts.join(", "),
  };
}
