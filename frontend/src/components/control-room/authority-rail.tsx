import { ArrowRight } from "lucide-react";

import { TrustBadge } from "@/components/control-room/trust-badge";
import { cn } from "@/lib/utils";

export type AuthorityStep = {
  lane: "exact" | "gemini" | "owner";
  title: string;
  detail: string;
  value?: React.ReactNode;
};

export function AuthorityRail({
  steps,
  className,
  compactOnMobile = false,
}: {
  steps: AuthorityStep[];
  className?: string;
  compactOnMobile?: boolean;
}) {
  return (
    <ol
      aria-label="Authority path"
      className={cn(
        "grid gap-2 rounded-xl border bg-card p-3 lg:items-stretch",
        steps.length === 4
          ? "lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]"
          : "lg:grid-cols-[1fr_auto_1fr_auto_1fr]",
        className,
      )}
    >
      {steps.map((step, index) => (
        <li key={`${step.lane}-${step.title}`} className="contents">
          <div className={cn("rounded-lg bg-muted/45 p-3.5", compactOnMobile && "p-3 sm:p-3.5")}>
            <div className="flex items-start justify-between gap-3">
              <TrustBadge lane={step.lane} />
              {step.value !== undefined ? <span className="numeric font-mono text-sm font-bold">{step.value}</span> : null}
            </div>
            <p className={cn("mt-3 text-sm font-semibold", compactOnMobile && "mt-2 sm:mt-3")}>{step.title}</p>
            <p className={cn("mt-1 text-xs leading-5 text-muted-foreground", compactOnMobile && "hidden sm:block")}>{step.detail}</p>
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
