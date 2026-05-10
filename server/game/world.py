"""World population and walkability service.

- Spawns initial resource nodes on the test map.
- Provides a walkability function for pathfinding that consults the
  TileMap (terrain) AND placed buildings AND resource nodes.
"""
from __future__ import annotations

import random
from typing import Callable

from server.api.maps import _load_map  # reuse the cached loader
from server.game import loaders
from server.game.state import GameState
from shared.schemas import (
    BuildingInstance,
    ResourceNodeInstance,
    TileMap,
)


def make_walkable_fn(state: GameState, map_id: str) -> Callable[[int, int], bool]:
    """Return a walkable(x, y) closure that respects terrain + props + buildings."""
    tilemap: TileMap = _load_map(map_id)
    tile_defs_by_id = {}
    # We import here to avoid circular at module-load
    from server.api.tiles import _load_tiles
    for d in _load_tiles():
        tile_defs_by_id[d.id] = d

    rn_defs = loaders.resource_node_defs_by_id()
    bld_defs = loaders.building_defs_by_id()

    blocked: set[tuple[int, int]] = set()
    with state.lock:
        for rn in state.world.resource_nodes.values():
            d = rn_defs.get(rn.def_id)
            if d is None:
                continue
            for dx in range(int(d.width_tiles)):
                for dy in range(int(d.height_tiles)):
                    blocked.add((rn.tile_x + dx, rn.tile_y + dy))
        for b in state.world.buildings.values():
            d = bld_defs.get(b.def_id)
            if d is None or d.walkable:
                continue
            for dx in range(d.width_tiles):
                for dy in range(d.height_tiles):
                    blocked.add((b.tile_x + dx, b.tile_y + dy))

    def walkable(tx: int, ty: int) -> bool:
        if tx < 0 or ty < 0 or tx >= tilemap.width or ty >= tilemap.height:
            return False
        if (tx, ty) in blocked:
            return False
        idx = ty * tilemap.width + tx
        for layer in tilemap.layers:
            tid = layer.cells[idx]
            if not tid:
                continue
            d = tile_defs_by_id.get(tid)
            if d and not d.walkable:
                return False
        return True

    return walkable


def populate_initial_world(state: GameState) -> None:
    """Spawn an initial set of resource nodes for the demo map."""
    with state.lock:
        if state.world.resource_nodes:
            return  # already populated

        # Trees scattered around the map
        tree_positions = [
            (8, 8, "tree_normal"),
            (9, 8, "tree_normal"),
            (10, 7, "tree_oak"),
            (11, 8, "tree_normal"),
            (3, 3, "tree_normal"),
            (4, 4, "tree_oak"),
            (22, 12, "tree_oak"),
            (23, 13, "tree_willow"),
            (24, 14, "tree_normal"),
            (27, 5, "tree_normal"),
            (28, 6, "tree_oak"),
            (5, 7, "tree_normal"),
        ]
        for tx, ty, def_id in tree_positions:
            inst = ResourceNodeInstance(
                id=state.new_id("rn"),
                def_id=def_id,
                tile_x=tx,
                tile_y=ty,
                remaining_yield=1,
            )
            state.world.resource_nodes[inst.id] = inst

        # Fishing spots in the water pond (rows 3-6, cols 20-24)
        fishing_positions = [
            (20, 4, "fishing_spot_shrimp"),
            (21, 5, "fishing_spot_shrimp"),
            (23, 4, "fishing_spot_trout"),
            (24, 6, "fishing_spot_lobster"),
        ]
        for tx, ty, def_id in fishing_positions:
            inst = ResourceNodeInstance(
                id=state.new_id("rn"),
                def_id=def_id,
                tile_x=tx,
                tile_y=ty,
                remaining_yield=5,
            )
            state.world.resource_nodes[inst.id] = inst


def grant_starter_inventory(state: GameState) -> None:
    """Give the player a basic loadout so testing flows work end-to-end."""
    from server.game.inventory_ops import add_item
    items_db = loaders.items_by_id()
    with state.lock:
        inv = state.world.player.inventory
        for item_id, count in [
            ("axe_bronze", 1),
            ("fishing_net", 1),
            ("tinderbox", 1),
            ("hammer", 1),
            ("hoe", 1),
            ("seed_potato", 8),
        ]:
            it = items_db.get(item_id)
            if it:
                add_item(inv, it, count)
        inv.gold = 250
