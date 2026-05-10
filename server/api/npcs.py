from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.game.npc_ai import recruit_npc
from server.game.state import state
from shared.schemas import NpcJob, SkillKind

router = APIRouter(prefix="/npcs", tags=["npcs"])


class RecruitRequest(BaseModel):
    archetype_id: str
    spawn_x: float
    spawn_y: float


@router.post("/recruit")
def recruit(req: RecruitRequest) -> dict:
    npc = recruit_npc(state, req.archetype_id, req.spawn_x, req.spawn_y)
    if npc is None:
        raise HTTPException(400, "could not recruit (insufficient gold or unknown archetype)")
    return {"ok": True, "npc": npc.model_dump(mode="json")}


class AssignJobRequest(BaseModel):
    npc_id: str
    skill: SkillKind
    zone_min_x: int
    zone_min_y: int
    zone_max_x: int
    zone_max_y: int


@router.post("/assign_job")
def assign_job(req: AssignJobRequest) -> dict:
    with state.lock:
        npc = state.world.npcs.get(req.npc_id)
        if npc is None:
            raise HTTPException(404, "npc not found")
        npc.job = NpcJob(
            skill=req.skill,
            zone_min_x=req.zone_min_x,
            zone_min_y=req.zone_min_y,
            zone_max_x=req.zone_max_x,
            zone_max_y=req.zone_max_y,
        )
    return {"ok": True}
