import { redirect } from "next/navigation";

import { DisconnectedBrief } from "@/components/control-room/disconnected-brief";
import { EvidenceWorkspace } from "@/components/evidence/evidence-workspace";
import { getReleaseEvidence } from "@/lib/api/evidence";
import { ApiError } from "@/lib/api/server-client";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  let evidence;
  let requestId: string | undefined;
  try {
    evidence = await getReleaseEvidence();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login?next=/evidence");
    requestId = error instanceof ApiError ? error.requestId : undefined;
  }
  return evidence ? <EvidenceWorkspace evidence={evidence} /> : <DisconnectedBrief requestId={requestId} />;
}
