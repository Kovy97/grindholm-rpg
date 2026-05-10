from __future__ import annotations

import json
from functools import lru_cache

from fastapi import APIRouter, HTTPException
from pydantic import TypeAdapter, ValidationError

from server.paths import SETTINGS_DIR
from server.persistence import register_cache
from shared.schemas import ActionBinding

router = APIRouter(tags=["input"])

_BindingList = TypeAdapter(list[ActionBinding])


@lru_cache(maxsize=1)
def _load_bindings() -> list[ActionBinding]:
    path = SETTINGS_DIR / "keybindings.json"
    if not path.exists():
        raise HTTPException(500, f"keybindings file missing: {path}")
    raw = json.loads(path.read_text(encoding="utf-8"))
    try:
        return _BindingList.validate_python(raw)
    except ValidationError as exc:
        raise HTTPException(500, f"invalid keybindings.json: {exc}") from exc


register_cache("keybindings", _load_bindings.cache_clear)


@router.get("/keybindings")
def get_keybindings() -> list[dict]:
    bindings = _load_bindings()
    return _BindingList.dump_python(bindings, mode="json")
