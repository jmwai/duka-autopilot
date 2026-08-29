import { describe, expect, it } from "vitest";

import { frontendVersionSchema, inventorySchema, ordersSchema, releaseEvidenceSchema } from "./contracts";

describe("Owner product API contracts", () => {
  it("normalizes SQLite and Firestore order identifiers and review flags", () => {
    const orders = ordersSchema.parse([
      { id: 7, customer_id: "customer", customer_name: "Amina", status: "paid", total: 390, needs_review: 0, items: [{ name: "Unga", qty: 2, unit_price: 195 }] },
      { id: "opaque", customer_id: "customer", status: "needs_review", total: 195, needs_review: true, items: [{ sku: "UNGA", name: "Unga", qty: 1, unit_price: 195 }] },
    ]);
    expect(orders[0].id).toBe("7");
    expect(orders[0].needs_review).toBe(false);
    expect(orders[1].id).toBe("opaque");
  });

  it("accepts ledger-derived order lines that carry no catalog SKU", () => {
    // A handwritten ledger row is a free-text line and an amount; the API
    // returns sku: null for it. Rejecting that fails the entire order list.
    const orders = ordersSchema.parse([
      { id: "ledger-1", customer_id: "walk-in", status: "paid", total: 210, items: [{ sku: null, name: "soda x3", qty: 1, unit_price: 210 }] },
    ]);
    expect(orders[0].items[0].sku).toBeNull();
    expect(orders[0].items[0].name).toBe("soda x3");
  });

  it("rejects non-integer inventory arithmetic", () => {
    const valid = { sku: "SOAP", name: "Soap", unit: "bar", unit_price: 85, stock: 7, reorder_point: 10, target_stock: 30, low: true, suggested_qty: 23 };
    expect(inventorySchema.safeParse([valid]).success).toBe(true);
    expect(inventorySchema.safeParse([{ ...valid, suggested_qty: 2.5 }]).success).toBe(false);
  });

  it("keeps release evidence fail-closed", () => {
    const evidence = {
      schema_version: 1,
      release: { sha: "release-a", environment: "dev", api_revision: null, backend_image_digest: null },
      model: { name: "gemini-test", location: "global", provider: "Google Vertex AI" },
      topology: { compatible: true, fingerprint: "a".repeat(64), workflow_name: "duka", adk_version: "2.7.1", node_count: 1, edge_count: 1, nodes: ["screen"] },
      runtime: { store: "firestore", bus: "pubsub", managed_sessions_configured: true, memory_bank_configured: true },
      artifacts: [{ key: "eval", label: "ADK eval", state: "pending", detail: "Not attached", url: null, release_sha: null }],
      disclosures: { synthetic_data: "disclosed", external_effects: "none", media_policy: "Google only" },
    };
    expect(releaseEvidenceSchema.parse(evidence).artifacts[0].state).toBe("pending");
    expect(releaseEvidenceSchema.safeParse({ ...evidence, artifacts: [{ ...evidence.artifacts[0], state: "claimed" }] }).success).toBe(false);
  });

  it("requires the web runtime and built deployment identities", () => {
    const version = {
      app: "duka-autopilot-web",
      release_sha: "release-a",
      deployment_id: "release-a",
      environment: "dev",
      runtime: "v24.12.0",
    };
    expect(frontendVersionSchema.safeParse(version).success).toBe(true);
    expect(frontendVersionSchema.safeParse({ ...version, deployment_id: undefined }).success).toBe(false);
  });
});
