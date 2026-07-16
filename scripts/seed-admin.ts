/**
 * Seed the first portal admin (no public signup).
 *
 * Usage:
 *   npm run seed:admin -- --email=you@example.com --password=Secret123 --name="Site Admin"
 *
 * Or env:
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME
 *
 * Requires MONGODB_URI (and optional MONGODB_DB_NAME) in the environment or .env.local.
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { MongoClient } from "mongodb";
import { hash } from "bcryptjs";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

function argValue(flag: string): string | undefined {
  const prefix = `${flag}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("-")) {
    return process.argv[idx + 1];
  }
  return undefined;
}

async function main() {
  const email = (
    argValue("--email") ||
    process.env.SEED_ADMIN_EMAIL ||
    ""
  )
    .trim()
    .toLowerCase();
  const password =
    argValue("--password") || process.env.SEED_ADMIN_PASSWORD || "";
  const name = (
    argValue("--name") ||
    process.env.SEED_ADMIN_NAME ||
    "Admin"
  ).trim();

  const uri = process.env.MONGODB_URI?.trim();
  const dbName = process.env.MONGODB_DB_NAME?.trim() || "pandit-g";

  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!email.includes("@")) {
    console.error("Provide a valid email via --email or SEED_ADMIN_EMAIL");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error(
      "Provide a password (min 8 chars) via --password or SEED_ADMIN_PASSWORD",
    );
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const admins = db.collection("admins");

  await admins.createIndex({ email: 1 }, { unique: true });

  const existingCount = await admins.countDocuments();
  if (existingCount > 0) {
    const force = process.argv.includes("--force");
    if (!force) {
      console.error(
        `Admins already exist (${existingCount}). Refusing to seed.\n` +
          "Use the Admin → Users panel to add more, or pass --force to add anyway.",
      );
      await client.close();
      process.exit(1);
    }
  }

  const duplicate = await admins.findOne({ email });
  if (duplicate) {
    console.error(`Admin already exists: ${email}`);
    await client.close();
    process.exit(1);
  }

  const now = new Date();
  const passwordHash = await hash(password, 12);
  const result = await admins.insertOne({
    email,
    name,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  console.log("First admin created:");
  console.log(`  id:    ${result.insertedId.toHexString()}`);
  console.log(`  email: ${email}`);
  console.log(`  name:  ${name}`);
  console.log("Sign in at /admin/login");

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
