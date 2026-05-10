"""Game tick — runs at GAME_TICK_HZ (30) on a daemon thread.

Per tick:
- Increment world.tick
- Respawn depleted resource nodes whose timer has expired
- Decay NPC needs (hunger, energy)
- Step NPC behaviour (when implemented)
"""
from __future__ import annotations

import threading
import time

from server.game.state import state as global_state
from shared.schemas import GAME_TICK_HZ


_TICK_PERIOD = 1.0 / GAME_TICK_HZ
_thread: threading.Thread | None = None
_stop_event = threading.Event()


def _tick_once(now_tick: int) -> None:
    s = global_state
    with s.lock:
        s.world.tick = now_tick
        # respawn resource nodes
        for rn in s.world.resource_nodes.values():
            if rn.remaining_yield <= 0 and now_tick >= rn.depleted_until_tick:
                from server.game import loaders
                d = loaders.resource_node_defs_by_id().get(rn.def_id)
                if d is not None:
                    rn.remaining_yield = d.max_yield
                    rn.depleted_until_tick = 0
        # NPC needs decay (very slow — full hunger over ~30 minutes of play)
        if now_tick % GAME_TICK_HZ == 0:  # once per second
            for npc in s.world.npcs.values():
                npc.needs.hunger = max(0.0, npc.needs.hunger - 0.0008)
                npc.needs.energy = max(0.0, npc.needs.energy - 0.0005)
    # NPC AI step (releases lock per-NPC inside step_npcs)
    if now_tick % 2 == 0:  # 15 Hz NPC AI to halve cost
        from server.game.npc_ai import step_npcs
        step_npcs(global_state)


def _run() -> None:
    next_tick = time.monotonic()
    tick_count = 0
    while not _stop_event.is_set():
        next_tick += _TICK_PERIOD
        tick_count += 1
        try:
            _tick_once(tick_count)
        except Exception as exc:
            # Don't let a per-tick error kill the loop
            print(f"[tick] error in tick {tick_count}: {exc}")
        # sleep until next tick (drift-correcting)
        sleep_for = next_tick - time.monotonic()
        if sleep_for > 0:
            time.sleep(sleep_for)
        else:
            # We're behind; reset reference to now to avoid death-spiral
            next_tick = time.monotonic()


def start() -> None:
    global _thread
    if _thread is not None and _thread.is_alive():
        return
    _stop_event.clear()
    _thread = threading.Thread(target=_run, daemon=True, name="grindholm-tick")
    _thread.start()


def stop() -> None:
    _stop_event.set()
