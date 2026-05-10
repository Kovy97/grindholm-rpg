"""Resolve project paths from anywhere. Single source of truth."""
from __future__ import annotations

from pathlib import Path


def _project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / "CLAUDE.md").exists() and (candidate / "data").is_dir():
            return candidate
    raise RuntimeError("could not locate GrindHolm project root from server/paths.py")


ROOT = _project_root()
DATA_DIR = ROOT / "data"
ASSETS_DIR = ROOT / "assets"
DIST_DIR = ROOT / "dist"
SETTINGS_DIR = DATA_DIR / "settings"
MAPS_DIR = DATA_DIR / "maps"
TILES_DIR = DATA_DIR / "tiles"
ENTITIES_DIR = DATA_DIR / "entities"
QUESTS_DIR = DATA_DIR / "quests"
DIALOGS_DIR = DATA_DIR / "dialogs"
NPCS_DIR = DATA_DIR / "npcs"
ITEMS_DIR = DATA_DIR / "items"
RECIPES_DIR = DATA_DIR / "recipes"
