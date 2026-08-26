import { GoogleAuth, type IdTokenClient } from "google-auth-library";

const clients = new Map<string, Promise<IdTokenClient>>();

function cloudMode() {
  return ["dev", "prod"].includes((process.env.DUKA_ENV ?? "local").toLowerCase());
}

async function clientFor(audience: string) {
  let client = clients.get(audience);
  if (!client) {
    client = new GoogleAuth().getIdTokenClient(audience);
    clients.set(audience, client);
  }
  return client;
}

export async function authorizationFor(audience: string): Promise<string | null> {
  if (!cloudMode()) return null;
  const client = await clientFor(audience);
  const headers = await client.getRequestHeaders();
  return headers.get("authorization") ?? null;
}
