import { redirect } from "next/navigation";

import { DisconnectedBrief } from "@/components/control-room/disconnected-brief";
import { InboxWorkspace } from "@/components/inbox/inbox-workspace";
import { customersSchema } from "@/lib/api/contracts";
import { ApiError, apiFetch } from "@/lib/api/server-client";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  let customers;
  let requestId: string | undefined;
  try {
    customers = await apiFetch("customers", customersSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login?next=/inbox");
    requestId = error instanceof ApiError ? error.requestId : undefined;
  }
  return customers
    ? <InboxWorkspace initialCustomers={customers} />
    : <DisconnectedBrief requestId={requestId} />;
}
