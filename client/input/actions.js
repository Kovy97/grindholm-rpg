// Mirror of shared/schemas/action.py. Keep in sync.
export const Action = Object.freeze({
  MOVE_UP: "MOVE_UP",
  MOVE_DOWN: "MOVE_DOWN",
  MOVE_LEFT: "MOVE_LEFT",
  MOVE_RIGHT: "MOVE_RIGHT",
  INTERACT: "INTERACT",
  CANCEL: "CANCEL",
  OPEN_INVENTORY: "OPEN_INVENTORY",
  TOGGLE_DEV_OVERLAY: "TOGGLE_DEV_OVERLAY",
  TOGGLE_MODAL_HUB: "TOGGLE_MODAL_HUB",
  PAINT_PRIMARY: "PAINT_PRIMARY",
  PAINT_SECONDARY: "PAINT_SECONDARY",
});

export const Context = Object.freeze({
  GAME: "game",
  DEV_OVERLAY: "dev_overlay",
  MODAL: "modal",
  DIALOG: "dialog",
});
