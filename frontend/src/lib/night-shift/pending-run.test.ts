import { describe, expect, it } from "vitest";

import { nightlyReportSchema, nightlyRunStatusSchema } from "../api/contracts";
import {
  completionMessage,
  failureMessage,
  hasExpired,
  isTerminal,
  RUN_WATCH_TIMEOUT_MS,
} from "./pending-run";

const report = nightlyReportSchema.parse({
  exact_matched: 12,
  settle_rate: 0.8,
  exact_wall_ms: 40,
  residue_start: 3,
  fuzzy_batches: 1,
  fuzzy_proposals: 2,
  residue_end: 1,
  cost_usd: 0.004,
  restock_low_count: 0,
  restock_proposed: false,
  wall_ms: 20_000,
  statement: { total: 15, matched_exact: 12, fuzzy_proposed: 2, unmatched: 1 },
});

describe("Night run completion alert", () => {
  it("keeps watching until the run reaches a terminal state", () => {
    expect(isTerminal("pending")).toBe(false);
    expect(isTerminal("processing")).toBe(false);
    // A retryable failure is Pub/Sub's cue to redeliver, not the owner's cue.
    expect(isTerminal("failed_retryable")).toBe(false);
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("failed_permanent")).toBe(true);
  });

  it("gives up on a run the worker never reports on", () => {
    const startedAt = 1_000_000;
    expect(hasExpired({ runId: "r", startedAt }, startedAt + 60_000)).toBe(false);
    expect(hasExpired({ runId: "r", startedAt }, startedAt + RUN_WATCH_TIMEOUT_MS)).toBe(true);
  });

  it("leads with the number of decisions waiting for the owner", () => {
    const message = completionMessage(report);
    expect(message.title).toContain("2 proposals for you");
    expect(message.detail).toContain("moved nothing");
  });

  it("says so plainly when nothing needs the owner", () => {
    const quiet = completionMessage({ ...report, fuzzy_proposals: 0 });
    expect(quiet.title).toContain("nothing needs you");
    expect(quiet.detail).toContain("proposed no links");
  });

  it("uses singular wording for a single proposal", () => {
    const one = completionMessage({ ...report, fuzzy_proposals: 1 });
    expect(one.title).toContain("1 proposal for you");
    expect(one.detail).not.toContain("links");
  });

  it("does not invent a result when the report is missing", () => {
    expect(completionMessage(null).detail).toContain("no report");
  });

  it("does not open with a zero when a re-run settles nothing new", () => {
    const rerun = completionMessage({ ...report, exact_matched: 0 });
    expect(rerun.detail).not.toContain("0 settled");
    expect(rerun.detail).toBe("Gemini proposed 2 links and moved nothing.");
  });

  it("states that a failed run moved no money", () => {
    const status = nightlyRunStatusSchema.parse({
      run_id: "r", status: "failed_permanent", report: null,
      error: "ValueError: statement source is unreadable",
    });
    const message = failureMessage(status);
    expect(message.title).toContain("did not finish");
    expect(message.detail).toContain("statement source is unreadable");
    expect(message.detail).toContain("nothing was marked paid");
  });
});
