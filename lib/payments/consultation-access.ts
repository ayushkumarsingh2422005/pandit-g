import {
  findReusablePaymentLink,
  findReusableWhatsAppPayment,
} from "@/lib/db/payments";
import { getActiveSession, getLastExpiredSession } from "@/lib/db/sessions";
import { isDbConfigured } from "@/lib/db/is-configured";
import { isRazorpayConfigured } from "@/lib/razorpay/is-configured";
import {
  isPaymentLinkFallbackEnabled,
  isWhatsAppPaymentsEnabled,
} from "@/lib/whatsapp/payments-config";

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
  pendingReferenceId?: string;
  minutesRemaining?: number;
};

function paymentsConfigured(): boolean {
  return isWhatsAppPaymentsEnabled() || isRazorpayConfigured();
}

export async function getConsultationAccess(
  phone: string,
): Promise<ConsultationAccess> {
  if (!isDbConfigured()) {
    return { hasAccess: false, reason: "never_paid" };
  }

  if (!paymentsConfigured()) {
    return { hasAccess: false, reason: "payment_not_configured" };
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

  if (isWhatsAppPaymentsEnabled()) {
    const pendingWa = await findReusableWhatsAppPayment(phone);
    if (pendingWa) {
      const expired = await getLastExpiredSession(phone);
      return {
        hasAccess: false,
        reason: expired ? "expired" : "pending_payment",
        pendingReferenceId:
          pendingWa.referenceId ?? pendingWa.paymentLinkId,
      };
    }
  }

  if (isPaymentLinkFallbackEnabled() || !isWhatsAppPaymentsEnabled()) {
    const pending = await findReusablePaymentLink(phone);
    if (pending?.shortUrl && !pending.shortUrl.startsWith("whatsapp:pay:")) {
      const expired = await getLastExpiredSession(phone);
      return {
        hasAccess: false,
        reason: expired ? "expired" : "pending_payment",
        pendingPaymentUrl: pending.shortUrl,
      };
    }
  }

  const expired = await getLastExpiredSession(phone);
  if (expired) {
    return { hasAccess: false, reason: "expired" };
  }

  return { hasAccess: false, reason: "never_paid" };
}
