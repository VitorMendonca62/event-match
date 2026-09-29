/**
 * Countdowns derive from absolute backend instants and the current clock on every tick, so a
 * suspended tab corrects itself. They inform the UI only; the backend decides expiry and cooldown.
 */
export function secondsUntil(instant: string | undefined, nowMs: number): number {
  if (!instant) return 0;
  const target = Date.parse(instant);
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, Math.ceil((target - nowMs) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
