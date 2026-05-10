from __future__ import annotations

import json
import re
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, Body, HTTPException
from pydantic import ValidationError

from server.paths import MAPS_DIR
from server.persistence import invalidate, register_cache
from shared.schemas import TileMap

router = APIRouter(prefix="/maps", tags=["maps"])

_ID_RE = re.compile(r"^[a-z0-9_\-]+$")


def _safe_id(map_id: str) -> str:
    if not _ID_RE.match(map_id):
        raise HTTPException(400, f"invalid map id: {map_id!r}")
    return map_id


@lru_cache(maxsize=64)
def _load_map(map_id: str) -> TileMap:
    path = MAPS_DIR / f"{map_id}.json"
    if not path.exists():
        raise HTTPException(404, f"map not found: {map_id}")
    raw = json.loads(path.read_text(encoding="utf-8"))
    try:
        return TileMap.model_validate(raw)
    except ValidationError as exc:
        raise HTTPException(500, f"invalid map {map_id}: {exc}") from exc


register_cache("maps", _load_map.cache_clear)


@router.get("")
def list_maps() -> list[dict[str, Any]]:
    if not MAPS_DIR.exists():
        return []
    out: list[dict[str, Any]] = []
    for f in sorted(MAPS_DIR.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            out.append({"id": data.get("id", f.stem), "name": data.get("name", f.stem)})
        except Exception:
            out.append({"id": f.stem, "name": f.stem, "error": "parse-failed"})
    return out


@router.get("/{map_id}")
def get_map(map_id: str) -> dict:
    m = _load_map(_safe_id(map_id))
    return m.model_dump(mode="json")


@router.put("/{map_id}")
def save_map(map_id: str, payload: dict[str, Any] = Body(...)) -> dict:
    map_id = _safe_id(map_id)
    if payload.get("id") != map_id:
        raise HTTPException(400, "id in payload does not match URL")
    try:
        m = TileMap.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(400, f"invalid map: {exc}") from exc

    MAPS_DIR.mkdir(parents=True, exist_ok=True)
    path = MAPS_DIR / f"{map_id}.json"
    path.write_text(m.model_dump_json(indent=2), encoding="utf-8")
    invalidate("maps")
    return {"ok": True, "id": map_id}
