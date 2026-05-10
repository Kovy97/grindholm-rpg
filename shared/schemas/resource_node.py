"""Resource nodes — interactive objects in the world.

Tree, fishing-spot, ore-rock etc. Each has a TileDef-style placement
plus runtime state (current HP, last-harvest time, drop-table).
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .skill import SkillKind


class ResourceNodeKind(str, Enum):
    TREE_NORMAL = "tree_normal"
    TREE_OAK = "tree_oak"
    TREE_WILLOW = "tree_willow"
    FISHING_SPOT_SHRIMP = "fishing_spot_shrimp"
    FISHING_SPOT_TROUT = "fishing_spot_trout"
    FISHING_SPOT_LOBSTER = "fishing_spot_lobster"
    FARM_PLOT = "farm_plot"


class ResourceDrop(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_id: str
    count: int = Field(default=1, ge=1)
    weight: float = Field(default=1.0, gt=0)
    xp: float = Field(default=0.0, ge=0)


class ResourceNodeDef(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(..., min_length=1, pattern=r"^[a-z0-9_]+$")
    kind: ResourceNodeKind
    name: str
    sprite: Optional[str] = None
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    width_tiles: float = Field(default=1.0, ge=0.5, le=8.0)
    height_tiles: float = Field(default=1.0, ge=0.5, le=8.0)
    skill: SkillKind
    skill_level_required: int = Field(default=1, ge=1, le=99)
    base_action_ticks: int = Field(default=15, ge=1, description="Ticks per harvest attempt")
    success_chance_per_tick: float = Field(default=0.25, ge=0.01, le=1.0)
    max_yield: int = Field(default=1, ge=1, description="Items dropped per node before depletion")
    respawn_ticks: int = Field(default=300, ge=10, description="Ticks until depleted node refills")
    drops: list[ResourceDrop] = Field(default_factory=list)
    requires_tool_skill: Optional[SkillKind] = None
    requires_tool_level: int = Field(default=0, ge=0)


class ResourceNodeInstance(BaseModel):
    """A placed instance of a node in the world. Mutable state."""

    model_config = ConfigDict(extra="forbid")

    id: str
    def_id: str
    tile_x: int
    tile_y: int
    remaining_yield: int = 0
    depleted_until_tick: int = 0  # 0 = available
