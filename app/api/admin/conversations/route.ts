import { NextRequest } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin/auth";
import { listConversations } from "@/lib/db/admin";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const conversations = await listConversations({ search, limit: 200 });

  return Response.json({ conversations });
}
