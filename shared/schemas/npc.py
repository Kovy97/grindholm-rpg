"""NPC schemas — Larry-Wood-style worker NPCs with skills + needs."""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .item import Inventory
from .skill import SkillBook, SkillKind


class NpcArchetype(str, Enum):
    VILLAGER = "villager"
    SPECIALIST = "specialist"
    TRADER = "trader"


class NeedsState(BaseModel):
    """0.0 = empty/dead, 1.0 = full. Decays over time."""

    model_config = ConfigDict(extra="forbid")

    hunger: float = Field(default=1.0, ge=0.0, le=1.0)
    energy: float = Field(default=1.0, ge=0.0, le=1.0)
    has_shelter: bool = True


class NpcJob(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skill: SkillKind
    # Bounding rectangle of the work zone in tile coordinates
    zone_min_x: int = 0
    zone_min_y: int = 0
    zone_max_x: int = 0
    zone_max_y: int = 0
    priority: int = 0


class BehaviourNode(str, Enum):
    IDLE = "idle"
    WALKING = "walking"
    WORKING = "working"
    EATING = "eating"
    SLEEPING = "sleeping"
    SEEKING_FOOD = "seeking_food"
    SEEKING_BED = "seeking_bed"


class NpcArchetypeDef(BaseModel):
    """Static template — used at recruitment to spawn an NPC instance."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(..., pattern=r"^[a-z0-9_]+$")
    name_pool: list[str]
    archetype: NpcArchetype
    sprite: Optional[str] = None
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    starting_skills: dict[SkillKind, tuple[int, int]] = Field(
        default_factory=dict,
        description="Per skill: (min_level, max_level) rolled at recruitment",
    )
    base_recruitment_cost: int = 100  # gold


class NPC(BaseModel):
    """Runtime NPC instance."""

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    archetype: NpcArchetype
    sprite: Optional[str] = None
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    skills: SkillBook = Field(default_factory=SkillBook.fresh)
    needs: NeedsState = Field(default_factory=NeedsState)
    inventory: Inventory = Field(default_factory=Inventory)
    home_id: Optional[str] = None
    job: Optional[NpcJob] = None
    behaviour: BehaviourNode = BehaviourNode.IDLE
    tile_x: float = 0.0
    tile_y: float = 0.0
    network_owner: str = "local"
