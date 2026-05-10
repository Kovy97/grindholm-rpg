// OSRS-style skills panel — 6 skills in a 2-column grid for 2.0.

const SKILL_META = {
  woodcutting: { label: "Woodcutting", color: "#7a4d2c" },
  fishing: { label: "Fishing", color: "#5878a0" },
  cooking: { label: "Cooking", color: "#cc6644" },
  farming: { label: "Farming", color: "#5a8030" },
  building: { label: "Building", color: "#a47844" },
  town_management: { label: "Town Mgmt.", color: "#b8a06b" },
};

// Mirror of shared/schemas/skill.py xp_for_level for client-side XP-bar drawing.
function xpForLevel(level) {
  if (level <= 1) return 0;
  if (level > 99) level = 99;
  let points = 0;
  for (let L = 1; L < level; L++) {
    points += Math.floor(L + 300 * Math.pow(2, L / 7));
  }
  return Math.floor(points / 4);
}
function levelForXp(xp) {
  if (xp <= 0) return 1;
  for (let L = 99; L >= 1; L--) {
    if (xpForLevel(L) <= xp) return L;
  }
  return 1;
}

export class SkillsPanel {
  constructor({ root, gameClient }) {
    this._root = root;
    this._game = gameClient;
    this._build();
    this._game.onState(() => this.render());
  }

  _build() {
    this._root.innerHTML = `
      <div class="sk-panel">
        <div class="sk-panel-title">Skills</div>
        <div class="sk-grid"></div>
        <div class="sk-total">Total <span class="sk-total-num">6</span></div>
      </div>
    `;
  }

  show() {
    this._root.classList.remove("hidden");
    this.render();
  }
  hide() {
    this._root.classList.add("hidden");
  }

  render() {
    const skills = this._game.state?.player?.skills?.skills;
    if (!skills) return;
    const grid = this._root.querySelector(".sk-grid");
    if (!grid) return;
    grid.innerHTML = "";
    let total = 0;
    for (const [kind, meta] of Object.entries(SKILL_META)) {
      const s = skills[kind] ?? { xp: 0 };
      const lvl = levelForXp(s.xp);
      total += lvl;
      const next = lvl < 99 ? xpForLevel(lvl + 1) : s.xp;
      const cur = xpForLevel(lvl);
      const pct = lvl < 99 ? Math.min(100, Math.round(((s.xp - cur) / (next - cur)) * 100)) : 100;
      const cell = document.createElement("div");
      cell.className = "sk-cell";
      cell.title = `${meta.label} — ${s.xp.toLocaleString()} xp`;
      cell.innerHTML = `
        <div class="sk-icon" style="background: ${meta.color}"></div>
        <div class="sk-name">${meta.label}</div>
        <div class="sk-level">${lvl}</div>
        <div class="sk-bar"><div class="sk-bar-fill" style="width:${pct}%"></div></div>
      `;
      grid.appendChild(cell);
    }
    const totalEl = this._root.querySelector(".sk-total-num");
    if (totalEl) totalEl.textContent = total;
  }
}
