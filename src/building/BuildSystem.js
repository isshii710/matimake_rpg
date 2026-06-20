import * as THREE from 'three';
import { BUILDINGS } from './Buildings.js';
import { ITEMS } from '../data/Items.js';
import { woodTex, stoneWallTex, roofTex, chestTex } from '../world/TextureFactory.js';

// Building layer: 0=ground(floor/furniture), 1=wall, 2=roof
const LAYER = {
  wood_floor: 0, stone_floor: 0,
  campfire: 0, lantern: 0, table: 0, bed: 0, well: 0, farm_plot: 0, chest: 0,
  wood_wall: 1, stone_wall: 1, door: 1,
  roof: 2, flat_roof: 2,
};
const WALL_IDS = new Set(['wood_wall', 'stone_wall', 'door']);
const WALL_H = 1.5; // must match Buildings.js wall height
const MAX_WALL_FLOOR = 3; // 4 floors total (0-3)

function lkey(gx, gz, layer) { return `${gx},${gz}:${layer}`; }
function wkey(gx, gz, floor) { return floor === 0 ? `${gx},${gz}:1` : `${gx},${gz}:1:${floor}`; }
function getLayer(id) { return LAYER[id] ?? 0; }

export class BuildSystem {
  constructor(scene, grid, game) {
    this.scene = scene;
    this.grid = grid;
    this.game = game;

    this.mode = false;
    this.selectedId = null;
    this.demolishMode = false;
    this._rotation = 0; // 0‑3, applied as rotation.y = n * PI/2

    this._buildings = new Map(); // lkey -> { id, mesh, light, def, gx, gz, layer, rotation }
    this._solidCells = new Set();
    this._chestInventories = new Map(); // `${gx},${gz}` -> [{id,count}]
    this._cornerPosts = new Map(); // postKey -> mesh

    this._ghost = null;
    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._pointer = new THREE.Vector2();
    this._ghostGx = -1;
    this._ghostGz = -1;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onRightClick = this._onRightClick.bind(this);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('contextmenu', this._onRightClick);
  }

  // ── Mode control ──────────────────────────────────────────────────────────

  enterBuildMode(id) {
    this.demolishMode = false;
    this.mode = true;
    this.selectedId = id;
    this._rotation = 0;
    this._updateGhost();
    this._syncDemolishBtn();
  }

  enterDemolishMode() {
    this._clearGhost();
    this.mode = false;
    this.demolishMode = true;
    this.selectedId = null;
    this._syncDemolishBtn();
  }

  exitBuildMode() {
    this._clearGhost();
    this.mode = false;
    this.demolishMode = false;
    this.selectedId = null;
    this._syncDemolishBtn();
  }

  rotate() {
    this._rotation = (this._rotation + 1) % 4;
    this._updateGhost();
    this.game.showDialog(`回転: ${this._rotation * 90}°`);
  }

  // ── Craft building item ───────────────────────────────────────────────────

  craftBuilding(id) {
    const def = BUILDINGS[id];
    if (!def) return false;

    for (const [item, count] of Object.entries(def.cost)) {
      if (!this.game.inventory.has(item, count)) {
        const iDef = ITEMS[item];
        this.game.showDialog(`素材不足！${iDef?.icon || ''}${iDef?.name || item}×${count}必要`);
        return false;
      }
    }

    for (const [item, count] of Object.entries(def.cost)) {
      this.game.inventory.remove(item, count);
    }

    this.game.inventory.add(id, 1);

    if (def.isTool) {
      this.game.showDialog(`${def.name}をクラフト！SPACEで使用`);
      this.game.inventory.render();
      return true;
    }

    this.game.showDialog(`${def.name}をクラフト！クリックで設置`);

    // Auto-select and enter build mode
    this.game.inventory._selectedBuildingId = id;
    this.enterBuildMode(id);
    this.game.inventory.render();
    return true;
  }

  // ── Wall floor helpers ────────────────────────────────────────────────────

  _getMaxWallFloor(gx, gz) {
    for (let f = MAX_WALL_FLOOR; f >= 0; f--) {
      if (this._buildings.has(wkey(gx, gz, f))) return f;
    }
    return -1;
  }

  _getNextWallFloor(gx, gz) {
    for (let f = 0; f <= MAX_WALL_FLOOR; f++) {
      if (!this._buildings.has(wkey(gx, gz, f))) return f;
    }
    return -1; // all floors full
  }

  // ── Place ─────────────────────────────────────────────────────────────────

  place(gx, gz) {
    if (!this.mode || !this.selectedId) return false;
    const buildingId = this.selectedId; // save before potential exitBuildMode via inventory
    const def = BUILDINGS[buildingId];
    if (!def) return false;

    const isBuildingItem = !!ITEMS[buildingId]?.isBuildingItem;

    if (isBuildingItem && !this.game.inventory.has(buildingId, 1)) {
      this.game.showDialog(`${def.name}がない！まず作ろう`);
      this.exitBuildMode();
      return false;
    }

    const layer = getLayer(buildingId);
    let key, wallFloor = 0, yPos;

    if (WALL_IDS.has(buildingId)) {
      wallFloor = this._getNextWallFloor(gx, gz);
      if (wallFloor === -1) {
        this.game.showDialog('これ以上積めない！（最大4階）');
        return false;
      }
      if (wallFloor === 0 && !this.grid.isWalkable(gx, gz)) {
        this.game.showDialog('ここには建てられない！');
        return false;
      }
      key = wkey(gx, gz, wallFloor);
      yPos = 0.075 + def.h / 2 + WALL_H * wallFloor;
    } else if (layer === 2) {
      key = lkey(gx, gz, layer);
      if (this._buildings.has(key)) {
        this.game.showDialog('ここにはすでに屋根がある！');
        return false;
      }
      const maxWall = this._getMaxWallFloor(gx, gz);
      const wallCount = maxWall >= 0 ? maxWall + 1 : 1;
      yPos = WALL_H * wallCount + 0.15 + def.h / 2;
    } else {
      key = lkey(gx, gz, layer);
      if (this._buildings.has(key)) {
        this.game.showDialog('ここにはすでにある！');
        return false;
      }
      if (!this.grid.isWalkable(gx, gz)) {
        this.game.showDialog('ここには建てられない！');
        return false;
      }
      yPos = this._yFor(buildingId, def);
    }

    if (isBuildingItem) {
      this.game.inventory.remove(buildingId, 1); // may trigger exitBuildMode if last item
    } else {
      for (const [item, count] of Object.entries(def.cost)) {
        if (!this.game.inventory.has(item, count)) {
          this.game.showDialog(`${item}が${count}個必要！`);
          return false;
        }
      }
      for (const [item, count] of Object.entries(def.cost)) {
        this.game.inventory.remove(item, count);
      }
    }

    const mesh = this._createMesh(def);
    const { wx, wz } = this.grid.gridToWorld(gx, gz);
    mesh.position.set(wx, yPos, wz);
    mesh.rotation.y = this._rotation * Math.PI / 2;
    if (layer === 1 || layer === 2) {
      mesh.material.transparent = true;
      mesh.material.opacity = 1.0;
    }
    this.scene.add(mesh);

    let light = null;
    if (def.light) {
      light = new THREE.PointLight(def.light.color, def.light.intensity, def.light.distance);
      light.position.set(wx, 1.5, wz);
      this.scene.add(light);
    }

    this._buildings.set(key, { id: buildingId, mesh, light, def, gx, gz, layer, wallFloor, rotation: this._rotation });
    this._recomputeSolid(gx, gz);

    if (WALL_IDS.has(buildingId)) this._rebuildCornerPosts();

    this.game.questMgr.onEvent('build', { target: buildingId });
    if (def.isWell) this.game.showDialog('井戸を建てた！近くでEを押すと水バケツを汲める。');
    if (def.isChest) this.game.showDialog('チェストを建てた！近づいてクリック（またはE）で開ける。');

    return true;
  }

  // ── Demolish ──────────────────────────────────────────────────────────────

  demolish(gx, gz) {
    // Try wall floors top-down first (remove topmost wall first)
    for (let f = MAX_WALL_FLOOR; f >= 0; f--) {
      const key = wkey(gx, gz, f);
      const b = this._buildings.get(key);
      if (!b) continue;

      this.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      if (b.light) this.scene.remove(b.light);

      for (const [item, count] of Object.entries(b.def.cost)) {
        this.game.inventory.add(item, Math.floor(count * 0.5));
      }
      this._buildings.delete(key);
      this._recomputeSolid(gx, gz);

      this._rebuildCornerPosts();
      this.game.showDialog('撤去完了！素材を50%回収。');
      return true;
    }

    // Then ground and roof layers
    for (const layer of [0, 2]) {
      const key = lkey(gx, gz, layer);
      const b = this._buildings.get(key);
      if (!b) continue;

      this.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      if (b.light) this.scene.remove(b.light);

      for (const [item, count] of Object.entries(b.def.cost)) {
        this.game.inventory.add(item, Math.floor(count * 0.5));
      }
      this._buildings.delete(key);
      this._recomputeSolid(gx, gz);

      this.game.showDialog('撤去完了！素材を50%回収。');
      return true;
    }
    return false;
  }

  remove(gx, gz) { return this.demolish(gx, gz); } // backward compat

  // ── Queries ───────────────────────────────────────────────────────────────

  isSolid(gx, gz) { return this._solidCells.has(`${gx},${gz}`); }

  getBuilding(gx, gz) {
    // Check wall floors top-down
    for (let f = MAX_WALL_FLOOR; f >= 0; f--) {
      const b = this._buildings.get(wkey(gx, gz, f));
      if (b) return b;
    }
    // Then ground and roof
    for (const layer of [0, 2]) {
      const b = this._buildings.get(lkey(gx, gz, layer));
      if (b) return b;
    }
    return null;
  }

  isWellNearby(gx, gz, range = 3) {
    for (let dz = -range; dz <= range; dz++) {
      for (let dx = -range; dx <= range; dx++) {
        if (this.getBuilding(gx + dx, gz + dz)?.def?.isWell) return true;
      }
    }
    return false;
  }

  getChestInventory(gx, gz) {
    const key = `${gx},${gz}`;
    if (!this._chestInventories.has(key)) this._chestInventories.set(key, []);
    return this._chestInventories.get(key);
  }

  // Place building without resource deduction (used by save system)
  placeFromSave(id, gx, gz, layer, rotation = 0, wallFloor = 0) {
    const def = BUILDINGS[id];
    if (!def) return false;
    const key = WALL_IDS.has(id) ? wkey(gx, gz, wallFloor) : lkey(gx, gz, layer);
    if (this._buildings.has(key)) return false;

    let yPos;
    if (WALL_IDS.has(id)) {
      yPos = 0.075 + def.h / 2 + WALL_H * wallFloor;
    } else if (layer === 2) {
      const maxWall = this._getMaxWallFloor(gx, gz);
      const wallCount = maxWall >= 0 ? maxWall + 1 : 1;
      yPos = WALL_H * wallCount + 0.15 + def.h / 2;
    } else {
      yPos = this._yFor(id, def);
    }

    const mesh = this._createMesh(def);
    const { wx, wz } = this.grid.gridToWorld(gx, gz);
    mesh.position.set(wx, yPos, wz);
    mesh.rotation.y = rotation * Math.PI / 2;
    if (layer === 1 || layer === 2) { mesh.material.transparent = true; mesh.material.opacity = 1.0; }
    this.scene.add(mesh);

    let light = null;
    if (def.light) {
      light = new THREE.PointLight(def.light.color, def.light.intensity, def.light.distance);
      light.position.set(wx, 1.5, wz);
      this.scene.add(light);
    }
    this._buildings.set(key, { id, mesh, light, def, gx, gz, layer, wallFloor, rotation });
    this._recomputeSolid(gx, gz);
    if (WALL_IDS.has(id)) this._rebuildCornerPosts();
    return true;
  }

  // ── Solid cell helpers ────────────────────────────────────────────────────

  _recomputeSolid(gx, gz) {
    const floor0 = this._buildings.get(wkey(gx, gz, 0));
    const groundB = this._buildings.get(lkey(gx, gz, 0));
    if (floor0?.def.solid || groundB?.def.solid) {
      this._solidCells.add(`${gx},${gz}`);
    } else {
      this._solidCells.delete(`${gx},${gz}`);
    }
  }

  // ── Update (ghost + transparency) ────────────────────────────────────────

  update(camera) {
    const px = this.game.player?.gx ?? -999;
    const pz = this.game.player?.gz ?? -999;
    for (const [, b] of this._buildings) {
      if (!b.mesh.material.transparent) continue;
      if (b.layer === 2) {
        // Roof: fade when player is directly under or adjacent
        const dist = Math.max(Math.abs(b.gx - px), Math.abs(b.gz - pz));
        const target = dist <= 2 ? 0.12 : 1.0;
        b.mesh.material.opacity += (target - b.mesh.material.opacity) * 0.12;
      } else if (b.layer === 1) {
        // Wall: fade when player is behind it (wall is between player and camera)
        // Camera is at player+(25,22,25), so walls with +dx,+dz from player occlude
        const dx = b.gx - px;
        const dz = b.gz - pz;
        const isOccluding = (dx + dz) > 0 && (dx + dz) <= 4 && dx >= 0 && dz >= 0;
        const target = isOccluding ? 0.18 : 1.0;
        b.mesh.material.opacity += (target - b.mesh.material.opacity) * 0.12;
      }
    }

    if (!this.mode || !this._ghost) return;

    const player = this.game.player;
    if (!player) return;
    const fd = player._facingDir;
    const { gx: pgx, gz: pgz } = this.grid.worldToGrid(player.position.x, player.position.z);
    const gx = pgx + Math.round(fd.x);
    const gz = pgz + Math.round(fd.z);
    const { wx, wz } = this.grid.gridToWorld(gx, gz);
    const def = BUILDINGS[this.selectedId];
    const layer = getLayer(this.selectedId);

    // Auto-rotate walls based on facing direction
    let rotChanged = false;
    if (WALL_IDS.has(this.selectedId)) {
      const newRot = Math.abs(fd.x) > Math.abs(fd.z) ? 1 : 0;
      if (newRot !== this._rotation) {
        this._rotation = newRot;
        this._ghost.rotation.y = this._rotation * Math.PI / 2;
        rotChanged = true;
      }
    }

    if (gx !== this._ghostGx || gz !== this._ghostGz || rotChanged) {
      this._ghostGx = gx;
      this._ghostGz = gz;

      let yPos, canPlace;
      if (WALL_IDS.has(this.selectedId)) {
        const nextFloor = this._getNextWallFloor(gx, gz);
        const ghostFloor = nextFloor === -1 ? MAX_WALL_FLOOR : nextFloor;
        yPos = 0.075 + def.h / 2 + WALL_H * ghostFloor;
        canPlace = nextFloor !== -1 && this.grid.isWalkable(gx, gz);
      } else if (layer === 2) {
        const maxWall = this._getMaxWallFloor(gx, gz);
        const wallCount = maxWall >= 0 ? maxWall + 1 : 1;
        yPos = WALL_H * wallCount + 0.15 + def.h / 2;
        canPlace = !this._buildings.has(lkey(gx, gz, layer));
      } else {
        yPos = this._yFor(this.selectedId, def);
        canPlace = this.grid.isWalkable(gx, gz) && !this._buildings.has(lkey(gx, gz, layer));
      }

      this._ghost.position.set(wx, yPos, wz);
      this._ghost.material.color.setHex(canPlace ? 0x88ff88 : 0xff4444);
      this._ghost.material.opacity = canPlace ? 0.5 : 0.4;
    }
  }

  // ── Corner posts (fill L-junction gaps between perpendicular walls) ────────

  _rebuildCornerPosts() {
    for (const mesh of this._cornerPosts.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this._cornerPosts.clear();

    for (const [, b] of this._buildings) {
      if (!WALL_IDS.has(b.id)) continue;
      const bRot = b.rotation % 2;
      const { wx: bx, wz: bz } = this.grid.gridToWorld(b.gx, b.gz);

      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const ngx = b.gx + dx, ngz = b.gz + dz;
        // Find any perpendicular wall neighbor at any floor
        let perpDef = null;
        for (let f = 0; f <= MAX_WALL_FLOOR; f++) {
          const nb = this._buildings.get(wkey(ngx, ngz, f));
          if (nb && WALL_IDS.has(nb.id) && nb.rotation % 2 !== bRot) {
            perpDef = nb.def;
            break;
          }
        }
        if (!perpDef) continue;

        const { wx: nx, wz: nz } = this.grid.gridToWorld(ngx, ngz);
        const px = (bx + nx) / 2;
        const pz = (bz + nz) / 2;
        const pKey = `${px.toFixed(3)},${pz.toFixed(3)}`;
        if (this._cornerPosts.has(pKey)) continue;

        // Post height covers the tallest wall stack at either cell
        const maxFloor = Math.max(
          this._getMaxWallFloor(b.gx, b.gz),
          this._getMaxWallFloor(ngx, ngz)
        );
        const postH = WALL_H * (maxFloor + 1);

        const postGeo = new THREE.BoxGeometry(0.5, postH, 0.5);
        const postMat = new THREE.MeshLambertMaterial({
          color: b.def.color,
          map: this._texFor(b.def),
        });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, 0.075 + postH / 2, pz);
        this.scene.add(post);
        this._cornerPosts.set(pKey, post);
      }
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  _yFor(id, def) {
    return getLayer(id) === 2
      ? WALL_H + 0.15 + def.h / 2  // roof sits on top of walls
      : 0.075 + def.h / 2;
  }

  _createMesh(def) {
    const geo = def.isRoof
      ? new THREE.ConeGeometry(0.72, def.h, 4)
      : new THREE.BoxGeometry(def.w, def.h, def.d);
    const tex = this._texFor(def);
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: tex ? 0xffffff : def.color,
      map: tex,
      emissive: def.emissive || 0x000000,
      emissiveIntensity: def.emissiveIntensity || 0,
    }));
  }

  _texFor(def) {
    if (def.isRoof) return roofTex();
    if (def.isChest) return chestTex();
    if (def.id === 'wood_wall' || def.id === 'wood_floor' || def.id === 'door') return woodTex(def.color);
    if (def.id === 'stone_wall' || def.id === 'stone_floor') return stoneWallTex();
    if (def.id === 'table' || def.id === 'bed') return woodTex(def.color);
    return null;
  }

  _updateGhost() {
    this._clearGhost();
    const def = BUILDINGS[this.selectedId];
    if (!def) return;
    const geo = def.isRoof
      ? new THREE.ConeGeometry(0.72, def.h, 4)
      : new THREE.BoxGeometry(def.w, def.h, def.d);
    this._ghost = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x88ff88, transparent: true, opacity: 0.5,
    }));
    this._ghost.rotation.y = this._rotation * Math.PI / 2;
    this.scene.add(this._ghost);
  }

  _clearGhost() {
    if (this._ghost) {
      this.scene.remove(this._ghost);
      this._ghost.geometry.dispose();
      this._ghost = null;
    }
  }

  _syncDemolishBtn() {
    const btn = document.getElementById('demolish-toggle');
    if (btn) btn.classList.toggle('active', this.demolishMode);
  }

  _onMouseMove(e) {
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _onRightClick(e) {
    e.preventDefault();
    if (this.mode || this.demolishMode) {
      this.game.buildMenu?.exitBuildMode();
    }
  }
}
