import { getDb } from "./mongodb";

export type ChatRole = "user" | "assistant";

export type StoredChatMessage = {
  role: ChatRole;
  content: string;
  createdAt: Date;
};

/** Client onboarding funnel stages. */
export type FunnelStage =
  | "initial"
  | "awaiting_details"
  | "reading_delivered"
  | "active";

const COLLECTION = "conversations";
const DEFAULT_HISTORY_LIMIT = 20;
const DEFAULT_STORED_MESSAGES = 40;

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

export async function saveConversationTurn(
  phone: string,
  userMessage: string,
  assistantReply: string,
  contactName?: string,
  funnelStage?: FunnelStage,
): Promise<void> {
  await ensureDbReady();
  const db = await getDb();
  const now = new Date();
  const newMessages: StoredChatMessage[] = [
    { role: "user", content: userMessage, createdAt: now },
    { role: "assistant", content: assistantReply, createdAt: now },
  ];

  const setFields: Record<string, unknown> = { updatedAt: now };
  if (contactName) setFields.contactName = contactName;
  if (funnelStage) setFields.funnelStage = funnelStage;

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
