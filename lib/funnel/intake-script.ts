/**
 * Client intake flow — menu-driven until Pay Now.
 * Pandit: देवदत्त जोशी, लखनऊ.
 * WhatsApp: *bold* + contextual emoji on Hindi lines.
 */

export type IntakeStep =
  | "awaiting_problem"
  | "awaiting_problem_detail"
  | "awaiting_duration"
  | "awaiting_prior_attempts"
  | "awaiting_prior_attempt_detail"
  | "awaiting_birth"
  | "awaiting_consult_choice"
  /** @deprecated legacy */
  | "awaiting_name"
  | "awaiting_birth_details"
  | "awaiting_birth_and_question"
  | "awaiting_question"
  | "awaiting_haan"
  | "awaiting_package_choice";

export type ServicePackageKind = "whatsapp" | "phone";

export type ProblemCode =
  | "marriage_delay"
  | "marriage"
  | "job"
  | "business"
  | "love"
  | "health"
  | "family"
  | "restless"
  | "children"
  | "other";

export type ServicePackage = {
  code: string;
  kind: ServicePackageKind;
  priceInr: number;
  pricePaise: number;
  label: string;
  shortLabel: string;
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
    code: "marriage_delay",
    label: "विवाह में देरी",
    listTitle: "विवाह में देरी",
    description: "💍 शादी में देरी",
  },
  {
    code: "marriage",
    label: "शादी / विवाह संबंधी",
    listTitle: "शादी / विवाह",
    description: "💒 विवाह संबंधी समस्या",
  },
  {
    code: "job",
    label: "Job / नौकरी",
    listTitle: "Job / नौकरी",
    description: "💼 करियर / नौकरी",
  },
  {
    code: "business",
    label: "Business / व्यवसाय",
    listTitle: "Business",
    description: "📈 व्यापार / बिज़नेस",
  },
  {
    code: "love",
    label: "Love / प्रेम",
    listTitle: "Love / प्रेम",
    description: "❤️ प्रेम संबंध",
  },
  {
    code: "health",
    label: "सेहत संबंधी",
    listTitle: "सेहत संबंधी",
    description: "🏥 स्वास्थ्य चिंता",
  },
  {
    code: "family",
    label: "पारिवारिक तनाव",
    listTitle: "पारिवारिक तनाव",
    description: "🏡 घर / परिवार",
  },
  {
    code: "restless",
    label: "अशांत / बेचैन मन",
    listTitle: "अशांत / बेचैन मन",
    description: "😮‍💨 मन की बेचैनी",
  },
  {
    code: "children",
    label: "संतान Problem",
    listTitle: "संतान Problem",
    description: "👶 संतान संबंधी",
  },
];

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

/** Bold a WhatsApp phrase. */
export function b(text: string): string {
  return `*${text}*`;
}

export function panditBlessingMessage(): string {
  return `🙏 ${b("पंडित जी की भगवान का आशीर्वाद आप पर बना रहे।")}`;
}

export function welcomeMessage(): string {
  return [
    `🙏 ${b("नमस्कार।")} मैं ${b("पंडित देवदत्त जोशी")}, लखनऊ से।`,
    "",
    `🤝 आपकी क्या मदद कर सकता हूँ?`,
    "",
    `📋 नीचे कुछ विकल्प दिए हैं — ${b("विकल्प देखें")} दबाकर अपनी समस्या चुनिए।`,
    "",
    `✍️ अगर कोई अन्य समस्या है तो लिखकर भेज दीजिए।`,
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

export function askProblemDetailMessage(code: ProblemCode | string): string {
  switch (code) {
    case "marriage_delay":
      return [
        `🙂 ${b("ठीक है।")}`,
        "",
        `💍 विवाह में देरी को लेकर क्या चल रहा है? थोड़ा विस्तार से बताइए।`,
      ].join("\n");
    case "marriage":
      return [
        `🙂 ${b("ठीक है।")}`,
        "",
        `💒 शादी / विवाह संबंधी क्या समस्या है? कृपया बताइए।`,
      ].join("\n");
    case "job":
      return [
        `🙂 ${b("ठीक है।")}`,
        "",
        `💼 Job / नौकरी में क्या दिक्कत है? विस्तार से लिखिए।`,
      ].join("\n");
    case "business":
      return [
        `🙂 ${b("ठीक है।")}`,
        "",
        `📈 आपका कौन सा ${b("Business")} है और Business में क्या समस्या चल रही है?`,
      ].join("\n");
    case "love":
      return [
        `🙂 ${b("ठीक है।")}`,
        "",
        `❤️ प्रेम संबंध में क्या परेशानी है? कृपया थोड़ा विस्तार से बताइए।`,
      ].join("\n");
    case "health":
      return [
        `🙂 ${b("ठीक है।")}`,
        "",
        `🏥 सेहत संबंधी क्या चिंता है? संक्षेप में बताइए।`,
      ].join("\n");
    case "family":
      return [
        `🙂 ${b("ठीक है।")}`,
        "",
        `🏡 पारिवारिक तनाव किस बात को लेकर है? बताइए।`,
      ].join("\n");
    case "restless":
      return [
        `🙂 ${b("ठीक है।")}`,
        "",
        `😮‍💨 अशांत / बेचैन मन की समस्या कैसी महसूस होती है? बताइए।`,
      ].join("\n");
    case "children":
      return [
        `🙂 ${b("ठीक है।")}`,
        "",
        `👶 संतान संबंधी क्या समस्या है? कृपया बताइए।`,
      ].join("\n");
    case "other":
    default:
      return [
        `🙂 ${b("ठीक है।")}`,
        "",
        `✍️ आपकी अन्य समस्या क्या है, बताइए।`,
      ].join("\n");
  }
}

export function askDurationMessage(): string {
  return [
    `🙂 ${b("ठीक है।")} मैं समझ गया।`,
    "",
    `📅 यह समस्या आपकी ${b("कब से")} चल रही है?`,
  ].join("\n");
}

export function askPriorAttemptsMessage(): string {
  return [
    `🙂 ${b("ठीक है।")} मैं समझ गया।`,
    "",
    `🤔 इस समस्या से निकलने के लिए आपने कोई कोशिश की है?`,
    "",
    `📩 ${b("हाँ")} या ${b("नहीं")} लिखकर भेजिए।`,
  ].join("\n");
}

export function askPriorAttemptDetailMessage(): string {
  return [
    `🙏 ${b("ठीक है।")}`,
    "",
    `📝 तो आपने इस समस्या से निकलने के लिए ${b("क्या कोशिश")} की, बताइए।`,
  ].join("\n");
}

export function askBirthMessage(): string {
  return [
    `🙂 ${b("ठीक है।")}`,
    "",
    `🔮 समस्या देखने और इससे निकलने का मार्ग निकालने के लिए आपकी ${b("जन्म तिथि")} चाहिए — ${b("स्थान")} और ${b("समय")} के साथ।`,
    "",
    `🎂 जन्म तिथि:`,
    `⏰ जन्म समय:`,
    `📍 जन्म स्थान:`,
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
    `🙏 ${b("धन्यवाद।")} कुछ जन्म जानकारी अभी अधूरी है।`,
    "",
    `📋 कृपया ये भेजें:`,
    ...lines,
  ].join("\n");
}

/** Short box 1 — kundli need (not one giant message). */
export function consultKundliMessage(): string {
  return [
    `🔮 ${b("जन्म जानकारी मिल गई।")}`,
    "",
    `📜 इस समस्या से निकलने के लिए मुझे आपकी ${b("कुंडली")} देखनी पड़ेगी।`,
    "",
    `🧭 कुंडली देखकर पता चलेगा कि आप इस समस्या से कैसे बाहर आ सकते हैं।`,
  ].join("\n");
}

/** Short box 2 — what consultation includes. */
export function consultIncludesMessage(): string {
  return [
    `📦 ${b("परामर्श में आपको मिलेगा:")}`,
    "",
    `✅ आपकी समस्या का ${b("main कारण")}`,
    `✅ समस्या से आप बाहर कैसे आएँगे — उसके ${b("उपाय")}`,
    `✅ भविष्य में आप आगे कैसे बढ़ेंगे — उसके ${b("उपाय")}`,
    `✅ कुंडली देखकर सारी समस्या का ${b("निवारण")}`,
    `✅ सटीक ${b("ज्योतिषीय उपाय")}`,
    `✅ आपके सारे सवालों का ${b("जवाब")}`,
  ].join("\n");
}

/** Short box 3 — choose A/B (interactive body kept short). */
export function consultChoiceShortMessage(): string {
  return [
    `💎 कुंडली देखकर निवारण ${b("Personal परामर्श")} में आता है।`,
    "",
    `🤝 दो तरीके से जुड़ सकते हैं:`,
    "",
    `🌿 (A) WhatsApp परामर्श — ${b("₹101")}`,
    `📞 (B) Call पर बात — ${b("₹201")}`,
    "",
    `👇 अपनी सुविधा से विकल्प चुनें।`,
  ].join("\n");
}

export function consultChoiceMessages(): string[] {
  return [consultKundliMessage(), consultIncludesMessage()];
}

export function consultChoiceInteractive(): IntakeInteractive {
  return {
    type: "buttons",
    body: consultChoiceShortMessage(),
    footer: "व्यक्तिगत परामर्श",
    buttons: [
      { id: "pkg_a", title: "WhatsApp ₹101" },
      { id: "pkg_b", title: "Call ₹201" },
    ],
  };
}

export function reAskConsultChoiceMessage(): string {
  return [
    `🙏 कृपया परामर्श चुनें:`,
    "",
    `🌿 (A) WhatsApp — ${b("₹101")}`,
    `📞 (B) Call — ${b("₹201")}`,
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

export function whatsappBenefitsMessage(): string {
  return [
    `🌿 आपने ${b("WhatsApp परामर्श (₹101)")} चुना है।`,
    "",
    `📦 ${b("परामर्श में आपको मिलेगा:")}`,
    `✅ समस्या का main कारण`,
    `✅ बाहर आने के उपाय`,
    `✅ भविष्य में आगे बढ़ने के उपाय`,
    `✅ कुंडली से निवारण`,
    `✅ सटीक ज्योतिषीय उपाय`,
    `✅ आपके सारे सवालों का जवाब`,
    "",
    `💳 नीचे ${b("Pay Now")} दबाकर दक्षिणा पूर्ण करें।`,
    "",
    panditBlessingMessage(),
  ].join("\n");
}

export function callBenefitsMessage(): string {
  return [
    `📞 आपने ${b("Call परामर्श (₹201)")} चुना है।`,
    "",
    `📦 ${b("परामर्श में आपको मिलेगा:")}`,
    `✅ पंडित जी से ${b("15 मिनट")} सीधी बात`,
    `✅ अपने सभी सवाल सीधे पूछ सकते हैं`,
    `✅ कुंडली के आधार पर व्यक्तिगत मार्गदर्शन`,
    `✅ सटीक ज्योतिषीय उपाय`,
    "",
    `💳 नीचे ${b("Pay Now")} दबाकर दक्षिणा पूर्ण करें।`,
    "",
    panditBlessingMessage(),
  ].join("\n");
}

export function benefitsBeforePayNow(pkg: ServicePackage): string {
  return pkg.kind === "phone"
    ? callBenefitsMessage()
    : whatsappBenefitsMessage();
}

export function isAffirmativeYes(text: string): boolean {
  const t = text.trim();
  return /^(हाँ|हां|हा|haan|haa?n?|yes|yep|y|ji\s*haan|जी\s*हाँ|बिल्कुल|bilkul)([\s!.।]*)$/iu.test(
    t,
  );
}

export function isNegativeNo(text: string): boolean {
  const t = text.trim();
  return /^(नहीं|नही|ना|no|nahi|nahīn|nope|न)([\s!.।]*)$/iu.test(t);
}

export function parseProblemChoice(text: string): {
  code: ProblemCode;
  label: string;
} | null {
  const raw = text.trim();
  if (!raw) return null;

  const listId = raw.match(
    /^problem_(marriage_delay|marriage|job|business|love|health|family|restless|children|other)$/i,
  );
  if (listId) {
    const code = listId[1].toLowerCase() as ProblemCode;
    const opt = PROBLEM_OPTIONS.find((o) => o.code === code);
    if (opt) return { code: opt.code, label: opt.label };
  }

  // Legacy short codes
  const legacyShort = raw.match(
    /^problem_(love|finance|borrow|business|other)$/i,
  );
  if (legacyShort) {
    const map: Record<string, ProblemCode> = {
      love: "love",
      finance: "job",
      borrow: "job",
      business: "business",
      other: "restless",
    };
    const code = map[legacyShort[1].toLowerCase()] ?? "restless";
    const opt = PROBLEM_OPTIONS.find((o) => o.code === code)!;
    return { code: opt.code, label: opt.label };
  }

  const digitMatch = raw.match(/^[\s]*([1-9१-९])(?:[\s).:\-_…]|$)/u);
  if (digitMatch) {
    const map: Record<string, ProblemCode> = {
      "1": "marriage_delay",
      "2": "marriage",
      "3": "job",
      "4": "business",
      "5": "love",
      "6": "health",
      "7": "family",
      "8": "restless",
      "9": "children",
      "१": "marriage_delay",
      "२": "marriage",
      "३": "job",
      "४": "business",
      "५": "love",
      "६": "health",
      "७": "family",
      "८": "restless",
      "९": "children",
    };
    const code = map[digitMatch[1]];
    if (code) {
      const opt = PROBLEM_OPTIONS.find((o) => o.code === code)!;
      return { code: opt.code, label: opt.label };
    }
  }

  const byKeyword: { re: RegExp; code: ProblemCode }[] = [
    { re: /विवाह\s*में\s*देरी|शादी\s*में\s*देरी|delay.*marriage/i, code: "marriage_delay" },
    { re: /शादी|विवाह|marriage|vivah|shaadi/i, code: "marriage" },
    { re: /\bjob\b|नौकरी|करियर|career|naukri/i, code: "job" },
    { re: /business|व्यवसाय|बिज़नेस|व्यापार/i, code: "business" },
    { re: /love|प्रेम|girlfriend|boyfriend/i, code: "love" },
    { re: /सेहत|स्वास्थ्य|health|बीमारी/i, code: "health" },
    { re: /परिवार|family|पारिवारिक/i, code: "family" },
    { re: /अशांत|बेचैन|restless|tension|मन/i, code: "restless" },
    { re: /संतान|children|child|baby|औलाद/i, code: "children" },
  ];

  for (const { re, code } of byKeyword) {
    if (re.test(raw)) {
      const opt = PROBLEM_OPTIONS.find((o) => o.code === code)!;
      if (raw.length > 40) return { code, label: raw.slice(0, 120) };
      return { code: opt.code, label: opt.label };
    }
  }

  if (raw.length >= 2 && raw.length <= 300 && !/^problem_/i.test(raw)) {
    return { code: "other", label: raw.slice(0, 120) };
  }

  return null;
}

export function isFreeTextProblemOnWelcome(text: string): boolean {
  const raw = text.trim();
  if (raw.length < 8) return false;
  if (/^problem_/i.test(raw)) return false;
  if (/^[\s]*[1-9१-९](?:[\s).:\-_…]|$)/u.test(raw)) return false;
  if (isLikelyGreetingOnly(raw)) return false;
  if (
    /^(love|job|business|finance|अन्य|other|प्रेम|नौकरी|सेहत|परिवार|संतान)[\s!.।]*$/iu.test(
      raw,
    )
  ) {
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
