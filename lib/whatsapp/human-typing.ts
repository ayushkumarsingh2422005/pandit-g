import { sleep } from "@/lib/funnel/config";
import { markMessageAsRead, sendTextMessage } from "./client";

/**
 * Human-like pause before WhatsApp reply (scales with character count).
 *
 * On Vercel Hobby (~10s/function), AI and sleep cannot share one invocation.
 * We schedule `/api/whatsapp/delayed-send` so delay gets its own 10s budget.
 *
 * Env:
 * - TYPING_MS_PER_CHAR (default 35)
 * - TYPING_BASE_MS (default 1200)
 * - TYPING_MIN_MS (default 1500)
 * - TYPING_MAX_MS (default 8000 — Hobby-safe; raise to 18000 on Pro)
 * - APP_URL — public site URL (required on Vercel for delayed send)
 * - INTERNAL_API_SECRET or ADMIN_SESSION_SECRET — auth for delayed-send
 */

const DEFAULT_MS_PER_CHAR = 35;
const DEFAULT_BASE_MS = 1200;
const DEFAULT_MIN_MS = 1500;
const DEFAULT_MAX_MS = 8000;

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getHumanTypingDelayMs(
  text: string,
  alreadyElapsedMs = 0,
): number {
  const chars = text.trim().length;
  const msPerChar = envNumber("TYPING_MS_PER_CHAR", DEFAULT_MS_PER_CHAR);
  const baseMs = envNumber("TYPING_BASE_MS", DEFAULT_BASE_MS);
  const minMs = envNumber("TYPING_MIN_MS", DEFAULT_MIN_MS);
  const maxMs = envNumber("TYPING_MAX_MS", DEFAULT_MAX_MS);

  const raw = baseMs + chars * msPerChar;
  const clamped = Math.min(maxMs, Math.max(minMs, raw));
  return Math.max(0, clamped - Math.max(0, alreadyElapsedMs));
}

function getAppBaseUrl(): string | null {
  const explicit = process.env.APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  return null;
}

function getInternalSecret(): string | null {
  return (
    process.env.INTERNAL_API_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    null
  );
}

async function scheduleDelayedSend(input: {
  to: string;
  body: string;
  delayMs: number;
  replyToMessageId?: string;
}): Promise<boolean> {
  const baseUrl = getAppBaseUrl();
  const secret = getInternalSecret();
  if (!baseUrl || !secret) return false;

  try {
    const response = await fetch(`${baseUrl}/api/whatsapp/delayed-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        to: input.to,
        body: input.body,
        delayMs: input.delayMs,
        replyToMessageId: input.replyToMessageId,
      }),
    });

    return response.ok || response.status === 202;
  } catch (error) {
    console.error("[human-typing] schedule failed", error);
    return false;
  }
}

/** Inline sleep — used locally / fallback if schedule fails. Cap for Hobby. */
async function waitInline(input: {
  text: string;
  replyToMessageId?: string;
  alreadyElapsedMs?: number;
}): Promise<number> {
  const delayMs = Math.min(
    getHumanTypingDelayMs(input.text, input.alreadyElapsedMs ?? 0),
    3500,
  );
  if (delayMs <= 0) return 0;

  if (input.replyToMessageId && delayMs > 2000) {
    await sleep(Math.floor(delayMs / 2));
    try {
      await markMessageAsRead(input.replyToMessageId);
    } catch {
      /* best-effort */
    }
    await sleep(Math.ceil(delayMs / 2));
  } else {
    await sleep(delayMs);
  }

  return delayMs;
}

/**
 * Wait (character-based), then send.
 * Prefer separate delayed-send route on Vercel so Hobby 10s is not blown by sleep.
 *
 * When `waitUntilSent` is true, always sleep+send in this invocation so a
 * follow-up message (e.g. Pay Now) cannot overtake a scheduled delayed send.
 */
export async function sendHumanTextMessage(input: {
  to: string;
  body: string;
  replyToMessageId?: string;
  generationStartedAt?: number;
  waitUntilSent?: boolean;
}) {
  const alreadyElapsedMs = input.generationStartedAt
    ? Date.now() - input.generationStartedAt
    : 0;

  const delayMs = getHumanTypingDelayMs(input.body, alreadyElapsedMs);

  if (!input.waitUntilSent && delayMs > 400) {
    const scheduled = await scheduleDelayedSend({
      to: input.to,
      body: input.body,
      delayMs,
      replyToMessageId: input.replyToMessageId,
    });
    if (scheduled) return { scheduled: true, delayMs };
  }

  await waitInline({
    text: input.body,
    replyToMessageId: input.replyToMessageId,
    alreadyElapsedMs,
  });

  return sendTextMessage({ to: input.to, body: input.body });
}
