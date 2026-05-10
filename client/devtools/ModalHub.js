import { Action, Context } from "../input/actions.js";
import { api } from "../api.js";

// F2 modal editor hub. 2.0 ships an NPC-spawn dev-tool plus skeleton
// tabs for the data editors that come in 2.x.
const TABS = [
  { id: "spawn", label: "Spawn NPC", note: "Place any NPC archetype, no gold cost." },
  { id: "tiles", label: "Tile Defs", note: "Edit data/tiles/tile_definitions.json" },
  { id: "quests", label: "Quests", note: "Will edit data/quests/*.json" },
  { id: "dialogs", label: "Dialogs", note: "Will edit data/dialogs/*.json (beat-based)" },
  { id: "npcs", label: "NPCs", note: "Will edit data/npcs/*.json with schedule slots" },
  { id: "items", label: "Items", note: "Will edit data/items/*.json" },
  { id: "recipes", label: "Recipes", note: "Will edit data/recipes/*.json" },
];

export class ModalHub {
  constructor({ root, bus, contextStack, onOpen, onClose, gameClient }) {
    this._root = root;
    this._bus = bus;
    this._stack = contextStack;
    this._onOpen = onOpen || (() => {});
    this._onClose = onClose || (() => {});
    this._game = gameClient || null;
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
    if (this._currentTab === "spawn") this._wireSpawnTab();
  }

  _setTab(id) {
    this._currentTab = id;
    for (const b of this._root.querySelectorAll("button[data-tab]")) {
      b.classList.toggle("active", b.dataset.tab === id);
    }
    const body = this._root.querySelector("#modal-body");
    if (body) body.innerHTML = this._renderTab(id);
    if (id === "spawn") this._wireSpawnTab();
  }

  _renderTab(id) {
    const tab = TABS.find((t) => t.id === id);
    if (!tab) return "";
    if (id === "spawn") return this._renderSpawnTab(tab);
    return `
      <div class="placeholder">
        <strong>${tab.label}</strong><br/>
        <span style="font-size:12px;">${tab.note}</span><br/><br/>
        <em style="font-size:11px; opacity:0.7;">Coming in 2.x — schema is defined in shared/schemas/.</em>
      </div>
    `;
  }

  _renderSpawnTab(tab) {
    if (!this._game) return `<div class="placeholder">Game not ready.</div>`;
    const archs = this._game.npcArchetypes || [];
    const rows = archs
      .map((a) => {
        const tag = a.is_trader ? '<span style="color:#d4b870;"> trader</span>' : "";
        const skills = Object.entries(a.starting_skills || {})
          .map(([k, [lo, hi]]) => `${k} ${lo}–${hi}`)
          .join(", ") || "no skills";
        return `
          <div class="bld-row" data-arch="${a.id}">
            <div class="bld-icon" style="background:${a.color || "#888"}"></div>
            <div class="bld-meta">
              <div class="bld-name">${a.name_pool[0]}${tag}</div>
              <div class="bld-cost">${skills}</div>
            </div>
          </div>
        `;
      })
      .join("");
    return `
      <div class="placeholder" style="text-align:left; padding:12px;">
        <strong>${tab.label}</strong><br/>
        <span style="font-size:11px; opacity:0.7;">${tab.note}</span><br/><br/>
        <div class="bld-list" id="spawn-list">${rows}</div>
        <div style="margin-top:10px; font-size:10px; opacity:0.6;">
          NPC spawns adjacent to the player. Free of cost (dev tool).
        </div>
      </div>
    `;
  }

  _wireSpawnTab() {
    if (!this._game) return;
    const list = this._root.querySelector("#spawn-list");
    if (!list) return;
    for (const row of list.querySelectorAll(".bld-row")) {
      row.addEventListener("click", async () => {
        const archId = row.dataset.arch;
        const px = Math.floor(this._game.state?.player?.tile_x ?? 0);
        const py = Math.floor(this._game.state?.player?.tile_y ?? 0);
        try {
          const r = await api.devSpawnNpc(archId, px + 1, py);
          if (r?.npc) {
            this._game.toast(`Spawned ${r.npc.name}.`, "success");
            await this._game.refreshState();
          }
        } catch (err) {
          this._game.toast(err.message || "spawn failed", "error");
        }
      });
    }
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
    // Re-render the current tab so the archetype list reflects any new
    // game state (e.g. after recruitment), and (re)wire click handlers.
    const body = this._root.querySelector("#modal-body");
    if (body) body.innerHTML = this._renderTab(this._currentTab);
    if (this._currentTab === "spawn") this._wireSpawnTab();
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
