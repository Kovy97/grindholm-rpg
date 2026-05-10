// Tiny toast / message-feed pinned bottom-left. Used for skill XP feedback,
// "you can't do that" hints, etc.

const MAX = 6;

export class Toast {
  constructor({ root }) {
    this._root = root;
    this._items = [];
    this._build();
  }
  _build() {
    this._root.innerHTML = `<div class="toast-stack" id="toast-stack"></div>`;
  }
  push(text, cls = "") {
    const el = document.createElement("div");
    el.className = `toast ${cls}`;
    el.textContent = text;
    const stack = this._root.querySelector("#toast-stack");
    stack.appendChild(el);
    this._items.push(el);
    while (this._items.length > MAX) {
      const old = this._items.shift();
      old?.remove();
    }
    setTimeout(() => {
      el.classList.add("fade");
      setTimeout(() => {
        el.remove();
        const idx = this._items.indexOf(el);
        if (idx >= 0) this._items.splice(idx, 1);
      }, 800);
    }, 3500);
  }
}
