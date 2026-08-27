import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MetricTone = "neutral" | "exact" | "gemini" | "owner";

const toneClasses: Record<MetricTone, string> = {
  neutral: "bg-muted text-foreground",
  exact: "bg-exact/10 text-exact",
  gemini: "bg-gemini/10 text-gemini",
  owner: "bg-owner/15 text-foreground",
};

export function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon?: LucideIcon;
  tone?: MetricTone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 sm:p-5", className)}>
      {Icon ? (
        <span className={cn("mb-4 grid size-9 place-items-center rounded-lg", toneClasses[tone])}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
      ) : null}
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="numeric mt-1 text-2xl font-bold tracking-[-0.025em]">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function KshValue({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("numeric whitespace-nowrap", className)}>
      {new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: 0,
      }).format(value)}
    </span>
  );
}
