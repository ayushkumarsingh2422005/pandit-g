import {
  saveConversationTurn,
  type StoredChatMessage,
} from "@/lib/db/conversations";
import {
  askBirthAndQuestionMessage,
  askDurationMessage,
  askMissingBirthFieldsMessage,
  askPriorAttemptsMessage,
  askQuestionOnlyMessage,
  extractSpecialQuestion,
  featuresAndPackageInteractive,
  featuresAndPackageMenuMessage,
  formatIntakeProfileForAi,
  isLikelyGreetingOnly,
  normalizeIntakeStep,
  parsePackageChoice,
  parseProblemChoice,
  paymentAckBeforePayNow,
  reAskPackageInteractive,
  reAskPackageMessage,
  welcomeInteractive,
  welcomeMessage,
  type IntakeInteractive,
  type IntakeProfile,
  type IntakeStep,
  type ServicePackage,
} from "@/lib/funnel/intake-script";
import {
  hasBirthDetailsInText,
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
 * Scripted intake (no LLM). Interactive menus until package → Pay Now.
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

  if (step === "awaiting_problem") {
    if (isLikelyGreetingOnly(text)) {
      return replyResult(
        welcomeMessage(),
        "awaiting_problem",
        profile,
        welcomeInteractive(),
      );
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

  if (step === "awaiting_prior_attempts") {
    profile.priorAttempts = text ? text.slice(0, 400) : "नहीं बताया";
    return replyResult(
      askBirthAndQuestionMessage(),
      "awaiting_birth_and_question",
      profile,
    );
  }

  if (step === "awaiting_birth_and_question") {
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
        "awaiting_birth_and_question",
        profile,
      );
    }

    // Birth already known from earlier turns? Then this message is the question
    // (don't treat "shadi nahi ho rahi" as a place name).
    const birthAlreadyInHistory = hasCompleteBirthDetailsInHistory(
      input.history,
      "",
      false,
    );
    const thisTurnIsBirthBundle = hasBirthDetailsInText(input.userText);

    let question =
      extractSpecialQuestion(text) || profile.specialQuestion || undefined;

    if (!question && text.length >= 3 && !isLikelyGreetingOnly(text)) {
      if (birthAlreadyInHistory && !thisTurnIsBirthBundle) {
        // Follow-up after birth collected — any real reply is the question
        question = text.slice(0, 500);
      } else if (!thisTurnIsBirthBundle) {
        question = text.slice(0, 500);
      }
      // else: birth+details in one message without a clear question → ask below
    }

    if (!question) {
      return replyResult(
        askQuestionOnlyMessage(),
        "awaiting_birth_and_question",
        profile,
      );
    }

    profile.specialQuestion = question;
    return replyResult(
      featuresAndPackageMenuMessage(),
      "awaiting_package_choice",
      profile,
      featuresAndPackageInteractive(),
    );
  }

  const pkg = parsePackageChoice(text);
  if (!pkg) {
    return replyResult(
      reAskPackageMessage(),
      "awaiting_package_choice",
      profile,
      reAskPackageInteractive(),
    );
  }

  profile.selectedPackageCode = pkg.code;
  profile.selectedPackageKind = pkg.kind;
  profile.selectedPriceInr = pkg.priceInr;

  return {
    kind: "ready_for_payment",
    reply: paymentAckBeforePayNow(pkg),
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
