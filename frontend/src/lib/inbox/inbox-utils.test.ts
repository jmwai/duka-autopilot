import { describe, expect, it } from "vitest";

import type { DukaMessage } from "@/lib/api/contracts";

import { hasCompletedReply, hasInboundReceipt, inboxPollInterval } from "./events";
import {
  MAX_MEDIA_BYTES,
  acceptedMedia,
  base64FromDataUrl,
  normalizeMime,
  validateMedia,
} from "./media";

const messages: DukaMessage[] = [
  {
    id: "1",
    customer_id: "customer_a",
    direction: "in",
    channel: "voice",
    text: "[voice message]",
    meta: { event_id: "evt-1" },
  },
  {
    id: "2",
    customer_id: "customer_a",
    direction: "out",
    channel: "voice",
    text: "Order received.",
    meta: { event_id: "evt-1", node_path: ["screen", "order_intake"] },
  },
];

describe("Inbox media boundary", () => {
  it("normalizes recorder codecs but preserves the backend MIME allowlist", () => {
    expect(normalizeMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(acceptedMedia("audio/webm;codecs=opus")).toEqual({
      kind: "voice",
      mime: "audio/webm",
    });
    expect(acceptedMedia("application/pdf")).toBeNull();
  });

  it("enforces the decoded six-megabyte boundary before encoding", () => {
    expect(validateMedia("image/jpeg", MAX_MEDIA_BYTES)).toBeNull();
    expect(validateMedia("image/jpeg", MAX_MEDIA_BYTES + 1)).toContain("6 MB");
    expect(validateMedia("image/svg+xml", 100)).toContain("JPEG");
  });

  it("extracts only the payload from a valid data URL", () => {
    expect(base64FromDataUrl("data:audio/ogg;base64,T2dnUw==")).toBe("T2dnUw==");
    expect(() => base64FromDataUrl("data:text/plain,not-base64")).toThrow();
  });
});

describe("Inbox event receipts", () => {
  it("distinguishes durable intake from a completed worker reply", () => {
    expect(hasInboundReceipt(messages, "evt-1")).toBe(true);
    expect(hasCompletedReply(messages, "evt-1")).toBe(true);
    expect(hasCompletedReply(messages.slice(0, 1), "evt-1")).toBe(false);
  });

  it("polls quickly only while an event is outstanding and stops when hidden", () => {
    expect(inboxPollInterval(true, false)).toBe(1_000);
    expect(inboxPollInterval(false, false)).toBe(5_000);
    expect(inboxPollInterval(true, true)).toBe(false);
  });
});
