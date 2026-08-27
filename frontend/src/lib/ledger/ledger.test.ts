import { describe, expect, it } from "vitest";

import { ledgerResultSchema } from "../api/contracts";

import { compareFrozenTruth, resultMatchesFrozenTruth, validateLedgerImage } from "./ledger";

const frozenFixture = {
  id: "ledger-en-v2",
  language: "en-KE" as const,
  label: "English",
  path: "fixtures/demo/ledger-en-v2.png",
  mime_type: "image/png" as const,
  bytes: 1_024,
  sha256: "a".repeat(64),
  width: 1_024,
  height: 1_536,
  synthetic: true as const,
  source: {
    provider: "google_vertex_ai" as const,
    project_id: "agent-platform-503913" as const,
    location: "global",
    model: "gemini-3.1-flash-image" as const,
    prompt_path: "fixtures/demo/prompts/ledger-en-v2.txt",
    prompt_sha256: "b".repeat(64),
    response_mime_type: "image/png",
    usage: { output_tokens: 1120 },
    generated_utc: "2026-08-27T00:00:00Z",
    synthetic: true as const,
  },
  ground_truth: {
    recorded_rows: 2 as const,
    gated_rows: 1 as const,
    rows: [
      { date: "12/08", description: "Maize flour", quantity: 2, amount_ksh: 390, paid: true, expected_action: "record" as const },
      { date: "12/08", description: "Cooking oil", quantity: 1, amount_ksh: 320, paid: true, expected_action: "record" as const },
      { date: "12/08", description: "Sugar", quantity: 1, amount_ksh: null, paid: false, expected_action: "gate" as const, issue: "amount unreadable" },
    ],
  },
};

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
  it("keeps Google fixture and owner uploads inside the decoded limit", () => {
    expect(validateLedgerImage(frozenFixture.mime_type, frozenFixture.bytes)).toBeNull();
    expect(validateLedgerImage("image/png", 1_024)).toBeNull();
    expect(validateLedgerImage("application/pdf", 200)).toContain("JPEG");
    expect(validateLedgerImage("image/png", 6_000_001)).toContain("6 MB");
  });

  it("accepts a structured two-record/one-gate receipt", () => {
    const result = ledgerResultSchema.parse(frozenResult);
    expect(resultMatchesFrozenTruth(result, frozenFixture)).toBe(true);
  });

  it("rejects internally inconsistent result counts", () => {
    expect(ledgerResultSchema.safeParse({ ...frozenResult, recorded: 3 }).success).toBe(false);
  });

  it("rejects a same-count receipt with the wrong amount or row identity", () => {
    const wrongAmount = {
      ...frozenResult,
      rows: frozenResult.rows.map((row, index) => index === 0 ? { ...row, amount: 391 } : row),
    };
    expect(resultMatchesFrozenTruth(ledgerResultSchema.parse(wrongAmount), frozenFixture)).toBe(false);

    const duplicateIndex = {
      ...frozenResult,
      rows: frozenResult.rows.map((row, index) => index === 1 ? { ...row, index: 0 } : row),
    };
    const comparison = compareFrozenTruth(ledgerResultSchema.parse(duplicateIndex), frozenFixture);
    expect(comparison.matches).toBe(false);
    expect(comparison.rows[0].observed).toBeNull();
  });

  it("never permits an invented nonpositive gated amount through the schema", () => {
    const rows = frozenResult.rows.map((row, index) => index === 2 ? { ...row, amount: 0 } : row);
    expect(ledgerResultSchema.safeParse({ ...frozenResult, rows }).success).toBe(false);
  });
});
