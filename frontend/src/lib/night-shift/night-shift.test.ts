import { describe, expect, it } from "vitest";

import { nightlyReportSchema, versionSchema } from "../api/contracts";
import { LOCAL_BASELINE, NIGHTLY_BOUNDS, observedSettlePercent, reportReleaseState } from "./night-shift";

const report = nightlyReportSchema.parse({
  release_sha: "release-a",
  exact_matched: 48_402,
  settle_rate: 0.9728,
  exact_wall_ms: 800,
  residue_start: 1_354,
  fuzzy_batches: 0,
  fuzzy_proposals: 0,
  residue_end: 1_354,
  cost_usd: 0,
  restock_low_count: 2,
  restock_proposed: true,
  wall_ms: 812,
  statement: { total: 49_756, matched_exact: 48_402, fuzzy_proposed: 0, unmatched: 1_354 },
});

const version = versionSchema.parse({
  app: "duka-autopilot", release_sha: "release-a", model: "gemini-3.7-flash",
  model_location: "global", durable_topology: { compatible: true },
});

describe("Night shift evidence contracts", () => {
  it("preserves the frozen local baseline arithmetic", () => {
    expect(LOCAL_BASELINE.rowsInserted + 6).toBe(LOCAL_BASELINE.totalConsidered);
    expect(LOCAL_BASELINE.exactMatched + LOCAL_BASELINE.residue).toBe(LOCAL_BASELINE.totalConsidered);
    expect(observedSettlePercent(report)).toBe("97.28%");
  });

  it("keeps the fuzzy exposure hard-bounded", () => {
    expect(NIGHTLY_BOUNDS.residueBatch * NIGHTLY_BOUNDS.batchCeiling).toBe(
      NIGHTLY_BOUNDS.maximumRowsPresented,
    );
  });

  it("labels report release attribution without guessing", () => {
    expect(reportReleaseState(report, version)).toBe("current");
    expect(reportReleaseState({ ...report, release_sha: "older" }, version)).toBe("stale");
    expect(reportReleaseState({ ...report, release_sha: undefined }, version)).toBe("unattributed");
  });

  it("rejects a report whose residue grows during the run", () => {
    expect(nightlyReportSchema.safeParse({ ...report, residue_start: 2, residue_end: 3 }).success).toBe(false);
  });
});
