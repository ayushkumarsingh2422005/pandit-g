import { ObjectId, type WithId } from "mongodb";
import { getDb } from "./mongodb";
import { isDbConfigured } from "./is-configured";

const COLLECTION = "admins";

export type AdminUser = {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
};

export type AdminPublic = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

function toPublic(doc: WithId<Omit<AdminUser, "_id">>): AdminPublic {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function ensureAdminsIndexes(): Promise<void> {
  if (!isDbConfigured()) return;
  const db = await getDb();
  await db.collection(COLLECTION).createIndex({ email: 1 }, { unique: true });
}

export async function countAdmins(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = await getDb();
  return db.collection(COLLECTION).countDocuments();
}

export async function findAdminByEmail(
  email: string,
): Promise<AdminUser | null> {
  if (!isDbConfigured()) return null;
  const db = await getDb();
  const doc = await db
    .collection(COLLECTION)
    .findOne({ email: normalizeEmail(email) });
  return doc as AdminUser | null;
}

export async function findAdminById(id: string): Promise<AdminUser | null> {
  if (!isDbConfigured() || !ObjectId.isValid(id)) return null;
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne({
    _id: new ObjectId(id),
  });
  return doc as AdminUser | null;
}

export async function listAdmins(): Promise<AdminPublic[]> {
  if (!isDbConfigured()) return [];
  const db = await getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({})
    .project({ passwordHash: 0, resetTokenHash: 0, resetTokenExpiresAt: 0 })
    .sort({ createdAt: 1 })
    .toArray();

  return docs.map((doc) =>
    toPublic(doc as WithId<Omit<AdminUser, "_id">>),
  );
}

export async function createAdmin(input: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<AdminPublic> {
  const db = await getDb();
  const now = new Date();
  const email = normalizeEmail(input.email);

  const result = await db.collection(COLLECTION).insertOne({
    email,
    name: input.name.trim(),
    passwordHash: input.passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: result.insertedId.toHexString(),
    email,
    name: input.name.trim(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export async function deleteAdmin(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const db = await getDb();
  const result = await db.collection(COLLECTION).deleteOne({
    _id: new ObjectId(id),
  });
  return result.deletedCount > 0;
}

export async function updateAdminPassword(
  id: string,
  passwordHash: string,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const db = await getDb();
  const result = await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { passwordHash, updatedAt: new Date() },
      $unset: { resetTokenHash: "", resetTokenExpiresAt: "" },
    },
  );
  return result.matchedCount > 0;
}

export async function setAdminResetToken(
  email: string,
  resetTokenHash: string,
  resetTokenExpiresAt: Date,
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = await getDb();
  const result = await db.collection(COLLECTION).updateOne(
    { email: normalizeEmail(email) },
    {
      $set: {
        resetTokenHash,
        resetTokenExpiresAt,
        updatedAt: new Date(),
      },
    },
  );
  return result.matchedCount > 0;
}

export async function findAdminByResetTokenHash(
  resetTokenHash: string,
): Promise<AdminUser | null> {
  if (!isDbConfigured()) return null;
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne({
    resetTokenHash,
    resetTokenExpiresAt: { $gt: new Date() },
  });
  return doc as AdminUser | null;
}

export async function clearAdminResetToken(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    {
      $unset: { resetTokenHash: "", resetTokenExpiresAt: "" },
      $set: { updatedAt: new Date() },
    },
  );
}
