"use client";

import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CloudUpload,
  Image as ImageIcon,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DragEvent, FormEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/control-room/page-header";
import { EmptyState } from "@/components/control-room/product-states";
import { ExecutionReceipt } from "@/components/inbox/execution-receipt";
import { DocumentStage, type SelectedLedgerDocument } from "@/components/ledger/document-stage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrowserApiError, browserApi } from "@/lib/api/browser-client";
import { ledgerUploadResponseSchema, type LedgerResult, type LedgerUploadResponse } from "@/lib/api/contracts";
import { type DemoLedgerFixture } from "@/lib/fixtures/demo";
import { formatKsh } from "@/lib/format/money";
import { blobToBase64, formatMediaBytes, normalizeMime } from "@/lib/inbox/media";
import { validateLedgerImage } from "@/lib/ledger/ledger";
import { cn } from "@/lib/utils";

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
            /* The sale is already in the books; say so like it matters rather
               than hiding it in a footnote. */
            <div className="mt-3 flex flex-col gap-3 rounded-lg bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                <span className="font-semibold">Sale recorded:</span>{" "}
                {row.amount === null ? "amount recorded" : formatKsh(row.amount)} for {row.customer_name}
                {row.paid ? ", marked paid" : ", payment still owed"}.
              </p>
              {row.order_id ? (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href={`/orders?order=${encodeURIComponent(row.order_id)}`}>Open order #{row.order_id} <ArrowRight aria-hidden="true" /></Link>
                </Button>
              ) : null}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function ObservedResult({ response }: { response: LedgerUploadResponse }) {
  if (!response.ledger) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="p-6">
          <AlertTriangle aria-hidden="true" className="size-5 text-destructive" />
          <p className="mt-3 font-semibold">The deterministic receipt is missing.</p>
        </CardContent>
      </Card>
    );
  }
  const ledger = response.ledger;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/25">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Observed result</CardTitle>
              {response.idempotent ? <Badge variant="outline">Idempotent replay</Badge> : <Badge variant="gemini">Gemini vision</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border bg-card px-4 py-2"><p className="numeric text-xl font-bold text-exact">{ledger.recorded}</p><p className="text-[0.68rem] text-muted-foreground">recorded</p></div>
            <div className="rounded-lg border bg-card px-4 py-2"><p className="numeric text-xl font-bold">{ledger.gated}</p><p className="text-[0.68rem] text-muted-foreground">gated</p></div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
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
  const [selected, setSelected] = useState<SelectedLedgerDocument | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [mobileTab, setMobileTab] = useState<"source" | "result">("source");
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<LedgerUploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The preview URL is created and released here, in event handlers, rather
  // than inside the preview component: an effect cleanup there is re-run by
  // StrictMode's dev remount, which revoked the URL and broke the <img> src.
  function clearSelection() {
    setSelected((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    setResponse(null);
    setError(null);
  }

  function chooseFile(file: File, fixture: DemoLedgerFixture | null = null) {
    const validation = validateLedgerImage(file.type, file.size);
    if (validation) {
      toast.error(validation);
      return;
    }
    setSelected((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return {
        id: crypto.randomUUID(),
        eventId: `ledger-${crypto.randomUUID().replaceAll("-", "")}`,
        file,
        fixture,
        previewUrl: URL.createObjectURL(file),
      };
    });
    setResponse(null);
    setError(null);
    setMobileTab("source");
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
      setMobileTab("result");
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
        description="Gemini reads the handwriting; each row is then checked on its own, so one smudge cannot block the clear entries."
        action={<Button asChild variant="outline"><Link href="/approvals"><ShieldAlert aria-hidden="true" /> Review gated rows</Link></Button>}
      />

      <Tabs value={mobileTab} onValueChange={(value) => setMobileTab(value as "source" | "result")} className="items-start gap-5 xl:grid xl:grid-cols-[0.85fr_1.15fr]">
        <TabsList aria-label="Ledger workspace view" className="w-full xl:hidden">
          <TabsTrigger value="source"><BookOpenCheck aria-hidden="true" className="size-4" /> Source</TabsTrigger>
          <TabsTrigger value="result"><ShieldAlert aria-hidden="true" className="size-4" /> Result</TabsTrigger>
        </TabsList>

        <TabsContent value="source" forceMount className="w-full space-y-5 data-[state=inactive]:hidden xl:sticky xl:top-24 xl:data-[state=inactive]:block">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpenCheck aria-hidden="true" className="size-4.5 text-primary" /> Page input</CardTitle>
              <CardDescription>Owner-only path · JPEG, PNG or WebP · 6 MB maximum</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitLedger} className="space-y-4">
                <input ref={fileInputRef} type="file" aria-label="Choose a handwritten ledger image" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) chooseFile(file); event.currentTarget.value = ""; }} />
                {selected ? (
                  <>
                    <DocumentStage key={selected.id} selected={selected} />
                    <div className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{selected.file.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{normalizeMime(selected.file.type)} · {formatMediaBytes(selected.file.size)} · event {selected.eventId.slice(0, 16)}…</p>
                      </div>
                      <Button type="button" size="icon" variant="ghost" aria-label="Remove selected ledger" onClick={clearSelection} disabled={submitting}><X aria-hidden="true" /></Button>
                    </div>
                  </>
                ) : (
                  <div onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop} className={cn("grid min-h-72 place-items-center rounded-xl border border-dashed p-6 text-center transition-colors", dragActive ? "border-primary bg-accent" : "bg-muted/30")}>
                    <div>
                      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-card text-primary shadow-sm"><CloudUpload aria-hidden="true" className="size-5" /></span>
                      <p className="mt-4 font-semibold">Drop a ledger photograph here</p>
                    </div>
                  </div>
                )}
                {error ? <div role="alert" className="flex gap-3 rounded-lg border border-destructive/35 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p>{error}</p></div> : null}
                <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={submitting}><ImageIcon aria-hidden="true" /> Choose owner photo</Button>
                <Button type="submit" size="lg" className="w-full" disabled={!selected || submitting}>{submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}{submitting ? "Reading and gating rows…" : "Read this ledger page"}</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="result" forceMount className="w-full space-y-5 data-[state=inactive]:hidden xl:data-[state=inactive]:block">
          {submitting ? (
            <Card><CardContent className="grid min-h-64 place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-gemini/10 text-gemini"><LoaderCircle aria-hidden="true" className="size-5 animate-spin" /></span><p className="mt-4 font-semibold">Reading every handwritten row</p></div></CardContent></Card>
          ) : response ? (
            <ObservedResult response={response} />
          ) : (
            /* Nothing is carried over between visits: a reload starts on a
               clean desk rather than showing the last page's rows. */
            <EmptyState
              title="No page read yet"
              description="Choose or drop a photograph of a ledger page. The rows Duka can read become sales; anything it cannot read stops for you."
            />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
