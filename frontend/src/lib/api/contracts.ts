import { z } from "zod";

export const versionSchema = z.object({
  app: z.string(),
  release_sha: z.string(),
  environment: z.string().default("local"),
  backend_image_digest: z.string().nullable().optional(),
  model: z.string(),
  model_location: z.string(),
  durable_topology: z.object({
    compatible: z.boolean(),
  }).passthrough(),
});

export const statementSchema = z.object({
  total: z.number().int().nonnegative(),
  matched_exact: z.number().int().nonnegative(),
  fuzzy_proposed: z.number().int().nonnegative(),
  unmatched: z.number().int().nonnegative(),
});

export const nightlyReportSchema = z.object({
  schema_version: z.number().int().positive().optional(),
  run_id: z.string().optional(),
  status: z.literal("completed").optional(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
  execution_surface: z.string().optional(),
  release_sha: z.string().optional(),
  model: z.string().optional(),
  model_location: z.string().optional(),
  fuzzy_enabled: z.boolean().optional(),
  total_considered: z.number().int().nonnegative().optional(),
  exact_matched: z.number().int().nonnegative(),
  settle_rate: z.number().min(0).max(1),
  exact_wall_ms: z.number().int().nonnegative(),
  residue_start: z.number().int().nonnegative(),
  fuzzy_batches: z.number().int().nonnegative(),
  fuzzy_proposals: z.number().int().nonnegative(),
  residue_end: z.number().int().nonnegative(),
  model_calls: z.number().int().nonnegative().optional(),
  model_input_tokens: z.number().int().nonnegative().optional(),
  model_output_tokens: z.number().int().nonnegative().optional(),
  cost_usd: z.number().nonnegative(),
  restock_low_count: z.number().int().nonnegative(),
  restock_proposed: z.boolean(),
  wall_ms: z.number().int().nonnegative(),
  statement: statementSchema,
}).superRefine((report, context) => {
  if (report.residue_end > report.residue_start) {
    context.addIssue({
      code: "custom",
      path: ["residue_end"],
      message: "nightly residue cannot grow during one run",
    });
  }
});

export const costSummarySchema = z.object({
  per_interaction: z.array(z.object({
    interaction: z.string(),
    n: z.number().int().nonnegative(),
    total_cost_usd: z.number().nullable().transform((value) => value ?? 0),
    avg_cost_usd: z.number().nullable().optional(),
    avg_wall_ms: z.number().nullable().optional(),
    input_tokens: z.number().int().nullable().transform((value) => value ?? 0),
    output_tokens: z.number().int().nullable().transform((value) => value ?? 0),
  }).passthrough()),
  recent: z.array(z.record(z.string(), z.unknown())),
});

export const digestSchema = z.object({
  digest: z.object({
    date: z.string(),
    orders_last_24h: z.number().int().nonnegative(),
    paid_last_24h: z.number().int().nonnegative(),
    revenue_paid_last_24h: z.number().int().nonnegative(),
    approvals_pending: z.number().int().nonnegative(),
    approvals_by_kind: z.record(z.string(), z.number().int().nonnegative()),
    low_stock: z.array(z.object({
      sku: z.string(),
      name: z.string(),
      stock: z.number().int(),
    })),
    nightly: nightlyReportSchema.nullable(),
    statement: statementSchema,
  }),
  text: z.string(),
});

export const approvalSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  kind: z.string(),
  status: z.enum(["pending", "resume_failed"]),
  payload: z.record(z.string(), z.unknown()),
  created_at: z.string().nullable().optional(),
  requested_decision: z.enum(["approved", "rejected"]).nullable().optional(),
  resume_attempts: z.number().int().nonnegative().optional(),
  retryable: z.boolean().optional(),
});

export const approvalsSchema = z.array(approvalSchema);

export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export const customersSchema = z.array(customerSchema);

export const messageSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  customer_id: z.string(),
  direction: z.enum(["in", "out"]),
  channel: z.string(),
  text: z.string(),
  meta: z.record(z.string(), z.unknown()),
  created_at: z.string().optional(),
}).passthrough();
export const messagesSchema = z.array(messageSchema);

export const queuedEventSchema = z.object({
  queued: z.literal(true),
  event_id: z.string(),
});

export const newSessionSchema = z.object({ session_id: z.string() });

export const decisionResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    idempotent: z.boolean(),
    kind: z.string(),
    decision: z.enum(["approved", "rejected"]),
    customer_id: z.string().nullable().optional(),
    resumed_reply: z.string().nullable().optional(),
  }),
  z.object({
    ok: z.literal(false),
    in_progress: z.literal(true),
    decision: z.enum(["approved", "rejected"]),
  }),
]);

const backendIdSchema = z.union([z.string(), z.number()]).transform(String);

export const ledgerRowOutcomeSchema = z.object({
  index: z.number().int().nonnegative(),
  outcome: z.enum(["recorded", "gated"]),
  customer_name: z.string(),
  description: z.string(),
  amount: z.number().int().positive().nullable(),
  paid: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().nullable(),
  order_id: backendIdSchema.optional(),
  approval_id: backendIdSchema.optional(),
});

export const ledgerResultSchema = z.object({
  status: z.literal("success"),
  recorded: z.number().int().nonnegative(),
  gated: z.number().int().nonnegative(),
  order_ids: z.array(backendIdSchema),
  approval_ids: z.array(backendIdSchema),
  rows: z.array(ledgerRowOutcomeSchema),
}).superRefine((result, context) => {
  if (result.rows.length !== result.recorded + result.gated) {
    context.addIssue({
      code: "custom",
      path: ["rows"],
      message: "row outcomes do not match the recorded and gated counts",
    });
  }
});

export const ledgerUploadResponseSchema = z.object({
  event_id: z.string(),
  idempotent: z.boolean(),
  reply: z.string(),
  node_path: z.array(z.string()),
  ledger: ledgerResultSchema.nullable(),
  tokens: z.object({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
  }),
  cost_usd: z.number().nonnegative(),
  wall_ms: z.number().int().nonnegative(),
});

export type DukaVersion = z.infer<typeof versionSchema>;
export type MorningDigest = z.infer<typeof digestSchema>;
export type NightlyReport = z.infer<typeof nightlyReportSchema>;
export type CostSummary = z.infer<typeof costSummarySchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type DecisionResponse = z.infer<typeof decisionResponseSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type DukaMessage = z.infer<typeof messageSchema>;
export type LedgerResult = z.infer<typeof ledgerResultSchema>;
export type LedgerUploadResponse = z.infer<typeof ledgerUploadResponseSchema>;
