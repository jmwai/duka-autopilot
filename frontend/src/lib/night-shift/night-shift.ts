import type { DukaVersion, NightlyReport } from "../api/contracts";

export const NIGHTLY_BOUNDS = {
  residueBatch: 25,
  batchCeiling: 40,
  maximumRowsPresented: 1_000,
  stopPolicy: "Stop when residue is empty or a batch makes no progress",
} as const;

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
