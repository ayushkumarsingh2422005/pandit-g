import { NextRequest } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin/auth";
import {
  appendAdminOutboundMessage,
  clearConversation,
  getConversationDetail,
} from "@/lib/db/admin";
import {
  blockConversation,
  unblockConversation,
} from "@/lib/db/conversation-moderation";
import { sendTextMessage } from "@/lib/whatsapp/client";

type RouteContext = { params: Promise<{ phone: string }> };

function decodePhone(encoded: string): string {
  return decodeURIComponent(encoded);
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const { phone: encoded } = await context.params;
  const phone = decodePhone(encoded);
  const detail = await getConversationDetail(phone);

  if (!detail) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  return Response.json({ conversation: detail });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const { phone: encoded } = await context.params;
  const phone = decodePhone(encoded);
  const deleted = await clearConversation(phone);

  return Response.json({ ok: true, deleted });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminRequest(request)) return unauthorizedResponse();

  const { phone: encoded } = await context.params;
  const phone = decodePhone(encoded);

  let body: { action?: string; message?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;

  if (action === "send") {
    const message = body.message?.trim();
    if (!message) {
      return Response.json({ error: "Message required" }, { status: 400 });
    }
    try {
      await sendTextMessage({ to: phone, body: message });
      await appendAdminOutboundMessage(phone, message);
      return Response.json({ ok: true });
    } catch (error) {
      console.error("[admin send]", error);
      return Response.json(
        { error: "Failed to send WhatsApp message" },
        { status: 502 },
      );
    }
  }

  if (action === "block") {
    await blockConversation(phone, body.reason ?? "admin_manual");
    return Response.json({ ok: true, blocked: true });
  }

  if (action === "unblock") {
    await unblockConversation(phone);
    return Response.json({ ok: true, blocked: false });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
