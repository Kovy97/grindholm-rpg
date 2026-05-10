"""Inventory operations — pure functions over Inventory + ItemDef catalogue.

All mutations go through these helpers so that stack rules, equipment
slot rules, and gold are never violated.
"""
from __future__ import annotations

from typing import Optional

from shared.schemas import (
    EquipSlot,
    INVENTORY_SLOTS,
    Inventory,
    ItemDef,
    ItemStack,
)


class InventoryError(Exception):
    """Raised when an inventory operation cannot complete (no space, etc.)."""


def add_item(inv: Inventory, item: ItemDef, count: int = 1) -> int:
    """Add up to `count` of `item`. Returns how many were actually added."""
    if count <= 0:
        return 0
    added = 0
    if item.stackable:
        # First, top up existing stacks
        for slot in inv.slots:
            if added >= count:
                break
            if slot is None or slot.item_id != item.id:
                continue
            free = item.max_stack - slot.count
            if free <= 0:
                continue
            give = min(free, count - added)
            slot.count += give
            added += give
        # Then, fill empty slots with new stacks
        for i, slot in enumerate(inv.slots):
            if added >= count:
                break
            if slot is not None:
                continue
            give = min(item.max_stack, count - added)
            inv.slots[i] = ItemStack(item_id=item.id, count=give)
            added += give
    else:
        for i in range(INVENTORY_SLOTS):
            if added >= count:
                break
            if inv.slots[i] is None:
                inv.slots[i] = ItemStack(item_id=item.id, count=1)
                added += 1
    return added


def remove_item(inv: Inventory, item_id: str, count: int = 1) -> int:
    """Remove up to `count` of `item_id`. Returns how many were removed."""
    if count <= 0:
        return 0
    removed = 0
    for i, slot in enumerate(inv.slots):
        if removed >= count:
            break
        if slot is None or slot.item_id != item_id:
            continue
        take = min(slot.count, count - removed)
        slot.count -= take
        removed += take
        if slot.count <= 0:
            inv.slots[i] = None
    return removed


def count_item(inv: Inventory, item_id: str) -> int:
    n = 0
    for slot in inv.slots:
        if slot is not None and slot.item_id == item_id:
            n += slot.count
    return n


def has_items(inv: Inventory, requirements: dict[str, int]) -> bool:
    return all(count_item(inv, iid) >= n for iid, n in requirements.items())


def consume_items(inv: Inventory, requirements: dict[str, int]) -> bool:
    """Atomic: only consumes if ALL requirements met."""
    if not has_items(inv, requirements):
        return False
    for iid, n in requirements.items():
        remove_item(inv, iid, n)
    return True


def swap_slots(inv: Inventory, src: int, dst: int) -> None:
    if not (0 <= src < INVENTORY_SLOTS) or not (0 <= dst < INVENTORY_SLOTS):
        raise InventoryError("slot index out of range")
    inv.slots[src], inv.slots[dst] = inv.slots[dst], inv.slots[src]


def equip(inv: Inventory, src_slot: int, items_db: dict[str, ItemDef]) -> None:
    if not (0 <= src_slot < INVENTORY_SLOTS):
        raise InventoryError("slot index out of range")
    stack = inv.slots[src_slot]
    if stack is None:
        raise InventoryError("nothing to equip")
    item = items_db.get(stack.item_id)
    if item is None:
        raise InventoryError(f"unknown item {stack.item_id}")
    if item.equip_slot is None:
        raise InventoryError(f"{item.name} cannot be equipped")
    # swap inventory slot with equipment slot
    current_equipped = inv.equipment.get(item.equip_slot)
    inv.equipment[item.equip_slot] = ItemStack(item_id=item.id, count=1)
    inv.slots[src_slot] = current_equipped


def unequip(inv: Inventory, slot: EquipSlot) -> None:
    stack = inv.equipment.get(slot)
    if stack is None:
        return
    # find first empty inventory slot
    for i in range(INVENTORY_SLOTS):
        if inv.slots[i] is None:
            inv.slots[i] = stack
            inv.equipment[slot] = None
            return
    raise InventoryError("inventory is full")


def drop_item(inv: Inventory, slot_idx: int, count: Optional[int] = None) -> Optional[ItemStack]:
    """Drop (and return) an item from a slot. Count=None drops the whole slot."""
    if not (0 <= slot_idx < INVENTORY_SLOTS):
        raise InventoryError("slot index out of range")
    stack = inv.slots[slot_idx]
    if stack is None:
        return None
    if count is None or count >= stack.count:
        inv.slots[slot_idx] = None
        return stack
    stack.count -= count
    return ItemStack(item_id=stack.item_id, count=count)


def equipped_tool(inv: Inventory, items_db: dict[str, ItemDef], tool_skill: str) -> Optional[ItemDef]:
    """Return the equipped tool that matches a given skill, or None."""
    weapon = inv.equipment.get(EquipSlot.WEAPON)
    if weapon is None:
        return None
    item = items_db.get(weapon.item_id)
    if item is None or item.tool_skill != tool_skill:
        return None
    return item
