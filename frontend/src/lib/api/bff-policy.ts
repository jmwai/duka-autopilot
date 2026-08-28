export type AllowedRoute = {
  upstreamPath: string;
  maxBytes: number;
};

const IDENTIFIER = /^[A-Za-z0-9_-]{1,200}$/;
const OPAQUE_ID = /^[A-Za-z0-9._~-]{1,200}$/;

const EXACT_GET = new Set([
  "version",
  "customers",
  "products",
  "inventory",
  "orders",
  "approvals",
  "recon/report",
  "recon/nightly/status",
  "digest/morning",
  "metrics/costs",
  "evidence/release",
]);

const EXACT_POST = new Set([
  "auth/login",
  "auth/logout",
  "chat",
  "inbound",
  "sessions/new",
  "orders",
  "ledger",
  "recon/run",
  "recon/exact",
  "recon/nightly",
  "recon/nightly/start",
  "restock/check",
  "memory/drain",
]);

export function matchBffRoute(method: string, rawSegments: string[]): AllowedRoute | null {
  if (!rawSegments.length || rawSegments.length > 3) return null;
  if (rawSegments.some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }

  const path = rawSegments.join("/");
  if (method === "GET" && EXACT_GET.has(path)) {
    return { upstreamPath: path, maxBytes: 0 };
  }
  if (method === "GET" && rawSegments.length === 2 && rawSegments[0] === "messages") {
    return IDENTIFIER.test(rawSegments[1])
      ? { upstreamPath: path, maxBytes: 0 }
      : null;
  }
  if (method === "POST" && EXACT_POST.has(path)) {
    const mediaRoute = path === "inbound" || path === "chat" || path === "ledger";
    return { upstreamPath: path, maxBytes: mediaRoute ? 10_000_000 : 64_000 };
  }
  if (method === "POST" && rawSegments.length === 2 && rawSegments[0] === "approvals") {
    return OPAQUE_ID.test(rawSegments[1])
      ? { upstreamPath: path, maxBytes: 8_000 }
      : null;
  }
  // orders/{id}/decision - the owner confirming or cancelling a proposed order.
  if (method === "POST" && rawSegments.length === 3
      && rawSegments[0] === "orders" && rawSegments[2] === "decision") {
    return IDENTIFIER.test(rawSegments[1])
      ? { upstreamPath: path, maxBytes: 8_000 }
      : null;
  }
  return null;
}

export function requestContentLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (raw === null) return null;
  if (!/^\d+$/.test(raw)) return Number.NaN;
  return Number(raw);
}

export function acceptedContentType(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.startsWith("application/json");
}
