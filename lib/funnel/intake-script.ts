/**
 * Fixed Hindi onboarding script (pre-AI / pre-payment).
 * Steps advance only on user replies — no LLM for this phase.
 */

export type IntakeStep =
  | "awaiting_name"
  | "awaiting_problem"
  | "awaiting_duration"
  | "awaiting_prior_attempts"
  | "awaiting_birth_details"
  | "awaiting_question"
  | "awaiting_haan";

export type IntakeProfile = {
  clientName?: string;
  problem?: string;
  problemCode?: string;
  duration?: string;
  priorAttempts?: string;
  specialQuestion?: string;
};

export const PROBLEM_OPTIONS: { code: string; label: string }[] = [
  { code: "1", label: "विवाह में देरी" },
  { code: "2", label: "नौकरी / करियर" },
  { code: "3", label: "व्यवसाय में समस्या" },
  { code: "4", label: "आर्थिक / कर्ज की समस्या" },
  { code: "5", label: "प्रेम संबंध" },
  { code: "6", label: "स्वास्थ्य संबंधी चिंता" },
  { code: "7", label: "पारिवारिक तनाव" },
  { code: "8", label: "अन्य" },
];

const DIVIDER = "━━━━━━━━━━━━━━━";

export function welcomeMessage(): string {
  return [
    "🌿 🙏 नमस्ते एवं आपका हार्दिक स्वागत है।",
    "",
    "मैं आपका धन्यवाद करता हूँ कि आपने संपर्क किया।",
    "",
    "📝 कृपया सबसे पहले अपना पूरा नाम लिखकर भेजें।",
  ].join("\n");
}

export function askProblemMessage(name: string): string {
  const display = name.trim() || "आप";
  return [
    `😊 धन्यवाद ${display} जी।`,
    "",
    "अब कृपया बताइए कि आपकी सबसे बड़ी समस्या क्या है?",
    "",
    "1️⃣ 💍 विवाह में देरी",
    "2️⃣ 💼 नौकरी / करियर",
    "3️⃣ 📈 व्यवसाय में समस्या",
    "4️⃣ 💰 आर्थिक / कर्ज की समस्या",
    "5️⃣ ❤️ प्रेम संबंध",
    "6️⃣ 🏥 स्वास्थ्य संबंधी चिंता",
    "7️⃣ 🏡 पारिवारिक तनाव",
    "8️⃣ ✍️ अन्य",
    "",
    "📩 कृपया केवल नंबर या समस्या का नाम लिखकर भेजें।",
  ].join("\n");
}

export function askDurationMessage(): string {
  return [
    "🙏 धन्यवाद।",
    "",
    "📅 यह समस्या आपको कब से महसूस हो रही है?",
  ].join("\n");
}

export function askPriorAttemptsMessage(): string {
  return [
    "🤔 क्या आपने इसके लिए पहले कोई प्रयास किया है?",
    "",
    "यदि हाँ, तो कृपया संक्षेप में बताइए।",
  ].join("\n");
}

export function askBirthDetailsMessage(): string {
  return [
    "📋 अब कृपया यह जानकारी भेजें:",
    "",
    "🎂 जन्म तिथि:",
    "⏰ जन्म समय:",
    "📍 जन्म स्थान:",
  ].join("\n");
}

export function askMissingBirthFieldsMessage(missingLabels: string[]): string {
  const emoji: Record<string, string> = {
    "जन्म तिथि": "🎂",
    "जन्म समय": "⏰",
    "जन्म स्थान": "📍",
    date: "🎂 जन्म तिथि",
    time: "⏰ जन्म समय",
    place: "📍 जन्म स्थान",
  };

  const lines = missingLabels.map((label) => {
    if (label === "date") return "🎂 जन्म तिथि";
    if (label === "time") return "⏰ जन्म समय";
    if (label === "place") return "📍 जन्म स्थान";
    const prefix = emoji[label];
    if (prefix && prefix.length <= 2) return `${prefix} ${label}`;
    if (prefix?.includes(" ")) return prefix;
    return `• ${label}`;
  });

  return [
    "🙏 धन्यवाद। कुछ जानकारी अभी अधूरी है।",
    "",
    "कृपया ये भेजें:",
    ...lines,
  ].join("\n");
}

/** Confirmation + special question (one WhatsApp turn). */
export function confirmAndAskQuestionMessage(): string {
  return [
    "✅ धन्यवाद।",
    "",
    "आपकी जानकारी सफलतापूर्वक प्राप्त हो गई है।",
    "",
    "🔍 अब मैं आपके द्वारा दी गई जानकारी के आधार पर व्यक्तिगत अध्ययन करूँगा।",
    "",
    DIVIDER,
    "",
    "❓ क्या आपके मन में कोई विशेष प्रश्न है?",
    "",
    "उदाहरण:",
    "",
    "💼 करियर से जुड़ा प्रश्न",
    "💍 विवाह से जुड़ा प्रश्न",
    "💰 आर्थिक स्थिति",
    "🏠 परिवार",
    "❤️ प्रेम संबंध",
    "",
    "📩 अपना प्रश्न लिखकर भेजें।",
  ].join("\n");
}

/** Package + fee + ask हाँ (one WhatsApp turn). */
export function packageFeeAndAskHaanMessage(priceInrFormatted: string): string {
  return [
    "📝 धन्यवाद।",
    "",
    "आपके सभी प्रश्न नोट कर लिए गए हैं।",
    "",
    "मैं इन्हें व्यक्तिगत विश्लेषण में शामिल करूँगा।",
    "",
    DIVIDER,
    "",
    "📦 व्यक्तिगत परामर्श में आपको मिलेगा:",
    "",
    "✅ व्यक्तिगत कुंडली विश्लेषण",
    "✅ आपके प्रश्नों के उत्तर",
    "✅ लिखित मार्गदर्शन",
    "✅ आवश्यक होने पर फॉलो-अप प्रश्नों के उत्तर",
    "",
    DIVIDER,
    "",
    `💎 यदि आप यह व्यक्तिगत परामर्श प्राप्त करना चाहते हैं, तो इसकी परामर्श फीस ${priceInrFormatted} है।`,
    "",
    "💳 भुगतान प्राप्त होने के बाद आपका विश्लेषण तैयार करने की प्रक्रिया शुरू की जाएगी।",
    "",
    DIVIDER,
    "",
    '🙏 यदि आप तैयार हैं, तो कृपया "हाँ" लिखकर भेजें।',
    "",
    "मैं तुरंत भुगतान की प्रक्रिया शुरू कर दूँगा।",
  ].join("\n");
}

export function reAskHaanMessage(): string {
  return [
    '🙏 जब आप तैयार हों, कृपया "हाँ" लिखकर भेजें।',
    "",
    "इसके बाद मैं भुगतान की प्रक्रिया शुरू कर दूँगा।",
  ].join("\n");
}

export function reAskNameMessage(): string {
  return "📝 कृपया अपना पूरा नाम लिखकर भेजें।";
}

export function parseClientName(text: string): string | null {
  let cleaned = text
    .trim()
    .replace(/^\[फोटो\]\s*/u, "")
    .replace(/^मेरा\s*(पूरा\s*)?नाम\s*(है|:)?\s*/iu, "")
    .replace(/^मेरा\s*नाम\s*/iu, "")
    .replace(/^नाम\s*(है|:)?\s*/iu, "")
    .replace(/^i\s*am\s+/i, "")
    .replace(/^my\s*name\s*(is|:)?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  // Take first line only
  cleaned = cleaned.split(/\n/)[0]?.trim() ?? "";
  if (cleaned.length < 2 || cleaned.length > 60) return null;

  // Pure greetings / numbers are not names
  if (isLikelyGreetingOnly(cleaned)) return null;
  if (/^[\d०-९]+$/.test(cleaned)) return null;

  return cleaned;
}

export function isLikelyGreetingOnly(text: string): boolean {
  const t = text.trim();
  return /^(hi+|hello|hey|namaste|namaskar|नमस्ते|नमस्कार|प्रणाम|राधे\s*राधे|जय\s*श्री\s*राम|good\s*morning|good\s*evening|hii+|hlw|helo)[\s!.।]*$/iu.test(
    t,
  );
}

export function parseProblemChoice(text: string): {
  code: string;
  label: string;
} | null {
  const raw = text.trim();
  if (!raw) return null;

  // Digit 1–8 (Latin or Devanagari), optional emoji/punctuation
  const digitMatch = raw.match(/^[\s]*(?:option\s*)?([1-8१-८])(?:[\s).:\-_]|$)/iu);
  if (digitMatch) {
    const map: Record<string, string> = {
      "१": "1",
      "२": "2",
      "३": "3",
      "४": "4",
      "५": "5",
      "६": "6",
      "७": "7",
      "८": "8",
    };
    const code = map[digitMatch[1]] ?? digitMatch[1];
    const opt = PROBLEM_OPTIONS.find((o) => o.code === code);
    if (opt) return opt;
  }

  const lower = raw.toLowerCase();
  const byKeyword: { re: RegExp; code: string }[] = [
    { re: /विवाह|शादी|marriage|vivah|shaadi/i, code: "1" },
    { re: /नौकरी|करियर|job|career|naukri/i, code: "2" },
    { re: /व्यवसाय|बिज़नेस|business|vyapar|व्यापार/i, code: "3" },
    { re: /आर्थिक|कर्ज|पैसे|money|debt|loan|paise|arthik/i, code: "4" },
    { re: /प्रेम|लव|girlfriend|boyfriend|love|prem/i, code: "5" },
    { re: /स्वास्थ्य|सेहत|health|bimari|बीमारी/i, code: "6" },
    { re: /परिवार|family|ghar|घर\s*का/i, code: "7" },
    { re: /अन्य|other|कुछ\s*और/i, code: "8" },
  ];

  for (const { re, code } of byKeyword) {
    if (re.test(lower) || re.test(raw)) {
      const opt = PROBLEM_OPTIONS.find((o) => o.code === code);
      if (opt) return { code: opt.code, label: opt.label };
    }
  }

  // Free text → treat as "अन्य" with their wording
  if (raw.length >= 2 && raw.length <= 120) {
    return { code: "8", label: raw.slice(0, 80) };
  }

  return null;
}

export function isAffirmativeReady(text: string): boolean {
  const t = text.trim();
  if (
    /^(हाँ|हां|हा|haan|haa?n?|yes|yep|ok|okay|ठीक|तैयार|ready|bilkul|बिल्कुल)([\s!.।]*)$/iu.test(
      t,
    )
  ) {
    return true;
  }
  // Soft: starts with हाँ / yes
  if (/^(हाँ|हां|haan|yes)\b/iu.test(t)) return true;
  return false;
}

/** Format intake profile for later paid AI context. */
export function formatIntakeProfileForAi(profile: IntakeProfile): string {
  const lines: string[] = [];
  if (profile.clientName) lines.push(`नाम: ${profile.clientName}`);
  if (profile.problem) {
    lines.push(
      `मुख्य समस्या: ${profile.problem}${profile.problemCode ? ` (${profile.problemCode})` : ""}`,
    );
  }
  if (profile.duration) lines.push(`कब से: ${profile.duration}`);
  if (profile.priorAttempts) {
    lines.push(`पहले प्रयास: ${profile.priorAttempts}`);
  }
  if (profile.specialQuestion) {
    lines.push(`विशेष प्रश्न: ${profile.specialQuestion}`);
  }
  return lines.join("\n");
}
