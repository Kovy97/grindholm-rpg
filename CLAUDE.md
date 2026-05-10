# GrindHolm — Claude Working Notes

## Mission Brief

GrindHolm ist ein 2D-Sandbox-RPG (Stardew Valley × Medieval Dynasty × Runescape) mit offener Welt, Skill-Grind, Settlement-Building und Local-Coop. **Perspektive: 3/4 axis-aligned (Stardew-Style)** — Tile-Grid bleibt rechteckig, Sprites zeigen 45°-Frontansicht, Y-Sort für Tiefen-Render. Tonalität: grounded, ruhig, kein Forced-Playstyle. Architektur ist von Tag 1 multiplayer-aware, auch wenn 1.0 single-player ist.

## 1.0-Scope (STRIKT, kein Feature-Creep!)

Was 1.0 enthalten muss:
1. Projekt-Struktur (`client/`, `server/`, `shared/`, `data/`, `assets/`, `tools/`, `docs/`, `src/`)
2. Git-Repo + erster Commit
3. Spielbarer Avatar (WASD/Arrow keys, tile-basiert, Still-Sprite mit Tween-Bobbing)
4. **In-Game Tile-Editor** — Live-Overlay (`F1`) mit Palette + Click-to-paint + Layer + JSON-Save + Hot-Reload
5. **Modal-Hub** (`F2`) mit Skeleton-Tabs für spätere Editoren (Quests / Dialoge / NPCs / Items / Recipes / TileDefs)

## Was 1.0 NICHT enthält

- Kein Coop-Netcode (nur Architektur dafür vorbereiten)
- Keine Skill-Implementation
- Keine Story / keine Quests-Inhalte
- Kein Combat
- Keine NPCs (nur das Editor-Schema)
- Keine Sounds / keine Musik
- Keine Multi-Save-Slots (ein Slot reicht)
- **Kein Godot/Unity/Unreal** — alles in Code, sonst Workflow-Zwang

## Render-Architektur (3/4 axis-aligned)

- **Tile-Grid:** rechteckig, **96×96 Pixel pro Tile** (`shared/schemas/constants.py::TILE_PIXEL_SIZE`). Pixel-Density-Stil = mid/high detail pixelart (Octopath Traveler / Sea of Stars Niveau).
- **Drei Render-Pässe pro Frame** (`client/render/Stage.js` Layers):
  1. `ground` — flache Bodentiles, ein Graphics-Aufruf für die ganze Map.
  2. `props` — Objects + Collision-Tiles + Avatar, alle als individuelle Container, **Y-sortiert per `zIndex = footPx`**. So überdecken sich höhere Sprites korrekt mit Avatar.
  3. `debug` — Collision-Outlines (rot, optional toggle).
- **Object-Größe:** `TileDef.width_tiles` und `TileDef.height_tiles` (beide default 1.0). Sprite-Pixelmaße = `TILE_SIZE × width_tiles` breit, `TILE_SIZE × height_tiles` hoch, am Footprint zentriert (bottom-center). Beispiele: Eichenbaum 1.5×2.5 (144×240 px), Steinwand 1.0×1.5 (96×144 px), Bush 1.0×1.0 (96×96 px).
- **Asset-Format:** PNG mit Alpha, **kein Anti-Aliasing** (Pixi ist global auf `nearest`-Scaling gesetzt), Anker = Bottom-Center jedes Sprite-Boundings.
- **Sprite-Anker:** Bottom-Center jeder Prop. Y-Sort-Key = `(ty+1) * TILE_SIZE` für Tiles, `wy + 12` für Avatar (Foot-Y).
- **Procedural-Fallback:** Footprint dunkler + Krone heller + Schatten-Ellipse — deutet 3/4-Höhe ohne echte Sprites an. Wird durch Sprite-Atlas-Calls in `_drawProp` ersetzt sobald Assets verfügbar sind.

## Tech-Stack

- **Render:** PixiJS 8 (Canvas, Tile-Performance)
- **UI-Overlays:** HTML/CSS auf Pixi-Canvas
- **Backend + Dev-Tools:** Python + FastAPI
- **Wrapper:** PyWebView (Desktop, lokale Dateizugriffe)
- **Save:** SQLite (lokal) + JSON-Files in `data/`
- **Build:** `vite build` + PyWebView-Pack
- **MP-Server (Phase 2+):** Python + websockets auf NAS via Tailscale

## Architektur-Regeln (multiplayer-aware ab Tag 1)

1. **ECS-artig** — jede Entität hat ID + Komponenten. Server-Authority später pro Komponente zuweisbar.
2. **State-Mutationen über Message-Bus**, nicht direkte Calls. SP = Self-loop-Bus, MP = Server-Bus.
3. **Deterministisches Game-State** — fixe Tick-Rate (~30 Hz), Random-Seeds, keine Wall-Clock-Time direkt im Game-Code.
4. **Network-Owner pro Entity** — 1.0: alle Owner = lokaler Spieler.
5. **Trennung `client/` (Render-only) — `server/` (Authority-only) — `shared/` (Pure-Logic + Schemas)**.

## Input-Architektur

Drei-Layer:
```
Hardware (Keyboard / Mouse / Gamepad)
    → InputMapper (context-aware)
    → ActionBus (semantische Actions wie MOVE_UP, INTERACT, TOGGLE_DEV)
    → Game-Logik
```

- Game-Logik **reagiert nur auf Actions, nie auf Keys** — sonst kein Controller-Support später
- Context-Stack: `dialog > modal > dev_overlay > game`. Oberster Context schluckt Input.
- Mappings in `data/settings/keybindings.json` (User-rebindbar)
- Gamepad via `navigator.getGamepads()` jeden Tick, abstrahiert hinter gleicher Action-Schnittstelle

## Dev-Tools-Architektur

Zwei Modi:
- **F1 = Live-Overlay** — Tile-Painter, Welt tickt weiter, Avatar friert by default. Click-Drag paint, Right-Click erase, Mouse-Wheel brush-size.
- **F2 = Modal-Hub** — Tab-System (Quests/Dialoge/NPCs/Items/Recipes/TileDefs), Game pausiert. Pattern aus YGO Journey `#/dev`-Route geklaut.

Hot-Reload: `@lru_cache` + `invalidate_cache()`-Pattern. Editor-Save → Backend → Cache invalidieren → nächster API-Call lädt frisch → Pixi rebuildet betroffenen Chunk.

## User-Präferenzen

- **Antwort-Sprache:** Deutsch
- **Code-Kommentare:** Englisch ok
- **Story-Schreibstil** (für In-Game-Dialoge): Em-Dash „—" statt Bindestrich, generisches Maskulinum
- **Iteration:** konkrete Empfehlung + Tradeoff statt Multi-Choice-Fragen
- **Refactoring:** Files moven, nicht kopieren

## Scope-Discipline

Wenn der User „kannst du noch X einbauen" fragt:
**Frage zuerst:** „Ist das in 1.0-Scope, oder schieben wir das auf 1.1?"
Das ist der wichtigste Trigger gegen Feature-Creep.

## Referenz-Projekt

YGO Journey unter `C:\Users\MSchu\Documents\YGOJourney\` ist die Pattern-Vorlage. Insbesondere:
- `src/ygojourney/app_window.py` (Backend-API-Pattern, PyWebView-Bridge)
- `src/ygojourney/state.py` (SQLite + Story-Flags)
- `frontend/app.js` (Tab-System, Editor-Pattern)
- `data/scenes/*.json`, `data/quests/*.json`, `data/stories/*.json` (data-driven content)

NICHT klauen: DOM-basiertes Rendering, HTML-Hotspot-System (zu langsam für Tile-RPG mit Bewegung).
