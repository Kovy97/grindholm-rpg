import { Context } from "./actions.js";

// Stack of input contexts. Topmost context is the only one whose bindings
// fire — except where a binding lists multiple contexts explicitly.
// Default stack is [game]; pushes layer above (modal, dialog, dev_overlay).
export class ContextStack {
  constructor(initial = [Context.GAME]) {
    this._stack = [...initial];
    this._listeners = new Set();
  }

  top() {
    return this._stack[this._stack.length - 1];
  }

  has(ctx) {
    return this._stack.includes(ctx);
  }

  snapshot() {
    return [...this._stack];
  }

  push(ctx) {
    this._stack.push(ctx);
    this._notify();
  }

  pop(ctx) {
    if (ctx) {
      const idx = this._stack.lastIndexOf(ctx);
      if (idx > 0) this._stack.splice(idx, 1);
    } else if (this._stack.length > 1) {
      this._stack.pop();
    }
    this._notify();
  }

  onChange(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  _notify() {
    for (const cb of this._listeners) {
      try {
        cb(this.top(), this.snapshot());
      } catch (err) {
        console.error("ContextStack listener error:", err);
      }
    }
  }
}
