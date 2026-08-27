export const NIGHTLY_STALE_AFTER_MS = 30 * 60 * 60 * 1_000;

export type NightlyFreshness = {
  state: "missing" | "invalid" | "fresh" | "stale";
  ageMs: number | null;
};

export function nightlyFreshness(
  finishedAt: string | undefined,
  nowMs = Date.now(),
): NightlyFreshness {
  if (!finishedAt) return { state: "missing", ageMs: null };
  const finishedMs = new Date(finishedAt).valueOf();
  if (!Number.isFinite(finishedMs) || finishedMs > nowMs + 5 * 60 * 1_000) {
    return { state: "invalid", ageMs: null };
  }
  const ageMs = Math.max(0, nowMs - finishedMs);
  return {
    state: ageMs > NIGHTLY_STALE_AFTER_MS ? "stale" : "fresh",
    ageMs,
  };
}

