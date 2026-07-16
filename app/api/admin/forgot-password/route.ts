import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { findAdminByEmail, setAdminResetToken } from "@/lib/db/admins";
import { isDbConfigured } from "@/lib/db/is-configured";
import {
  buildPasswordResetEmailHtml,
  isBrevoConfigured,
  sendTransactionalEmail,
} from "@/lib/email/brevo";

const RESET_TTL_MS = 60 * 60 * 1000;

function appBaseUrl(request: NextRequest): string {
  const fromEnv = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  // Always return a generic success message to avoid email enumeration
  const genericOk = NextResponse.json({
    ok: true,
    message:
      "If an account exists for that email, a reset link has been sent.",
  });

  if (!isDbConfigured()) {
    return genericOk;
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const admin = await findAdminByEmail(email);
  if (!admin) {
    return genericOk;
  }

  if (!isBrevoConfigured()) {
    console.error("[admin forgot-password] Brevo is not configured");
    return NextResponse.json(
      { error: "Password reset email is not configured. Contact the site owner." },
      { status: 503 },
    );
  }

  const rawToken = randomBytes(32).toString("hex");
  const resetTokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await setAdminResetToken(admin.email, resetTokenHash, expiresAt);

  const resetUrl = `${appBaseUrl(request)}/admin/reset-password?token=${rawToken}`;
  const sent = await sendTransactionalEmail({
    toEmail: admin.email,
    toName: admin.name,
    subject: "Reset your Pandit G admin password",
    htmlContent: buildPasswordResetEmailHtml({
      name: admin.name,
      resetUrl,
    }),
  });

  if (!sent.ok) {
    console.error("[admin forgot-password]", sent.error);
    return NextResponse.json(
      { error: "Could not send reset email. Try again later." },
      { status: 502 },
    );
  }

  return genericOk;
}
