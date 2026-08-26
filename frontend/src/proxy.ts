import { NextRequest, NextResponse } from "next/server";

const OWNER_COOKIE = "duka_owner_session";

export function proxy(request: NextRequest) {
  const cloud = ["dev", "prod"].includes((process.env.DUKA_ENV ?? "local").toLowerCase());
  if (cloud && !request.cookies.has(OWNER_COOKIE)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/approvals/:path*",
    "/inbox/:path*",
    "/night-shift/:path*",
    "/ledger/:path*",
    "/orders/:path*",
    "/inventory/:path*",
    "/evidence/:path*",
  ],
};
