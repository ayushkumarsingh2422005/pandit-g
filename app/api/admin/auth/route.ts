import { NextRequest, NextResponse } from "next/server";
import {
  cookieOptions,
  createSessionToken,
  isAdminConfigured,
  isAdminRequest,
  unauthorizedResponse,
  verifyAdminCredentials,
  ADMIN_COOKIE,
} from "@/lib/admin/auth";

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin credentials not configured in environment" },
      { status: 503 },
    );
  }

  let body: { id?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = body.id?.trim() ?? "";
  const password = body.password ?? "";

  if (!verifyAdminCredentials(id, password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createSessionToken(), cookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  return NextResponse.json({ ok: true });
}
