# GrindHolm

A 2D top-down sandbox RPG with skill grinding, settlement building, and local coop.
Inspired by Stardew Valley × Medieval Dynasty × Runescape.

**Status:** 1.0 in development — framework + in-game tile editor only.

## Setup (Windows)

```cmd
setup.bat
run.bat
```

`setup.bat` creates the Python venv, installs backend + frontend dependencies.
`run.bat` builds the frontend and launches the PyWebView app.

## Stack

- **Render:** PixiJS 8 (browser canvas)
- **Backend / dev-tools:** Python + FastAPI
- **Wrapper:** PyWebView (desktop)
- **Build:** Vite

## Layout

```
client/        # PixiJS render, input, UI, dev-tools
server/        # FastAPI + game logic + persistence
shared/        # Pydantic schemas + pure logic (used by both sides)
data/          # User content (maps, entities, quests, settings)
assets/        # Sprites, sounds, music
src/grindholm/ # PyWebView entry point
tools/         # Standalone scripts
docs/          # Design docs incl. HANDOVER.md
```

## Dev-Tools

- `F1` — toggle live tile-painter overlay (paint while world is running)
- `F2` — open modal editor hub (quests / dialogs / NPCs / items / recipes / tiles)

## License

TBD.
