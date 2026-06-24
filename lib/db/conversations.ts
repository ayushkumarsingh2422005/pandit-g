import { getDb } from "./mongodb";

export type ChatRole = "user" | "assistant";

export type StoredChatMessage = {
  role: ChatRole;
  content: string;
  createdAt: Date;
};

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
): Promise<void> {
  await ensureDbReady();
  const db = await getDb();
  const now = new Date();
  const newMessages: StoredChatMessage[] = [
    { role: "user", content: userMessage, createdAt: now },
    { role: "assistant", content: assistantReply, createdAt: now },
  ];

  const update: Record<string, unknown> = {
    $set: { updatedAt: now },
    $push: {
      messages: {
        $each: newMessages,
        $slice: -getStoredMessageLimit(),
      },
    },
  };

  if (contactName) {
    (update.$set as Record<string, unknown>).contactName = contactName;
  }

  await db.collection(COLLECTION).updateOne({ phone }, update, { upsert: true });
}

export async function ensureConversationIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).createIndex({ phone: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ updatedAt: -1 });
}
