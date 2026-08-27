"use client";

import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CloudUpload,
  FileCheck2,
  Image as ImageIcon,
  LoaderCircle,
  LockKeyhole,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/control-room/page-header";
import { TrustBadge } from "@/components/control-room/trust-badge";
import { ExecutionReceipt } from "@/components/inbox/execution-receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrowserApiError, browserApi } from "@/lib/api/browser-client";
import { ledgerUploadResponseSchema, type LedgerResult, type LedgerUploadResponse } from "@/lib/api/contracts";
import { formatKsh } from "@/lib/format/money";
import { blobToBase64, formatMediaBytes, normalizeMime } from "@/lib/inbox/media";
import { LEDGER_FIXTURE, resultMatchesFrozenTruth, validateLedgerImage } from "@/lib/ledger/ledger";
import { cn } from "@/lib/utils";

type SelectedLedger = {
  id: string;
  eventId: string;
  file: File;
  frozen: boolean;
};

function bytesToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function Preview({ selected }: { selected: SelectedLedger }) {
  const [url] = useState(() => URL.createObjectURL(selected.file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="relative overflow-hidden rounded-xl border bg-muted">
      <Image
        unoptimized
        src={url}
        width={LEDGER_FIXTURE.width}
        height={LEDGER_FIXTURE.height}
        alt="Selected handwritten ledger page"
        className="max-h-[34rem] w-full object-contain"
      />
      {selected.frozen ? (
        <Badge variant="exact" className="absolute left-3 top-3 shadow-sm">
          <FileCheck2 aria-hidden="true" className="size-3.5" /> Build-verified fixture
        </Badge>
      ) : null}
    </div>
  );
}

function ExpectedTruth() {
  const rows = [
    { description: "Unga Dola 2kg · qty 2", amount: 390, action: "Record" },
    { description: "Mafuta 1L · qty 1", amount: 320, action: "Record" },
    { description: "Sukari 1kg · qty 1", amount: null, action: "Gate" },
  ];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Frozen ground truth</CardTitle>
            <CardDescription>Expected outcome—not a model result.</CardDescription>
          </div>
          <Badge variant="outline">Synthetic</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <div key={row.description} className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 text-sm">
            <div>
              <p className="font-semibold">{row.description}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{row.action === "Record" ? "Legible, positive amount" : "Amount unreadable · no value may be guessed"}</p>
            </div>
            <div className="shrink-0 text-right">
              <Badge variant={row.action === "Record" ? "exact" : "attention"}>{row.action}</Badge>
              <p className="numeric mt-1 text-xs font-semibold">{row.amount === null ? "—" : formatKsh(row.amount)}</p>
            </div>
          </div>
        ))}
        <p className="pt-1 font-mono text-[0.66rem] leading-5 text-muted-foreground">SHA-256 {LEDGER_FIXTURE.sha256.slice(0, 16)}… · {LEDGER_FIXTURE.width}×{LEDGER_FIXTURE.height} · {formatMediaBytes(LEDGER_FIXTURE.bytes)}</p>
      </CardContent>
    </Card>
  );
}

function OutcomeRows({ ledger }: { ledger: LedgerResult }) {
  return (
    <div className="space-y-3">
      {ledger.rows.map((row) => (
        <article key={`${row.index}-${row.outcome}`} className={cn(
          "rounded-xl border p-4",
          row.outcome === "recorded" ? "border-exact/30 bg-exact/5" : "border-attention/40 bg-attention/5",
        )}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.outcome === "recorded" ? "exact" : "attention"}>
                  {row.outcome === "recorded" ? <CheckCircle2 aria-hidden="true" className="size-3.5" /> : <ShieldAlert aria-hidden="true" className="size-3.5" />}
                  Row {row.index + 1} · {row.outcome === "recorded" ? "Recorded" : "Owner review"}
                </Badge>
                <span className="text-xs text-muted-foreground">{Math.round(row.confidence * 100)}% extraction confidence</span>
              </div>
              <h3 className="mt-2 font-semibold">{row.description || "Description unavailable"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{row.customer_name} · {row.paid ? "Marked paid" : "Not marked paid"}</p>
            </div>
            <p className="numeric text-base font-bold">{row.amount === null ? "Amount unreadable" : formatKsh(row.amount)}</p>
          </div>
          {row.outcome === "gated" ? (
            <div className="mt-3 flex flex-col gap-3 rounded-lg bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm"><span className="font-semibold">Why Duka stopped:</span> {row.reason ?? "The row did not meet the confidence gate."}</p>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link href="/approvals">Open decision <ArrowRight aria-hidden="true" /></Link>
              </Button>
            </div>
          ) : (
            <p className="mt-3 font-mono text-[0.68rem] text-muted-foreground">Order {row.order_id ?? "recorded"}</p>
          )}
        </article>
      ))}
    </div>
  );
}

function ObservedResult({ response, frozen }: { response: LedgerUploadResponse; frozen: boolean }) {
  if (!response.ledger) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="p-6">
          <AlertTriangle aria-hidden="true" className="size-5 text-destructive" />
          <p className="mt-3 font-semibold">The deterministic receipt is missing.</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Duka returned prose, but this screen will not infer row outcomes from model text. The page must be reviewed before any demo claim.</p>
        </CardContent>
      </Card>
    );
  }
  const ledger = response.ledger;
  const matches = frozen ? resultMatchesFrozenTruth(ledger) : null;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/25">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Observed result</CardTitle>
              {response.idempotent ? <Badge variant="outline">Idempotent replay</Badge> : <Badge variant="gemini">Gemini vision</Badge>}
              {matches === true ? <Badge variant="exact">Matches frozen truth</Badge> : null}
              {matches === false ? <Badge variant="attention">Truth mismatch</Badge> : null}
            </div>
            <CardDescription className="mt-1">Deterministic outcomes captured from `record_ledger_rows`, not parsed from prose.</CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border bg-card px-4 py-2"><p className="numeric text-xl font-bold text-exact">{ledger.recorded}</p><p className="text-[0.68rem] text-muted-foreground">recorded</p></div>
            <div className="rounded-lg border bg-card px-4 py-2"><p className="numeric text-xl font-bold">{ledger.gated}</p><p className="text-[0.68rem] text-muted-foreground">gated</p></div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        {matches === false ? (
          <div className="flex gap-3 rounded-xl border border-attention/50 bg-attention/10 p-4 text-sm leading-6">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>The observed counts do not match the frozen two-record/one-gate truth. Do not use this run as submission evidence.</p>
          </div>
        ) : null}
        <OutcomeRows ledger={ledger} />
        <div className="rounded-xl border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Agent summary</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{response.reply}</p>
          <ExecutionReceipt meta={{ event_id: response.event_id, node_path: response.node_path, cost_usd: response.cost_usd, wall_ms: response.wall_ms, tokens: response.tokens }} />
        </div>
      </CardContent>
    </Card>
  );
}

export function LedgerDesk() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SelectedLedger | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loadingFixture, setLoadingFixture] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<LedgerUploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function chooseFile(file: File, frozen = false) {
    const validation = validateLedgerImage(file.type, file.size);
    if (validation) {
      toast.error(validation);
      return;
    }
    setSelected({ id: crypto.randomUUID(), eventId: `ledger-${crypto.randomUUID().replaceAll("-", "")}`, file, frozen });
    setResponse(null);
    setError(null);
  }

  async function loadFrozenFixture() {
    if (loadingFixture) return;
    setLoadingFixture(true);
    try {
      const fixtureResponse = await fetch(LEDGER_FIXTURE.url, { cache: "force-cache" });
      if (!fixtureResponse.ok) throw new Error("The frozen fixture is unavailable in this release.");
      const payload = await fixtureResponse.arrayBuffer();
      const digest = bytesToHex(await crypto.subtle.digest("SHA-256", payload));
      if (digest !== LEDGER_FIXTURE.sha256 || payload.byteLength !== LEDGER_FIXTURE.bytes) {
        throw new Error("The frozen fixture failed its release integrity check.");
      }
      chooseFile(new File([payload], LEDGER_FIXTURE.filename, { type: LEDGER_FIXTURE.mime }), true);
      toast.success("Frozen synthetic ledger verified and loaded.");
    } catch (fixtureError) {
      toast.error(fixtureError instanceof Error ? fixtureError.message : "The fixture could not be loaded.");
    } finally {
      setLoadingFixture(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) chooseFile(file);
  }

  async function submitLedger(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || submitting) return;
    const validation = validateLedgerImage(selected.file.type, selected.file.size);
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const imageB64 = await blobToBase64(selected.file);
      const result = await browserApi("ledger", ledgerUploadResponseSchema, {
        method: "POST",
        body: JSON.stringify({ event_id: selected.eventId, image_b64: imageB64, image_mime: normalizeMime(selected.file.type) }),
      });
      setResponse(result);
    } catch (uploadError) {
      if (uploadError instanceof BrowserApiError && uploadError.status === 401) {
        router.replace("/login?next=/ledger");
        router.refresh();
      } else {
        setError(uploadError instanceof Error ? uploadError.message : "The ledger page could not be processed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Paper to books"
        title="Ledger desk"
        description="Gemini reads the handwriting. Deterministic code decides each row separately, so one smudge cannot block the clear entries—or sneak into the books."
        action={<Button asChild variant="outline"><Link href="/approvals"><ShieldAlert aria-hidden="true" /> Review gated rows</Link></Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-3.5"><TrustBadge lane="gemini" /><p className="mt-2 text-xs leading-5 text-muted-foreground">Reads handwriting and proposes structured rows.</p></div>
        <div className="rounded-xl border bg-card p-3.5"><TrustBadge lane="exact" /><p className="mt-2 text-xs leading-5 text-muted-foreground">Validates amount, confidence, identity and row effect.</p></div>
        <div className="rounded-xl border bg-card p-3.5"><TrustBadge lane="owner" /><p className="mt-2 text-xs leading-5 text-muted-foreground">Receives only doubtful rows, never the whole page.</p></div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-5 xl:sticky xl:top-24">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpenCheck aria-hidden="true" className="size-4.5 text-primary" /> Page input</CardTitle>
              <CardDescription>Owner-only path · JPEG, PNG or WebP · 6 MB maximum</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitLedger} className="space-y-4">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) chooseFile(file); event.currentTarget.value = ""; }} />
                {selected ? (
                  <>
                    <Preview key={selected.id} selected={selected} />
                    <div className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{selected.file.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{normalizeMime(selected.file.type)} · {formatMediaBytes(selected.file.size)} · event {selected.eventId.slice(0, 16)}…</p>
                      </div>
                      <Button type="button" size="icon" variant="ghost" aria-label="Remove selected ledger" onClick={() => { setSelected(null); setResponse(null); setError(null); }} disabled={submitting}><X aria-hidden="true" /></Button>
                    </div>
                  </>
                ) : (
                  <div onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop} className={cn("grid min-h-72 place-items-center rounded-xl border border-dashed p-6 text-center transition-colors", dragActive ? "border-primary bg-accent" : "bg-muted/30")}>
                    <div>
                      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-card text-primary shadow-sm"><CloudUpload aria-hidden="true" className="size-5" /></span>
                      <p className="mt-4 font-semibold">Drop a ledger photograph here</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Nothing is uploaded until you explicitly run the reader.</p>
                    </div>
                  </div>
                )}
                {error ? <div role="alert" className="flex gap-3 rounded-lg border border-destructive/35 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p>{error}</p></div> : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={() => void loadFrozenFixture()} disabled={loadingFixture || submitting}>{loadingFixture ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileCheck2 aria-hidden="true" />}{loadingFixture ? "Verifying…" : "Use frozen demo page"}</Button>
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={submitting}><ImageIcon aria-hidden="true" /> Choose another photo</Button>
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={!selected || submitting}>{submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}{submitting ? "Reading and gating rows…" : "Read this ledger page"}</Button>
                <p className="flex gap-2 text-xs leading-5 text-muted-foreground"><LockKeyhole aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />This synchronous owner action is idempotent by event ID. A replay cannot record the page twice.</p>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {submitting ? (
            <Card><CardContent className="grid min-h-64 place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-gemini/10 text-gemini"><LoaderCircle aria-hidden="true" className="size-5 animate-spin" /></span><p className="mt-4 font-semibold">Reading every handwritten row</p><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Gemini extracts proposals first. The deterministic tool then commits clear positive amounts and gates each doubtful row independently.</p></div></CardContent></Card>
          ) : response ? <ObservedResult response={response} frozen={selected?.frozen === true} /> : <ExpectedTruth />}
          <Card>
            <CardHeader><CardTitle>Release integrity</CardTitle><CardDescription>The demo image is copied into the standalone image only after its source hash and byte count match the frozen manifest.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Fixture creator</p><p className="mt-1 text-sm font-semibold">OpenAI image generation · synthetic</p></div>
              <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">External financial effect</p><p className="mt-1 text-sm font-semibold">None · internal books and proposals only</p></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
