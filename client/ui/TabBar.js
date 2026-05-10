// Bottom-right OSRS tab bar — switches between panels.

const TABS = [
  { id: "inventory", label: "Inv", icon: "🎒" },
  { id: "equipment", label: "Eq",  icon: "🛡" },
  { id: "skills",    label: "Skl", icon: "⚔" },
  { id: "build",     label: "Bld", icon: "🔨" },
];

export class TabBar {
  constructor({ root, panels, onSwitch }) {
    this._root = root;
    this._panels = panels; // { id -> {show, hide} }
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
      // toggle off
      this._panels[id]?.hide();
      this._active = null;
    } else {
      if (this._active && this._panels[this._active]) this._panels[this._active].hide();
      this._panels[id]?.show();
      this._active = id;
    }
    for (const btn of this._root.querySelectorAll(".tabbar-btn")) {
      btn.classList.toggle("active", btn.dataset.tab === this._active);
    }
    this._onSwitch(this._active);
  }
}
