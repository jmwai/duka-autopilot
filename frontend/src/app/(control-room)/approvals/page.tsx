import { redirect } from "next/navigation";

import { DisconnectedBrief } from "@/components/control-room/disconnected-brief";
import { DecisionQueue } from "@/components/decisions/decision-queue";
import { approvalsSchema } from "@/lib/api/contracts";
import { ApiError, apiFetch } from "@/lib/api/server-client";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  let approvals;
  let requestId: string | undefined;
  try {
    approvals = await apiFetch("approvals", approvalsSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login?next=/approvals");
    requestId = error instanceof ApiError ? error.requestId : undefined;
  }
  return approvals
    ? <DecisionQueue initialApprovals={approvals} />
    : <DisconnectedBrief requestId={requestId} />;
}
