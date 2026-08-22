"""Store factory. DUKA_STORE=sqlite (default) | firestore.

Resolved per-call so tests can flip backends with an env var and so the
deployed Agent Engine picks its backend from its own runtime env.
"""
from __future__ import annotations

import os

from agents.store.base import Store  # noqa: F401 (re-export for type hints)

_cache: dict[str, object] = {}


def get_store():
    backend = os.environ.get("DUKA_STORE", "sqlite").lower()
    if backend not in _cache:
        if backend == "firestore":
            from agents.store.firestore import FirestoreStore
            _cache[backend] = FirestoreStore()
        else:
            from agents.store.sqlite import SqliteStore
            _cache[backend] = SqliteStore()
    return _cache[backend]
