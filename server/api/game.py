from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel

from server.game import loaders
from server.game.interactions import (
    craft_recipe,
    find_station_near,
    harvest_resource_node,
    place_building,
)
from server.game.inventory_ops import (
    InventoryError,
    drop_item,
    equip,
    swap_slots,
    unequip,
)
from server.game.pathfinding import find_path
from server.game.state import state
from server.game.world import grant_starter_inventory, make_walkable_fn, populate_initial_world
from shared.schemas import EquipSlot

router = APIRouter(prefix="/game", tags=["game"])


# --- one-time bootstrap ---
@router.post("/bootstrap")
def bootstrap() -> dict:
    """Initialise the world if empty. Idempotent."""
    populate_initial_world(state)
    grant_starter_inventory(state)
    return {"ok": True, "tick": state.world.tick}


# --- read endpoints ---
@router.get("/state")
def get_state() -> dict:
    return state.snapshot()


@router.get("/items")
def get_items() -> list[dict]:
    return [i.model_dump(mode="json") for i in loaders.items_by_id().values()]


@router.get("/recipes")
def get_recipes() -> list[dict]:
    return [r.model_dump(mode="json") for r in loaders.recipes_by_id().values()]


@router.get("/resource_node_defs")
def get_resource_node_defs() -> list[dict]:
    return [n.model_dump(mode="json") for n in loaders.resource_node_defs_by_id().values()]


@router.get("/building_defs")
def get_building_defs() -> list[dict]:
    return [b.model_dump(mode="json") for b in loaders.building_defs_by_id().values()]


@router.get("/npc_archetypes")
def get_npc_archetypes() -> list[dict]:
    return [a.model_dump(mode="json") for a in loaders.npc_archetype_defs_by_id().values()]


# --- player movement ---
class WalkRequest(BaseModel):
    target_x: int
    target_y: int


@router.post("/walk")
def walk(req: WalkRequest) -> dict:
    """Compute a continuous-coordinate path from player to target tile.

    Output is a list of (x, y) floats in tile-space — the client just
    interpolates linearly between consecutive points. Diagonal moves
    and string-pulled long segments make the motion feel non-grid."""
    walkable = make_walkable_fn(state, state.world.map_id)
    with state.lock:
        sx, sy = state.world.player.tile_x, state.world.player.tile_y
    path = find_path((sx, sy), (req.target_x, req.target_y), walkable)
    return {"path": [[round(x, 4), round(y, 4)] for (x, y) in path]}


class TeleportRequest(BaseModel):
    x: float
    y: float


@router.post("/teleport")
def teleport(req: TeleportRequest) -> dict:
    """Snap the player to a tile coord — frontend uses this after a path
    animation completes so the server has the canonical position."""
    with state.lock:
        state.world.player.tile_x = req.x
        state.world.player.tile_y = req.y
    return {"ok": True}


# --- inventory ---
class InventorySwapRequest(BaseModel):
    src: int
    dst: int


@router.post("/inventory/swap")
def inventory_swap(req: InventorySwapRequest) -> dict:
    try:
        with state.lock:
            swap_slots(state.world.player.inventory, req.src, req.dst)
    except InventoryError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


class InventoryEquipRequest(BaseModel):
    slot: int


@router.post("/inventory/equip")
def inventory_equip(req: InventoryEquipRequest) -> dict:
    try:
        with state.lock:
            equip(state.world.player.inventory, req.slot, loaders.items_by_id())
    except InventoryError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


class InventoryUnequipRequest(BaseModel):
    equip_slot: EquipSlot


@router.post("/inventory/unequip")
def inventory_unequip(req: InventoryUnequipRequest) -> dict:
    try:
        with state.lock:
            unequip(state.world.player.inventory, req.equip_slot)
    except InventoryError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


class InventoryDropRequest(BaseModel):
    slot: int
    count: Optional[int] = None


@router.post("/inventory/drop")
def inventory_drop(req: InventoryDropRequest) -> dict:
    try:
        with state.lock:
            stack = drop_item(state.world.player.inventory, req.slot, req.count)
    except InventoryError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "dropped": stack.model_dump(mode="json") if stack else None}


# --- interactions ---
class HarvestRequest(BaseModel):
    node_id: str


@router.post("/harvest")
def harvest(req: HarvestRequest) -> dict:
    result = harvest_resource_node(state, req.node_id)
    return _result_to_dict(result)


class CraftRequest(BaseModel):
    recipe_id: str
    near_x: Optional[int] = None
    near_y: Optional[int] = None


@router.post("/craft")
def craft(req: CraftRequest) -> dict:
    station = None
    if req.near_x is not None and req.near_y is not None:
        station = find_station_near(state, req.near_x, req.near_y)
    result = craft_recipe(state, req.recipe_id, station)
    return _result_to_dict(result)


class BuildRequest(BaseModel):
    building_id: str
    tile_x: int
    tile_y: int


@router.post("/build")
def build(req: BuildRequest) -> dict:
    result = place_building(state, req.building_id, req.tile_x, req.tile_y)
    return _result_to_dict(result)


def _result_to_dict(r) -> dict:
    return {
        "success": r.success,
        "message": r.message,
        "xp_grants": [{"skill": s.value, "amount": a} for s, a in r.xp_grants],
        "items_gained": [{"item_id": i, "count": n} for i, n in r.items_gained],
        "leveled_up": [s.value for s in r.leveled_up],
    }
