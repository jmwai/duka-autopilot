import { NextRequest, NextResponse } from "next/server";

import { contentSecurityPolicy } from "@/lib/security/headers";

const OWNER_COOKIE = "duka_owner_session";
const PROTECTED_PREFIXES = [
  "/approvals",
  "/inbox",
  "/night-shift",
  "/ledger",
  "/orders",
  "/inventory",
  "/evidence",
] as const;

function isProtectedPath(pathname: string) {
  return pathname === "/" || PROTECTED_PREFIXES.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ));
}

export function proxy(request: NextRequest) {
  const cloud = ["dev", "prod"].includes((process.env.DUKA_ENV ?? "local").toLowerCase());
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce, {
    development: process.env.NODE_ENV === "development",
    secureTransport: cloud,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", policy);
  requestHeaders.set("x-nonce", nonce);

  let response: NextResponse;
  if (cloud && isProtectedPath(request.nextUrl.pathname) && !request.cookies.has(OWNER_COOKIE)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    response = NextResponse.redirect(login);
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|health|ready|version|_next/static|_next/image|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
