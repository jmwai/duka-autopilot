import { z } from "zod";

export class BrowserApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "BrowserApiError";
  }
}

export async function browserApi<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const requestId = response.headers.get("x-request-id") ?? undefined;
  if (!response.ok) {
    let message = `Request failed with HTTP ${response.status}`;
    try {
      const body = await response.json() as { error?: string; detail?: string };
      message = body.error ?? body.detail ?? message;
    } catch {
      // Keep the normalized status-only error.
    }
    throw new BrowserApiError(message, response.status, requestId);
  }
  const result = schema.safeParse(await response.json());
  if (!result.success) {
    throw new BrowserApiError("The server returned an incompatible response", 502, requestId);
  }
  return result.data;
}
