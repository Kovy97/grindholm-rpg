"""Cache invalidation registry — central kill-switch for hot-reload.

Every loader that uses @lru_cache should register itself here. After a
write, the corresponding namespace's caches get invalidated, so the next
read parses from disk again.

Mirrors YGO-Journey's `invalidate_cache` pattern but namespaced.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Callable

_caches: dict[str, list[Callable[[], None]]] = defaultdict(list)


def register_cache(namespace: str, clear_fn: Callable[[], None]) -> None:
    _caches[namespace].append(clear_fn)


def invalidate(namespace: str) -> None:
    for fn in _caches.get(namespace, []):
        fn()


def invalidate_all() -> None:
    for ns in _caches:
        invalidate(ns)
