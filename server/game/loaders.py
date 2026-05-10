"""Cached JSON loaders for content data files (items, recipes, etc.).

Each loader is registered with the cache invalidation registry so the
in-game editor's save→reload pattern works.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from pydantic import TypeAdapter

from server.paths import (
    DATA_DIR,
    ITEMS_DIR,
    NPCS_DIR,
    RECIPES_DIR,
)
from server.persistence import register_cache
from shared.schemas import (
    BuildingDef,
    ItemDef,
    NpcArchetypeDef,
    Recipe,
    ResourceNodeDef,
)

_ItemList = TypeAdapter(list[ItemDef])
_RecipeList = TypeAdapter(list[Recipe])
_ResourceNodeList = TypeAdapter(list[ResourceNodeDef])
_BuildingList = TypeAdapter(list[BuildingDef])
_NpcArchetypeList = TypeAdapter(list[NpcArchetypeDef])


def _load_json(path: Path):
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def items_by_id() -> dict[str, ItemDef]:
    raw = _load_json(ITEMS_DIR / "items.json")
    parsed = _ItemList.validate_python(raw)
    return {i.id: i for i in parsed}


@lru_cache(maxsize=1)
def recipes_by_id() -> dict[str, Recipe]:
    raw = _load_json(RECIPES_DIR / "recipes.json")
    parsed = _RecipeList.validate_python(raw)
    return {r.id: r for r in parsed}


@lru_cache(maxsize=1)
def resource_node_defs_by_id() -> dict[str, ResourceNodeDef]:
    raw = _load_json(DATA_DIR / "resource_nodes" / "resource_nodes.json")
    parsed = _ResourceNodeList.validate_python(raw)
    return {n.id: n for n in parsed}


@lru_cache(maxsize=1)
def building_defs_by_id() -> dict[str, BuildingDef]:
    raw = _load_json(DATA_DIR / "buildings" / "buildings.json")
    parsed = _BuildingList.validate_python(raw)
    return {b.id: b for b in parsed}


@lru_cache(maxsize=1)
def npc_archetype_defs_by_id() -> dict[str, NpcArchetypeDef]:
    raw = _load_json(NPCS_DIR / "archetypes.json")
    parsed = _NpcArchetypeList.validate_python(raw)
    return {a.id: a for a in parsed}


register_cache("items", items_by_id.cache_clear)
register_cache("recipes", recipes_by_id.cache_clear)
register_cache("resource_nodes", resource_node_defs_by_id.cache_clear)
register_cache("buildings", building_defs_by_id.cache_clear)
register_cache("npc_archetypes", npc_archetype_defs_by_id.cache_clear)
