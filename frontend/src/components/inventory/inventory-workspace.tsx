"use client";

import { ArrowRight, Boxes, ClipboardCheck, LoaderCircle, PackageCheck, RefreshCw, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { KshValue, Metric } from "@/components/control-room/metric";
import { PageHeader } from "@/components/control-room/page-header";
import { EmptyState } from "@/components/control-room/product-states";
import { ProofSheet } from "@/components/control-room/proof-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { approvalsSchema, inventorySchema, restockCheckSchema, type Approval, type InventoryItem } from "@/lib/api/contracts";
import { BrowserApiError, browserApi } from "@/lib/api/browser-client";
import type { InventoryData } from "@/lib/api/inventory";
import { cn } from "@/lib/utils";

function StockBar({ item }: { item: InventoryItem }) {
  const percentage = item.target_stock ? Math.min(100, Math.max(0, item.stock / item.target_stock * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">Shelf level</span><span className="numeric font-mono font-semibold">{item.stock} / {item.target_stock}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${item.name} stock level`} aria-valuemin={0} aria-valuemax={item.target_stock} aria-valuenow={Math.max(0, item.stock)}><div className={cn("h-full rounded-full", item.low ? "bg-owner" : "bg-exact")} style={{ width: `${percentage}%` }} /></div>
    </div>
  );
}

function LowStockCard({ item }: { item: InventoryItem }) {
  return (
    <Card className="border-owner/35">
      <CardHeader>
        <div className="flex items-start justify-between gap-3"><div><CardTitle>{item.name}</CardTitle><CardDescription className="mt-1 font-mono">{item.sku}</CardDescription></div><Badge variant="attention">{item.stock} left</Badge></div>
      </CardHeader>
      <CardContent className="space-y-4">
        <StockBar item={item} />
        <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Reorder point</p><p className="numeric mt-1 font-semibold">≤ {item.reorder_point}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Draft quantity</p><p className="numeric mt-1 font-semibold">{item.suggested_qty} {item.unit}</p></div></div>
        <ProofSheet
          title={`${item.name} restock evidence`}
          description="Deterministic shelf arithmetic behind this draft suggestion."
          outcome={`${item.stock} ${item.unit} remain; the policy suggests ${item.suggested_qty} to reach ${item.target_stock}.`}
          reason={`Stock at or below ${item.reorder_point} enters one consolidated owner-reviewed restock draft. No model chooses the threshold or quantity.`}
          facts={[{ label: "SKU", value: item.sku }, { label: "Current stock", value: item.stock }, { label: "Reorder point", value: item.reorder_point }, { label: "Target stock", value: item.target_stock }, { label: "Unit price", value: <KshValue value={item.unit_price} /> }]}
          sources={[{ label: "Validated inventory API", detail: "Current catalog stock and deterministic policy constants", state: "proven" }, { label: "Supplier integration", detail: "No supplier API is configured", state: "not-proven" }]}
          limitations={["Accepting a restock draft does not place a supplier order.", "Stock is not adjusted until a separate real-world receipt is recorded."]}
        />
      </CardContent>
    </Card>
  );
}

export function InventoryWorkspace({ data }: { data: InventoryData }) {
  const [inventory, setInventory] = useState(data.inventory);
  const [approvals, setApprovals] = useState<Approval[]>(data.approvals);
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ message: string; requestId?: string } | null>(null);
  const low = inventory.filter((item) => item.low).sort((a, b) => a.stock - b.stock);
  const pendingRestock = approvals.find((approval) => approval.kind === "restock_proposal") ?? null;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inventory.filter((item) => !needle || `${item.sku} ${item.name} ${item.unit}`.toLowerCase().includes(needle));
  }, [inventory, query]);
  const catalogValue = inventory.reduce((total, item) => total + Math.max(0, item.stock) * item.unit_price, 0);

  async function refresh() {
    const [nextInventory, nextApprovals] = await Promise.all([browserApi("inventory", inventorySchema), browserApi("approvals", approvalsSchema)]);
    setInventory(nextInventory);
    setApprovals(nextApprovals);
  }

  async function runScan() {
    if (scanning) return;
    setScanning(true);
    setOutcome(null);
    setFailure(null);
    try {
      const result = await browserApi("restock/check", restockCheckSchema, { method: "POST", body: "{}" });
      await refresh();
      setOutcome(result.proposed
        ? `One owner-reviewed draft was created for ${result.low.length} low-stock item${result.low.length === 1 ? "" : "s"}. No supplier order was placed.`
        : result.skipped_pending
          ? "A restock draft is already pending. The scan created no duplicate and placed no supplier order."
          : "No catalog item crossed the deterministic reorder point. No draft was created.");
    } catch (error) {
      setFailure({
        message: error instanceof BrowserApiError ? error.message : "The shelf scan did not complete.",
        requestId: error instanceof BrowserApiError ? error.requestId : undefined,
      });
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Shelf signal" title="Stock" description="Actionable low-stock evidence first, with deterministic quantities that remain owner-reviewed internal drafts." action={<Button onClick={() => void runScan()} disabled={scanning}>{scanning ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}{scanning ? "Scanning shelves…" : "Run shelf scan"}</Button>} />

      {outcome ? <div role="status" className="mb-5 flex gap-3 rounded-xl border border-exact/30 bg-exact/10 p-4 text-sm leading-6"><PackageCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-exact" /><p>{outcome}</p></div> : null}
      {failure ? <div role="alert" className="mb-5 flex flex-col gap-3 rounded-xl border border-conflict/35 bg-conflict/5 p-4 text-sm leading-6 sm:flex-row sm:items-center"><TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-conflict" /><div className="min-w-0 flex-1"><p className="font-semibold">The shelf scan did not complete.</p><p className="text-muted-foreground">{failure.message} The scan is idempotent: retrying cannot create a second pending restock draft or contact a supplier.</p>{failure.requestId ? <p className="mt-1 font-mono text-[0.68rem] text-muted-foreground">Request {failure.requestId}</p> : null}</div><Button type="button" variant="outline" onClick={() => void runScan()} disabled={scanning}><RefreshCw aria-hidden="true" /> Retry scan</Button></div> : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Low-stock items" value={low.length.toLocaleString()} detail={`At or below the backend policy threshold`} icon={TriangleAlert} tone="owner" />
        <Metric label="Catalog products" value={inventory.length.toLocaleString()} detail="Validated current stock records" icon={Boxes} />
        <Metric label="Shelf value" value={<KshValue value={catalogValue} />} detail="Current stock × catalog price" icon={PackageCheck} />
      </section>

      <Card className="mb-6 border-owner/35 bg-owner/5">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><ClipboardCheck aria-hidden="true" className="size-4" /><p className="text-sm font-semibold">{pendingRestock ? "One restock draft awaits the owner" : "No restock draft is waiting"}</p></div><p className="mt-1 text-xs leading-5 text-muted-foreground">The scan consolidates all low items into one idempotent proposal. It never contacts a supplier.</p></div>
          {pendingRestock ? <Button asChild variant="outline"><Link href="/approvals">Review draft <ArrowRight aria-hidden="true" /></Link></Button> : <Button variant="outline" onClick={() => void runScan()} disabled={scanning}>Create only if needed</Button>}
        </CardContent>
      </Card>

      <section className="mb-8">
        <div className="mb-3"><h2 className="text-lg font-bold">Needs attention</h2><p className="mt-1 text-sm text-muted-foreground">Lowest shelf levels first; every suggestion shows its arithmetic.</p></div>
        {low.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{low.map((item) => <LowStockCard key={item.sku} item={item} />)}</div> : <EmptyState title="Shelves are above the reorder point" description="The deterministic scan found no catalog item requiring an owner-reviewed draft." />}
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-bold">Full catalog</h2><p className="mt-1 text-sm text-muted-foreground">Current stock and integer KSh catalog truth.</p></div><label className="relative w-full sm:max-w-sm"><span className="sr-only">Search catalog</span><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find product or SKU" className="pl-9" /></label></div>
        {visible.length ? <div className="overflow-hidden rounded-xl border bg-card"><div className="grid divide-y">{visible.map((item) => <div key={item.sku} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_8rem_9rem_12rem] sm:items-center"><div><p className="font-semibold">{item.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{item.sku}</p></div><div><p className="text-xs text-muted-foreground">Unit price</p><KshValue value={item.unit_price} className="text-sm font-semibold" /></div><div><p className="text-xs text-muted-foreground">Stock</p><p className="numeric text-sm font-semibold">{item.stock} {item.unit}</p></div><div><StockBar item={item} /></div></div>)}</div></div> : <EmptyState title="No catalog item matches" description="Clear the search to return to the complete catalog." action={<Button variant="outline" onClick={() => setQuery("")}>Clear search</Button>} />}
      </section>

      <p className="mt-7 text-center text-xs text-muted-foreground">A restock action creates or reviews an internal draft only. No supplier order or payment is sent.</p>
    </>
  );
}
