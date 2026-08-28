"use client";

import { AlertTriangle, ArrowDownUp, Ban, ChevronLeft, ChevronRight, CircleCheck, CirclePlus, LoaderCircle, PackageOpen, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { KshValue, Metric } from "@/components/control-room/metric";
import { PageHeader } from "@/components/control-room/page-header";
import { EmptyState } from "@/components/control-room/product-states";
import { EvidenceSource } from "@/components/control-room/proof-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BrowserApiError, browserApi } from "@/lib/api/browser-client";
import { createOrderResponseSchema, orderDecisionResponseSchema, ordersSchema, type Order } from "@/lib/api/contracts";
import type { OrdersData } from "@/lib/api/orders";

const PAGE_SIZE = 12;

// The stored status stays `pending_confirmation` - reconciliation queries and
// the durable topology depend on it. Only the owner-facing wording changes:
// the order is waiting on the customer's payment, not on a click.
const STATUS_LABELS: Record<string, string> = {
  pending_confirmation: "Awaiting payment",
  needs_review: "Needs review",
  confirmed: "Confirmed",
  rejected: "Cancelled",
  paid: "Paid",
};

function statusLabel(status: string) {
  return STATUS_LABELS[status]
    ?? status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusBadge(status: string) {
  if (status === "paid") return <Badge variant="exact">{statusLabel(status)}</Badge>;
  if (status === "needs_review" || status === "pending_confirmation") return <Badge variant="attention">{statusLabel(status)}</Badge>;
  return <Badge variant="outline">{statusLabel(status)}</Badge>;
}

function dateLabel(value?: string) {
  if (!value) return "Time unavailable";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }).format(date);
}

function OrderDecision({ order, onDecided }: { order: Order; onDecided: () => void }) {
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  // One event ID per order decision, reused across retries so a lost response
  // cannot produce a second effect.
  const [eventId] = useState(() => `decision-${crypto.randomUUID().replaceAll("-", "")}`);

  if (order.status !== "pending_confirmation") return null;

  async function decide(decision: "confirm" | "cancel") {
    setBusy(decision);
    try {
      const result = await browserApi("orders/" + order.id + "/decision", orderDecisionResponseSchema, {
        method: "POST",
        body: JSON.stringify({ event_id: eventId, decision }),
      });
      toast.success(result.status === "confirmed"
        ? `Order #${order.id} confirmed. No payment was recorded.`
        : `Order #${order.id} cancelled.`);
      onDecided();
    } catch (error) {
      toast.error(error instanceof BrowserApiError ? error.message : "The decision could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div>
        <h3 className="text-sm font-semibold">Owner decision</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Confirming records that the order stands. It does not mark it paid — that follows the payment.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" disabled={Boolean(busy)} onClick={() => void decide("confirm")}>
          {busy === "confirm" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <CircleCheck aria-hidden="true" />}
          Confirm order
        </Button>
        <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void decide("cancel")}>
          {busy === "cancel" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Ban aria-hidden="true" />}
          Cancel order
        </Button>
      </div>
    </section>
  );
}

function OrderDetail({ order, onDecided }: { order: Order; onDecided: () => void }) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-muted/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-semibold">{order.customer_name ?? "Customer"}</p><p className="mt-1 font-mono text-xs text-muted-foreground">Order #{order.id}</p></div>
          {statusBadge(order.status)}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{dateLabel(order.created_at)}</p>
      </section>

      <OrderDecision order={order} onDecided={onDecided} />

      <section>
        <h3 className="text-sm font-semibold">Grounded line items</h3>
        <div className="mt-3 space-y-2">
          {order.items.map((item, index) => (
            <div key={`${item.sku ?? item.name}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border bg-background p-3 text-sm">
              <div><p className="font-medium">{item.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{item.qty} × <KshValue value={item.unit_price} /></p></div>
              <KshValue value={item.qty * item.unit_price} className="font-semibold" />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-3"><span className="text-sm font-semibold">Total</span><KshValue value={order.total} className="text-lg font-bold" /></div>
      </section>

      {order.notes ? <section><h3 className="text-sm font-semibold">Order note</h3><p className="mt-2 rounded-lg bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">{order.notes}</p></section> : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Evidence</h3>
        <EvidenceSource label="Catalog-derived price" detail="The authoritative backend re-read SKU, name, and current integer KSh price before persistence." state="proven" />
        <EvidenceSource
          label="Source event correlation"
          detail={order.source_event_id ? `Inbound event ${order.source_event_id}` : "This manual or seeded order has no inbound event correlation."}
          state={order.source_event_id ? "proven" : "pending"}
          href={order.source_event_id ? `/inbox?customer=${encodeURIComponent(order.customer_id)}&event=${encodeURIComponent(order.source_event_id)}` : undefined}
        />
        <EvidenceSource label="External payment effect" detail="None. Paid is an internal bookkeeping status; no transfer was initiated." state="proven" />
        <EvidenceSource label="Release evidence" detail="Inspect the release-bound architecture, artifacts, and causal trace behind this runtime." state="pending" href="/evidence#trace" />
      </section>
    </div>
  );
}

type SaleLine = { id: string; sku: string; qty: number };

function ManualSaleDialog({ open, onOpenChange, data, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; data: OrdersData; onCreated: (orderId: string) => Promise<void> }) {
  const [customerId, setCustomerId] = useState(data.customers[0]?.id ?? "");
  const [lines, setLines] = useState<SaleLine[]>([{ id: crypto.randomUUID(), sku: data.products[0]?.sku ?? "", qty: 1 }]);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [eventId, setEventId] = useState(() => `sale-${crypto.randomUUID().replaceAll("-", "")}`);
  const [failure, setFailure] = useState<{ message: string; requestId?: string } | null>(null);
  const catalog = useMemo(() => new Map(data.products.map((product) => [product.sku, product])), [data.products]);
  const previewTotal = lines.reduce((total, line) => total + (catalog.get(line.sku)?.unit_price ?? 0) * Math.max(0, line.qty), 0);

  function updateLine(id: string, patch: Partial<SaleLine>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
    resetAttemptIdentity();
  }

  function resetAttemptIdentity() {
    setEventId(`sale-${crypto.randomUUID().replaceAll("-", "")}`);
    setFailure(null);
  }

  function addLine() {
    const used = new Set(lines.map((line) => line.sku));
    const next = data.products.find((product) => !used.has(product.sku));
    if (!next) return toast.error("Every catalog product is already in this sale.");
    setLines((current) => [...current, { id: crypto.randomUUID(), sku: next.sku, qty: 1 }]);
    resetAttemptIdentity();
  }

  async function submit() {
    if (busy || !customerId || !lines.length) return;
    if (lines.some((line) => !line.sku || !Number.isInteger(line.qty) || line.qty <= 0)) return toast.error("Every item needs a positive whole-number quantity.");
    if (new Set(lines.map((line) => line.sku)).size !== lines.length) return toast.error("Combine duplicate products into one line.");
    setBusy(true);
    setFailure(null);
    try {
      const result = await browserApi("orders", createOrderResponseSchema, {
        method: "POST",
        body: JSON.stringify({ event_id: eventId, customer_id: customerId, items: lines.map(({ sku, qty }) => ({ sku, qty })), paid }),
      });
      await onCreated(result.order_id);
      onOpenChange(false);
      setPaid(false);
      setLines([{ id: crypto.randomUUID(), sku: data.products[0]?.sku ?? "", qty: 1 }]);
      setEventId(`sale-${crypto.randomUUID().replaceAll("-", "")}`);
      toast.success(`Order #${result.order_id} recorded exactly once from current catalog prices${result.idempotent ? " (safe replay)" : ""}.`);
    } catch (error) {
      setFailure({
        message: error instanceof BrowserApiError ? error.message : "The sale could not be recorded.",
        requestId: error instanceof BrowserApiError ? error.requestId : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-h-[92svh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Record a catalog-grounded sale</DialogTitle><DialogDescription>Choose SKUs and quantities only. The backend re-derives every name and integer KSh price from the current catalog.</DialogDescription></DialogHeader>
        <div className="space-y-5">
          <label className="block text-sm font-semibold">Customer
            <select value={customerId} onChange={(event) => { setCustomerId(event.target.value); resetAttemptIdentity(); }} className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>

          <fieldset className="space-y-3"><legend className="text-sm font-semibold">Items</legend>
            {lines.map((line, index) => {
              const product = catalog.get(line.sku);
              return (
                <div key={line.id} className="grid gap-2 rounded-xl border bg-muted/25 p-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
                  <label className="text-xs font-semibold">Product
                    <select value={line.sku} onChange={(event) => updateLine(line.id, { sku: event.target.value })} className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      {data.products.map((item) => <option key={item.sku} value={item.sku}>{item.name} · KSh {item.unit_price}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold">Quantity
                    <Input type="number" min={1} max={10000} step={1} value={line.qty} onChange={(event) => updateLine(line.id, { qty: Number(event.target.value) })} className="mt-1" />
                  </label>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${index + 1}`} disabled={lines.length === 1} onClick={() => { setLines((current) => current.filter((candidate) => candidate.id !== line.id)); resetAttemptIdentity(); }}><Trash2 aria-hidden="true" /></Button>
                  <p className="text-xs text-muted-foreground sm:col-span-3">{product ? `${product.stock} in stock · ${product.unit}` : "Unknown product"}</p>
                </div>
              );
            })}
            <Button type="button" variant="outline" onClick={addLine}><Plus aria-hidden="true" /> Add item</Button>
          </fieldset>

          <label className="flex min-h-11 items-center gap-3 rounded-lg border bg-background px-3 text-sm"><input type="checkbox" checked={paid} onChange={(event) => { setPaid(event.target.checked); resetAttemptIdentity(); }} className="size-4 accent-primary" /><span><span className="font-semibold">Mark paid in the books</span><span className="block text-xs text-muted-foreground">No external payment is initiated.</span></span></label>
          <div className="flex items-center justify-between rounded-xl bg-sidebar p-4 text-sidebar-foreground"><span className="text-sm font-semibold">Preview total</span><KshValue value={previewTotal} className="text-xl font-bold" /></div>
          {failure ? (
            <div role="alert" className="flex gap-3 rounded-xl border border-conflict/35 bg-conflict/5 p-4 text-sm leading-6">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-conflict" />
              <div><p className="font-semibold">The sale result could not be confirmed.</p><p className="text-muted-foreground">{failure.message} Retrying this unchanged draft reuses sale event {eventId.slice(0, 16)}…; the backend returns the original result instead of creating a second order.</p>{failure.requestId ? <p className="mt-1 font-mono text-[0.68rem] text-muted-foreground">Request {failure.requestId}</p> : null}</div>
            </div>
          ) : null}
          <p className="font-mono text-[0.68rem] text-muted-foreground">Sale event {eventId.slice(0, 20)}…</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" disabled={busy || !customerId || !lines.length} onClick={() => void submit()}>{busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ShoppingBag aria-hidden="true" />}{busy ? "Recording…" : "Record sale"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OrdersWorkspace({ data, initialOrderId }: { data: OrdersData; initialOrderId?: string }) {
  const [orders, setOrders] = useState(data.orders);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("attention");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Order | null>(
    () => data.orders.find((order) => order.id === initialOrderId) ?? null,
  );
  const [saleOpen, setSaleOpen] = useState(false);
  const statuses = useMemo(() => [...new Set(orders.map((order) => order.status))].sort(), [orders]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = orders.filter((order) => (
      (status === "all" || order.status === status)
      && (!needle || [order.id, order.customer_name, order.status, ...order.items.map((item) => item.name)].filter(Boolean).join(" ").toLowerCase().includes(needle))
    ));
    const attention = (order: Order) => order.needs_review || ["needs_review", "pending_confirmation"].includes(order.status) ? 1 : 0;
    return [...filtered].sort((a, b) => sort === "amount"
      ? b.total - a.total
      : sort === "oldest"
        ? String(a.created_at).localeCompare(String(b.created_at))
        : sort === "attention"
          ? attention(b) - attention(a) || String(b.created_at).localeCompare(String(a.created_at))
          : String(b.created_at).localeCompare(String(a.created_at)));
  }, [orders, query, sort, status]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageOrders = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const paidOrders = orders.filter((order) => order.status === "paid");
  const reviewOrders = orders.filter((order) => order.needs_review || ["needs_review", "pending_confirmation"].includes(order.status));
  const paidRevenue = paidOrders.reduce((sum, order) => sum + order.total, 0);

  async function refreshOrders(orderId?: string) {
    const refreshed = await browserApi("orders", ordersSchema);
    setOrders(refreshed);
    if (orderId) setSelected(refreshed.find((order) => order.id === orderId) ?? null);
    setPage(1);
  }

  return (
    <>
      <PageHeader eyebrow="Business truth" title="Orders" description="Grounded sales with catalog-derived names, current prices, positive quantities, and integer KSh totals." action={<Button onClick={() => setSaleOpen(true)}><CirclePlus aria-hidden="true" /> Record sale</Button>} />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Needs attention" value={reviewOrders.length.toLocaleString()} detail="Shown first by default" icon={AlertTriangle} tone="owner" />
        <Metric label="Recent orders" value={orders.length.toLocaleString()} detail="Latest 100 validated records" icon={PackageOpen} />
        <Metric label="Marked paid" value={paidOrders.length.toLocaleString()} detail="Internal bookkeeping status" icon={ShoppingBag} tone="exact" />
        <Metric label="Paid value" value={<KshValue value={paidRevenue} />} detail="No external transfer implied" icon={ArrowDownUp} />
      </section>

      <Card className="mb-5">
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_13rem_13rem]">
          <label className="relative"><span className="sr-only">Search orders</span><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Find order, customer, or item" className="pl-9" /></label>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by status" className="h-11 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><option value="all">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort orders" className="h-11 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><option value="attention">Needs attention first</option><option value="recent">Newest first</option><option value="oldest">Oldest first</option><option value="amount">Highest value</option></select>
        </CardContent>
      </Card>

      {pageOrders.length ? (
        <>
          <div className="space-y-3 lg:hidden">
            {pageOrders.map((order) => <button key={order.id} type="button" onClick={() => setSelected(order)} className="w-full rounded-xl border bg-card p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{order.customer_name ?? "Customer"}</p><p className="mt-1 font-mono text-xs text-muted-foreground">Order #{order.id}</p></div>{statusBadge(order.status)}</div><div className="mt-4 flex items-end justify-between gap-3"><p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{order.items.map((item) => `${item.qty}× ${item.name}`).join(" · ")}</p><KshValue value={order.total} className="font-bold" /></div></button>)}
          </div>
          <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
            <table className="w-full border-collapse text-left text-sm"><thead className="bg-muted/60 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Order</th><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Items</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Total</th></tr></thead><tbody>{pageOrders.map((order) => <tr key={order.id} onClick={() => setSelected(order)} className="cursor-pointer border-t hover:bg-muted/35"><td className="px-4 py-4"><p className="font-mono text-xs font-semibold">#{order.id}</p><p className="mt-1 text-xs text-muted-foreground">{dateLabel(order.created_at)}</p></td><td className="px-4 py-4 font-medium">{order.customer_name ?? "Customer"}</td><td className="max-w-sm px-4 py-4 text-xs leading-5 text-muted-foreground">{order.items.map((item) => `${item.qty}× ${item.name}`).join(" · ")}</td><td className="px-4 py-4">{statusBadge(order.status)}</td><td className="px-4 py-4 text-right"><KshValue value={order.total} className="font-semibold" /></td></tr>)}</tbody></table>
          </div>
          <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-muted-foreground">Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, visible.length)} of {visible.length}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft aria-hidden="true" /> Previous</Button><Button variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next <ChevronRight aria-hidden="true" /></Button></div></div>
        </>
      ) : <EmptyState title="No orders match" description="Clear the search or status filter, or record a catalog-grounded sale." action={<Button variant="outline" onClick={() => { setQuery(""); setStatus("all"); setPage(1); }}>Clear filters</Button>} />}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}><SheetContent side="right" className="w-[min(96vw,34rem)] overflow-y-auto"><SheetHeader><SheetTitle>Order details</SheetTitle><SheetDescription>Grounded items, status, effect boundary, and available evidence.</SheetDescription></SheetHeader>{selected ? <OrderDetail order={selected} onDecided={() => { setSelected(null); void refreshOrders(); }} /> : null}</SheetContent></Sheet>
      <ManualSaleDialog open={saleOpen} onOpenChange={setSaleOpen} data={data} onCreated={refreshOrders} />
      <p className="mt-7 text-center text-xs text-muted-foreground">Names and prices are re-derived by the backend. “Paid” records an internal status only.</p>
    </>
  );
}
