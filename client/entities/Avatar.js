import { Container, Graphics } from "pixi.js";
import { Action } from "../input/actions.js";
import { TILE_SIZE } from "../render/Stage.js";

// Avatar: tile-coordinate position with float precision, axis-separated
// collision against the TileMapRenderer's walkability check, and a tween
// "bob" while moving so the still-sprite feels alive.
//
// Talks ONLY to ActionBus (`isHeld`). Never reads keys directly.
const SPEED = 4.5; // tiles per second
const BOB_SPEED = 8.0;

// The procedural cloak silhouette below was hand-coded against a 32-px
// reference tile. We scale the whole container by TILE_SIZE/32 so the
// avatar stays the same proportional size when TILE_SIZE changes. Replace
// with a real sprite (~64x96 or 64x128) and remove the scale hack.
const SPRITE_REF_SIZE = 32;
const SPRITE_SCALE = TILE_SIZE / SPRITE_REF_SIZE;
const BOB_AMP = 1.5 * SPRITE_SCALE;
// In sprite-local coords the foot is at +12 (see _drawSprite). Multiplied
// by SPRITE_SCALE to get the world-space foot-offset for Y-sorting.
const FOOT_OFFSET_WORLD = 12 * SPRITE_SCALE;

export class Avatar {
  constructor({ bus, tileMap, x, y }) {
    this._bus = bus;
    this._tileMap = tileMap;
    this.x = x + 0.5; // tile-coord, centered in tile
    this.y = y + 0.5;
    this._bobPhase = 0;
    this._frozen = false;
    this._lastFacing = "down";

    this.container = new Container();
    this.container.scale.set(SPRITE_SCALE);
    this._gfx = new Graphics();
    this._drawSprite();
    this.container.addChild(this._gfx);
    this._sync();
  }

  freeze(frozen) {
    this._frozen = frozen;
  }

  /** dt in seconds */
  update(dt) {
    if (this._frozen) {
      this._bobPhase = 0;
      this._sync();
      return;
    }
    let dx = 0;
    let dy = 0;
    if (this._bus.isHeld(Action.MOVE_UP)) dy -= this._bus.axis(Action.MOVE_UP);
    if (this._bus.isHeld(Action.MOVE_DOWN)) dy += this._bus.axis(Action.MOVE_DOWN);
    if (this._bus.isHeld(Action.MOVE_LEFT)) dx -= this._bus.axis(Action.MOVE_LEFT);
    if (this._bus.isHeld(Action.MOVE_RIGHT)) dx += this._bus.axis(Action.MOVE_RIGHT);

    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
      const speed = SPEED * Math.min(1, len);
      this._tryMove(dx * speed * dt, dy * speed * dt);
      this._bobPhase += dt * BOB_SPEED;
      if (Math.abs(dy) > Math.abs(dx)) this._lastFacing = dy < 0 ? "up" : "down";
      else this._lastFacing = dx < 0 ? "left" : "right";
    } else {
      this._bobPhase = 0;
    }
    this._sync();
  }

  _tryMove(dx, dy) {
    // axis-separated, half-tile hitbox so we slide along walls
    const HALF = 0.35;
    if (dx !== 0) {
      const newX = this.x + dx;
      const checkX = dx > 0 ? newX + HALF : newX - HALF;
      const tx = Math.floor(checkX);
      const ty1 = Math.floor(this.y - HALF + 0.001);
      const ty2 = Math.floor(this.y + HALF - 0.001);
      if (this._tileMap.isWalkable(tx, ty1) && this._tileMap.isWalkable(tx, ty2)) {
        this.x = newX;
      }
    }
    if (dy !== 0) {
      const newY = this.y + dy;
      const checkY = dy > 0 ? newY + HALF : newY - HALF;
      const ty = Math.floor(checkY);
      const tx1 = Math.floor(this.x - HALF + 0.001);
      const tx2 = Math.floor(this.x + HALF - 0.001);
      if (this._tileMap.isWalkable(tx1, ty) && this._tileMap.isWalkable(tx2, ty)) {
        this.y = newY;
      }
    }
  }

  _drawSprite() {
    // Procedural placeholder: cloak silhouette + face dot. Replace with sprite later.
    const g = this._gfx;
    g.clear();
    // shadow
    g.ellipse(0, 11, 9, 3).fill({ color: 0x000000, alpha: 0.35 });
    // body
    g.roundRect(-8, -6, 16, 18, 4).fill({ color: 0x6c4d2c });
    // head
    g.circle(0, -10, 6).fill({ color: 0xeacb9b });
    // belt
    g.rect(-8, 5, 16, 2).fill({ color: 0x2a1a0a });
  }

  _sync() {
    const wx = this.x * TILE_SIZE;
    const wy = this.y * TILE_SIZE;
    const bob = Math.sin(this._bobPhase) * BOB_AMP;
    this.container.x = Math.round(wx);
    this.container.y = Math.round(wy + bob);
    // Y-sort key: avatar's foot in world space.
    this.container.zIndex = wy + FOOT_OFFSET_WORLD;
  }

  get worldPos() {
    return { x: this.x * TILE_SIZE, y: this.y * TILE_SIZE };
  }
}
