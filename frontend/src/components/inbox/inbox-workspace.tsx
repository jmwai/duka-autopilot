"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CircleCheck,
  Image as ImageIcon,
  LoaderCircle,
  Mic2,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Square,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/control-room/page-header";
import { TrustBadge } from "@/components/control-room/trust-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BrowserApiError,
  browserApi,
} from "@/lib/api/browser-client";
import {
  type Customer,
  type DukaMessage,
  messagesSchema,
  newSessionSchema,
  queuedEventSchema,
} from "@/lib/api/contracts";
import {
  hasCompletedReply,
  hasInboundReceipt,
  inboxPollInterval,
} from "@/lib/inbox/events";
import {
  MAX_MESSAGE_CHARACTERS,
  acceptedMedia,
  blobToBase64,
  formatMediaBytes,
  preferredRecorderMime,
  validateMedia,
  type AcceptedMedia,
} from "@/lib/inbox/media";
import { cn } from "@/lib/utils";

import { ExecutionReceipt } from "./execution-receipt";
import {
  Bubble,
  ChannelBadge,
  Message,
  MessageScroller,
  QueuedReceipt,
} from "./message";

type MediaAttachment = AcceptedMedia & {
  id: string;
  blob: Blob;
  name: string;
};

type InboundPayload = {
  event_id: string;
  customer_id: string;
  text: string;
  channel: "chat" | "voice" | "photo";
  image_b64?: string;
  image_mime?: string;
  audio_b64?: string;
  audio_mime?: string;
};

type PendingEvent = {
  eventId: string;
  customerId: string;
  channel: InboundPayload["channel"];
  preview: string;
  queuedAt: string;
  status: "sending" | "queued" | "failed";
  payload: InboundPayload;
};

function displayTime(value?: string) {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.valueOf())) return null;
  return new Intl.DateTimeFormat("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function eventPreview(text: string, attachment: MediaAttachment | null) {
  if (text.trim()) return text.trim();
  return attachment?.kind === "voice" ? "[voice message]" : "[photo message]";
}

function AttachmentPreview({ attachment }: { attachment: MediaAttachment }) {
  const [url] = useState(() => URL.createObjectURL(attachment.blob));

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  if (attachment.kind === "photo") {
    return (
      <Image
        unoptimized
        src={url}
        width={84}
        height={64}
        alt="Selected photo preview"
        className="h-16 w-21 rounded-md border object-cover"
      />
    );
  }
  return <audio controls preload="metadata" src={url} className="h-10 max-w-full" />;
}

function explainError(error: unknown) {
  if (error instanceof BrowserApiError) return error.message;
  return error instanceof Error ? error.message : "The event could not be queued.";
}

export function InboxWorkspace({ initialCustomers }: { initialCustomers: Customer[] }) {
  const router = useRouter();
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomers[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<MediaAttachment | null>(null);
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [encoding, setEncoding] = useState(false);
  const [recording, setRecording] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedCustomer = initialCustomers.find((customer) => customer.id === selectedCustomerId);
  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return initialCustomers;
    return initialCustomers.filter((customer) => customer.name.toLowerCase().includes(needle));
  }, [initialCustomers, search]);
  const messagesQuery = useQuery({
    queryKey: ["messages", selectedCustomerId],
    queryFn: () => browserApi(`messages/${selectedCustomerId}`, messagesSchema),
    enabled: Boolean(selectedCustomerId),
    refetchInterval: (query) => {
      const currentMessages = messagesSchema.safeParse(query.state.data);
      const hasOutstanding = pendingEvents.some((event) => (
        event.customerId === selectedCustomerId
        && (!currentMessages.success || !hasCompletedReply(currentMessages.data, event.eventId))
        && (
          event.status !== "failed"
          || (currentMessages.success && hasInboundReceipt(currentMessages.data, event.eventId))
        )
      ));
      return inboxPollInterval(
        hasOutstanding,
        typeof document !== "undefined" && document.visibilityState === "hidden",
      );
    },
  });
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);
  const selectedPending = pendingEvents.filter((event) => (
    event.customerId === selectedCustomerId && !hasCompletedReply(messages, event.eventId)
  ));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, selectedPending.length]);

  useEffect(() => () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function handleAuthError(error: unknown) {
    if (error instanceof BrowserApiError && error.status === 401) {
      router.replace(`/login?next=${encodeURIComponent("/inbox")}`);
      router.refresh();
      return true;
    }
    return false;
  }

  function selectCustomer(customerId: string) {
    setSelectedCustomerId(customerId);
    setText("");
    setAttachment(null);
  }

  function chooseAttachment(blob: Blob, name: string) {
    const media = acceptedMedia(blob.type);
    const error = validateMedia(blob.type, blob.size);
    if (!media || error) {
      toast.error(error ?? "That media type is not supported.");
      return;
    }
    setAttachment({ ...media, id: crypto.randomUUID(), blob, name });
  }

  async function dispatchEvent(event: PendingEvent) {
    setPendingEvents((current) => current.map((candidate) => (
      candidate.eventId === event.eventId ? { ...candidate, status: "sending" } : candidate
    )));
    try {
      const receipt = await browserApi("inbound", queuedEventSchema, {
        method: "POST",
        body: JSON.stringify(event.payload),
      });
      setPendingEvents((current) => current.map((candidate) => (
        candidate.eventId === event.eventId
          ? { ...candidate, eventId: receipt.event_id, status: "queued" }
          : candidate
      )));
      await messagesQuery.refetch();
    } catch (error) {
      setPendingEvents((current) => current.map((candidate) => (
        candidate.eventId === event.eventId ? { ...candidate, status: "failed" } : candidate
      )));
      if (!handleAuthError(error)) toast.error(explainError(error));
    }
  }

  async function sendEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const cleanText = text.trim();
    if (!selectedCustomer || (!cleanText && !attachment) || encoding || recording) return;
    setEncoding(true);
    try {
      const eventId = crypto.randomUUID().replaceAll("-", "");
      const channel = attachment?.kind ?? "chat";
      const payload: InboundPayload = {
        event_id: eventId,
        customer_id: selectedCustomer.id,
        text: cleanText,
        channel,
      };
      if (attachment) {
        const encoded = await blobToBase64(attachment.blob);
        if (attachment.kind === "photo") {
          payload.image_b64 = encoded;
          payload.image_mime = attachment.mime;
        } else {
          payload.audio_b64 = encoded;
          payload.audio_mime = attachment.mime;
        }
      }
      const pending: PendingEvent = {
        eventId,
        customerId: selectedCustomer.id,
        channel,
        preview: eventPreview(cleanText, attachment),
        queuedAt: new Date().toISOString(),
        status: "sending",
        payload,
      };
      setPendingEvents((current) => [...current, pending]);
      setText("");
      setAttachment(null);
      void dispatchEvent(pending);
    } catch (error) {
      toast.error(explainError(error));
    } finally {
      setEncoding(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser does not expose microphone recording.");
      return;
    }
    const mime = preferredRecorderMime();
    if (!mime) {
      toast.error("This browser cannot record one of the supported audio formats.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recordedChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);
        chooseAttachment(blob, `voice-note.${mime.split("/")[1]}`);
      };
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone permission was not granted. You can attach a recorded file instead.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }

  async function rotateSession() {
    if (!selectedCustomer || rotating) return;
    setRotating(true);
    try {
      await browserApi("sessions/new", newSessionSchema, {
        method: "POST",
        body: JSON.stringify({ customer_id: selectedCustomer.id }),
      });
      setRotationOpen(false);
      toast.success(`A fresh managed session is active for ${selectedCustomer.name}.`);
    } catch (error) {
      if (!handleAuthError(error)) toast.error(explainError(error));
    } finally {
      setRotating(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Live operations"
        title="Customer inbox"
        description="Queue the messy message as it arrived. The worker persists its own receipt, runs the ADK workflow, and replies asynchronously."
        action={
          <Button
            type="button"
            variant="outline"
            disabled={!selectedCustomer}
            onClick={() => setRotationOpen(true)}
          >
            <RotateCcw aria-hidden="true" />
            Start a new day
          </Button>
        }
      />

      <div className="scrollbar-none mb-4 flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
        <div className="min-w-[15rem] rounded-xl border bg-card p-3.5 sm:min-w-0">
          <TrustBadge lane="exact" />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">The event ID and queue handoff are deterministic.</p>
        </div>
        <div className="min-w-[15rem] rounded-xl border bg-card p-3.5 sm:min-w-0">
          <TrustBadge lane="gemini" />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Voice and photo meaning stays bounded by tools.</p>
        </div>
        <div className="min-w-[15rem] rounded-xl border bg-card p-3.5 sm:min-w-0">
          <TrustBadge lane="owner" />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Ambiguous or consequential work stops for review.</p>
        </div>
      </div>

      <div className="grid min-h-[42rem] gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">
        <Card className="hidden overflow-hidden lg:block">
          <CardHeader className="border-b">
            <CardTitle>Customers</CardTitle>
            <label className="relative mt-3 block">
              <span className="sr-only">Search customers</span>
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                placeholder="Find a customer"
              />
            </label>
          </CardHeader>
          <div className="max-h-[38rem] overflow-y-auto p-2">
            {filteredCustomers.map((customer) => {
              const queued = pendingEvents.filter(
                (event) => event.customerId === customer.id && event.status !== "failed",
              ).length;
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => selectCustomer(customer.id)}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    selectedCustomerId === customer.id ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                    <UserRound aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{customer.name}</span>
                  {queued ? <Badge variant="attention" className="px-2">{queued}</Badge> : null}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex min-h-16 items-center justify-between gap-3 border-b px-4 sm:px-5">
            <div className="min-w-0">
              <label htmlFor="mobile-customer" className="sr-only">Customer thread</label>
              <select
                id="mobile-customer"
                value={selectedCustomerId}
                onChange={(event) => selectCustomer(event.target.value)}
                className="max-w-full rounded-md bg-transparent py-1 pr-8 font-semibold focus-visible:outline-2 lg:hidden"
              >
                {initialCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
              <p className="hidden truncate font-semibold lg:block">{selectedCustomer?.name ?? "No customer selected"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Synthetic customer thread · latest 50 messages</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              {messagesQuery.isFetching ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <CircleCheck aria-hidden="true" className="size-3.5 text-exact" />}
              {messagesQuery.isFetching ? "Checking" : "Caught up"}
            </div>
          </div>

          <MessageScroller>
            {messagesQuery.isError ? (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <p className="font-semibold">This thread could not be loaded.</p>
                <p className="mt-1 text-sm text-muted-foreground">Nothing has been inferred from unavailable data.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    if (!handleAuthError(messagesQuery.error)) void messagesQuery.refetch();
                  }}
                >
                  <RefreshCw aria-hidden="true" /> Retry
                </Button>
              </div>
            ) : null}
            {!messagesQuery.isError && !messagesQuery.isPending && !messages.length && !selectedPending.length ? (
              <div className="grid min-h-80 place-items-center text-center">
                <div>
                  <span className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
                    <Mic2 aria-hidden="true" className="size-5" />
                  </span>
                  <p className="mt-4 font-semibold">The counter is quiet.</p>
                  <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Send a Swahili text, a purpose-recorded voice note, or a synthetic ledger photo.</p>
                </div>
              </div>
            ) : null}
            {messages.map((message: DukaMessage) => (
              <Message key={message.id} direction={message.direction}>
                <ChannelBadge channel={message.channel} />
                <Bubble direction={message.direction}>
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  {message.direction === "out" ? <ExecutionReceipt meta={message.meta} /> : null}
                </Bubble>
                {displayTime(message.created_at) ? (
                  <p className={cn("mt-1 px-1 text-[0.65rem] text-muted-foreground", message.direction === "in" && "text-right")}>
                    {displayTime(message.created_at)}
                  </p>
                ) : null}
              </Message>
            ))}
            {selectedPending.map((event) => {
              const persisted = hasInboundReceipt(messages, event.eventId);
              if (persisted) {
                return (
                  <div key={event.eventId} className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground" role="status">
                    <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                    Worker is processing event {event.eventId.slice(0, 10)}…
                  </div>
                );
              }
              return (
                <Message key={event.eventId} direction="in">
                  <ChannelBadge channel={event.channel} />
                  <Bubble direction={event.status === "failed" ? "pending" : "in"}>
                    <p className="whitespace-pre-wrap break-words">{event.preview}</p>
                    <QueuedReceipt eventId={event.eventId} queuedAt={displayTime(event.queuedAt) ?? "now"} />
                    <p className="mt-1 text-[0.7rem] font-semibold">
                      {event.status === "sending" ? "Handing off…" : event.status === "queued" ? "Accepted · waiting for worker" : "Handoff uncertain"}
                    </p>
                    {event.status === "failed" ? (
                      <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void dispatchEvent(event)}>
                        <RefreshCw aria-hidden="true" /> Retry same event ID
                      </Button>
                    ) : null}
                  </Bubble>
                </Message>
              );
            })}
            <div ref={bottomRef} />
          </MessageScroller>

          <form onSubmit={sendEvent} className="mt-auto border-t bg-muted/30 p-3 sm:p-4">
            {attachment ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border bg-card p-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <AttachmentPreview key={attachment.id} attachment={attachment} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{attachment.name}</p>
                    <p className="text-xs text-muted-foreground">{attachment.mime} · {formatMediaBytes(attachment.blob.size)}</p>
                  </div>
                </div>
                <Button type="button" size="icon" variant="ghost" aria-label="Remove attachment" onClick={() => setAttachment(null)}>
                  <X aria-hidden="true" />
                </Button>
              </div>
            ) : null}
            <label htmlFor="inbox-message" className="sr-only">Message text</label>
            <textarea
              id="inbox-message"
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={MAX_MESSAGE_CHARACTERS}
              rows={3}
              placeholder="Type exactly what the customer sent…"
              className="w-full resize-none rounded-lg border bg-card px-3.5 py-3 text-sm leading-6 shadow-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp,audio/ogg,audio/webm,audio/wav,audio/mpeg,audio/mp4"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) chooseAttachment(file, file.name);
                  event.currentTarget.value = "";
                }}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={recording || encoding}>
                <Paperclip aria-hidden="true" /> Attach
              </Button>
              {recording ? (
                <Button type="button" size="sm" variant="destructive" onClick={stopRecording}>
                  <Square aria-hidden="true" /> Stop recording
                </Button>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => void startRecording()} disabled={encoding}>
                  <Mic2 aria-hidden="true" /> Record voice
                </Button>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{text.length.toLocaleString()} / {MAX_MESSAGE_CHARACTERS.toLocaleString()}</span>
              <Button type="submit" disabled={encoding || recording || (!text.trim() && !attachment)}>
                {encoding ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
                {encoding ? "Preparing…" : "Queue event"}
              </Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">One attachment, maximum 6 MB decoded. Media is sent only when you choose “Queue event.”</p>
          </form>
        </Card>

        <aside className="hidden space-y-4 xl:block">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-4 text-primary" /> What this proves</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <div><p className="font-semibold text-foreground">Immediate handoff</p><p>HTTP 202 returns an event ID before the agent runs.</p></div>
              <div><p className="font-semibold text-foreground">Durable execution</p><p>The worker writes the message and its node path once.</p></div>
              <div><p className="font-semibold text-foreground">Visible restraint</p><p>Suspension and cost are evidence, not hidden implementation detail.</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Try the counter</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="flex gap-2"><Mic2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gemini" /> “Niletee unga mbili na mafuta moja.”</p>
              <p className="flex gap-2"><ImageIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gemini" /> A synthetic handwritten ledger photo.</p>
              <p className="flex gap-2"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-attention" /> A refund request that must stop for the owner.</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      {rotationOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/45 p-4" role="presentation" onMouseDown={() => !rotating && setRotationOpen(false)}>
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="rotate-title"
            className="w-full max-w-lg shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <CardHeader>
              <span className="mb-2 grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><RotateCcw aria-hidden="true" className="size-4.5" /></span>
              <CardTitle id="rotate-title" className="text-xl">Start a fresh managed session?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                {selectedCustomer?.name} gets a clean conversational session. The audit thread stays visible, pending refund invocations remain resumable in their original session, and only allowlisted trusted usuals may return through Memory Bank—not raw chat history, prices, payment references, or authority claims.
              </p>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={rotating} onClick={() => setRotationOpen(false)}>Keep this session</Button>
                <Button type="button" disabled={rotating} onClick={() => void rotateSession()}>
                  {rotating ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <RotateCcw aria-hidden="true" />}
                  {rotating ? "Rotating…" : "Start new day"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
