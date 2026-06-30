import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "pandit_admin_session";
const SESSION_MS = 24 * 60 * 60 * 1000;

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_ID && process.env.ADMIN_PASSWORD);
}

export function verifyAdminCredentials(
  id: string,
  password: string,
): boolean {
  const expectedId = process.env.ADMIN_ID ?? "";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!expectedId || !expectedPassword) return false;

  const idOk =
    id.length === expectedId.length &&
    timingSafeEqual(Buffer.from(id), Buffer.from(expectedId));
  const passOk =
    password.length === expectedPassword.length &&
    timingSafeEqual(Buffer.from(password), Buffer.from(expectedPassword));

  return idOk && passOk;
}

function sessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    process.env.ADMIN_PASSWORD ??
    "pandit-admin-fallback"
  );
}

export function createSessionToken(): string {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_MS });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", sessionSecret())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;

  const expected = createHmac("sha256", sessionSecret())
    .update(payloadB64)
    .digest("base64url");

  try {
    if (sig.length !== expected.length) return false;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const { exp } = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as { exp?: number };
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    return false;
  }
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

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

export function isAdminRequest(request: NextRequest): boolean {
  return verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
