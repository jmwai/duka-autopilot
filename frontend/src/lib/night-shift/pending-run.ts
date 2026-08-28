import type { NightlyReport, NightlyRunStatus } from "../api/contracts";

/**
 * One night run the owner started and has not yet been told about.
 *
 * It lives in localStorage rather than React state because the whole point is
 * that the owner can leave the page — and reload it — while the worker runs.
 */
export type PendingRun = {
  runId: string;
  startedAt: number;
};

export const PENDING_RUN_KEY = "duka.night-shift.pending-run";
/** Emitted on this tab when a run is stored or cleared, so the watcher reacts
 *  without waiting for its next poll. `storage` only fires in *other* tabs. */
export const PENDING_RUN_EVENT = "duka:night-shift-run";
export const RUN_POLL_MS = 3_000;
/** A run the worker never reports on is abandoned rather than watched forever. */
export const RUN_WATCH_TIMEOUT_MS = 15 * 60 * 1_000;

export function isTerminal(status: NightlyRunStatus["status"]) {
  return status === "completed" || status === "failed_permanent";
}

export function hasExpired(run: PendingRun, now: number) {
  return now - run.startedAt >= RUN_WATCH_TIMEOUT_MS;
}

/** What the owner is told when the run lands. Split out so it is testable
 *  without a browser, and so the wording lives next to the rules. */
export function completionMessage(report: NightlyReport | null) {
  if (!report) {
    return {
      title: "Night shift finished",
      detail: "The run completed but returned no report to show.",
    };
  }
  const proposals = report.fuzzy_proposals;
  const settled = report.exact_matched;
  // A re-run over an already-settled book legitimately settles nothing new,
  // so leading with "0 settled" would read as a failure it is not.
  const settledClause = settled > 0 ? `${settled} settled exactly. ` : "";
  if (proposals > 0) {
    return {
      title: `Night shift finished · ${proposals} proposal${proposals === 1 ? "" : "s"} for you`,
      detail: `${settledClause}Gemini proposed ${proposals} link${proposals === 1 ? "" : "s"} and moved nothing.`,
    };
  }
  return {
    title: "Night shift finished · nothing needs you",
    detail: settled > 0
      ? `${settled} settled exactly and Gemini proposed no links.`
      : "Nothing new settled and Gemini proposed no links.",
  };
}

export function failureMessage(status: NightlyRunStatus) {
  return {
    title: "The night shift did not finish",
    detail: status.error
      ? `${status.error} No payment was matched and nothing was marked paid.`
      : "The run failed. No payment was matched and nothing was marked paid.",
  };
}

export function readPendingRun(): PendingRun | null {
  try {
    const raw = window.localStorage.getItem(PENDING_RUN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { runId, startedAt } = parsed as Partial<PendingRun>;
    if (typeof runId !== "string" || !runId) return null;
    return { runId, startedAt: typeof startedAt === "number" ? startedAt : 0 };
  } catch {
    // Private windows and blocked site data throw on access; a lost watch is
    // recoverable (the report still lands), a crashed shell is not.
    return null;
  }
}

export function writePendingRun(run: PendingRun) {
  try {
    window.localStorage.setItem(PENDING_RUN_KEY, JSON.stringify(run));
  } catch {
    // ignore: the page still shows the run it just started
  }
  window.dispatchEvent(new CustomEvent(PENDING_RUN_EVENT));
}

export function clearPendingRun() {
  try {
    window.localStorage.removeItem(PENDING_RUN_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(PENDING_RUN_EVENT));
}
