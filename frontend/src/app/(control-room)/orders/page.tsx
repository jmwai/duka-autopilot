import { redirect } from "next/navigation";

import { DisconnectedBrief } from "@/components/control-room/disconnected-brief";
import { OrdersWorkspace } from "@/components/orders/orders-workspace";
import { getOrdersData } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/server-client";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  let data;
  let requestId: string | undefined;
  try {
    data = await getOrdersData();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login?next=/orders");
    requestId = error instanceof ApiError ? error.requestId : undefined;
  }
  const requestedOrder = (await searchParams).order;
  const orderId = typeof requestedOrder === "string" && data?.orders.some((order) => order.id === requestedOrder)
    ? requestedOrder
    : undefined;
  return data ? <OrdersWorkspace data={data} initialOrderId={orderId} /> : <DisconnectedBrief requestId={requestId} />;
}
