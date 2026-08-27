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
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/control-room/page-header";
import { TrustBadge } from "@/components/control-room/trust-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { approvalsSchema, decisionResponseSchema, type Approval } from "@/lib/api/contracts";
import { BrowserApiError, browserApi } from "@/lib/api/browser-client";
import { decisionKinds, decisionPresentation, type DecisionPresentation } from "@/lib/decisions/decision";
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
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Africa/Nairobi", timeZoneName: "short",
  }).format(parsed);
}

function RetryState({ approval }: { approval: Approval }) {
  if (approval.status !== "resume_failed") return null;
  return (
    <div className="mt-3 flex gap-2 rounded-lg border border-attention/40 bg-attention/10 p-3 text-xs leading-5">
      <RefreshCw aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <p>The previous {approval.requested_decision ?? "decision"} attempt did not complete. It is safe to retry that same decision; no successful effect is claimed.</p>
    </div>
  );
}

function Evidence({ view }: { view: DecisionPresentation }) {
  return (
    <div className="space-y-2">
      <p className="text-sm leading-6">{view.observed}</p>
      <p className="text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">Why Duka stopped:</span> {view.stopped}</p>
      {view.identifiers.length ? (
        <div className="flex flex-wrap gap-1.5">
          {view.identifiers.map((identifier) => <Badge key={identifier} variant="outline" className="font-mono text-[0.68rem]">{identifier}</Badge>)}
        </div>
      ) : null}
      {view.evidence.length ? (
        <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
          {view.evidence.map((item, index) => <li key={`${index}-${item}`} className="break-words">• {item}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function ActionButtons({ approval, view, busy, onAction }: {
  approval: Approval;
  view: DecisionPresentation;
  busy: boolean;
  onAction: (approval: Approval, decision: Decision) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
      <Button onClick={() => onAction(approval, "approved")} disabled={busy || !view.canApprove} title={!view.canApprove ? view.approveEffect : undefined}>
        {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />}
        {view.approveLabel}
      </Button>
      <Button variant="outline" onClick={() => onAction(approval, "rejected")} disabled={busy}>
        <CircleX aria-hidden="true" /> {view.rejectLabel}
      </Button>
    </div>
  );
}

function DecisionCard({ approval, busy, onAction }: {
  approval: Approval;
  busy: boolean;
  onAction: (approval: Approval, decision: Decision) => void;
}) {
  const view = decisionPresentation(approval);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{view.label}</CardTitle>
            <CardDescription className="mt-1">#{approval.id} · {dateLabel(approval.created_at)}</CardDescription>
          </div>
          {riskBadge(view.risk)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Evidence view={view} />
        <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-5">
          <span className="font-semibold">Approve effect:</span> {view.approveEffect}
        </div>
        <RetryState approval={approval} />
        <ActionButtons approval={approval} view={view} busy={busy} onAction={onAction} />
      </CardContent>
    </Card>
  );
}

function ConfirmationDialog({ target, busy, onCancel, onConfirm }: {
  target: Confirmation;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const view = decisionPresentation(target.approval);
  const approving = target.decision === "approved";
  const effect = approving ? view.approveEffect : view.rejectEffect;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="decision-dialog-title"
      aria-describedby="decision-dialog-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
      className="m-auto w-[min(92vw,36rem)] rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-foreground/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-5 sm:p-6">
        <span className={cn("grid size-11 place-items-center rounded-xl", approving ? "bg-attention/15" : "bg-muted")}>
          {approving ? <Scale aria-hidden="true" className="size-5" /> : <CircleX aria-hidden="true" className="size-5" />}
        </span>
        <h2 id="decision-dialog-title" className="mt-4 text-xl font-bold tracking-tight">
          {approving ? view.approveLabel : view.rejectLabel}?
        </h2>
        <p id="decision-dialog-description" className="mt-2 text-sm leading-6 text-muted-foreground">
          {effect}
        </p>
        <div className="mt-4 rounded-lg border bg-background p-3 text-xs leading-5">
          <span className="font-semibold">Boundary:</span> Duka applies the named internal effect exactly once. It does not infer any external transfer, supplier fulfillment, or corrected ledger value.
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={approving ? "default" : "destructive"} onClick={onConfirm} disabled={busy || (approving && !view.canApprove)}>
            {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : approving ? <CheckCircle2 aria-hidden="true" /> : <CircleX aria-hidden="true" />}
            {busy ? "Applying once…" : approving ? view.approveLabel : view.rejectLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export function DecisionQueue({ initialApprovals }: { initialApprovals: Approval[] }) {
  const router = useRouter();
  const [approvals, setApprovals] = useState(initialApprovals);
  const [filter, setFilter] = useState("all");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const kinds = useMemo(() => decisionKinds(approvals), [approvals]);
  const visible = filter === "all" ? approvals : approvals.filter((approval) => approval.kind === filter);

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
    setBusyId(approval.id);
    setOutcome(null);
    try {
      const result = await browserApi(`approvals/${encodeURIComponent(approval.id)}`, decisionResponseSchema, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setConfirmation(null);
      if (result.ok) {
        setApprovals((current) => current.filter((item) => item.id !== approval.id));
        const detail = result.resumed_reply ? ` Workflow reply: ${result.resumed_reply}` : "";
        setOutcome({
          tone: "success",
          text: `${decision === "approved" ? "Approved" : "Rejected"} exactly once${result.idempotent ? " (idempotent replay)" : ""}.${detail}`,
        });
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

  return (
    <>
      <PageHeader
        eyebrow="Human gate"
        title="Decisions"
        description="One queue for ambiguity and consequence. Every card explains the evidence, stop reason and exact internal effect before you act."
        action={<Button variant="outline" onClick={() => void refreshQueue()} disabled={refreshing}>{refreshing ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />} Refresh queue</Button>}
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-3.5"><TrustBadge lane="exact" /><p className="mt-2 text-xs leading-5 text-muted-foreground">Exact evidence never enters this queue.</p></div>
        <div className="rounded-xl border bg-card p-3.5"><TrustBadge lane="gemini" /><p className="mt-2 text-xs leading-5 text-muted-foreground">Ambiguous proposals arrive with bounded evidence.</p></div>
        <div className="rounded-xl border bg-card p-3.5"><TrustBadge lane="owner" /><p className="mt-2 text-xs leading-5 text-muted-foreground">You authorize only the effect written on the card.</p></div>
      </section>

      {outcome ? (
        <div role="status" className={cn(
          "mb-5 flex gap-3 rounded-xl border p-4 text-sm leading-6",
          outcome.tone === "success" && "border-exact/30 bg-exact/10",
          outcome.tone === "notice" && "border-attention/40 bg-attention/10",
          outcome.tone === "error" && "border-destructive/35 bg-destructive/5 text-destructive",
        )}>
          {outcome.tone === "success" ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
          <p>{outcome.text}</p>
        </div>
      ) : null}

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">{approvals.length} waiting decision{approvals.length === 1 ? "" : "s"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Pending and retryable items only · oldest first</p>
          </div>
          <div className="scrollbar-none flex max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-end sm:overflow-visible" aria-label="Decision filters">
            {["all", ...kinds].map((kind) => (
              <Button key={kind} size="sm" variant={filter === kind ? "secondary" : "outline"} onClick={() => setFilter(kind)} className="shrink-0">
                {kind === "all" ? "All" : kind.replaceAll("_", " ")} {kind === "all" ? approvals.length : approvals.filter((approval) => approval.kind === kind).length}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {visible.length ? (
        <>
          <div className="grid gap-4 lg:hidden">
            {visible.map((approval) => <DecisionCard key={approval.id} approval={approval} busy={busyId === approval.id} onAction={(item, decision) => setConfirmation({ approval: item, decision })} />)}
          </div>

          <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="bg-muted/60 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <tr><th className="w-[19%] px-4 py-3 font-semibold">Decision</th><th className="w-[42%] px-4 py-3 font-semibold">Observed evidence</th><th className="w-[23%] px-4 py-3 font-semibold">Exact effect</th><th className="w-[16%] px-4 py-3 font-semibold">Action</th></tr>
              </thead>
              <tbody>
                {visible.map((approval) => {
                  const view = decisionPresentation(approval);
                  return (
                    <tr key={approval.id} className="border-t align-top">
                      <td className="px-4 py-5">
                        <p className="font-semibold">{view.label}</p>
                        <div className="mt-2">{riskBadge(view.risk)}</div>
                        <p className="mt-2 break-all font-mono text-[0.68rem] text-muted-foreground">#{approval.id}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3" /> {dateLabel(approval.created_at)}</p>
                        <RetryState approval={approval} />
                      </td>
                      <td className="px-4 py-5"><Evidence view={view} /></td>
                      <td className="px-4 py-5 text-xs leading-5"><p className="font-semibold">If approved</p><p className="mt-1 text-muted-foreground">{view.approveEffect}</p></td>
                      <td className="px-4 py-5"><ActionButtons approval={approval} view={view} busy={busyId === approval.id} onAction={(item, decision) => setConfirmation({ approval: item, decision })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="grid min-h-64 place-items-center p-8 text-center">
            <div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-exact/10 text-exact"><CheckCircle2 aria-hidden="true" className="size-5" /></span><h2 className="mt-4 text-lg font-bold">{approvals.length ? "No decisions match this filter" : "The queue is clear"}</h2><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{approvals.length ? "Choose All to return to the complete owner queue." : "Routine work completed without hand-holding. Duka will stop here again when evidence or consequence demands you."}</p>{approvals.length ? <Button className="mt-4" variant="outline" onClick={() => setFilter("all")}>Show all <ArrowRight aria-hidden="true" /></Button> : null}</div>
          </CardContent>
        </Card>
      )}

      <p className="mt-7 text-center text-xs text-muted-foreground">No external M-Pesa transfer or supplier order is initiated by this release.</p>

      {confirmation ? <ConfirmationDialog target={confirmation} busy={busyId === confirmation.approval.id} onCancel={() => { if (!busyId) setConfirmation(null); }} onConfirm={() => void applyDecision()} /> : null}
    </>
  );
}
