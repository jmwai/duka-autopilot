import { Activity, Banknote, Boxes, ClipboardCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { Metric, KshValue } from "@/components/control-room/metric";
import { PageHeader } from "@/components/control-room/page-header";
import { DegradedBanner, EmptyState, FailureState, PageSkeleton, PendingState } from "@/components/control-room/product-states";
import { EnvironmentBadge, EvidenceSource, ProofSheet, ReleaseStamp } from "@/components/control-room/proof-sheet";
import { StatusTimeline } from "@/components/control-room/status-timeline";
import { TrustBadge } from "@/components/control-room/trust-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DesignSystemPage() {
  const environment = (process.env.DUKA_ENV ?? "local").toLowerCase();
  if (!["local", "test"].includes(environment)) notFound();

  return (
    <>
      <PageHeader eyebrow="Local component gallery" title="Duka product grammar" description="A non-production gallery for trust, evidence, state, responsive and accessibility review." />

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-bold">Authority</h2>
          <div className="mb-3 flex flex-wrap gap-2"><TrustBadge lane="exact" /><TrustBadge lane="gemini" /><TrustBadge lane="owner" /><EnvironmentBadge environment="local" /><ReleaseStamp sha="c585801adc00b843" /></div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Metrics</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Settled exactly" value="48,402" detail="97.3% of unique rows" icon={Activity} tone="exact" />
            <Metric label="Gemini residue" value="1,354" detail="Bounded rows only" icon={Boxes} tone="gemini" />
            <Metric label="Owner decisions" value="3" detail="Consequential ambiguity" icon={ClipboardCheck} tone="owner" />
            <Metric label="Paid revenue" value={<KshValue value={126450} />} detail="Integer KSh from books" icon={Banknote} />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Status timeline</CardTitle><CardDescription>Text and icon make state independent of color.</CardDescription></CardHeader>
            <CardContent><StatusTimeline items={[
              { title: "Statement normalized", detail: "Duplicate references removed before matching.", status: "complete", meta: "00:14" },
              { title: "Residue batch 2 of 4", detail: "Gemini is bounded to 25 rows.", status: "current", meta: "00:18" },
              { title: "Owner queue persisted", status: "pending" },
            ]} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Progressive proof</CardTitle><CardDescription>Outcome first, evidence on demand.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <ProofSheet title="Night run proof" description="The execution receipt behind this visible outcome." outcome="48,402 rows matched exactly." reason="Reference, amount and chronological invariants matched without model judgment." facts={[{ label: "Run ID", value: "night_demo_001" }, { label: "Release", value: "c585801adc00" }]} sources={[{ label: "Run receipt", detail: "Local deterministic rehearsal artifact", state: "proven" }, { label: "Cloud Trace", detail: "Available only after approved deployment", state: "pending" }]} limitations={["This gallery does not prove a cloud execution."]} />
              <EvidenceSource label="Fixture manifest" detail="Google-only bilingual release assets" state="pending" />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Expected states</h2>
          <DegradedBanner title="Memory recall unavailable" description="The order path remains available; no memory-derived action is claimed." requestId="demo-request" />
          <div className="grid gap-3 xl:grid-cols-3">
            <EmptyState title="The queue is clear" description="No consequential ambiguity is waiting for the owner." action={<Button variant="outline">View the brief</Button>} />
            <PendingState title="Waiting for Google media" description="Release remains closed until English and Kiswahili fixtures pass integrity checks." />
            <FailureState title="Validated read failed" description="No operational values were guessed." requestId="demo-request" />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Loading</h2>
          <PageSkeleton />
        </section>
      </div>
    </>
  );
}
