import type { DukaVersion, NightlyReport } from "../api/contracts";

export const NIGHTLY_BOUNDS = {
  residueBatch: 25,
  batchCeiling: 40,
  maximumRowsPresented: 1_000,
  stopPolicy: "Stop when residue is empty or a batch makes no progress",
} as const;

// Why the batch loop ended. The backend decides this; anything it sends that
// we do not recognise is reported verbatim rather than guessed at.
const STOP_REASONS: Record<string, string> = {
  disabled: "Fuzzy review was switched off for this run",
  not_entered: "No residue was left for review",
  residue_cleared: "Residue reached zero",
  no_progress: "A batch proposed nothing new",
  batch_ceiling: `Hit the ${NIGHTLY_BOUNDS.batchCeiling} batch ceiling`,
  batch_limit: "Reached the batch limit for a run started here",
};

export function stopReasonLabel(reason: string | undefined) {
  if (!reason) return "Not recorded in this report";
  return STOP_REASONS[reason] ?? reason;
}

export const LOCAL_BASELINE = {
  label: "Historical local synthetic baseline",
  measuredAt: "2026-08-26T12:48:20.031686+00:00",
  releaseSha: "605669888468114d37606f2ee5a067920ca14823",
  dirtyWorktree: true,
  backend: "SQLite · macOS · Python 3.14.2",
  rowsRequested: 50_000,
  rowsInserted: 49_750,
  duplicateRefsDropped: 250,
  totalConsidered: 49_756,
  exactMatched: 48_402,
  residue: 1_354,
  settleRate: 0.9728,
  exactWallMs: 800,
  totalWallMs: 812,
  fuzzyEnabled: false,
  measuredModelCost: null,
} as const;

export function reportReleaseState(report: NightlyReport | null, version: DukaVersion) {
  if (!report?.release_sha) return "unattributed" as const;
  return report.release_sha === version.release_sha ? "current" as const : "stale" as const;
}

export function observedSettlePercent(report: NightlyReport) {
  return new Intl.NumberFormat("en", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(report.settle_rate);
}

export function formatRunTime(value: string | undefined) {
  if (!value) return "Time unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat("en-KE", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Africa/Nairobi",
    timeZoneName: "short",
  }).format(parsed);
}
