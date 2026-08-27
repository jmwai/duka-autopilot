import { NextRequest, NextResponse } from "next/server";

import {
  acceptedContentType,
  matchBffRoute,
  requestContentLength,
} from "@/lib/api/bff-policy";
import { authorizationFor } from "@/lib/api/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

function jsonError(status: number, error: string, requestId: string) {
  return NextResponse.json({ error, request_id: requestId }, { status });
}

async function proxy(request: NextRequest, context: RouteContext) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const { path: segments } = await context.params;
  const route = matchBffRoute(request.method, segments);
  if (!route) return jsonError(404, "route is not exposed by the BFF", requestId);

  const target = process.env.DUKA_API_URL?.replace(/\/+$/, "");
  if (!target) return jsonError(503, "private API is not configured", requestId);

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET") {
    if (!acceptedContentType(request)) {
      return jsonError(415, "content type must be application/json", requestId);
    }
    const declaredLength = requestContentLength(request);
    if (declaredLength !== null && (!Number.isFinite(declaredLength) || declaredLength > route.maxBytes)) {
      return jsonError(413, "request body is too large", requestId);
    }
    body = await request.arrayBuffer();
    if (body.byteLength > route.maxBytes) {
      return jsonError(413, "request body is too large", requestId);
    }
  }

  const headers = new Headers({
    accept: "application/json",
    "x-request-id": requestId,
  });
  const contentType = request.headers.get("content-type");
  const cookie = request.headers.get("cookie");
  const traceparent = request.headers.get("traceparent");
  const tracestate = request.headers.get("tracestate");
  if (contentType) headers.set("content-type", contentType);
  if (cookie) headers.set("cookie", cookie);
  if (traceparent) headers.set("traceparent", traceparent);
  if (tracestate) headers.set("tracestate", tracestate);

  try {
    const authorization = await authorizationFor(target);
    if (authorization) headers.set("authorization", authorization);
    const upstreamUrl = new URL(`${target}/${route.upstreamPath}`);
    upstreamUrl.search = request.nextUrl.search;
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(65_000),
    });

    if (upstream.status >= 500) {
      return jsonError(503, "private API is temporarily unavailable", requestId);
    }

    const responseHeaders = new Headers({
      "cache-control": "no-store",
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "x-request-id": requestId,
    });
    for (const value of upstream.headers.getSetCookie()) {
      responseHeaders.append("set-cookie", value);
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        severity: "ERROR",
        message: "duka BFF request failed",
        request_id: requestId,
        route: route.upstreamPath,
        error_type: error instanceof Error ? error.name : "unknown",
      }),
    );
    return jsonError(503, "private API is temporarily unavailable", requestId);
  }
}

export const GET = proxy;
export const POST = proxy;
