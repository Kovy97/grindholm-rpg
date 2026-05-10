from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from server.api import router as api_router
from server.game import tick as game_tick
from server.game.world import grant_starter_inventory, populate_initial_world
from server.game.state import state as game_state
from server.paths import ASSETS_DIR, DIST_DIR


def create_app() -> FastAPI:
    app = FastAPI(title="GrindHolm", version="0.2.0")

    @app.on_event("startup")
    def _bootstrap() -> None:
        populate_initial_world(game_state)
        grant_starter_inventory(game_state)
        game_tick.start()

    @app.on_event("shutdown")
    def _shutdown() -> None:
        game_tick.stop()

    # Allow vite dev server on a different origin during development.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    # Game-content asset folder (sprites, sounds) — served under /sprites so it
    # doesn't collide with vite's hashed /assets/ output.
    if ASSETS_DIR.exists():
        app.mount("/sprites", StaticFiles(directory=ASSETS_DIR), name="sprites")

    if DIST_DIR.exists():
        # Vite emits referenced bundles under dist/assets. Mount that directly.
        dist_assets = DIST_DIR / "assets"
        if dist_assets.exists():
            app.mount("/assets", StaticFiles(directory=dist_assets), name="dist-assets")

        @app.get("/")
        def index() -> FileResponse:
            return FileResponse(DIST_DIR / "index.html")

        # SPA fallback: any non-API path that isn't a mounted static file
        # falls through to index.html (so client-side routes work later).
        @app.get("/{full_path:path}")
        def spa(full_path: str) -> FileResponse:
            target = DIST_DIR / full_path
            if target.is_file():
                return FileResponse(target)
            return FileResponse(DIST_DIR / "index.html")

    else:

        @app.get("/")
        def needs_build() -> dict:
            return {
                "ok": False,
                "message": "frontend not built — run `npm run build` or use run.bat",
            }

    return app


app = create_app()
