import { describe, expect, it } from "vitest";

import {
  demoFixtureManifestSchema,
  fixturePublicUrl,
  sha256Hex,
  verifyFixturePayload,
} from "./demo";

const hash = "a".repeat(64);

const pendingManifest = {
  schema_version: 2,
  release_ready: false,
  synthetic_only: true,
  provider_policy: {
    generated_media: "google_only",
    allowed: ["google_vertex_ai", "google_cloud_text_to_speech"],
  },
  ledgers: [],
  voices: [],
  blocked_reason: "Google APIs require activation.",
};

function readyManifest() {
  const ledger = (language: "en-KE" | "sw-KE") => {
    const suffix = language === "en-KE" ? "en" : "sw";
    return {
      id: `ledger-${suffix}-v2`,
      language,
      label: `${language} ledger`,
      path: `fixtures/demo/ledger-${suffix}-v2.png`,
      mime_type: "image/png",
      bytes: 1024,
      sha256: hash,
      width: 1024,
      height: 1536,
      synthetic: true,
      source: {
        provider: "google_vertex_ai",
        project_id: "agent-platform-503913",
        location: "global",
        model: "gemini-3.1-flash-image",
        prompt_path: `fixtures/demo/prompts/ledger-${suffix}-v2.txt`,
        prompt_sha256: hash,
        response_mime_type: "image/png",
        usage: { output_tokens: 1120 },
        generated_utc: "2026-08-27T08:00:00Z",
        synthetic: true,
      },
      ground_truth: {
        recorded_rows: 2,
        gated_rows: 1,
        rows: [
          { date: "2026-08-27", description: "Unga 2kg", quantity: 2, amount_ksh: 390, paid: true, expected_action: "record" },
          { date: "2026-08-27", description: "Mafuta 1L", quantity: 1, amount_ksh: 320, paid: true, expected_action: "record" },
          { date: "2026-08-27", description: "Sukari 1kg", quantity: 1, amount_ksh: null, paid: false, expected_action: "gate", issue: "Unreadable amount" },
        ],
      },
    };
  };
  const voice = (language: "en-KE" | "sw-KE") => {
    const suffix = language === "en-KE" ? "en" : "sw";
    return {
      id: `voice-${suffix}-v2`,
      language,
      label: `${language} usual order`,
      path: `fixtures/demo/voice-${suffix}-usual-v2.wav`,
      mime_type: "audio/wav",
      bytes: 2048,
      sha256: hash,
      duration_seconds: 2.4,
      transcript: language === "en-KE" ? "Bring my usual order." : "Niletee ya kawaida.",
      english_translation: "Bring my usual order.",
      expected_intent: "usual_order",
      synthetic: true,
      source: {
        provider: "google_cloud_text_to_speech",
        project_id: "agent-platform-503913",
        location: "eu",
        model: "gemini-2.5-flash-tts",
        speaker: "Kore",
        synthesis_language_code: "en-US",
        style_prompt: "A natural shop customer voice note.",
        transcript_sha256: hash,
        style_prompt_sha256: hash,
        generated_utc: "2026-08-27T08:00:00Z",
        synthetic: true,
      },
    };
  };
  return {
    ...pendingManifest,
    release_ready: true,
    blocked_reason: undefined,
    ledgers: [ledger("en-KE"), ledger("sw-KE")],
    voices: [voice("en-KE"), voice("sw-KE")],
  };
}

describe("Google-only demo fixture boundary", () => {
  it("accepts an explicit fail-closed pending manifest", () => {
    expect(demoFixtureManifestSchema.parse(pendingManifest).release_ready).toBe(false);
  });

  it("does not accept release-ready without bilingual media", () => {
    const parsed = demoFixtureManifestSchema.safeParse({ ...pendingManifest, release_ready: true });
    expect(parsed.success).toBe(false);
  });

  it("accepts one Google English and Kiswahili fixture for each modality", () => {
    const parsed = demoFixtureManifestSchema.parse(readyManifest());
    expect(parsed.ledgers.map((fixture) => fixture.language)).toEqual(["en-KE", "sw-KE"]);
    expect(parsed.voices.map((fixture) => fixture.source.provider)).toEqual([
      "google_cloud_text_to_speech",
      "google_cloud_text_to_speech",
    ]);
  });

  it("rejects any non-Google generated-media provider", () => {
    const manifest = readyManifest();
    manifest.ledgers[0].source.provider = "unapproved_image_generator";
    expect(demoFixtureManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects provenance from a superseded GCP project", () => {
    const manifest = readyManifest();
    manifest.voices[0].source.project_id = "retired-project";
    expect(demoFixtureManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects language labels that disagree with fixture IDs", () => {
    const manifest = readyManifest();
    manifest.voices[0].language = "sw-KE";
    expect(demoFixtureManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects a source provider omitted from the declared allowlist", () => {
    const manifest = readyManifest();
    manifest.provider_policy.allowed = ["google_vertex_ai"];
    expect(demoFixtureManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects a broadened or duplicated provider allowlist", () => {
    const manifest = readyManifest();
    manifest.provider_policy.allowed = [
      "google_vertex_ai",
      "google_cloud_text_to_speech",
      "google_cloud_text_to_speech",
    ];
    expect(demoFixtureManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("maps only a safe frozen filename into public assets", () => {
    expect(fixturePublicUrl("fixtures/demo/voice-usual-en-v1.wav")).toBe("/demo/voice-usual-en-v1.wav");
    expect(() => fixturePublicUrl("fixtures/demo/not safe.wav")).toThrow("not safe");
  });

  it("accepts only payloads matching both frozen bytes and SHA-256", async () => {
    const payload = new TextEncoder().encode("verified Google fixture");
    const sha256 = await sha256Hex(payload.buffer);
    const verified = await verifyFixturePayload(new Response(payload), { bytes: payload.byteLength, sha256 });
    expect(new Uint8Array(verified)).toEqual(payload);

    await expect(verifyFixturePayload(new Response(payload), {
      bytes: payload.byteLength + 1,
      sha256,
    })).rejects.toThrow("integrity check");
  });
});
