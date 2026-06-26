import { findReusablePaymentLink } from "@/lib/db/payments";
import { getActiveSession, getLastExpiredSession } from "@/lib/db/sessions";
import { isDbConfigured } from "@/lib/db/is-configured";
import { isRazorpayConfigured } from "@/lib/razorpay/is-configured";

export type ConsultationAccessReason =
  | "active"
  | "never_paid"
  | "expired"
  | "pending_payment"
  | "payment_not_configured";

export type ConsultationAccess = {
  hasAccess: boolean;
  reason: ConsultationAccessReason;
  sessionEndsAt?: Date;
  pendingPaymentUrl?: string;
  minutesRemaining?: number;
};

export async function getConsultationAccess(
  phone: string,
): Promise<ConsultationAccess> {
  if (!isDbConfigured() || !isRazorpayConfigured()) {
    return { hasAccess: true, reason: "payment_not_configured" };
  }

  const active = await getActiveSession(phone);
  if (active) {
    const minutesRemaining = Math.max(
      0,
      Math.ceil((active.endsAt.getTime() - Date.now()) / 60000),
    );
    return {
      hasAccess: true,
      reason: "active",
      sessionEndsAt: active.endsAt,
      minutesRemaining,
    };
  }

  const pending = await findReusablePaymentLink(phone);
  if (pending?.shortUrl) {
    const expired = await getLastExpiredSession(phone);
    return {
      hasAccess: false,
      reason: expired ? "expired" : "pending_payment",
      pendingPaymentUrl: pending.shortUrl,
    };
  }

  const expired = await getLastExpiredSession(phone);
  if (expired) {
    return { hasAccess: false, reason: "expired" };
  }

  return { hasAccess: false, reason: "never_paid" };
}
