import { ArrowRight, Cloud, GitCommitHorizontal, Route } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { compactIdentity, releaseProofState } from "@/lib/release/presentation";
import { cn } from "@/lib/utils";

export function ReleaseStrip({
  environment,
  releaseSha,
  model,
  modelLocation,
  runId,
  className,
}: {
  environment: string;
  releaseSha?: string | null;
  model: string;
  modelLocation: string;
  runId?: string | null;
  className?: string;
}) {
  const proof = releaseProofState(environment, releaseSha);
  return (
    <section
      aria-label="Release proof"
      className={cn("mb-5 overflow-hidden rounded-xl border bg-card", className)}
    >
      <div className="flex min-h-12 items-center gap-3 px-3 py-2.5 sm:px-4">
        <Badge variant={proof.state === "proven" ? "exact" : proof.state === "pending" ? "attention" : "outline"} className="shrink-0">
          <Cloud aria-hidden="true" className="size-3.5" /> {proof.label}
        </Badge>
        <span className="flex-1 sm:hidden" aria-hidden="true" />
        <div className="hidden min-w-0 flex-1 items-center gap-5 text-xs sm:flex">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <GitCommitHorizontal aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Release</span>
            <span className="truncate font-mono font-semibold">{compactIdentity(releaseSha)}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Cloud aria-hidden="true" className="size-3.5 shrink-0 text-gemini" />
            <span className="truncate font-semibold">{model} · {modelLocation}</span>
          </span>
          <span className="hidden min-w-0 items-center gap-1.5 lg:inline-flex">
            <Route aria-hidden="true" className="size-3.5 shrink-0 text-owner" />
            <span className="text-muted-foreground">Run</span>
            <span className="truncate font-mono font-semibold">{compactIdentity(runId, "not observed")}</span>
          </span>
        </div>
        <Link
          href="/evidence#release"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="sm:hidden">Proof</span>
          <span className="hidden sm:inline">Open release proof</span>
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
      {proof.state !== "proven" ? (
        <p className="border-t bg-muted/25 px-3 py-2 text-[0.68rem] leading-5 text-muted-foreground sm:px-4">
          {proof.description}
        </p>
      ) : null}
    </section>
  );
}
