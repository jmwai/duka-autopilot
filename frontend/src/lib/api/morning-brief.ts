import { approvalsSchema, digestSchema, statementSchema, versionSchema } from "./contracts";
import { apiFetch } from "./server-client";

export async function getMorningBrief() {
  const [version, digest, approvals, statement] = await Promise.all([
    apiFetch("version", versionSchema),
    apiFetch("digest/morning", digestSchema),
    apiFetch("approvals", approvalsSchema),
    apiFetch("recon/report", statementSchema),
  ]);
  return { version, digest, approvals, statement };
}

export type MorningBriefData = Awaited<ReturnType<typeof getMorningBrief>>;
