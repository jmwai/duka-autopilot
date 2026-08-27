import { ArrowRight } from "lucide-react";

import { TrustBadge } from "@/components/control-room/trust-badge";
import { cn } from "@/lib/utils";

export type AuthorityStep = {
  lane: "exact" | "gemini" | "owner";
  title: string;
  detail: string;
  value?: React.ReactNode;
};

export function AuthorityRail({ steps, className }: { steps: AuthorityStep[]; className?: string }) {
  return (
    <ol
      aria-label="Authority path"
      className={cn("grid gap-2 rounded-xl border bg-card p-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch", className)}
    >
      {steps.map((step, index) => (
        <li key={`${step.lane}-${step.title}`} className="contents">
          <div className="rounded-lg bg-muted/45 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <TrustBadge lane={step.lane} />
              {step.value !== undefined ? <span className="numeric font-mono text-sm font-bold">{step.value}</span> : null}
            </div>
            <p className="mt-3 text-sm font-semibold">{step.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
          </div>
          {index < steps.length - 1 ? (
            <span aria-hidden="true" className="hidden items-center justify-center px-1 text-muted-foreground lg:flex">
              <ArrowRight className="size-4" />
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
