"""Synthetic month generator - a full M-Pesa statement at stress scale.

Purpose: prove the thesis with a measured number. We generate ~50,000
statement rows for one month of trading, with NOISE ENGINEERED AT KNOWN
RATES, so we can verify that the deterministic exact pass settles ~97% and
the LLM only ever sees the residue. The generator is seeded (reproducible)
and returns the ground-truth counts per noise class, which the tests assert
against the reconciliation engine's actual behavior.

Noise classes (rates of total rows):
  clean         ~96.8%  same phone, exact amount, inside the 48h window -> exact pass
  name_variant   ~1.2%  paid from a different phone (spouse's line, agent till),
                        payer name is a recognizable variant           -> LLM residue
  partial        ~0.6%  one payment for 40-70% of the order            -> LLM residue
  split          ~0.4%  two payments summing to the order total        -> LLM residue
  unknown        ~0.5%  deposit with no corresponding order            -> LLM residue
  dup_ref        ~0.5%  duplicate transaction ref (statement artifact) -> dropped
                        deterministically by the ledger's UNIQUE(ref)

Run: python -m agents.synth.generate --rows 50000 [--days 30] [--seed 2026]
"""
from __future__ import annotations

import argparse
import random
import string
import time
from datetime import datetime, timedelta

from agents.store import get_store

FIRST = ["Achieng", "Amina", "Baraka", "Brian", "Charity", "Daudi", "Esther",
         "Fatma", "Faith", "George", "Grace", "Halima", "Hassan", "Irene",
         "James", "Janet", "Joseph", "Juma", "Kevin", "Khadija", "Lucy",
         "Mary", "Mercy", "Mohamed", "Mwanaisha", "Naomi", "Omar", "Otieno",
         "Pamela", "Peter", "Rehema", "Salim", "Samuel", "Sharon", "Said",
         "Teresia", "Victor", "Wanjiru", "Yusuf", "Zainab"]
LAST = ["Abdalla", "Achieng", "Ali", "Auma", "Bakari", "Chege", "Gitau",
        "Hassan", "Juma", "Kamau", "Kilonzo", "Kimani", "Kioko", "Maina",
        "Mbeyu", "Mohammed", "Mutua", "Mwangi", "Mwakio", "Ndegwa", "Njoroge",
        "Ochieng", "Odhiambo", "Okoth", "Omar", "Onyango", "Otieno", "Owino",
        "Salim", "Wafula", "Wanjala", "Wanjiru", "Wekesa", "Yusuf"]

RATES = {"name_variant": 0.012, "partial": 0.006, "split": 0.004,
         "unknown": 0.005, "dup_ref": 0.005}


def _ref(rng: random.Random) -> str:
    return "SHK" + "".join(rng.choices(string.ascii_uppercase + string.digits, k=7))


def _variant(name: str, rng: random.Random) -> str:
    """Payer-name variants the way M-Pesa statements actually mangle them."""
    parts = name.upper().split()
    forms = [
        f"{parts[0][0]}. {' '.join(parts[1:])}" if len(parts) > 1 else parts[0],
        " ".join(reversed(parts)),
        parts[-1],
        f"{parts[0]} {parts[-1][0]}" if len(parts) > 1 else parts[0],
    ]
    return rng.choice(forms)


def generate_month(rows: int = 50_000, days: int = 30, seed: int = 2026,
                   end: datetime | None = None) -> dict:
    """Build customers, orders and a statement; load them through the Store.

    Returns ground truth: rows inserted per noise class + timing.
    """
    rng = random.Random(seed)
    store = get_store()
    store.init()
    catalog = store.products()
    if not catalog:
        raise RuntimeError("seed the demo base first: python -m agents.seed")

    end = end or datetime.now()
    start = end - timedelta(days=days)

    # --- customer population -------------------------------------------------
    n_customers = max(120, rows // 140)
    customers, used_phones = [], set()
    while len(customers) < n_customers:
        phone = "2547" + "".join(rng.choices(string.digits, k=8))
        if phone in used_phones:
            continue
        used_phones.add(phone)
        customers.append({"id": phone,
                          "name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
                          "notes": "synthetic"})
    store.upsert_customers(customers)

    # --- decide each row's class up front (exact engineered counts) ---------
    n_dup = int(rows * RATES["dup_ref"])
    n_unknown = int(rows * RATES["unknown"])
    n_variant = int(rows * RATES["name_variant"])
    n_partial = int(rows * RATES["partial"])
    n_split_pairs = int(rows * RATES["split"]) // 2      # each pair = 2 rows
    n_clean = rows - n_dup - n_unknown - n_variant - n_partial - 2 * n_split_pairs

    def ts(day_offset: float) -> str:
        t = start + timedelta(days=day_offset)
        return t.strftime("%Y-%m-%d %H:%M:%S")

    def make_order(customer: dict, day: float) -> dict:
        items = []
        for _ in range(rng.randint(1, 4)):
            p = rng.choice(catalog)
            items.append({"sku": p["sku"], "name": p["name"],
                          "qty": rng.randint(1, 12), "unit_price": p["unit_price"]})
        return {"customer_id": customer["id"], "items": items,
                "status": "confirmed",
                "total": sum(i["qty"] * i["unit_price"] for i in items),
                "created_at": ts(day), "_day": day, "_customer": customer}

    t0 = time.monotonic()
    orders = []
    plan = (["clean"] * n_clean + ["name_variant"] * n_variant +
            ["partial"] * n_partial + ["split"] * n_split_pairs +
            ["unknown"] * n_unknown)
    rng.shuffle(plan)
    for kind in plan:
        if kind == "unknown":
            orders.append(None)  # placeholder, no order behind this deposit
        else:
            day = rng.uniform(0, days - 0.2)
            orders.append((kind, make_order(rng.choice(customers), day)))

    store.bulk_create_orders([o for entry in orders if entry for _, o in [entry]])

    # --- statement rows -----------------------------------------------------
    payments, truth = [], {"clean": 0, "name_variant": 0, "partial": 0,
                           "split_rows": 0, "unknown": 0, "dup_ref": 0}
    for entry in orders:
        if entry is None:
            payments.append({"ref": _ref(rng),
                             "phone": "2547" + "".join(rng.choices(string.digits, k=8)),
                             "payer_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}".upper(),
                             "amount": rng.randrange(50, 5000, 5),
                             "paid_at": ts(rng.uniform(0, days - 0.1))})
            truth["unknown"] += 1
            continue
        kind, o = entry
        cust = o["_customer"]
        pay_day = o["_day"] + rng.uniform(0.01, 1.4)  # inside the 48h window
        base = {"phone": cust["id"], "payer_name": cust["name"].upper(),
                "amount": o["total"], "paid_at": ts(pay_day)}
        if kind == "clean":
            payments.append({"ref": _ref(rng), **base})
            truth["clean"] += 1
        elif kind == "name_variant":
            payments.append({"ref": _ref(rng), **base,
                             "phone": "2547" + "".join(rng.choices(string.digits, k=8)),
                             "payer_name": _variant(cust["name"], rng)})
            truth["name_variant"] += 1
        elif kind == "partial":
            payments.append({"ref": _ref(rng), **base,
                             "amount": max(5, int(o["total"] * rng.uniform(0.4, 0.7)) // 5 * 5)})
            truth["partial"] += 1
        elif kind == "split":
            a = max(5, int(o["total"] * rng.uniform(0.3, 0.7)))
            for amt in (a, o["total"] - a):
                payments.append({"ref": _ref(rng), **base, "amount": amt,
                                 "paid_at": ts(pay_day + rng.uniform(0, 0.02))})
                truth["split_rows"] += 1

    # duplicate refs: re-emit existing rows with the same ref (statement artifact)
    for row in rng.sample(payments, min(n_dup, len(payments))):
        payments.append(dict(row))
        truth["dup_ref"] += 1

    rng.shuffle(payments)
    inserted = store.add_payments(payments)
    truth.update({
        "rows_generated": len(payments),
        "rows_inserted": inserted,                       # dups dropped by UNIQUE(ref)
        "dups_dropped": len(payments) - inserted,
        "orders_created": sum(1 for e in orders if e),
        "customers": len(customers),
        "wall_ms": int((time.monotonic() - t0) * 1000),
        "seed": seed, "days": days,
    })
    return truth


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=50_000)
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--seed", type=int, default=2026)
    args = ap.parse_args()
    stats = generate_month(rows=args.rows, days=args.days, seed=args.seed)
    for k, v in stats.items():
        print(f"{k:>16}: {v}")
