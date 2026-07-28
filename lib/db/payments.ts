import { getDb } from "./mongodb";

export type PaymentStatus = "created" | "paid" | "failed" | "expired";

export type PaymentChannel = "payment_link" | "whatsapp_pay";

export type PaymentRecord = {
  phone: string;
  /** Razorpay payment link id OR WhatsApp reference_id (unique). */
  paymentLinkId: string;
  /** rzp.io URL for links; whatsapp:pay:<ref> marker for native Pay Now. */
  shortUrl: string;
  amountPaise: number;
  status: PaymentStatus;
  channel?: PaymentChannel;
  /** Meta order_details reference_id (same as paymentLinkId for native). */
  referenceId?: string;
  contactName?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  webhookEventIds: string[];
  /** Set once when success WhatsApp text is sent — prevents duplicate messages. */
  successNotifiedAt?: Date;
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
      await db.collection(COLLECTION).createIndex(
        { referenceId: 1 },
        { unique: true, sparse: true },
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
  channel?: PaymentChannel;
  referenceId?: string;
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
    channel: input.channel ?? "payment_link",
    referenceId: input.referenceId,
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
      channel: { $ne: "whatsapp_pay" },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
    },
    { sort: { createdAt: -1 } },
  );

  return doc as PaymentRecord | null;
}

export async function findReusableWhatsAppPayment(
  phone: string,
): Promise<PaymentRecord | null> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();

  const doc = await db.collection(COLLECTION).findOne(
    {
      phone,
      status: "created",
      channel: "whatsapp_pay",
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
    },
    { sort: { createdAt: -1 } },
  );

  return doc as PaymentRecord | null;
}

export async function findLatestWhatsAppPayment(
  phone: string,
): Promise<PaymentRecord | null> {
  await ensureIndexes();
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne(
    {
      phone,
      channel: "whatsapp_pay",
    },
    { sort: { createdAt: -1 } },
  );
  return doc as PaymentRecord | null;
}

/**
 * Mark a payment paid. If already paid, returns the existing paid record
 * when `returnIfAlreadyPaid` is true (for session/message recovery).
 */
export async function markPaymentPaid(input: {
  paymentLinkId?: string;
  referenceId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  phone?: string;
  webhookEventId: string;
  returnIfAlreadyPaid?: boolean;
}): Promise<PaymentRecord | null> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();

  let existing: (PaymentRecord & { _id?: unknown }) | null = null;

  if (input.referenceId) {
    existing = (await db.collection(COLLECTION).findOne({
      $or: [
        { referenceId: input.referenceId },
        { paymentLinkId: input.referenceId },
      ],
    })) as (PaymentRecord & { _id?: unknown }) | null;
  } else if (input.paymentLinkId) {
    existing = (await db.collection(COLLECTION).findOne({
      paymentLinkId: input.paymentLinkId,
    })) as (PaymentRecord & { _id?: unknown }) | null;
  } else if (input.razorpayPaymentId) {
    existing = (await db.collection(COLLECTION).findOne({
      razorpayPaymentId: input.razorpayPaymentId,
    })) as (PaymentRecord & { _id?: unknown }) | null;
  } else if (input.phone) {
    existing = (await db.collection(COLLECTION).findOne(
      { phone: input.phone, status: "created" },
      { sort: { createdAt: -1 } },
    )) as (PaymentRecord & { _id?: unknown }) | null;
  }

  if (!existing) return null;

  if (existing.status === "paid") {
    await db.collection(COLLECTION).updateOne(
      { paymentLinkId: existing.paymentLinkId },
      { $addToSet: { webhookEventIds: input.webhookEventId } },
    );
    return input.returnIfAlreadyPaid ? existing : null;
  }

  if (existing.webhookEventIds?.includes(input.webhookEventId)) {
    return null;
  }

  // Atomic: only one concurrent webhook can flip created → paid
  const updated = (await db.collection(COLLECTION).findOneAndUpdate(
    { paymentLinkId: existing.paymentLinkId, status: "created" },
    {
      $set: {
        status: "paid",
        paidAt: now,
        updatedAt: now,
        razorpayPaymentId:
          input.razorpayPaymentId ?? existing.razorpayPaymentId,
        razorpayOrderId: input.razorpayOrderId ?? existing.razorpayOrderId,
      },
      $addToSet: { webhookEventIds: input.webhookEventId },
    },
    { returnDocument: "after" },
  )) as PaymentRecord | null;

  if (!updated || updated.status !== "paid") {
    // Lost race — another webhook already marked paid
    const paidDoc = (await db.collection(COLLECTION).findOne({
      paymentLinkId: existing.paymentLinkId,
    })) as PaymentRecord | null;
    return input.returnIfAlreadyPaid ? paidDoc : null;
  }

  return updated;
}

/**
 * Claim the right to send the one-time “दक्षिणा प्राप्त” WhatsApp message.
 * Returns true only for the first caller.
 */
export async function claimPaymentSuccessNotification(
  paymentLinkId: string,
): Promise<boolean> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();

  const doc = (await db.collection(COLLECTION).findOneAndUpdate(
    {
      paymentLinkId,
      status: "paid",
      successNotifiedAt: { $exists: false },
    },
    {
      $set: {
        successNotifiedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  )) as PaymentRecord | null;

  return Boolean(doc?.successNotifiedAt);
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
