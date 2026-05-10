"""Inventory operations — stack rules, equipment, drop."""
import pytest

from shared.schemas import (
    EquipSlot,
    INVENTORY_SLOTS,
    Inventory,
    ItemCategory,
    ItemDef,
    ItemStack,
)
from server.game.inventory_ops import (
    InventoryError,
    add_item,
    consume_items,
    count_item,
    drop_item,
    equip,
    has_items,
    remove_item,
    swap_slots,
    unequip,
)


@pytest.fixture
def items_db():
    return {
        "log": ItemDef(
            id="log", name="Logs", category=ItemCategory.RESOURCE,
            color="#7a4d2c", stackable=True, max_stack=100,
        ),
        "axe": ItemDef(
            id="axe", name="Axe", category=ItemCategory.TOOL,
            color="#a47c45", stackable=False,
            equip_slot=EquipSlot.WEAPON, tool_skill="woodcutting", tool_level=1,
        ),
        "shield": ItemDef(
            id="shield", name="Shield", category=ItemCategory.EQUIPMENT,
            color="#888888", stackable=False, equip_slot=EquipSlot.SHIELD,
        ),
    }


def test_inventory_default_30_slots():
    inv = Inventory()
    assert len(inv.slots) == INVENTORY_SLOTS == 30


def test_add_stackable_fills_existing_first(items_db):
    inv = Inventory()
    add_item(inv, items_db["log"], 50)
    add_item(inv, items_db["log"], 30)
    # Should be in one slot, count 80
    counts = [s.count for s in inv.slots if s and s.item_id == "log"]
    assert sum(counts) == 80
    assert len(counts) == 1


def test_add_stackable_overflows_to_new_slot(items_db):
    inv = Inventory()
    add_item(inv, items_db["log"], 250)
    counts = [s.count for s in inv.slots if s and s.item_id == "log"]
    assert sum(counts) == 250
    assert len(counts) == 3  # 100 + 100 + 50


def test_add_unstackable_fills_separate_slots(items_db):
    inv = Inventory()
    add_item(inv, items_db["axe"], 3)
    axe_slots = [s for s in inv.slots if s and s.item_id == "axe"]
    assert len(axe_slots) == 3
    assert all(s.count == 1 for s in axe_slots)


def test_remove_partial(items_db):
    inv = Inventory()
    add_item(inv, items_db["log"], 60)
    removed = remove_item(inv, "log", 25)
    assert removed == 25
    assert count_item(inv, "log") == 35


def test_remove_more_than_available_returns_amount_removed(items_db):
    inv = Inventory()
    add_item(inv, items_db["log"], 5)
    removed = remove_item(inv, "log", 50)
    assert removed == 5
    assert count_item(inv, "log") == 0


def test_consume_items_atomic_failure(items_db):
    inv = Inventory()
    add_item(inv, items_db["log"], 3)
    ok = consume_items(inv, {"log": 5})
    assert ok is False
    assert count_item(inv, "log") == 3  # untouched


def test_consume_items_atomic_success(items_db):
    inv = Inventory()
    add_item(inv, items_db["log"], 10)
    ok = consume_items(inv, {"log": 5})
    assert ok is True
    assert count_item(inv, "log") == 5


def test_equip_moves_item_to_slot(items_db):
    inv = Inventory()
    add_item(inv, items_db["axe"], 1)
    equip(inv, 0, items_db)
    assert inv.equipment.get(EquipSlot.WEAPON) is not None
    assert inv.slots[0] is None


def test_equip_swap_existing(items_db):
    inv = Inventory()
    add_item(inv, items_db["axe"], 1)
    equip(inv, 0, items_db)  # axe equipped, slot 0 empty
    add_item(inv, items_db["axe"], 1)  # second axe in slot 0
    equip(inv, 0, items_db)  # swaps
    assert inv.equipment.get(EquipSlot.WEAPON).item_id == "axe"
    assert inv.slots[0].item_id == "axe"  # the previously-equipped axe came back


def test_unequip_to_empty_slot(items_db):
    inv = Inventory()
    add_item(inv, items_db["axe"], 1)
    equip(inv, 0, items_db)
    unequip(inv, EquipSlot.WEAPON)
    assert inv.equipment.get(EquipSlot.WEAPON) is None
    assert any(s and s.item_id == "axe" for s in inv.slots)


def test_unequip_full_inventory_raises(items_db):
    inv = Inventory()
    add_item(inv, items_db["axe"], 1)
    equip(inv, 0, items_db)
    add_item(inv, items_db["log"], 100 * 30)  # fill all 30 slots
    with pytest.raises(InventoryError):
        unequip(inv, EquipSlot.WEAPON)


def test_drop_partial_keeps_remainder(items_db):
    inv = Inventory()
    add_item(inv, items_db["log"], 10)
    dropped = drop_item(inv, 0, count=3)
    assert dropped.count == 3
    assert count_item(inv, "log") == 7


def test_drop_full_clears_slot(items_db):
    inv = Inventory()
    add_item(inv, items_db["log"], 5)
    drop_item(inv, 0)
    assert inv.slots[0] is None


def test_swap_slots(items_db):
    inv = Inventory()
    add_item(inv, items_db["log"], 1)
    swap_slots(inv, 0, 5)
    assert inv.slots[0] is None
    assert inv.slots[5].item_id == "log"
