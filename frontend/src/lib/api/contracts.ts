import { z } from "zod";

export const versionSchema = z.object({
  app: z.string(),
  release_sha: z.string(),
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
    nightly: z.record(z.string(), z.unknown()).nullable(),
    statement: statementSchema,
  }),
  text: z.string(),
});

export const approvalSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  kind: z.string(),
  status: z.string(),
  payload: z.record(z.string(), z.unknown()),
  created_at: z.string().optional(),
  last_error: z.string().nullable().optional(),
}).passthrough();

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

export type DukaVersion = z.infer<typeof versionSchema>;
export type MorningDigest = z.infer<typeof digestSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type DukaMessage = z.infer<typeof messageSchema>;
