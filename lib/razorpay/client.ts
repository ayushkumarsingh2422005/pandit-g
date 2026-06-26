import Razorpay from "razorpay";
import { getRazorpayConfig } from "./config";

let client: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (!client) {
    const { keyId, keySecret } = getRazorpayConfig();
    client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return client;
}
