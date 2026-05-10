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
      // Server now returns continuous (x, y) floats already in tile space —
      // each waypoint is the next point to interpolate toward, NOT a tile centre.
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
    const a = this._avatar;
    const speed = 4.5;
    let budget = speed * dt;
    // Walk through as many waypoints as our budget covers in this frame —
    // important on long string-pulled segments at low frame-rate.
    while (budget > 0 && this._path.length > 0) {
      const next = this._path[0];
      const dx = next.x - a.x;
      const dy = next.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= budget) {
        a.x = next.x;
        a.y = next.y;
        budget -= dist;
        this._path.shift();
      } else {
        a.x += (dx / dist) * budget;
        a.y += (dy / dist) * budget;
        budget = 0;
      }
    }
    if (this._path.length === 0) {
      api.teleport(a.x, a.y).catch((e) => console.warn(e));
      const cb = this._onArrive;
      this._onArrive = null;
      if (cb) cb();
    }
    a._bobPhase += dt * 8;
    a._sync();
    return true;
  }
}
