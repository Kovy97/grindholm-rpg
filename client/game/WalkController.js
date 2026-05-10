import { api } from "../api.js";
import { TILE_SIZE } from "../render/Stage.js";

// Drives click-to-walk pathing for the avatar. Holds an active path of
// (tx, ty) waypoints; each tick the avatar advances toward the next
// waypoint. Path is cancelled if WASD is pressed (fallback to keyboard).
export class WalkController {
  constructor({ avatar, gameClient, getWalkable }) {
    this._avatar = avatar;
    this._game = gameClient;
    this._getWalkable = getWalkable;
    this._path = [];
    this._onArrive = null;
    this.lastSyncedTick = 0;
  }

  async walkTo(tx, ty, onArrive = null) {
    try {
      const r = await api.walk(tx, ty);
      this._path = (r.path || []).map(([x, y]) => ({ x, y }));
      this._onArrive = onArrive;
    } catch (err) {
      console.error("[walk]", err);
      this._path = [];
    }
  }

  cancel() {
    this._path = [];
    this._onArrive = null;
  }

  hasPath() {
    return this._path.length > 0;
  }

  /** Called every frame with delta time. Returns true if avatar moved. */
  step(dt) {
    if (this._path.length === 0) return false;
    const next = this._path[0];
    const a = this._avatar;
    const targetX = next.x + 0.5;
    const targetY = next.y + 0.5;
    const dx = targetX - a.x;
    const dy = targetY - a.y;
    const dist = Math.hypot(dx, dy);
    const speed = 4.5;
    const move = speed * dt;
    if (dist <= move) {
      a.x = targetX;
      a.y = targetY;
      this._path.shift();
      if (this._path.length === 0) {
        // sync server position once when path completes
        api.teleport(a.x, a.y).catch((e) => console.warn(e));
        const cb = this._onArrive;
        this._onArrive = null;
        if (cb) cb();
      }
    } else {
      a.x += (dx / dist) * move;
      a.y += (dy / dist) * move;
    }
    a._bobPhase += dt * 8;
    a._sync();
    return true;
  }
}
