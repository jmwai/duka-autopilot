import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd(), "..");
const fixtureDirectory = path.join(repositoryRoot, "fixtures", "demo");
const manifest = JSON.parse(await readFile(path.join(fixtureDirectory, "manifest.json"), "utf8"));
const targetDirectory = path.join(process.cwd(), "public", "demo");
await mkdir(targetDirectory, { recursive: true });
await copyFile(path.join(fixtureDirectory, "manifest.json"), path.join(targetDirectory, "manifest.json"));

if (manifest.schema_version !== 2 || manifest.release_ready !== true) {
  await rm(path.join(targetDirectory, "ledger-page-v1.png"), { force: true });
  console.warn("Legacy demo fixture is quarantined; Google bilingual fixtures are required.");
} else {
  for (const fixture of [...manifest.ledgers, ...manifest.voices]) {
    const source = path.join(repositoryRoot, fixture.path);
    const payload = await readFile(source);
    const digest = createHash("sha256").update(payload).digest("hex");
    if (manifest.synthetic_only !== true || digest !== fixture.sha256 || payload.length !== fixture.bytes) {
      throw new Error(`${fixture.id} failed its manifest integrity contract`);
    }
    await copyFile(source, path.join(targetDirectory, path.basename(fixture.path)));
  }
}
