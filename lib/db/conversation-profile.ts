import { getDb } from "./mongodb";
import { isDbConfigured } from "./is-configured";

export type ClientBirthProfile = {
  dobLabel?: string;
  timeLabel?: string;
  place?: string;
  rashi?: string;
  summary?: string;
  fromPalmPhoto?: boolean;
};

const COLLECTION = "conversations";

export async function getClientBirthProfile(
  phone: string,
): Promise<ClientBirthProfile | null> {
  if (!isDbConfigured()) return null;

  const db = await getDb();
  const doc = await db
    .collection(COLLECTION)
    .findOne({ phone }, { projection: { birthProfile: 1 } });

  return (doc?.birthProfile as ClientBirthProfile | undefined) ?? null;
}

export async function saveClientBirthProfile(
  phone: string,
  profile: ClientBirthProfile,
): Promise<void> {
  if (!isDbConfigured()) return;

  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { phone },
    {
      $set: {
        birthProfile: profile,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function getClientName(phone: string): Promise<string | null> {
  if (!isDbConfigured()) return null;

  const db = await getDb();
  const doc = await db
    .collection(COLLECTION)
    .findOne({ phone }, { projection: { clientName: 1 } });

  const name = doc?.clientName;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

export async function saveClientName(
  phone: string,
  clientName: string,
): Promise<void> {
  if (!isDbConfigured()) return;

  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { phone },
    {
      $set: {
        clientName: clientName.trim(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}
