"""Player-driven world interactions: chop tree, fish at spot, cook at fire.

Each interaction is a quick synchronous resolution for 2.0 — instead of
multi-tick action animation, we resolve in one call (player clicks tree,
gets a chop result immediately if requirements met). The animation/timing
layer can be added on top later without changing this contract.
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Optional

from server.game import loaders
from server.game.inventory_ops import (
    InventoryError,
    add_item,
    consume_items,
    equipped_tool,
)
from server.game.state import GameState
from shared.schemas import (
    BuildingInstance,
    Recipe,
    RecipeStation,
    ResourceNodeDef,
    SkillKind,
)


@dataclass
class InteractionResult:
    success: bool
    message: str
    xp_grants: list[tuple[SkillKind, int]]
    items_gained: list[tuple[str, int]]
    leveled_up: list[SkillKind]


def _empty_result(msg: str) -> InteractionResult:
    return InteractionResult(False, msg, [], [], [])


def _check_tool(state: GameState, node_def: ResourceNodeDef) -> Optional[str]:
    """Returns an error message or None if tool is OK."""
    if node_def.requires_tool_skill is None:
        return None
    items_db = loaders.items_by_id()
    tool = equipped_tool(state.world.player.inventory, items_db, node_def.requires_tool_skill.value)
    if tool is None:
        return f"You need a {node_def.requires_tool_skill.value} tool equipped."
    if tool.tool_level > node_def.skill_level_required:
        # Tool level higher than node requires is fine; node doesn't gate by tool
        return None
    return None


def harvest_resource_node(state: GameState, node_id: str) -> InteractionResult:
    rn_defs = loaders.resource_node_defs_by_id()
    items_db = loaders.items_by_id()
    with state.lock:
        node_inst = state.world.resource_nodes.get(node_id)
        if node_inst is None:
            return _empty_result("That node no longer exists.")
        node_def = rn_defs.get(node_inst.def_id)
        if node_def is None:
            return _empty_result("Unknown resource type.")
        # Skill level check
        player_skill = state.world.player.skills.get(node_def.skill).level
        if player_skill < node_def.skill_level_required:
            return _empty_result(
                f"Requires {node_def.skill.value} level {node_def.skill_level_required} (you are {player_skill})."
            )
        # Tool check
        tool_err = _check_tool(state, node_def)
        if tool_err:
            return _empty_result(tool_err)
        # Depleted?
        if node_inst.remaining_yield <= 0:
            return _empty_result("Depleted. Wait for it to respawn.")

        # Roll the drop
        drop = random.choices(
            node_def.drops, weights=[d.weight for d in node_def.drops], k=1
        )[0]
        item = items_db.get(drop.item_id)
        if item is None:
            return _empty_result(f"Bad data: drop references unknown item {drop.item_id}")

        added = add_item(state.world.player.inventory, item, drop.count)
        if added <= 0:
            return _empty_result("Inventory full!")

        # XP
        xp = int(drop.xp)
        before, after = state.world.player.skills.grant_xp(node_def.skill, xp)
        leveled_up = [node_def.skill] if after > before else []

        # Decrement yield (and trigger respawn)
        node_inst.remaining_yield -= 1
        if node_inst.remaining_yield <= 0:
            node_inst.depleted_until_tick = state.world.tick + node_def.respawn_ticks

        return InteractionResult(
            success=True,
            message=f"You gather {added} × {item.name} (+{xp} {node_def.skill.value} xp).",
            xp_grants=[(node_def.skill, xp)],
            items_gained=[(drop.item_id, added)],
            leveled_up=leveled_up,
        )


def craft_recipe(state: GameState, recipe_id: str, station: Optional[str]) -> InteractionResult:
    """Cook / craft / build using a recipe. Station is the station-id provided
    by the active building (e.g. 'fire' if standing next to a campfire)."""
    recipes_db = loaders.recipes_by_id()
    items_db = loaders.items_by_id()
    with state.lock:
        recipe = recipes_db.get(recipe_id)
        if recipe is None:
            return _empty_result(f"Unknown recipe {recipe_id}.")
        # Skill level
        player_lv = state.world.player.skills.get(recipe.skill).level
        if player_lv < recipe.skill_level_required:
            return _empty_result(
                f"Requires {recipe.skill.value} level {recipe.skill_level_required} (you are {player_lv})."
            )
        # Station
        if recipe.station != RecipeStation.NONE:
            if station != recipe.station.value:
                return _empty_result(f"You need a {recipe.station.value} nearby.")
        # Ingredients
        reqs = {ing.item_id: ing.count for ing in recipe.inputs}
        if not consume_items(state.world.player.inventory, reqs):
            need = ", ".join(f"{n} × {iid}" for iid, n in reqs.items())
            return _empty_result(f"You need: {need}.")

        # Burn check (cooking)
        burn_chance = _interp_burn_chance(recipe, player_lv)
        if burn_chance > 0 and random.random() < burn_chance:
            burnt_id = recipe.burn_into_item_id or recipe.output_item_id
            burnt_item = items_db.get(burnt_id)
            if burnt_item:
                add_item(state.world.player.inventory, burnt_item, recipe.output_count)
            return InteractionResult(
                success=True,
                message=f"You burn the {recipe.name.lower()}.",
                xp_grants=[],
                items_gained=[(burnt_id, recipe.output_count)],
                leveled_up=[],
            )

        # Success
        out_item = items_db.get(recipe.output_item_id)
        if out_item is None:
            return _empty_result(f"Bad data: recipe outputs unknown item {recipe.output_item_id}")
        added = add_item(state.world.player.inventory, out_item, recipe.output_count)
        xp = int(recipe.xp_award)
        before, after = state.world.player.skills.grant_xp(recipe.skill, xp)
        leveled_up = [recipe.skill] if after > before else []
        return InteractionResult(
            success=True,
            message=f"{recipe.name}: +{added} × {out_item.name}, +{xp} {recipe.skill.value} xp.",
            xp_grants=[(recipe.skill, xp)],
            items_gained=[(out_item.id, added)],
            leveled_up=leveled_up,
        )


def _interp_burn_chance(recipe: Recipe, level: int) -> float:
    """Linear interpolation between burn-at-min and burn-at-max levels."""
    min_lv = recipe.skill_level_required
    max_lv = 99
    if level <= min_lv:
        return recipe.burn_chance_at_min_level
    if level >= max_lv:
        return recipe.burn_chance_at_max_level
    t = (level - min_lv) / (max_lv - min_lv)
    return recipe.burn_chance_at_min_level + t * (
        recipe.burn_chance_at_max_level - recipe.burn_chance_at_min_level
    )


def place_building(state: GameState, building_def_id: str, tx: int, ty: int) -> InteractionResult:
    bld_defs = loaders.building_defs_by_id()
    items_db = loaders.items_by_id()
    with state.lock:
        bdef = bld_defs.get(building_def_id)
        if bdef is None:
            return _empty_result(f"Unknown building {building_def_id}.")
        player_lv = state.world.player.skills.get(SkillKind.BUILDING).level
        if player_lv < bdef.skill_level_required:
            return _empty_result(
                f"Requires Building level {bdef.skill_level_required} (you are {player_lv})."
            )
        reqs = {ing.item_id: ing.count for ing in bdef.construction_cost}
        if not consume_items(state.world.player.inventory, reqs):
            need = ", ".join(f"{n} × {iid}" for iid, n in reqs.items())
            return _empty_result(f"You need: {need}.")
        # Place
        bld_id = state.new_id("bld")
        state.world.buildings[bld_id] = BuildingInstance(
            id=bld_id, def_id=building_def_id, tile_x=tx, tile_y=ty
        )
        xp = int(bdef.xp_on_build)
        before, after = state.world.player.skills.grant_xp(SkillKind.BUILDING, xp)
        leveled_up = [SkillKind.BUILDING] if after > before else []
        return InteractionResult(
            success=True,
            message=f"You place a {bdef.name}.",
            xp_grants=[(SkillKind.BUILDING, xp)],
            items_gained=[],
            leveled_up=leveled_up,
        )


def find_station_near(state: GameState, tx: int, ty: int, radius: int = 2) -> Optional[str]:
    """Return the station id (e.g. 'fire') of the nearest providing building, or None."""
    bld_defs = loaders.building_defs_by_id()
    with state.lock:
        for b in state.world.buildings.values():
            d = bld_defs.get(b.def_id)
            if d is None or d.provides_station is None:
                continue
            if abs(b.tile_x - tx) <= radius and abs(b.tile_y - ty) <= radius:
                return d.provides_station
    return None
