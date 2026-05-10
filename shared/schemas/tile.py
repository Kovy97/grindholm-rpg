"""Tile definitions — the building blocks of any TileMap.

A TileDef is the *type* of a tile (grass, stone, wall) — its sprite, whether
it's walkable, which layer it belongs on. TileMap cells reference a TileDef
by id.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class TileLayer(str, Enum):
    GROUND = "ground"
    OBJECTS = "objects"
    COLLISION = "collision"


class TileDef(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(..., min_length=1, pattern=r"^[a-z0-9_]+$")
    name: str = Field(..., min_length=1)
    layer: TileLayer
    walkable: bool = True
    sprite: Optional[str] = Field(
        default=None,
        description="Asset path under assets/. None = procedural fallback (colored rect).",
    )
    color: Optional[str] = Field(
        default=None,
        pattern=r"^#[0-9a-fA-F]{6}$",
        description="Procedural fallback color when sprite is None.",
    )
    # 3/4-perspective sprite footprint in tile units. The renderer anchors the
    # sprite at the bottom-center of (tx, ty) and draws upward by height_tiles
    # and outward by width_tiles/2 on each side.
    #   width_tiles  = 1.0 -> sprite is exactly one tile wide (no overhang)
    #   height_tiles = 2.5 -> sprite reaches 2.5 tiles up from its foot tile
    # Tall objects (trees, walls) extend their canopy beyond their walkable
    # footprint without affecting collision, which is decided per-tile.
    width_tiles: float = Field(default=1.0, ge=0.5, le=8.0)
    height_tiles: float = Field(default=1.0, ge=0.5, le=8.0)
    tags: list[str] = Field(default_factory=list)
