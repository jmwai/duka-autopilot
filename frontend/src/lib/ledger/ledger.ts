import type { LedgerResult } from "../api/contracts";
import type { DemoLedgerFixture } from "../fixtures/demo";
import { MAX_MEDIA_BYTES, normalizeMime } from "../inbox/media";

const LEDGER_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateLedgerImage(mimeValue: string, size: number) {
  const mime = normalizeMime(mimeValue);
  if (!LEDGER_MIMES.has(mime)) return "Use a JPEG, PNG or WebP ledger photograph.";
  if (!Number.isFinite(size) || size <= 0) return "The selected image is empty.";
  if (size > MAX_MEDIA_BYTES) return "The ledger photograph must be 6 MB or smaller.";
  return null;
}

export function resultMatchesFrozenTruth(result: LedgerResult, fixture: DemoLedgerFixture) {
  const truth = fixture.ground_truth;
  return result.recorded === truth.recorded_rows
    && result.gated === truth.gated_rows
    && result.rows.length === truth.recorded_rows + truth.gated_rows
    && result.rows.filter((row) => row.outcome === "gated").every((row) => row.amount === null);
}
