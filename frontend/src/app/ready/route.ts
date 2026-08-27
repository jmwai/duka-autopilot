import { NextResponse } from "next/server";

import { authorizationFor } from "@/lib/api/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const target = process.env.DUKA_API_URL?.replace(/\/+$/, "");
  if (!target) {
    return NextResponse.json(
      { ok: false, role: "web", missing: ["DUKA_API_URL"] },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    const headers = new Headers({ accept: "application/json" });
    const authorization = await authorizationFor(target);
    if (authorization) headers.set("authorization", authorization);
    const upstream = await fetch(`${target}/ready`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!upstream.ok) throw new Error(`private API returned ${upstream.status}`);
    return NextResponse.json(
      { ok: true, role: "web", dependency: "api" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        role: "web",
        dependency: "api",
        error: error instanceof Error ? error.name : "unavailable",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
