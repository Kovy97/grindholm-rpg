import { Container, Graphics } from "pixi.js";
import { TILE_SIZE } from "./Stage.js";

// Renders a TileMap into the Stage's layer containers.
// 1.0 uses procedural fallback rendering (colored rects from TileDef.color).
// Replace fillRect() with sprite atlas later, no other changes needed.
export class TileMapRenderer {
  constructor({ stage, tileDefs }) {
    this._stage = stage;
    this._defs = new Map(tileDefs.map((t) => [t.id, t]));
    this._cellsByLayer = new Map();
    this._gridLines = null;
    this._dirty = new Set();
    this._map = null;
  }

  setMap(map) {
    this._map = map;
    this._clearAll();
    for (const layer of map.layers) {
      this._renderLayer(layer);
    }
    this._renderGrid(map);
  }

  /** Repaint a single tile cell — for live editor use. */
  paintCell(layerName, tx, ty, tileId) {
    if (!this._map) return;
    const layer = this._map.layers.find((l) => l.layer === layerName);
    if (!layer) return;
    const idx = ty * this._map.width + tx;
    if (idx < 0 || idx >= layer.cells.length) return;
    layer.cells[idx] = tileId;
    this._renderLayer(layer);
  }

  get map() {
    return this._map;
  }

  isWalkable(tx, ty) {
    if (!this._map) return false;
    if (tx < 0 || ty < 0 || tx >= this._map.width || ty >= this._map.height) return false;
    const idx = ty * this._map.width + tx;
    for (const layer of this._map.layers) {
      const id = layer.cells[idx];
      if (!id) continue;
      const def = this._defs.get(id);
      if (def && !def.walkable) return false;
    }
    return true;
  }

  _renderLayer(layer) {
    const container = this._stage.layers[layer.layer];
    if (!container) return;
    container.removeChildren();
    const g = new Graphics();
    for (let i = 0; i < layer.cells.length; i++) {
      const id = layer.cells[i];
      if (!id) continue;
      const def = this._defs.get(id);
      if (!def) continue;
      const tx = i % this._map.width;
      const ty = Math.floor(i / this._map.width);
      const x = tx * TILE_SIZE;
      const y = ty * TILE_SIZE;
      const color = def.color ?? "#ff00ff";
      g.rect(x, y, TILE_SIZE, TILE_SIZE).fill({ color });
      // Subtle outline on objects/collision so they read distinctly
      if (layer.layer === "objects") {
        g.rect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2)
          .stroke({ color: 0x000000, alpha: 0.35, width: 1 });
      } else if (layer.layer === "collision") {
        g.rect(x, y, TILE_SIZE, TILE_SIZE)
          .stroke({ color: 0xff4040, width: 2 });
      }
    }
    container.addChild(g);
  }

  _renderGrid(map) {
    // Faint gridlines on top of ground layer for editor orientation
    const grid = new Graphics();
    const w = map.width * TILE_SIZE;
    const h = map.height * TILE_SIZE;
    for (let x = 0; x <= map.width; x++) {
      grid
        .moveTo(x * TILE_SIZE, 0)
        .lineTo(x * TILE_SIZE, h)
        .stroke({ color: 0x000000, alpha: 0.08, width: 1 });
    }
    for (let y = 0; y <= map.height; y++) {
      grid
        .moveTo(0, y * TILE_SIZE)
        .lineTo(w, y * TILE_SIZE)
        .stroke({ color: 0x000000, alpha: 0.08, width: 1 });
    }
    grid.alpha = 0.6;
    this._gridLines = grid;
    this._stage.layers.ground.addChild(grid);
  }

  _clearAll() {
    for (const key of Object.keys(this._stage.layers)) {
      if (key === "entities") continue;
      this._stage.layers[key].removeChildren();
    }
  }
}
