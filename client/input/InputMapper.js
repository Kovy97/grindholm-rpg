// Reads hardware input (keyboard/mouse/gamepad), maps it through ActionBindings
// (filtered by current ContextStack top), and pushes the resulting state into
// ActionBus.
//
// Call `pollGamepad()` once per game tick — keyboard and mouse use DOM events
// directly, gamepad has no events so it must be polled.

const GAMEPAD_AXIS_MAP = Object.freeze({
  stick_left_up: { axis: 1, sign: -1 },
  stick_left_down: { axis: 1, sign: 1 },
  stick_left_left: { axis: 0, sign: -1 },
  stick_left_right: { axis: 0, sign: 1 },
});

// Standard gamepad mapping (Xbox-layout). navigator.getGamepads() exposes
// these indices for any gamepad with mapping === "standard".
const GAMEPAD_BUTTON_MAP = Object.freeze({
  button_a: 0,
  button_b: 1,
  button_x: 2,
  button_y: 3,
  button_lb: 4,
  button_rb: 5,
  button_select: 8,
  button_start: 9,
  dpad_up: 12,
  dpad_down: 13,
  dpad_left: 14,
  dpad_right: 15,
});

export class InputMapper {
  constructor({ bindings, bus, contextStack, target = window }) {
    this._bindings = bindings;
    this._knownActions = new Set(bindings.map((b) => b.action));
    this._bus = bus;
    this._stack = contextStack;
    this._target = target;
    this._keyDown = new Set();
    this._mouseDown = new Set();
    this._mousePos = { x: 0, y: 0 };
    this._gamepad = null;

    this._stack.onChange(() => this._reevaluate());
    this._attachDom();
  }

  get mousePos() {
    return this._mousePos;
  }

  _attachDom() {
    const t = this._target;

    t.addEventListener("keydown", (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const editable = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if (editable) return;
      if (this._keyDown.has(e.code)) {
        e.preventDefault();
        return;
      }
      this._keyDown.add(e.code);
      this._reevaluate();
      // prevent default for game-relevant keys (arrow keys would scroll page)
      if (this._isGameKey(e.code)) e.preventDefault();
    });

    t.addEventListener("keyup", (e) => {
      if (this._keyDown.delete(e.code)) {
        this._reevaluate();
      }
    });

    t.addEventListener("mousedown", (e) => {
      this._mouseDown.add(e.button);
      this._reevaluate();
    });

    t.addEventListener("mouseup", (e) => {
      if (this._mouseDown.delete(e.button)) {
        this._reevaluate();
      }
    });

    t.addEventListener("mousemove", (e) => {
      this._mousePos = { x: e.clientX, y: e.clientY };
    });

    t.addEventListener("contextmenu", (e) => e.preventDefault());

    t.addEventListener("blur", () => {
      this._keyDown.clear();
      this._mouseDown.clear();
      this._bus.releaseAll();
    });

    if ("ongamepadconnected" in window) {
      window.addEventListener("gamepadconnected", (e) =>
        console.log(`[input] gamepad connected: ${e.gamepad.id} (mapping=${e.gamepad.mapping})`),
      );
      window.addEventListener("gamepaddisconnected", (e) =>
        console.log(`[input] gamepad disconnected: ${e.gamepad.id}`),
      );
    }
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this._gamepad = pads && pads[0] ? pads[0] : null;
    if (this._gamepad) this._reevaluate();
  }

  _reevaluate() {
    const topCtx = this._stack.top();
    const target = new Map();

    for (const binding of this._bindings) {
      if (!binding.contexts.includes(topCtx)) continue;
      const strength = this._evaluateBinding(binding);
      if (strength <= 0) continue;
      const prev = target.get(binding.action) ?? 0;
      if (strength > prev) target.set(binding.action, strength);
    }

    for (const action of this._knownActions) {
      const v = target.get(action) ?? 0;
      if (v > 0) this._bus.setHeld(action, v);
      else if (this._bus.isHeld(action)) this._bus.setHeld(action, 0);
    }
  }

  _evaluateBinding(binding) {
    let strength = 0;

    for (const k of binding.keys || []) {
      if (k.mouse_button !== undefined && k.mouse_button !== null) {
        if (this._mouseDown.has(k.mouse_button)) strength = Math.max(strength, 1);
      } else if (k.key && this._keyDown.has(k.key)) {
        strength = Math.max(strength, 1);
      }
    }

    if (this._gamepad) {
      for (const g of binding.gamepad || []) {
        const axisMap = GAMEPAD_AXIS_MAP[g.input];
        if (axisMap) {
          const raw = this._gamepad.axes[axisMap.axis] ?? 0;
          const signed = raw * axisMap.sign;
          const thresh = g.threshold ?? 0.3;
          if (signed > thresh) {
            const norm = Math.min(1, (signed - thresh) / (1 - thresh));
            strength = Math.max(strength, norm);
          }
          continue;
        }
        const btnIdx = GAMEPAD_BUTTON_MAP[g.input];
        if (btnIdx !== undefined) {
          const btn = this._gamepad.buttons[btnIdx];
          if (btn?.pressed) strength = Math.max(strength, btn.value || 1);
        }
      }
    }

    return strength;
  }

  _isGameKey(code) {
    return (
      code.startsWith("Arrow") ||
      code.startsWith("Key") ||
      code === "Space" ||
      code === "Tab" ||
      code.startsWith("F") /* F1, F2, ... */
    );
  }
}
