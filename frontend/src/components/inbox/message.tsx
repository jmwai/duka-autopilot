import { Clock3, Image as ImageIcon, Mic2, Paperclip } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MessageScroller({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[28rem] space-y-4 overflow-y-auto p-4 sm:p-5">{children}</div>;
}

export function Message({
  direction,
  children,
}: {
  direction: "in" | "out" | "pending";
  children: React.ReactNode;
}) {
  return (
    <article className={cn("flex", direction === "in" ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[88%] sm:max-w-[75%]", direction === "in" && "items-end")}>
        {children}
      </div>
    </article>
  );
}

export function Bubble({
  direction,
  children,
}: {
  direction: "in" | "out" | "pending";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
        direction === "in" && "rounded-br-sm bg-primary text-primary-foreground",
        direction === "out" && "rounded-bl-sm border bg-card",
        direction === "pending" && "rounded-bl-sm border border-dashed bg-muted text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  const Icon = channel === "voice" ? Mic2 : channel === "photo" ? ImageIcon : Paperclip;
  return (
    <Badge variant="outline" className="mb-2 bg-transparent text-[0.65rem]">
      <Icon aria-hidden="true" className="size-3" />
      {channel}
    </Badge>
  );
}

export function QueuedReceipt({ eventId, queuedAt }: { eventId: string; queuedAt: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 font-mono text-[0.65rem] text-muted-foreground">
      <Clock3 aria-hidden="true" className="size-3" />
      queued {queuedAt} · {eventId.slice(0, 10)}
    </div>
  );
}
