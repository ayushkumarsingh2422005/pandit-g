import { after, NextRequest, NextResponse } from "next/server";
import { sleep } from "@/lib/funnel/config";
import { markMessageAsRead, sendTextMessage } from "@/lib/whatsapp/client";

export const runtime = "nodejs";
/** Hobby max is 10s — this route only sleeps + sends (AI already done). */
export const maxDuration = 10;

type DelayedSendBody = {
  to?: string;
  body?: string;
  delayMs?: number;
  replyToMessageId?: string;
};

function isAuthorized(request: NextRequest): boolean {
  const secret =
    process.env.INTERNAL_API_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token === secret;
}

/**
 * Separate invocation so typing delay does not share Hobby's 10s with AI.
 * Webhook generates → POSTs here → we sleep → send WhatsApp message.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: DelayedSendBody;
  try {
    payload = (await request.json()) as DelayedSendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const to = payload.to?.trim();
  const body = payload.body?.trim();
  if (!to || !body) {
    return NextResponse.json(
      { error: "to and body are required" },
      { status: 400 },
    );
  }

  // Cap to Hobby window (leave ~1.5s for WhatsApp API).
  const delayMs = Math.min(
    Math.max(0, Number(payload.delayMs) || 0),
    8500,
  );
  const replyToMessageId = payload.replyToMessageId;

  after(async () => {
    try {
      if (delayMs > 0) {
        const started = Date.now();
        // Refresh typing once mid-wait if delay is long enough.
        if (replyToMessageId && delayMs > 4000) {
          await sleep(Math.floor(delayMs / 2));
          try {
            await markMessageAsRead(replyToMessageId);
          } catch {
            /* best-effort */
          }
          const left = delayMs - (Date.now() - started);
          if (left > 0) await sleep(left);
        } else {
          await sleep(delayMs);
        }
      }

      await sendTextMessage({ to, body });
    } catch (error) {
      console.error("[delayed-send]", error);
    }
  });

  return NextResponse.json({ status: "scheduled", delayMs }, { status: 202 });
}
