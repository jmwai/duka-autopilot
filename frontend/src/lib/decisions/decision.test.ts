import { describe, expect, it } from "vitest";

import type { Approval } from "../api/contracts";
import { decisionKinds, decisionPresentation } from "./decision";

function approval(kind: string, payload: Record<string, unknown> = {}): Approval {
  return { id: "opaque-1", kind, status: "pending", payload };
}

describe("Decision presentation contracts", () => {
  it("describes fuzzy approval as internal bookkeeping, never money movement", () => {
    const view = decisionPresentation(approval("fuzzy_match", {
      payment_id: "pay-1", order_id: "order-2", confidence: 0.84,
      rationale: "payer name resembles customer",
    }));
    expect(view.observed).toContain("pay-1");
    expect(view.evidence).toContain("84% confidence");
    expect(view.approveEffect).toContain("Duka’s books");
    expect(view.approveEffect).toContain("does not initiate");
  });

  it("never promises an M-Pesa refund or supplier order", () => {
    const refund = decisionPresentation(approval("refund", { order_id: "9" }));
    const restock = decisionPresentation(approval("restock_proposal", { lines: [] }));
    expect(refund.approveEffect).toContain("No M-Pesa transfer");
    expect(restock.approveEffect).toContain("No supplier order");
  });

  it("fails closed for an unreadable ledger amount and an unknown kind", () => {
    const ledger = decisionPresentation(approval("ledger_row", {
      row: { customer_name: "Asha", description: "Sukari", amount: 0, confidence: 0.4 },
      reason: "amount unreadable",
    }));
    const unknown = decisionPresentation(approval("future_effect"));
    expect(ledger.canApprove).toBe(false);
    expect(ledger.observed).toContain("amount unreadable");
    expect(unknown.canApprove).toBe(false);
  });

  it("produces stable unique filter kinds", () => {
    expect(decisionKinds([
      approval("refund"), approval("ledger_row"), approval("refund"),
    ])).toEqual(["ledger_row", "refund"]);
  });
});
