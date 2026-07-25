import type { FunnelStage, StoredChatMessage } from "./conversations";
import { createStoredMessage } from "./conversations";
import { getDb } from "./mongodb";
import { isDbConfigured } from "./is-configured";
import type { PaymentRecord } from "./payments";

export type ConversationListItem = {
  phone: string;
  clientName?: string;
  funnelStage?: FunnelStage;
  blocked: boolean;
  blockReason?: string;
  messageCount: number;
  updatedAt?: string;
  lastMessage?: string;
};

export type AdminMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  editedAt?: string;
};

export type ConversationDetail = ConversationListItem & {
  messages: AdminMessage[];
  birthProfile?: Record<string, unknown>;
  abuseStrikes?: number;
  blockedAt?: string;
};

export type PaymentListItem = {
  phone: string;
  paymentLinkId: string;
  shortUrl: string;
  amountInr: number;
  status: string;
  channel?: string;
  referenceId?: string;
  contactName?: string;
  razorpayPaymentId?: string;
  createdAt: string;
  paidAt?: string;
};

const CONVERSATIONS = "conversations";
const PAYMENTS = "payments";

export async function listConversations(options?: {
  search?: string;
  blocked?: boolean;
  limit?: number;
}): Promise<ConversationListItem[]> {
  if (!isDbConfigured()) return [];

  const db = await getDb();
  const limit = options?.limit ?? 100;
  const filter: Record<string, unknown> = {};

  if (options?.blocked === true) {
    filter.blocked = true;
  } else if (options?.blocked === false) {
    filter.blocked = { $ne: true };
  }

  if (options?.search?.trim()) {
    const q = options.search.trim();
    const searchClause = {
      $or: [
        { phone: { $regex: q, $options: "i" } },
        { clientName: { $regex: q, $options: "i" } },
        { contactName: { $regex: q, $options: "i" } },
      ],
    };
    if (Object.keys(filter).length > 0) {
      filter.$and = [searchClause];
      delete filter.blocked;
      if (options?.blocked === true) {
        (filter.$and as Record<string, unknown>[]).unshift({ blocked: true });
      } else if (options?.blocked === false) {
        (filter.$and as Record<string, unknown>[]).unshift({
          blocked: { $ne: true },
        });
      }
    } else {
      Object.assign(filter, searchClause);
    }
  }

  const docs = await db
    .collection(CONVERSATIONS)
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map((doc) => {
    const messages = (doc.messages as StoredChatMessage[] | undefined) ?? [];
    const last = messages[messages.length - 1];
    return {
      phone: doc.phone as string,
      clientName:
        (doc.clientName as string | undefined) ||
        (doc.contactName as string | undefined),
      funnelStage: doc.funnelStage as FunnelStage | undefined,
      blocked: Boolean(doc.blocked),
      blockReason: doc.blockReason as string | undefined,
      messageCount: messages.length,
      updatedAt: doc.updatedAt
        ? new Date(doc.updatedAt as Date).toISOString()
        : undefined,
      lastMessage: last?.content?.slice(0, 120),
    };
  });
}

export async function getConversationDetail(
  phone: string,
): Promise<ConversationDetail | null> {
  if (!isDbConfigured()) return null;

  const db = await getDb();
  const doc = await db.collection(CONVERSATIONS).findOne({ phone });
  if (!doc) return null;

  const messages = mapStoredMessages(
    (doc.messages as StoredChatMessage[]) ?? [],
  );

  const last = messages[messages.length - 1];

  return {
    phone: doc.phone as string,
    clientName:
      (doc.clientName as string | undefined) ||
      (doc.contactName as string | undefined),
    funnelStage: doc.funnelStage as FunnelStage | undefined,
    blocked: Boolean(doc.blocked),
    blockReason: doc.blockReason as string | undefined,
    messageCount: messages.length,
    updatedAt: doc.updatedAt
      ? new Date(doc.updatedAt as Date).toISOString()
      : undefined,
    lastMessage: last?.content?.slice(0, 120),
    messages,
    birthProfile: doc.birthProfile as Record<string, unknown> | undefined,
    abuseStrikes: doc.abuseStrikes as number | undefined,
    blockedAt: doc.blockedAt
      ? new Date(doc.blockedAt as Date).toISOString()
      : undefined,
  };
}

/** Reset chat — fresh funnel for this number. */
export async function clearConversation(phone: string): Promise<boolean> {
  if (!isDbConfigured()) return false;

  const db = await getDb();
  const result = await db.collection(CONVERSATIONS).deleteOne({ phone });
  return result.deletedCount > 0;
}

export async function appendAdminOutboundMessage(
  phone: string,
  body: string,
): Promise<void> {
  if (!isDbConfigured()) return;

  const db = await getDb();
  const now = new Date();
  const entry = createStoredMessage("assistant", body, now);

  await db.collection(CONVERSATIONS).updateOne(
    { phone },
    {
      $set: { updatedAt: now },
      $push: {
        messages: {
          $each: [entry],
          $slice: -80,
        },
      },
    } as Record<string, unknown>,
    { upsert: true },
  );
}

export async function listPayments(limit = 100): Promise<PaymentListItem[]> {
  if (!isDbConfigured()) return [];

  const db = await getDb();
  const docs = await db
    .collection(PAYMENTS)
    .find({})
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map((doc) => {
    const record = doc as unknown as PaymentRecord;
    return {
      phone: record.phone,
      paymentLinkId: record.paymentLinkId,
      shortUrl: record.shortUrl,
      amountInr: record.amountPaise / 100,
      status: record.status,
      channel: record.channel ?? "payment_link",
      referenceId: record.referenceId,
      contactName: record.contactName,
      razorpayPaymentId: record.razorpayPaymentId,
      createdAt: new Date(record.createdAt).toISOString(),
      paidAt: record.paidAt
        ? new Date(record.paidAt).toISOString()
        : undefined,
    };
  });
}

function mapStoredMessages(messages: StoredChatMessage[]): AdminMessage[] {
  return messages.map((m, index) => ({
    id: m.id ?? `legacy-${index}`,
    role: m.role,
    content: m.content,
    createdAt: new Date(m.createdAt).toISOString(),
    editedAt: m.editedAt ? new Date(m.editedAt).toISOString() : undefined,
  }));
}

export async function editConversationMessage(
  phone: string,
  messageId: string,
  content: string,
): Promise<boolean> {
  if (!isDbConfigured()) return false;

  const db = await getDb();
  const doc = await db.collection(CONVERSATIONS).findOne({ phone });
  if (!doc?.messages) return false;

  const messages = doc.messages as StoredChatMessage[];
  const index = messages.findIndex(
    (m, i) => (m.id ?? `legacy-${i}`) === messageId,
  );
  if (index < 0) return false;

  const now = new Date();
  messages[index] = {
    ...messages[index],
    id: messages[index].id ?? messageId,
    content: content.trim(),
    editedAt: now,
  };

  await db.collection(CONVERSATIONS).updateOne(
    { phone },
    { $set: { messages, updatedAt: now } },
  );
  return true;
}

export async function deleteConversationMessage(
  phone: string,
  messageId: string,
): Promise<boolean> {
  if (!isDbConfigured()) return false;

  const db = await getDb();
  const doc = await db.collection(CONVERSATIONS).findOne({ phone });
  if (!doc?.messages) return false;

  const messages = doc.messages as StoredChatMessage[];
  const next = messages.filter(
    (m, i) => (m.id ?? `legacy-${i}`) !== messageId,
  );
  if (next.length === messages.length) return false;

  await db.collection(CONVERSATIONS).updateOne(
    { phone },
    { $set: { messages: next, updatedAt: new Date() } },
  );
  return true;
}
