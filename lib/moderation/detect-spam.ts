const SPAM_FLOOD_WINDOW_MS = 30_000;
const SPAM_FLOOD_COUNT = 6;

export function isMessageFlood(recentInboundAt: Date[]): boolean {
  const now = Date.now();
  const inWindow = recentInboundAt.filter(
    (d) => now - new Date(d).getTime() < SPAM_FLOOD_WINDOW_MS,
  );
  return inWindow.length >= SPAM_FLOOD_COUNT;
}

export function getFloodWindowMs(): number {
  return SPAM_FLOOD_WINDOW_MS;
}
