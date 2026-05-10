// Top-right minimap. Shows world cutout, player dot, resource nodes, NPCs.
// Click on minimap → walks the player to the corresponding world tile.

const SIZE = 192;

export class Minimap {
  constructor({ root, gameClient, mapData, onClickTile }) {
    this._root = root;
    this._game = gameClient;
    this._map = mapData;
    this._onClick = onClickTile || (() => {});
    this._build();
    this._game.onState(() => this.draw());
  }

  _build() {
    this._root.innerHTML = `
      <canvas id="mm-canvas" width="${SIZE}" height="${SIZE}"></canvas>
    `;
    this._canvas = this._root.querySelector("#mm-canvas");
    this._ctx = this._canvas.getContext("2d");
    this._canvas.addEventListener("click", (e) => {
      const rect = this._canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const tx = Math.floor((cx / SIZE) * this._map.width);
      const ty = Math.floor((cy / SIZE) * this._map.height);
      this._onClick(tx, ty);
    });
  }

  draw() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const m = this._map;
    const tilePx = SIZE / Math.max(m.width, m.height);
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#1a1d22";
    ctx.fillRect(0, 0, SIZE, SIZE);
    // ground tiles by color
    const tilesById = this._game.tilesById;
    const ground = m.layers.find((l) => l.layer === "ground");
    if (ground) {
      for (let y = 0; y < m.height; y++) {
        for (let x = 0; x < m.width; x++) {
          const id = ground.cells[y * m.width + x];
          if (!id) continue;
          const def = tilesById.get(id);
          ctx.fillStyle = def?.color || "#2a3a2a";
          ctx.fillRect(x * tilePx, y * tilePx, Math.ceil(tilePx), Math.ceil(tilePx));
        }
      }
    }
    // resource nodes as small dots
    const state = this._game.state;
    if (state?.resource_nodes) {
      ctx.fillStyle = "#b8a06b";
      for (const id in state.resource_nodes) {
        const n = state.resource_nodes[id];
        ctx.beginPath();
        ctx.arc((n.tile_x + 0.5) * tilePx, (n.tile_y + 0.5) * tilePx, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // buildings
    if (state?.buildings) {
      ctx.fillStyle = "#704028";
      for (const id in state.buildings) {
        const b = state.buildings[id];
        ctx.fillRect(b.tile_x * tilePx, b.tile_y * tilePx, tilePx * 1.5, tilePx * 1.5);
      }
    }
    // player dot
    if (state?.player) {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#000";
      ctx.beginPath();
      ctx.arc(state.player.tile_x * tilePx, state.player.tile_y * tilePx, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
