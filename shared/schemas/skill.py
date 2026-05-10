"""Skill system. OSRS-inspired XP curve, levels 1..99.

A SkillState is a per-skill struct that lives on Player and NPC objects.
The XP curve is the same one OSRS uses: cumulative XP at level L is
floor( sum_{i=1..L-1} floor(i + 300 * 2^(i/7)) / 4 ).
Level 1 = 0, Level 50 = 101,333, Level 99 = 13,034,431.
"""
from __future__ import annotations

import math
from enum import Enum
from functools import lru_cache

from pydantic import BaseModel, ConfigDict, Field


class SkillKind(str, Enum):
    WOODCUTTING = "woodcutting"
    FISHING = "fishing"
    COOKING = "cooking"
    FARMING = "farming"
    BUILDING = "building"
    TOWN_MANAGEMENT = "town_management"


MAX_LEVEL = 99
MAX_XP = 13_034_431  # cap per OSRS, hard limit


@lru_cache(maxsize=MAX_LEVEL + 2)
def xp_for_level(level: int) -> int:
    """Cumulative XP needed to reach `level` (level 1 = 0 XP)."""
    if level <= 1:
        return 0
    if level > MAX_LEVEL:
        level = MAX_LEVEL
    points = 0
    for L in range(1, level):
        points += math.floor(L + 300 * (2 ** (L / 7.0)))
    return points // 4


@lru_cache(maxsize=1)
def _xp_to_level_table() -> tuple[int, ...]:
    return tuple(xp_for_level(lvl) for lvl in range(1, MAX_LEVEL + 1))


def level_for_xp(xp: int) -> int:
    """Return the highest level whose threshold is <= xp. Capped at MAX_LEVEL."""
    if xp <= 0:
        return 1
    if xp >= MAX_XP:
        return MAX_LEVEL
    table = _xp_to_level_table()
    # binary search
    lo, hi = 0, len(table) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if table[mid] <= xp:
            lo = mid
        else:
            hi = mid - 1
    return lo + 1


class SkillState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    xp: int = Field(default=0, ge=0)

    @property
    def level(self) -> int:
        return level_for_xp(self.xp)

    @property
    def xp_into_level(self) -> int:
        return self.xp - xp_for_level(self.level)

    @property
    def xp_to_next_level(self) -> int:
        if self.level >= MAX_LEVEL:
            return 0
        return xp_for_level(self.level + 1) - self.xp


class SkillBook(BaseModel):
    """All skill states for an entity (player or NPC)."""

    model_config = ConfigDict(extra="forbid")

    skills: dict[SkillKind, SkillState] = Field(default_factory=dict)

    @classmethod
    def fresh(cls) -> "SkillBook":
        return cls(skills={k: SkillState() for k in SkillKind})

    def get(self, kind: SkillKind) -> SkillState:
        if kind not in self.skills:
            self.skills[kind] = SkillState()
        return self.skills[kind]

    def grant_xp(self, kind: SkillKind, amount: int) -> tuple[int, int]:
        """Grant XP to a skill. Returns (level_before, level_after)."""
        s = self.get(kind)
        before = s.level
        s.xp = min(MAX_XP, s.xp + max(0, amount))
        return before, s.level

    @property
    def total_level(self) -> int:
        return sum(s.level for s in self.skills.values())
