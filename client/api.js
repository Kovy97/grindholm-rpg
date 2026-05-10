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

  // game state
  bootstrap: () => request("/game/bootstrap", { method: "POST" }),
  getState: () => request("/game/state"),
  getItems: () => request("/game/items"),
  getRecipes: () => request("/game/recipes"),
  getNodeDefs: () => request("/game/resource_node_defs"),
  getBuildingDefs: () => request("/game/building_defs"),
  getNpcArchetypes: () => request("/game/npc_archetypes"),

  // player + interactions
  walk: (target_x, target_y) =>
    request("/game/walk", { method: "POST", body: JSON.stringify({ target_x, target_y }) }),
  teleport: (x, y) =>
    request("/game/teleport", { method: "POST", body: JSON.stringify({ x, y }) }),
  harvest: (node_id) =>
    request("/game/harvest", { method: "POST", body: JSON.stringify({ node_id }) }),
  craft: (recipe_id, near_x = null, near_y = null) =>
    request("/game/craft", {
      method: "POST",
      body: JSON.stringify({ recipe_id, near_x, near_y }),
    }),
  build: (building_id, tile_x, tile_y) =>
    request("/game/build", {
      method: "POST",
      body: JSON.stringify({ building_id, tile_x, tile_y }),
    }),

  // inventory
  invSwap: (src, dst) =>
    request("/game/inventory/swap", {
      method: "POST",
      body: JSON.stringify({ src, dst }),
    }),
  invEquip: (slot) =>
    request("/game/inventory/equip", { method: "POST", body: JSON.stringify({ slot }) }),
  invUnequip: (equip_slot) =>
    request("/game/inventory/unequip", {
      method: "POST",
      body: JSON.stringify({ equip_slot }),
    }),
  invDrop: (slot, count = null) =>
    request("/game/inventory/drop", {
      method: "POST",
      body: JSON.stringify({ slot, count }),
    }),

  // npcs
  recruitNpc: (archetype_id, spawn_x, spawn_y) =>
    request("/npcs/recruit", {
      method: "POST",
      body: JSON.stringify({ archetype_id, spawn_x, spawn_y }),
    }),
  assignJob: (npc_id, skill, zone) =>
    request("/npcs/assign_job", {
      method: "POST",
      body: JSON.stringify({
        npc_id,
        skill,
        zone_min_x: zone.minX,
        zone_min_y: zone.minY,
        zone_max_x: zone.maxX,
        zone_max_y: zone.maxY,
      }),
    }),
};
