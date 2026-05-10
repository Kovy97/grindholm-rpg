// Pub/sub for semantic Actions. Game logic talks to this, never to keys.
//
// Two consumption patterns supported:
//   - Held: bus.isHeld(Action.MOVE_UP) — checked every tick (continuous input)
//   - Edge: bus.on(Action.INTERACT, "press", cb) — fires on press transition
//
// Phases: "press" | "release" | "change" (axis value moved while held) | "any"
export class ActionBus {
  constructor() {
    this._held = new Map();
    this._listeners = new Map();
  }

  isHeld(action) {
    return this._held.has(action);
  }

  axis(action) {
    const v = this._held.get(action);
    return typeof v === "number" ? v : v ? 1 : 0;
  }

  // value: 0..1 — 0 means released. Idempotent if value matches state.
  setHeld(action, value) {
    const prev = this._held.get(action);
    const prevActive = prev !== undefined;
    const nextActive = value > 0;

    if (nextActive && !prevActive) {
      this._held.set(action, value);
      this._fire(action, "press", value);
    } else if (!nextActive && prevActive) {
      this._held.delete(action);
      this._fire(action, "release", 0);
    } else if (nextActive && prevActive && Math.abs((prev ?? 0) - value) > 0.01) {
      this._held.set(action, value);
      this._fire(action, "change", value);
    }
  }

  on(action, phase, cb) {
    let set = this._listeners.get(action);
    if (!set) {
      set = new Set();
      this._listeners.set(action, set);
    }
    const entry = { phase, cb };
    set.add(entry);
    return () => set.delete(entry);
  }

  releaseAll() {
    for (const action of [...this._held.keys()]) {
      this._held.delete(action);
      this._fire(action, "release", 0);
    }
  }

  _fire(action, phase, value) {
    const set = this._listeners.get(action);
    if (!set) return;
    for (const e of set) {
      if (e.phase === phase || e.phase === "any") {
        try {
          e.cb({ action, phase, value });
        } catch (err) {
          console.error(`ActionBus listener for ${action}/${phase} threw:`, err);
        }
      }
    }
  }
}
