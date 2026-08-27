import { approvalsSchema, inventorySchema } from "./contracts";
import { apiFetch } from "./server-client";

export async function getInventoryData() {
  const [inventory, approvals] = await Promise.all([
    apiFetch("inventory", inventorySchema),
    apiFetch("approvals", approvalsSchema),
  ]);
  return { inventory, approvals };
}

export type InventoryData = Awaited<ReturnType<typeof getInventoryData>>;
