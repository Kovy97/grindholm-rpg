"""Entity / Component primitives — minimal ECS-flavoured.

For 1.0 we only have the avatar entity, but everything (NPCs, items, etc.)
will go through this same shape so multiplayer can later assign a network-owner
per component.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


NetworkOwner = Literal["local", "server", "remote"]


class Component(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: str = Field(..., min_length=1)
    data: dict[str, Any] = Field(default_factory=dict)


class Entity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1)
    archetype: str = Field(default="generic")
    owner: NetworkOwner = "local"
    components: list[Component] = Field(default_factory=list)

    def get(self, kind: str) -> Optional[Component]:
        for c in self.components:
            if c.kind == kind:
                return c
        return None


class EntityRef(BaseModel):
    """Lightweight reference for cross-entity links in saved data."""

    model_config = ConfigDict(extra="forbid")

    id: str
