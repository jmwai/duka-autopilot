"use client";

import {
  Bot,
  CheckCircle2,
  Clock3,
  CloudCog,
  Coins,
  FileCheck2,
  Gauge,
  LoaderCircle,
  Play,
  Rows3,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/control-room/page-header";
import { TrustBadge } from "@/components/control-room/trust-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { nightlyReportSchema, type NightlyReport } from "@/lib/api/contracts";
import { BrowserApiError, browserApi } from "@/lib/api/browser-client";
import type { NightShiftData } from "@/lib/api/night-shift";
import { formatCost } from "@/lib/format/money";
import {
  formatRunTime,
  LOCAL_BASELINE,
  NIGHTLY_BOUNDS,
  observedSettlePercent,
  reportReleaseState,
} from "@/lib/night-shift/night-shift";
import { cn } from "@/lib/utils";

function metric(value: number) {
  return value.toLocaleString("en-KE");
}

function duration(value: number) {
  return value < 1_000 ? `${value.toLocaleString()} ms` : `${(value / 1_000).toFixed(2)} s`;
}

function StatusCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CheckCircle2;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <span className={cn("grid size-10 place-items-center rounded-lg", tone)}><Icon aria-hidden="true" className="size-4.5" /></span>
        <p className="mt-4 text-sm font-medium text-muted-foreground">{label}</p>
        <p className="numeric mt-1 text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function RunConfirmation({ busy, onCancel, onConfirm }: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="night-run-title"
      aria-describedby="night-run-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
      className="m-auto w-[min(92vw,36rem)] rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-foreground/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-5 sm:p-6">
        <span className="grid size-11 place-items-center rounded-xl bg-exact/10 text-exact"><Rows3 aria-hidden="true" className="size-5" /></span>
        <h2 id="night-run-title" className="mt-4 text-xl font-bold tracking-tight">Run the local exact pass?</h2>
        <p id="night-run-description" className="mt-2 text-sm leading-6 text-muted-foreground">
          This invokes the deterministic indexed pass with fuzzy review disabled. It may link exact payments in the local books, persist a new report, and draft one restock proposal.
        </p>
        <div className="mt-4 rounded-lg border border-attention/40 bg-attention/10 p-3 text-xs leading-5">
          <span className="font-semibold">Evidence boundary:</span> this is not Gemini evidence, Cloud Run Job evidence, or proof that Cloud Scheduler fired. Re-running an already-settled dataset is not a comparable benchmark.
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={onConfirm} disabled={busy}>{busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Play aria-hidden="true" />}{busy ? "Running exact pass…" : "Run exact pass"}</Button>
        </div>
      </div>
    </dialog>
  );
}

function LiveReport({ report, data }: { report: NightlyReport; data: NightShiftData }) {
  const releaseState = reportReleaseState(report, data.version);
  const total = report.total_considered ?? report.statement.total;
  const reconCosts = data.costs.per_interaction.find((row) => row.interaction === "recon");
  const settleWidth = `${Math.min(100, Math.max(0, report.settle_rate * 100))}%`;
  const imageDigest = data.version.backend_image_digest;
  return (
    <>
      <section aria-label="Observed night shift outcomes" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="Settled exactly" value={metric(report.exact_matched)} detail={`${observedSettlePercent(report)} of ${metric(total)} rows considered this run`} icon={CheckCircle2} tone="bg-exact/10 text-exact" />
        <StatusCard label="Residue after run" value={metric(report.residue_end)} detail={`${metric(report.residue_start)} entered the bounded review stage`} icon={Rows3} tone="bg-attention/15 text-foreground" />
        <StatusCard label="Owner proposals" value={metric(report.fuzzy_proposals)} detail={`${metric(report.fuzzy_batches)} Gemini batch${report.fuzzy_batches === 1 ? "" : "es"} executed`} icon={ShieldCheck} tone="bg-primary/10 text-primary" />
        <StatusCard label="Measured model cost" value={formatCost(report.cost_usd)} detail={`${metric(report.model_input_tokens ?? 0)} in · ${metric(report.model_output_tokens ?? 0)} out tokens`} icon={Coins} tone="bg-gemini/10 text-gemini" />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><CardTitle>Observed settlement</CardTitle><CardDescription>Persisted run report—not an expected benchmark.</CardDescription></div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="exact">Completed</Badge>
                  <Badge variant={releaseState === "current" ? "exact" : "attention"}>{releaseState === "current" ? "Current release" : releaseState === "stale" ? "Different release" : "Unattributed report"}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-4"><div><p className="numeric text-3xl font-bold">{observedSettlePercent(report)}</p><p className="mt-1 text-xs text-muted-foreground">deterministic settlement for rows considered in this run</p></div><p className="numeric text-sm font-semibold">{metric(report.exact_matched)} / {metric(total)}</p></div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Deterministic settlement rate" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(report.settle_rate * 10000) / 100}>
                <div className="h-full rounded-full bg-exact" style={{ width: settleWidth }} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Exact pass</p><p className="numeric mt-1 font-semibold">{duration(report.exact_wall_ms)}</p></div>
                <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Whole pipeline</p><p className="numeric mt-1 font-semibold">{duration(report.wall_ms)}</p></div>
                <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Restock scan</p><p className="numeric mt-1 font-semibold">{metric(report.restock_low_count)} low · {report.restock_proposed ? "drafted" : "no new draft"}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>One workflow, three authority lanes</CardTitle><CardDescription>Autonomy where evidence is exact. Gemini where reality is messy. A human where consequences matter.</CardDescription></CardHeader>
            <CardContent>
              <ol className="space-y-0">
                {[
                  { lane: "exact" as const, title: "Indexed exact pass", detail: `${metric(report.exact_matched)} rows linked on phone, integer amount and a 48-hour window. No model saw them.`, meta: duration(report.exact_wall_ms) },
                  { lane: "gemini" as const, title: "Bounded residue review", detail: `${metric(report.residue_start)} ambiguous rows entered; ${metric(report.fuzzy_proposals)} proposals were created. Gemini cannot mark them paid.`, meta: `${report.fuzzy_batches}/${NIGHTLY_BOUNDS.batchCeiling} batches` },
                  { lane: "owner" as const, title: "Consequences wait", detail: `${metric(report.fuzzy_proposals)} fuzzy proposals remain subject to the Decisions queue’s exact-effect confirmation.`, meta: "Human gate" },
                ].map((step, index, all) => (
                  <li key={step.lane} className="grid grid-cols-[2rem_1fr] gap-3">
                    <div className="flex flex-col items-center"><span className="mt-1 grid size-7 place-items-center rounded-full border bg-card font-mono text-xs font-bold">{index + 1}</span>{index < all.length - 1 ? <span className="my-1 h-full w-px bg-border" /> : null}</div>
                    <div className="pb-6"><div className="flex flex-wrap items-center justify-between gap-2"><TrustBadge lane={step.lane} /><Badge variant="outline" className="font-mono">{step.meta}</Badge></div><p className="mt-2 font-semibold">{step.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{step.detail}</p></div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Run receipt</CardTitle><CardDescription>Attribution required before this report becomes submission evidence.</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Finished</span><span className="text-right font-semibold">{formatRunTime(report.finished_at ?? report.started_at)}</span></div>
              <Separator />
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Surface</span><span className="font-mono text-xs">{report.execution_surface ?? "legacy report"}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Run</span><span className="max-w-[13rem] truncate font-mono text-xs">{report.run_id ?? "not recorded"}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Report SHA</span><span className="max-w-[13rem] truncate font-mono text-xs">{report.release_sha ?? "not recorded"}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Current SHA</span><span className="max-w-[13rem] truncate font-mono text-xs">{data.version.release_sha}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Backend digest</span><span className="max-w-[13rem] truncate font-mono text-xs">{imageDigest ?? "pending cloud manifest"}</span></div>
              <Separator />
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Run model calls</span><span className="numeric font-semibold">{report.model_calls === undefined ? "legacy: unknown" : metric(report.model_calls)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Cumulative recon calls</span><span className="numeric font-semibold">{metric(reconCosts?.n ?? 0)}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Hard bounds</CardTitle><CardDescription>Cost control is enforced in code, not left to a prompt.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Residue batch</p><p className="numeric mt-1 text-lg font-bold">{NIGHTLY_BOUNDS.residueBatch} rows</p></div>
              <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Hard ceiling</p><p className="numeric mt-1 text-lg font-bold">{NIGHTLY_BOUNDS.batchCeiling} batches</p></div>
              <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Maximum presented</p><p className="numeric mt-1 text-lg font-bold">{metric(NIGHTLY_BOUNDS.maximumRowsPresented)} rows</p></div>
              <p className="text-xs leading-5 text-muted-foreground">{NIGHTLY_BOUNDS.stopPolicy}. Anything left waits; the loop cannot burn tokens indefinitely.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Baseline() {
  const baseline = LOCAL_BASELINE;
  return (
    <Card className="mt-5 border-attention/35">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{baseline.label}</CardTitle><CardDescription>Frozen engineering comparison—not Cloud Run, not Firestore, not this release.</CardDescription></div><Badge variant="attention">LOCAL-PROVEN · dirty worktree</Badge></div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ["Generated", baseline.rowsRequested], ["Unique inserted", baseline.rowsInserted], ["Duplicates dropped", baseline.duplicateRefsDropped], ["Total + demo", baseline.totalConsidered], ["Exact", baseline.exactMatched], ["Residue", baseline.residue],
          ].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="numeric mt-1 text-lg font-bold">{metric(Number(value))}</p></div>)}
        </div>
        <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-background p-4 text-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">97.28% exact in 812 ms locally</p><p className="mt-1 text-xs text-muted-foreground">SQLite/macOS · fuzzy disabled · model cost not measured · SHA {baseline.releaseSha.slice(0, 9)}</p></div><Badge variant="outline"><FileCheck2 aria-hidden="true" className="size-3.5" /> Raw JSON committed</Badge></div>
      </CardContent>
    </Card>
  );
}

export function NightShiftWorkspace({ data }: { data: NightShiftData }) {
  const [report, setReport] = useState(data.digest.digest.nightly);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const local = data.version.environment === "local";

  async function runExact() {
    if (!local || running) return;
    setRunning(true);
    try {
      const result = await browserApi("recon/nightly?fuzzy=false", nightlyReportSchema, { method: "POST", body: "{}" });
      setReport(result);
      setConfirming(false);
      toast.success("Local exact report persisted. This is not Scheduler proof.");
    } catch (error) {
      toast.error(error instanceof BrowserApiError ? error.message : "The local exact pass did not complete.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Autonomous work"
        title="Night shift"
        description="The routine majority settles in indexed code. Only bounded residue reaches Gemini, and every uncertain money decision stops with the owner."
        action={local
          ? <Button onClick={() => setConfirming(true)}><Play aria-hidden="true" /> Run local exact check</Button>
          : <Button variant="outline" disabled title="Trigger the real Cloud Run Job from Cloud Scheduler or the reviewed proof workflow"><CloudCog aria-hidden="true" /> Cloud Job only</Button>}
      />

      <section className="paper-noise mb-5 overflow-hidden rounded-2xl bg-sidebar p-5 text-sidebar-foreground shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><Badge className="border-white/15 bg-white/10 text-white">{report ? "Night shift complete" : "Awaiting persisted run"}</Badge><Badge className="border-white/15 bg-transparent font-mono text-sidebar-muted">{data.version.environment}</Badge></div><h2 className="mt-3 text-xl font-bold sm:text-2xl">Exact evidence settles. Ambiguity waits.</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-sidebar-muted">{report ? `${formatRunTime(report.finished_at ?? report.started_at)} · ${report.execution_surface ?? "legacy persisted report"}` : "No observed pipeline report is stored yet. Current statement totals are not presented as a completed night run."}</p></div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[25rem]"><div className="rounded-xl border border-white/10 bg-white/5 p-3"><Timer aria-hidden="true" className="size-4 text-emerald-300" /><p className="mt-2 text-[0.65rem] uppercase tracking-wider text-sidebar-muted">Status</p><p className="mt-1 text-sm font-semibold">{report ? "Completed" : "Pending"}</p></div><div className="rounded-xl border border-white/10 bg-white/5 p-3"><Bot aria-hidden="true" className="size-4 text-sky-300" /><p className="mt-2 text-[0.65rem] uppercase tracking-wider text-sidebar-muted">Model</p><p className="mt-1 break-words font-mono text-[0.68rem]">{data.version.model}</p></div><div className="rounded-xl border border-white/10 bg-white/5 p-3"><Gauge aria-hidden="true" className="size-4 text-amber-200" /><p className="mt-2 text-[0.65rem] uppercase tracking-wider text-sidebar-muted">Topology</p><p className="mt-1 text-sm font-semibold">{data.version.durable_topology.compatible ? "Compatible" : "Blocked"}</p></div></div>
        </div>
      </section>

      {report ? <LiveReport report={report} data={data} /> : (
        <Card>
          <CardContent className="grid min-h-64 place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-attention/15"><Clock3 aria-hidden="true" className="size-5" /></span><h2 className="mt-4 text-lg font-bold">No observed night run yet</h2><p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">The current statement has {metric(data.digest.digest.statement.total)} rows, but this page will not infer a run report from aggregate state. Trigger the real Job in cloud, or use the explicitly local deterministic check.</p></div></CardContent>
        </Card>
      )}
      <Baseline />
      <p className="mt-7 text-center text-xs text-muted-foreground">The Loom must show Cloud Scheduler or the reviewed proof workflow starting the real Cloud Run Job. This page alone is not scheduler evidence.</p>
      {confirming ? <RunConfirmation busy={running} onCancel={() => { if (!running) setConfirming(false); }} onConfirm={() => void runExact()} /> : null}
    </>
  );
}
