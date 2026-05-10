import { Assets } from "pixi.js";
import { initInput, Context } from "./input/index.js";
import { Stage, TILE_SIZE } from "./render/Stage.js";
import { TileMapRenderer } from "./render/TileMapRenderer.js";
import { Avatar } from "./entities/Avatar.js";
import { TilePainter } from "./devtools/TilePainter.js";
import { ModalHub } from "./devtools/ModalHub.js";
import { api } from "./api.js";

const TICK_HZ = 60;

async function boot() {
  const errBox = document.getElementById("boot-error");
  try {
    const [tiles, mapList] = await Promise.all([api.getTiles(), api.listMaps()]);
    if (!mapList.length) throw new Error("no maps in data/maps/");
    const mapId = mapList[0].id;
    const map = await api.getMap(mapId);

    // Preload every sprite referenced by a TileDef. Backend serves the
    // assets/ folder under /sprites, so def.sprite="tiles/grass.png" maps
    // to /sprites/tiles/grass.png.
    const spriteUrls = tiles
      .map((t) => t.sprite)
      .filter(Boolean)
      .map((p) => `/sprites/${p}`);
    if (spriteUrls.length) {
      await Assets.load(spriteUrls);
      console.log(`[grindholm] preloaded ${spriteUrls.length} tile sprites`);
    }

    const { bus, stack, mapper } = await initInput("/api");

    const stage = new Stage();
    const container = document.getElementById("pixi-container");
    await stage.init(container);

    const tileMap = new TileMapRenderer({ stage, tileDefs: tiles });
    tileMap.setMap(map);

    const avatar = new Avatar({
      bus,
      tileMap,
      x: map.spawn[0],
      y: map.spawn[1],
    });
    stage.layers.props.addChild(avatar.container);

    const tilePainter = new TilePainter({
      root: document.getElementById("dev-overlay"),
      stage,
      tileMap,
      tileDefs: tiles,
      bus,
      contextStack: stack,
      mapper,
      api,
      avatar,
      onSaved: () => console.log("[devtools] map saved"),
    });

    let isModalOpen = false;
    const modalHub = new ModalHub({
      root: document.getElementById("modal-hub"),
      bus,
      contextStack: stack,
      onOpen: () => {
        isModalOpen = true;
      },
      onClose: () => {
        isModalOpen = false;
      },
    });

    const hudFps = document.getElementById("hud-fps");
    const hudCtx = document.getElementById("hud-context");
    const hudCoords = document.getElementById("hud-coords");
    const hudZoom = document.getElementById("hud-zoom");

    let last = performance.now();
    let fpsAccum = 0;
    let fpsCount = 0;
    let fpsShown = 0;

    function frame(now) {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;

      mapper.pollGamepad();

      if (!isModalOpen) {
        avatar.update(dt);
      }
      tilePainter.update();

      stage.centerOn(avatar.worldPos.x, avatar.worldPos.y);

      // hud
      fpsAccum += dt;
      fpsCount++;
      if (fpsAccum >= 0.5) {
        fpsShown = Math.round(fpsCount / fpsAccum);
        fpsAccum = 0;
        fpsCount = 0;
      }
      hudFps.textContent = `${fpsShown} fps`;
      hudCtx.textContent = `ctx: ${stack.snapshot().join(" › ")}`;
      hudCoords.textContent = `tile ${Math.floor(avatar.x)} , ${Math.floor(avatar.y)}`;
      hudZoom.textContent = `zoom ${stage.zoom.toFixed(2)}x`;

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    console.log("[grindholm] booted ok — F1 paint, F2 hub, ESC back");
  } catch (err) {
    console.error("[grindholm] boot failed:", err);
    errBox.classList.remove("hidden");
    errBox.textContent = `Boot failed:\n${err.stack || err.message || err}`;
  }
}

boot();
