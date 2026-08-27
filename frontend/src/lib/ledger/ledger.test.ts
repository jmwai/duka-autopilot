import { describe, expect, it } from "vitest";

import { ledgerResultSchema } from "../api/contracts";

import { LEDGER_FIXTURE, resultMatchesFrozenTruth, validateLedgerImage } from "./ledger";

const frozenResult = {
  status: "success" as const,
  recorded: 2,
  gated: 1,
  order_ids: ["1", "2"],
  approval_ids: ["approval-1"],
  rows: [
    { index: 0, outcome: "recorded" as const, customer_name: "walk-in", description: "Unga Dola 2kg × 2", amount: 390, paid: true, confidence: 0.96, reason: null, order_id: "1" },
    { index: 1, outcome: "recorded" as const, customer_name: "walk-in", description: "Mafuta 1L", amount: 320, paid: true, confidence: 0.94, reason: null, order_id: "2" },
    { index: 2, outcome: "gated" as const, customer_name: "walk-in", description: "Sukari 1kg", amount: null, paid: false, confidence: 0.42, reason: "amount unreadable", approval_id: "approval-1" },
  ],
};

describe("Ledger fixture and receipt boundary", () => {
  it("keeps the frozen fixture inside the decoded media limit", () => {
    expect(validateLedgerImage(LEDGER_FIXTURE.mime, LEDGER_FIXTURE.bytes)).toBeNull();
    expect(validateLedgerImage("application/pdf", 200)).toContain("JPEG");
    expect(validateLedgerImage("image/png", 6_000_001)).toContain("6 MB");
  });

  it("accepts a structured two-record/one-gate receipt", () => {
    const result = ledgerResultSchema.parse(frozenResult);
    expect(resultMatchesFrozenTruth(result)).toBe(true);
  });

  it("rejects internally inconsistent result counts", () => {
    expect(ledgerResultSchema.safeParse({ ...frozenResult, recorded: 3 }).success).toBe(false);
  });

  it("never permits an invented nonpositive gated amount through the schema", () => {
    const rows = frozenResult.rows.map((row, index) => index === 2 ? { ...row, amount: 0 } : row);
    expect(ledgerResultSchema.safeParse({ ...frozenResult, rows }).success).toBe(false);
  });
});
