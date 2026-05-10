# GrindHolm — Handover für die neue Claude-Instanz

> **Update 2026-05-10 — Perspektive klargestellt:** GrindHolm ist 3/4
> axis-aligned (Stardew-Style), nicht reines Top-Down. Tile-Grid bleibt
> rechteckig, Sprites zeigen 45°-Frontansicht, Renderer macht Y-Sort der
> Props-Layer. Aktueller Stand siehe `CLAUDE.md` Render-Architektur.

**Status:** Tag 0. Leerer Ordner. Du bist die erste Claude-Instanz, die hier arbeitet.

## Mission Brief — was ist GrindHolm

Ein **2D-Top-Down-RPG mit offener Welt + Skill-Grind + Settlement-Building + Local-Coop**. Stardew Valley × Medieval Dynasty × Runescape-Skill-Breite. Der Spieler wählt selbst wo er sein Haus baut, baut sich eine eigene Siedlung auf, level Skills, später kommen Bewohner (Serfs) dazu, die er mit Essen versorgen muss damit sie für ihn arbeiten und Low-Skill-Tasks (Landwirtschaft, Holzfällen, Bergbau) automatisieren.

**Tonalität:** **Grounded, ruhig, kein Forced-Playstyle.** Der Spieler entscheidet ob er heute farmt, kämpft, redet oder einfach am Fluss sitzt. Tag/Nacht-Zyklus existiert, aber zwingt nichts.

**Story-Anker:** In der Welt gibt es eine zentrale Stadt — dort spielt die Hauptstory ab, NPCs, Quests. Drumherum offene Welt zum Erkunden + Bauen. (Konkrete Story-Plot kommt später, erstmal das Sandkasten-Framework.)

**Skill-Beispiel-Mechanik:**
> Bis Cooking-Level 20 produzierst du nur Niedrigstufiges Essen mit schwachen Effekten. Dieses Essen reicht aber für **Serfs** (deine Hilfsarbeiter), die damit zufriedengestellt sind und Low-Skill-Arbeiten erledigen können. Höhere Cooking-Level → bessere Buffs für dich/Story-Companions. So skaliert Skill-Progression durch die ganze Siedlung.

**Coop:**
- **Local-Coop** mit visible co-op partner — beide Spieler sehen sich auf der Map und spielen zusammen
- **Server läuft auf der NAS des Users** (siehe NAS-Zugang unten) via Tailscale
- **Multiplayer-Aware von Anfang an** — auch wenn 1.0 single-player-only ist, muss die Architektur Netcode später aufnehmen können (Entity-System mit Network-Owner, deterministische Server-State, etc.)

---

## 1.0 Scope — STRIKT (kein Feature-Creep!)

User-Vorgabe wörtlich: *„Bevor wir uns aber in Feature Creep verrennen, ein guter 1.0 Stand wäre: Wir haben die Projekt Struktur aufgesetzt, ein Git aufgesetzt, einen Spieler Charakter-Avatar den wir steuern können, und wir haben ein eigenes komplettes Framework und Dev Tools gebaut, damit wir in game wie in Godot oder in Unity Tiles auf der Map bauen können. Also 1.0 Soll eigentlich nur Framework bauen sein."*

### Was 1.0 enthalten muss
1. **Projekt-Struktur** — clean separation: `src/`, `frontend/`, `data/`, `assets/`, `server/`, `tools/`
2. **Git-Repo** initialisiert + erster Commit
3. **Spielbarer Avatar** — Charakter den man mit WASD/Arrow keys auf einer Tile-Map bewegen kann. Animation kann erstmal noch Still-Sprite mit Tween-Bobbing sein (siehe Art-Strategie unten)
4. **In-Game Dev-Tools** — wie Godot/Unity-Tile-Editor aber im laufenden Spiel:
   - Tile-Palette-Overlay (alle verfügbaren Tile-Sprites)
   - Click-to-paint auf Map
   - Brush-Größen, Layer-Switching (Boden / Objekte / Kollision)
   - Speichern in JSON-Map-Files
   - Hot-Reload ohne Restart
5. **Framework für spätere Content-Tools** — Skeleton-Endpoints/Schemas für:
   - Quest-Editor (data-driven JSON)
   - Dialog-Editor (Beat-System wie YGO Journey)
   - NPC-Schedule-Editor (NPCs an Tageszeit + Ort gebunden)
   - Item/Recipe-Editor

### Was 1.0 NICHT enthält
- Kein Coop-Netcode noch (nur Architektur dafür vorbereiten)
- Keine Skill-Implementation
- Keine Story
- Kein Combat
- Keine NPCs (nur das Editor-Schema)
- Keine Sounds, keine Musik
- Keine fertigen Quests
- Keine Save-Slots / Multi-Save (ein Slot reicht)

**Schreibe diese Liste oben in dein erstes CLAUDE.md im Repo so dass jeder zukünftige Run sich daran hält.**

---

## Tech-Stack — Empfehlung

**Vorbild:** YGO Journey (`C:\Users\MSchu\Documents\YGOJourney\`) hat genau die Pattern die wir hier brauchen — Python-Backend, JS-Frontend, JSON-Data, Hot-Reload, In-Game-Editoren. **Lies dort `CLAUDE.md` (falls existiert) + `src/ygojourney/app_window.py` + `frontend/app.js` für Patterns.** Insbesondere:
- `data/scenes/*.json` + `auto_triggers` Pattern
- `data/npcs/*.json` Schedule-Format
- Dev-Tool-Modus über Sidebar-Toggle
- PyWebView als Desktop-Wrapper

### Empfohlener Stack für GrindHolm

| Layer | Technologie | Warum |
|-------|-------------|-------|
| **Engine/Render** | **PixiJS 8** (Browser/Canvas) | Viel besser für Tile-2D-Performance als DOM/HTML. Kann tausende Tiles + Sprites flüssig rendern. Solide Animation-Support. |
| **UI-Overlays** | HTML/CSS auf Pixi-Canvas | Standard Web UI für Inventar, Dev-Tools, Dialoge — gleicher Pattern wie YGO Journey |
| **Backend (Single + Dev-Tools)** | **Python + FastAPI** | Mirror YGO-Journey-Pattern: hat sich bewährt, Hot-Reload via `uvicorn --reload` |
| **Wrapper** | **PyWebView** | Desktop-Feel, lokale Datei-Zugriffe, identisch zu YGO Journey |
| **Multiplayer-Server** (Phase 2+) | Python + WebSocket (`websockets` lib) auf NAS via Tailscale | Spiegel des YGO-Journey-PvP-Setups. NAS-Hosting ist beim User schon eingerichtet. |
| **Save-State** | SQLite (lokal) + JSON-Files in `data/` | Identisch zu YGO Journey |
| **Build/Dist** | Same wie YGO Journey: `make-distribution.bat` Pattern |

**Alternativ-Stack (falls du was anderes präferierst):** Reine Browser-App mit Phaser 3 + Node.js-Backend. Spar dir aber das Cross-Stack — der User ist Python+JS-Workflow gewöhnt aus dem YGO-Projekt, halte das konsistent.

**WARNING:** **Kein Godot, kein Unity, kein Unreal.** Der User will *„dass du 100% der Programmierung übernimmst"* — Editor-IDEs würden ihn in den Workflow zwingen. Alles in Code.

---

## Architektur-Notes — multiplayer-aware von Anfang an

Auch wenn 1.0 single-player ist, vermeide Pattern die später Networking blockieren:

1. **Entity-Component-System (ECS) oder ähnlich** — jede Entität (Spieler, NPC, Item) hat eine ID + Komponenten. Server kann später Authority pro Komponente zuweisen.
2. **State-Mutationen über Messages, nicht direkte Calls** — wenn der Spieler einen Tile platziert, geht das als `PlaceTileEvent` durch einen Bus. Single-player-Modus = Self-loop-Bus. MP-Modus = Server-Bus.
3. **Deterministisches Game-State** — Random Seeds, fixe Tick-Rate (z.B. 30 Hz), keine Wall-Clock-Time direkt im Game-Code.
4. **Network-Owner-Concept** — jede Entität hat einen Owner (lokaler Spieler / Server / anderer Spieler). 1.0: alle Owner = lokaler Spieler.
5. **Datentrennung Client/Server** — `shared/` Ordner für Game-Logic die auf beiden Seiten läuft, `client/` für Render-Only, `server/` für Authority-Only.

**Konkrete Folder-Empfehlung:**
```
GrindHolm/
├── client/          # Rendering, Input, UI (PixiJS)
│   ├── render/
│   ├── input/
│   ├── ui/
│   └── devtools/    # Tile-Editor, Dialog-Editor, etc.
├── server/          # Game-Logic + Multiplayer-Server (Python)
│   ├── game/        # Tick-Loop, Entity-Manager, State
│   ├── api/         # FastAPI HTTP + WebSocket
│   └── persistence/ # SQLite + JSON-Save
├── shared/          # Schemas/Constants/Pure-Logic, beides Seiten
│   ├── schemas/     # JSON-Schemas für Tile, Entity, Quest, etc.
│   └── proto/       # Network-Message-Definitionen
├── data/            # User-Content (handgeschrieben + Editor-Output)
│   ├── maps/        # *.json Tile-Maps
│   ├── tiles/       # Tile-Definitions (welcher Sprite, welche Kollision)
│   ├── entities/    # Entity-Definitions (NPCs, Items)
│   └── quests/      # Quest-Definitions
├── assets/          # Sprites, Sounds, Music
│   ├── tiles/
│   ├── chars/
│   └── ui/
├── tools/           # Standalone-Scripts (Asset-Pack-Importer, etc.)
└── docs/            # Design-Docs, dieses HANDOVER.md liegt hier rein
```

---

## Art-Strategie

User: *„Vielleicht einfach das game komplett auf Still-frames und 2D Images bauen ohne Animation und später dann machen?"* — **Ja, mach das.** Approach:

1. **Phase 1 (1.0 + Story-Start):** Still-Sprites (eine Pose pro Charakter) + Tween-Animation in Code (bob/scale/rotate für „Lebendigkeit"). Sieht gut genug aus, kostet 0 Animation-Skill.
2. **Phase 2 (später):** Walk-Cycles + Idle-Animations, optional pro Charakter.

**Asset-Quellen (alle CC0 oder CC-BY):**
- **Kenney.nl** — gigantische Top-Down-RPG-Asset-Packs, alles CC0. Tiles, Items, Charakter-Sprites. Start hier.
- **OpenGameArt.org** — gemischte Lizenzen, viel Pixel-Art-RPG-Material.
- **itch.io** Asset-Packs — viele kostenlose RPG-Asset-Releases.
- **Pixellab MCP-Server** — falls in der Claude-Session aktiv: `mcp__pixellab__create_character` generiert Pixel-Charaktere mit 4 Direction-Views per AI. Heißt: für custom NPCs einfach prompten statt selbst zeichnen. **Das ist dein Game-Changer für custom Charaktere.**

**1.0 Setup-Empfehlung:** Lade einen Kenney-Top-Down-RPG-Pack runter, integriere ein paar Tiles als Demo-Welt, ein paar Charakter-Sprites für den Avatar. Mehr nicht.

---

## Referenz: YGO Journey

**Pfad:** `C:\Users\MSchu\Documents\YGOJourney\`

**Was du dir dort anschauen solltest:**
- **`docs/Akt2-Plan.md`** — Beispiel für Story-Planning-Doc-Format
- **`src/ygojourney/app_window.py`** — Backend-API-Pattern, alle Endpoints für Frontend exposed über PyWebView-Bridge
- **`src/ygojourney/quests.py`** — Quest-Engine (auto-evaluate, flags, objectives, NPC-relationship-awards)
- **`src/ygojourney/state.py`** — SQLite-State-Management, story-flags-Pattern
- **`src/ygojourney/npc_world.py`** — NPC-Schedule-System (Zeit + Ort)
- **`src/ygojourney/npc_relations.py`** — Friendship-Tier-System, fog-of-war für Schedule-Reveal
- **`data/scenes/classroom-redeye.json`** — Auto-Trigger-Pattern, Hotspots, Open-Hours
- **`data/stories/*.json`** — Beat-basiertes Dialog-System mit Choices, set_flag, requires_flag, personality_tags
- **`data/quests/*.json`** — Quest-Schema (objectives, rewards, involved_npcs, next_quest)
- **`frontend/app.js`** — JS-Frontend mit PyWebView-API-Calls, Story-Renderer (`runStoryInPlace`, `renderBeat`)
- **`frontend/index.html`** — Sidebar, Card-Inspector-Panel, Layout-Pattern
- **`update.bat` + `src/ygojourney/updater.py`** — Auto-Update-Mechanismus für deployten Build (manifest-based)
- **`server/pvp_server.py`** — FastAPI-Server der auf der NAS läuft (Vorlage für GrindHolm-Multiplayer-Server)

**Konkrete Patterns die zu klauen sind:**
- **`auto_triggers` auf Scene-JSONs** — fires Story automatically wenn Spieler in Szene reinkommt + Flags matchen
- **`requires_flag` / `forbids_flag` an Choices/Beats** — gating ohne Code
- **Personality-Tag-System** (kind/grumpy/snarky/cheerful) — könnte für GrindHolm-NPC-Beziehungen wieder verwendet werden
- **Story-Flag als universelle Persistenz** — alles was später gating bestimmt, ist ein Flag in der State-DB
- **JSON-File-Hot-Reload via `invalidate_cache`** — Editor speichert, kein Restart

**Konkrete Patterns die du NICHT nehmen sollst:**
- DOM-basiertes Rendering — funktioniert in YGO Journey weil's hauptsächlich Story+UI ist. Bei einer Tile-RPG mit Bewegung ist das zu langsam, nimm PixiJS.
- HTML-Hotspot-System — bei einer offenen Welt brauchst du ein richtiges Tile-Collision-System, nicht 4-Punkt-Polygone.

---

## NAS-Zugang (für Multiplayer-Server, Phase 2+)

> Credentials sind nicht im Repo — sie liegen in der lokalen Claude-Memory
> der Maschine (`memory/reference_grindholm_nas.md`). Falls du in einer
> frischen Instanz arbeitest und sie brauchst, frag Marvin direkt.

**Setup-Empfehlung wenn du soweit bist (Phase 2):**
1. SSH-Key vom User generieren lassen, public key in `~/.ssh/authorized_keys` auf NAS hinterlegen — danach kein Passwort mehr nötig
2. `docker-compose.yml` für GrindHolm-Server unter `/server/` schreiben (analog YGO-Journey-PvP-Server)
3. GitHub-Repo `Kovy97/grindholm` (oder ähnlich) erstellen, NAS pullt via cron oder webhook
4. Tailscale-IP der NAS ist statisch, Spieler verbinden sich über `ws://<tailnet-ip>:<port>`

**ABER:** Phase 2-Stuff. Für 1.0 brauchst du das nicht.

---

## Was du am Tag 1 machen solltest

In dieser Reihenfolge:

1. **`git init`** in `D:\GrindHolm\`, ersten Commit nach Folder-Setup
2. **`CLAUDE.md`** anlegen (im Root) mit:
   - Mission Brief (kurz, 3 Sätze)
   - 1.0-Scope-Liste (oben aus diesem Dokument kopieren)
   - „Was du NICHT machen sollst"-Liste
3. **Folder-Struktur** anlegen wie oben empfohlen
4. **Tech-Stack-Bootstrap:**
   - Python venv + `requirements.txt` (fastapi, uvicorn, pywebview, pillow, python-dotenv)
   - `package.json` für Frontend (pixi.js v8, vite zum Bundlen)
   - Erstes `client/index.html` + Pixi-Stage die ein 50×50-Tile-Grid rendert
   - Einfacher Walking-Avatar mit WASD-Movement
5. **Erster Dev-Tool:** Tile-Painter — Sidebar mit Tile-Palette, Click-to-paint auf Map, Save-Button speichert in `data/maps/test.json`
6. **`run.bat` + `setup.bat`** wie YGO Journey, damit der User mit einem Klick starten kann
7. **Demo-Map** mit 1–2 Kenney-Asset-Tiles damit beim ersten Run was zu sehen ist
8. **Push zu GitHub** sobald Repo aufgesetzt + erster Build funktioniert

**Halt dich an die 1.0-Scope-Liste. Wenn der User „ach kannst du noch X einbauen" sagt — frag erst, ob das nicht schon Feature-Creep ist.**

---

## Wichtige User-Präferenzen (aus YGO-Projekt-Erfahrung)

- **Antwort-Sprache:** Deutsch
- **Code-Kommentare:** dürfen englisch sein
- **Story-Schreibstil:** **Keine Bindestriche „-" in Dialogen**, nur Em-Dash „—" und zusammengeschriebene Komposita. Generisches Maskulinum (kein „Schüler:innen"-Doppelpunkt-Gendering).
- **Direkte Iteration:** Der User will lieber konkrete Vorschläge mit klarer Empfehlung + Tradeoff als Mehrfach-Wahl-Fragen. Kurz und entscheidungsfähig.
- **Refactoring-Stil:** Beim Move/Refactor Source-Files **moven, nicht kopieren** — sonst bleiben Platzhalter rum.
- **Push-zu-NAS-Flow** (sobald wir bei MP sind): Push GitHub → SSH umbrel → `docker compose up -d --build`. Volume-Bind-Mounts preserven Spieler-Daten.

---

## Memory & Persistenz

Wenn du als Claude-Code-Instanz auf diesem Projekt arbeitest, hast du wahrscheinlich Auto-Memory aktiviert. Lege fest:

```markdown
- [GrindHolm Project](project_grindholm.md) — 2D-Top-Down-Sandbox-RPG mit Local-Coop. Path D:\GrindHolm\. 1.0 = Framework + Tile-Editor only.
- [GrindHolm NAS](reference_grindholm_nas.md) — Multiplayer-Server-Host umbrel@umbrel.local. Phase 2+. Credentials in lokaler Memory.
```

---

## Wenn Marvin (User) was Neues will

**Frage zuerst:** „Ist das in 1.0-Scope, oder schieben wir das auf 1.1?" Bevor irgendwas neues angefangen wird. Das ist der wichtigste Trigger gegen Feature-Creep.

---

**Viel Erfolg, neue Claude-Instanz. Mach's solide. Geh nicht zu schnell vor. Lies erst mal die Referenz-Files in YGO Journey bevor du Code schreibst.**
