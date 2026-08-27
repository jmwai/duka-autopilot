import { redirect } from "next/navigation";

import { DisconnectedBrief } from "@/components/control-room/disconnected-brief";
import { InboxWorkspace } from "@/components/inbox/inbox-workspace";
import { QueryProvider } from "@/components/query-provider";
import { customersSchema } from "@/lib/api/contracts";
import { ApiError, apiFetch } from "@/lib/api/server-client";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string | string[]; event?: string | string[] }>;
}) {
  let customers;
  let requestId: string | undefined;
  try {
    customers = await apiFetch("customers", customersSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login?next=/inbox");
    requestId = error instanceof ApiError ? error.requestId : undefined;
  }
  const params = await searchParams;
  const requestedCustomer = typeof params.customer === "string" ? params.customer : undefined;
  const requestedEvent = typeof params.event === "string" ? params.event : undefined;
  const initialCustomerId = requestedCustomer && customers?.some((customer) => customer.id === requestedCustomer)
    ? requestedCustomer
    : undefined;
  return customers
    ? <QueryProvider><InboxWorkspace initialCustomers={customers} initialCustomerId={initialCustomerId} initialEventId={requestedEvent} /></QueryProvider>
    : <DisconnectedBrief requestId={requestId} />;
}
