/**
 * Client chat flow (pages 1–3) — menu-driven until Pay Now.
 * Pandit: देवदत्त जोशी, लखनऊ.
 */

export type IntakeStep =
  | "awaiting_problem"
  | "awaiting_problem_detail"
  | "awaiting_duration"
  | "awaiting_prior_attempts"
  | "awaiting_birth"
  | "awaiting_consult_choice"
  /** @deprecated legacy aliases — normalized away */
  | "awaiting_name"
  | "awaiting_birth_details"
  | "awaiting_birth_and_question"
  | "awaiting_question"
  | "awaiting_haan"
  | "awaiting_package_choice";

export type ServicePackageKind = "whatsapp" | "phone";

export type ProblemCode =
  | "love"
  | "finance"
  | "borrow"
  | "business"
  | "other";

export type ServicePackage = {
  code: string;
  kind: ServicePackageKind;
  priceInr: number;
  pricePaise: number;
  label: string;
  shortLabel: string;
  /** Button title on benefits screen (≤20 chars). */
  payButtonTitle: string;
};

export type IntakeProfile = {
  clientName?: string;
  problem?: string;
  problemCode?: ProblemCode | string;
  problemDetail?: string;
  duration?: string;
  priorAttempts?: string;
  specialQuestion?: string;
  selectedPackageCode?: string;
  selectedPackageKind?: ServicePackageKind;
  selectedPriceInr?: number;
};

export const PROBLEM_OPTIONS: {
  code: ProblemCode;
  label: string;
  listTitle: string;
  description: string;
}[] = [
  {
    code: "love",
    label: "Love / प्रेम",
    listTitle: "Love / प्रेम",
    description: "❤️ प्रेम संबंध",
  },
  {
    code: "finance",
    label: "Finance / आर्थिक",
    listTitle: "Finance / आर्थिक",
    description: "💰 धन / आर्थिक स्थिति",
  },
  {
    code: "borrow",
    label: "Borrow / कर्ज",
    listTitle: "Borrow / कर्ज",
    description: "📉 उधार / कर्ज",
  },
  {
    code: "business",
    label: "Business / व्यवसाय",
    listTitle: "Business",
    description: "📈 व्यापार / बिज़नेस",
  },
  {
    code: "other",
    label: "अन्य",
    listTitle: "अन्य",
    description: "✍️ कोई और समस्या",
  },
];

/** Page 3 — only WhatsApp ₹101 and Call ₹201. */
export const SERVICE_PACKAGES: ServicePackage[] = [
  {
    code: "a",
    kind: "whatsapp",
    priceInr: 101,
    pricePaise: 10100,
    label: "WhatsApp पर परामर्श — ₹101",
    shortLabel: "WhatsApp परामर्श ₹101",
    payButtonTitle: "WhatsApp 101/-",
  },
  {
    code: "b",
    kind: "phone",
    priceInr: 201,
    pricePaise: 20100,
    label: "पंडित जी से Call — ₹201",
    shortLabel: "Call परामर्श ₹201",
    payButtonTitle: "PAY Now 201/-",
  },
];

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

export function welcomeMessage(): string {
  return [
    "नमस्कार। मैं पंडित देवदत्त जोशी, लखनऊ से।",
    "",
    "आपकी क्या मदद कर सकता हूँ?",
    "",
    "नीचे कुछ विकल्प दिए हुए हैं — उसमें से कोई विकल्प choose कीजिए जो आपकी समस्या हो।",
    "",
    "अगर कोई अन्य समस्या है तो लिखकर भेज दीजिए।",
  ].join("\n");
}

export function welcomeInteractive(): IntakeInteractive {
  return {
    type: "list",
    body: welcomeMessage(),
    buttonText: "विकल्प देखें",
    footer: "पंडित देवदत्त जोशी",
    sections: [
      {
        title: "आपकी समस्या",
        rows: PROBLEM_OPTIONS.map((o) => ({
          id: `problem_${o.code}`,
          title: o.listTitle.slice(0, 24),
          description: o.description.slice(0, 72),
        })),
      },
    ],
  };
}

/** Category-specific follow-up (page 1–2). */
export function askProblemDetailMessage(code: ProblemCode | string): string {
  switch (code) {
    case "love":
      return [
        "ठीक है।",
        "",
        "प्रेम संबंध में क्या परेशानी है? कृपया थोड़ा विस्तार से बताइए।",
      ].join("\n");
    case "finance":
      return [
        "ठीक है।",
        "",
        "आर्थिक समस्या क्या है — आय, खर्च या धन की कमी? विस्तार से बताइए।",
      ].join("\n");
    case "borrow":
      return [
        "ठीक है।",
        "",
        "कर्ज / उधार की समस्या क्या है? कितना कर्ज है और किससे जुड़ी है — बताइए।",
      ].join("\n");
    case "business":
      return [
        "ठीक है।",
        "",
        "आपका कौन सा Business है और Business में क्या समस्या चल रही है?",
      ].join("\n");
    case "other":
    default:
      return [
        "ठीक है।",
        "",
        "आपकी अन्य समस्या क्या है, बताइए।",
      ].join("\n");
  }
}

export function askDurationMessage(): string {
  return [
    "ठीक है। मैं समझ गया।",
    "",
    "यह समस्या आपकी कब से चल रही है?",
  ].join("\n");
}

export function askPriorAttemptsMessage(): string {
  return [
    "ठीक है। मैं समझ गया।",
    "",
    "इस समस्या से निकलने के लिए आपने कोई कोशिश की है?",
    "",
    "यदि हाँ, तो संक्षेप में बताइए।",
  ].join("\n");
}

export function askBirthMessage(): string {
  return [
    "ठीक है।",
    "",
    "आपकी यह समस्या को देखने के लिए, और इस समस्या से निकलने के लिए आपकी जन्म तिथि चाहिए — स्थान और समय के साथ।",
    "",
    "🎂 जन्म तिथि:",
    "⏰ जन्म समय:",
    "📍 जन्म स्थान:",
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
  ].join("\n");
}

/** Page 3 — personal consultation pitch + A/B. */
export function consultChoiceMessage(): string {
  return [
    "जैसे ही आपकी जन्म जानकारी मिली —",
    "",
    "चूँकि आपकी इस समस्या से निकलने के लिए मुझे आपकी कुंडली देखनी पड़ेगी।",
    "कुंडली देखकर यह पता लगाना पड़ेगा कि आप इस समस्या से कैसे बाहर आएँगे।",
    "",
    "चूँकि कुंडली देखकर समस्या का निवारण निकालना यह Personal परामर्श में आता है।",
    "",
    "तो आप हमसे अपनी समस्या के निवारण के लिए दो तरीके से जुड़ सकते हैं:",
    "",
    "(A) WhatsApp पर परामर्श — शुल्क ₹101",
    "(B) सीधा पंडित जी से Call पर बात — शुल्क ₹201",
    "",
    "अब आप अपनी सुविधा के अनुसार कोई भी परामर्श चुन सकते हैं।",
  ].join("\n");
}

export function consultChoiceInteractive(): IntakeInteractive {
  return {
    type: "buttons",
    body: consultChoiceMessage(),
    footer: "व्यक्तिगत परामर्श",
    buttons: [
      { id: "pkg_a", title: "WhatsApp ₹101" },
      { id: "pkg_b", title: "Call ₹201" },
    ],
  };
}

export function reAskConsultChoiceMessage(): string {
  return [
    "🙏 कृपया परामर्श का विकल्प चुनें:",
    "",
    "(A) WhatsApp — ₹101",
    "(B) Call — ₹201",
  ].join("\n");
}

export function reAskConsultChoiceInteractive(): IntakeInteractive {
  return {
    type: "buttons",
    body: reAskConsultChoiceMessage(),
    buttons: [
      { id: "pkg_a", title: "WhatsApp ₹101" },
      { id: "pkg_b", title: "Call ₹201" },
    ],
  };
}

/** Benefits after choosing A (WhatsApp ₹101). */
export function whatsappBenefitsMessage(): string {
  return [
    "आपने WhatsApp परामर्श (₹101) चुना है। इसमें आपको मिलेगा:",
    "",
    "✅ आपकी कुंडली देखकर व्यक्तिगत मार्गदर्शन",
    "✅ आपके सभी सवालों के लिखित जवाब",
    "✅ ज़रूरत पड़ने पर कोई सवाल हो तो पूछ सकते हैं",
    "",
    "नीचे Pay Now दबाकर दक्षिणा पूर्ण करें।",
  ].join("\n");
}

/** Benefits after choosing B (Call ₹201). */
export function callBenefitsMessage(): string {
  return [
    "आपने Call परामर्श (₹201) चुना है। इसमें आपको मिलेगा:",
    "",
    "✅ पंडित जी से 15 मिनट सीधे बात करने का अवसर",
    "✅ अपने सभी सवाल सीधे पूछ सकते हैं",
    "✅ कुंडली के आधार पर व्यक्तिगत मार्गदर्शन",
    "",
    "नीचे Pay Now दबाकर दक्षिणा पूर्ण करें।",
  ].join("\n");
}

export function benefitsBeforePayNow(pkg: ServicePackage): string {
  return pkg.kind === "phone"
    ? callBenefitsMessage()
    : whatsappBenefitsMessage();
}

export function parseProblemChoice(text: string): {
  code: ProblemCode;
  label: string;
} | null {
  const raw = text.trim();
  if (!raw) return null;

  const listId = raw.match(/^problem_(love|finance|borrow|business|other)$/i);
  if (listId) {
    const code = listId[1].toLowerCase() as ProblemCode;
    const opt = PROBLEM_OPTIONS.find((o) => o.code === code);
    if (opt) return { code: opt.code, label: opt.label };
  }

  // Legacy numeric ids from old 8-option menu → map roughly
  const legacy = raw.match(/^problem_([1-8])$/i);
  if (legacy) {
    const map: Record<string, ProblemCode> = {
      "1": "love",
      "2": "finance",
      "3": "business",
      "4": "borrow",
      "5": "love",
      "6": "other",
      "7": "other",
      "8": "other",
    };
    const code = map[legacy[1]] ?? "other";
    const opt = PROBLEM_OPTIONS.find((o) => o.code === code)!;
    return { code: opt.code, label: opt.label };
  }

  const digitMatch = raw.match(/^[\s]*([1-5१-५])(?:[\s).:\-_…]|$)/u);
  if (digitMatch) {
    const map: Record<string, ProblemCode> = {
      "1": "love",
      "2": "finance",
      "3": "borrow",
      "4": "business",
      "5": "other",
      "१": "love",
      "२": "finance",
      "३": "borrow",
      "४": "business",
      "५": "other",
    };
    const code = map[digitMatch[1]];
    if (code) {
      const opt = PROBLEM_OPTIONS.find((o) => o.code === code)!;
      return { code: opt.code, label: opt.label };
    }
  }

  const byKeyword: { re: RegExp; code: ProblemCode }[] = [
    { re: /love|प्रेम|प्रेम\s*संबंध|girlfriend|boyfriend|शादी|विवाह/i, code: "love" },
    {
      re: /finance|आर्थिक|पैसे|पैसा|धन|money|income/i,
      code: "finance",
    },
    { re: /borrow|कर्ज|उधार|debt|loan|udhaar/i, code: "borrow" },
    {
      re: /business|व्यवसाय|बिज़नेस|व्यापार|vyapar/i,
      code: "business",
    },
    { re: /अन्य|other|कुछ\s*और/i, code: "other" },
  ];

  for (const { re, code } of byKeyword) {
    if (re.test(raw)) {
      const opt = PROBLEM_OPTIONS.find((o) => o.code === code)!;
      // Long free-text concern → other with their words
      if (raw.length > 40 && code !== "other") {
        return { code, label: raw.slice(0, 120) };
      }
      return { code: opt.code, label: opt.label };
    }
  }

  // Free text on welcome = other problem written directly
  if (raw.length >= 2 && raw.length <= 300 && !/^problem_/i.test(raw)) {
    return { code: "other", label: raw.slice(0, 120) };
  }

  return null;
}

/**
 * True when user typed their problem on the welcome screen
 * (skip "what is your other problem?").
 */
export function isFreeTextProblemOnWelcome(text: string): boolean {
  const raw = text.trim();
  if (raw.length < 8) return false;
  if (/^problem_/i.test(raw)) return false;
  if (/^[\s]*[1-5१-५](?:[\s).:\-_…]|$)/u.test(raw)) return false;
  if (isLikelyGreetingOnly(raw)) return false;
  // Pure category word only — not enough detail
  if (/^(love|finance|borrow|business|अन्य|other|प्रेम|आर्थिक|कर्ज|व्यवसाय)[\s!.।]*$/iu.test(raw)) {
    return false;
  }
  return true;
}

export function parsePackageChoice(text: string): ServicePackage | null {
  const raw = text.trim();
  if (!raw) return null;

  const btnId = raw.match(/^pkg_([ab12])$/i);
  if (btnId) {
    const key = btnId[1].toLowerCase();
    if (key === "a" || key === "1") return SERVICE_PACKAGES[0];
    if (key === "b" || key === "2") return SERVICE_PACKAGES[1];
  }

  if (/^[\s]*[aа](?:[\s).:\-_…]|$)/iu.test(raw) || /^[\s]*1(?:[\s).:\-_…]|$)/.test(raw)) {
    return SERVICE_PACKAGES[0];
  }
  if (/^[\s]*[bв](?:[\s).:\-_…]|$)/iu.test(raw) || /^[\s]*2(?:[\s).:\-_…]|$)/.test(raw)) {
    return SERVICE_PACKAGES[1];
  }

  if (/101|१०१|whats?app|व्हाट्स/i.test(raw)) return SERVICE_PACKAGES[0];
  if (/201|२०१|फोन|phone|कॉल|call/i.test(raw)) return SERVICE_PACKAGES[1];

  return null;
}

export function isLikelyGreetingOnly(text: string): boolean {
  const t = text.trim();
  return /^(hi+|hello|hey|namaste|namaskar|नमस्ते|नमस्कार|प्रणाम|राधे\s*राधे|जय\s*श्री\s*राम|पंडित\s*जी|good\s*morning|good\s*evening|hii+|hlw|helo)[\s!.।🙏]*$/iu.test(
    t,
  );
}

export function formatIntakeProfileForAi(profile: IntakeProfile): string {
  const lines: string[] = [];
  if (profile.clientName) lines.push(`नाम: ${profile.clientName}`);
  if (profile.problem) {
    lines.push(
      `श्रेणी: ${profile.problem}${profile.problemCode ? ` (${profile.problemCode})` : ""}`,
    );
  }
  if (profile.problemDetail) lines.push(`समस्या विवरण: ${profile.problemDetail}`);
  if (profile.duration) lines.push(`कब से: ${profile.duration}`);
  if (profile.priorAttempts) lines.push(`पहले प्रयास: ${profile.priorAttempts}`);
  if (profile.specialQuestion) lines.push(`विशेष प्रश्न: ${profile.specialQuestion}`);
  if (profile.selectedPriceInr) {
    lines.push(
      `पैकेज: ${profile.selectedPackageKind ?? "whatsapp"} — ₹${profile.selectedPriceInr}`,
    );
  }
  return lines.join("\n");
}

export function normalizeIntakeStep(step: IntakeStep | null): IntakeStep {
  if (!step || step === "awaiting_name") return "awaiting_problem";
  if (
    step === "awaiting_birth_details" ||
    step === "awaiting_birth_and_question" ||
    step === "awaiting_question"
  ) {
    return "awaiting_birth";
  }
  if (step === "awaiting_haan" || step === "awaiting_package_choice") {
    return "awaiting_consult_choice";
  }
  return step;
}
