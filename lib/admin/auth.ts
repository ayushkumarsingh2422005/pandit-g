import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { countAdmins, findAdminByEmail } from "@/lib/db/admins";
import { isDbConfigured } from "@/lib/db/is-configured";
import { verifyPassword } from "./password";

export const ADMIN_COOKIE = "pandit_admin_session";
const SESSION_MS = 24 * 60 * 60 * 1000;

export type AdminSession = {
  adminId: string;
  email: string;
  name: string;
  exp: number;
};

export function isAdminAuthReady(): boolean {
  return isDbConfigured() && Boolean(process.env.ADMIN_SESSION_SECRET?.trim());
}

export async function hasAnyAdminUsers(): Promise<boolean> {
  if (!isDbConfigured()) return false;
  return (await countAdmins()) > 0;
}

export async function authenticateAdmin(
  email: string,
  password: string,
): Promise<AdminSession | null> {
  const admin = await findAdminByEmail(email);
  if (!admin) return null;

  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) return null;

  return {
    adminId: admin._id.toHexString(),
    email: admin.email,
    name: admin.name,
    exp: Date.now() + SESSION_MS,
  };
}

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error('Missing required environment variable: "ADMIN_SESSION_SECRET"');
  }
  return secret;
}

export function createSessionToken(session: Omit<AdminSession, "exp">): string {
  const payload: AdminSession = {
    ...session,
    exp: Date.now() + SESSION_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function parseSessionToken(
  token: string | undefined,
): AdminSession | null {
  if (!token) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  try {
    const secret = process.env.ADMIN_SESSION_SECRET?.trim();
    if (!secret) return null;

    const expected = createHmac("sha256", secret)
      .update(payloadB64)
      .digest("base64url");

    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as Partial<AdminSession>;

    if (
      typeof payload.adminId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.exp !== "number" ||
      Date.now() >= payload.exp
    ) {
      return null;
    }

    return {
      adminId: payload.adminId,
      email: payload.email,
      name: payload.name,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function verifySessionToken(token: string | undefined): boolean {
  return parseSessionToken(token) !== null;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MS / 1000,
  };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return parseSessionToken(store.get(ADMIN_COOKIE)?.value);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  return (await getAdminSession()) !== null;
}

export function getAdminSessionFromRequest(
  request: NextRequest,
): AdminSession | null {
  return parseSessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
}

export function isAdminRequest(request: NextRequest): boolean {
  return getAdminSessionFromRequest(request) !== null;
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
