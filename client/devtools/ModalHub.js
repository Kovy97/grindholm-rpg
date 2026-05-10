import { Action, Context } from "../input/actions.js";

// F2 modal editor hub. 1.0 ships only the skeleton — empty tabs that show
// a "Coming in 1.1" placeholder. The wiring (open/close, context push/pop,
// game pausing) is real so adding an actual editor later is a drop-in.
const TABS = [
  { id: "tiles", label: "Tile Defs", note: "Edit data/tiles/tile_definitions.json" },
  { id: "quests", label: "Quests", note: "Will edit data/quests/*.json" },
  { id: "dialogs", label: "Dialogs", note: "Will edit data/dialogs/*.json (beat-based, like YGO Journey)" },
  { id: "npcs", label: "NPCs", note: "Will edit data/npcs/*.json with schedule slots" },
  { id: "items", label: "Items", note: "Will edit data/items/*.json" },
  { id: "recipes", label: "Recipes", note: "Will edit data/recipes/*.json" },
];

export class ModalHub {
  constructor({ root, bus, contextStack, onOpen, onClose }) {
    this._root = root;
    this._bus = bus;
    this._stack = contextStack;
    this._onOpen = onOpen || (() => {});
    this._onClose = onClose || (() => {});
    this._active = false;
    this._currentTab = TABS[0].id;
    this._buildDom();
    this._bus.on(Action.TOGGLE_MODAL_HUB, "press", () => this._toggleActive());
    this._bus.on(Action.CANCEL, "press", () => {
      if (this._active && this._stack.top() === Context.MODAL) this.close();
    });
  }

  _buildDom() {
    this._root.classList.add("hidden");
    this._root.innerHTML = `
      <div class="modal-panel">
        <div class="modal-header">
          <h2>Editor Hub</h2>
          <button class="close-btn" data-act="close">close (ESC)</button>
        </div>
        <div class="modal-tabs">
          ${TABS.map(
            (t) =>
              `<button data-tab="${t.id}"${t.id === this._currentTab ? ' class="active"' : ""}>${t.label}</button>`,
          ).join("")}
        </div>
        <div class="modal-body" id="modal-body">${this._renderTab(this._currentTab)}</div>
      </div>
    `;
    this._root.querySelector('[data-act="close"]').addEventListener("click", () => this.close());
    for (const btn of this._root.querySelectorAll("button[data-tab]")) {
      btn.addEventListener("click", () => this._setTab(btn.dataset.tab));
    }
  }

  _setTab(id) {
    this._currentTab = id;
    for (const b of this._root.querySelectorAll("button[data-tab]")) {
      b.classList.toggle("active", b.dataset.tab === id);
    }
    const body = this._root.querySelector("#modal-body");
    if (body) body.innerHTML = this._renderTab(id);
  }

  _renderTab(id) {
    const tab = TABS.find((t) => t.id === id);
    if (!tab) return "";
    return `
      <div class="placeholder">
        <strong>${tab.label}</strong><br/>
        <span style="font-size:12px;">${tab.note}</span><br/><br/>
        <em style="font-size:11px; opacity:0.7;">Coming in 1.1 — schema is defined in shared/schemas/.</em>
      </div>
    `;
  }

  _toggleActive() {
    if (this._active) this.close();
    else this.open();
  }

  open() {
    if (this._active) return;
    this._active = true;
    this._stack.push(Context.MODAL);
    this._root.classList.remove("hidden");
    this._onOpen();
  }

  close() {
    if (!this._active) return;
    this._active = false;
    this._stack.pop(Context.MODAL);
    this._root.classList.add("hidden");
    this._onClose();
  }

  get isOpen() {
    return this._active;
  }
}
