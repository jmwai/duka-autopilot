"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleX,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Scale,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/control-room/page-header";
import { EmptyState } from "@/components/control-room/product-states";
import { TrustBadge } from "@/components/control-room/trust-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { approvalsSchema, decisionResponseSchema, type Approval } from "@/lib/api/contracts";
import { BrowserApiError, browserApi } from "@/lib/api/browser-client";
import { decisionKinds, decisionPresentation, ownerAmountError, OWNER_AMOUNT_MAX, type DecisionPresentation } from "@/lib/decisions/decision";
import { formatKsh } from "@/lib/format/money";
import { cn } from "@/lib/utils";

type Decision = "approved" | "rejected";
type Confirmation = { approval: Approval; decision: Decision };
type Outcome = { tone: "success" | "notice" | "error"; text: string };

function riskBadge(risk: DecisionPresentation["risk"]) {
  if (risk === "security") return <Badge variant="attention"><ShieldAlert aria-hidden="true" className="size-3.5" /> Security</Badge>;
  if (risk === "consequential") return <Badge variant="attention"><Scale aria-hidden="true" className="size-3.5" /> Consequential</Badge>;
  return <Badge variant="outline">Review</Badge>;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Time unavailable";
  const parsed = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat("en-KE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
    timeZoneName: "short",
  }).format(parsed);
}

function RetryState({ approval }: { approval: Approval }) {
  if (approval.status !== "resume_failed") return null;
  return (
    <div className="flex gap-2 rounded-lg border border-owner/40 bg-owner/10 p-3 text-xs leading-5">
      <RefreshCw aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <p>The previous {approval.requested_decision ?? "decision"} attempt did not complete. Retrying that same decision is safe; no successful effect is claimed.</p>
    </div>
  );
}

function DecisionEvidence({ view }: { view: DecisionPresentation }) {
  return (
    <div className="space-y-4">
      <section>
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary">Observed</p>
        <p className="mt-2 text-sm leading-6">{view.observed}</p>
      </section>
      <section className="rounded-xl border border-gemini/25 bg-gemini/5 p-4">
        <div className="flex items-center gap-2"><TrustBadge lane="gemini" /><span className="text-xs font-semibold">Why Duka stopped</span></div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{view.stopped}</p>
      </section>
      {view.identifiers.length || view.evidence.length ? (
        <section>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">Evidence</p>
          {view.identifiers.length ? <div className="mt-2 flex flex-wrap gap-1.5">{view.identifiers.map((identifier) => <Badge key={identifier} variant="outline" className="font-mono text-[0.68rem]">{identifier}</Badge>)}</div> : null}
          {view.evidence.length ? <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">{view.evidence.map((item, index) => <li key={`${index}-${item}`} className="break-words">• {item}</li>)}</ul> : null}
        </section>
      ) : null}
    </div>
  );
}

function DecisionInspector({ approval, busy, onAction }: { approval: Approval; busy: boolean; onAction: (approval: Approval, decision: Decision) => void }) {
  const view = decisionPresentation(approval);
  const sourceEventId = typeof approval.payload.source_event_id === "string" ? approval.payload.source_event_id : null;
  const customerId = typeof approval.payload.customer_id === "string" ? approval.payload.customer_id : null;
  const orderId = typeof approval.payload.order_id === "string" || typeof approval.payload.order_id === "number" ? String(approval.payload.order_id) : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-owner">Owner decision</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{view.label}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" /> {dateLabel(approval.created_at)}</p>
          </div>
          {riskBadge(view.risk)}
        </div>

        <DecisionEvidence view={view} />
        {(orderId || sourceEventId) ? <nav aria-label="Related business evidence" className="flex flex-wrap gap-2">
          {orderId ? <Button asChild variant="outline" size="sm"><Link href={`/orders?order=${encodeURIComponent(orderId)}`}>Open order #{orderId} <ArrowRight aria-hidden="true" /></Link></Button> : null}
          {sourceEventId && customerId ? <Button asChild variant="outline" size="sm"><Link href={`/inbox?customer=${encodeURIComponent(customerId)}&event=${encodeURIComponent(sourceEventId)}`}>Open source event <ArrowRight aria-hidden="true" /></Link></Button> : null}
          <Button asChild variant="ghost" size="sm"><Link href="/evidence#trace">Causal evidence</Link></Button>
        </nav> : null}
        <RetryState approval={approval} />

        <section className="rounded-xl border border-owner/35 bg-owner/10 p-4">
          <div className="flex items-center gap-2"><TrustBadge lane="owner" /><span className="text-xs font-semibold">Exact effect if approved</span></div>
          <p className="mt-2 text-sm leading-6">{view.approveEffect}</p>
          <p className="mt-3 border-t border-owner/20 pt-3 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">If rejected:</span> {view.rejectEffect}</p>
        </section>

        <p className="text-xs leading-5 text-muted-foreground">Boundary: Duka applies only the named internal effect exactly once. It does not infer an external transfer, supplier fulfillment, or a ledger value you did not enter yourself.</p>
      </div>

      <div className="sticky bottom-0 grid gap-2 border-t bg-card/95 p-4 backdrop-blur sm:grid-cols-2 sm:p-5">
        <Button variant="outline" onClick={() => onAction(approval, "rejected")} disabled={busy}><CircleX aria-hidden="true" /> {view.rejectLabel}</Button>
        <Button onClick={() => onAction(approval, "approved")} disabled={busy || !view.canApprove} title={!view.canApprove ? view.approveEffect : undefined}>
          {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />} {view.approveLabel}
        </Button>
      </div>
    </div>
  );
}

function QueueItem({ approval, selected, onSelect }: { approval: Approval; selected?: boolean; onSelect: () => void }) {
  const view = decisionPresentation(approval);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn("w-full border-b p-4 text-left transition-colors last:border-b-0 hover:bg-accent/55 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring", selected && "bg-accent")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{view.label}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{view.observed}</p>
        </div>
        {approval.status === "resume_failed" ? <RefreshCw aria-label="Retryable" className="mt-0.5 size-3.5 shrink-0 text-owner" /> : <ArrowRight aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {riskBadge(view.risk)}
        <span className="text-[0.68rem] text-muted-foreground">{dateLabel(approval.created_at)}</span>
      </div>
    </button>
  );
}

export function DecisionQueue({ initialApprovals }: { initialApprovals: Approval[] }) {
  const router = useRouter();
  const [approvals, setApprovals] = useState(initialApprovals);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(initialApprovals[0]?.id ?? null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Only used by a ledger row whose amount the model could not read.
  const [amount, setAmount] = useState("");
  const amountError = ownerAmountError(amount);
  const kinds = useMemo(() => decisionKinds(approvals), [approvals]);
  const visible = useMemo(() => filter === "all" ? approvals : approvals.filter((approval) => approval.kind === filter), [approvals, filter]);
  const selected = visible.find((approval) => approval.id === selectedId) ?? visible[0] ?? null;

  async function refreshQueue() {
    setRefreshing(true);
    try {
      setApprovals(await browserApi("approvals", approvalsSchema));
    } catch (error) {
      if (error instanceof BrowserApiError && error.status === 401) {
        router.replace("/login?next=/approvals");
        router.refresh();
      } else {
        toast.error(error instanceof Error ? error.message : "The decision queue could not be refreshed.");
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function applyDecision() {
    if (!confirmation || busyId) return;
    const { approval, decision } = confirmation;
    const view = decisionPresentation(approval);
    const entering = decision === "approved" && view.needsAmount === true;
    if (entering && amountError) return;
    setBusyId(approval.id);
    setOutcome(null);
    try {
      const result = await browserApi(`approvals/${encodeURIComponent(approval.id)}`, decisionResponseSchema, {
        method: "POST",
        body: JSON.stringify(entering
          ? { decision, amount: Number(amount.trim()) }
          : { decision }),
      });
      setConfirmation(null);
      setAmount("");
      if (result.ok) {
        setApprovals((current) => current.filter((item) => item.id !== approval.id));
        setMobileOpen(false);
        const detail = result.resumed_reply ? ` Workflow reply: ${result.resumed_reply}` : "";
        // A recorded sale is the point of the decision, so name it.
        const sale = result.order_id
          ? ` Sale recorded as order #${result.order_id}${result.amount ? ` for ${formatKsh(result.amount)}` : ""}${result.amount_source === "owner" ? ", using the amount you entered" : ""}.`
          : "";
        setOutcome({ tone: "success", text: `${decision === "approved" ? "Approved" : "Rejected"} exactly once${result.idempotent ? " (idempotent replay)" : ""}.${sale}${detail}` });
      } else {
        setOutcome({ tone: "notice", text: `The ${result.decision} decision is already in progress. No second effect was started.` });
        await refreshQueue();
      }
    } catch (error) {
      setConfirmation(null);
      if (error instanceof BrowserApiError && error.status === 401) {
        router.replace("/login?next=/approvals");
        router.refresh();
      } else if (error instanceof BrowserApiError && error.status === 409) {
        setOutcome({ tone: "error", text: "Decision conflict: another decision was already claimed or this effect cannot be applied safely. The queue has been refreshed." });
        await refreshQueue();
      } else if (error instanceof BrowserApiError && error.status === 503) {
        setOutcome({ tone: "notice", text: "The workflow did not complete. The same decision remains retryable; no successful effect is claimed." });
        await refreshQueue();
      } else {
        setOutcome({ tone: "error", text: error instanceof Error ? error.message : "The decision could not be applied." });
      }
    } finally {
      setBusyId(null);
    }
  }

  function selectMobile(approval: Approval) {
    setSelectedId(approval.id);
    setMobileOpen(true);
  }

  return (
    <>
      <PageHeader
        eyebrow="Human gate"
        title="Decisions"
        description="One queue for ambiguity and consequence. Inspect the evidence and exact internal effect before you act."
        action={<Button variant="outline" onClick={() => void refreshQueue()} disabled={refreshing}>{refreshing ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />} Refresh queue</Button>}
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-3.5"><TrustBadge lane="exact" /><p className="mt-2 text-xs leading-5 text-muted-foreground">Exact evidence never enters this queue.</p></div>
        <div className="rounded-xl border bg-card p-3.5"><TrustBadge lane="gemini" /><p className="mt-2 text-xs leading-5 text-muted-foreground">Ambiguous proposals arrive with bounded evidence.</p></div>
        <div className="rounded-xl border bg-card p-3.5"><TrustBadge lane="owner" /><p className="mt-2 text-xs leading-5 text-muted-foreground">You authorize only the effect written in the inspector.</p></div>
      </section>

      {outcome ? (
        <div role="status" className={cn("mb-5 flex gap-3 rounded-xl border p-4 text-sm leading-6", outcome.tone === "success" && "border-exact/30 bg-exact/10", outcome.tone === "notice" && "border-owner/40 bg-owner/10", outcome.tone === "error" && "border-conflict/35 bg-conflict/5 text-conflict")}>
          {outcome.tone === "success" ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
          <p>{outcome.text}</p>
        </div>
      ) : null}

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold">{approvals.length} waiting decision{approvals.length === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-muted-foreground">Pending and retryable items only · oldest first</p></div>
          <div className="scrollbar-none flex max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-end sm:overflow-visible" aria-label="Decision filters">
            {["all", ...kinds].map((kind) => <Button key={kind} size="sm" variant={filter === kind ? "secondary" : "outline"} onClick={() => setFilter(kind)} className="shrink-0">{kind === "all" ? "All" : kind.replaceAll("_", " ")} {kind === "all" ? approvals.length : approvals.filter((approval) => approval.kind === kind).length}</Button>)}
          </div>
        </CardContent>
      </Card>

      {visible.length ? (
        <>
          <div className="overflow-hidden rounded-xl border bg-card lg:hidden">
            {visible.map((approval) => <QueueItem key={approval.id} approval={approval} onSelect={() => selectMobile(approval)} />)}
          </div>

          <div className="hidden min-h-[38rem] overflow-hidden rounded-xl border bg-card lg:grid lg:grid-cols-[21rem_minmax(0,1fr)]">
            <aside aria-label="Decision queue" className="border-r bg-muted/15">
              <div className="border-b p-4"><p className="text-sm font-semibold">Owner queue</p><p className="mt-1 text-xs text-muted-foreground">Select one decision to inspect.</p></div>
              {visible.map((approval) => <QueueItem key={approval.id} approval={approval} selected={selected?.id === approval.id} onSelect={() => setSelectedId(approval.id)} />)}
            </aside>
            {selected ? <DecisionInspector approval={selected} busy={busyId === selected.id} onAction={(approval, decision) => setConfirmation({ approval, decision })} /> : null}
          </div>
        </>
      ) : <EmptyState title={approvals.length ? "No decisions match this filter" : "The queue is clear"} description={approvals.length ? "Choose All to return to the complete owner queue." : "Routine work completed without hand-holding. Duka will stop here again when evidence or consequence demands you."} action={approvals.length ? <Button variant="outline" onClick={() => setFilter("all")}>Show all <ArrowRight aria-hidden="true" /></Button> : undefined} />}

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="bottom" className="h-[92svh] max-h-[92svh] gap-0 overflow-y-auto p-0 lg:hidden">
          <SheetHeader className="sr-only"><SheetTitle>Decision inspector</SheetTitle><SheetDescription>Review evidence and authorize the exact internal effect.</SheetDescription></SheetHeader>
          {selected ? <DecisionInspector approval={selected} busy={busyId === selected.id} onAction={(approval, decision) => setConfirmation({ approval, decision })} /> : null}
        </SheetContent>
      </Sheet>

      <p className="mt-7 text-center text-xs text-muted-foreground">No external M-Pesa transfer or supplier order is initiated by this release.</p>

      <AlertDialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open && !busyId) { setConfirmation(null); setAmount(""); } }}>
        {confirmation ? (() => {
          const view = decisionPresentation(confirmation.approval);
          const approving = confirmation.decision === "approved";
          return (
            <AlertDialogContent>
              <span className={cn("grid size-11 place-items-center rounded-xl", approving ? "bg-owner/15" : "bg-muted")}>
                {approving ? <Scale aria-hidden="true" className="size-5" /> : <CircleX aria-hidden="true" className="size-5" />}
              </span>
              <AlertDialogHeader>
                <AlertDialogTitle>{approving ? view.approveLabel : view.rejectLabel}?</AlertDialogTitle>
                <AlertDialogDescription>{approving ? view.approveEffect : view.rejectEffect}</AlertDialogDescription>
              </AlertDialogHeader>
              {approving && view.needsAmount ? (
                <div className="rounded-lg border border-owner/40 bg-owner/10 p-3">
                  <label htmlFor="owner-amount" className="text-sm font-semibold">
                    Amount on the page
                  </label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Whole shillings, up to KSh {OWNER_AMOUNT_MAX.toLocaleString("en-KE")}. This is recorded as your figure, not the model&rsquo;s.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">KSh</span>
                    <Input
                      id="owner-amount"
                      inputMode="numeric"
                      autoComplete="off"
                      autoFocus
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      aria-invalid={amountError !== null && amount.trim() !== ""}
                      aria-describedby={amountError ? "owner-amount-error" : undefined}
                      className="numeric max-w-[10rem]"
                      placeholder="240"
                    />
                  </div>
                  {amountError && amount.trim() !== "" ? (
                    <p id="owner-amount-error" role="alert" className="mt-2 text-xs font-medium text-conflict">{amountError}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="rounded-lg border bg-background p-3 text-xs leading-5"><span className="font-semibold">Exactly-once boundary:</span> Duka applies the named internal effect once. No external transfer, supplier fulfillment, or ledger value you did not enter is inferred.</div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={Boolean(busyId)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={Boolean(busyId) || (approving && (!view.canApprove || (view.needsAmount === true && amountError !== null)))}
                  className={cn(!approving && "bg-conflict text-white hover:bg-conflict/90")}
                  onClick={(event) => { event.preventDefault(); void applyDecision(); }}
                >
                  {busyId ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : approving ? <CheckCircle2 aria-hidden="true" /> : <CircleX aria-hidden="true" />}
                  {busyId ? "Applying once…" : approving ? view.approveLabel : view.rejectLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          );
        })() : null}
      </AlertDialog>
    </>
  );
}
