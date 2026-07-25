import { processWhatsAppPaymentStatus } from "@/lib/payments/process-whatsapp-payment-status";
import type { WhatsAppStatusUpdate } from "../types";

/** Delivery/read logs + Native WhatsApp Pay payment statuses. */
export async function handleStatusUpdates(
  statuses: WhatsAppStatusUpdate[],
): Promise<void> {
  for (const status of statuses) {
    if (status.type === "payment") {
      try {
        await processWhatsAppPaymentStatus(status);
      } catch (error) {
        console.error("[whatsapp payment status]", error);
      }
      continue;
    }

    console.info(
      `[whatsapp status] ${status.status} | message: ${status.id} | to: ${status.recipient_id}`,
    );
  }
}
