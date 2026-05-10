// Bottom-right OSRS tab bar — switches between panels.
// Each panel has its own container DOM element; the tab bar toggles which
// container is visible. Calling activate(null) closes everything.

const TABS = [
  { id: "inventory", label: "Inventory", icon: "🎒" },
  { id: "equipment", label: "Equipment", icon: "🛡" },
  { id: "skills",    label: "Skills",    icon: "⚔" },
  { id: "build",     label: "Build",     icon: "🔨" },
];

export class TabBar {
  constructor({ root, panelHost, panels, onSwitch }) {
    this._root = root;
    this._panelHost = panelHost; // outer container (#hud-panel-host)
    this._panels = panels;       // { id -> Panel instance with .show()/.hide() }
    this._onSwitch = onSwitch || (() => {});
    this._active = null;
    this._build();
  }

  _build() {
    this._root.innerHTML = `
      <div class="tabbar">
        ${TABS.map(
          (t) =>
            `<button class="tabbar-btn" data-tab="${t.id}" title="${t.label}">${t.icon}</button>`,
        ).join("")}
      </div>
    `;
    for (const btn of this._root.querySelectorAll(".tabbar-btn")) {
      btn.addEventListener("click", () => this.activate(btn.dataset.tab));
    }
  }

  activate(id) {
    if (this._active === id) {
      // toggle off — close all
      this._closeAll();
      this._active = null;
    } else {
      this._closeAll();
      const p = this._panels[id];
      if (p) p.show();
      // show outer host + activate the right slot
      this._panelHost.classList.remove("hidden");
      for (const slot of this._panelHost.querySelectorAll(".hud-panel-slot")) {
        slot.classList.toggle("active", slot.dataset.panel === id);
      }
      this._active = id;
    }
    for (const btn of this._root.querySelectorAll(".tabbar-btn")) {
      btn.classList.toggle("active", btn.dataset.tab === this._active);
    }
    this._onSwitch(this._active);
  }

  _closeAll() {
    for (const id in this._panels) {
      this._panels[id]?.hide?.();
    }
    this._panelHost.classList.add("hidden");
    for (const slot of this._panelHost.querySelectorAll(".hud-panel-slot")) {
      slot.classList.remove("active");
    }
  }
}
