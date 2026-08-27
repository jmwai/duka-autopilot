"use client";

import { CircleCheck, CircleDashed, ExternalLink, FileSearch, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type ProofFact = { label: string; value: React.ReactNode };
export type EvidenceState = "proven" | "pending" | "not-proven";

const evidencePresentation = {
  proven: { label: "Proven", icon: CircleCheck, className: "text-exact" },
  pending: { label: "Pending", icon: CircleDashed, className: "text-pending" },
  "not-proven": { label: "Not proven", icon: ShieldAlert, className: "text-conflict" },
} as const;

export function EnvironmentBadge({ environment }: { environment: string }) {
  return <Badge variant="outline" className="font-mono text-[0.65rem] uppercase tracking-[0.12em]">{environment}</Badge>;
}

export function ReleaseStamp({ sha, label = "Release" }: { sha?: string | null; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
      <FileSearch aria-hidden="true" className="size-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold">{sha ? sha.slice(0, 12) : "not proven"}</span>
    </span>
  );
}

export function EvidenceSource({ label, detail, state, href }: { label: string; detail: string; state: EvidenceState; href?: string }) {
  const presentation = evidencePresentation[state];
  const Icon = presentation.icon;
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold", presentation.className)}>
          <Icon aria-hidden="true" className="size-3.5" /> {presentation.label}
        </span>
      </div>
      {href ? href.startsWith("/")
        ? <Link href={href} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline">Open evidence <ExternalLink aria-hidden="true" className="size-3" /></Link>
        : <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline">Open evidence <ExternalLink aria-hidden="true" className="size-3" /></a>
        : null}
    </div>
  );
}

export function ProofSheet({
  title,
  description,
  outcome,
  reason,
  facts = [],
  sources = [],
  limitations = [],
  trigger,
}: {
  title: string;
  description: string;
  outcome: React.ReactNode;
  reason: React.ReactNode;
  facts?: ProofFact[];
  sources?: Array<{ label: string; detail: string; state: EvidenceState; href?: string }>;
  limitations?: string[];
  trigger?: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger ?? <Button type="button" variant="outline"><FileSearch aria-hidden="true" /> Show proof</Button>}</SheetTrigger>
      <SheetContent side="right" className="w-[min(96vw,34rem)] overflow-y-auto p-0">
        <SheetHeader className="border-b p-5 pr-14 sm:p-6 sm:pr-14">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 p-5 sm:p-6">
          <section>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary">Outcome</p>
            <div className="mt-2 text-sm leading-6">{outcome}</div>
          </section>
          <Separator />
          <section>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-gemini">Reason</p>
            <div className="mt-2 text-sm leading-6 text-muted-foreground">{reason}</div>
          </section>
          {facts.length ? (
            <section className="grid gap-2 sm:grid-cols-2">
              {facts.map((fact) => (
                <div key={fact.label} className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{fact.label}</p>
                  <div className="mt-1 break-words font-mono text-xs">{fact.value}</div>
                </div>
              ))}
            </section>
          ) : null}
          {sources.length ? (
            <section>
              <h3 className="text-sm font-semibold">Evidence sources</h3>
              <div className="mt-3 space-y-2">{sources.map((source) => <EvidenceSource key={`${source.label}-${source.detail}`} {...source} />)}</div>
            </section>
          ) : null}
          {limitations.length ? (
            <section className="rounded-xl border border-owner/35 bg-owner/10 p-4">
              <h3 className="text-sm font-semibold">Boundary and limitations</h3>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">{limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}</ul>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
