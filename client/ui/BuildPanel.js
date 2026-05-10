// Build mode UI — pick a building from the catalog, then click to place.
import { api } from "../api.js";

export class BuildPanel {
  constructor({ root, gameClient, onPickBuilding }) {
    this._root = root;
    this._game = gameClient;
    this._onPickBuilding = onPickBuilding;
    this._build();
  }

  _build() {
    this._root.innerHTML = `
      <div class="bld-panel">
        <div class="bld-panel-title">Build</div>
        <div class="bld-help">Pick a structure, then click a tile to place it.</div>
        <div class="bld-list" id="bld-list"></div>
      </div>
    `;
    this.render();
  }

  show() {
    this._root.classList.remove("hidden");
    this.render();
  }
  hide() {
    this._root.classList.add("hidden");
    this._onPickBuilding(null);
  }

  render() {
    const defs = this._game.buildingDefs;
    const list = this._root.querySelector("#bld-list");
    if (!list || !defs) return;
    list.innerHTML = "";
    for (const def of defs) {
      const can = this._canAfford(def);
      const row = document.createElement("button");
      row.className = "bld-row" + (can ? "" : " disabled");
      row.innerHTML = `
        <div class="bld-icon" style="background:${def.color || "#666"}"></div>
        <div class="bld-meta">
          <div class="bld-name">${def.name}</div>
          <div class="bld-cost">${def.construction_cost
            .map((c) => `${c.count}× ${this._itemName(c.item_id)}`)
            .join(", ")}</div>
        </div>
      `;
      row.addEventListener("click", () => this._onPickBuilding(def));
      list.appendChild(row);
    }
  }

  _itemName(id) {
    return this._game.itemsById.get(id)?.name || id;
  }

  _canAfford(def) {
    const inv = this._game.state?.player?.inventory;
    if (!inv) return false;
    for (const c of def.construction_cost) {
      let have = 0;
      for (const slot of inv.slots) {
        if (slot && slot.item_id === c.item_id) have += slot.count;
      }
      if (have < c.count) return false;
    }
    return true;
  }
}
