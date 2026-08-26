import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Coins,
  MessageSquareText,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { MorningBriefData } from "@/lib/api/morning-brief";
import { formatKsh } from "@/lib/format/money";

import { PageHeader } from "./page-header";
import { TrustBadge } from "./trust-badge";

function approvalLabel(kind: string) {
  return kind.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function MorningBrief({ data }: { data: MorningBriefData }) {
  const { digest, approvals, statement, version } = data;
  const settledRate = statement.total ? statement.matched_exact / statement.total : 0;
  const settledPercent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(settledRate);

  const cards = [
    {
      label: "Settled exactly",
      value: statement.matched_exact.toLocaleString(),
      detail: `${settledPercent} of statement rows`,
      icon: CheckCircle2,
      tone: "text-exact bg-exact/10",
    },
    {
      label: "Needs your decision",
      value: digest.digest.approvals_pending.toLocaleString(),
      detail: approvals.length ? `${approvalLabel(approvals[0].kind)} is first` : "Queue is clear",
      icon: ShieldCheck,
      tone: "text-foreground bg-attention/15",
    },
    {
      label: "Orders · 24h",
      value: digest.digest.orders_last_24h.toLocaleString(),
      detail: `${digest.digest.paid_last_24h} already paid`,
      icon: ShoppingBag,
      tone: "text-primary bg-primary/10",
    },
    {
      label: "Paid revenue · 24h",
      value: formatKsh(digest.digest.revenue_paid_last_24h),
      detail: "Integer KSh from the books",
      icon: Coins,
      tone: "text-gemini bg-gemini/10",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={`Morning brief · ${digest.digest.date}`}
        title="Your shop is ready for the day."
        description="Routine evidence was handled overnight. What remains is small, explicit and yours to decide."
        action={
          <Button asChild size="lg">
            <Link href="/approvals">
              {approvals.length ? `Review ${approvals.length} decision${approvals.length === 1 ? "" : "s"}` : "View decisions"}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <section className="paper-noise relative mb-6 overflow-hidden rounded-2xl bg-sidebar px-5 py-6 text-sidebar-foreground shadow-sm sm:px-7 sm:py-7">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-white/15 bg-white/10 text-white">Autopilot is on</Badge>
              <Badge className="border-white/15 bg-transparent font-mono text-sidebar-muted">
                {version.release_sha.slice(0, 9)}
              </Badge>
            </div>
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
              The duka slept. Its back office did not.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-sidebar-muted">
              Exact evidence settles automatically. Gemini sees only bounded ambiguity. Consequential uncertainty waits for you.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[24rem]">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-sidebar-muted">Model</p>
              <p className="mt-1 break-words font-mono text-[0.68rem] leading-4">{version.model}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-sidebar-muted">Location</p>
              <p className="mt-1 font-mono text-xs">{version.model_location}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-sidebar-muted">Topology</p>
              <p className="mt-1 font-mono text-xs">{version.durable_topology.compatible ? "compatible" : "blocked"}</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Morning outcomes" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon, tone }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className={`mb-5 grid size-10 place-items-center rounded-lg ${tone}`}>
                <Icon aria-hidden="true" className="size-4.5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className="numeric mt-1 text-2xl font-bold tracking-tight">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>What happened overnight</CardTitle>
                <CardDescription>A single causal path, separated by authority.</CardDescription>
              </div>
              <Clock3 aria-hidden="true" className="size-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-0">
              {[
                { lane: "exact" as const, title: "Exact evidence settled", text: `${statement.matched_exact.toLocaleString()} payment rows matched without model judgment.` },
                { lane: "gemini" as const, title: "Ambiguity stayed bounded", text: `${statement.unmatched.toLocaleString()} unmatched and ${statement.fuzzy_proposed.toLocaleString()} proposed; Gemini cannot declare uncertain money paid.` },
                { lane: "owner" as const, title: "Consequences stopped here", text: `${approvals.length.toLocaleString()} decision${approvals.length === 1 ? "" : "s"} remain in one review queue.` },
              ].map((step, index, all) => (
                <li key={step.lane} className="grid grid-cols-[2rem_1fr] gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 grid size-7 place-items-center rounded-full border bg-card font-mono text-xs font-bold">{index + 1}</span>
                    {index < all.length - 1 ? <span className="my-1 h-full w-px bg-border" /> : null}
                  </div>
                  <div className="pb-6">
                    <TrustBadge lane={step.lane} />
                    <p className="mt-2 font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquareText aria-hidden="true" className="size-4.5 text-primary" />
                <CardTitle>Morning digest</CardTitle>
              </div>
              <CardDescription>Deterministic prose assembled directly from the books.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-6">{digest.text}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>First decisions</CardTitle>
              <CardDescription>Why Duka stopped instead of guessing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {approvals.slice(0, 3).map((approval, index) => (
                <div key={approval.id}>
                  {index ? <Separator className="mb-3" /> : null}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{approvalLabel(approval.kind)}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">#{approval.id}</p>
                    </div>
                    <Badge variant="attention">Owner</Badge>
                  </div>
                </div>
              ))}
              {!approvals.length ? (
                <div className="rounded-lg bg-exact/10 p-4 text-sm text-exact">
                  Nothing is waiting for you. The decision queue is clear.
                </div>
              ) : null}
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link href="/approvals">Open decision queue <ArrowRight aria-hidden="true" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="mt-7 text-center text-xs text-muted-foreground">
        Synthetic judging environment · No external M-Pesa transfer or supplier order is initiated.
      </p>
    </>
  );
}
