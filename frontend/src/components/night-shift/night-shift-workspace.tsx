"use client";

import {
  ArrowRight,
  CheckCircle2,
  CloudCog,
  Coins,
  FileCheck2,
  Hand,
  LoaderCircle,
  PackageSearch,
  Play,
  Rows3,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Metric } from "@/components/control-room/metric";
import { TrustBadge } from "@/components/control-room/trust-badge";
import { OperationRecovery } from "@/components/control-room/operation-recovery";
import { PageHeader } from "@/components/control-room/page-header";
import { PendingState } from "@/components/control-room/product-states";
import { ProofSheet } from "@/components/control-room/proof-sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { nightlyReportSchema, nightlyStartSchema, type FuzzyProposal, type NightlyReport } from "@/lib/api/contracts";
import { BrowserApiError, browserApi } from "@/lib/api/browser-client";
import type { NightShiftData } from "@/lib/api/night-shift";
import { formatCost, formatKsh } from "@/lib/format/money";
import {
  PENDING_RUN_EVENT,
  readPendingRun,
  writePendingRun,
} from "@/lib/night-shift/pending-run";
import {
  formatRunTime,
  LOCAL_BASELINE,
  NIGHTLY_BOUNDS,
  observedSettlePercent,
  reportReleaseState,
  stopReasonLabel,
} from "@/lib/night-shift/night-shift";

function metric(value: number) {
  return value.toLocaleString("en-KE");
}

function duration(value: number) {
  return value < 1_000 ? `${value.toLocaleString()} ms` : `${(value / 1_000).toFixed(2)} s`;
}

type RunMode = "full" | "exact";

function RunConfirmation({ mode, busy, failure, onCancel, onConfirm }: {
  mode: RunMode;
  busy: boolean;
  failure: { message: string; requestId?: string } | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const full = mode === "full";
  return (
    <AlertDialogContent>
      <span className={`grid size-11 place-items-center rounded-xl ${full ? "bg-gemini/10 text-gemini" : "bg-exact/10 text-exact"}`}>
        {full ? <Sparkles aria-hidden="true" className="size-5" /> : <Rows3 aria-hidden="true" className="size-5" />}
      </span>
      <AlertDialogHeader>
        <AlertDialogTitle>{full ? "Run the night shift now?" : "Run the exact pass only?"}</AlertDialogTitle>
        <AlertDialogDescription>
          {full
            ? `The deterministic pass settles what it can, then hands the residue to Gemini in batches of ${NIGHTLY_BOUNDS.residueBatch}. Every match Gemini finds becomes a proposal in your approval queue. Nothing is marked paid and no money moves. This runs in the background, so you can close this and carry on.`
            : "This invokes the deterministic indexed pass with fuzzy review disabled. It may link exact payments in the local books, persist a new report, and draft one restock proposal."}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="rounded-lg border border-owner/40 bg-owner/10 p-3 text-xs leading-5">
        <span className="font-semibold">Evidence boundary:</span>{" "}
        {full
          ? "a run you start here is queued from this console and executed by the worker. It produces real Gemini evidence, but it is not Cloud Run Job evidence and not proof that Cloud Scheduler fired."
          : "this is not Gemini evidence, Cloud Run Job evidence, or proof that Cloud Scheduler fired. Re-running an already-settled dataset is not a comparable benchmark."}
      </div>
      {failure ? (
        <OperationRecovery
          compact
          title={full ? "The night shift result could not be confirmed." : "The exact pass result could not be confirmed."}
          description={`${failure.message} Review the persisted report after retry; no Scheduler or Gemini success is inferred from this error.`}
          requestId={failure.requestId}
        />
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel} disabled={busy}>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={(event) => { event.preventDefault(); onConfirm(); }} disabled={busy}>
          {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Play aria-hidden="true" />}
          {busy ? (full ? "Starting…" : "Running exact pass…") : (full ? "Run night shift" : "Run exact pass")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function Stage({ lane, icon: Icon, title, facts, boundary, children }: {
  lane: "exact" | "gemini" | "owner";
  icon: typeof CheckCircle2;
  title: string;
  facts: React.ReactNode;
  boundary: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="relative">
      <span className="absolute -left-[2.19rem] top-0 grid size-6 place-items-center rounded-full border bg-card text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5" />
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{title}</p>
        <TrustBadge lane={lane} />
      </div>
      <p className="mt-1 text-sm">{facts}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{boundary}</p>
      {children}
    </li>
  );
}

/** Every batch is one re-entry of the same graph the owner triggers by chat. */
function BatchTrace({ report }: { report: NightlyReport }) {
  if (!report.fuzzy_batch_trace.length) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-lg border">
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              <th className="p-2 text-left font-medium">Batch</th>
              <th className="p-2 text-left font-medium">Residue</th>
              <th className="p-2 text-left font-medium">Proposed</th>
              <th className="p-2 text-left font-medium">Graph path</th>
              <th className="p-2 text-right font-medium">Tokens in/out</th>
              <th className="p-2 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {report.fuzzy_batch_trace.map((batch) => (
              <tr key={batch.batch} className="border-t">
                <td className="numeric p-2">{batch.batch}</td>
                <td className="numeric whitespace-nowrap p-2">{metric(batch.residue_before)} → {metric(batch.residue_after)}</td>
                <td className="numeric p-2">{metric(batch.proposed)}</td>
                <td className="whitespace-nowrap p-2 font-mono text-[0.68rem]">{batch.node_path.join(" → ") || "not recorded"}</td>
                <td className="numeric whitespace-nowrap p-2 text-right">{metric(batch.input_tokens)} / {metric(batch.output_tokens)}</td>
                <td className="numeric p-2 text-right">{formatCost(batch.cost_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StageLadder({ report }: { report: NightlyReport }) {
  const total = report.total_considered ?? report.statement.total;
  const reviewed = report.fuzzy_batches > 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>One run, four inspectable stages</CardTitle>
        <CardDescription>Autonomy where evidence is exact. Gemini where reality is messy. A human where consequences matter.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative ml-3 space-y-6 border-l pl-6">
          <Stage
            lane="exact"
            icon={CheckCircle2}
            title="Exact pass"
            facts={<><span className="numeric font-semibold">{metric(report.exact_matched)}</span> of <span className="numeric">{metric(total)}</span> rows settled in <span className="numeric">{duration(report.exact_wall_ms)}</span></>}
            boundary="Indexed code, no model call. Amount, customer and time window must all agree, so this pass costs nothing and cannot be wrong about a match."
          />
          <Stage
            lane="gemini"
            icon={Sparkles}
            title="Bounded review"
            facts={reviewed
              ? <>
                  <span className="numeric font-semibold">{metric(report.residue_start)}</span> rows handed over · <span className="numeric">{metric(report.fuzzy_batches)}</span> graph re-entr{report.fuzzy_batches === 1 ? "y" : "ies"} · <span className="numeric">{formatCost(report.cost_usd)}</span>
                  {report.fuzzy_stop_reason === "batch_limit" && report.residue_end > 0
                    ? <span className="text-muted-foreground"> · <span className="numeric">{metric(report.residue_end)}</span> still waiting for the next run</span>
                    : null}
                </>
              : <>Not run — <span className="numeric">{metric(report.residue_start)}</span> row{report.residue_start === 1 ? "" : "s"} of residue went straight to the owner</>}
            boundary={reviewed
              ? `Stopped: ${stopReasonLabel(report.fuzzy_stop_reason).toLowerCase()}. Each batch is capped at ${NIGHTLY_BOUNDS.residueBatch} rows${report.fuzzy_batch_limit && report.fuzzy_batch_limit < NIGHTLY_BOUNDS.batchCeiling ? `, this run was allowed ${report.fuzzy_batch_limit}` : ""} and the loop can never exceed ${NIGHTLY_BOUNDS.batchCeiling}.`
              : `${stopReasonLabel(report.fuzzy_stop_reason)}, so no model saw any row and this run spent nothing on tokens.`}
          >
            <BatchTrace report={report} />
          </Stage>
          <Stage
            lane="owner"
            icon={Hand}
            title="Owner queue"
            facts={<><span className="numeric font-semibold">{metric(report.fuzzy_proposals)}</span> proposal{report.fuzzy_proposals === 1 ? "" : "s"} filed · <span className="numeric">{formatKsh(0)}</span> moved</>}
            boundary="Gemini's only write is a proposal. Marking an order paid stays an owner action, so an uncertain match cannot become money."
          />
          <Stage
            lane="exact"
            icon={PackageSearch}
            title="Restock scan"
            facts={<><span className="numeric font-semibold">{metric(report.restock_low_count)}</span> product{report.restock_low_count === 1 ? "" : "s"} below reorder point · {report.restock_proposed ? "one draft filed" : "no new draft"}</>}
            boundary="The same run checks the shelves in plain code. A restock draft is a proposal too — it waits with everything else."
          />
        </ol>
        <div className="mt-5 flex justify-end">
          <Button asChild variant="outline" size="sm"><Link href="/evidence#trace">Follow this run to Evidence <FileCheck2 aria-hidden="true" /></Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProposalList({ proposals, filed }: { proposals: FuzzyProposal[]; filed: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle>What Gemini proposed</CardTitle><CardDescription>Each row is a link waiting for you, with the reason the model gave for suggesting it.</CardDescription></div>
          <TrustBadge lane="gemini" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {proposals.map((proposal) => (
          <div key={proposal.approval_id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold">
                <span className="numeric">{formatKsh(proposal.payment_amount)}</span> from {proposal.payer_name || "an unnamed payer"}
                <ArrowRight aria-hidden="true" className="mx-2 inline size-3.5 align-[-0.1em] text-muted-foreground" />
                Order #{proposal.order_id}{proposal.customer_name ? ` · ${proposal.customer_name}` : ""}
              </p>
              <Badge variant="gemini">{percent(proposal.confidence)} confident</Badge>
            </div>
            <p className="mt-2 text-sm leading-6">“{proposal.rationale || "No rationale was recorded."}”</p>
            <p className="mt-2 font-mono text-[0.68rem] text-muted-foreground">
              {proposal.payment_ref || "no reference"} · order total {formatKsh(proposal.order_total)}
            </p>
          </div>
        ))}
        {filed > proposals.length ? (
          <p className="text-xs text-muted-foreground">{metric(filed - proposals.length)} further proposal{filed - proposals.length === 1 ? "" : "s"} from this run are in the queue but not listed here.</p>
        ) : null}
        <Button asChild variant="outline" size="sm"><Link href="/approvals">Decide in the approval queue <ArrowRight aria-hidden="true" /></Link></Button>
      </CardContent>
    </Card>
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
        <Metric label="Settled exactly" value={metric(report.exact_matched)} detail={`${observedSettlePercent(report)} of ${metric(total)} rows considered this run`} icon={CheckCircle2} tone="exact" />
        <Metric label="Residue after run" value={metric(report.residue_end)} detail={`${metric(report.residue_start)} entered bounded review`} icon={Rows3} tone="owner" />
        <Metric label="Owner proposals" value={metric(report.fuzzy_proposals)} detail={`${metric(report.fuzzy_batches)} Gemini batch${report.fuzzy_batches === 1 ? "" : "es"} executed`} icon={ShieldCheck} />
        <Metric label="Measured model cost" value={formatCost(report.cost_usd)} detail={`${metric(report.model_input_tokens ?? 0)} in · ${metric(report.model_output_tokens ?? 0)} out tokens`} icon={Coins} tone="gemini" />
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
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Across the whole statement: <span className="numeric font-semibold text-foreground">{metric(report.statement.matched_exact)}</span> of <span className="numeric">{metric(report.statement.total)}</span> settled exactly, <span className="numeric">{metric(report.statement.fuzzy_proposed)}</span> proposed for approval, <span className="numeric">{metric(report.statement.unmatched)}</span> still unmatched. A run that settles nothing new has found nothing left to settle.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Exact pass</p><p className="numeric mt-1 font-semibold">{duration(report.exact_wall_ms)}</p></div>
                <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Whole pipeline</p><p className="numeric mt-1 font-semibold">{duration(report.wall_ms)}</p></div>
                <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Restock scan</p><p className="numeric mt-1 font-semibold">{metric(report.restock_low_count)} low · {report.restock_proposed ? "drafted" : "no new draft"}</p></div>
              </div>
            </CardContent>
          </Card>

          <StageLadder report={report} />

          {report.fuzzy_proposal_sample.length ? (
            <ProposalList proposals={report.fuzzy_proposal_sample} filed={report.fuzzy_proposals} />
          ) : null}
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
  const [confirming, setConfirming] = useState<RunMode | null>(null);
  const [running, setRunning] = useState(false);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ message: string; requestId?: string } | null>(null);
  const local = data.version.environment === "local";
  const releaseState = report ? reportReleaseState(report, data.version) : "unattributed";

  // The watcher in the shell owns the run; this only mirrors it, so arriving
  // on the page mid-run — or reloading it — still shows what is happening.
  useEffect(() => {
    function sync() {
      setPendingRunId(readPendingRun()?.runId ?? null);
    }
    sync();
    window.addEventListener(PENDING_RUN_EVENT, sync);
    return () => window.removeEventListener(PENDING_RUN_EVENT, sync);
  }, []);

  async function run(mode: RunMode) {
    if (running) return;
    setRunning(true);
    setFailure(null);
    const full = mode === "full";
    try {
      if (full) {
        // The pipeline goes to the worker, so this request only hands it over.
        // The watcher in the shell reports the outcome wherever the owner is.
        const queued = await browserApi("recon/nightly/start", nightlyStartSchema, {
          method: "POST",
          body: JSON.stringify({ fuzzy: true }),
        });
        writePendingRun({ runId: queued.run_id, startedAt: Date.now() });
        setPendingRunId(queued.run_id);
        setConfirming(null);
        toast.success("Night shift started", {
          description: "Carry on with your work — you will be told here when it finishes.",
        });
        return;
      }
      const result = await browserApi("recon/nightly?fuzzy=false", nightlyReportSchema, {
        method: "POST",
        body: "{}",
      });
      setReport(result);
      setConfirming(null);
      toast.success(local
        ? "Local exact report persisted. This is not Scheduler proof."
        : "Exact report persisted. This is not Scheduler proof.");
    } catch (error) {
      setFailure({
        message: error instanceof BrowserApiError
          ? error.message
          : full ? "The night shift could not be started." : "The exact pass did not complete.",
        requestId: error instanceof BrowserApiError ? error.requestId : undefined,
      });
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
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setConfirming("full")} disabled={pendingRunId !== null}>
              {pendingRunId ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Play aria-hidden="true" />}
              {pendingRunId ? "Running…" : "Run night shift"}
            </Button>
            <Button variant="outline" onClick={() => setConfirming("exact")} disabled={pendingRunId !== null}><Rows3 aria-hidden="true" /> Exact pass only</Button>
          </div>
        }
      />

      {pendingRunId ? (
        <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-gemini/40 bg-gemini/5 p-4 text-sm">
          <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-gemini" />
          <div>
            <p className="font-semibold">The night shift is running in the background.</p>
            <p className="mt-0.5 text-muted-foreground">Go and do something else — you will be told as soon as it finishes, wherever you are in Duka. Nothing is marked paid while it runs.</p>
          </div>
          <span className="ml-auto font-mono text-[0.68rem] text-muted-foreground">run {pendingRunId.slice(0, 10)}</span>
        </div>
      ) : null}

      <section className="paper-noise mb-5 overflow-hidden rounded-2xl bg-sidebar p-5 text-sidebar-foreground shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><Badge className="border-white/15 bg-white/10 text-white">{report ? "Night shift complete" : "Awaiting persisted run"}</Badge><Badge className="border-white/15 bg-transparent font-mono text-sidebar-muted">{data.version.environment}</Badge></div><h2 className="mt-3 text-xl font-bold sm:text-2xl">Exact evidence settles. Ambiguity waits.</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-sidebar-muted">{report ? `${formatRunTime(report.finished_at ?? report.started_at)} · ${report.execution_surface ?? "legacy persisted report"}` : "No observed pipeline report is stored yet. Current statement totals are not presented as a completed night run."}</p></div>
          <div className="grid gap-2 sm:min-w-[25rem] sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3"><Timer aria-hidden="true" className="size-4 text-emerald-300" /><p className="mt-2 text-[0.65rem] uppercase tracking-wider text-sidebar-muted">Status</p><p className="mt-1 text-sm font-semibold">{report ? "Completed" : "Pending"}</p></div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3"><CloudCog aria-hidden="true" className="size-4 text-sky-300" /><p className="mt-2 text-[0.65rem] uppercase tracking-wider text-sidebar-muted">Surface</p><p className="mt-1 break-words font-mono text-[0.68rem]">{report?.execution_surface ?? "not observed"}</p></div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3"><FileCheck2 aria-hidden="true" className="size-4 text-amber-200" /><p className="mt-2 text-[0.65rem] uppercase tracking-wider text-sidebar-muted">Attribution</p><p className="mt-1 text-sm font-semibold">{releaseState === "current" ? "Current release" : releaseState === "stale" ? "Different release" : "Not proven"}</p></div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <ProofSheet
            title="Night shift execution proof"
            description="Release attribution and execution metadata behind the observed report."
            outcome={report ? `${metric(report.exact_matched)} rows settled exactly in this persisted run.` : "No persisted run report is available."}
            reason="The observed report is kept separate from the historical local benchmark. Scheduler and Cloud Run evidence are proven only by attributed cloud artifacts."
            facts={[
              { label: "Environment", value: data.version.environment },
              { label: "Current SHA", value: data.version.release_sha },
              { label: "Model", value: data.version.model },
              { label: "Model location", value: data.version.model_location },
              ...(report?.run_id ? [{ label: "Run ID", value: report.run_id }] : []),
              ...(report?.execution_surface ? [{ label: "Surface", value: report.execution_surface }] : []),
            ]}
            sources={[
              { label: "Persisted run report", detail: report?.run_id ?? "No observed run identifier", state: report ? "proven" : "pending" },
              { label: "Release attribution", detail: report?.release_sha ?? "Report SHA missing", state: releaseState === "current" ? "proven" : releaseState === "stale" ? "not-proven" : "pending" },
              { label: "Backend image digest", detail: data.version.backend_image_digest ?? "Cloud release manifest pending", state: data.version.backend_image_digest ? "proven" : "pending" },
            ]}
            limitations={["A local exact check is not Cloud Scheduler evidence.", "The historical local baseline is not attributed to the current release.", "Measured model cost is reported only when the observed run made model calls."]}
            trigger={<Button type="button" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"><FileCheck2 aria-hidden="true" /> Show execution proof</Button>}
          />
        </div>
      </section>

      {report ? <LiveReport report={report} data={data} /> : (
        <PendingState title="No observed night run yet" description={`The current statement has ${metric(data.digest.digest.statement.total)} rows, but this page will not infer a run report from aggregate state. Trigger the real Job in cloud, or use the explicitly local deterministic check.`} />
      )}
      <Baseline />
      <p className="mt-7 text-center text-xs text-muted-foreground">The Loom must show Cloud Scheduler or the reviewed proof workflow starting the real Cloud Run Job. This page alone is not scheduler evidence.</p>
      <AlertDialog open={confirming !== null} onOpenChange={(open) => { if (!running && !open) setConfirming(null); }}>
        {confirming ? (
          <RunConfirmation
            mode={confirming}
            busy={running}
            failure={failure}
            onCancel={() => { if (!running) setConfirming(null); }}
            onConfirm={() => void run(confirming)}
          />
        ) : null}
      </AlertDialog>
    </>
  );
}
