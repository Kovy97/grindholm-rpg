import { Application, Container, TextureSource } from "pixi.js";

// Mirror of shared/schemas/constants.py::TILE_PIXEL_SIZE. Don't drift.
export const TILE_SIZE = 128;

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3.0;
const ZOOM_STEP = 1.15;

// Pixel-art rule of thumb: every imported texture must scale with nearest-
// neighbour, never bilinear, or zoomed-in sprites get fuzzy edges.
// Set defaults here so anything loaded later inherits the right mode.
TextureSource.defaultOptions.scaleMode = "nearest";

// Owns the Pixi.Application and the layered scene graph.
// Layers (back to front): ground, objects, collision (debug), entities, ui.
// World container is centered/scaled by the Camera.
export class Stage {
  constructor() {
    this.app = new Application();
    this.world = new Container();
    // 3/4-perspective render layout:
    //   ground     — flat tiles, no Y-sort
    //   props      — objects + collision-layer tiles + the avatar, all
    //                Y-sorted by foot position so taller things draw on top
    //                of stuff in front of them
    //   debug      — collision-debug overlay (red outlines, optional)
    this.layers = {
      ground: new Container(),
      props: new Container(),
      debug: new Container(),
    };
    this.layers.props.sortableChildren = true;
    this.world.addChild(this.layers.ground);
    this.world.addChild(this.layers.props);
    this.world.addChild(this.layers.debug);
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
    this.layers.debug.alpha = 0;
    this._zoom = 1.0;
    this.world.scale.set(this._zoom);

    // Mousewheel zoom — bound to the canvas so it doesn't fire while
    // a modal/dev panel scrolls its own content.
    this.app.canvas.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });
  }

  setCollisionDebug(visible) {
    this._showCollision = visible;
    this.layers.debug.alpha = visible ? 0.45 : 0;
  }

  get zoom() {
    return this._zoom;
  }

  setZoom(z) {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    if (Math.abs(clamped - this._zoom) < 1e-4) return;
    this._zoom = clamped;
    this.world.scale.set(clamped);
  }

  zoomBy(factor) {
    this.setZoom(this._zoom * factor);
  }

  _onWheel(e) {
    e.preventDefault();
    // wheel up (deltaY < 0) -> zoom in. Standard map-editor convention.
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    this.zoomBy(factor);
  }

  centerOn(worldX, worldY) {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const z = this._zoom;
    this.world.x = Math.round(screenW / 2 - worldX * z);
    this.world.y = Math.round(screenH / 2 - worldY * z);
  }

  /** Convert a screen-space point (e.g. mouse coords) to map tile coords. */
  screenToTile(screenX, screenY) {
    const z = this._zoom;
    const wx = (screenX - this.world.x) / z;
    const wy = (screenY - this.world.y) / z;
    return { tx: Math.floor(wx / TILE_SIZE), ty: Math.floor(wy / TILE_SIZE) };
  }

  /** Convert tile coords to a world-space pixel (top-left of tile). */
  tileToWorld(tx, ty) {
    return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
  }
}
