"""TileMap — a grid of TileDef references organised in layers.

Storage format is JSON-compact: each layer is a flat list of length width*height,
where each cell is either a tile-id string or `null` (empty).
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .tile import TileLayer


class TileMapLayer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    layer: TileLayer
    cells: list[Optional[str]] = Field(default_factory=list)


class TileMap(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, pattern=r"^[a-z0-9_\-]+$")
    name: str = Field(..., min_length=1)
    width: int = Field(..., gt=0, le=512)
    height: int = Field(..., gt=0, le=512)
    layers: list[TileMapLayer] = Field(default_factory=list)
    spawn: tuple[int, int] = (0, 0)

    @model_validator(mode="after")
    def _check_layer_sizes(self) -> "TileMap":
        expected = self.width * self.height
        seen = set()
        for layer in self.layers:
            if layer.layer in seen:
                raise ValueError(f"duplicate layer: {layer.layer}")
            seen.add(layer.layer)
            if len(layer.cells) != expected:
                raise ValueError(
                    f"layer {layer.layer} has {len(layer.cells)} cells, "
                    f"expected {expected} ({self.width}x{self.height})"
                )
        sx, sy = self.spawn
        if not (0 <= sx < self.width and 0 <= sy < self.height):
            raise ValueError(f"spawn {self.spawn} out of bounds")
        return self

    def empty_layer(self, layer: TileLayer) -> TileMapLayer:
        return TileMapLayer(layer=layer, cells=[None] * (self.width * self.height))

    def index(self, x: int, y: int) -> int:
        return y * self.width + x
