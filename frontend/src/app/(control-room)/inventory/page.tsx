import { redirect } from "next/navigation";

import { DisconnectedBrief } from "@/components/control-room/disconnected-brief";
import { InventoryWorkspace } from "@/components/inventory/inventory-workspace";
import { getInventoryData } from "@/lib/api/inventory";
import { ApiError } from "@/lib/api/server-client";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  let data;
  let requestId: string | undefined;
  try {
    data = await getInventoryData();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login?next=/inventory");
    requestId = error instanceof ApiError ? error.requestId : undefined;
  }
  return data ? <InventoryWorkspace data={data} /> : <DisconnectedBrief requestId={requestId} />;
}
