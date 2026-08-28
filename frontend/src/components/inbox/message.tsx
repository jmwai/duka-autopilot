import { AlertCircle, Check, CheckCheck, Clock3, Image as ImageIcon, Mic2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Owner's view, as in WhatsApp Business: the customer sits on the left, Duka's
 * own replies on the right. `direction` stays in the API's vocabulary — "in" is
 * inbound from the customer — so only the alignment reads from the shop's side.
 */
export type BubbleDirection = "in" | "out" | "pending";

/** Delivery marks mirror the real send lifecycle; see DeliveryMark below. */
export type DeliveryState = "encoding" | "sending" | "queued" | "received" | "replied" | "failed";

export function MessageScroller({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4 sm:px-5">
      {children}
    </div>
  );
}

export function Message({
  direction,
  children,
}: {
  direction: BubbleDirection;
  children: React.ReactNode;
}) {
  // Duka's own messages ("out") and anything still in flight sit right.
  const mine = direction !== "in";
  return (
    <article className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className="max-w-[85%] sm:max-w-[72%]">{children}</div>
    </article>
  );
}

export function Bubble({
  direction,
  children,
}: {
  direction: BubbleDirection;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm",
        // The squared corner is the tail, on the side the bubble is anchored to.
        direction === "in" && "rounded-bl-sm border bg-card",
        direction === "out" && "rounded-br-sm bg-primary text-primary-foreground",
        direction === "pending" && "rounded-br-sm border border-dashed bg-muted text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}

/**
 * A centred note about the conversation rather than a message in it — the
 * worker picking an event up, or a session rotating.
 */
export function SystemNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center py-1.5">
      <p className="flex items-center gap-2 rounded-full border bg-muted/70 px-3 py-1 text-[0.7rem] text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

export function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-3">
      <span className="rounded-full border bg-card px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm">
        {label}
      </span>
    </div>
  );
}

/**
 * The delivery mark and its label. The label stays visible on purpose: the
 * design system requires state to read without relying on colour, and these
 * exact strings are the async evidence the e2e suite asserts.
 */
export function DeliveryMark({ state, label, className }: {
  state: DeliveryState;
  label: string;
  className?: string;
}) {
  const Icon = state === "failed"
    ? AlertCircle
    : state === "encoding" || state === "sending"
      ? Clock3
      : state === "queued"
        ? Check
        : CheckCheck;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[0.65rem]",
        state === "failed" && "text-conflict",
        state === "replied" && "text-exact",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {label}
    </span>
  );
}

/** Timestamp, and optionally a delivery mark, tucked into the bubble's foot. */
export function BubbleFoot({ time, children, muted }: {
  time?: string | null;
  children?: React.ReactNode;
  muted?: boolean;
}) {
  if (!time && !children) return null;
  return (
    <span
      className={cn(
        "mt-0.5 flex items-center justify-end gap-2 text-[0.65rem]",
        muted ? "text-muted-foreground" : "text-current/70",
      )}
    >
      {children}
      {time ? <span className="numeric">{time}</span> : null}
    </span>
  );
}

/** Only voice and photo earn a marker; plain text needs none. */
export function ChannelMark({ channel }: { channel: string }) {
  if (channel !== "voice" && channel !== "photo") return null;
  const Icon = channel === "voice" ? Mic2 : ImageIcon;
  return (
    <span className="mr-1.5 inline-flex items-center gap-1 align-middle text-[0.7rem] opacity-80">
      <Icon aria-hidden="true" className="size-3.5" />
      <span className="sr-only">{channel} message</span>
    </span>
  );
}

/**
 * The agent replies in light markdown. Rendering `**bold**` literally puts raw
 * asterisks in the bubble, so emphasis is resolved here — text only, no HTML is
 * ever interpreted, so a model cannot inject markup into the thread.
 */
export function MessageText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => (
        part.startsWith("**") && part.endsWith("**") && part.length > 4
          ? <strong key={index}>{part.slice(2, -2)}</strong>
          : <span key={index}>{part}</span>
      ))}
    </>
  );
}

export function QueuedReceipt({ eventId, queuedAt }: { eventId: string; queuedAt: string }) {
  return (
    <div className="mt-1 flex items-center gap-2 font-mono text-[0.65rem] opacity-80">
      <Clock3 aria-hidden="true" className="size-3" />
      queued {queuedAt} · {eventId.slice(0, 10)}
    </div>
  );
}
