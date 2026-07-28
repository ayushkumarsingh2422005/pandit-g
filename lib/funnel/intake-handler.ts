import {
  saveConversationTurn,
  type StoredChatMessage,
} from "@/lib/db/conversations";
import {
  askBirthMessage,
  askDurationMessage,
  askMissingBirthFieldsMessage,
  askPriorAttemptsMessage,
  askProblemDetailMessage,
  benefitsBeforePayNow,
  consultChoiceInteractive,
  consultChoiceMessage,
  formatIntakeProfileForAi,
  isFreeTextProblemOnWelcome,
  isLikelyGreetingOnly,
  normalizeIntakeStep,
  parsePackageChoice,
  parseProblemChoice,
  reAskConsultChoiceInteractive,
  reAskConsultChoiceMessage,
  welcomeInteractive,
  welcomeMessage,
  type IntakeInteractive,
  type IntakeProfile,
  type IntakeStep,
  type ProblemCode,
  type ServicePackage,
} from "@/lib/funnel/intake-script";
import {
  hasCompleteBirthDetailsInHistory,
  missingBirthFields,
} from "@/lib/funnel/detect-birth-details";
import {
  extractBirthDetailsUniversally,
  universalMissingFields,
} from "@/lib/funnel/extract-birth-details-ai";

export type IntakeHandlerResult =
  | {
      kind: "reply";
      reply: string;
      funnelStage: "awaiting_details";
      intakeStep: IntakeStep;
      intakeProfile: IntakeProfile;
      clientName?: string;
      interactive?: IntakeInteractive;
    }
  | {
      kind: "ready_for_payment";
      reply: string;
      intakeProfile: IntakeProfile;
      clientName?: string;
      selectedPackage: ServicePackage;
    };

function trimUserText(text: string): string {
  return text
    .trim()
    .replace(/^\[फोटो\]\s*/u, "")
    .replace(/^\[फोटो भेजी\]$/u, "")
    .trim();
}

function replyResult(
  reply: string,
  intakeStep: IntakeStep,
  profile: IntakeProfile,
  interactive?: IntakeInteractive,
): Extract<IntakeHandlerResult, { kind: "reply" }> {
  return {
    kind: "reply",
    reply,
    funnelStage: "awaiting_details",
    intakeStep,
    intakeProfile: profile,
    clientName: profile.clientName,
    interactive,
  };
}

/**
 * Scripted intake per client pages 1–3.
 * Interactive until consult choice → Pay Now.
 */
export async function advanceScriptedIntake(input: {
  step: IntakeStep | null;
  profile: IntakeProfile;
  userText: string;
  hasImage: boolean;
  history: StoredChatMessage[];
}): Promise<IntakeHandlerResult> {
  const step = normalizeIntakeStep(input.step);
  const profile: IntakeProfile = { ...input.profile };
  const text = trimUserText(input.userText);

  // ── Page 1: problem category ──────────────────────────────────────
  if (step === "awaiting_problem") {
    if (isLikelyGreetingOnly(text)) {
      return replyResult(
        welcomeMessage(),
        "awaiting_problem",
        profile,
        welcomeInteractive(),
      );
    }

    // User wrote their problem instead of picking a menu row
    if (isFreeTextProblemOnWelcome(text)) {
      profile.problemCode = "other";
      profile.problem = "अन्य";
      profile.problemDetail = text.slice(0, 400);
      profile.specialQuestion = profile.problemDetail;
      return replyResult(askDurationMessage(), "awaiting_duration", profile);
    }

    const problem = parseProblemChoice(text);
    if (!problem) {
      return replyResult(
        welcomeMessage(),
        "awaiting_problem",
        profile,
        welcomeInteractive(),
      );
    }

    profile.problem = problem.label;
    profile.problemCode = problem.code;

    // Free-text that mapped to a category with long label = detail already given
    if (
      problem.code === "other" &&
      problem.label.length > 20 &&
      !/^(अन्य|other)$/i.test(problem.label)
    ) {
      profile.problemDetail = problem.label;
      profile.specialQuestion = problem.label;
      return replyResult(askDurationMessage(), "awaiting_duration", profile);
    }

    return replyResult(
      askProblemDetailMessage(problem.code),
      "awaiting_problem_detail",
      profile,
    );
  }

  // ── Category follow-up detail ─────────────────────────────────────
  if (step === "awaiting_problem_detail") {
    if (!text || text.length < 2) {
      return replyResult(
        askProblemDetailMessage(
          (profile.problemCode as ProblemCode) || "other",
        ),
        "awaiting_problem_detail",
        profile,
      );
    }
    profile.problemDetail = text.slice(0, 400);
    profile.specialQuestion = profile.problemDetail;
    return replyResult(askDurationMessage(), "awaiting_duration", profile);
  }

  // ── Duration ──────────────────────────────────────────────────────
  if (step === "awaiting_duration") {
    if (!text) {
      return replyResult(askDurationMessage(), "awaiting_duration", profile);
    }
    profile.duration = text.slice(0, 200);
    return replyResult(
      askPriorAttemptsMessage(),
      "awaiting_prior_attempts",
      profile,
    );
  }

  // ── Prior attempts ────────────────────────────────────────────────
  if (step === "awaiting_prior_attempts") {
    profile.priorAttempts = text ? text.slice(0, 400) : "नहीं बताया";
    return replyResult(askBirthMessage(), "awaiting_birth", profile);
  }

  // ── Birth details ─────────────────────────────────────────────────
  if (step === "awaiting_birth") {
    let missing = missingBirthFields(
      input.history,
      input.userText,
      input.hasImage,
    );
    let complete = hasCompleteBirthDetailsInHistory(
      input.history,
      input.userText,
      input.hasImage,
    );

    if (!complete && !input.hasImage) {
      try {
        const universal = await extractBirthDetailsUniversally(
          input.history,
          input.userText,
        );
        if (universal) {
          missing = universalMissingFields(universal);
          complete = missing.length === 0;
        }
      } catch (error) {
        console.warn("[intake birth extract]", error);
      }
    }

    if (!complete) {
      const fields =
        missing.length > 0
          ? missing
          : ["जन्म तिथि", "जन्म समय", "जन्म स्थान"];
      return replyResult(
        askMissingBirthFieldsMessage(fields),
        "awaiting_birth",
        profile,
      );
    }

    // Page 3 — personal consultation A/B
    return replyResult(
      consultChoiceMessage(),
      "awaiting_consult_choice",
      profile,
      consultChoiceInteractive(),
    );
  }

  // ── Consult choice A/B → benefits + Pay Now ───────────────────────
  const pkg = parsePackageChoice(text);
  if (!pkg) {
    return replyResult(
      reAskConsultChoiceMessage(),
      "awaiting_consult_choice",
      profile,
      reAskConsultChoiceInteractive(),
    );
  }

  profile.selectedPackageCode = pkg.code;
  profile.selectedPackageKind = pkg.kind;
  profile.selectedPriceInr = pkg.priceInr;

  return {
    kind: "ready_for_payment",
    reply: benefitsBeforePayNow(pkg),
    intakeProfile: profile,
    clientName: profile.clientName,
    selectedPackage: pkg,
  };
}

export function startScriptedIntake(): Extract<
  IntakeHandlerResult,
  { kind: "reply" }
> {
  return {
    kind: "reply",
    reply: welcomeMessage(),
    funnelStage: "awaiting_details",
    intakeStep: "awaiting_problem",
    intakeProfile: {},
    interactive: welcomeInteractive(),
  };
}

export async function persistIntakeReply(input: {
  phone: string;
  userMessage: string;
  reply: string;
  contactName?: string;
  result: Extract<IntakeHandlerResult, { kind: "reply" }>;
}) {
  await saveConversationTurn(
    input.phone,
    input.userMessage,
    input.reply,
    input.contactName,
    input.result.funnelStage,
    {
      funnelStage: input.result.funnelStage,
      intakeStep: input.result.intakeStep,
      intakeProfile: input.result.intakeProfile,
      clientName: input.result.clientName,
    },
  );
}

export { formatIntakeProfileForAi, welcomeMessage };
