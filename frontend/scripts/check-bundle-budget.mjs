import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const buildRoot = join(process.cwd(), ".next");
const manifestRoot = join(buildRoot, "server", "app", "(control-room)");
const maxRouteGzipBytes = 150 * 1024;
const maxRouteRawBytes = 450 * 1024;

if (!existsSync(manifestRoot)) {
  throw new Error("production App Router manifests are missing; run pnpm build first");
}

function filesBelow(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

const reports = filesBelow(manifestRoot)
  .filter((path) => path.endsWith("page_client-reference-manifest.js"))
  .map((manifestPath) => {
    const manifest = readFileSync(manifestPath, "utf8");
    const chunks = [...new Set(
      [...manifest.matchAll(/"(static\/chunks\/[^" ]+\.js)"/g)].map((match) => match[1]),
    )];
    const bytes = chunks.map((chunk) => readFileSync(join(buildRoot, chunk)));
    return {
      route: `/${relative(manifestRoot, manifestPath)
        .replace(/^page_client-reference-manifest\.js$/, "")
        .replace(/\/page_client-reference-manifest\.js$/, "")}`.replace("//", "/"),
      chunks: chunks.length,
      raw_bytes: bytes.reduce((sum, value) => sum + value.length, 0),
      gzip_bytes: bytes.reduce((sum, value) => sum + gzipSync(value).length, 0),
    };
  })
  .sort((left, right) => left.route.localeCompare(right.route));

const failures = reports.filter((report) => (
  report.raw_bytes > maxRouteRawBytes || report.gzip_bytes > maxRouteGzipBytes
));
const staticRoot = join(buildRoot, "static");
const totalStaticBytes = filesBelow(staticRoot).reduce((sum, path) => sum + statSync(path).size, 0);
const output = {
  schema_version: 1,
  budgets: {
    route_raw_bytes: maxRouteRawBytes,
    route_gzip_bytes: maxRouteGzipBytes,
  },
  total_static_bytes: totalStaticBytes,
  max_route_gzip_bytes: Math.max(...reports.map((report) => report.gzip_bytes)),
  routes: reports,
  status: failures.length ? "failed" : "passed",
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
