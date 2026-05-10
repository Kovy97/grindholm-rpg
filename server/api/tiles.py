from __future__ import annotations

import json
from functools import lru_cache

from fastapi import APIRouter, HTTPException
from pydantic import TypeAdapter, ValidationError

from server.paths import TILES_DIR
from server.persistence import register_cache
from shared.schemas import TileDef

router = APIRouter(tags=["tiles"])

_TileList = TypeAdapter(list[TileDef])


@lru_cache(maxsize=1)
def _load_tiles() -> list[TileDef]:
    path = TILES_DIR / "tile_definitions.json"
    if not path.exists():
        raise HTTPException(500, f"tile definitions missing: {path}")
    raw = json.loads(path.read_text(encoding="utf-8"))
    try:
        return _TileList.validate_python(raw)
    except ValidationError as exc:
        raise HTTPException(500, f"invalid tile_definitions.json: {exc}") from exc


register_cache("tiles", _load_tiles.cache_clear)


@router.get("/tiles")
def list_tiles() -> list[dict]:
    return _TileList.dump_python(_load_tiles(), mode="json")
