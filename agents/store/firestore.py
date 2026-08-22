"""Firestore Store backend - the cloud twin of sqlite.py.

Lands with the async/cloud phase: same Store interface, batched writes for
the bulk paths, composite index on (phone, amount) for the exact pass.
Until then, failing loud beats failing weird.
"""
from __future__ import annotations


class FirestoreStore:
    def __getattr__(self, name: str):
        raise NotImplementedError(
            "FirestoreStore ships in the cloud phase (see docs/hackathon "
            "plan, Day 2-3). Run with DUKA_STORE=sqlite for now."
        )
