import { Check, Circle, CircleAlert, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type TimelineStatus = "complete" | "current" | "pending" | "failed";

export type TimelineItem = {
  title: string;
  detail?: string;
  meta?: React.ReactNode;
  status: TimelineStatus;
};

const statusPresentation = {
  complete: { icon: Check, className: "border-exact/30 bg-exact/10 text-exact", label: "Complete" },
  current: { icon: LoaderCircle, className: "border-gemini/30 bg-gemini/10 text-gemini", label: "In progress" },
  pending: { icon: Circle, className: "border-border bg-card text-muted-foreground", label: "Pending" },
  failed: { icon: CircleAlert, className: "border-conflict/30 bg-conflict/10 text-conflict", label: "Failed" },
} as const;

export function StatusTimeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("space-y-0", className)}>
      {items.map((item, index) => {
        const presentation = statusPresentation[item.status];
        const Icon = presentation.icon;
        return (
          <li key={`${item.title}-${index}`} className="grid grid-cols-[2rem_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span className={cn("mt-0.5 grid size-7 place-items-center rounded-full border", presentation.className)}>
                <Icon aria-hidden="true" className={cn("size-3.5", item.status === "current" && "animate-spin")} />
                <span className="sr-only">{presentation.label}</span>
              </span>
              {index < items.length - 1 ? <span aria-hidden="true" className="my-1 min-h-6 w-px flex-1 bg-border" /> : null}
            </div>
            <div className="pb-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.meta ? <span className="font-mono text-[0.68rem] text-muted-foreground">{item.meta}</span> : null}
              </div>
              {item.detail ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
