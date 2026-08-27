import { z } from "zod";

const languageSchema = z.enum(["en-KE", "sw-KE"]);

const vertexImageSourceSchema = z.object({
  provider: z.literal("google_vertex_ai"),
  project_id: z.literal("my-duka-autopilot"),
  location: z.string().min(1),
  model: z.string().regex(/^gemini-/),
  prompt_path: z.string().regex(/^fixtures\/demo\/prompts\/[a-z0-9-]+\.txt$/),
  prompt_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  generated_utc: z.string().min(1),
  synthetic: z.literal(true),
}).strict();

const googleVoiceSourceSchema = z.object({
  provider: z.literal("google_cloud_text_to_speech"),
  project_id: z.literal("my-duka-autopilot"),
  location: z.string().min(1),
  model: z.string().regex(/^gemini-/),
  speaker: z.string().min(1),
  style_prompt: z.string().min(1),
  generated_utc: z.string().min(1),
  synthetic: z.literal(true),
}).strict();

const firstPartyVoiceSourceSchema = z.object({
  provider: z.literal("first_party_human_recording"),
  recorded_utc: z.string().min(1),
  consent: z.literal(true),
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
}).strict();

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
  source: z.discriminatedUnion("provider", [googleVoiceSourceSchema, firstPartyVoiceSourceSchema]),
}).strict();

export const demoFixtureManifestSchema = z.object({
  schema_version: z.literal(2),
  release_ready: z.boolean(),
  synthetic_only: z.literal(true),
  provider_policy: z.object({
    generated_media: z.literal("google_only"),
    allowed: z.array(z.enum([
      "google_vertex_ai",
      "google_cloud_text_to_speech",
      "first_party_human_recording",
    ])).min(1),
  }).strict(),
  ledgers: z.array(demoLedgerFixtureSchema),
  voices: z.array(demoVoiceFixtureSchema),
  blocked_reason: z.string().min(1).optional(),
}).strict().superRefine((manifest, context) => {
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
