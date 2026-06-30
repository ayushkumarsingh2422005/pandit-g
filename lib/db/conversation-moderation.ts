import { getDb } from "./mongodb";
import { isDbConfigured } from "./is-configured";
import { getFloodWindowMs } from "@/lib/moderation/detect-spam";

const COLLECTION = "conversations";
const DEFAULT_STRIKE_THRESHOLD = 2;
const INBOUND_TS_KEEP = 12;

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
      $unset: {
        blocked: "",
        blockedAt: "",
        blockReason: "",
        recentInboundAt: "",
      },
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

/** Track inbound timestamps for flood detection. */
export async function recordInboundMessage(phone: string): Promise<Date[]> {
  if (!isDbConfigured()) return [];

  const db = await getDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - getFloodWindowMs());

  const doc = await db.collection(COLLECTION).findOneAndUpdate(
    { phone },
    {
      $set: { updatedAt: now },
      $push: {
        recentInboundAt: {
          $each: [now],
          $slice: -INBOUND_TS_KEEP,
        },
      },
    } as Record<string, unknown>,
    { upsert: true, returnDocument: "after" },
  );

  const timestamps = (doc?.recentInboundAt as Date[] | undefined) ?? [now];
  return timestamps.filter((d) => new Date(d).getTime() >= cutoff.getTime());
}

export async function getRecentInboundTimestamps(
  phone: string,
): Promise<Date[]> {
  if (!isDbConfigured()) return [];

  const db = await getDb();
  const doc = await db
    .collection(COLLECTION)
    .findOne({ phone }, { projection: { recentInboundAt: 1 } });

  const timestamps = (doc?.recentInboundAt as Date[] | undefined) ?? [];
  const cutoff = Date.now() - getFloodWindowMs();
  return timestamps.filter((d) => new Date(d).getTime() >= cutoff);
}

export async function getRecentUserMessageTexts(
  phone: string,
  limit = 10,
): Promise<string[]> {
  if (!isDbConfigured()) return [];

  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne(
    { phone },
    { projection: { messages: { $slice: -limit * 2 } } },
  );

  const messages =
    (doc?.messages as { role: string; content: string }[] | undefined) ?? [];

  return messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .slice(-limit);
}
