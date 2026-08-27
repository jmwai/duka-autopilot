import { describe, expect, it } from "vitest";

import { NIGHTLY_STALE_AFTER_MS, nightlyFreshness } from "./presentation";

describe("Morning Brief nightly freshness", () => {
  const now = Date.parse("2026-08-27T09:00:00Z");

  it("distinguishes missing, invalid, fresh, and stale reports", () => {
    expect(nightlyFreshness(undefined, now)).toEqual({ state: "missing", ageMs: null });
    expect(nightlyFreshness("not-a-time", now)).toEqual({ state: "invalid", ageMs: null });
    expect(nightlyFreshness("2026-08-27T02:00:00Z", now)).toEqual({
      state: "fresh",
      ageMs: 7 * 60 * 60 * 1_000,
    });
    expect(nightlyFreshness("2026-08-25T23:00:00Z", now)).toEqual({
      state: "stale",
      ageMs: 34 * 60 * 60 * 1_000,
    });
  });

  it("keeps the exact 30-hour boundary fresh and rejects future reports", () => {
    expect(nightlyFreshness(
      new Date(now - NIGHTLY_STALE_AFTER_MS).toISOString(),
      now,
    ).state).toBe("fresh");
    expect(nightlyFreshness("2026-08-27T09:06:00Z", now).state).toBe("invalid");
  });
});

