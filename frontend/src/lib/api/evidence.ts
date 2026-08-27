import { releaseEvidenceSchema } from "./contracts";
import { apiFetch } from "./server-client";

export async function getReleaseEvidence() {
  return apiFetch("evidence/release", releaseEvidenceSchema);
}
