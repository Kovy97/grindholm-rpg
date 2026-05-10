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
    tags: list[str] = Field(default_factory=list)
