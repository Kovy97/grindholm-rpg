// OSRS-style right-click context menu. Top entry is the default action.
// `actions` is a list of { label, run } objects.

let _activeMenu = null;

export function showContextMenu(actions, x, y) {
  hideContextMenu();
  if (!actions || !actions.length) return;
  const el = document.createElement("div");
  el.className = "ctx-menu";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const row = document.createElement("div");
    row.className = "ctx-row";
    if (i === 0) row.classList.add("ctx-default");
    row.textContent = a.label;
    row.addEventListener("click", () => {
      hideContextMenu();
      try {
        a.run();
      } catch (err) {
        console.error("[ctx]", err);
      }
    });
    el.appendChild(row);
  }
  document.body.appendChild(el);
  _activeMenu = el;
  // dismiss handlers
  setTimeout(() => {
    const dismiss = (e) => {
      if (!el.contains(e.target)) {
        hideContextMenu();
        document.removeEventListener("mousedown", dismiss, true);
        document.removeEventListener("keydown", esc, true);
      }
    };
    const esc = (e) => {
      if (e.key === "Escape") {
        hideContextMenu();
        document.removeEventListener("mousedown", dismiss, true);
        document.removeEventListener("keydown", esc, true);
      }
    };
    document.addEventListener("mousedown", dismiss, true);
    document.addEventListener("keydown", esc, true);
  }, 0);
}

export function hideContextMenu() {
  if (_activeMenu) {
    _activeMenu.remove();
    _activeMenu = null;
  }
}
