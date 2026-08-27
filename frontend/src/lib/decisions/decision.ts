import type { Approval } from "../api/contracts";
import { formatKsh } from "../format/money";

export type DecisionRisk = "consequential" | "review" | "security";

export type DecisionPresentation = {
  label: string;
  risk: DecisionRisk;
  observed: string;
  stopped: string;
  approveEffect: string;
  rejectEffect: string;
  approveLabel: string;
  rejectLabel: string;
  canApprove: boolean;
  identifiers: string[];
  evidence: string[];
};

function text(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function object(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function confidence(value: number | null) {
  return value === null ? null : `${Math.round(value * 100)}% confidence`;
}

export function decisionPresentation(approval: Approval): DecisionPresentation {
  const payload = approval.payload;
  const orderId = text(payload, "order_id") ?? number(payload, "order_id")?.toString();

  switch (approval.kind) {
    case "refund":
      return {
        label: "Refund proposal",
        risk: "consequential",
        observed: `A customer asked for a refund${orderId ? ` on order #${orderId}` : ""}.`,
        stopped: "A refund is consequential and requires explicit owner judgment.",
        approveEffect: "Resume the suspended ADK workflow and record an owner-approved refund proposal for manual completion. No M-Pesa transfer is initiated.",
        rejectEffect: "Resume the suspended workflow with a rejection and send the final decision to the customer. No money moves.",
        approveLabel: "Approve proposal",
        rejectLabel: "Reject refund",
        canApprove: true,
        identifiers: [orderId ? `Order #${orderId}` : null].filter(Boolean) as string[],
        evidence: [text(payload, "reason") ? `Customer reason: ${text(payload, "reason")}` : null].filter(Boolean) as string[],
      };
    case "fuzzy_match": {
      const paymentId = text(payload, "payment_id") ?? number(payload, "payment_id")?.toString();
      const score = confidence(number(payload, "confidence"));
      return {
        label: "Payment match",
        risk: "consequential",
        observed: `Gemini proposed linking payment ${paymentId ?? "?"} to order #${orderId ?? "?"}.`,
        stopped: "The evidence was similar, not exact, so Duka cannot mark the order paid autonomously.",
        approveEffect: "Link this payment to the proposed order in Duka’s books and mark that order paid. This does not initiate or reverse an M-Pesa transfer.",
        rejectEffect: "Return the payment to unmatched residue and leave the order unchanged.",
        approveLabel: "Approve match",
        rejectLabel: "Reject match",
        canApprove: true,
        identifiers: [paymentId ? `Payment ${paymentId}` : null, orderId ? `Order #${orderId}` : null].filter(Boolean) as string[],
        evidence: [score, text(payload, "rationale")].filter(Boolean) as string[],
      };
    }
    case "low_confidence_order": {
      const score = confidence(number(payload, "confidence"));
      return {
        label: "Uncertain order",
        risk: "review",
        observed: `An order draft${orderId ? ` (#${orderId})` : ""} was extracted below the confidence gate.`,
        stopped: "The proposed items are catalog-grounded, but the customer intent was not clear enough to continue automatically.",
        approveEffect: "Move the existing draft to pending customer confirmation. This does not create a duplicate order or mark it paid.",
        rejectEffect: "Mark the draft rejected; no new order is created.",
        approveLabel: "Keep draft",
        rejectLabel: "Reject draft",
        canApprove: true,
        identifiers: [orderId ? `Order #${orderId}` : null].filter(Boolean) as string[],
        evidence: [score, text(payload, "notes")].filter(Boolean) as string[],
      };
    }
    case "ledger_row": {
      const row = object(payload, "row");
      const amount = number(row, "amount");
      const rowCustomer = text(row, "customer_name") ?? "Unknown customer";
      const description = text(row, "description") ?? "Description unavailable";
      const positiveAmount = amount !== null && Number.isInteger(amount) && amount > 0;
      const score = confidence(number(row, "confidence"));
      return {
        label: "Ledger row",
        risk: "review",
        observed: `${rowCustomer}: ${description}${positiveAmount ? ` · ${formatKsh(amount)}` : " · amount unreadable"}.`,
        stopped: text(payload, "reason") ?? "The row did not pass deterministic ledger validation.",
        approveEffect: positiveAmount
          ? "Record one internal sale using this positive amount and the observed paid marker. No external payment is initiated."
          : "Approval is unavailable because no positive amount can be recorded safely. Reject the row to keep it out of the books; corrected-entry support is not implemented.",
        rejectEffect: "Resolve the gate without creating a sale or changing the books.",
        approveLabel: "Record row",
        rejectLabel: "Reject row",
        canApprove: positiveAmount,
        identifiers: [rowCustomer],
        evidence: [score, text(payload, "page_note")].filter(Boolean) as string[],
      };
    }
    case "security_flag": {
      const reasons = Array.isArray(payload.reasons)
        ? payload.reasons.filter((reason): reason is string => typeof reason === "string")
        : [];
      return {
        label: "Security flag",
        risk: "security",
        observed: "A customer message matched the deterministic security screen.",
        stopped: "Blocked content never reached a business agent or tool.",
        approveEffect: "Record that the owner acknowledged this security review. The blocked message is not replayed or treated as authority.",
        rejectEffect: "Close the flag as rejected. The blocked message remains excluded from agent context and Memory.",
        approveLabel: "Acknowledge",
        rejectLabel: "Dismiss",
        canApprove: true,
        identifiers: [],
        evidence: [...reasons, text(payload, "message_excerpt") ? `Excerpt: “${text(payload, "message_excerpt")}”` : null].filter(Boolean) as string[],
      };
    }
    case "restock_proposal": {
      const lines = Array.isArray(payload.lines) ? payload.lines : [];
      const summary = lines
        .filter((line): line is Record<string, unknown> => Boolean(line) && typeof line === "object" && !Array.isArray(line))
        .slice(0, 4)
        .map((line) => `${text(line, "name") ?? text(line, "sku") ?? "Item"}: ${number(line, "stock") ?? "?"} left → draft ${number(line, "order_qty") ?? "?"}`);
      return {
        label: "Restock draft",
        risk: "review",
        observed: `${lines.length} catalog item${lines.length === 1 ? " is" : "s are"} at or below the reorder point.`,
        stopped: "Stock arithmetic can draft quantities, but only the owner may accept supplier-facing intent.",
        approveEffect: "Record owner approval of this restock draft only. No supplier order is placed, no payment is sent, and stock is not adjusted.",
        rejectEffect: "Reject this draft. No supplier order or inventory change occurs.",
        approveLabel: "Accept draft",
        rejectLabel: "Reject draft",
        canApprove: true,
        identifiers: [],
        evidence: [text(payload, "note"), ...summary].filter(Boolean) as string[],
      };
    }
    default:
      return {
        label: titleCase(approval.kind),
        risk: "review",
        observed: "Duka created a decision kind this release does not recognize.",
        stopped: "The owner interface fails closed when it cannot explain an effect precisely.",
        approveEffect: "Approval is disabled until this effect has a reviewed presentation contract.",
        rejectEffect: "Reject the unknown proposal without applying a known business effect.",
        approveLabel: "Unavailable",
        rejectLabel: "Reject proposal",
        canApprove: false,
        identifiers: [`Approval #${approval.id}`],
        evidence: [],
      };
  }
}

export function decisionKinds(approvals: Approval[]) {
  return [...new Set(approvals.map((approval) => approval.kind))].sort();
}
