import "server-only";

import { cookies, headers as requestHeaders } from "next/headers";
import { z } from "zod";

import { authorizationFor } from "./identity";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const target = process.env.DUKA_API_URL?.replace(/\/+$/, "");
  if (!target) throw new ApiError("Private API is not configured", 503);
  if (!/^[A-Za-z0-9/_-]+$/.test(path) || path.includes("..")) {
    throw new ApiError("Invalid private API path", 500);
  }

  const incomingHeaders = await requestHeaders();
  const cookieStore = await cookies();
  const requestId = incomingHeaders.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers({ accept: "application/json", "x-request-id": requestId });
  const cookie = cookieStore.toString();
  if (cookie) headers.set("cookie", cookie);
  for (const name of ["traceparent", "tracestate"] as const) {
    const value = incomingHeaders.get(name);
    if (value) headers.set(name, value);
  }
  const authorization = await authorizationFor(target);
  if (authorization) headers.set("authorization", authorization);

  let response: Response;
  try {
    response = await fetch(`${target}/${path}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : "Private API is unavailable",
      503,
      requestId,
    );
  }
  if (!response.ok) {
    throw new ApiError(`Private API returned HTTP ${response.status}`, response.status, requestId);
  }
  const parsed = await response.json();
  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error(JSON.stringify({
      severity: "ERROR",
      message: "private API response failed validation",
      request_id: requestId,
      path,
      issues: result.error.issues.map((issue) => ({ code: issue.code, path: issue.path })),
    }));
    throw new ApiError("Private API response is incompatible", 502, requestId);
  }
  return result.data;
}
