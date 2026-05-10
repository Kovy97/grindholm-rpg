import { api } from "../api.js";

// Single source of truth for game state on the client. Owns server snapshot,
// notifies listeners on change, exposes derived caches (itemsById,
// nodeDefsById etc.) and provides convenience actions for higher-level UI
// flows (e.g. tryCookFromSlot which finds a fire and submits the recipe).
export class GameClient {
  constructor() {
    this.state = null; // server snapshot
    this.itemsById = new Map();
    this.recipesById = new Map();
    this.nodeDefsById = new Map();
    this.buildingDefs = [];
    this.buildingDefsById = new Map();
    this.npcArchetypes = [];
    this.tilesById = new Map();
    this._listeners = new Set();
    this._busy = false;
  }

  async init(tiles) {
    this.tilesById = new Map(tiles.map((t) => [t.id, t]));
    await api.bootstrap();
    const [items, recipes, nodeDefs, bldDefs, archs, state] = await Promise.all([
      api.getItems(),
      api.getRecipes(),
      api.getNodeDefs(),
      api.getBuildingDefs(),
      api.getNpcArchetypes(),
      api.getState(),
    ]);
    this.itemsById = new Map(items.map((i) => [i.id, i]));
    this.recipesById = new Map(recipes.map((r) => [r.id, r]));
    this.nodeDefsById = new Map(nodeDefs.map((n) => [n.id, n]));
    this.buildingDefs = bldDefs;
    this.buildingDefsById = new Map(bldDefs.map((b) => [b.id, b]));
    this.npcArchetypes = archs;
    this.state = state;
    this._notify();
  }

  onState(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  _notify() {
    for (const cb of this._listeners) {
      try {
        cb(this.state);
      } catch (e) {
        console.error("[gc] listener error", e);
      }
    }
  }

  async refreshState() {
    this.state = await api.getState();
    this._notify();
  }

  toast(msg, cls = "") {
    if (this._toastFn) this._toastFn(msg, cls);
    else console.log(`[toast/${cls}] ${msg}`);
  }
  bindToast(fn) {
    this._toastFn = fn;
  }

  async tryHarvest(nodeId) {
    if (this._busy) return;
    this._busy = true;
    try {
      const r = await api.harvest(nodeId);
      if (r.success) {
        this.toast(r.message, "success");
        for (const lvl of r.leveled_up) this.toast(`Level up! ${lvl}`, "xp");
        for (const xp of r.xp_grants) this.toast(`+${xp.amount} ${xp.skill} xp`, "xp");
      } else {
        this.toast(r.message, "error");
      }
      await this.refreshState();
    } finally {
      this._busy = false;
    }
  }

  async tryCookFromSlot(slotIdx) {
    const slot = this.state?.player?.inventory?.slots?.[slotIdx];
    if (!slot) return;
    const item = this.itemsById.get(slot.item_id);
    if (!item || !item.cookable_into) {
      this.toast(`${item?.name || "That"} isn't cookable.`, "error");
      return;
    }
    // find a recipe that takes this item id and produces the cookable_into
    let recipe = null;
    for (const r of this.recipesById.values()) {
      const inOk = r.inputs.find((i) => i.item_id === item.id);
      if (inOk && r.output_item_id === item.cookable_into) {
        recipe = r;
        break;
      }
    }
    if (!recipe) {
      this.toast("No recipe found.", "error");
      return;
    }
    await this.tryCraft(recipe.id);
  }

  async tryCraft(recipeId, near = null) {
    if (this._busy) return;
    this._busy = true;
    try {
      const px = Math.floor(this.state?.player?.tile_x ?? 0);
      const py = Math.floor(this.state?.player?.tile_y ?? 0);
      const r = await api.craft(recipeId, near?.x ?? px, near?.y ?? py);
      if (r.success) {
        this.toast(r.message, "success");
        for (const lvl of r.leveled_up) this.toast(`Level up! ${lvl}`, "xp");
      } else {
        this.toast(r.message, "error");
      }
      await this.refreshState();
    } finally {
      this._busy = false;
    }
  }

  async tryBuild(buildingDefId, tx, ty) {
    if (this._busy) return;
    this._busy = true;
    try {
      const r = await api.build(buildingDefId, tx, ty);
      if (r.success) {
        this.toast(r.message, "success");
        for (const lvl of r.leveled_up) this.toast(`Level up! ${lvl}`, "xp");
      } else {
        this.toast(r.message, "error");
      }
      await this.refreshState();
    } finally {
      this._busy = false;
    }
  }
}
