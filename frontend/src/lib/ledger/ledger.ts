import type { LedgerResult } from "../api/contracts";
import { MAX_MEDIA_BYTES, normalizeMime } from "../inbox/media";

export const LEDGER_FIXTURE = {
  url: "/demo/ledger-page-v1.png",
  filename: "ledger-page-v1.png",
  mime: "image/png",
  bytes: 3_014_160,
  width: 1_024,
  height: 1_536,
  sha256: "9b85c98d1d35e5b9c8a5e98d03dea9168ff014ce157c51bfa09da99de62f59a0",
  recorded: 2,
  gated: 1,
} as const;

const LEDGER_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateLedgerImage(mimeValue: string, size: number) {
  const mime = normalizeMime(mimeValue);
  if (!LEDGER_MIMES.has(mime)) return "Use a JPEG, PNG or WebP ledger photograph.";
  if (!Number.isFinite(size) || size <= 0) return "The selected image is empty.";
  if (size > MAX_MEDIA_BYTES) return "The ledger photograph must be 6 MB or smaller.";
  return null;
}

export function resultMatchesFrozenTruth(result: LedgerResult) {
  return result.recorded === LEDGER_FIXTURE.recorded
    && result.gated === LEDGER_FIXTURE.gated
    && result.rows.length === LEDGER_FIXTURE.recorded + LEDGER_FIXTURE.gated
    && result.rows.filter((row) => row.outcome === "gated").every((row) => row.amount === null);
}
