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
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { AuthorityRail } from "@/components/control-room/authority-rail";
import { OperationRecovery } from "@/components/control-room/operation-recovery";
import { PageHeader } from "@/components/control-room/page-header";
import { EvidenceSource, ProofSheet } from "@/components/control-room/proof-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  fixturePublicUrl,
  loadDemoFixtureManifest,
  verifyFixturePayload,
  type DemoVoiceFixture,
} from "@/lib/fixtures/demo";
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
  fixture: DemoVoiceFixture | null;
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

function voiceFilename(fixture: DemoVoiceFixture) {
  return fixture.path.split("/").at(-1) ?? `${fixture.id}.wav`;
}

function voiceProvider(fixture: DemoVoiceFixture) {
  return `Google Cloud TTS · ${fixture.source.model}`;
}

export function InboxWorkspace({ initialCustomers, initialCustomerId, initialEventId }: { initialCustomers: Customer[]; initialCustomerId?: string; initialEventId?: string }) {
  const router = useRouter();
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId ?? initialCustomers[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<MediaAttachment | null>(null);
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [encoding, setEncoding] = useState(false);
  const [recording, setRecording] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotationEventId, setRotationEventId] = useState(() => `session-${crypto.randomUUID().replaceAll("-", "")}`);
  const [rotationFailure, setRotationFailure] = useState<{ message: string; requestId?: string } | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fixtureManifestQuery = useQuery({
    queryKey: ["demo-fixture-manifest"],
    queryFn: loadDemoFixtureManifest,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const fixtureManifest = fixtureManifestQuery.data;
  const releaseVoices = fixtureManifest?.release_ready ? fixtureManifest.voices : [];
  const englishVoice = releaseVoices.find((fixture) => fixture.language === "en-KE") ?? null;
  const swahiliVoice = releaseVoices.find((fixture) => fixture.language === "sw-KE") ?? null;

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
  const latestExecutionMeta = useMemo(() => {
    const message = [...messages].reverse().find((candidate) => (
      candidate.direction === "out"
      && candidate.meta
      && typeof candidate.meta === "object"
      && (
        typeof candidate.meta.event_id === "string"
        || Array.isArray(candidate.meta.node_path)
      )
    ));
    return message?.meta ?? null;
  }, [messages]);
  const latestEventId = latestExecutionMeta && typeof latestExecutionMeta.event_id === "string"
    ? latestExecutionMeta.event_id
    : null;
  const latestNodePath = latestExecutionMeta && Array.isArray(latestExecutionMeta.node_path)
    ? latestExecutionMeta.node_path.filter((node): node is string => typeof node === "string")
    : [];
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

  function chooseAttachment(blob: Blob, name: string, fixture: DemoVoiceFixture | null = null) {
    const media = acceptedMedia(blob.type);
    const error = validateMedia(blob.type, blob.size);
    if (!media || error) {
      toast.error(error ?? "That media type is not supported.");
      return;
    }
    setAttachment({ ...media, id: crypto.randomUUID(), blob, name, fixture });
  }

  async function loadFrozenVoice(fixture: DemoVoiceFixture) {
    if (loadingVoiceId || encoding || recording) return;
    setLoadingVoiceId(fixture.id);
    try {
      const fixtureResponse = await fetch(fixturePublicUrl(fixture.path), { cache: "force-cache" });
      const payload = await verifyFixturePayload(fixtureResponse, fixture);
      chooseAttachment(
        new File([payload], voiceFilename(fixture), { type: fixture.mime_type }),
        voiceFilename(fixture),
        fixture,
      );
      toast.success(`${fixture.label} verified and attached.`);
    } catch (fixtureError) {
      toast.error(fixtureError instanceof Error ? fixtureError.message : "The voice fixture could not be loaded.");
    } finally {
      setLoadingVoiceId(null);
    }
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
    setRotationFailure(null);
    try {
      const result = await browserApi("sessions/new", newSessionSchema, {
        method: "POST",
        body: JSON.stringify({ event_id: rotationEventId, customer_id: selectedCustomer.id }),
      });
      setRotationOpen(false);
      toast.success(`A fresh managed session is active for ${selectedCustomer.name}${result.idempotent ? " (safe replay)" : ""}.`);
    } catch (error) {
      if (!handleAuthError(error)) {
        setRotationFailure({
          message: explainError(error),
          requestId: error instanceof BrowserApiError ? error.requestId : undefined,
        });
      }
    } finally {
      setRotating(false);
    }
  }

  function openRotation() {
    setRotationEventId(`session-${crypto.randomUUID().replaceAll("-", "")}`);
    setRotationFailure(null);
    setRotationOpen(true);
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
            onClick={openRotation}
          >
            <RotateCcw aria-hidden="true" />
            Start a new day
          </Button>
        }
      />

      <AuthorityRail
        className="mb-4"
        steps={[
          { lane: "exact", title: "Event accepted once", detail: "The event ID and asynchronous queue handoff are deterministic." },
          { lane: "gemini", title: "Messy meaning interpreted", detail: "Voice and photo understanding stays bounded by validated tools." },
          { lane: "owner", title: "Consequence stops", detail: "Ambiguous or consequential work enters the owner queue." },
        ]}
      />

      {initialEventId ? <div role="status" className="mb-4 flex flex-col gap-2 rounded-xl border border-exact/30 bg-exact/5 p-3 text-xs leading-5 sm:flex-row sm:items-center sm:justify-between"><span>Following source event <span className="break-all font-mono font-semibold">{initialEventId}</span> into this customer thread.</span><Button asChild variant="ghost" size="sm"><Link href="/evidence#trace">Continue to causal evidence</Link></Button></div> : null}

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
              <ProofSheet
                title="Selected thread proof"
                description="Validated outcome, execution receipt, and release evidence for this customer thread."
                outcome={latestEventId ? `The latest completed worker reply carries event ${latestEventId.slice(0, 12)}….` : "No completed execution receipt is visible in this thread yet."}
                reason="The browser records queue acceptance separately from worker completion. A node path appears only when the persisted outbound reply returns validated execution metadata."
                facts={[
                  ...(latestEventId ? [{ label: "Event ID", value: latestEventId }] : []),
                  ...(latestNodePath.length ? [{ label: "Node path", value: latestNodePath.join(" → ") }] : []),
                ]}
                sources={[
                  { label: "Validated thread read", detail: messagesQuery.isError ? "The API read failed" : `${messages.length} persisted message${messages.length === 1 ? "" : "s"}`, state: messagesQuery.isError ? "not-proven" : messagesQuery.isPending ? "pending" : "proven" },
                  { label: "Worker execution receipt", detail: latestEventId ? `Event ${latestEventId}` : "No completed receipt selected", state: latestEventId ? "proven" : "pending" },
                  { label: "Google bilingual fixture set", detail: fixtureManifest?.release_ready ? "English and Kiswahili release voices verified" : fixtureManifest?.blocked_reason ?? "Release fixtures pending", state: fixtureManifest?.release_ready ? "proven" : "pending" },
                ]}
                limitations={["A queue acceptance is not presented as a completed agent action.", "Fixture provenance proves the media source, not the business outcome."]}
                trigger={<Button type="button" size="sm" variant="ghost">Proof</Button>}
              />
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
                  <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Send English or Kiswahili text, a voice note, or a ledger photograph.</p>
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
                      <OperationRecovery
                        compact
                        className="mt-2 bg-card/65"
                        title="Queue handoff is uncertain"
                        description="The worker may still have received this event. Retrying preserves the same business ID so no second effect can be created."
                        operationId={event.eventId}
                        retryLabel="Retry same event ID"
                        onRetry={() => void dispatchEvent(event)}
                      />
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
                    {attachment.fixture ? (
                      <div className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                        <p><span className="font-semibold text-foreground">Transcript:</span> {attachment.fixture.transcript}</p>
                        {attachment.fixture.language === "sw-KE" ? <p><span className="font-semibold text-foreground">English:</span> {attachment.fixture.english_translation}</p> : null}
                        <p className="font-mono text-[0.65rem]">{voiceProvider(attachment.fixture)} · {attachment.fixture.duration_seconds.toFixed(1)}s · {attachment.fixture.sha256.slice(0, 16)}…</p>
                      </div>
                    ) : null}
                  </div>
                </div>
                <Button type="button" size="icon" variant="ghost" aria-label="Remove attachment" onClick={() => setAttachment(null)}>
                  <X aria-hidden="true" />
                </Button>
              </div>
            ) : null}
            {!attachment ? (
              <div className="mb-3 rounded-lg border bg-card p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold">Try a verified voice example</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Release audio · provider and integrity checked before attachment</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ["English", englishVoice],
                      ["Kiswahili", swahiliVoice],
                    ] as const).map(([language, fixture]) => (
                      <Button
                        key={language}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fixture && void loadFrozenVoice(fixture)}
                        disabled={!fixture || Boolean(loadingVoiceId) || encoding || recording}
                      >
                        {loadingVoiceId === fixture?.id ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Mic2 aria-hidden="true" />}
                        {loadingVoiceId === fixture?.id ? "Verifying…" : `${language}${fixture ? "" : " pending"}`}
                      </Button>
                    ))}
                  </div>
                </div>
                {fixtureManifestQuery.isError ? (
                  <p role="alert" className="mt-2 text-xs leading-5 text-foreground">The release fixture manifest could not be verified. No voice file may be presented as release evidence until the approved Google fixtures pass integrity checks.</p>
                ) : !fixtureManifest?.release_ready && fixtureManifest?.blocked_reason ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{fixtureManifest.blocked_reason}</p>
                ) : null}
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
                aria-label="Attach a voice or photo file"
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
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-4 text-primary" /> Selected evidence</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <EvidenceSource label="Thread read" detail={messagesQuery.isError ? "Validated read failed" : `${messages.length} persisted messages`} state={messagesQuery.isError ? "not-proven" : messagesQuery.isPending ? "pending" : "proven"} />
              <EvidenceSource label="Worker receipt" detail={latestEventId ? `Event ${latestEventId.slice(0, 12)}…` : "Waiting for a completed reply"} state={latestEventId ? "proven" : "pending"} />
              <EvidenceSource label="Bilingual voices" detail={fixtureManifest?.release_ready ? "English and Kiswahili Google fixtures" : "Google release fixtures pending"} state={fixtureManifest?.release_ready ? "proven" : "pending"} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Try the counter</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {fixtureManifest?.release_ready ? (
                releaseVoices.map((fixture) => (
                  <button
                    key={fixture.id}
                    type="button"
                    className="flex w-full gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                    disabled={Boolean(loadingVoiceId) || encoding || recording}
                    onClick={() => void loadFrozenVoice(fixture)}
                  >
                    <Mic2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gemini" />
                    <span><span className="font-semibold text-foreground">{fixture.language === "en-KE" ? "English" : "Kiswahili"}</span><span className="block">“{fixture.transcript}”</span></span>
                  </button>
                ))
              ) : (
                <p className="flex gap-2"><Mic2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> Verified English and Kiswahili Google voice fixtures are pending.</p>
              )}
              <p className="flex gap-2"><ImageIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gemini" /> English and Kiswahili ledger fixtures live in Ledger Desk.</p>
              <p className="flex gap-2"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-attention" /> A refund request that must stop for the owner.</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={rotationOpen} onOpenChange={(open) => { if (!rotating) setRotationOpen(open); }}>
        <DialogContent>
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><RotateCcw aria-hidden="true" className="size-4.5" /></span>
          <DialogHeader>
            <DialogTitle>Start a fresh managed session?</DialogTitle>
            <DialogDescription>
              {selectedCustomer?.name} gets a clean conversational session. The audit thread stays visible, pending refund invocations remain resumable in their original session, and only allowlisted trusted usuals may return through Memory Bank—not raw chat history, prices, payment references, or authority claims.
            </DialogDescription>
          </DialogHeader>
          {rotationFailure ? (
            <OperationRecovery
              title="The new session could not be confirmed."
              description={`${rotationFailure.message} Retrying cannot advance the active pointer twice.`}
              operationId={rotationEventId}
              requestId={rotationFailure.requestId}
              retryLabel="Retry same session operation"
              onRetry={() => void rotateSession()}
              busy={rotating}
            />
          ) : null}
          <p className="font-mono text-[0.68rem] text-muted-foreground">Session operation {rotationEventId.slice(0, 20)}…</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={rotating} onClick={() => setRotationOpen(false)}>Keep this session</Button>
            {!rotationFailure ? (
              <Button type="button" disabled={rotating} onClick={() => void rotateSession()}>
                {rotating ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <RotateCcw aria-hidden="true" />}
                {rotating ? "Rotating…" : "Start new day"}
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
