import { describe, expect, it } from "vitest";

import { demoFixtureManifestSchema, fixturePublicUrl } from "./demo";

const pendingManifest = {
  schema_version: 2,
  release_ready: false,
  synthetic_only: true,
  provider_policy: {
    generated_media: "google_only",
    allowed: ["google_vertex_ai", "google_cloud_text_to_speech", "first_party_human_recording"],
  },
  ledgers: [],
  voices: [],
  blocked_reason: "Google APIs require activation.",
};

describe("Google-only demo fixture boundary", () => {
  it("accepts an explicit fail-closed pending manifest", () => {
    expect(demoFixtureManifestSchema.parse(pendingManifest).release_ready).toBe(false);
  });

  it("does not accept release-ready without bilingual media", () => {
    const parsed = demoFixtureManifestSchema.safeParse({ ...pendingManifest, release_ready: true });
    expect(parsed.success).toBe(false);
  });

  it("maps only a safe frozen filename into public assets", () => {
    expect(fixturePublicUrl("fixtures/demo/voice-usual-en-v1.wav")).toBe("/demo/voice-usual-en-v1.wav");
    expect(() => fixturePublicUrl("fixtures/demo/not safe.wav")).toThrow("not safe");
  });
});
