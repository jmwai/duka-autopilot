import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      app: "duka-autopilot-web",
      release_sha: process.env.RELEASE_SHA ?? "local",
      environment: process.env.DUKA_ENV ?? "local",
      runtime: process.version,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
