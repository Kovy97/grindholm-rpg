"""Input action bindings — user-rebindable, controller-aware.

The Action enum is the semantic layer the game logic actually consumes.
Hardware (keyboard / mouse / gamepad) maps INTO Actions via ActionBinding,
never the other way around.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Action(str, Enum):
    MOVE_UP = "MOVE_UP"
    MOVE_DOWN = "MOVE_DOWN"
    MOVE_LEFT = "MOVE_LEFT"
    MOVE_RIGHT = "MOVE_RIGHT"
    INTERACT = "INTERACT"
    CANCEL = "CANCEL"
    OPEN_INVENTORY = "OPEN_INVENTORY"
    TOGGLE_DEV_OVERLAY = "TOGGLE_DEV_OVERLAY"
    TOGGLE_MODAL_HUB = "TOGGLE_MODAL_HUB"
    PAINT_PRIMARY = "PAINT_PRIMARY"
    PAINT_SECONDARY = "PAINT_SECONDARY"


class Context(str, Enum):
    """Context-stack levels — higher levels capture input first."""

    GAME = "game"
    DEV_OVERLAY = "dev_overlay"
    MODAL = "modal"
    DIALOG = "dialog"


GamepadInput = Literal[
    "stick_left_up",
    "stick_left_down",
    "stick_left_left",
    "stick_left_right",
    "button_a",
    "button_b",
    "button_x",
    "button_y",
    "button_lb",
    "button_rb",
    "button_start",
    "button_select",
    "dpad_up",
    "dpad_down",
    "dpad_left",
    "dpad_right",
]


class KeyBinding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: Optional[str] = Field(
        default=None,
        description="KeyboardEvent.code value, e.g. 'KeyW' or 'ArrowUp'",
    )
    mouse_button: Optional[int] = Field(
        default=None,
        ge=0,
        le=4,
        description="0=left, 2=right, 1=middle. Used instead of `key` if set.",
    )

    @model_validator(mode="after")
    def _require_one(self) -> "KeyBinding":
        if self.key is None and self.mouse_button is None:
            raise ValueError("KeyBinding needs either `key` or `mouse_button`")
        if self.key is not None and self.mouse_button is not None:
            raise ValueError("KeyBinding cannot have both `key` and `mouse_button`")
        return self


class GamepadBinding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    input: GamepadInput
    threshold: float = Field(default=0.3, ge=0.0, le=1.0)


class ActionBinding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Action
    contexts: list[Context] = Field(
        default_factory=lambda: [Context.GAME],
        description="Which context-stack levels this binding fires in.",
    )
    keys: list[KeyBinding] = Field(default_factory=list)
    gamepad: list[GamepadBinding] = Field(default_factory=list)
