import { Braces, ChevronDown, CirclePause, Route, Timer, WalletCards } from "lucide-react";

import { TrustBadge } from "@/components/control-room/trust-badge";

function numberMeta(meta: Record<string, unknown>, key: string) {
  const value = meta[key];
  return typeof value === "number" ? value : null;
}

export function ExecutionReceipt({ meta }: { meta: Record<string, unknown> }) {
  const eventId = typeof meta.event_id === "string" ? meta.event_id : null;
  const nodePath = Array.isArray(meta.node_path)
    ? meta.node_path.filter((node): node is string => typeof node === "string")
    : [];
  const wallMs = numberMeta(meta, "wall_ms");
  const costUsd = numberMeta(meta, "cost_usd");
  const tokenMeta = meta.tokens;
  const inputTokens = tokenMeta && typeof tokenMeta === "object"
    ? numberMeta(tokenMeta as Record<string, unknown>, "input")
    : null;
  const outputTokens = tokenMeta && typeof tokenMeta === "object"
    ? numberMeta(tokenMeta as Record<string, unknown>, "output")
    : null;
  const suspended = meta.suspended === true;
  if (!eventId && !nodePath.length && wallMs === null && costUsd === null
      && inputTokens === null && outputTokens === null) return null;

  return (
    <details className="group mt-2 rounded-lg border bg-background/60 text-xs text-muted-foreground">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 font-semibold text-foreground">
        <span className="flex items-center gap-2"><Route aria-hidden="true" className="size-3.5" />Execution receipt</span>
        <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t px-3 py-3">
        <div className="flex flex-wrap gap-2">
          <TrustBadge lane="gemini" />
          {suspended ? <span className="inline-flex items-center gap-1"><CirclePause aria-hidden="true" className="size-3" />Suspended for owner</span> : null}
        </div>
        {nodePath.length ? (
          <div><p className="font-semibold text-foreground">Node path</p><p className="mt-1 break-words font-mono">{nodePath.join(" → ")}</p></div>
        ) : null}
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono">
          {wallMs !== null ? <span className="inline-flex items-center gap-1"><Timer aria-hidden="true" className="size-3" />{wallMs.toLocaleString()} ms</span> : null}
          {costUsd !== null ? <span className="inline-flex items-center gap-1"><WalletCards aria-hidden="true" className="size-3" />${costUsd.toFixed(6)}</span> : null}
          {inputTokens !== null || outputTokens !== null ? (
            <span className="inline-flex items-center gap-1"><Braces aria-hidden="true" className="size-3" />{(inputTokens ?? 0).toLocaleString()} in · {(outputTokens ?? 0).toLocaleString()} out</span>
          ) : null}
          {eventId ? <span className="break-all">event {eventId}</span> : null}
        </div>
      </div>
    </details>
  );
}
