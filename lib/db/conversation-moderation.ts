import { getDb } from "./mongodb";
import { isDbConfigured } from "./is-configured";

const COLLECTION = "conversations";
const DEFAULT_STRIKE_THRESHOLD = 2;

function getStrikeThreshold(): number {
  const parsed = Number(process.env.MODERATION_ABUSE_STRIKES);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_STRIKE_THRESHOLD;
}

export async function isConversationBlocked(phone: string): Promise<boolean> {
  if (!isDbConfigured()) return false;

  const db = await getDb();
  const doc = await db
    .collection(COLLECTION)
    .findOne({ phone }, { projection: { blocked: 1 } });

  return Boolean(doc?.blocked);
}

export async function blockConversation(
  phone: string,
  reason: string,
): Promise<void> {
  if (!isDbConfigured()) return;

  const db = await getDb();
  const now = new Date();

  await db.collection(COLLECTION).updateOne(
    { phone },
    {
      $set: {
        blocked: true,
        blockedAt: now,
        blockReason: reason,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
}

export async function unblockConversation(phone: string): Promise<void> {
  if (!isDbConfigured()) return;

  const db = await getDb();
  const now = new Date();

  await db.collection(COLLECTION).updateOne(
    { phone },
    {
      $set: { updatedAt: now, abuseStrikes: 0 },
      $unset: { blocked: "", blockedAt: "", blockReason: "" },
    },
  );
}

export async function incrementAbuseStrike(phone: string): Promise<number> {
  if (!isDbConfigured()) return 1;

  const db = await getDb();
  const now = new Date();

  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { phone },
    {
      $inc: { abuseStrikes: 1 },
      $set: { updatedAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );

  return typeof result?.abuseStrikes === "number" ? result.abuseStrikes : 1;
}

export function getAbuseStrikeThreshold(): number {
  return getStrikeThreshold();
}
