# GrindHolm

A 2D sandbox RPG with skill grinding, settlement building, and local coop.
3/4-axis-aligned perspective (Stardew-style — rectangular tile grid, sprites
drawn from a 45° front-on angle, Y-sorted depth).
Inspired by Stardew Valley × Medieval Dynasty × Runescape.

**Status:** 2.0 in development — vertical-slice RPG with skills, OSRS-style inventory, click + WASD controls, NPCs, and build mode on top of the 1.0 tile-editor framework.

## Setup (Windows)

```cmd
setup.bat
run.bat
```

`setup.bat` creates the Python venv, installs backend + frontend dependencies.
`run.bat` builds the frontend and launches the PyWebView app.

For the full dev/test stack:

```cmd
venv\Scripts\python.exe -m pip install -r requirements-dev.txt
venv\Scripts\python.exe -m pytest tests/ -q
```

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

## Game Controls (2.0)

- **WASD / arrows** — move avatar
- **Left-click world tile** — walk there (or harvest if a resource node)
- **Right-click anything** — context menu (Chop Tree / Walk Here / Examine / etc.)
- **Click on minimap** — walk to that world tile
- **Inventory tab (bottom-right)** — 5×6 OSRS-style grid, drag to swap, right-click for actions
- **Right-click food in inventory** — Cook (auto-finds nearby fire)
- **Click campfire** — opens cook menu for any cookable item in inventory
- **Click Town Hall** — recruit NPCs (Larry-Wood-pattern: skilled workers with hunger/energy needs)
- **Click Workbench** — craft planks, etc.

## Dev-Tools

- `F1` — toggle live tile-painter overlay (paint while world is running)
- `F2` — open modal editor hub (quests / dialogs / NPCs / items / recipes / tiles)

## License

TBD.
