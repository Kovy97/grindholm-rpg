"""Cross-language game constants — kept here so backend validators and
frontend renderers agree on the single source of truth.

If you change a value here, update the JS mirror in client/render/Stage.js
(TILE_SIZE) and re-run any sprite atlas tooling.
"""
from __future__ import annotations

from typing import Final

# Every tile sprite must be exactly this many pixels square. Procedural
# placeholders use this as their cell size; later sprite-atlas slicing
# divides source images by it. Don't change without a coordinated asset
# repackage — every existing sprite would need to be redrawn.
#
# Density rationale: 96 = mid/high-detail pixel art. Reference titles
# Octopath Traveler 2D-HD, Sea of Stars (similar density). Sub-multiples
# of 32 (16, 32) are kept reserved for UI / item icons.
TILE_PIXEL_SIZE: Final[int] = 96

# Game-loop tick rate. Deterministic logic (later: multiplayer sync) runs
# at this rate; render frames are decoupled.
GAME_TICK_HZ: Final[int] = 30

# Network-related (placeholder for phase 2+).
DEFAULT_SERVER_PORT: Final[int] = 8000
