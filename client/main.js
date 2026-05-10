import { Assets } from "pixi.js";
import { initInput, Context } from "./input/index.js";
import { Stage, TILE_SIZE } from "./render/Stage.js";
import { TileMapRenderer } from "./render/TileMapRenderer.js";
import { WorldEntitiesRenderer } from "./render/WorldEntities.js";
import { Avatar } from "./entities/Avatar.js";
import { TilePainter } from "./devtools/TilePainter.js";
import { ModalHub } from "./devtools/ModalHub.js";
import { api } from "./api.js";
import { GameClient } from "./game/GameClient.js";
import { WalkController } from "./game/WalkController.js";
import { InventoryPanel } from "./ui/panels/InventoryPanel.js";
import { EquipmentPanel } from "./ui/panels/EquipmentPanel.js";
import { SkillsPanel } from "./ui/panels/SkillsPanel.js";
import { BuildPanel } from "./ui/BuildPanel.js";
import { TabBar } from "./ui/TabBar.js";
import { Minimap } from "./ui/Minimap.js";
import { Toast } from "./ui/Toast.js";
import { showContextMenu, hideContextMenu } from "./ui/ContextMenu.js";
import { TradeModal } from "./ui/TradeModal.js";
import { Action } from "./input/actions.js";

async function boot() {
  const errBox = document.getElementById("boot-error");
  try {
    const [tiles, mapList] = await Promise.all([api.getTiles(), api.listMaps()]);
    if (!mapList.length) throw new Error("no maps in data/maps/");
    const mapId = mapList[0].id;
    const map = await api.getMap(mapId);

    // game client owns server-side state
    const gc = new GameClient();
    await gc.init(tiles);

    // toast pinned to GameClient
    const toast = new Toast({ root: document.getElementById("toast-host") });
    gc.bindToast((msg, cls) => toast.push(msg, cls));

    // preload sprite assets for tiles, items (placeholder), buildings (placeholder)
    const spriteUrls = tiles
      .map((t) => t.sprite)
      .filter(Boolean)
      .map((p) => `/sprites/${p}`);
    if (spriteUrls.length) await Assets.load(spriteUrls);

    const { bus, stack, mapper } = await initInput("/api");

    const stage = new Stage();
    const container = document.getElementById("pixi-container");
    await stage.init(container);

    const tileMap = new TileMapRenderer({ stage, tileDefs: tiles });
    tileMap.setMap(map);

    const entitiesRenderer = new WorldEntitiesRenderer({
      stage,
      nodeDefs: [...gc.nodeDefsById.values()],
      buildingDefs: gc.buildingDefs,
    });
    entitiesRenderer.setData(gc.state.resource_nodes, gc.state.buildings, gc.state.npcs);
    gc.onState(() => {
      entitiesRenderer.setData(gc.state.resource_nodes, gc.state.buildings, gc.state.npcs);
    });
    // Poll server state at 2 Hz so NPC positions and resource respawns reflect
    setInterval(() => gc.refreshState().catch(() => {}), 500);

    // player avatar
    const avatar = new Avatar({
      bus,
      tileMap,
      x: gc.state.player.tile_x,
      y: gc.state.player.tile_y,
    });
    stage.layers.props.addChild(avatar.container);

    // walk controller
    const walkable = (tx, ty) => {
      if (!tileMap.isWalkable(tx, ty)) return false;
      // also block tiles occupied by resource nodes / non-walkable buildings
      const nodeOnTile = entitiesRenderer.nodeAt(gc.state.resource_nodes, tx, ty);
      if (nodeOnTile) return false;
      const bld = entitiesRenderer.buildingAt(gc.state.buildings, tx, ty);
      if (bld) return false;
      return true;
    };
    const walker = new WalkController({ avatar, gameClient: gc, getWalkable: walkable });

    // dev tools
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
      gameClient: gc,
      onOpen: () => (isModalOpen = true),
      onClose: () => (isModalOpen = false),
    });

    const tradeModal = new TradeModal({
      root: document.getElementById("trade-modal"),
      gameClient: gc,
    });

    // game UI panels — each owns its own slot div so they don't clobber each other
    const panelHost = document.getElementById("hud-panel-host");
    const inventoryPanel = new InventoryPanel({
      root: document.getElementById("panel-inventory"),
      gameClient: gc,
      onContextMenu: (actions, x, y) => showContextMenu(actions, x, y),
    });
    const equipmentPanel = new EquipmentPanel({
      root: document.getElementById("panel-equipment"),
      gameClient: gc,
    });
    const skillsPanel = new SkillsPanel({
      root: document.getElementById("panel-skills"),
      gameClient: gc,
    });

    let buildSelection = null;
    const buildPanel = new BuildPanel({
      root: document.getElementById("panel-build"),
      gameClient: gc,
      onPickBuilding: (def) => {
        buildSelection = def;
        const cur = document.getElementById("build-cursor");
        cur.style.display = def ? "block" : "none";
        if (def) {
          cur.style.width = `${TILE_SIZE * def.width_tiles * stage.zoom}px`;
          cur.style.height = `${TILE_SIZE * def.height_tiles * stage.zoom}px`;
        }
      },
    });

    // tab bar — each panel owns its own slot; tabbar toggles which slot is visible
    const tabBar = new TabBar({
      root: document.getElementById("tab-host"),
      panelHost,
      panels: {
        inventory: inventoryPanel,
        equipment: equipmentPanel,
        skills:    skillsPanel,
        build:     buildPanel,
      },
      onSwitch: (id) => {
        if (id !== "build" && buildSelection) {
          buildSelection = null;
          document.getElementById("build-cursor").style.display = "none";
        }
      },
    });
    tabBar.activate("inventory");

    // minimap
    const minimap = new Minimap({
      root: document.getElementById("minimap-host"),
      gameClient: gc,
      mapData: map,
      onClickTile: (tx, ty) => walker.walkTo(tx, ty),
    });
    minimap.draw();

    // canvas click handlers (left = walk / harvest, right = context menu)
    const canvas = stage.app.canvas;
    canvas.addEventListener("click", (e) => {
      if (e.button !== 0) return;
      // Ignore if a UI panel got the click (event propagation already stopped there)
      hideContextMenu();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { tx, ty } = stage.screenToTile(sx, sy);

      // build mode click = place
      if (buildSelection) {
        gc.tryBuild(buildSelection.id, tx, ty);
        return;
      }

      // is there a node at this tile?
      const nodeInst = entitiesRenderer.nodeAt(gc.state.resource_nodes, tx, ty);
      if (nodeInst) {
        // walk adjacent then harvest
        walker.walkTo(tx, ty, () => gc.tryHarvest(nodeInst.id));
        return;
      }
      // building?
      const bld = entitiesRenderer.buildingAt(gc.state.buildings, tx, ty);
      if (bld) {
        const def = gc.buildingDefsById.get(bld.def_id);
        if (def?.provides_station === "fire") {
          const cookables = listCookableInventory();
          if (cookables.length) showContextMenu(cookables, e.clientX, e.clientY);
          else gc.toast("Nothing to cook.", "error");
        } else if (def?.provides_station === "town_hall") {
          const recruitOpts = recruitmentMenu();
          showContextMenu(recruitOpts, e.clientX, e.clientY);
        } else if (def?.provides_station === "workbench") {
          const buildables = workbenchMenu();
          if (buildables.length) showContextMenu(buildables, e.clientX, e.clientY);
          else gc.toast("Nothing to craft.", "error");
        } else {
          gc.toast(`${def?.name || "Building"}.`, "");
        }
        return;
      }
      // NPC?
      const npcHere = npcAt(tx, ty);
      if (npcHere) {
        if (npcHere.is_trader) {
          walker.walkTo(tx, ty, () => tradeModal.open(npcHere));
          return;
        }
        gc.toast(`${npcHere.name}: "Greetings."`, "");
        walker.walkTo(tx, ty);
        return;
      }
      // empty tile -> walk
      walker.walkTo(tx, ty);
    });

    function npcAt(tx, ty) {
      if (!gc.state?.npcs) return null;
      for (const id in gc.state.npcs) {
        const n = gc.state.npcs[id];
        if (Math.floor(n.tile_x) === tx && Math.floor(n.tile_y) === ty) return n;
        if (Math.abs(n.tile_x - (tx + 0.5)) < 0.7 && Math.abs(n.tile_y - (ty + 0.5)) < 0.7) return n;
      }
      return null;
    }

    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { tx, ty } = stage.screenToTile(sx, sy);
      const actions = [];
      const nodeInst = entitiesRenderer.nodeAt(gc.state.resource_nodes, tx, ty);
      if (nodeInst) {
        const def = gc.nodeDefsById.get(nodeInst.def_id);
        const verb = def?.skill === "woodcutting" ? "Chop" : def?.skill === "fishing" ? "Fish at" : "Harvest";
        actions.push({
          label: `${verb} ${def?.name}`,
          run: () => walker.walkTo(tx, ty, () => gc.tryHarvest(nodeInst.id)),
        });
        actions.push({ label: "Examine", run: () => gc.toast(def?.name || "Resource", "") });
      }
      const bld = entitiesRenderer.buildingAt(gc.state.buildings, tx, ty);
      if (bld) {
        const def = gc.buildingDefsById.get(bld.def_id);
        if (def?.provides_station === "fire") {
          const cookables = listCookableInventory();
          if (cookables.length) actions.push({ label: "Cook", run: () => showContextMenu(cookables, e.clientX, e.clientY) });
        }
        actions.push({ label: `Examine ${def?.name}`, run: () => gc.toast(def?.name || "Building", "") });
      }
      const npcInst = npcAt(tx, ty);
      if (npcInst) {
        if (npcInst.is_trader) {
          actions.push({
            label: `Trade with ${npcInst.name}`,
            run: () => walker.walkTo(tx, ty, () => tradeModal.open(npcInst)),
          });
        }
        actions.push({
          label: `Talk to ${npcInst.name}`,
          run: () => gc.toast(`${npcInst.name}: "Hello, traveller."`, ""),
        });
        actions.push({
          label: `Examine ${npcInst.name}`,
          run: () => gc.toast(`${npcInst.name} (${npcInst.archetype})`, ""),
        });
      }
      actions.push({ label: "Walk Here", run: () => walker.walkTo(tx, ty) });
      showContextMenu(actions, e.clientX, e.clientY);
    });

    function recruitmentMenu() {
      const opts = [];
      for (const arch of gc.npcArchetypes) {
        opts.push({
          label: `Recruit ${arch.name_pool[0]}-type (${arch.base_recruitment_cost} gp)`,
          run: async () => {
            try {
              const px = Math.floor(gc.state.player.tile_x);
              const py = Math.floor(gc.state.player.tile_y);
              const r = await api.recruitNpc(arch.id, px + 1, py);
              if (r?.npc) {
                gc.toast(`${r.npc.name} joined the settlement.`, "success");
                await gc.refreshState();
              }
            } catch (err) {
              gc.toast(err.message || "Recruitment failed.", "error");
            }
          },
        });
      }
      opts.push({ label: "Cancel", run: () => {} });
      return opts;
    }

    function workbenchMenu() {
      return [...gc.recipesById.values()]
        .filter((r) => r.station === "workbench")
        .map((r) => ({
          label: `${r.name} (Lv ${r.skill_level_required} ${r.skill})`,
          run: () => gc.tryCraft(r.id),
        }));
    }

    function listCookableInventory() {
      const inv = gc.state?.player?.inventory;
      if (!inv) return [];
      const seen = new Set();
      const out = [];
      for (let i = 0; i < inv.slots.length; i++) {
        const slot = inv.slots[i];
        if (!slot) continue;
        const item = gc.itemsById.get(slot.item_id);
        if (!item || !item.cookable_into) continue;
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        out.push({
          label: `Cook ${item.name}`,
          run: () => gc.tryCookFromSlot(i),
        });
      }
      return out;
    }

    // build cursor follows mouse
    const buildCursor = document.getElementById("build-cursor");
    canvas.addEventListener("mousemove", (e) => {
      if (!buildSelection) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { tx, ty } = stage.screenToTile(sx, sy);
      const wx = tx * TILE_SIZE * stage.zoom + stage.world.x;
      const wy = ty * TILE_SIZE * stage.zoom + stage.world.y;
      buildCursor.style.left = `${wx}px`;
      buildCursor.style.top = `${wy}px`;
      buildCursor.style.width = `${TILE_SIZE * buildSelection.width_tiles * stage.zoom}px`;
      buildCursor.style.height = `${TILE_SIZE * buildSelection.height_tiles * stage.zoom}px`;
    });

    // hud
    const hudFps = document.getElementById("hud-fps");
    const hudCtx = document.getElementById("hud-context");
    const hudCoords = document.getElementById("hud-coords");
    const hudZoom = document.getElementById("hud-zoom");

    let last = performance.now();
    let fpsAccum = 0,
      fpsCount = 0,
      fpsShown = 0;
    let serverSyncAccum = 0;

    function frame(now) {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;

      mapper.pollGamepad();

      if (!isModalOpen) {
        // WASD overrides path-walking — cancel path if held
        const keyboardMoving =
          bus.isHeld(Action.MOVE_UP) ||
          bus.isHeld(Action.MOVE_DOWN) ||
          bus.isHeld(Action.MOVE_LEFT) ||
          bus.isHeld(Action.MOVE_RIGHT);
        if (keyboardMoving) walker.cancel();

        if (walker.hasPath()) {
          walker.step(dt);
        } else {
          avatar.update(dt);
        }

        // server sync every 0.5s during keyboard movement
        if (keyboardMoving) {
          serverSyncAccum += dt;
          if (serverSyncAccum >= 0.5) {
            serverSyncAccum = 0;
            api.teleport(avatar.x, avatar.y).catch(() => {});
          }
        }
      }
      tilePainter.update();

      stage.centerOn(avatar.worldPos.x, avatar.worldPos.y);

      fpsAccum += dt;
      fpsCount++;
      if (fpsAccum >= 0.5) {
        fpsShown = Math.round(fpsCount / fpsAccum);
        fpsAccum = 0;
        fpsCount = 0;
        // refresh minimap once a second-ish
        minimap.draw();
      }
      hudFps.textContent = `${fpsShown} fps`;
      hudCtx.textContent = `ctx: ${stack.snapshot().join(" › ")}`;
      hudCoords.textContent = `tile ${Math.floor(avatar.x)} , ${Math.floor(avatar.y)}`;
      hudZoom.textContent = `zoom ${stage.zoom.toFixed(2)}x`;

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    console.log("[grindholm] 2.0 booted — F1 paint · F2 hub · click to walk · right-click for menu");
  } catch (err) {
    console.error("[grindholm] boot failed:", err);
    errBox.classList.remove("hidden");
    errBox.textContent = `Boot failed:\n${err.stack || err.message || err}`;
  }
}

boot();
