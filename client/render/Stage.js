import { Application, Container } from "pixi.js";

export const TILE_SIZE = 32;

// Owns the Pixi.Application and the layered scene graph.
// Layers (back to front): ground, objects, collision (debug), entities, ui.
// World container is centered/scaled by the Camera.
export class Stage {
  constructor() {
    this.app = new Application();
    this.world = new Container();
    this.layers = {
      ground: new Container(),
      objects: new Container(),
      collision: new Container(),
      entities: new Container(),
    };
    this.world.addChild(this.layers.ground);
    this.world.addChild(this.layers.objects);
    this.world.addChild(this.layers.collision);
    this.world.addChild(this.layers.entities);
  }

  async init(parent) {
    await this.app.init({
      background: "#1a1d22",
      resizeTo: parent,
      antialias: false,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    parent.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this._showCollision = false;
    this.layers.collision.alpha = 0;
  }

  setCollisionDebug(visible) {
    this._showCollision = visible;
    this.layers.collision.alpha = visible ? 0.45 : 0;
  }

  centerOn(worldX, worldY) {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    this.world.x = Math.round(screenW / 2 - worldX);
    this.world.y = Math.round(screenH / 2 - worldY);
  }

  /** Convert a screen-space point (e.g. mouse coords) to map tile coords. */
  screenToTile(screenX, screenY) {
    const wx = screenX - this.world.x;
    const wy = screenY - this.world.y;
    return { tx: Math.floor(wx / TILE_SIZE), ty: Math.floor(wy / TILE_SIZE) };
  }

  /** Convert tile coords to a world-space pixel (top-left of tile). */
  tileToWorld(tx, ty) {
    return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
  }
}
