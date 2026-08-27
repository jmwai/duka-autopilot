import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, STATIC_SECURITY_HEADERS } from "./headers";

describe("public web security policy", () => {
  it("builds a strict production script policy for the request nonce", () => {
    const policy = contentSecurityPolicy("reviewed-nonce", {
      development: false,
      secureTransport: true,
    });

    expect(policy).toContain("script-src 'self' 'nonce-reviewed-nonce' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain("\n");
  });

  it("allows only the development runtime additions when debugging locally", () => {
    const policy = contentSecurityPolicy("local-nonce", {
      development: true,
      secureTransport: false,
    });

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("connect-src 'self' ws: wss:");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("rejects a nonce that could alter the policy", () => {
    expect(() => contentSecurityPolicy("bad'; script-src *", {
      development: false,
      secureTransport: true,
    })).toThrow("CSP nonce is missing or malformed");
  });

  it("locks the non-CSP browser protections", () => {
    const headers = Object.fromEntries(
      STATIC_SECURITY_HEADERS.map(({ key, value }) => [key, value]),
    );
    expect(headers).toMatchObject({
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
  });
});
