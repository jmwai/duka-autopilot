import { CloudOff, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { PageHeader } from "./page-header";

export function DisconnectedBrief({ requestId }: { requestId?: string }) {
  return (
    <>
      <PageHeader
        eyebrow="Morning brief"
        title="The control room is waiting for its books."
        description="The public frontend is healthy, but the private API did not return a compatible morning brief. No values have been invented."
      />
      <Card>
        <CardContent className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
            <CloudOff aria-hidden="true" className="size-5" />
          </span>
          <p className="font-semibold">Private API unavailable</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            Readiness will remain closed until the dependency is configured and returns validated operational data.
          </p>
          {requestId ? <code className="mt-3 text-xs text-muted-foreground">Request {requestId}</code> : null}
          <Button asChild variant="outline" className="mt-5">
            <Link href="/"><RefreshCw aria-hidden="true" /> Try again</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
