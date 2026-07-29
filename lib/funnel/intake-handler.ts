import {
  saveConversationTurn,
  type StoredChatMessage,
} from "@/lib/db/conversations";
import {
  askBirthMessage,
  askDurationMessage,
  askMissingBirthFieldsMessage,
  askPriorAttemptDetailMessage,
  askPriorAttemptsMessage,
  askProblemDetailMessage,
  benefitsBeforePayNow,
  consultChoiceInteractive,
  consultChoiceMessages,
  consultChoiceShortMessage,
  formatIntakeProfileForAi,
  isAffirmativeYes,
  isFreeTextProblemOnWelcome,
  isLikelyGreetingOnly,
  isNegativeNo,
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
      /** Extra short WhatsApp texts sent before main reply / interactive. */
      preReplies?: string[];
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
  preReplies?: string[],
): Extract<IntakeHandlerResult, { kind: "reply" }> {
  return {
    kind: "reply",
    reply,
    preReplies,
    funnelStage: "awaiting_details",
    intakeStep,
    intakeProfile: profile,
    clientName: profile.clientName,
    interactive,
  };
}

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

  if (step === "awaiting_problem") {
    if (isLikelyGreetingOnly(text)) {
      return replyResult(
        welcomeMessage(),
        "awaiting_problem",
        profile,
        welcomeInteractive(),
      );
    }

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

  // हाँ → क्या कोशिश?  |  नहीं → DOB  |  detail text → DOB
  if (step === "awaiting_prior_attempts") {
    if (isAffirmativeYes(text)) {
      return replyResult(
        askPriorAttemptDetailMessage(),
        "awaiting_prior_attempt_detail",
        profile,
      );
    }
    if (isNegativeNo(text) || !text) {
      profile.priorAttempts = "नहीं";
      return replyResult(askBirthMessage(), "awaiting_birth", profile);
    }
    // Already described efforts in one message
    profile.priorAttempts = text.slice(0, 400);
    return replyResult(askBirthMessage(), "awaiting_birth", profile);
  }

  if (step === "awaiting_prior_attempt_detail") {
    if (!text || text.length < 2) {
      return replyResult(
        askPriorAttemptDetailMessage(),
        "awaiting_prior_attempt_detail",
        profile,
      );
    }
    profile.priorAttempts = text.slice(0, 400);
    return replyResult(askBirthMessage(), "awaiting_birth", profile);
  }

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

    // 2–3 short boxes: kundli + includes, then A/B buttons
    return replyResult(
      consultChoiceShortMessage(),
      "awaiting_consult_choice",
      profile,
      consultChoiceInteractive(),
      consultChoiceMessages(),
    );
  }

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
  const storedReply = input.result.preReplies?.length
    ? [...input.result.preReplies, input.reply].join("\n\n———\n\n")
    : input.reply;

  await saveConversationTurn(
    input.phone,
    input.userMessage,
    storedReply,
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
