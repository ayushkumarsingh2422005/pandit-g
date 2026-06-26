import { NextRequest, NextResponse } from "next/server";
import { processRazorpayWebhookEvent } from "@/lib/payments/process-razorpay-webhook";
import { getRazorpayConfig } from "@/lib/razorpay/config";
import { isRazorpayConfigured } from "@/lib/razorpay/is-configured";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay/verify-webhook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "Razorpay is not configured" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const { webhookSecret } = getRazorpayConfig();

  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    console.error("[razorpay webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    await processRazorpayWebhookEvent(payload);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[razorpay webhook]", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
