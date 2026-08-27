import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd(), "..");
const fixtureDirectory = path.join(repositoryRoot, "fixtures", "demo");
const manifest = JSON.parse(await readFile(path.join(fixtureDirectory, "manifest.json"), "utf8"));
const ledger = manifest.ledger;
const source = path.join(repositoryRoot, ledger.path);
const payload = await readFile(source);
const digest = createHash("sha256").update(payload).digest("hex");

if (manifest.synthetic_only !== true || digest !== ledger.sha256 || payload.length !== ledger.bytes) {
  throw new Error("Frozen ledger fixture failed its manifest integrity contract");
}

const targetDirectory = path.join(process.cwd(), "public", "demo");
await mkdir(targetDirectory, { recursive: true });
await copyFile(source, path.join(targetDirectory, "ledger-page-v1.png"));
