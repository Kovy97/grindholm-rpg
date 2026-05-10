import { Container, Graphics } from "pixi.js";
import { TILE_SIZE } from "./Stage.js";

// 3/4-perspective renderer. Three render passes per map:
//   ground:   one flat Graphics covering the whole ground layer (cheap)
//   props:    one Container per non-ground tile, anchored at its FOOT and
//             sorted by zIndex = footPx so taller tiles overlap correctly
//             with the avatar (which is also in this layer)
//   debug:    red outlines for collision-layer tiles (toggle)
//
// Procedural fallback simulates 3/4 perspective by drawing a darker footprint
// rect (the "shadow / trunk") at the bottom of the sprite and a lighter
// crown rect above it. Replace _renderProp with sprite-atlas calls later.
export class TileMapRenderer {
  constructor({ stage, tileDefs }) {
    this._stage = stage;
    this._defs = new Map(tileDefs.map((t) => [t.id, t]));
    this._map = null;
    this._propNodes = new Map(); // "tx,ty" -> Container
  }

  setMap(map) {
    this._map = map;
    this._clearAll();
    this._renderGround(map);
    for (const layer of map.layers) {
      if (layer.layer === "ground") continue;
      this._renderObjectLayer(layer);
    }
  }

  /** Repaint a single tile cell — for live editor use. */
  paintCell(layerName, tx, ty, tileId) {
    if (!this._map) return;
    const layer = this._map.layers.find((l) => l.layer === layerName);
    if (!layer) return;
    const idx = ty * this._map.width + tx;
    if (idx < 0 || idx >= layer.cells.length) return;
    layer.cells[idx] = tileId;

    if (layerName === "ground") {
      // Cheap: re-render the whole ground pass. Fast for grids up to a
      // few hundred tiles per side.
      this._renderGround(this._map);
    } else {
      // Targeted: replace just this cell's prop node.
      this._renderPropCell(layerName, tx, ty, tileId);
    }
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

  _renderGround(map) {
    const container = this._stage.layers.ground;
    container.removeChildren();
    const g = new Graphics();
    const ground = map.layers.find((l) => l.layer === "ground");
    if (ground) {
      for (let i = 0; i < ground.cells.length; i++) {
        const id = ground.cells[i];
        if (!id) continue;
        const def = this._defs.get(id);
        if (!def) continue;
        const tx = i % map.width;
        const ty = Math.floor(i / map.width);
        g.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE)
          .fill({ color: def.color ?? "#ff00ff" });
      }
    }
    // faint gridlines for editor orientation
    const w = map.width * TILE_SIZE;
    const h = map.height * TILE_SIZE;
    for (let x = 0; x <= map.width; x++) {
      g.moveTo(x * TILE_SIZE, 0).lineTo(x * TILE_SIZE, h)
        .stroke({ color: 0x000000, alpha: 0.08, width: 1 });
    }
    for (let y = 0; y <= map.height; y++) {
      g.moveTo(0, y * TILE_SIZE).lineTo(w, y * TILE_SIZE)
        .stroke({ color: 0x000000, alpha: 0.08, width: 1 });
    }
    container.addChild(g);
  }

  _renderObjectLayer(layer) {
    for (let i = 0; i < layer.cells.length; i++) {
      const id = layer.cells[i];
      if (!id) continue;
      const tx = i % this._map.width;
      const ty = Math.floor(i / this._map.width);
      this._renderPropCell(layer.layer, tx, ty, id);
    }
  }

  _renderPropCell(layerName, tx, ty, tileId) {
    const key = `${tx},${ty},${layerName}`;
    const existing = this._propNodes.get(key);
    if (existing) {
      existing.destroy({ children: true });
      this._propNodes.delete(key);
      // Also remove the matching debug outline if any
      const debugKey = `dbg:${key}`;
      const dbg = this._propNodes.get(debugKey);
      if (dbg) {
        dbg.destroy({ children: true });
        this._propNodes.delete(debugKey);
      }
    }
    if (!tileId) return;
    const def = this._defs.get(tileId);
    if (!def) return;

    const widthPx = TILE_SIZE * (def.width_tiles ?? 1.0);
    const heightPx = TILE_SIZE * (def.height_tiles ?? 1.0);
    const footY = (ty + 1) * TILE_SIZE; // bottom edge of the tile
    // bottom-center anchor: sprite of width widthPx is centered over tile tx
    const footCenterX = (tx + 0.5) * TILE_SIZE;
    const node = new Container();
    node.x = footCenterX - widthPx / 2;
    node.y = footY;
    node.zIndex = footY; // Y-sort key
    this._drawProp(node, def, widthPx, heightPx);
    this._stage.layers.props.addChild(node);
    this._propNodes.set(key, node);

    // Collision-layer tiles also get a debug outline overlay
    if (layerName === "collision") {
      const dbg = new Graphics()
        .rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        .stroke({ color: 0xff4040, width: 2, alignment: 0 });
      this._stage.layers.debug.addChild(dbg);
      this._propNodes.set(`dbg:${key}`, dbg);
    }
  }

  /** Procedural 3/4 prop: darker base footprint + lighter crown above.
   *  Drawn in the prop container's local coords with origin at the bottom-left
   *  corner of the sprite bounding box (widthPx x heightPx). */
  _drawProp(node, def, widthPx, heightPx) {
    const g = new Graphics();
    const baseColor = def.color ?? "#ff00ff";
    const crownColor = lighten(baseColor, 0.18);
    // The trunk takes the lower 45% of the height, capped at one tile so
    // tall sprites (trees) read as "tall thin trunk + wide canopy"
    const baseHeight = Math.min(TILE_SIZE, heightPx * 0.45);
    const crownHeight = heightPx - baseHeight;

    // Trunk is always one footprint-tile wide regardless of canopy width
    const trunkWidth = TILE_SIZE * (def.width_tiles >= 1.5 ? 0.45 : 0.85);
    const trunkX = (widthPx - trunkWidth) / 2;

    // Soft shadow ellipse on the ground at the foot. Width follows the
    // canopy so big trees cast wider shade.
    g.ellipse(widthPx / 2, 0, widthPx * 0.4, TILE_SIZE * 0.18)
      .fill({ color: 0x000000, alpha: 0.3 });

    // Trunk / base
    if (baseHeight > 0) {
      g.rect(trunkX, -baseHeight, trunkWidth, baseHeight)
        .fill({ color: baseColor })
        .stroke({ color: 0x000000, alpha: 0.4, width: 1 });
    }
    // Crown: lighter, full sprite-width
    if (crownHeight > 0) {
      const inset = heightPx > TILE_SIZE * 1.5 ? 6 : 2;
      g.rect(inset, -heightPx, widthPx - inset * 2, crownHeight)
        .fill({ color: crownColor })
        .stroke({ color: 0x000000, alpha: 0.4, width: 1 });
    }
    node.addChild(g);
  }

  _clearAll() {
    this._stage.layers.ground.removeChildren();
    for (const node of this._propNodes.values()) node.destroy({ children: true });
    this._propNodes.clear();
    this._stage.layers.props.removeChildren();
    this._stage.layers.debug.removeChildren();
  }
}

function lighten(hex, amount) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  r = Math.min(255, Math.round(r + (255 - r) * amount));
  g = Math.min(255, Math.round(g + (255 - g) * amount));
  b = Math.min(255, Math.round(b + (255 - b) * amount));
  return (r << 16) | (g << 8) | b;
}
