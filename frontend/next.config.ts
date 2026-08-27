import type { NextConfig } from "next";

import { STATIC_SECURITY_HEADERS } from "./src/lib/security/headers";

const deploymentId = process.env.NEXT_DEPLOYMENT_ID ?? process.env.RELEASE_SHA ?? "local-build";
if (!/^[A-Za-z0-9._-]{1,128}$/u.test(deploymentId)) {
  throw new Error("NEXT_DEPLOYMENT_ID must be a safe release identifier");
}

const nextConfig: NextConfig = {
  deploymentId,
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{ source: "/:path*", headers: [...STATIC_SECURITY_HEADERS] }];
  },
};

export default nextConfig;
