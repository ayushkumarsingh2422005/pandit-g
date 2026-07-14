import { after, NextRequest, NextResponse } from "next/server";
import { acknowledgeIncomingMessages } from "@/lib/whatsapp/acknowledge";
import { getWhatsAppConfigOptional } from "@/lib/whatsapp/config";
import { processWhatsAppWebhook } from "@/lib/whatsapp/process-webhook";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types";

export const runtime = "nodejs";

// Hobby plan max is 10s. AI runs here; typing delay is a separate route.
export const maxDuration = 10;

/**
 * Meta WhatsApp Cloud API — webhook verification (GET)
 *
 * Configure in Meta Developer Console:
 * Callback URL: https://YOUR_DOMAIN/api/webhooks/whatsapp
 * Verify token: same as WHATSAPP_VERIFY_TOKEN in .env
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const { verifyToken } = getWhatsAppConfigOptional();

  if (!verifyToken) {
    return NextResponse.json(
      { error: "WHATSAPP_VERIFY_TOKEN is not configured" },
      { status: 500 },
    );
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Meta WhatsApp Cloud API — incoming messages & status updates (POST)
 *
 * Vercel flow:
 * 1. Mark read + typing immediately (blue ticks, "typing...")
 * 2. Return 200 to Meta fast
 * 3. Run AI + reply in background via after()
 */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as WhatsAppWebhookPayload;

    if (payload.object !== "whatsapp_business_account") {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    await acknowledgeIncomingMessages(payload);

    after(async () => {
      try {
        await processWhatsAppWebhook(payload);
      } catch (error) {
        console.error("[whatsapp webhook]", error);
      }
    });

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[whatsapp webhook]", error);
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
