import { api } from "../../api.js";

const SLOT_LAYOUT = [
  // [equipSlot, gridArea]
  ["head", "head"],
  ["cape", "cape"],
  ["amulet", "amulet"],
  ["weapon", "weapon"],
  ["body", "body"],
  ["shield", "shield"],
  ["legs", "legs"],
  ["hands", "hands"],
  ["feet", "feet"],
  ["ring", "ring"],
  ["ammo", "ammo"],
];

export class EquipmentPanel {
  constructor({ root, gameClient }) {
    this._root = root;
    this._game = gameClient;
    this._build();
    this._game.onState(() => this.render());
  }

  _build() {
    this._root.innerHTML = `
      <div class="eq-panel">
        <div class="eq-panel-title">Equipment</div>
        <div class="eq-grid">
          ${SLOT_LAYOUT.map(
            ([slot, area]) =>
              `<div class="eq-slot" data-slot="${slot}" style="grid-area: ${area};">
                  <span class="eq-slot-label">${slot}</span>
               </div>`,
          ).join("")}
        </div>
      </div>
    `;
    for (const cell of this._root.querySelectorAll(".eq-slot")) {
      cell.addEventListener("click", () => this._unequip(cell.dataset.slot));
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
    for (const [slotName, _] of SLOT_LAYOUT) {
      const cell = this._root.querySelector(`.eq-slot[data-slot="${slotName}"]`);
      if (!cell) continue;
      const stack = inv.equipment?.[slotName];
      cell.innerHTML = "";
      if (stack) {
        const item = items.get(stack.item_id);
        if (item) {
          const sw = document.createElement("div");
          sw.className = "inv-icon";
          sw.style.background = item.color || "#888";
          sw.title = `${item.name} (click to unequip)`;
          cell.appendChild(sw);
        }
      } else {
        const lab = document.createElement("span");
        lab.className = "eq-slot-label";
        lab.textContent = slotName;
        cell.appendChild(lab);
      }
    }
  }

  _unequip(slot) {
    const stack = this._game.state?.player?.inventory?.equipment?.[slot];
    if (!stack) return;
    api.invUnequip(slot).then(() => this._game.refreshState());
  }
}
