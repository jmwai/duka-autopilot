"""Demo seed - Duka la Amani's catalog, regulars, and a small statement.

Ported (disclosed) from the my-duka-agent talk repo, rewired onto the Store
interface. This is the CHAT demo's world (8 named customers the video can
talk to). The 50k-row reconciliation month comes from agents/synth/generate.py
on top of this base.

Run: python -m agents.seed [--force]
"""
from __future__ import annotations

import sys
from datetime import date, timedelta

from agents.store import get_store

PRODUCTS = [
    # sku, name, unit, unit_price (KSh), stock
    ("UNGA-2KG", "Unga wa Dola 2kg", "bale", 195, 40),
    ("SUKARI-1KG", "Sugar 1kg", "packet", 165, 60),
    ("MAFUTA-1L", "Cooking oil 1L", "bottle", 320, 30),
    ("RICE-2KG", "Pishori rice 2kg", "packet", 380, 25),
    ("MAZIWA-500", "Milk 500ml", "packet", 60, 80),
    ("CHAI-250G", "Tea leaves 250g", "packet", 145, 35),
    ("SABUNI-BAR", "Laundry soap bar", "bar", 85, 50),
    ("SABUNI-1L", "Dish soap 1L", "bottle", 180, 20),
    ("MKATE", "Bread 400g", "loaf", 65, 30),
    ("MAYAI-TRAY", "Eggs tray (30)", "tray", 420, 15),
    ("NGANO-2KG", "Ngano flour 2kg", "bale", 210, 20),
    ("SODA-500", "Soda 500ml", "bottle", 70, 100),
]

CUSTOMERS = [
    ("254711000001", "Mama Achieng", "Runs a food kiosk; orders unga+mafuta weekly"),
    ("254711000002", "Bwana Otieno", "School canteen; pays in bulk end-month"),
    ("254711000003", "Fatma Said", "Regular; prefers delivery before 10am"),
    ("254711000004", "Kevin Mwangi", ""),
    ("254711000005", "Amina Hassan", "Asked about pishori prices twice"),
    ("254711000006", "Joseph Kilonzo", "Complained once about a late delivery"),
    ("254711000007", "Grace Wanjiru", ""),
    ("254711000008", "Ali Mohammed", "New customer"),
]

# (customer, [(sku, qty)], status) - history for support/status questions
ORDERS = [
    ("254711000001", [("UNGA-2KG", 5), ("MAFUTA-1L", 2)], "paid"),
    ("254711000002", [("RICE-2KG", 10), ("SUKARI-1KG", 8)], "paid"),
    ("254711000003", [("MAZIWA-500", 6), ("MKATE", 2)], "paid"),
    ("254711000001", [("UNGA-2KG", 4), ("SABUNI-BAR", 3)], "paid"),
    ("254711000005", [("RICE-2KG", 2)], "confirmed"),
    ("254711000006", [("MAYAI-TRAY", 1), ("MKATE", 3)], "paid"),
    ("254711000004", [("SODA-500", 12)], "confirmed"),
    ("254711000007", [("CHAI-250G", 2), ("SUKARI-1KG", 2)], "paid"),
    ("254711000002", [("UNGA-2KG", 8)], "confirmed"),
    ("254711000008", [("MAFUTA-1L", 1)], "pending_confirmation"),
]

# Small hand-crafted statement: 2 exact matches, 4 engineered leftovers
# (name variant, wrong phone, no order, small amount). Dates are pinned to
# "today" at seed time so the 48h recon window always holds on reruns.
STATEMENT = [
    ("TGH4X1KQ72", "254711000005", "AMINA HASSAN", 760, "08:14:22"),
    ("TGH4X2MB19", "254711000004", "KEVIN MWANGI", 840, "09:02:47"),
    ("TGH4X3PL55", "254711000000", "B. OTIENO", 1560, "09:45:10"),
    ("TGH4X4RN08", "254711000099", "ALI MOHAMED", 320, "10:31:33"),
    ("TGH4X5QW61", "254711000006", "JOSEPH KILONZO", 500, "11:12:04"),
    ("TGH4X6ZT94", "254711000007", "GRACE WANJIRU", 145, "12:55:41"),
]


def seed(force: bool = False) -> dict:
    store = get_store()
    store.init()
    if store.products() and not force:
        return {"seeded": False, "reason": "already seeded; use force"}
    store.reset()
    store.upsert_products([dict(zip(("sku", "name", "unit", "unit_price", "stock"), p))
                           for p in PRODUCTS])
    store.upsert_customers([dict(zip(("id", "name", "notes"), c)) for c in CUSTOMERS])

    price = {sku: up for sku, _, _, up, _ in PRODUCTS}
    name = {sku: n for sku, n, _, _, _ in PRODUCTS}
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    for customer, items, status in ORDERS:
        store.create_order(
            customer,
            [{"sku": sku, "name": name[sku], "qty": qty, "unit_price": price[sku]}
             for sku, qty in items],
            status=status,
            # backdated a day so today's statement rows sit inside the 48h window
            created_at=f"{yesterday} 08:00:00",
        )
    today = date.today().isoformat()
    store.add_payments([
        {"ref": ref, "phone": phone, "payer_name": payer, "amount": amount,
         "paid_at": f"{today} {clock}"}
        for ref, phone, payer, amount, clock in STATEMENT
    ])
    counts = {"products": len(PRODUCTS), "customers": len(CUSTOMERS),
              "orders": len(ORDERS), "payments": len(STATEMENT)}
    return {"seeded": True, **counts}


if __name__ == "__main__":
    print(seed(force="--force" in sys.argv))
