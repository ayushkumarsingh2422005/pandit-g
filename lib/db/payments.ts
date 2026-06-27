import { getDb } from "./mongodb";

export type PaymentStatus = "created" | "paid" | "failed" | "expired";

export type PaymentRecord = {
  phone: string;
  paymentLinkId: string;
  shortUrl: string;
  amountPaise: number;
  status: PaymentStatus;
  contactName?: string;
  razorpayPaymentId?: string;
  webhookEventIds: string[];
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  expiresAt?: Date;
};

const COLLECTION = "payments";

let indexesReady: Promise<void> | null = null;

async function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const db = await getDb();
      await db.collection(COLLECTION).createIndex({ phone: 1, status: 1 });
      await db.collection(COLLECTION).createIndex(
        { paymentLinkId: 1 },
        { unique: true },
      );
      await db.collection(COLLECTION).createIndex({ razorpayPaymentId: 1 });
    })().catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
}

export async function createPaymentRecord(input: {
  phone: string;
  paymentLinkId: string;
  shortUrl: string;
  amountPaise: number;
  contactName?: string;
  expiresAt?: Date;
}): Promise<void> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();

  await db.collection(COLLECTION).insertOne({
    phone: input.phone,
    paymentLinkId: input.paymentLinkId,
    shortUrl: input.shortUrl,
    amountPaise: input.amountPaise,
    status: "created",
    contactName: input.contactName,
    webhookEventIds: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt,
  });
}

export async function findReusablePaymentLink(
  phone: string,
): Promise<PaymentRecord | null> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();

  const doc = await db.collection(COLLECTION).findOne(
    {
      phone,
      status: "created",
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
    },
    { sort: { createdAt: -1 } },
  );

  return doc as PaymentRecord | null;
}

export async function markPaymentPaid(input: {
  paymentLinkId?: string;
  razorpayPaymentId?: string;
  phone?: string;
  webhookEventId: string;
}): Promise<PaymentRecord | null> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();

  const query = input.paymentLinkId
    ? { paymentLinkId: input.paymentLinkId }
    : input.razorpayPaymentId
      ? { razorpayPaymentId: input.razorpayPaymentId }
      : input.phone
        ? { phone: input.phone, status: "created" }
        : null;

  if (!query) return null;

  const existing = (await db
    .collection(COLLECTION)
    .findOne(query)) as (PaymentRecord & { _id?: unknown }) | null;

  if (!existing) return null;

  if (existing.status === "paid") {
    await db.collection(COLLECTION).updateOne(
      { paymentLinkId: existing.paymentLinkId },
      { $addToSet: { webhookEventIds: input.webhookEventId } },
    );
    return null;
  }

  if (existing.webhookEventIds?.includes(input.webhookEventId)) {
    return null;
  }

  await db.collection(COLLECTION).updateOne(
    { paymentLinkId: existing.paymentLinkId },
    {
      $set: {
        status: "paid",
        paidAt: now,
        updatedAt: now,
        razorpayPaymentId:
          input.razorpayPaymentId ?? existing.razorpayPaymentId,
      },
      $addToSet: { webhookEventIds: input.webhookEventId },
    },
  );

  return {
    ...existing,
    status: "paid",
    paidAt: now,
    razorpayPaymentId: input.razorpayPaymentId ?? existing.razorpayPaymentId,
  };
}

export async function findPaymentByLinkId(
  paymentLinkId: string,
): Promise<PaymentRecord | null> {
  await ensureIndexes();
  const db = await getDb();
  return db
    .collection(COLLECTION)
    .findOne({ paymentLinkId }) as Promise<PaymentRecord | null>;
}
