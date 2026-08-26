import type { Instrumentation } from "next";
import { registerOTel } from "@vercel/otel";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    registerOTel({ serviceName: "duka-autopilot-web" });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  console.error(JSON.stringify({
    severity: "ERROR",
    message: "unhandled Next.js request error",
    error_type: error instanceof Error ? error.name : "unknown",
    route: context.routePath,
    router_kind: context.routerKind,
    method: request.method,
  }));
};
