"""Items and inventory schemas.

ItemDef = static definition (name, sprite, stackability).
ItemStack = a runtime instance in an inventory slot (def_id + count).
Inventory = 30-slot main inventory + 11-slot equipment, OSRS-style.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


INVENTORY_SLOTS = 30  # OSRS uses 28; we use 30 per Marvin's spec


class EquipSlot(str, Enum):
    HEAD = "head"
    CAPE = "cape"
    AMULET = "amulet"
    WEAPON = "weapon"
    BODY = "body"
    SHIELD = "shield"
    LEGS = "legs"
    HANDS = "hands"
    FEET = "feet"
    RING = "ring"
    AMMO = "ammo"


class ItemCategory(str, Enum):
    RESOURCE = "resource"
    FOOD = "food"
    TOOL = "tool"
    EQUIPMENT = "equipment"
    BUILDING_MATERIAL = "building_material"
    SEED = "seed"
    MISC = "misc"


class ItemDef(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(..., min_length=1, pattern=r"^[a-z0-9_]+$")
    name: str = Field(..., min_length=1)
    category: ItemCategory
    description: str = ""
    sprite: Optional[str] = Field(
        default=None,
        description="Asset path under assets/. Procedural fallback if missing.",
    )
    color: Optional[str] = Field(
        default=None,
        pattern=r"^#[0-9a-fA-F]{6}$",
        description="Procedural icon color when sprite is None.",
    )
    stackable: bool = False
    max_stack: int = Field(default=1, ge=1, le=2_147_483_647)
    value: int = Field(default=0, ge=0, description="Base shop price (gold)")
    equip_slot: Optional[EquipSlot] = None
    # Tool gating (e.g. axe.tool_skill = woodcutting, tool_level = 1)
    tool_skill: Optional[str] = None
    tool_level: int = Field(default=0, ge=0)
    # Edible: how much hunger restored (0..1 fraction)
    heals: float = Field(default=0.0, ge=0.0, le=1.0)
    # Heat: cooking input/output flag
    cookable_into: Optional[str] = None  # raw fish -> cooked fish item id

    @model_validator(mode="after")
    def _stack_consistency(self) -> "ItemDef":
        if not self.stackable and self.max_stack > 1:
            raise ValueError("non-stackable items cannot have max_stack > 1")
        if self.stackable and self.max_stack < 2:
            raise ValueError("stackable items must allow stack >= 2")
        return self


class ItemStack(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_id: str
    count: int = Field(default=1, ge=1)


class Inventory(BaseModel):
    """30-slot main inventory + equipment slots."""

    model_config = ConfigDict(extra="forbid")

    slots: list[Optional[ItemStack]] = Field(
        default_factory=lambda: [None] * INVENTORY_SLOTS,
    )
    equipment: dict[EquipSlot, Optional[ItemStack]] = Field(default_factory=dict)
    gold: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def _slot_count(self) -> "Inventory":
        if len(self.slots) != INVENTORY_SLOTS:
            raise ValueError(f"inventory must have exactly {INVENTORY_SLOTS} slots")
        return self
