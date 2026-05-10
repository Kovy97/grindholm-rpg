"""Recipes — input items + skill requirements -> output items + XP."""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .skill import SkillKind


class RecipeStation(str, Enum):
    NONE = "none"  # craftable from inventory
    FIRE = "fire"
    COOKING_RANGE = "cooking_range"
    WORKBENCH = "workbench"
    LOOM = "loom"
    FORGE = "forge"


class RecipeIngredient(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_id: str
    count: int = Field(default=1, ge=1)


class Recipe(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(..., min_length=1, pattern=r"^[a-z0-9_]+$")
    name: str
    skill: SkillKind
    skill_level_required: int = Field(default=1, ge=1, le=99)
    station: RecipeStation = RecipeStation.NONE
    inputs: list[RecipeIngredient]
    output_item_id: str
    output_count: int = Field(default=1, ge=1)
    xp_award: float = Field(default=0.0, ge=0)
    base_ticks: int = Field(default=15, ge=1)
    burn_chance_at_min_level: float = Field(default=0.0, ge=0, le=1.0)
    burn_chance_at_max_level: float = Field(default=0.0, ge=0, le=1.0)
    burn_into_item_id: Optional[str] = None  # e.g. cooked_fish_burnt
