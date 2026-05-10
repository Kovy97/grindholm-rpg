from fastapi import APIRouter

from . import game, keybindings, maps, npcs, tiles

router = APIRouter(prefix="/api")
router.include_router(keybindings.router)
router.include_router(maps.router)
router.include_router(tiles.router)
router.include_router(game.router)
router.include_router(npcs.router)
