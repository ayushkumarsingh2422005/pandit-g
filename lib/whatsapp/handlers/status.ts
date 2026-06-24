import type { WhatsAppStatusUpdate } from "../types";

/** Logs delivery/read status for messages we send to users. */
export function handleStatusUpdates(statuses: WhatsAppStatusUpdate[]) {
  for (const status of statuses) {
    console.info(
      `[whatsapp status] ${status.status} | message: ${status.id} | to: ${status.recipient_id}`,
    );
  }
}
