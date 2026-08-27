import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd(), "..");
const fixtureDirectory = path.join(repositoryRoot, "fixtures", "demo");
const manifest = JSON.parse(await readFile(path.join(fixtureDirectory, "manifest.json"), "utf8"));
const targetDirectory = path.join(process.cwd(), "public", "demo");
await mkdir(targetDirectory, { recursive: true });

async function clearPackagedMedia() {
  for (const filename of await readdir(targetDirectory)) {
    if (/\.(png|wav)$/i.test(filename)) await rm(path.join(targetDirectory, filename), { force: true });
  }
}

function requireReleaseManifest() {
  if (manifest.schema_version !== 2) throw new Error("demo fixture schema_version must be 2");
  if (manifest.synthetic_only !== true) throw new Error("demo fixtures must declare synthetic_only=true");
  if (manifest.provider_policy?.generated_media !== "google_only") {
    throw new Error("generated demo media must be Google-only");
  }
  const allowedProviders = new Set(manifest.provider_policy?.allowed);
  if (
    manifest.provider_policy.allowed.length !== 2
    || allowedProviders.size !== 2
    || !allowedProviders.has("google_vertex_ai")
    || !allowedProviders.has("google_cloud_text_to_speech")
  ) {
    throw new Error("provider allowlist must contain exactly the approved Google image and voice surfaces");
  }
  const requiredLanguages = new Set(["en-KE", "sw-KE"]);
  for (const [kind, fixtures] of [["ledger", manifest.ledgers], ["voice", manifest.voices]]) {
    if (!Array.isArray(fixtures) || fixtures.length !== 2) {
      throw new Error(`${kind} fixtures must contain exactly English and Kiswahili variants`);
    }
    const languages = new Set(fixtures.map((fixture) => fixture.language));
    if (languages.size !== requiredLanguages.size || [...requiredLanguages].some((language) => !languages.has(language))) {
      throw new Error(`${kind} fixtures must contain exactly English and Kiswahili variants`);
    }
  }
  const fixtures = [...manifest.ledgers, ...manifest.voices];
  const ids = new Set();
  const destinations = new Set();
  for (const fixture of fixtures) {
    if (!fixture.id || ids.has(fixture.id)) throw new Error("demo fixture IDs must be present and unique");
    ids.add(fixture.id);
    if (fixture.synthetic !== true) throw new Error(`${fixture.id} must declare synthetic=true`);
    const expectedSuffix = fixture.language === "en-KE" ? "en" : "sw";
    const expectedPrefix = manifest.ledgers.includes(fixture) ? `ledger-${expectedSuffix}-` : `voice-${expectedSuffix}-`;
    if (!fixture.id.startsWith(expectedPrefix) || !path.basename(fixture.path).startsWith(expectedPrefix)) {
      throw new Error(`${fixture.id} language, ID, and path do not agree`);
    }
    const provider = fixture.source?.provider;
    const providerAllowed = manifest.provider_policy.allowed?.includes(provider);
    const kindAllowed = manifest.ledgers.includes(fixture)
      ? provider === "google_vertex_ai"
      : provider === "google_cloud_text_to_speech";
    if (!providerAllowed || !kindAllowed) throw new Error(`${fixture.id} uses a disallowed provider`);
    const destination = path.basename(fixture.path);
    if (!/^[a-z0-9-]+\.(png|wav)$/.test(destination) || destinations.has(destination)) {
      throw new Error(`${fixture.id} has an unsafe or duplicate public filename`);
    }
    destinations.add(destination);
  }
}

function resolveRepositoryFile(relativePath, label) {
  if (typeof relativePath !== "string" || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be a repository-relative path`);
  }
  const resolved = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes the repository`);
  }
  return resolved;
}

async function verifyFile(relativePath, expectedBytes, expectedSha256, label) {
  const source = resolveRepositoryFile(relativePath, label);
  const payload = await readFile(source);
  const digest = createHash("sha256").update(payload).digest("hex");
  if (digest !== expectedSha256 || (expectedBytes !== undefined && payload.length !== expectedBytes)) {
    throw new Error(`${label} failed its manifest integrity contract`);
  }
  return source;
}

await clearPackagedMedia();

if (manifest.schema_version !== 2 || manifest.release_ready !== true) {
  if (manifest.schema_version !== 2 || manifest.blocked_reason === undefined) {
    throw new Error("a pending schema-v2 demo manifest must explain why release assets are blocked");
  }
  await copyFile(path.join(fixtureDirectory, "manifest.json"), path.join(targetDirectory, "manifest.json"));
  console.warn("Release demo media is pending; English and Kiswahili Google fixtures are required.");
} else {
  requireReleaseManifest();
  for (const fixture of [...manifest.ledgers, ...manifest.voices]) {
    const source = await verifyFile(fixture.path, fixture.bytes, fixture.sha256, fixture.id);
    if (fixture.source.provider === "google_vertex_ai") {
      await verifyFile(fixture.source.prompt_path, undefined, fixture.source.prompt_sha256, `${fixture.id} prompt`);
    }
    await copyFile(source, path.join(targetDirectory, path.basename(fixture.path)));
  }
  await copyFile(path.join(fixtureDirectory, "manifest.json"), path.join(targetDirectory, "manifest.json"));
}
