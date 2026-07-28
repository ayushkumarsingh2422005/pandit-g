/**
 * Fixed Hindi onboarding script (pre-AI / pre-payment).
 * Menu-driven until package selected and Pay Now is sent.
 */

export type IntakeStep =
  | "awaiting_problem"
  | "awaiting_duration"
  | "awaiting_prior_attempts"
  | "awaiting_birth_and_question"
  | "awaiting_package_choice"
  /** @deprecated legacy — treated as awaiting_problem */
  | "awaiting_name"
  /** @deprecated legacy */
  | "awaiting_birth_details"
  /** @deprecated legacy */
  | "awaiting_question"
  /** @deprecated legacy */
  | "awaiting_haan";

export type ServicePackageKind = "whatsapp" | "phone";

export type ServicePackage = {
  code: string;
  kind: ServicePackageKind;
  priceInr: number;
  pricePaise: number;
  label: string;
  shortLabel: string;
};

export type IntakeProfile = {
  clientName?: string;
  problem?: string;
  problemCode?: string;
  duration?: string;
  priorAttempts?: string;
  specialQuestion?: string;
  selectedPackageCode?: string;
  selectedPackageKind?: ServicePackageKind;
  selectedPriceInr?: number;
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

/** Dakshina menu — WhatsApp ₹101/₹151, phone ₹201. */
export const SERVICE_PACKAGES: ServicePackage[] = [
  {
    code: "1",
    kind: "whatsapp",
    priceInr: 101,
    pricePaise: 10100,
    label: "WhatsApp परामर्श (लिखित रिपोर्ट व उपाय) — ₹101",
    shortLabel: "WhatsApp परामर्श ₹101",
  },
  {
    code: "2",
    kind: "whatsapp",
    priceInr: 151,
    pricePaise: 15100,
    label: "WhatsApp परामर्श (लिखित रिपोर्ट व उपाय) — ₹151",
    shortLabel: "WhatsApp परामर्श ₹151",
  },
  {
    code: "3",
    kind: "phone",
    priceInr: 201,
    pricePaise: 20100,
    label: "फोन कॉल परामर्श (15 मिनट सीधी चर्चा) — ₹201",
    shortLabel: "फोन कॉल परामर्श ₹201",
  },
];

const DIVIDER = "━━━━━━━━━━━━━━━";

/** WhatsApp interactive payload attached to an intake reply. */
export type IntakeInteractive =
  | {
      type: "list";
      body: string;
      buttonText: string;
      header?: string;
      footer?: string;
      sections: {
        title?: string;
        rows: { id: string; title: string; description?: string }[];
      }[];
    }
  | {
      type: "buttons";
      body: string;
      header?: string;
      footer?: string;
      buttons: { id: string; title: string }[];
    };

const PROBLEM_LIST_ROWS: {
  id: string;
  title: string;
  description: string;
}[] = [
  { id: "problem_1", title: "विवाह में देरी", description: "💍 शादी / विवाह संबंधी" },
  { id: "problem_2", title: "नौकरी / करियर", description: "💼 Job / career" },
  {
    id: "problem_3",
    title: "व्यवसाय समस्या",
    description: "📈 व्यापार / business",
  },
  {
    id: "problem_4",
    title: "आर्थिक / कर्ज",
    description: "💰 पैसे / कर्ज की समस्या",
  },
  { id: "problem_5", title: "प्रेम संबंध", description: "❤️ Love / relationship" },
  {
    id: "problem_6",
    title: "स्वास्थ्य चिंता",
    description: "🏥 सेहत संबंधी",
  },
  {
    id: "problem_7",
    title: "पारिवारिक तनाव",
    description: "🏡 घर / परिवार",
  },
  { id: "problem_8", title: "अन्य", description: "✍️ कोई और विषय" },
];

export function problemListInteractive(): IntakeInteractive {
  return {
    type: "list",
    body: [
      "🙏 नमस्ते बेटा। आपका स्वागत है।",
      "",
      "बताइए, किस विषय को लेकर मन परेशान है?",
      "",
      'नीचे "विकल्प देखें" दबाकर विषय चुनें।',
    ].join("\n"),
    buttonText: "विकल्प देखें",
    footer: "Pandit G",
    sections: [
      {
        title: "मुख्य समस्या",
        rows: PROBLEM_LIST_ROWS,
      },
    ],
  };
}

export function packageButtonsInteractive(body: string): IntakeInteractive {
  return {
    type: "buttons",
    body,
    footer: "सेवा दक्षिणा",
    buttons: [
      { id: "pkg_1", title: "WhatsApp ₹101" },
      { id: "pkg_2", title: "WhatsApp ₹151" },
      { id: "pkg_3", title: "फोन कॉल ₹201" },
    ],
  };
}

export function welcomeMessage(): string {
  return problemListInteractive().body;
}

export function welcomeInteractive(): IntakeInteractive {
  return problemListInteractive();
}

export function askDurationMessage(): string {
  return [
    "मैं समझ सकता हूँ। ऐसी स्थिति में तनाव होना स्वाभाविक है।",
    "",
    "एक बात बताइए, यह परेशानी कब से चल रही है?",
  ].join("\n");
}

export function askPriorAttemptsMessage(): string {
  return [
    "ठीक है बेटा।",
    "",
    "आपने अब तक इसके लिए क्या-क्या प्रयास किए हैं?",
    "",
    "कृपया संक्षेप में बताइए।",
  ].join("\n");
}

export function askBirthAndQuestionMessage(): string {
  return [
    "ठीक है बेटा। आप अपनी जन्म तिथि, जन्म समय और जन्म स्थान भेज दीजिए।",
    "",
    "साथ ही अपना मुख्य सवाल भी लिख दीजिए ताकि मैं उसी पर ध्यान केंद्रित करके मार्गदर्शन तैयार कर सकूँ।",
    "",
    "🎂 जन्म तिथि:",
    "⏰ जन्म समय:",
    "📍 जन्म स्थान:",
    "❓ मुख्य सवाल:",
  ].join("\n");
}

export function askMissingBirthFieldsMessage(missingLabels: string[]): string {
  const lines = missingLabels.map((label) => {
    if (label === "date" || label === "जन्म तिथि") return "🎂 जन्म तिथि";
    if (label === "time" || label === "जन्म समय") return "⏰ जन्म समय";
    if (label === "place" || label === "जन्म स्थान") return "📍 जन्म स्थान";
    return `• ${label}`;
  });

  return [
    "🙏 धन्यवाद। कुछ जन्म जानकारी अभी अधूरी है।",
    "",
    "कृपया ये भेजें:",
    ...lines,
    "",
    "और यदि मुख्य सवाल अभी नहीं लिखा, तो उसे भी साथ लिख दीजिए।",
  ].join("\n");
}

export function askQuestionOnlyMessage(): string {
  return [
    "जन्म विवरण मिल गया।",
    "",
    "❓ अब अपना मुख्य सवाल लिखकर भेज दीजिए —",
    "उदाहरण: क्या मुझे नौकरी मिलेगी? आर्थिक स्थिति कब बेहतर होगी?",
  ].join("\n");
}

/** Thanks + features — package choice via reply buttons. */
export function featuresAndPackageMenuMessage(): string {
  return [
    "धन्यवाद। जानकारी मिल गई।",
    "",
    "मैं आपकी कुंडली का गहराई से अध्ययन करूँगा।",
    "",
    DIVIDER,
    "",
    "इस परामर्श में आपको निम्नलिखित जानकारियाँ दी जाएँगी:",
    "",
    "✅ जन्म कुंडली का विस्तार से अध्ययन",
    "✅ आपके प्रश्नों के साफ़ लिखित उत्तर",
    "✅ नौकरी / धन आगमन के सटीक समय की जानकारी",
    "✅ आसान वैदिक उपाय",
    "✅ एक फॉलो-अप चैट सहायता",
    "",
    DIVIDER,
    "",
    "सेवा दक्षिणा — नीचे बटन से विकल्प चुनें:",
    "",
    "🌿 WhatsApp परामर्श (लिखित रिपोर्ट व उपाय)",
    "📞 फोन कॉल परामर्श (15 मिनट सीधी चर्चा)",
  ].join("\n");
}

export function featuresAndPackageInteractive(): IntakeInteractive {
  return packageButtonsInteractive(featuresAndPackageMenuMessage());
}

export function reAskPackageMessage(): string {
  return [
    "🙏 कृपया दक्षिणा का विकल्प नीचे बटन से चुनें।",
    "",
    "WhatsApp ₹101 · WhatsApp ₹151 · फोन कॉल ₹201",
  ].join("\n");
}

export function reAskPackageInteractive(): IntakeInteractive {
  return packageButtonsInteractive(reAskPackageMessage());
}

export function paymentAckBeforePayNow(pkg: ServicePackage): string {
  return [
    `ठीक है बेटा। आपने ${pkg.shortLabel} चुना है।`,
    "",
    "मैं तुरंत भुगतान की प्रक्रिया शुरू कर रहा हूँ — नीचे Pay Now दबाकर दक्षिणा पूर्ण करें।",
  ].join("\n");
}

export function parseProblemChoice(text: string): {
  code: string;
  label: string;
} | null {
  const raw = text.trim();
  if (!raw) return null;

  // Interactive list tap: problem_1 … problem_8
  const listId = raw.match(/^problem_([1-8])$/i);
  if (listId) {
    const opt = PROBLEM_OPTIONS.find((o) => o.code === listId[1]);
    if (opt) return opt;
  }

  const digitMatch = raw.match(
    /^[\s]*(?:option\s*)?([1-8१-८])(?:[\s).:\-_…]|$)/iu,
  );
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

  // List row title tap fallback (title sent without id in rare cases)
  const byTitle = PROBLEM_OPTIONS.find(
    (o) => o.label === raw || raw.includes(o.label),
  );
  if (byTitle && raw.length <= 40) return byTitle;

  const byKeyword: { re: RegExp; code: string }[] = [
    { re: /विवाह|शादी|marriage|vivah|shaadi/i, code: "1" },
    { re: /नौकरी|करियर|job|career|naukri/i, code: "2" },
    { re: /व्यवसाय|बिज़नेस|business|vyapar|व्यापार/i, code: "3" },
    { re: /आर्थिक|कर्ज|पैसे|पैसा|money|debt|loan|paise|arthik/i, code: "4" },
    { re: /प्रेम|लव|girlfriend|boyfriend|love|prem/i, code: "5" },
    { re: /स्वास्थ्य|सेहत|health|bimari|बीमारी/i, code: "6" },
    { re: /परिवार|family|ghar|घर\s*का/i, code: "7" },
    { re: /अन्य|other|कुछ\s*और/i, code: "8" },
  ];

  for (const { re, code } of byKeyword) {
    if (re.test(raw)) {
      const opt = PROBLEM_OPTIONS.find((o) => o.code === code);
      if (opt) {
        if (raw.length > opt.label.length + 5) {
          return { code: opt.code, label: raw.slice(0, 120) };
        }
        return opt;
      }
    }
  }

  if (raw.length >= 2 && raw.length <= 200 && !/^problem_/i.test(raw)) {
    return { code: "8", label: raw.slice(0, 120) };
  }

  return null;
}

export function parsePackageChoice(text: string): ServicePackage | null {
  const raw = text.trim();
  if (!raw) return null;

  // Interactive button tap: pkg_1 … pkg_3
  const btnId = raw.match(/^pkg_([1-3])$/i);
  if (btnId) {
    return SERVICE_PACKAGES.find((p) => p.code === btnId[1]) ?? null;
  }

  const digitMatch = raw.match(
    /^[\s]*(?:option\s*)?([1-3१-३])(?:[\s).:\-_…]|$)/iu,
  );
  if (digitMatch) {
    const map: Record<string, string> = { "१": "1", "२": "2", "३": "3" };
    const code = map[digitMatch[1]] ?? digitMatch[1];
    return SERVICE_PACKAGES.find((p) => p.code === code) ?? null;
  }

  if (/101|१०१/.test(raw)) return SERVICE_PACKAGES[0];
  if (/151|१५१/.test(raw)) return SERVICE_PACKAGES[1];
  if (/201|२०१/.test(raw) || /फोन|phone|कॉल|call/i.test(raw)) {
    return SERVICE_PACKAGES[2];
  }

  if (/whats?app|व्हाट्स|लिखित/i.test(raw) && !/151|१५१/.test(raw)) {
    return SERVICE_PACKAGES[0];
  }

  return null;
}

/** Pull a question line from a combined birth+question message. */
export function extractSpecialQuestion(text: string): string | undefined {
  const cleaned = text.trim();
  if (!cleaned) return undefined;

  const labeled = cleaned.match(
    /(?:मुख्य\s*सवाल|सवाल|प्रश्न|question)\s*[:\-–]?\s*(.+)$/imu,
  );
  if (labeled?.[1]?.trim()) {
    return labeled[1].trim().slice(0, 500);
  }

  if (/[?？]|क्या\s|कब\s|कैसे\s|milegi|hogi|होगी|मिलेगी/i.test(cleaned)) {
    // Prefer last sentence-looking chunk
    const parts = cleaned
      .split(/[\n।]/)
      .map((p) => p.trim())
      .filter(Boolean);
    const q = parts.find((p) =>
      /[?？]|क्या\s|कब\s|कैसे\s|milegi|hogi|होगी|मिलेगी/i.test(p),
    );
    if (q && q.length >= 8) return q.slice(0, 500);
  }

  return undefined;
}

export function isLikelyGreetingOnly(text: string): boolean {
  const t = text.trim();
  return /^(hi+|hello|hey|namaste|namaskar|नमस्ते|नमस्कार|प्रणाम|राधे\s*राधे|जय\s*श्री\s*राम|पंडित\s*जी|good\s*morning|good\s*evening|hii+|hlw|helo)[\s!.।🙏]*$/iu.test(
    t,
  );
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
  if (profile.selectedPriceInr) {
    lines.push(
      `पैकेज: ${profile.selectedPackageKind ?? "whatsapp"} — ₹${profile.selectedPriceInr}`,
    );
  }
  return lines.join("\n");
}

/** Normalize legacy steps onto the current machine. */
export function normalizeIntakeStep(step: IntakeStep | null): IntakeStep {
  if (!step || step === "awaiting_name") return "awaiting_problem";
  if (step === "awaiting_birth_details" || step === "awaiting_question") {
    return "awaiting_birth_and_question";
  }
  if (step === "awaiting_haan") return "awaiting_package_choice";
  return step;
}
