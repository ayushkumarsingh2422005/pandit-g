import { NextResponse } from "next/server";
import { getWhatsAppConfigOptional } from "@/lib/whatsapp/config";

export const runtime = "nodejs";

/**
 * GET /api/webhooks/whatsapp/health
 * Checks that WHATSAPP_ACCESS_TOKEN can access WHATSAPP_PHONE_NUMBER_ID.
 * Does not expose secrets — only reports ok/error.
 */
export async function GET() {
  const { accessToken, phoneNumberId, apiVersion } = getWhatsAppConfigOptional();

  if (!accessToken || !phoneNumberId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID",
      },
      { status: 500 },
    );
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        phoneNumberIdConfigured: phoneNumberId,
        hint:
          "Use Phone number ID from Meta → WhatsApp → API Setup (NOT WhatsApp Business Account ID). Token must be from the same app with whatsapp_business_messaging permission.",
        graphError: data,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    phoneNumberId,
    displayPhoneNumber: data.display_phone_number,
    verifiedName: data.verified_name,
  });
}
