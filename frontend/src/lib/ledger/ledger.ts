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
  return compareFrozenTruth(result, fixture).matches;
}

export function compareFrozenTruth(result: LedgerResult, fixture: DemoLedgerFixture) {
  const truth = fixture.ground_truth;
  const rowComparisons = truth.rows.map((expected, index) => {
    const observedRows = result.rows.filter((row) => row.index === index);
    const observed = observedRows.length === 1 ? observedRows[0] : null;
    const expectedOutcome = expected.expected_action === "record" ? "recorded" : "gated";
    const outcomeMatches = observed?.outcome === expectedOutcome;
    const amountMatches = expected.amount_ksh === null
      ? observed?.amount === null
      : observed?.amount === expected.amount_ksh;
    const paidMatches = observed?.paid === expected.paid;
    return {
      index,
      expected,
      observed,
      matches: Boolean(observed && outcomeMatches && amountMatches && paidMatches),
    };
  });
  const countsMatch = result.recorded === truth.recorded_rows
    && result.gated === truth.gated_rows
    && result.rows.length === truth.rows.length;
  return {
    matches: countsMatch && rowComparisons.every((row) => row.matches),
    countsMatch,
    rows: rowComparisons,
  };
}
