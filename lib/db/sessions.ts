import { getDb } from "./mongodb";

export type SessionStatus = "active" | "expired";

export type ConsultationSession = {
  phone: string;
  paymentLinkId?: string;
  razorpayPaymentId?: string;
  amountPaise: number;
  status: SessionStatus;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
};

const COLLECTION = "sessions";

let indexesReady: Promise<void> | null = null;

async function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const db = await getDb();
      await db.collection(COLLECTION).createIndex({ phone: 1, status: 1 });
      await db.collection(COLLECTION).createIndex({ endsAt: 1 });
    })().catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
}

export async function startConsultationSession(input: {
  phone: string;
  durationMinutes: number;
  amountPaise: number;
  paymentLinkId?: string;
  razorpayPaymentId?: string;
}): Promise<ConsultationSession> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  const endsAt = new Date(now.getTime() + input.durationMinutes * 60 * 1000);

  await db.collection(COLLECTION).updateMany(
    { phone: input.phone, status: "active" },
    { $set: { status: "expired" } },
  );

  const session: ConsultationSession = {
    phone: input.phone,
    paymentLinkId: input.paymentLinkId,
    razorpayPaymentId: input.razorpayPaymentId,
    amountPaise: input.amountPaise,
    status: "active",
    startsAt: now,
    endsAt,
    createdAt: now,
  };

  await db.collection(COLLECTION).insertOne(session);
  return session;
}

export async function getActiveSession(
  phone: string,
): Promise<ConsultationSession | null> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();

  const session = (await db.collection(COLLECTION).findOne({
    phone,
    status: "active",
    endsAt: { $gt: now },
  })) as ConsultationSession | null;

  if (!session) {
    await db.collection(COLLECTION).updateMany(
      { phone, status: "active", endsAt: { $lte: now } },
      { $set: { status: "expired" } },
    );
    return null;
  }

  return session;
}

export async function getLastExpiredSession(
  phone: string,
): Promise<ConsultationSession | null> {
  await ensureIndexes();
  const db = await getDb();

  return db.collection(COLLECTION).findOne(
    { phone, status: "expired" },
    { sort: { endsAt: -1 } },
  ) as Promise<ConsultationSession | null>;
}
