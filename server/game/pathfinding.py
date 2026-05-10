"""Tile-grid A* pathfinding with continuous-coordinate output.

Pipeline:

  raw_grid_path = a_star_8(start_tile, goal_tile, walkable)
       ↓
  smooth_path  = string_pull(raw_grid_path, walkable, radius)
       ↓
  list of continuous (x, y) floats — fed to client WalkController for
  linear interpolation. Avatar moves in straight diagonals between
  pulled waypoints, so motion looks natural rather than tile-locked.

Collision is still tile-based (a tile is walkable or it isn't), but the
line-of-sight check during string-pulling uses an Avatar-shaped hitbox
of `radius` (in tile units) so the smoothed path keeps clearance from
non-walkable tiles.
"""
from __future__ import annotations

import heapq
import math
from typing import Callable

# Cardinal cost = 1, diagonal cost = sqrt(2) ≈ 1.4142.
# Stored times 1000 so we can keep heap keys integer-friendly.
_CARDINAL_COST = 1000
_DIAGONAL_COST = 1414

DEFAULT_RADIUS = 0.3  # in tile units; a touch under half a tile


def _h_octile(ax: int, ay: int, bx: int, by: int) -> int:
    """Octile heuristic — admissible for 8-neighbour movement."""
    dx = abs(ax - bx)
    dy = abs(ay - by)
    return _CARDINAL_COST * (dx + dy) + (_DIAGONAL_COST - 2 * _CARDINAL_COST) * min(dx, dy)


def a_star_8(
    start: tuple[int, int],
    goal: tuple[int, int],
    walkable: Callable[[int, int], bool],
    max_iters: int = 16000,
) -> list[tuple[int, int]]:
    """8-neighbour A*. Diagonals require both adjacent cardinals walkable
    (no corner-cutting through walls). Returns waypoints excluding start."""
    sx, sy = start
    gx, gy = goal
    if start == goal:
        return []
    if not walkable(gx, gy):
        candidates = [(gx + dx, gy + dy) for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]]
        candidates = [c for c in candidates if walkable(*c)]
        if not candidates:
            return []
        candidates.sort(key=lambda c: _h_octile(sx, sy, *c))
        gx, gy = candidates[0]

    open_heap: list[tuple[int, int, tuple[int, int]]] = []
    heapq.heappush(open_heap, (0, 0, (sx, sy)))
    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    g_score: dict[tuple[int, int], int] = {(sx, sy): 0}
    iters = 0

    NEIGHBOURS = (
        (1, 0, _CARDINAL_COST),
        (-1, 0, _CARDINAL_COST),
        (0, 1, _CARDINAL_COST),
        (0, -1, _CARDINAL_COST),
        (1, 1, _DIAGONAL_COST),
        (1, -1, _DIAGONAL_COST),
        (-1, 1, _DIAGONAL_COST),
        (-1, -1, _DIAGONAL_COST),
    )

    while open_heap and iters < max_iters:
        iters += 1
        _, _, current = heapq.heappop(open_heap)
        if current == (gx, gy):
            return _reconstruct(came_from, current)
        cx, cy = current
        for dx, dy, cost in NEIGHBOURS:
            nx, ny = cx + dx, cy + dy
            if not walkable(nx, ny):
                continue
            # No corner-cutting: a diagonal step requires both adjacent cardinals walkable
            if dx != 0 and dy != 0:
                if not walkable(cx + dx, cy) or not walkable(cx, cy + dy):
                    continue
            tentative = g_score[current] + cost
            if tentative < g_score.get((nx, ny), 1 << 30):
                g_score[(nx, ny)] = tentative
                f = tentative + _h_octile(nx, ny, gx, gy)
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


def has_line_of_sight(
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    walkable: Callable[[int, int], bool],
    radius: float = DEFAULT_RADIUS,
) -> bool:
    """Sweep the avatar's bounding box (square of half-width `radius`)
    along the segment (x0,y0)->(x1,y1) and check that every sampled
    position keeps all four corners on walkable tiles.

    Sampling rate is ~4 samples per tile of segment length; that's enough
    resolution for `radius < 0.5` to never miss a single-tile obstacle."""
    dx = x1 - x0
    dy = y1 - y0
    dist = math.hypot(dx, dy)
    if dist < 1e-6:
        return _box_walkable(x0, y0, walkable, radius)
    steps = max(2, int(dist * 4))
    for i in range(steps + 1):
        t = i / steps
        x = x0 + dx * t
        y = y0 + dy * t
        if not _box_walkable(x, y, walkable, radius):
            return False
    return True


def _box_walkable(x: float, y: float, walkable: Callable[[int, int], bool], radius: float) -> bool:
    for ox, oy in (
        (-radius, -radius),
        (radius, -radius),
        (-radius, radius),
        (radius, radius),
    ):
        tx = int(math.floor(x + ox))
        ty = int(math.floor(y + oy))
        if not walkable(tx, ty):
            return False
    return True


def string_pull(
    grid_path: list[tuple[int, int]],
    walkable: Callable[[int, int], bool],
    start_xy: tuple[float, float] | None = None,
    radius: float = DEFAULT_RADIUS,
) -> list[tuple[float, float]]:
    """Reduce a grid path to the minimum continuous polygonal route.

    Each tile-coord is treated as the centre point (tx + 0.5, ty + 0.5).
    Walks forward greedily: from the current anchor, the algorithm finds
    the farthest waypoint that still has line-of-sight with the avatar's
    hitbox; everything in between is dropped.
    """
    if not grid_path:
        return []
    centres: list[tuple[float, float]] = [(t[0] + 0.5, t[1] + 0.5) for t in grid_path]
    anchor = start_xy if start_xy is not None else centres[0]
    out: list[tuple[float, float]] = []
    cursor = 0
    while cursor < len(centres):
        last_visible = cursor
        for j in range(cursor + 1, len(centres)):
            cx, cy = centres[j]
            if has_line_of_sight(anchor[0], anchor[1], cx, cy, walkable, radius):
                last_visible = j
            else:
                break
        out.append(centres[last_visible])
        anchor = centres[last_visible]
        if last_visible == len(centres) - 1:
            break
        cursor = last_visible + 1
    return out


def find_path(
    start_xy: tuple[float, float],
    goal_tile: tuple[int, int],
    walkable: Callable[[int, int], bool],
    radius: float = DEFAULT_RADIUS,
) -> list[tuple[float, float]]:
    """Convenience: A* on 8-neighbour + string-pull, returning continuous
    waypoints in tile-coordinate space (floats)."""
    start_tile = (int(math.floor(start_xy[0])), int(math.floor(start_xy[1])))
    raw = a_star_8(start_tile, goal_tile, walkable)
    if not raw:
        return []
    return string_pull(raw, walkable, start_xy=start_xy, radius=radius)


# Back-compat shim for the old grid-only consumers that still import a_star.
def a_star(
    start: tuple[int, int],
    goal: tuple[int, int],
    walkable: Callable[[int, int], bool],
    max_iters: int = 8000,
) -> list[tuple[int, int]]:
    return a_star_8(start, goal, walkable, max_iters=max_iters)
