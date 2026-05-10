from fastapi import APIRouter

from . import keybindings, maps, tiles

router = APIRouter(prefix="/api")
router.include_router(keybindings.router)
router.include_router(maps.router)
router.include_router(tiles.router)
