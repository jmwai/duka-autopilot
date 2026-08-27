"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, BrainCircuit, CheckCircle2, CircleDashed, Cloud, FileCheck2, GitBranch, Globe2, KeyRound, Route, ShieldCheck, TestTube2, TriangleAlert } from "lucide-react";

import { AuthorityRail } from "@/components/control-room/authority-rail";
import { Metric } from "@/components/control-room/metric";
import { PageHeader } from "@/components/control-room/page-header";
import { EnvironmentBadge, EvidenceSource, ReleaseStamp } from "@/components/control-room/proof-sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { frontendVersionSchema, type ReleaseEvidence } from "@/lib/api/contracts";
import { loadDemoFixtureManifest } from "@/lib/fixtures/demo";
import { LOCAL_BASELINE } from "@/lib/night-shift/night-shift";
import { cn } from "@/lib/utils";

function sourceState(state: "proven" | "pending" | "not_proven") {
  return state === "not_proven" ? "not-proven" as const : state;
}

function RuntimeNode({ icon: Icon, title, detail, state }: { icon: typeof Cloud; title: string; detail: string; state: "active" | "configured" | "pending" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3"><span className="grid size-9 place-items-center rounded-lg bg-muted"><Icon aria-hidden="true" className="size-4" /></span><Badge variant={state === "active" ? "exact" : state === "configured" ? "outline" : "attention"}>{state}</Badge></div>
      <p className="mt-4 text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

export function EvidenceWorkspace({ evidence }: { evidence: ReleaseEvidence }) {
  const fixtureQuery = useQuery({ queryKey: ["demo-fixture-manifest"], queryFn: loadDemoFixtureManifest, retry: false, staleTime: Number.POSITIVE_INFINITY });
  const webVersionQuery = useQuery({
    queryKey: ["frontend-version"],
    queryFn: async () => {
      const response = await fetch("/version", { cache: "no-store" });
      if (!response.ok) throw new Error("Frontend version is unavailable");
      return frontendVersionSchema.parse(await response.json());
    },
    retry: false,
  });
  const manifest = fixtureQuery.data;
  const webVersion = webVersionQuery.data;
  const immutableRelease = evidence.release.sha !== "local" && evidence.release.sha !== "unknown";
  const releasesAgree = Boolean(immutableRelease && webVersion && webVersion.release_sha === evidence.release.sha);
  const proven = evidence.artifacts.filter((artifact) => artifact.state === "proven").length;
  const pending = evidence.artifacts.filter((artifact) => artifact.state === "pending").length;
  const notProven = evidence.artifacts.filter((artifact) => artifact.state === "not_proven").length;
  const contextConfigured = evidence.runtime.managed_sessions_configured && evidence.runtime.memory_bank_configured;

  return (
    <>
      <PageHeader
        eyebrow="Judge-facing proof"
        title="How Duka worked"
        description="Release identity, ADK architecture, Google runtime, tests, evals, provenance, economics, and honest limitations—missing proof stays visible."
        action={<div className="flex flex-wrap gap-2"><EnvironmentBadge environment={evidence.release.environment} /><ReleaseStamp sha={evidence.release.sha} /></div>}
      />

      <section className="paper-noise mb-5 overflow-hidden rounded-2xl bg-sidebar p-5 text-sidebar-foreground sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><Badge className="border-white/15 bg-white/10 text-white"><ShieldCheck aria-hidden="true" className="size-3.5" /> Evidence fails closed</Badge><h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Proof belongs to the exact release a judge can use.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-sidebar-muted">An artifact is green only when its HTTPS evidence link is bound to the running release SHA. Missing, malformed, local-only, or cross-release evidence remains Pending or Not proven.</p></div>
          <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="numeric text-2xl font-bold text-emerald-300">{proven}</p><p className="text-[0.65rem] text-sidebar-muted">proven</p></div><div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="numeric text-2xl font-bold text-amber-200">{pending}</p><p className="text-[0.65rem] text-sidebar-muted">pending</p></div><div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="numeric text-2xl font-bold text-red-200">{notProven}</p><p className="text-[0.65rem] text-sidebar-muted">not proven</p></div></div>
        </div>
      </section>

      <AuthorityRail className="mb-6" steps={[
        { lane: "exact", title: "Deterministic invariants", detail: "Screening, routing, catalog grounding, idempotency, exact reconciliation, and hard cost bounds." },
        { lane: "gemini", title: "Bounded interpretation", detail: `${evidence.model.name} on Google Vertex AI interprets messy voice, images, and residue.` },
        { lane: "owner", title: "Consequential authority", detail: "Refund, fuzzy payment, doubtful ledger, and restock effects stop in one durable queue." },
      ]} />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="ADK graph" value={`${evidence.topology.node_count} nodes`} detail={`${evidence.topology.edge_count} explicit edges`} icon={GitBranch} tone={evidence.topology.compatible ? "exact" : "owner"} />
        <Metric label="Release artifacts" value={`${proven}/${evidence.artifacts.length}`} detail="Bound to this release" icon={FileCheck2} tone={proven === evidence.artifacts.length ? "exact" : "owner"} />
        <Metric label="Generated media" value={manifest?.release_ready ? "4 verified" : "Pending"} detail="English + Kiswahili voice and ledger" icon={Boxes} tone={manifest?.release_ready ? "exact" : "owner"} />
        <Metric label="Historical exact rate" value="97.28%" detail="Local synthetic baseline, not cloud" icon={TestTube2} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Public/private Google Cloud shape</CardTitle><CardDescription>Runtime configuration is distinct from immutable deployment proof.</CardDescription></CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <RuntimeNode icon={Globe2} title="Public Next.js web" detail={webVersion ? `${webVersion.runtime} · ${webVersion.environment}` : "Runtime identity pending"} state={webVersion ? "active" : "pending"} />
                <RuntimeNode icon={Cloud} title="Private FastAPI + ADK" detail={evidence.release.api_revision ?? "Cloud Run revision pending"} state={evidence.release.api_revision ? "active" : "pending"} />
                <RuntimeNode icon={Route} title="Event and job surfaces" detail={`${evidence.runtime.bus} bus · nightly Job evidence is separate`} state={evidence.runtime.bus === "pubsub" ? "configured" : "pending"} />
                <RuntimeNode icon={Boxes} title="Operational store" detail={`${evidence.runtime.store} selected by the running API`} state={evidence.runtime.store === "firestore" ? "configured" : "pending"} />
                <RuntimeNode icon={BrainCircuit} title="Sessions + Memory Bank" detail="One protected Agent Platform context; memory remains advisory" state={contextConfigured ? "configured" : "pending"} />
                <RuntimeNode icon={KeyRound} title="WIF and least privilege" detail="Proven only by the release-bound IAM artifact" state={evidence.artifacts.find((artifact) => artifact.key === "iam")?.state === "proven" ? "configured" : "pending"} />
              </div>
              <div className="mt-4 rounded-xl border bg-muted/30 p-4 text-sm leading-6"><span className="font-semibold">Browser → public web → signed private API → Firestore / Pub/Sub / Vertex / managed context.</span> The browser never receives a private service identity token.</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>ADK topology identity</CardTitle><CardDescription>A topology fingerprint protects durable sessions and resumable invocations across releases.</CardDescription></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Workflow</p><p className="mt-1 font-mono text-xs font-semibold">{evidence.topology.workflow_name}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">ADK</p><p className="mt-1 font-mono text-xs font-semibold">{evidence.topology.adk_version}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Compatibility</p><p className={cn("mt-1 text-sm font-semibold", evidence.topology.compatible ? "text-exact" : "text-conflict")}>{evidence.topology.compatible ? "Compatible" : "Blocked"}</p></div></div>
              <p className="mt-3 break-all font-mono text-[0.68rem] text-muted-foreground">{evidence.topology.fingerprint}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">{evidence.topology.nodes.map((node) => <Badge key={node} variant="outline" className="font-mono text-[0.65rem]">{node}</Badge>)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Release-bound artifacts</CardTitle><CardDescription>Unit tests are not presented as ADK evaluations; local evidence is not presented as cloud proof.</CardDescription></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {evidence.artifacts.map((artifact) => <EvidenceSource key={artifact.key} label={artifact.label} detail={artifact.detail} state={sourceState(artifact.state)} href={artifact.url ?? undefined} />)}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Release identity</CardTitle><CardDescription>Web and API must agree before promotion proof turns green.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <EvidenceSource label="Web/API release agreement" detail={webVersion ? `Web ${webVersion.release_sha} · API ${evidence.release.sha}` : "Frontend version read pending"} state={releasesAgree ? "proven" : immutableRelease && webVersion ? "not-proven" : "pending"} />
              <EvidenceSource label="Backend image digest" detail={evidence.release.backend_image_digest ?? "Not attached to the runtime response"} state={evidence.release.backend_image_digest ? "proven" : "pending"} />
              <EvidenceSource label="Google model" detail={`${evidence.model.provider} · ${evidence.model.name} · ${evidence.model.location}`} state="proven" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Bilingual multimodal provenance</CardTitle><CardDescription>English and Kiswahili variants are required for both voice and ledger.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {fixtureQuery.isError ? <EvidenceSource label="Fixture manifest" detail="Manifest could not be validated" state="not-proven" /> : !manifest?.release_ready ? <EvidenceSource label="Google-only fixture set" detail={manifest?.blocked_reason ?? "Manifest is loading or release assets are pending"} state="pending" /> : <>
                {manifest.ledgers.map((fixture) => <EvidenceSource key={fixture.id} label={`${fixture.language === "en-KE" ? "English" : "Kiswahili"} ledger`} detail={`Google Vertex AI · ${fixture.source.model} · ${fixture.sha256.slice(0, 16)}…`} state="proven" />)}
                {manifest.voices.map((fixture) => <EvidenceSource key={fixture.id} label={`${fixture.language === "en-KE" ? "English" : "Kiswahili"} voice`} detail={`${fixture.source.provider} · ${fixture.source.provider === "google_cloud_text_to_speech" ? fixture.source.model : "consented first-party"} · ${fixture.sha256.slice(0, 16)}…`} state="proven" />)}
              </>}
            </CardContent>
          </Card>

          <Card className="border-owner/35">
            <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>Historical local benchmark</CardTitle><CardDescription>Useful engineering evidence with an explicit claim boundary.</CardDescription></div><Badge variant="attention">Local · dirty worktree</Badge></div></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-muted/50 p-3"><p className="numeric text-lg font-bold">{LOCAL_BASELINE.totalConsidered.toLocaleString()}</p><p className="text-[0.65rem] text-muted-foreground">rows</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="numeric text-lg font-bold text-exact">{LOCAL_BASELINE.exactMatched.toLocaleString()}</p><p className="text-[0.65rem] text-muted-foreground">exact</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="numeric text-lg font-bold">812 ms</p><p className="text-[0.65rem] text-muted-foreground">local</p></div></div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">SQLite/macOS · fuzzy disabled · model cost not measured · SHA {LOCAL_BASELINE.releaseSha.slice(0, 12)}. This is not Cloud Run, Firestore, or current-release economics.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Disclosures and limits</CardTitle><CardDescription>Credibility is part of the architecture.</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm leading-6">
              {Object.entries(evidence.disclosures).map(([key, value]) => <div key={key} className="flex gap-3"><span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-muted">{key === "external_effects" ? <TriangleAlert aria-hidden="true" className="size-3" /> : key === "pre_existing_work" ? <GitBranch aria-hidden="true" className="size-3" /> : key === "media_policy" ? <CheckCircle2 aria-hidden="true" className="size-3 text-exact" /> : <CircleDashed aria-hidden="true" className="size-3" />}</span><p><span className="font-semibold">{key.replaceAll("_", " ")}:</span> <span className="text-muted-foreground">{value}</span></p></div>)}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
