import { sendTextMessage } from "../client";
import type { IncomingTextMessage } from "../types";

/**
 * Test handler — replies with the exact same text the user sent.
 * Replace this with Pandit G logic later.
 */
export async function handleEchoMessage(message: IncomingTextMessage) {
  await sendTextMessage({
    to: message.from,
    body: message.text,
  });
}
