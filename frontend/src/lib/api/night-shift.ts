import { costSummarySchema, digestSchema, versionSchema } from "./contracts";
import { apiFetch } from "./server-client";

export async function getNightShiftData() {
  const [version, digest, costs] = await Promise.all([
    apiFetch("version", versionSchema),
    apiFetch("digest/morning", digestSchema),
    apiFetch("metrics/costs", costSummarySchema),
  ]);
  return { version, digest, costs };
}

export type NightShiftData = Awaited<ReturnType<typeof getNightShiftData>>;
