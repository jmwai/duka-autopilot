import { describe, expect, it } from "vitest";

import { acceptedContentType, matchBffRoute, requestContentLength } from "./bff-policy";

describe("BFF route policy", () => {
  it("allows only the declared method and path shapes", () => {
    expect(matchBffRoute("GET", ["version"])?.upstreamPath).toBe("version");
    expect(matchBffRoute("GET", ["inventory"])?.upstreamPath).toBe("inventory");
    expect(matchBffRoute("GET", ["evidence", "release"])?.upstreamPath).toBe("evidence/release");
    expect(matchBffRoute("GET", ["messages", "254711000001"])?.upstreamPath).toBe(
      "messages/254711000001",
    );
    expect(matchBffRoute("POST", ["approvals", "opaque.id-1"])?.upstreamPath).toBe(
      "approvals/opaque.id-1",
    );
    expect(matchBffRoute("POST", ["version"])).toBeNull();
    expect(matchBffRoute("DELETE", ["orders"])).toBeNull();
    expect(matchBffRoute("GET", ["pubsub", "push"])).toBeNull();
    expect(matchBffRoute("POST", ["synth", "generate"])).toBeNull();
  });

  it("rejects traversal and malformed identifiers", () => {
    expect(matchBffRoute("GET", ["messages", ".."])) .toBeNull();
    expect(matchBffRoute("GET", ["messages", "a/b"])).toBeNull();
    expect(matchBffRoute("POST", ["approvals", "bad id"])).toBeNull();
    expect(matchBffRoute("POST", ["approvals", "x", "extra"])).toBeNull();
  });

  it("parses request boundaries without trusting malformed lengths", () => {
    expect(requestContentLength(new Request("http://duka.test", { headers: { "content-length": "42" } }))).toBe(42);
    expect(requestContentLength(new Request("http://duka.test", { headers: { "content-length": "-1" } }))).toBeNaN();
    expect(acceptedContentType(new Request("http://duka.test", { headers: { "content-type": "application/json; charset=utf-8" } }))).toBe(true);
    expect(acceptedContentType(new Request("http://duka.test", { headers: { "content-type": "text/plain" } }))).toBe(false);
  });
});
