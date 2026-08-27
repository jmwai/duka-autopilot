import { cpSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const standalone = resolve(root, ".next/standalone");

cpSync(resolve(root, "public"), resolve(standalone, "public"), { recursive: true });
cpSync(resolve(root, ".next/static"), resolve(standalone, ".next/static"), { recursive: true });

await import(resolve(standalone, "server.js"));
