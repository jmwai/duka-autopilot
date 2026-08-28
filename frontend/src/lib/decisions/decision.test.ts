import { describe, expect, it } from "vitest";

import type { Approval } from "../api/contracts";
import { decisionKinds, decisionPresentation, ownerAmountError, OWNER_AMOUNT_MAX } from "./decision";

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

  it("does not expose internal customer keys in owner-facing decision copy", () => {
    const internalKey = "customer_internal_9d82";
    const refund = decisionPresentation(approval("refund", { customer_id: internalKey, order_id: "9" }));
    const security = decisionPresentation(approval("security_flag", { customer_id: internalKey, reasons: ["instruction override"] }));
    expect(JSON.stringify(refund)).not.toContain(internalKey);
    expect(JSON.stringify(security)).not.toContain(internalKey);
  });

  it("uses the observed ledger name instead of the internal customer key", () => {
    const internalKey = "254711000001";
    const ledger = decisionPresentation(approval("ledger_row", {
      row: {
        customer_id: internalKey,
        customer_name: "Mama Achieng",
        description: "Unga",
        amount: 390,
        confidence: 0.71,
      },
    }));

    expect(ledger.identifiers).toEqual(["Mama Achieng"]);
    expect(JSON.stringify(ledger)).not.toContain(internalKey);
  });

  it("asks the owner for an unreadable ledger amount instead of guessing", () => {
    const ledger = decisionPresentation(approval("ledger_row", {
      row: { customer_name: "Asha", description: "Sukari", amount: 0, confidence: 0.4 },
      reason: "amount unreadable",
    }));
    expect(ledger.observed).toContain("amount unreadable");
    // The owner can complete the row, but only by supplying the figure.
    expect(ledger.canApprove).toBe(true);
    expect(ledger.needsAmount).toBe(true);
    expect(ledger.approveEffect).toContain("will not guess");
    expect(ledger.approveEffect).toContain("owner-entered");
  });

  it("does not offer an amount field when the model read one", () => {
    const ledger = decisionPresentation(approval("ledger_row", {
      row: { customer_name: "Asha", description: "Sukari", amount: 390, confidence: 0.6 },
      reason: "confidence 0.60",
    }));
    expect(ledger.canApprove).toBe(true);
    expect(ledger.needsAmount).toBe(false);
  });

  it("still fails closed for a kind it does not know", () => {
    expect(decisionPresentation(approval("future_effect")).canApprove).toBe(false);
  });

  it("keeps an owner-entered amount inside shop-counter bounds", () => {
    expect(ownerAmountError("240")).toBeNull();
    expect(ownerAmountError(String(OWNER_AMOUNT_MAX))).toBeNull();
    expect(ownerAmountError("")).toContain("Enter the amount");
    expect(ownerAmountError("0")).toContain("at least KSh 1");
    expect(ownerAmountError("-5")).toContain("digits only");
    expect(ownerAmountError("24.50")).toContain("whole shillings");
    expect(ownerAmountError("1e4")).toContain("digits only");
    expect(ownerAmountError(String(OWNER_AMOUNT_MAX + 1))).toContain("limit");
    expect(ownerAmountError("71000000")).toContain("limit");
  });

  it("produces stable unique filter kinds", () => {
    expect(decisionKinds([
      approval("refund"), approval("ledger_row"), approval("refund"),
    ])).toEqual(["ledger_row", "refund"]);
  });
});
