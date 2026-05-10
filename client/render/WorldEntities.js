import { Container, Graphics, Sprite, Assets } from "pixi.js";
import { TILE_SIZE } from "./Stage.js";

// Renders resource nodes (trees, fishing spots) and placed buildings into
// the same Y-sorted "props" container as the avatar, so depth works.
// The instance is the source of truth — call sync() each frame, it
// reconciles diff against the previous render.
export class WorldEntitiesRenderer {
  constructor({ stage, nodeDefs, buildingDefs }) {
    this._stage = stage;
    this._nodeDefs = new Map((nodeDefs || []).map((d) => [d.id, d]));
    this._buildingDefs = new Map((buildingDefs || []).map((d) => [d.id, d]));
    this._nodeNodes = new Map(); // node_inst.id -> Container
    this._bldNodes = new Map();
  }

  setData(nodeInstances, buildingInstances, npcInstances) {
    this._reconcile(this._nodeNodes, nodeInstances || {}, (inst) =>
      this._renderNode(inst),
    );
    this._reconcile(this._bldNodes, buildingInstances || {}, (inst) =>
      this._renderBuilding(inst),
    );
    if (!this._npcNodes) this._npcNodes = new Map();
    this._reconcile(this._npcNodes, npcInstances || {}, (inst) =>
      this._renderNpc(inst),
    );
    // Update NPC positions / states each frame
    if (npcInstances) {
      for (const id in npcInstances) {
        const node = this._npcNodes.get(id);
        if (!node) continue;
        const inst = npcInstances[id];
        const wx = inst.tile_x * TILE_SIZE;
        const wy = inst.tile_y * TILE_SIZE;
        node.x = Math.round(wx);
        node.y = Math.round(wy);
        node.zIndex = wy + 12 * (TILE_SIZE / 32);
      }
    }
  }

  /** Returns the resource-node instance under (tx, ty), or null. */
  nodeAt(nodeInstances, tx, ty) {
    for (const id in nodeInstances) {
      const n = nodeInstances[id];
      const def = this._nodeDefs.get(n.def_id);
      if (!def) continue;
      const w = Math.max(1, Math.floor(def.width_tiles));
      const h = Math.max(1, Math.floor(def.height_tiles));
      if (tx >= n.tile_x && tx < n.tile_x + w && ty >= n.tile_y && ty < n.tile_y + h) {
        return n;
      }
    }
    return null;
  }

  /** Returns the building-instance under (tx, ty), or null. */
  buildingAt(buildingInstances, tx, ty) {
    for (const id in buildingInstances) {
      const b = buildingInstances[id];
      const def = this._buildingDefs.get(b.def_id);
      if (!def) continue;
      for (let dx = 0; dx < def.width_tiles; dx++) {
        for (let dy = 0; dy < def.height_tiles; dy++) {
          if (b.tile_x + dx === tx && b.tile_y + dy === ty) return b;
        }
      }
    }
    return null;
  }

  _reconcile(cache, instances, factory) {
    const seen = new Set();
    for (const id in instances) {
      seen.add(id);
      if (cache.has(id)) {
        const node = cache.get(id);
        node.zIndex = (instances[id].tile_y + 1) * TILE_SIZE;
        // also update visible state for depleted nodes
        if (instances[id].remaining_yield !== undefined) {
          node.alpha = instances[id].remaining_yield <= 0 ? 0.35 : 1.0;
        }
        continue;
      }
      const node = factory(instances[id]);
      if (node) {
        cache.set(id, node);
        this._stage.layers.props.addChild(node);
      }
    }
    // remove any cached node not present in incoming data
    for (const [id, node] of cache) {
      if (!seen.has(id)) {
        node.destroy({ children: true });
        cache.delete(id);
      }
    }
  }

  _renderNode(inst) {
    const def = this._nodeDefs.get(inst.def_id);
    if (!def) return null;
    const widthPx = TILE_SIZE * (def.width_tiles ?? 1.0);
    const heightPx = TILE_SIZE * (def.height_tiles ?? 1.0);
    const footY = (inst.tile_y + 1) * TILE_SIZE;
    const footCenterX = (inst.tile_x + 0.5) * TILE_SIZE;
    const node = new Container();
    node.x = footCenterX - widthPx / 2;
    node.y = footY;
    node.zIndex = footY;

    const tex = def.sprite ? Assets.get(`/sprites/${def.sprite}`) : null;
    if (tex) {
      const s = new Sprite(tex);
      s.width = widthPx;
      s.height = heightPx;
      s.x = 0;
      s.y = -heightPx;
      node.addChild(s);
    } else {
      this._procNode(node, def, widthPx, heightPx);
    }
    if (inst.remaining_yield <= 0) node.alpha = 0.35;
    node.eventMode = "none"; // we handle clicks via the world canvas
    return node;
  }

  _renderBuilding(inst) {
    const def = this._buildingDefs.get(inst.def_id);
    if (!def) return null;
    const widthPx = TILE_SIZE * def.width_tiles;
    const heightPx = TILE_SIZE * def.sprite_height_tiles;
    const footY = (inst.tile_y + def.height_tiles) * TILE_SIZE;
    const footCenterX = (inst.tile_x + def.width_tiles / 2) * TILE_SIZE;
    const node = new Container();
    node.x = footCenterX - widthPx / 2;
    node.y = footY;
    node.zIndex = footY;

    const tex = def.sprite ? Assets.get(`/sprites/${def.sprite}`) : null;
    if (tex) {
      const s = new Sprite(tex);
      s.width = widthPx;
      s.height = heightPx;
      s.x = 0;
      s.y = -heightPx;
      node.addChild(s);
    } else {
      this._procNode(node, def, widthPx, heightPx);
    }
    return node;
  }

  _renderNpc(inst) {
    const node = new Container();
    const wx = inst.tile_x * TILE_SIZE;
    const wy = inst.tile_y * TILE_SIZE;
    node.x = Math.round(wx);
    node.y = Math.round(wy);
    node.zIndex = wy + 12 * (TILE_SIZE / 32);
    const scale = TILE_SIZE / 32;
    node.scale.set(scale);
    const g = new Graphics();
    const color = parseInt((inst.color || "#7a7060").slice(1), 16);
    // shadow
    g.ellipse(0, 11, 9, 3).fill({ color: 0x000000, alpha: 0.35 });
    // body
    g.roundRect(-7, -5, 14, 16, 3).fill({ color });
    // head
    g.circle(0, -9, 5).fill({ color: 0xeacb9b });
    // name tag (small, draws above sprite)
    const nameLabel = document.createElement("div"); // not used in pixi but kept for future
    node.addChild(g);
    return node;
  }

  _procNode(node, def, widthPx, heightPx) {
    const g = new Graphics();
    const color = def.color || "#ff00ff";
    const baseHeight = Math.min(TILE_SIZE, heightPx * 0.45);
    const crownHeight = heightPx - baseHeight;
    // shadow
    g.ellipse(widthPx / 2, 0, widthPx * 0.4, TILE_SIZE * 0.18)
      .fill({ color: 0x000000, alpha: 0.3 });
    if (baseHeight > 0) {
      const trunkW = widthPx * 0.4;
      g.rect((widthPx - trunkW) / 2, -baseHeight, trunkW, baseHeight)
        .fill({ color });
    }
    if (crownHeight > 0) {
      const crownColor = lighten(color, 0.18);
      g.rect(2, -heightPx, widthPx - 4, crownHeight)
        .fill({ color: crownColor })
        .stroke({ color: 0x000000, alpha: 0.4, width: 1 });
    }
    node.addChild(g);
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
