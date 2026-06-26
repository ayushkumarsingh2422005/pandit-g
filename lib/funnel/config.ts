const DEFAULT_READING_DELAY_MS = 5000;

export function getFunnelReadingDelayMs(): number {
  const parsed = Number(process.env.FUNNEL_READING_DELAY_MS);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_READING_DELAY_MS;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
