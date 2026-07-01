import { DATE_PATTERN } from "./detect-birth-details";

const EN_MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const HI_MONTHS: Record<string, number> = {
  जनवरी: 0,
  फरवरी: 1,
  मार्च: 2,
  अप्रैल: 3,
  मई: 4,
  जून: 5,
  जुलाई: 6,
  अगस्त: 7,
  सितंबर: 8,
  अक्टूबर: 9,
  नवंबर: 10,
  दिसंबर: 11,
};

export type BirthProfile = {
  dobLabel?: string;
  ageYears?: number;
  lifeStageLabel: string;
  readingHint: string;
};

function parseSlashDate(
  day: number,
  month: number,
  yearRaw: number,
): Date | null {
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1) return null;
  return date;
}

function parseBirthDateFromText(text: string): Date | null {
  const slash = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (slash) {
    return parseSlashDate(
      Number(slash[1]),
      Number(slash[2]),
      Number(slash[3]),
    );
  }

  const named = text.match(
    /(\d{1,2})\s+([a-zA-Z\u0900-\u097F]+)\s+(\d{4})/i,
  );
  if (named) {
    const day = Number(named[1]);
    const token = named[2].toLowerCase();
    const year = Number(named[3]);
    const month =
      EN_MONTHS[token] ??
      EN_MONTHS[token.slice(0, 3)] ??
      HI_MONTHS[named[2]];
    if (month !== undefined) {
      return parseSlashDate(day, month + 1, year);
    }
  }

  return null;
}

export function extractBirthDateFromHistory(
  messages: { role: string; content: string }[],
): Date | null {
  const userTexts = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);

  for (const text of userTexts) {
    if (text.startsWith("[फोटो")) continue;
    const date = parseBirthDateFromText(text);
    if (date) return date;
  }

  for (const text of userTexts) {
    if (DATE_PATTERN.test(text)) {
      const date = parseBirthDateFromText(text);
      if (date) return date;
    }
  }

  return null;
}

function computeAgeYears(birth: Date, now = new Date()): number {
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function getLifeStageReadingHint(age: number): {
  lifeStageLabel: string;
  readingHint: string;
} {
  if (age < 0 || age > 110) {
    return {
      lifeStageLabel: "अज्ञात उम्र",
      readingHint:
        "उम्र स्पष्ट नहीं — फिर भी सामान्य जीवन दबाव बताएं: मन बेचैन, मेहनत का फल न मिलना, रिश्तों में तनाव।",
    };
  }

  if (age <= 12) {
    return {
      lifeStageLabel: "बचपन / किशोरावस्था",
      readingHint:
        "इस उम्र के लिए: पढ़ाई का दबाव, माता-पिता की अपेक्षाएँ, डर या झुकाव, आत्मविश्वास की कमी — बच्चे/किशोर को लगता है कोई समझ नहीं रहा।",
    };
  }

  if (age <= 22) {
    return {
      lifeStageLabel: "युवा / शिक्षा-करियर शुरुआत",
      readingHint:
        "इस उम्र के लिए: पढ़ाई या नौकरी की दिशा साफ नहीं, माता-पिता से टकराव, पहला प्रेम या रिश्ते की उलझन, भविष्य को लेकर रातों की चिंता।",
    };
  }

  if (age <= 30) {
    return {
      lifeStageLabel: "शुरुआती करियर / शादी की उम्र",
      readingHint:
        "इस उम्र के लिए: नौकरी अस्थिर या सैलरी कम, शादी में देरी या दबाव, पैसा जुटता है पर टिकता नहीं, घर-परिवार की उम्मीदें भारी लगती हैं।",
    };
  }

  if (age <= 40) {
    return {
      lifeStageLabel: "परिवार और करियर का दबाव",
      readingHint:
        "इस उम्र के लिए: घर-कारोबार दोनों की जिम्मेदारी, बच्चों की चिंता, कर्ज या खर्च बढ़ता है, पति-पत्नी या ससुराल में तनाव, मेहनत के बावजूद राह बंद।",
    };
  }

  if (age <= 55) {
    return {
      lifeStageLabel: "मध्यम आयु",
      readingHint:
        "इस उम्र के लिए: स्वास्थ्य की चिंता बढ़ती है, बच्चों की शादी-नौकरी, बचत नहीं बन पाती, अपने सपने पीछे छूट गए, मन में खालीपन या बेबसी।",
    };
  }

  return {
    lifeStageLabel: "वरिष्ठ आयु",
    readingHint:
      "इस उम्र के लिए: स्वास्थ्य और अकेलापन, बच्चों से दूरी या चिंता, पैसे की टेंशन, पुराने रिश्तों का बोझ, मन को शांति नहीं मिलती।",
  };
}

export function buildBirthProfileFromHistory(
  messages: { role: string; content: string }[],
): BirthProfile {
  const birth = extractBirthDateFromHistory(messages);
  if (!birth) {
    return {
      lifeStageLabel: "जन्म तिथि अधूरी",
      readingHint:
        "जन्म तिथि साफ नहीं — फिर भी सामान्य समस्याएँ बताएं: मन अशांत, काम में रुकावट, घर में तनाव, पैसा नहीं टिकना।",
    };
  }

  const ageYears = computeAgeYears(birth);
  const { lifeStageLabel, readingHint } = getLifeStageReadingHint(ageYears);
  const dobLabel = birth.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return { dobLabel, ageYears, lifeStageLabel, readingHint };
}
