import { RefreshCw } from "lucide-react";
import Link from "next/link";

import { FailureState } from "@/components/control-room/product-states";
import { Button } from "@/components/ui/button";

import { PageHeader } from "./page-header";

export function DisconnectedBrief({ requestId }: { requestId?: string }) {
  return (
    <>
      <PageHeader
        eyebrow="Morning brief"
        title="The control room is waiting for its books."
        description="The public frontend is healthy, but the private API did not return a compatible morning brief. No values have been invented."
      />
      <FailureState
        title="Private API unavailable"
        description="Readiness will remain closed until the dependency is configured and returns validated operational data."
        requestId={requestId}
        action={<Button asChild variant="outline"><Link href="/"><RefreshCw aria-hidden="true" /> Try again</Link></Button>}
      />
    </>
  );
}
