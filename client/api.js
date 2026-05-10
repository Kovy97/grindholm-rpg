// Thin wrapper over /api/* — easy to mock in tests, easy to swap later
// for a PyWebView-bridge call when we need synchronous Python access.

const BASE = "/api";

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.detail || JSON.stringify(j);
    } catch {
      detail = await res.text();
    }
    throw new Error(`${opts.method || "GET"} ${path} -> ${res.status}: ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getKeybindings: () => request("/keybindings"),
  getTiles: () => request("/tiles"),
  listMaps: () => request("/maps"),
  getMap: (id) => request(`/maps/${id}`),
  saveMap: (id, payload) =>
    request(`/maps/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
};
