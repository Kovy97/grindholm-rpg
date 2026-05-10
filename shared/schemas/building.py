"""Buildings — placeable structures the player or NPCs construct.

A BuildingDef is the recipe + footprint. Placed instances live in world state.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .recipe import RecipeIngredient


class BuildingCategory(str, Enum):
    UTILITY = "utility"      # campfire, well
    FURNITURE = "furniture"  # bed, chest
    STRUCTURE = "structure"  # wall, floor, roof
    PRODUCTION = "production"  # workbench, forge, cooking_range
    TOWN = "town"            # town_hall, granary


class BuildingDef(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(..., pattern=r"^[a-z0-9_]+$")
    name: str
    category: BuildingCategory
    sprite: Optional[str] = None
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    width_tiles: int = Field(default=1, ge=1, le=8)
    height_tiles: int = Field(default=1, ge=1, le=8)
    sprite_height_tiles: float = Field(
        default=1.0,
        ge=0.5,
        le=8.0,
        description="Visual height (for Y-sort). May exceed footprint.",
    )
    walkable: bool = False
    blocks_line_of_sight: bool = False
    # Required Building skill level to construct
    skill_level_required: int = Field(default=1, ge=1, le=99)
    construction_cost: list[RecipeIngredient] = Field(default_factory=list)
    # If this building IS a station for recipes (e.g. campfire is a "fire" station)
    provides_station: Optional[str] = None
    # If this is a bed, NPCs can claim it
    is_bed: bool = False
    # XP awarded on placement
    xp_on_build: float = 0.0


class BuildingInstance(BaseModel):
    """A placed building in the world."""

    model_config = ConfigDict(extra="forbid")

    id: str
    def_id: str
    tile_x: int
    tile_y: int
    owner_id: str = "player"
    health: int = 100
