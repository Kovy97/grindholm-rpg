"""NPC behaviour — simple priority-list 'AI' for 2.0.

Per tick, each NPC evaluates from highest to lowest priority and runs
the first satisfied node. Priorities:

  1. Critical hunger (< 0.10) -> SEEKING_FOOD -> EATING
  2. Critical energy (< 0.05) -> SEEKING_BED -> SLEEPING
  3. Job (if assigned and walkable target exists)
  4. Idle wander

This is intentionally NOT a full behaviour tree. Goal is "Larry chops trees
for you" working end-to-end, not a Rimworld-rivalling sim.
"""
from __future__ import annotations

import random
from typing import Optional

from server.game import loaders
from server.game.inventory_ops import add_item
from server.game.state import GameState
from shared.schemas import (
    BehaviourNode,
    NPC,
    ResourceNodeInstance,
    SkillKind,
)


def step_npcs(state: GameState) -> None:
    """One AI tick for all NPCs. Called from the global tick loop."""
    with state.lock:
        if not state.world.npcs:
            return
        for npc in state.world.npcs.values():
            try:
                _step_one(state, npc)
            except Exception as exc:
                # Don't let one NPC kill the loop
                print(f"[npc-ai] {npc.id}: {exc}")


def _step_one(state: GameState, npc: NPC) -> None:
    # Critical needs first
    if npc.needs.hunger <= 0.10:
        _try_eat(state, npc)
        return
    if npc.needs.energy <= 0.05:
        _try_rest(state, npc)
        return

    # Job
    if npc.job is not None:
        _do_job(state, npc)
        return

    # Idle wander (very gentle)
    npc.behaviour = BehaviourNode.IDLE


def _try_eat(state: GameState, npc: NPC) -> None:
    items_db = loaders.items_by_id()
    # Look for any food in NPC inventory
    for slot in npc.inventory.slots:
        if slot is None:
            continue
        item = items_db.get(slot.item_id)
        if item and item.heals > 0:
            npc.needs.hunger = min(1.0, npc.needs.hunger + item.heals)
            slot.count -= 1
            if slot.count <= 0:
                idx = npc.inventory.slots.index(slot)
                npc.inventory.slots[idx] = None
            npc.behaviour = BehaviourNode.EATING
            return
    # No food — try to take from a player chest? For 2.0 simplicity,
    # take from player inventory directly if standing close.
    px = state.world.player.tile_x
    py = state.world.player.tile_y
    if abs(px - npc.tile_x) < 3 and abs(py - npc.tile_y) < 3:
        pinv = state.world.player.inventory
        for i, slot in enumerate(pinv.slots):
            if slot is None:
                continue
            item = items_db.get(slot.item_id)
            if item and item.heals > 0:
                npc.needs.hunger = min(1.0, npc.needs.hunger + item.heals)
                slot.count -= 1
                if slot.count <= 0:
                    pinv.slots[i] = None
                npc.behaviour = BehaviourNode.EATING
                return
    npc.behaviour = BehaviourNode.SEEKING_FOOD


def _try_rest(state: GameState, npc: NPC) -> None:
    if npc.home_id and npc.home_id in state.world.buildings:
        bld = state.world.buildings[npc.home_id]
        if abs(bld.tile_x - npc.tile_x) <= 1 and abs(bld.tile_y - npc.tile_y) <= 1:
            npc.needs.energy = min(1.0, npc.needs.energy + 0.05)
            npc.behaviour = BehaviourNode.SLEEPING
            return
        # walk toward bed
        npc.behaviour = BehaviourNode.SEEKING_BED
        _step_toward(npc, bld.tile_x, bld.tile_y)
        return
    npc.behaviour = BehaviourNode.SEEKING_BED


def _do_job(state: GameState, npc: NPC) -> None:
    job = npc.job
    if job is None:
        return
    # Find nearest matching resource node in zone
    target: Optional[ResourceNodeInstance] = None
    best_dist = 1e9
    rn_defs = loaders.resource_node_defs_by_id()
    for rn in state.world.resource_nodes.values():
        rdef = rn_defs.get(rn.def_id)
        if rdef is None or rdef.skill != job.skill:
            continue
        if rn.remaining_yield <= 0:
            continue
        if not (
            job.zone_min_x <= rn.tile_x <= job.zone_max_x
            and job.zone_min_y <= rn.tile_y <= job.zone_max_y
        ):
            continue
        d = abs(rn.tile_x - npc.tile_x) + abs(rn.tile_y - npc.tile_y)
        if d < best_dist:
            best_dist = d
            target = rn
    if target is None:
        npc.behaviour = BehaviourNode.IDLE
        return
    # If close enough, harvest
    if best_dist <= 1.5:
        npc.behaviour = BehaviourNode.WORKING
        _npc_harvest(state, npc, target)
        # consume some energy
        npc.needs.energy = max(0.0, npc.needs.energy - 0.001)
    else:
        npc.behaviour = BehaviourNode.WALKING
        _step_toward(npc, target.tile_x, target.tile_y)


def _npc_harvest(state: GameState, npc: NPC, rn: ResourceNodeInstance) -> None:
    rn_defs = loaders.resource_node_defs_by_id()
    items_db = loaders.items_by_id()
    rdef = rn_defs.get(rn.def_id)
    if rdef is None:
        return
    # NPC skill check
    skill_lv = npc.skills.get(rdef.skill).level
    if skill_lv < rdef.skill_level_required:
        return
    # Roll success
    npc_speed_factor = 0.5 if skill_lv < 16 else (1.0 if skill_lv < 51 else 1.5)
    if random.random() > rdef.success_chance_per_tick * npc_speed_factor / 30.0:
        return
    drop = rdef.drops[0]
    item = items_db.get(drop.item_id)
    if item is None:
        return
    # Try NPC inventory first; if full, drop into the nearest player chest
    added = add_item(npc.inventory, item, drop.count)
    if added <= 0:
        # Full — pour over to player inventory if adjacent (simulating delivery)
        px = state.world.player.tile_x
        py = state.world.player.tile_y
        if abs(px - npc.tile_x) < 5 and abs(py - npc.tile_y) < 5:
            added = add_item(state.world.player.inventory, item, drop.count)
    if added > 0:
        npc.skills.grant_xp(rdef.skill, int(drop.xp))
        rn.remaining_yield -= 1
        if rn.remaining_yield <= 0:
            rn.depleted_until_tick = state.world.tick + rdef.respawn_ticks


def _step_toward(npc: NPC, tx: float, ty: float) -> None:
    """Move NPC by one tile toward target. Coarse — no pathfinding for 2.0."""
    dx = tx - npc.tile_x
    dy = ty - npc.tile_y
    if abs(dx) > abs(dy):
        npc.tile_x += 0.4 if dx > 0 else -0.4
    elif abs(dy) > 0:
        npc.tile_y += 0.4 if dy > 0 else -0.4


def recruit_npc(
    state: GameState,
    archetype_id: str,
    spawn_x: float,
    spawn_y: float,
) -> Optional[NPC]:
    """Recruit a new NPC of a given archetype.

    Costs gold per archetype.base_recruitment_cost. Skills are rolled
    randomly within each starting_skills (min, max) range.
    """
    archs = loaders.npc_archetype_defs_by_id()
    arch = archs.get(archetype_id)
    if arch is None:
        return None
    with state.lock:
        if state.world.player.inventory.gold < arch.base_recruitment_cost:
            return None
        state.world.player.inventory.gold -= arch.base_recruitment_cost
        from shared.schemas import NPC as NPCModel
        from shared.schemas import SkillBook
        from shared.schemas.skill import xp_for_level
        skills = SkillBook.fresh()
        for kind_str, (lo, hi) in arch.starting_skills.items():
            lvl = random.randint(lo, hi)
            kind = SkillKind(kind_str) if not isinstance(kind_str, SkillKind) else kind_str
            skills.skills[kind].xp = xp_for_level(lvl)
        npc = NPCModel(
            id=state.new_id("npc"),
            name=random.choice(arch.name_pool),
            archetype=arch.archetype,
            color=arch.color,
            skills=skills,
            tile_x=spawn_x,
            tile_y=spawn_y,
        )
        state.world.npcs[npc.id] = npc
        return npc
