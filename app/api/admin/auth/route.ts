import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  authenticateAdmin,
  cookieOptions,
  createSessionToken,
  getAdminSessionFromRequest,
  hasAnyAdminUsers,
  isAdminAuthReady,
  unauthorizedResponse,
} from "@/lib/admin/auth";

export async function POST(request: NextRequest) {
  if (!isAdminAuthReady()) {
    return NextResponse.json(
      {
        error:
          "Admin auth not ready. Set MONGODB_URI and ADMIN_SESSION_SECRET, then run npm run seed:admin",
      },
      { status: 503 },
    );
  }

  if (!(await hasAnyAdminUsers())) {
    return NextResponse.json(
      {
        error:
          "No admin users yet. Create the first admin with: npm run seed:admin",
      },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string; id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Support legacy "id" field as email for older clients
  const email = (body.email ?? body.id)?.trim() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const session = await authenticateAdmin(email, password);
  if (!session) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    admin: {
      id: session.adminId,
      email: session.email,
      name: session.name,
    },
  });
  response.cookies.set(
    ADMIN_COOKIE,
    createSessionToken({
      adminId: session.adminId,
      email: session.email,
      name: session.name,
    }),
    cookieOptions(),
  );
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return unauthorizedResponse();
  return NextResponse.json({
    ok: true,
    admin: {
      id: session.adminId,
      email: session.email,
      name: session.name,
    },
  });
}
