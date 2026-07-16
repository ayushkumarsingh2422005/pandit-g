import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSessionFromRequest,
  unauthorizedResponse,
} from "@/lib/admin/auth";
import { hashPassword, isStrongPassword } from "@/lib/admin/password";
import {
  countAdmins,
  createAdmin,
  deleteAdmin,
  ensureAdminsIndexes,
  findAdminByEmail,
  listAdmins,
} from "@/lib/db/admins";
import { isDbConfigured } from "@/lib/db/is-configured";

export async function GET(request: NextRequest) {
  if (!getAdminSessionFromRequest(request)) return unauthorizedResponse();
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const admins = await listAdmins();
  return NextResponse.json({ admins });
}

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return unauthorizedResponse();
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { email?: string; name?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const name = body.name?.trim() ?? "";
  const password = body.password ?? "";

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const existing = await findAdminByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "An admin with this email already exists" },
      { status: 409 },
    );
  }

  await ensureAdminsIndexes();
  const passwordHash = await hashPassword(password);
  const admin = await createAdmin({ email, name, passwordHash });

  return NextResponse.json({ ok: true, admin }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return unauthorizedResponse();
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "Admin id is required" }, { status: 400 });
  }

  if (id === session.adminId) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 },
    );
  }

  const total = await countAdmins();
  if (total <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the last admin account" },
      { status: 400 },
    );
  }

  const deleted = await deleteAdmin(id);
  if (!deleted) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
