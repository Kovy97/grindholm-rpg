"""Tile-grid A* pathfinding.

Uses 4-neighbour movement (no diagonal) so collisions stay clean against
axis-aligned tile shapes. Returns a list of (tx, ty) waypoints from
start (exclusive) to goal (inclusive). Empty list = no path.
"""
from __future__ import annotations

import heapq
from typing import Callable, Optional


def _h(ax: int, ay: int, bx: int, by: int) -> int:
    """Manhattan heuristic — admissible for 4-neighbour."""
    return abs(ax - bx) + abs(ay - by)


def a_star(
    start: tuple[int, int],
    goal: tuple[int, int],
    walkable: Callable[[int, int], bool],
    max_iters: int = 8000,
) -> list[tuple[int, int]]:
    sx, sy = start
    gx, gy = goal
    if start == goal:
        return []
    if not walkable(gx, gy):
        # Allow path adjacent to a non-walkable goal (e.g. trees) by snapping
        # to the nearest walkable neighbour.
        candidates = [(gx + dx, gy + dy) for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]]
        candidates = [c for c in candidates if walkable(*c)]
        if not candidates:
            return []
        candidates.sort(key=lambda c: _h(sx, sy, *c))
        gx, gy = candidates[0]

    open_heap: list[tuple[int, int, tuple[int, int]]] = []
    heapq.heappush(open_heap, (0, 0, (sx, sy)))
    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    g_score: dict[tuple[int, int], int] = {(sx, sy): 0}
    iters = 0

    while open_heap and iters < max_iters:
        iters += 1
        _, _, current = heapq.heappop(open_heap)
        if current == (gx, gy):
            return _reconstruct(came_from, current)
        cx, cy = current
        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nx, ny = cx + dx, cy + dy
            if not walkable(nx, ny):
                continue
            tentative = g_score[current] + 1
            if tentative < g_score.get((nx, ny), 1 << 30):
                g_score[(nx, ny)] = tentative
                f = tentative + _h(nx, ny, gx, gy)
                came_from[(nx, ny)] = current
                heapq.heappush(open_heap, (f, iters, (nx, ny)))
    return []


def _reconstruct(came_from: dict, end: tuple[int, int]) -> list[tuple[int, int]]:
    path: list[tuple[int, int]] = [end]
    while end in came_from:
        end = came_from[end]
        path.append(end)
    path.reverse()
    return path[1:]  # exclude start
