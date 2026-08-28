import { z } from "zod";

const languageSchema = z.enum(["en-KE", "sw-KE"]);

const usageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  total_tokens: z.number().int().nonnegative().optional(),
}).strict();

const vertexImageSourceSchema = z.object({
  provider: z.literal("google_vertex_ai"),
  project_id: z.literal("agent-platform-503913"),
  location: z.string().min(1),
  model: z.literal("gemini-3.1-flash-image"),
  prompt_path: z.string().regex(/^fixtures\/demo\/prompts\/[a-z0-9-]+\.txt$/),
  prompt_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  response_mime_type: z.string().regex(/^image\//),
  usage: usageSchema,
  generated_utc: z.string().min(1),
  synthetic: z.literal(true),
}).strict();

const googleVoiceSourceSchema = z.object({
  provider: z.literal("google_cloud_text_to_speech"),
  project_id: z.literal("agent-platform-503913"),
  location: z.literal("eu"),
  model: z.literal("gemini-2.5-flash-tts"),
  speaker: z.literal("Kore"),
  // The locale actually synthesized, which is not always the content locale:
  // the Gemini voice serves Kenyan English through en-US.
  synthesis_language_code: z.string().min(2),
  style_prompt: z.string().min(1),
  transcript_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  style_prompt_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  generated_utc: z.string().min(1),
  synthetic: z.literal(true),
}).strict();

const ledgerTruthRowSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  amount_ksh: z.number().int().positive().nullable(),
  paid: z.boolean(),
  expected_action: z.enum(["record", "gate"]),
  issue: z.string().min(1).optional(),
}).strict();

export const demoLedgerFixtureSchema = z.object({
  id: z.string().regex(/^ledger-(en|sw)-v\d+$/),
  language: languageSchema,
  label: z.string().min(1),
  path: z.string().regex(/^fixtures\/demo\/ledger-(en|sw)-v\d+\.png$/),
  mime_type: z.literal("image/png"),
  bytes: z.number().int().positive().max(6_000_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  synthetic: z.literal(true),
  source: vertexImageSourceSchema,
  ground_truth: z.object({
    recorded_rows: z.literal(2),
    gated_rows: z.literal(1),
    rows: z.array(ledgerTruthRowSchema).length(3),
  }).strict(),
}).strict().superRefine((fixture, context) => {
  const suffix = fixture.language === "en-KE" ? "en" : "sw";
  if (!fixture.id.startsWith(`ledger-${suffix}-`)) {
    context.addIssue({ code: "custom", path: ["id"], message: "ledger ID does not match its language" });
  }
  if (!fixture.path.includes(`/ledger-${suffix}-`)) {
    context.addIssue({ code: "custom", path: ["path"], message: "ledger path does not match its language" });
  }
});

export const demoVoiceFixtureSchema = z.object({
  id: z.string().regex(/^voice-(en|sw)-v\d+$/),
  language: languageSchema,
  label: z.string().min(1),
  path: z.string().regex(/^fixtures\/demo\/voice-[a-z0-9-]+\.wav$/),
  mime_type: z.literal("audio/wav"),
  bytes: z.number().int().positive().max(6_000_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  duration_seconds: z.number().positive(),
  transcript: z.string().min(1),
  english_translation: z.string().min(1),
  expected_intent: z.literal("usual_order"),
  synthetic: z.literal(true),
  source: googleVoiceSourceSchema,
}).strict().superRefine((fixture, context) => {
  const suffix = fixture.language === "en-KE" ? "en" : "sw";
  if (!fixture.id.startsWith(`voice-${suffix}-`)) {
    context.addIssue({ code: "custom", path: ["id"], message: "voice ID does not match its language" });
  }
  if (!fixture.path.includes(`/voice-${suffix}-`)) {
    context.addIssue({ code: "custom", path: ["path"], message: "voice path does not match its language" });
  }
});

export const demoFixtureManifestSchema = z.object({
  schema_version: z.literal(2),
  release_ready: z.boolean(),
  synthetic_only: z.literal(true),
  provider_policy: z.object({
    generated_media: z.literal("google_only"),
    allowed: z.array(z.enum([
      "google_vertex_ai",
      "google_cloud_text_to_speech",
    ])).min(1),
  }).strict(),
  ledgers: z.array(demoLedgerFixtureSchema),
  voices: z.array(demoVoiceFixtureSchema),
  blocked_reason: z.string().min(1).optional(),
}).strict().superRefine((manifest, context) => {
  const allowedProviders = new Set(manifest.provider_policy.allowed);
  if (
    manifest.provider_policy.allowed.length !== 2
    || allowedProviders.size !== 2
    || !allowedProviders.has("google_vertex_ai")
    || !allowedProviders.has("google_cloud_text_to_speech")
  ) {
    context.addIssue({
      code: "custom",
      path: ["provider_policy", "allowed"],
      message: "provider allowlist must contain exactly the approved Google image and voice surfaces",
    });
  }
  if (!manifest.release_ready && !manifest.blocked_reason) {
    context.addIssue({
      code: "custom",
      path: ["blocked_reason"],
      message: "a pending fixture manifest must explain why release assets are blocked",
    });
  }
  if (manifest.release_ready && manifest.blocked_reason) {
    context.addIssue({
      code: "custom",
      path: ["blocked_reason"],
      message: "a release-ready fixture manifest cannot remain blocked",
    });
  }
  const fixtures = [...manifest.ledgers, ...manifest.voices];
  const ids = fixtures.map((fixture) => fixture.id);
  const paths = fixtures.map((fixture) => fixture.path);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["ledgers"], message: "fixture IDs must be unique" });
  }
  if (new Set(paths).size !== paths.length) {
    context.addIssue({ code: "custom", path: ["ledgers"], message: "fixture paths must be unique" });
  }
  const declaredProviders = allowedProviders;
  for (const [index, fixture] of fixtures.entries()) {
    if (!declaredProviders.has(fixture.source.provider)) {
      context.addIssue({
        code: "custom",
        path: [index < manifest.ledgers.length ? "ledgers" : "voices"],
        message: `${fixture.id} source provider is not declared by provider_policy`,
      });
    }
  }
  if (!manifest.release_ready) return;
  for (const [kind, fixtures] of [["ledger", manifest.ledgers], ["voice", manifest.voices]] as const) {
    const languages = new Set(fixtures.map((fixture) => fixture.language));
    if (fixtures.length !== 2 || !languages.has("en-KE") || !languages.has("sw-KE")) {
      context.addIssue({
        code: "custom",
        path: [kind === "ledger" ? "ledgers" : "voices"],
        message: `${kind} fixtures must contain exactly English and Kiswahili variants`,
      });
    }
  }
});

export type DemoFixtureManifest = z.infer<typeof demoFixtureManifestSchema>;
export type DemoLedgerFixture = z.infer<typeof demoLedgerFixtureSchema>;
export type DemoVoiceFixture = z.infer<typeof demoVoiceFixtureSchema>;

export function fixturePublicUrl(path: string) {
  const filename = path.split("/").at(-1);
  if (!filename || !/^[a-z0-9-]+\.(png|wav)$/.test(filename)) {
    throw new Error("Fixture path is not safe for the public release bundle.");
  }
  return `/demo/${filename}`;
}

export async function sha256Hex(payload: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyFixturePayload(
  response: Response,
  fixture: { bytes: number; sha256: string },
) {
  if (!response.ok) throw new Error("The frozen Google fixture is unavailable in this release.");
  const payload = await response.arrayBuffer();
  if (payload.byteLength !== fixture.bytes || await sha256Hex(payload) !== fixture.sha256) {
    throw new Error("The frozen Google fixture failed its release integrity check.");
  }
  return payload;
}

export async function loadDemoFixtureManifest() {
  const response = await fetch("/demo/manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error("The demo fixture manifest is unavailable.");
  return demoFixtureManifestSchema.parse(await response.json());
}
