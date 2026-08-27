import { customersSchema, ordersSchema, productsSchema } from "./contracts";
import { apiFetch } from "./server-client";

export async function getOrdersData() {
  const [orders, products, customers] = await Promise.all([
    apiFetch("orders", ordersSchema),
    apiFetch("products", productsSchema),
    apiFetch("customers", customersSchema),
  ]);
  return { orders, products, customers };
}

export type OrdersData = Awaited<ReturnType<typeof getOrdersData>>;
