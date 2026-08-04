import {
  saveConversationTurn,
  type StoredChatMessage,
} from "@/lib/db/conversations";
import {
  askBirthMessage,
  askDurationMessage,
  askMissingBirthFieldsMessage,
  askPriorAttemptDetailMessage,
  askPriorAttemptsInteractive,
  askPriorAttemptsMessage,
  askProblemDetailMessage,
  benefitsBeforePayNow,
  consultChoiceInteractive,
  consultChoiceMessages,
  consultChoiceShortMessage,
  formatIntakeProfileForAi,
  isFreeTextProblemOnWelcome,
  isLikelyGreetingOnly,
  isPriorNo,
  isPriorYes,
  isVagueOtherOnly,
  normalizeIntakeStep,
  parsePackageChoice,
  parseProblemChoice,
  paymentHowInteractive,
  paymentHowMessage,
  reAskConsultChoiceInteractive,
  reAskConsultChoiceMessage,
  replyDedupeKey,
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
import {
  isObjectionRelevantStep,
  isPaymentHowQuestion,
  matchObjection,
  SHOW_PAYMENT_OPTIONS,
} from "@/lib/funnel/objection-replies";

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
      /** Skip WhatsApp send — same message as last bot reply. */
      skipSend?: boolean;
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

function lastAssistantContent(history: StoredChatMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "assistant") return history[i].content;
  }
  return null;
}

function replyResult(
  reply: string,
  intakeStep: IntakeStep,
  profile: IntakeProfile,
  interactive?: IntakeInteractive,
  preReplies?: string[],
  options?: { history?: StoredChatMessage[] },
): Extract<IntakeHandlerResult, { kind: "reply" }> {
  const last = options?.history
    ? lastAssistantContent(options.history)
    : null;
  const skipSend = Boolean(
    last && replyDedupeKey(last) === replyDedupeKey(reply) && !interactive,
  );

  return {
    kind: "reply",
    reply,
    preReplies,
    funnelStage: "awaiting_details",
    intakeStep,
    intakeProfile: profile,
    clientName: profile.clientName,
    interactive,
    skipSend,
  };
}

function withFlowReturn(
  objectionReply: string,
  continueHint: string,
): string {
  return `${objectionReply}\n\n———\n\n${continueHint}`;
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
  const hist = { history: input.history };

  if (step === "awaiting_problem") {
    if (isLikelyGreetingOnly(text)) {
      return replyResult(
        welcomeMessage(),
        "awaiting_problem",
        profile,
        welcomeInteractive(),
        undefined,
        hist,
      );
    }

    if (isVagueOtherOnly(text)) {
      profile.problemCode = "other";
      profile.problem = "अन्य";
      return replyResult(
        askProblemDetailMessage("other"),
        "awaiting_problem_detail",
        profile,
        undefined,
        undefined,
        hist,
      );
    }

    if (isFreeTextProblemOnWelcome(text)) {
      profile.problemCode = "other";
      profile.problem = "अन्य";
      profile.problemDetail = text.slice(0, 400);
      profile.specialQuestion = profile.problemDetail;
      return replyResult(
        askDurationMessage(),
        "awaiting_duration",
        profile,
        undefined,
        undefined,
        hist,
      );
    }

    const problem = parseProblemChoice(text);
    if (!problem) {
      return replyResult(
        welcomeMessage(),
        "awaiting_problem",
        profile,
        welcomeInteractive(),
        undefined,
        hist,
      );
    }

    profile.problem = problem.label;
    profile.problemCode = problem.code;

    // "अन्य" / vague — ask what the problem is first (never "समझ गया")
    if (
      problem.code === "other" &&
      (isVagueOtherOnly(problem.label) ||
        problem.label.length <= 20 ||
        /^(अन्य|other)/i.test(problem.label))
    ) {
      profile.problem = "अन्य";
      return replyResult(
        askProblemDetailMessage("other"),
        "awaiting_problem_detail",
        profile,
        undefined,
        undefined,
        hist,
      );
    }

    if (problem.code === "other" && problem.label.length > 20) {
      profile.problemDetail = problem.label;
      profile.specialQuestion = problem.label;
      return replyResult(
        askDurationMessage(),
        "awaiting_duration",
        profile,
        undefined,
        undefined,
        hist,
      );
    }

    return replyResult(
      askProblemDetailMessage(problem.code),
      "awaiting_problem_detail",
      profile,
      undefined,
      undefined,
      hist,
    );
  }

  if (step === "awaiting_problem_detail") {
    if (!text || text.length < 2 || isVagueOtherOnly(text)) {
      return replyResult(
        askProblemDetailMessage(
          (profile.problemCode as ProblemCode) || "other",
        ),
        "awaiting_problem_detail",
        profile,
        undefined,
        undefined,
        hist,
      );
    }
    profile.problemDetail = text.slice(0, 400);
    profile.specialQuestion = profile.problemDetail;
    return replyResult(
      askDurationMessage(),
      "awaiting_duration",
      profile,
      undefined,
      undefined,
      hist,
    );
  }

  if (step === "awaiting_duration") {
    if (!text) {
      return replyResult(
        askDurationMessage(),
        "awaiting_duration",
        profile,
        undefined,
        undefined,
        hist,
      );
    }
    profile.duration = text.slice(0, 200);
    return replyResult(
      askPriorAttemptsMessage(),
      "awaiting_prior_attempts",
      profile,
      askPriorAttemptsInteractive(),
      undefined,
      hist,
    );
  }

  // हाँ → क्या कोशिश?  |  नहीं → DOB  |  detail text → DOB
  if (step === "awaiting_prior_attempts") {
    if (isPriorYes(text)) {
      return replyResult(
        askPriorAttemptDetailMessage(),
        "awaiting_prior_attempt_detail",
        profile,
        undefined,
        undefined,
        hist,
      );
    }
    if (isPriorNo(text) || !text) {
      profile.priorAttempts = "नहीं";
      return replyResult(
        askBirthMessage(),
        "awaiting_birth",
        profile,
        undefined,
        undefined,
        hist,
      );
    }
    // Already described efforts in one message
    profile.priorAttempts = text.slice(0, 400);
    return replyResult(
      askBirthMessage(),
      "awaiting_birth",
      profile,
      undefined,
      undefined,
      hist,
    );
  }

  if (step === "awaiting_prior_attempt_detail") {
    if (!text || text.length < 2) {
      return replyResult(
        askPriorAttemptDetailMessage(),
        "awaiting_prior_attempt_detail",
        profile,
        undefined,
        undefined,
        hist,
      );
    }
    profile.priorAttempts = text.slice(0, 400);
    return replyResult(
      askBirthMessage(),
      "awaiting_birth",
      profile,
      undefined,
      undefined,
      hist,
    );
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
        undefined,
        undefined,
        hist,
      );
    }

    return replyResult(
      consultChoiceShortMessage(),
      "awaiting_consult_choice",
      profile,
      consultChoiceInteractive(),
      consultChoiceMessages(),
      hist,
    );
  }

  // Near payment — handle bahane / payment-how, then return to A/B
  if (isObjectionRelevantStep(step)) {
    if (isPaymentHowQuestion(text)) {
      return replyResult(
        paymentHowMessage(),
        "awaiting_consult_choice",
        profile,
        paymentHowInteractive(),
        undefined,
        hist,
      );
    }

    const pkgEarly = parsePackageChoice(text);
    if (!pkgEarly) {
      const objection = matchObjection(text);
      if (objection) {
        if (objection.reply === SHOW_PAYMENT_OPTIONS) {
          return replyResult(
            paymentHowMessage(),
            "awaiting_consult_choice",
            profile,
            paymentHowInteractive(),
            undefined,
            hist,
          );
        }
        const continueHint = reAskConsultChoiceMessage();
        return replyResult(
          withFlowReturn(objection.reply, continueHint),
          "awaiting_consult_choice",
          profile,
          reAskConsultChoiceInteractive(),
          undefined,
          hist,
        );
      }

      return replyResult(
        reAskConsultChoiceMessage(),
        "awaiting_consult_choice",
        profile,
        reAskConsultChoiceInteractive(),
        undefined,
        hist,
      );
    }

    profile.selectedPackageCode = pkgEarly.code;
    profile.selectedPackageKind = pkgEarly.kind;
    profile.selectedPriceInr = pkgEarly.priceInr;

    return {
      kind: "ready_for_payment",
      reply: benefitsBeforePayNow(pkgEarly),
      intakeProfile: profile,
      clientName: profile.clientName,
      selectedPackage: pkgEarly,
    };
  }

  const pkg = parsePackageChoice(text);
  if (!pkg) {
    return replyResult(
      reAskConsultChoiceMessage(),
      "awaiting_consult_choice",
      profile,
      reAskConsultChoiceInteractive(),
      undefined,
      hist,
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
