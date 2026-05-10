import { api } from "../../api.js";

// 5x6 OSRS-style inventory grid + 11-slot equipment panel + gold counter.
// Reads state from the GameClient and re-renders on data change.
const COLS = 5;
const ROWS = 6;
const SLOT_SIZE = 40;

export class InventoryPanel {
  constructor({ root, gameClient, onContextMenu }) {
    this._root = root;
    this._game = gameClient;
    this._onContextMenu = onContextMenu || (() => {});
    this._dragSrc = null;
    this._build();
    this._game.onState(() => this.render());
  }

  _build() {
    this._root.innerHTML = `
      <div class="inv-panel">
        <div class="inv-panel-title">Inventory</div>
        <div class="inv-grid" id="inv-grid"></div>
        <div class="inv-gold"><span id="inv-gold">0</span> gp</div>
      </div>
    `;
    const grid = this._root.querySelector("#inv-grid");
    for (let i = 0; i < COLS * ROWS; i++) {
      const cell = document.createElement("div");
      cell.className = "inv-slot";
      cell.dataset.slot = String(i);
      cell.addEventListener("click", (e) => this._onSlotClick(i, e));
      cell.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this._onSlotRight(i, e);
      });
      cell.addEventListener("dragstart", (e) => this._onDragStart(i, e));
      cell.addEventListener("dragover", (e) => e.preventDefault());
      cell.addEventListener("drop", (e) => this._onDrop(i, e));
      cell.draggable = true;
      grid.appendChild(cell);
    }
  }

  show() {
    this._root.classList.remove("hidden");
    this.render();
  }

  hide() {
    this._root.classList.add("hidden");
  }

  render() {
    const inv = this._game.state?.player?.inventory;
    if (!inv) return;
    const items = this._game.itemsById;
    const grid = this._root.querySelector("#inv-grid");
    if (!grid) return;
    const cells = grid.children;
    for (let i = 0; i < COLS * ROWS; i++) {
      const slot = inv.slots[i];
      const cell = cells[i];
      cell.innerHTML = "";
      cell.classList.toggle("inv-slot-empty", !slot);
      if (!slot) continue;
      const item = items.get(slot.item_id);
      if (!item) continue;
      const swatch = document.createElement("div");
      swatch.className = "inv-icon";
      swatch.style.background = item.color || "#888";
      swatch.title = `${item.name}${slot.count > 1 ? ` × ${slot.count}` : ""}`;
      cell.appendChild(swatch);
      if (slot.count > 1) {
        const count = document.createElement("div");
        count.className = "inv-count";
        count.textContent = formatCount(slot.count);
        cell.appendChild(count);
      }
    }
    const goldEl = this._root.querySelector("#inv-gold");
    if (goldEl) goldEl.textContent = inv.gold ?? 0;
  }

  _onSlotClick(idx, e) {
    // left-click default: equip if equippable, else nothing
    const inv = this._game.state?.player?.inventory;
    if (!inv) return;
    const slot = inv.slots[idx];
    if (!slot) return;
    const item = this._game.itemsById.get(slot.item_id);
    if (item && item.equip_slot) {
      api.invEquip(idx).then(() => this._game.refreshState());
    }
  }

  _onSlotRight(idx, e) {
    const inv = this._game.state?.player?.inventory;
    if (!inv) return;
    const slot = inv.slots[idx];
    if (!slot) return;
    const item = this._game.itemsById.get(slot.item_id);
    if (!item) return;
    const actions = [];
    if (item.equip_slot) {
      actions.push({
        label: `Wield ${item.name}`,
        run: () => api.invEquip(idx).then(() => this._game.refreshState()),
      });
    }
    if (item.cookable_into) {
      actions.push({
        label: `Cook ${item.name}`,
        run: () => this._game.tryCookFromSlot(idx),
      });
    }
    actions.push({
      label: `Drop ${item.name}`,
      run: () => api.invDrop(idx).then(() => this._game.refreshState()),
    });
    actions.push({
      label: `Examine`,
      run: () => this._game.toast(item.description || item.name),
    });
    this._onContextMenu(actions, e.clientX, e.clientY);
  }

  _onDragStart(idx, e) {
    this._dragSrc = idx;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }

  _onDrop(idx, e) {
    e.preventDefault();
    const src = this._dragSrc;
    if (src === null || src === idx) return;
    api.invSwap(src, idx).then(() => this._game.refreshState());
    this._dragSrc = null;
  }
}

function formatCount(n) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
