import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  findAdminByResetTokenHash,
  updateAdminPassword,
} from "@/lib/db/admins";
import { isDbConfigured } from "@/lib/db/is-configured";
import { hashPassword, isStrongPassword } from "@/lib/admin/password";

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database is not configured" },
      { status: 503 },
    );
  }

  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = body.token?.trim() ?? "";
  const password = body.password ?? "";

  if (!token) {
    return NextResponse.json({ error: "Reset token is required" }, { status: 400 });
  }
  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const resetTokenHash = createHash("sha256").update(token).digest("hex");
  const admin = await findAdminByResetTokenHash(resetTokenHash);
  if (!admin) {
    return NextResponse.json(
      { error: "Invalid or expired reset link" },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);
  await updateAdminPassword(admin._id.toHexString(), passwordHash);

  return NextResponse.json({
    ok: true,
    message: "Password updated. You can sign in now.",
  });
}
