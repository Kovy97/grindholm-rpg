import { Action, Context } from "../input/actions.js";
import { TILE_SIZE } from "../render/Stage.js";

// F1 live overlay: paint tiles while the world keeps ticking.
// - hover-cursor highlight on top of pixi
// - left-mouse paint, right-mouse erase, drag continues
// - layer toggle (ground/objects/collision)
// - "freeze avatar" toggle to walk-while-edit
// - Save button -> backend -> cache invalidate -> reload map
export class TilePainter {
  constructor({ root, stage, tileMap, tileDefs, bus, contextStack, mapper, api, avatar, onSaved }) {
    this._root = root;
    this._stage = stage;
    this._tileMap = tileMap;
    this._defs = tileDefs;
    this._bus = bus;
    this._stack = contextStack;
    this._mapper = mapper;
    this._api = api;
    this._avatar = avatar;
    this._onSaved = onSaved || (() => {});
    this._active = false;
    this._dirty = false;
    this._currentLayer = "ground";
    this._currentTileId = tileDefs.find((t) => t.layer === "ground")?.id ?? null;
    this._eraseMode = false;
    this._brush = 1;
    this._freezeAvatar = true;

    this._buildDom();
    this._wireActions();
  }

  _buildDom() {
    this._root.classList.add("hidden");
    this._root.innerHTML = "";

    const bar = document.createElement("div");
    bar.className = "dev-toolbar";

    bar.appendChild(this._sectionLayer());
    bar.appendChild(this._sectionPalette());
    bar.appendChild(this._sectionBrush());
    bar.appendChild(this._sectionToggles());
    bar.appendChild(this._sectionActions());
    bar.appendChild(this._sectionStatus());

    this._root.appendChild(bar);

    // hover indicator (DOM box positioned over canvas)
    const hover = document.createElement("div");
    hover.style.cssText =
      "position:absolute;border:2px solid #b8a06b;pointer-events:none;width:32px;height:32px;display:none;";
    this._root.appendChild(hover);
    this._hoverEl = hover;
  }

  _sectionLayer() {
    const sec = document.createElement("div");
    sec.className = "dev-section";
    const label = document.createElement("label");
    label.textContent = "Layer:";
    sec.appendChild(label);
    for (const layer of ["ground", "objects", "collision"]) {
      const b = document.createElement("button");
      b.className = "dev-btn";
      b.textContent = layer;
      b.dataset.layer = layer;
      if (layer === this._currentLayer) b.classList.add("active");
      b.addEventListener("click", () => {
        this._currentLayer = layer;
        const firstTile = this._defs.find((t) => t.layer === layer);
        this._currentTileId = firstTile?.id ?? null;
        this._eraseMode = false;
        this._refreshLayerButtons();
        this._refreshPalette();
      });
      sec.appendChild(b);
    }
    return sec;
  }

  _sectionPalette() {
    const sec = document.createElement("div");
    sec.className = "dev-section";
    sec.id = "dp-palette";
    const label = document.createElement("label");
    label.textContent = "Tile:";
    sec.appendChild(label);
    this._paletteHost = sec;
    this._refreshPalette();
    return sec;
  }

  _refreshPalette() {
    if (!this._paletteHost) return;
    // remove all but the label
    while (this._paletteHost.children.length > 1) {
      this._paletteHost.removeChild(this._paletteHost.lastChild);
    }
    const eraser = document.createElement("button");
    eraser.className = "tile-btn eraser";
    eraser.textContent = "✕";
    eraser.title = "Eraser";
    if (this._eraseMode) eraser.classList.add("active");
    eraser.addEventListener("click", () => {
      this._eraseMode = true;
      this._refreshPalette();
    });
    this._paletteHost.appendChild(eraser);

    for (const def of this._defs.filter((d) => d.layer === this._currentLayer)) {
      const btn = document.createElement("button");
      btn.className = "tile-btn";
      btn.title = `${def.name} (${def.id}) — ${def.walkable ? "walkable" : "blocked"}`;
      btn.style.background = def.color || "#ff00ff";
      if (!this._eraseMode && def.id === this._currentTileId) btn.classList.add("active");
      btn.addEventListener("click", () => {
        this._currentTileId = def.id;
        this._eraseMode = false;
        this._refreshPalette();
      });
      this._paletteHost.appendChild(btn);
    }
  }

  _refreshLayerButtons() {
    const buttons = this._root.querySelectorAll("button[data-layer]");
    for (const b of buttons) {
      b.classList.toggle("active", b.dataset.layer === this._currentLayer);
    }
  }

  _sectionBrush() {
    const sec = document.createElement("div");
    sec.className = "dev-section";
    const label = document.createElement("label");
    label.textContent = "Brush:";
    sec.appendChild(label);
    for (const size of [1, 3, 5]) {
      const b = document.createElement("button");
      b.className = "dev-btn";
      b.textContent = `${size}×${size}`;
      if (size === this._brush) b.classList.add("active");
      b.addEventListener("click", () => {
        this._brush = size;
        for (const x of sec.querySelectorAll("button")) x.classList.remove("active");
        b.classList.add("active");
      });
      sec.appendChild(b);
    }
    return sec;
  }

  _sectionToggles() {
    const sec = document.createElement("div");
    sec.className = "dev-section";
    const freeze = document.createElement("button");
    freeze.className = "dev-btn";
    freeze.textContent = "freeze avatar";
    if (this._freezeAvatar) freeze.classList.add("active");
    freeze.title = "If on, WASD does nothing while painting";
    freeze.addEventListener("click", () => {
      this._freezeAvatar = !this._freezeAvatar;
      freeze.classList.toggle("active", this._freezeAvatar);
      this._updateAvatarFreeze();
    });
    sec.appendChild(freeze);

    const collDbg = document.createElement("button");
    collDbg.className = "dev-btn";
    collDbg.textContent = "show collision";
    collDbg.addEventListener("click", () => {
      const next = !this._collisionDebug;
      this._collisionDebug = next;
      collDbg.classList.toggle("active", next);
      this._stage.setCollisionDebug(next);
    });
    sec.appendChild(collDbg);

    return sec;
  }

  _sectionActions() {
    const sec = document.createElement("div");
    sec.className = "dev-section";
    const save = document.createElement("button");
    save.className = "dev-btn";
    save.textContent = "Save";
    save.addEventListener("click", () => this._save());
    sec.appendChild(save);

    const reload = document.createElement("button");
    reload.className = "dev-btn";
    reload.textContent = "Reload";
    reload.title = "Discard local changes, reload from disk";
    reload.addEventListener("click", () => this._reload());
    sec.appendChild(reload);

    return sec;
  }

  _sectionStatus() {
    const sec = document.createElement("div");
    sec.className = "dev-status";
    sec.id = "dp-status";
    sec.textContent = "ready";
    this._statusEl = sec;
    return sec;
  }

  _setStatus(msg, color = null) {
    if (!this._statusEl) return;
    this._statusEl.textContent = msg;
    this._statusEl.style.color = color || "";
  }

  _wireActions() {
    // Toggle dev overlay (works in both 'game' and 'dev_overlay' contexts)
    this._bus.on(Action.TOGGLE_DEV_OVERLAY, "press", () => this._toggleActive());
    this._bus.on(Action.CANCEL, "press", () => {
      if (this._active) this._toggleActive();
    });
  }

  _toggleActive() {
    this._active = !this._active;
    if (this._active) {
      this._stack.push(Context.DEV_OVERLAY);
      this._root.classList.remove("hidden");
      this._updateAvatarFreeze();
    } else {
      this._stack.pop(Context.DEV_OVERLAY);
      this._root.classList.add("hidden");
      this._hoverEl.style.display = "none";
      this._avatar?.freeze(false);
    }
  }

  _updateAvatarFreeze() {
    if (this._active && this._freezeAvatar) this._avatar?.freeze(true);
    else this._avatar?.freeze(false);
  }

  /** Called every game tick. */
  update() {
    if (!this._active) return;
    const { x, y } = this._mapper.mousePos;
    const { tx, ty } = this._stage.screenToTile(x, y);
    if (
      tx < 0 ||
      ty < 0 ||
      tx >= this._tileMap.map.width ||
      ty >= this._tileMap.map.height
    ) {
      this._hoverEl.style.display = "none";
      return;
    }
    // hover highlight (in screen space) — scales with camera zoom
    const z = this._stage.zoom;
    const tilePx = TILE_SIZE * z;
    const wx = tx * tilePx + this._stage.world.x;
    const wy = ty * tilePx + this._stage.world.y;
    const size = tilePx * this._brush;
    const half = Math.floor(this._brush / 2) * tilePx;
    this._hoverEl.style.display = "block";
    this._hoverEl.style.left = `${wx - half}px`;
    this._hoverEl.style.top = `${wy - half}px`;
    this._hoverEl.style.width = `${size}px`;
    this._hoverEl.style.height = `${size}px`;

    // paint actions
    if (this._bus.isHeld(Action.PAINT_PRIMARY)) this._paintAt(tx, ty, false);
    else if (this._bus.isHeld(Action.PAINT_SECONDARY)) this._paintAt(tx, ty, true);
  }

  _paintAt(cx, cy, eraseOverride) {
    const erase = eraseOverride || this._eraseMode;
    const tileId = erase ? null : this._currentTileId;
    if (!erase && !tileId) return;
    const half = Math.floor(this._brush / 2);
    let touched = 0;
    for (let oy = -half; oy <= half; oy++) {
      for (let ox = -half; ox <= half; ox++) {
        const tx = cx + ox;
        const ty = cy + oy;
        if (
          tx < 0 ||
          ty < 0 ||
          tx >= this._tileMap.map.width ||
          ty >= this._tileMap.map.height
        ) {
          continue;
        }
        const layer = this._tileMap.map.layers.find((l) => l.layer === this._currentLayer);
        if (!layer) continue;
        const idx = ty * this._tileMap.map.width + tx;
        if (layer.cells[idx] === tileId) continue;
        this._tileMap.paintCell(this._currentLayer, tx, ty, tileId);
        touched++;
      }
    }
    if (touched > 0) {
      this._dirty = true;
      this._setStatus(`unsaved (${this._dirtyMark()})`, "#e9c46a");
    }
  }

  _dirtyMark() {
    return new Date().toLocaleTimeString();
  }

  async _save() {
    try {
      this._setStatus("saving…");
      const m = this._tileMap.map;
      await this._api.saveMap(m.id, m);
      this._dirty = false;
      this._setStatus(`saved ${this._dirtyMark()}`, "#88c070");
      this._onSaved(m.id);
    } catch (err) {
      console.error(err);
      this._setStatus(`save failed: ${err.message}`, "#c45a5a");
    }
  }

  async _reload() {
    if (this._dirty && !confirm("Discard unsaved changes?")) return;
    try {
      this._setStatus("reloading…");
      const m = await this._api.getMap(this._tileMap.map.id);
      this._tileMap.setMap(m);
      this._dirty = false;
      this._setStatus("reloaded", "#88c070");
    } catch (err) {
      console.error(err);
      this._setStatus(`reload failed: ${err.message}`, "#c45a5a");
    }
  }
}
