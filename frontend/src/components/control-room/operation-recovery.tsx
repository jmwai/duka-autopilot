import { LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OperationRecovery({
  title,
  description,
  operationId,
  requestId,
  onRetry,
  retryLabel = "Retry same operation",
  busy = false,
  compact = false,
  className,
}: {
  title: string;
  description: string;
  operationId?: string;
  requestId?: string;
  onRetry?: () => void;
  retryLabel?: string;
  busy?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-conflict/35 bg-conflict/5",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="flex gap-3">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-conflict" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          {operationId || requestId ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.66rem] text-muted-foreground">
              {operationId ? <span className="break-all">operation {operationId}</span> : null}
              {requestId ? <span className="break-all">request {requestId}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <Button type="button" size="sm" variant="outline" className="mt-3 w-full sm:w-auto" onClick={onRetry} disabled={busy}>
          {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
          {busy ? "Retrying…" : retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
