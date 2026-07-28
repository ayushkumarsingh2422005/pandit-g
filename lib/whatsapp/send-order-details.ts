import { getConsultationPricing } from "@/lib/config/consultation-pricing";
import { getWhatsAppConfig } from "./config";
import { getWhatsAppPaymentConfig } from "./payments-config";

export type SendOrderDetailsInput = {
  to: string;
  referenceId: string;
  bodyText: string;
  footerText?: string;
  itemName?: string;
  contactName?: string;
  /** Override default consultation price (paise). */
  amountPaise?: number;
  /** Expire after this many seconds (min 300 per Meta). Default 3600. */
  expiresInSeconds?: number;
};

/**
 * Native in-chat Pay Now invoice (order_details + quick_pay).
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/pg/
 */
export async function sendOrderDetailsPayNow(
  input: SendOrderDetailsInput,
): Promise<{ messageId?: string }> {
  const { accessToken, phoneNumberId, apiVersion } = getWhatsAppConfig();
  const { configurationName } = getWhatsAppPaymentConfig();
  const pricing = getConsultationPricing();

  const amountValue = input.amountPaise ?? pricing.pricePaise;
  const expiresIn = Math.max(300, input.expiresInSeconds ?? 3600);
  const expirationTimestamp = String(
    Math.floor(Date.now() / 1000) + expiresIn,
  );

  const itemName =
    input.itemName ??
    `${pricing.sessionMinutes} मिनट WhatsApp परामर्श`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "interactive",
    interactive: {
      type: "order_details",
      body: {
        text: input.bodyText.slice(0, 1024),
      },
      footer: {
        text: (input.footerText ?? "Pandit G").slice(0, 60),
      },
      action: {
        name: "review_and_pay",
        parameters: {
          reference_id: input.referenceId,
          type: "digital-goods",
          payment_settings: [
            {
              type: "payment_gateway",
              payment_gateway: {
                type: "razorpay",
                configuration_name: configurationName,
                razorpay: {
                  receipt: input.referenceId.slice(0, 40),
                  notes: {
                    phone: input.to,
                    contactName: input.contactName ?? "",
                    product: "consultation_session",
                    reference_id: input.referenceId,
                  },
                },
              },
            },
          ],
          currency: "INR",
          total_amount: {
            value: amountValue,
            offset: 100,
          },
          order: {
            status: "pending",
            type: "quick_pay",
            expiration: {
              timestamp: expirationTimestamp,
              description: "भुगतान लिंक की समय सीमा समाप्त",
            },
            items: [
              {
                name: itemName.slice(0, 60),
                amount: {
                  value: amountValue,
                  offset: 100,
                },
                quantity: 1,
                country_of_origin: "India",
                importer_name: "Pandit G",
                importer_address: {
                  address_line1: "Lucknow",
                  city: "Lucknow",
                  zone_code: "UP",
                  postal_code: "226001",
                  country_code: "IN",
                },
              },
            ],
            subtotal: {
              value: amountValue,
              offset: 100,
            },
            tax: {
              value: 0,
              offset: 100,
              description: "Included",
            },
          },
        },
      },
    },
  };

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = (await response.json()) as {
    messages?: { id?: string }[];
    error?: unknown;
  };

  if (!response.ok) {
    throw new Error(
      `WhatsApp order_details failed (${response.status}): ${JSON.stringify(data)}`,
    );
  }

  return { messageId: data.messages?.[0]?.id };
}

export async function sendOrderStatusUpdate(input: {
  to: string;
  referenceId: string;
  /** PG invoices: pending | captured | failed. Shipping-style values kept for compat. */
  status:
    | "pending"
    | "captured"
    | "failed"
    | "processing"
    | "partially_shipped"
    | "shipped"
    | "completed"
    | "canceled";
  bodyText: string;
  description?: string;
}): Promise<void> {
  const { accessToken, phoneNumberId, apiVersion } = getWhatsAppConfig();

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "interactive",
        interactive: {
          type: "order_status",
          body: { text: input.bodyText.slice(0, 1024) },
          action: {
            name: "review_order",
            parameters: {
              reference_id: input.referenceId,
              order: {
                status: input.status,
                description: input.description,
              },
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      `WhatsApp order_status failed (${response.status}): ${JSON.stringify(data)}`,
    );
  }
}

/** Meta payment lookup — do not unlock session from webhook alone. */
export async function lookupWhatsAppPayment(
  referenceId: string,
): Promise<{
  status: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
} | null> {
  const { accessToken, phoneNumberId, apiVersion } = getWhatsAppConfig();
  const { configurationName } = getWhatsAppPaymentConfig();

  const url =
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}` +
    `/payments/${encodeURIComponent(configurationName)}/${encodeURIComponent(referenceId)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = (await response.json()) as {
    payments?: Array<{
      reference_id?: string;
      status?: string;
      transactions?: Array<{
        id?: string;
        pg_transaction_id?: string;
        status?: string;
      }>;
    }>;
    // Some API versions return a single payment object
    reference_id?: string;
    status?: string;
    transactions?: Array<{
      id?: string;
      pg_transaction_id?: string;
      status?: string;
    }>;
    error?: unknown;
  };

  if (!response.ok) {
    console.warn("[whatsapp payment lookup]", response.status, data);
    return null;
  }

  const payment = data.payments?.[0] ?? (data.status ? data : null);
  if (!payment?.status) return null;

  const txns = payment.transactions ?? [];
  const successTxn =
    txns.find((t) => t.status === "success") ??
    txns.find((t) => Boolean(t.pg_transaction_id));

  const statusLower = (payment.status || "").toLowerCase();
  const txnPaid = txns.some((t) => (t.status || "").toLowerCase() === "success");

  return {
    status: txnPaid && statusLower !== "captured" ? "captured" : payment.status,
    razorpayOrderId: successTxn?.id,
    razorpayPaymentId: successTxn?.pg_transaction_id,
  };
}
