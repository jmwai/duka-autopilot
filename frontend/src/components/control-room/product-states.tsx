import { CheckCircle2, CloudOff, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="grid min-h-64 place-items-center p-8 text-center">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-exact/10 text-exact"><CheckCircle2 aria-hidden="true" className="size-5" /></span>
          <h2 className="mt-4 text-lg font-bold">{title}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
          {action ? <div className="mt-5">{action}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function PendingState({ title, description }: { title: string; description: string }) {
  return (
    <Card aria-live="polite" aria-busy="true">
      <CardContent className="grid min-h-52 place-items-center p-8 text-center">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-gemini/10 text-gemini"><LoaderCircle aria-hidden="true" className="size-5 animate-spin" /></span>
          <h2 className="mt-4 text-lg font-bold">{title}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function FailureState({
  title,
  description,
  requestId,
  onRetry,
  action,
}: {
  title: string;
  description: string;
  requestId?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <Card role="alert">
      <CardContent className="grid min-h-64 place-items-center p-8 text-center">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-conflict/10 text-conflict"><TriangleAlert aria-hidden="true" className="size-5" /></span>
          <h2 className="mt-4 text-lg font-bold">{title}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
          {requestId ? <p className="mt-3 font-mono text-xs text-muted-foreground">Request {requestId}</p> : null}
          {onRetry ? <Button type="button" variant="outline" className="mt-5" onClick={onRetry}><RotateCcw aria-hidden="true" /> Retry</Button> : null}
          {action ? <div className="mt-5">{action}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function DegradedBanner({ title, description, requestId, className }: { title: string; description: string; requestId?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex gap-3 rounded-xl border border-owner/35 bg-owner/10 p-4", className)}>
      <CloudOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        {requestId ? <p className="mt-2 font-mono text-[0.68rem] text-muted-foreground">Request {requestId}</p> : null}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">Loading the control room</span>
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-52 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36 rounded-xl" />)}
      </div>
    </div>
  );
}
