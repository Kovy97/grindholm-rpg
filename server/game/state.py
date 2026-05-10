"""Authoritative game state — singleton, in-memory, server-side.

For 1.0/2.0 single-player this is the source of truth for player position,
inventory, skills, NPCs, world resource nodes, and placed buildings.
For multiplayer (phase 2+), this is what the server holds and clients
mirror via diff messages.

Persistence: SQLite for player + world snapshot, called from save/load endpoints.
"""
from __future__ import annotations

import threading
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from shared.schemas import (
    BehaviourNode,
    BuildingInstance,
    Inventory,
    NPC,
    ResourceNodeInstance,
    SkillBook,
)


class Player(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = "player"
    tile_x: float = 2.0
    tile_y: float = 10.0
    facing: str = "down"
    skills: SkillBook = Field(default_factory=SkillBook.fresh)
    inventory: Inventory = Field(default_factory=Inventory)
    # Currently-active interaction (e.g. chopping a tree) — None when idle
    busy_with: Optional[str] = None
    busy_until_tick: int = 0


class WorldState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tick: int = 0
    map_id: str = "test_world"
    player: Player = Field(default_factory=Player)
    npcs: dict[str, NPC] = Field(default_factory=dict)
    resource_nodes: dict[str, ResourceNodeInstance] = Field(default_factory=dict)
    buildings: dict[str, BuildingInstance] = Field(default_factory=dict)


class GameState:
    """Thread-safe wrapper around WorldState. Treat the WorldState model as
    the data, never mutate it from outside the lock."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.world = WorldState()
        self._listeners: list = []

    @property
    def lock(self) -> threading.RLock:
        return self._lock

    def snapshot(self) -> dict:
        with self._lock:
            return self.world.model_dump(mode="json")

    def grant_xp(self, skill, amount: int) -> tuple[int, int]:
        with self._lock:
            return self.world.player.skills.grant_xp(skill, amount)

    def new_id(self, prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:8]}"


# Module-level singleton
state = GameState()
