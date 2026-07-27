import {
  saveConversationTurn,
  type StoredChatMessage,
} from "@/lib/db/conversations";
import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import {
  hasCompleteBirthDetailsInHistory,
  missingBirthFields,
} from "@/lib/funnel/detect-birth-details";
import {
  extractBirthDetailsUniversally,
  universalMissingFields,
} from "@/lib/funnel/extract-birth-details-ai";
import {
  askBirthDetailsMessage,
  askDurationMessage,
  askMissingBirthFieldsMessage,
  askPriorAttemptsMessage,
  askProblemMessage,
  confirmAndAskQuestionMessage,
  formatIntakeProfileForAi,
  isAffirmativeReady,
  isLikelyGreetingOnly,
  packageFeeAndAskHaanMessage,
  parseClientName,
  parseProblemChoice,
  reAskHaanMessage,
  reAskNameMessage,
  welcomeMessage,
  type IntakeProfile,
  type IntakeStep,
} from "@/lib/funnel/intake-script";
import { isPaymentIntent } from "@/lib/payments/payment-intent";

export type IntakeHandlerResult =
  | {
      kind: "reply";
      reply: string;
      funnelStage: "awaiting_details";
      intakeStep: IntakeStep;
      intakeProfile: IntakeProfile;
      clientName?: string;
    }
  | {
      kind: "ready_for_payment";
      reply: string;
      intakeProfile: IntakeProfile;
      clientName?: string;
    };

function trimUserText(text: string): string {
  return text
    .trim()
    .replace(/^\[फोटो\]\s*/u, "")
    .replace(/^\[फोटो भेजी\]$/u, "")
    .trim();
}

/**
 * Scripted intake (no LLM). Returns next bot reply + updated step,
 * or signals that user said हाँ and payment should start.
 */
export async function advanceScriptedIntake(input: {
  step: IntakeStep | null;
  profile: IntakeProfile;
  userText: string;
  hasImage: boolean;
  history: StoredChatMessage[];
}): Promise<IntakeHandlerResult> {
  const step = input.step ?? "awaiting_name";
  const profile: IntakeProfile = { ...input.profile };
  const text = trimUserText(input.userText);

  if (step === "awaiting_name") {
    const name = parseClientName(text);
    if (!name) {
      return {
        kind: "reply",
        reply: isLikelyGreetingOnly(text)
          ? reAskNameMessage()
          : reAskNameMessage(),
        funnelStage: "awaiting_details",
        intakeStep: "awaiting_name",
        intakeProfile: profile,
      };
    }
    profile.clientName = name;
    return {
      kind: "reply",
      reply: askProblemMessage(name),
      funnelStage: "awaiting_details",
      intakeStep: "awaiting_problem",
      intakeProfile: profile,
      clientName: name,
    };
  }

  if (step === "awaiting_problem") {
    const problem = parseProblemChoice(text);
    if (!problem) {
      return {
        kind: "reply",
        reply: askProblemMessage(profile.clientName || "आप"),
        funnelStage: "awaiting_details",
        intakeStep: "awaiting_problem",
        intakeProfile: profile,
        clientName: profile.clientName,
      };
    }
    profile.problem = problem.label;
    profile.problemCode = problem.code;
    return {
      kind: "reply",
      reply: askDurationMessage(),
      funnelStage: "awaiting_details",
      intakeStep: "awaiting_duration",
      intakeProfile: profile,
      clientName: profile.clientName,
    };
  }

  if (step === "awaiting_duration") {
    if (!text || text.length < 1) {
      return {
        kind: "reply",
        reply: askDurationMessage(),
        funnelStage: "awaiting_details",
        intakeStep: "awaiting_duration",
        intakeProfile: profile,
        clientName: profile.clientName,
      };
    }
    profile.duration = text.slice(0, 200);
    return {
      kind: "reply",
      reply: askPriorAttemptsMessage(),
      funnelStage: "awaiting_details",
      intakeStep: "awaiting_prior_attempts",
      intakeProfile: profile,
      clientName: profile.clientName,
    };
  }

  if (step === "awaiting_prior_attempts") {
    profile.priorAttempts = text ? text.slice(0, 400) : "नहीं बताया";
    return {
      kind: "reply",
      reply: askBirthDetailsMessage(),
      funnelStage: "awaiting_details",
      intakeStep: "awaiting_birth_details",
      intakeProfile: profile,
      clientName: profile.clientName,
    };
  }

  if (step === "awaiting_birth_details") {
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
      return {
        kind: "reply",
        reply: askMissingBirthFieldsMessage(fields),
        funnelStage: "awaiting_details",
        intakeStep: "awaiting_birth_details",
        intakeProfile: profile,
        clientName: profile.clientName,
      };
    }

    return {
      kind: "reply",
      reply: confirmAndAskQuestionMessage(),
      funnelStage: "awaiting_details",
      intakeStep: "awaiting_question",
      intakeProfile: profile,
      clientName: profile.clientName,
    };
  }

  if (step === "awaiting_question") {
    profile.specialQuestion = text
      ? text.slice(0, 500)
      : "कोई विशेष प्रश्न नहीं";
    const pricing = getConsultationPricing();
    return {
      kind: "reply",
      reply: packageFeeAndAskHaanMessage(pricing.priceInrFormatted),
      funnelStage: "awaiting_details",
      intakeStep: "awaiting_haan",
      intakeProfile: profile,
      clientName: profile.clientName,
    };
  }

  // awaiting_haan
  if (isAffirmativeReady(text) || isPaymentIntent(text)) {
    return {
      kind: "ready_for_payment",
      reply:
        "🙏 धन्यवाद। मैं तुरंत भुगतान की प्रक्रिया शुरू कर रहा हूँ।",
      intakeProfile: profile,
      clientName: profile.clientName,
    };
  }

  return {
    kind: "reply",
    reply: reAskHaanMessage(),
    funnelStage: "awaiting_details",
    intakeStep: "awaiting_haan",
    intakeProfile: profile,
    clientName: profile.clientName,
  };
}

export function startScriptedIntake(): IntakeHandlerResult {
  return {
    kind: "reply",
    reply: welcomeMessage(),
    funnelStage: "awaiting_details",
    intakeStep: "awaiting_name",
    intakeProfile: {},
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
