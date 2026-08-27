import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Coins,
  FileSearch,
  MessageSquareText,
  PackageSearch,
  ShieldCheck,
  ShoppingBag,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import { AuthorityRail } from "@/components/control-room/authority-rail";
import { KshValue, Metric } from "@/components/control-room/metric";
import { PageHeader } from "@/components/control-room/page-header";
import { DegradedBanner } from "@/components/control-room/product-states";
import { ProofSheet } from "@/components/control-room/proof-sheet";
import { ReleaseStrip } from "@/components/control-room/release-strip";
import { TrustBadge } from "@/components/control-room/trust-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MorningBriefData } from "@/lib/api/morning-brief";
import { decisionPresentation } from "@/lib/decisions/decision";
import { nightlyFreshness } from "@/lib/morning-brief/presentation";

function approvalLabel(kind: string) {
  return kind.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function finishLabel(value?: string) {
  if (!value) return "Finish time not reported";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
    timeZoneName: "short",
  }).format(parsed);
}

export function MorningBrief({ data }: { data: MorningBriefData }) {
  const { digest, approvals, statement, version } = data;
  const nightly = digest.digest.nightly;
  const settledRate = statement.total ? statement.matched_exact / statement.total : 0;
  const settledPercent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(settledRate);
  const residue = statement.unmatched + statement.fuzzy_proposed;
  const environment = version.environment || "unknown";
  const releaseProven = Boolean(version.release_sha && version.release_sha !== "unknown");
  const nightlyObserved = Boolean(nightly?.finished_at || nightly?.run_id);
  const freshness = nightlyFreshness(nightly?.finished_at);
  const nightlyStale = freshness.state === "stale" || freshness.state === "invalid";
  const firstDecision = approvals[0]
    ? { approval: approvals[0], view: decisionPresentation(approvals[0]) }
    : null;
  const primaryAction = approvals.length
    ? { href: "/approvals", label: `Review ${approvals.length} decision${approvals.length === 1 ? "" : "s"}` }
    : nightlyObserved
      ? { href: "/inbox", label: "Open customer inbox" }
      : { href: "/night-shift", label: "Open night shift" };

  return (
    <>
      <PageHeader
        eyebrow={`Morning brief · ${digest.digest.date}`}
        title="Your shop is ready for the day."
        description="Routine evidence was handled overnight. What remains is small, explicit, and yours to decide."
      />

      {nightlyStale ? (
        <DegradedBanner
          className="mb-5"
          title="The latest night-shift report is stale"
          description="These books remain visible, but Duka is not presenting an old run as today’s completed work. Open Night Shift to inspect or run the next approved check."
        />
      ) : null}

      <ReleaseStrip
        environment={environment}
        releaseSha={version.release_sha}
        model={version.model}
        modelLocation={version.model_location}
        runId={nightly?.run_id}
      />

      <section className="paper-noise relative mb-5 overflow-hidden rounded-2xl bg-sidebar px-4 py-5 text-sidebar-foreground shadow-sm sm:px-7 sm:py-7">
        <div className="relative z-10 grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.48fr)] lg:items-end">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge className="border-white/15 bg-white/10 text-white">
                {nightlyStale ? <TriangleAlert aria-hidden="true" className="size-3.5" /> : <CheckCircle2 aria-hidden="true" className="size-3.5" />}
                {nightlyStale ? "Night shift report stale" : nightlyObserved ? "Night shift complete" : "Brief assembled"}
              </Badge>
              <Badge className="border-white/15 bg-transparent font-mono text-sidebar-muted">{environment}</Badge>
            </div>
            <p className="text-xs font-semibold text-sidebar-muted">{nightlyObserved ? `Finished ${finishLabel(nightly?.finished_at)} · Next scheduled 02:00 EAT` : "No observed run finish time is available"}</p>
            <h2 className="numeric mt-2 text-3xl font-bold tracking-[-0.045em] sm:text-5xl">
              {statement.matched_exact.toLocaleString()}
              <span className="ml-2 text-lg font-semibold tracking-normal text-sidebar-muted sm:text-xl">settled exactly</span>
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-sidebar-muted">
              {settledPercent} of {statement.total.toLocaleString()} statement rows cleared without model judgment. Gemini is limited to bounded residue; consequential ambiguity stopped for you.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-sidebar-muted">{approvals.length ? "Your morning action" : "Morning queue"}</p>
            <p className="numeric mt-2 text-2xl font-bold sm:text-3xl">{approvals.length || "Clear"}</p>
            <p className="mt-1 text-sm text-sidebar-muted">{approvals.length ? `decision${approvals.length === 1 ? "" : "s"} need owner authority` : "No consequential decisions are waiting."}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button asChild className="bg-white text-sidebar hover:bg-white/90">
                <Link href={primaryAction.href}>{primaryAction.label} <ArrowRight aria-hidden="true" /></Link>
              </Button>
              <ProofSheet
                title="Morning brief proof"
                description="Release and execution evidence behind the visible overnight outcome."
                outcome={<>{statement.matched_exact.toLocaleString()} rows are reported as exact matches; {approvals.length} consequential item{approvals.length === 1 ? " is" : "s are"} waiting.</>}
                reason="Exact matching is deterministic. Gemini may interpret bounded residue, but uncertain money-adjacent outcomes enter the owner queue instead of being declared settled."
                facts={[
                  { label: "Environment", value: environment },
                  { label: "Release SHA", value: version.release_sha || "not proven" },
                  { label: "Model", value: version.model },
                  { label: "Model location", value: version.model_location },
                  ...(nightly?.run_id ? [{ label: "Night run", value: nightly.run_id }] : []),
                ]}
                sources={[
                  { label: "Validated API release", detail: version.release_sha || "Release identifier absent", state: releaseProven ? "proven" : "not-proven" },
                  { label: "Backend image digest", detail: version.backend_image_digest || "Not returned by this environment", state: version.backend_image_digest ? "proven" : "pending" },
                  { label: "Observed night run", detail: nightly?.run_id || "No run identifier returned", state: nightlyObserved ? "proven" : "pending" },
                ]}
                limitations={[
                  "Exact matches update internal bookkeeping only.",
                  "This release does not initiate an external M-Pesa transfer or supplier order.",
                  environment === "local" ? "Local evidence is not presented as Google Cloud execution proof." : "Cloud status is proven only by the linked release artifacts.",
                ]}
                trigger={<Button type="button" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"><FileSearch aria-hidden="true" /> Show proof</Button>}
              />
            </div>
          </div>
        </div>
      </section>

      <AuthorityRail
        className="mb-5"
        compactOnMobile
        steps={[
          { lane: "exact", title: "Routine evidence settled", detail: "Reference, amount, and chronology satisfied deterministic invariants.", value: statement.matched_exact.toLocaleString() },
          { lane: "gemini", title: "Ambiguity stayed bounded", detail: "The model may extract or propose; it cannot declare uncertain money paid.", value: residue.toLocaleString() },
          { lane: "owner", title: "Consequences stopped here", detail: "Only the exact effect written in the decision queue can be authorized.", value: approvals.length.toLocaleString() },
        ]}
      />

      <section aria-label="Morning outcomes" className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric className="p-3 sm:p-5" label="Settled exactly" value={statement.matched_exact.toLocaleString()} detail={`${settledPercent} of statement rows`} icon={CheckCircle2} tone="exact" />
        <Metric className="p-3 sm:p-5" label="Needs your decision" value={digest.digest.approvals_pending.toLocaleString()} detail={approvals.length ? `${approvalLabel(approvals[0].kind)} is first` : "Queue is clear"} icon={ShieldCheck} tone="owner" />
        <Metric className="p-3 sm:p-5" label="Paid orders · 24h" value={digest.digest.paid_last_24h.toLocaleString()} detail={`${digest.digest.orders_last_24h.toLocaleString()} total orders`} icon={ShoppingBag} />
        <Metric className="p-3 sm:p-5" label="Paid revenue · 24h" value={<KshValue value={digest.digest.revenue_paid_last_24h} />} detail="Integer KSh from the books" icon={Coins} />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div><CardTitle>First decision</CardTitle><CardDescription>The first exact internal effect awaiting authority; the full queue stays one tap away.</CardDescription></div>
              <Clock3 aria-hidden="true" className="size-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-0">
            {firstDecision ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{firstDecision.view.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{firstDecision.view.stopped}</p>
                    <p className="mt-2 rounded-lg bg-muted/50 p-2.5 text-xs leading-5"><span className="font-semibold">If approved:</span> {firstDecision.view.approveEffect}</p>
                  </div>
                  <TrustBadge lane="owner" />
                </div>
                {approvals.length > 1 ? (
                  <p className="mt-3 border-t pt-3 text-xs leading-5 text-muted-foreground">
                    +{approvals.length - 1} more bounded decision{approvals.length === 2 ? "" : "s"} wait in the owner queue.
                  </p>
                ) : null}
              </div>
            ) : null}
            {!approvals.length ? <div className="rounded-lg bg-exact/10 p-4 text-sm text-exact">Nothing is waiting for you. The decision queue is clear.</div> : null}
            <Button asChild variant="outline" className="mt-5 w-full"><Link href="/approvals">Open decision queue <ArrowRight aria-hidden="true" /></Link></Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><MessageSquareText aria-hidden="true" className="size-4.5 text-primary" /><CardTitle>Morning digest</CardTitle></div>
              <CardDescription>Deterministic prose assembled directly from validated books.</CardDescription>
            </CardHeader>
            <CardContent><p className="whitespace-pre-line text-sm leading-6">{digest.text}</p></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><PackageSearch aria-hidden="true" className="size-4.5 text-owner" /><CardTitle>Stock attention</CardTitle></div>
              <CardDescription>Evidence for the next review, not a supplier order.</CardDescription>
            </CardHeader>
            <CardContent>
              {digest.digest.low_stock.length ? (
                <div className="space-y-3">
                  {digest.digest.low_stock.slice(0, 3).map((item) => <div key={item.sku} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{item.name}</span><span className="numeric shrink-0 font-mono text-xs text-muted-foreground">{item.stock} left</span></div>)}
                  <Button asChild variant="outline" className="w-full"><Link href="/inventory">Review stock evidence <ArrowRight aria-hidden="true" /></Link></Button>
                </div>
              ) : <p className="text-sm text-muted-foreground">No low-stock items were reported in this brief.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="mt-7 text-center text-xs text-muted-foreground">Synthetic judging environment · No external M-Pesa transfer or supplier order is initiated.</p>
    </>
  );
}
