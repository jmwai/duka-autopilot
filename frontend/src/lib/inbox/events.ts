import type { DukaMessage } from "@/lib/api/contracts";

export function messageEventId(message: DukaMessage) {
  return typeof message.meta.event_id === "string" ? message.meta.event_id : null;
}

export function hasInboundReceipt(messages: DukaMessage[], eventId: string) {
  return messages.some(
    (message) => message.direction === "in" && messageEventId(message) === eventId,
  );
}

export function hasCompletedReply(messages: DukaMessage[], eventId: string) {
  return messages.some(
    (message) => message.direction === "out" && messageEventId(message) === eventId,
  );
}

export function inboxPollInterval(hasOutstandingEvent: boolean, pageHidden: boolean) {
  if (pageHidden) return false;
  return hasOutstandingEvent ? 1_000 : 5_000;
}
