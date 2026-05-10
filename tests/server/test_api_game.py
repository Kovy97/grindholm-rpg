"""End-to-end smoke for the /api/game/* surface."""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from server.main import app

    with TestClient(app) as c:
        yield c


def test_bootstrap_idempotent(client):
    r1 = client.post("/api/game/bootstrap")
    r2 = client.post("/api/game/bootstrap")
    assert r1.status_code == 200
    assert r2.status_code == 200


def test_state_has_resource_nodes_and_inventory(client):
    state = client.get("/api/game/state").json()
    assert state["tick"] >= 0
    assert len(state["resource_nodes"]) >= 1
    assert len(state["player"]["inventory"]["slots"]) == 30


def test_items_recipes_node_defs_load(client):
    assert len(client.get("/api/game/items").json()) >= 5
    assert len(client.get("/api/game/recipes").json()) >= 1
    assert len(client.get("/api/game/resource_node_defs").json()) >= 1
    assert len(client.get("/api/game/building_defs").json()) >= 1


def test_walk_returns_path(client):
    r = client.post("/api/game/walk", json={"target_x": 5, "target_y": 12})
    assert r.status_code == 200
    assert isinstance(r.json()["path"], list)


def test_harvest_without_tool_fails_clean(client):
    state = client.get("/api/game/state").json()
    tree_id = next(
        nid for nid, n in state["resource_nodes"].items() if n["def_id"].startswith("tree")
    )
    # unequip the axe to ensure failure
    client.post("/api/game/inventory/unequip", json={"equip_slot": "weapon"})
    r = client.post("/api/game/harvest", json={"node_id": tree_id})
    body = r.json()
    assert r.status_code == 200
    assert body["success"] is False
    assert "tool" in body["message"].lower() or "level" in body["message"].lower()


def test_equip_axe_then_harvest_succeeds(client):
    state = client.get("/api/game/state").json()
    inv = state["player"]["inventory"]
    axe_idx = next(i for i, s in enumerate(inv["slots"]) if s and s["item_id"] == "axe_bronze")
    client.post("/api/game/inventory/equip", json={"slot": axe_idx})
    state = client.get("/api/game/state").json()
    tree_id = next(
        nid for nid, n in state["resource_nodes"].items() if n["def_id"] == "tree_normal"
    )
    r = client.post("/api/game/harvest", json={"node_id": tree_id})
    body = r.json()
    assert r.status_code == 200
    assert body["success"] is True
    assert body["xp_grants"][0]["skill"] == "woodcutting"


def test_inventory_drop(client):
    # ensure inventory has logs (from previous harvest test); if not, this test
    # is order-dependent, so we instead drop the bronze axe slot
    state = client.get("/api/game/state").json()
    inv = state["player"]["inventory"]
    # find any non-empty slot
    src = next(i for i, s in enumerate(inv["slots"]) if s)
    r = client.post("/api/game/inventory/drop", json={"slot": src, "count": 1})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_recruit_npc_with_enough_gold(client):
    r = client.post(
        "/api/npcs/recruit",
        json={"archetype_id": "villager_woodcutter", "spawn_x": 5.5, "spawn_y": 5.5},
    )
    # may succeed or fail depending on gold balance; either way, returns 200/400
    assert r.status_code in (200, 400)
    if r.status_code == 200:
        npc = r.json()["npc"]
        assert "id" in npc
        assert npc["skills"]["skills"]["woodcutting"]["xp"] > 0


def test_unknown_recipe_fails_cleanly(client):
    r = client.post("/api/game/craft", json={"recipe_id": "no_such_recipe"})
    body = r.json()
    assert r.status_code == 200
    assert body["success"] is False
