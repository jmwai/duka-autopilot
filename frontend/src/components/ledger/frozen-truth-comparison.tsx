import { CheckCircle2, FileCheck2, TriangleAlert } from "lucide-react";

import { PendingState } from "@/components/control-room/product-states";
import { ProofSheet } from "@/components/control-room/proof-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LedgerResult } from "@/lib/api/contracts";
import type { DemoLedgerFixture } from "@/lib/fixtures/demo";
import { formatKsh } from "@/lib/format/money";
import { formatMediaBytes } from "@/lib/inbox/media";
import { compareFrozenTruth } from "@/lib/ledger/ledger";

export function FrozenTruthComparison({ fixture, observed, blockedReason }: {
  fixture: DemoLedgerFixture | null;
  observed?: LedgerResult | null;
  blockedReason?: string;
}) {
  if (!fixture) {
    return (
      <PendingState
        title="Verified bilingual fixtures are pending"
        description={blockedReason ?? "Wait until both Google-generated English and Kiswahili release fixtures pass integrity checks before presenting a frozen expected result."}
      />
    );
  }

  const expectedRecords = fixture.ground_truth.rows.filter((row) => row.expected_action === "record").length;
  const expectedGates = fixture.ground_truth.rows.length - expectedRecords;
  const comparison = observed ? compareFrozenTruth(observed, fixture) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-gemini">Before the model runs</p>
            <CardTitle className="mt-1">Frozen ground truth</CardTitle>
            <CardDescription>{fixture.label} · expected outcome, never inferred from model prose.</CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant="outline">{fixture.language === "en-KE" ? "English" : "Kiswahili"}</Badge>
            <Badge variant="outline"><FileCheck2 aria-hidden="true" className="size-3.5" /> Google · synthetic</Badge>
            <ProofSheet
              title={`${fixture.label} provenance`}
              description="Frozen source, integrity, and reviewed expected truth for this release ledger."
              outcome={`${expectedRecords} rows must record and ${expectedGates} unreadable row${expectedGates === 1 ? "" : "s"} must stop for owner review.`}
              reason="The image is admitted only after its byte count and SHA-256 match the manifest. Frozen truth is reviewed independently from the observed model result."
              facts={[
                { label: "Language", value: fixture.language },
                { label: "Provider", value: fixture.source.provider },
                { label: "Model", value: fixture.source.model },
                { label: "Location", value: fixture.source.location },
                { label: "SHA-256", value: fixture.sha256 },
                { label: "Prompt SHA-256", value: fixture.source.prompt_sha256 },
              ]}
              sources={[
                { label: "Google Vertex AI image", detail: `${fixture.source.model} · ${fixture.source.location}`, state: "proven" },
                { label: "Release integrity", detail: `${formatMediaBytes(fixture.bytes)} · ${fixture.width}×${fixture.height}`, state: "proven" },
                { label: "Reviewed ground truth", detail: `${expectedRecords} record · ${expectedGates} gate`, state: "proven" },
              ]}
              limitations={["Synthetic media is used for privacy and known ground truth.", "Source integrity does not by itself prove extraction accuracy; observed truth is compared separately."]}
              trigger={<Button type="button" size="sm" variant="ghost">Provenance</Button>}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {comparison ? (
          <div className={`mb-4 flex gap-3 rounded-xl border p-4 text-sm leading-6 ${comparison.matches ? "border-exact/30 bg-exact/10" : "border-conflict/35 bg-conflict/5"}`}>
            {comparison.matches
              ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-exact" />
              : <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-conflict" />}
            <div>
              <p className="font-semibold">{comparison.matches ? "Observed tool receipt matches frozen truth" : "Observed tool receipt differs from frozen truth"}</p>
              <p className="text-xs text-muted-foreground">Compared by row index, expected action, exact integer KSh amount, and paid state—not by agent summary prose.</p>
            </div>
          </div>
        ) : null}
        {fixture.ground_truth.rows.map((row, index) => (
          <div key={`${index}-${row.description}`} className="grid gap-3 rounded-lg border bg-background p-3 text-sm sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
            <span className="numeric hidden size-7 place-items-center rounded-full bg-muted text-xs font-bold sm:grid">{index + 1}</span>
            <div>
              <p className="font-semibold">{row.description} · qty {row.quantity}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{row.expected_action === "record" ? "Legible, positive amount" : row.issue ?? "Amount unreadable · no value may be guessed"}</p>
              {comparison ? (
                <p className={`mt-1 text-xs font-semibold ${comparison.rows[index].matches ? "text-exact" : "text-conflict"}`}>
                  {comparison.rows[index].matches
                    ? `Observed: ${comparison.rows[index].observed?.outcome} · ${comparison.rows[index].observed?.amount === null ? "amount blank" : formatKsh(comparison.rows[index].observed?.amount ?? 0)}`
                    : "Observed row does not match the frozen business outcome"}
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
              <Badge variant={row.expected_action === "record" ? "exact" : "attention"}>{row.expected_action === "record" ? "Record" : "Gate"}</Badge>
              <p className="numeric text-xs font-semibold sm:mt-1">{row.amount_ksh === null ? "—" : formatKsh(row.amount_ksh)}</p>
            </div>
          </div>
        ))}
        <p className="pt-1 font-mono text-[0.66rem] leading-5 text-muted-foreground">SHA-256 {fixture.sha256.slice(0, 16)}… · {fixture.width}×{fixture.height} · {formatMediaBytes(fixture.bytes)} · {fixture.source.model} · {fixture.source.location}</p>
      </CardContent>
    </Card>
  );
}
