import { getDb } from "./mongodb";

import { randomUUID } from "crypto";
import type { IntakeProfile, IntakeStep } from "@/lib/funnel/intake-script";

export type ChatRole = "user" | "assistant";

export type StoredChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
  editedAt?: Date;
};

export function createStoredMessage(
  role: ChatRole,
  content: string,
  createdAt = new Date(),
): StoredChatMessage {
  return { id: randomUUID(), role, content, createdAt };
}

/** Client onboarding funnel stages. */
export type FunnelStage =
  | "initial"
  | "awaiting_details"
  | "reading_delivered"
  | "active";

export type { IntakeStep, IntakeProfile };

export type ConversationIntakeState = {
  intakeStep: IntakeStep | null;
  intakeProfile: IntakeProfile;
  clientName?: string;
  funnelStage: FunnelStage | null;
};

const COLLECTION = "conversations";
const DEFAULT_HISTORY_LIMIT = 40;
const DEFAULT_STORED_MESSAGES = 80;

function getHistoryLimit(): number {
  const parsed = Number(process.env.CHAT_HISTORY_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HISTORY_LIMIT;
}

function getStoredMessageLimit(): number {
  const parsed = Number(process.env.CHAT_STORED_MESSAGES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STORED_MESSAGES;
}

let indexesReady: Promise<void> | null = null;

async function ensureDbReady(): Promise<void> {
  if (!indexesReady) {
    indexesReady = ensureConversationIndexes().catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
}

export async function getConversationFunnelStage(
  phone: string,
): Promise<FunnelStage | null> {
  await ensureDbReady();
  const db = await getDb();
  const doc = await db
    .collection(COLLECTION)
    .findOne({ phone }, { projection: { funnelStage: 1 } });

  return (doc?.funnelStage as FunnelStage | undefined) ?? null;
}

export async function getConversationIntakeState(
  phone: string,
): Promise<ConversationIntakeState> {
  await ensureDbReady();
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne(
    { phone },
    {
      projection: {
        funnelStage: 1,
        intakeStep: 1,
        intakeProfile: 1,
        clientName: 1,
      },
    },
  );

  return {
    funnelStage: (doc?.funnelStage as FunnelStage | undefined) ?? null,
    intakeStep: (doc?.intakeStep as IntakeStep | undefined) ?? null,
    intakeProfile: (doc?.intakeProfile as IntakeProfile | undefined) ?? {},
    clientName: doc?.clientName as string | undefined,
  };
}

export async function getConversationHistory(
  phone: string,
): Promise<StoredChatMessage[]> {
  await ensureDbReady();
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne(
    { phone },
    { projection: { messages: { $slice: -getHistoryLimit() } } },
  );

  if (!doc?.messages?.length) {
    return [];
  }

  return doc.messages as StoredChatMessage[];
}

export type SaveConversationTurnOptions = {
  funnelStage?: FunnelStage;
  intakeStep?: IntakeStep | null;
  intakeProfile?: IntakeProfile;
  /** Name collected in scripted intake (preferred over WhatsApp push name). */
  clientName?: string;
};

export async function saveConversationTurn(
  phone: string,
  userMessage: string,
  assistantReply: string,
  contactName?: string,
  funnelStage?: FunnelStage,
  options?: SaveConversationTurnOptions,
): Promise<void> {
  await ensureDbReady();
  const db = await getDb();
  const now = new Date();
  const newMessages: StoredChatMessage[] = [
    createStoredMessage("user", userMessage, now),
    createStoredMessage("assistant", assistantReply, now),
  ];

  const setFields: Record<string, unknown> = { updatedAt: now };
  if (contactName) setFields.contactName = contactName;
  const stage = options?.funnelStage ?? funnelStage;
  if (stage) setFields.funnelStage = stage;
  if (options?.intakeStep !== undefined) {
    setFields.intakeStep = options.intakeStep;
  }
  if (options?.intakeProfile) {
    setFields.intakeProfile = options.intakeProfile;
  }
  if (options?.clientName) {
    setFields.clientName = options.clientName;
  }

  const update: Record<string, unknown> = {
    $set: setFields,
    $push: {
      messages: {
        $each: newMessages,
        $slice: -getStoredMessageLimit(),
      },
    },
  };

  await db.collection(COLLECTION).updateOne({ phone }, update, { upsert: true });
}

export async function ensureConversationIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).createIndex({ phone: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ updatedAt: -1 });
}
