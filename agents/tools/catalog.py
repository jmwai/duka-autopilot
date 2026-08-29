"""Catalog tools - fuzzy product lookup so 'unga' finds 'Unga wa Dola 2kg'.
Reads through the Store seam."""
from __future__ import annotations

from difflib import SequenceMatcher

from agents.store import get_store


def get_catalog(query: str = "") -> list[dict]:
    """Look up products in the shop catalog.

    Args:
        query: Free-text product search, e.g. 'unga', 'cooking oil', 'sukari'.
               Empty string returns the full catalog.

    Returns:
        Matching products with sku, name, unit, unit_price (KSh) and stock.
    """
    products = get_store().products()
    if not query.strip():
        return products

    q = query.lower()

    def score(p: dict) -> float:
        hay = f"{p['sku']} {p['name']}".lower()
        if q in hay:
            return 1.0
        return SequenceMatcher(None, q, hay).ratio()

    ranked = sorted(products, key=score, reverse=True)
    return [p for p in ranked if score(p) > 0.35][:5]
