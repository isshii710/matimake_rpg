import * as THREE from 'three';
import { BUILDINGS } from './Buildings.js';

// Building layer: 0=ground(floor/furniture), 1=wall, 2=roof
const LAYER = {
  wood_floor: 0, stone_floor: 0,
  campfire: 0, lantern: 0, table: 0, bed: 0, well: 0, farm_plot: 0,
  wood_wall: 1, stone_wall: 1, door: 1,
  roof: 2,
};
const WALL_H = 1.5; // must match Buildings.js wall height

function lkey(gx, gz, layer) { return `${gx},${gz}:${layer}`; }
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

    this._buildings = new Map(); // lkey -> { id, mesh, light, def, gx, gz, layer }
    this._solidCells = new Set();

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

  // ── Place ─────────────────────────────────────────────────────────────────

  place(gx, gz) {
    if (!this.mode || !this.selectedId) return false;
    const def = BUILDINGS[this.selectedId];
    if (!def) return false;

    const layer = getLayer(this.selectedId);
    const key = lkey(gx, gz, layer);

    if (this._buildings.has(key)) {
      this.game.showDialog('ここにはすでにある！');
      return false;
    }
    if (layer !== 2 && !this.grid.isWalkable(gx, gz)) {
      this.game.showDialog('ここには建てられない！');
      return false;
    }
    for (const [item, count] of Object.entries(def.cost)) {
      if (!this.game.inventory.has(item, count)) {
        this.game.showDialog(`${item}が${count}個必要！`);
        return false;
      }
    }
    for (const [item, count] of Object.entries(def.cost)) {
      this.game.inventory.remove(item, count);
    }

    const mesh = this._createMesh(def);
    const { wx, wz } = this.grid.gridToWorld(gx, gz);
    mesh.position.set(wx, this._yFor(this.selectedId, def), wz);
    mesh.rotation.y = this._rotation * Math.PI / 2;
    if (layer === 2) {
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

    this._buildings.set(key, { id: this.selectedId, mesh, light, def, gx, gz, layer });
    if (def.solid) this._solidCells.add(`${gx},${gz}`);

    this.game.questMgr.onEvent('build', { target: this.selectedId });
    if (def.isWell) this.game.showDialog('井戸を建てた！近くでEを押すと水バケツを汲める。');

    return true;
  }

  // ── Demolish ──────────────────────────────────────────────────────────────

  demolish(gx, gz) {
    // Try layers in priority order: wall → ground → roof
    for (const layer of [1, 0, 2]) {
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

      // Only remove solid if no wall remains in this cell
      if (!this._buildings.has(lkey(gx, gz, 1))) {
        this._solidCells.delete(`${gx},${gz}`);
      }
      this.game.showDialog('撤去完了！素材を50%回収。');
      return true;
    }
    return false;
  }

  remove(gx, gz) { return this.demolish(gx, gz); } // backward compat

  // ── Queries ───────────────────────────────────────────────────────────────

  isSolid(gx, gz) { return this._solidCells.has(`${gx},${gz}`); }

  getBuilding(gx, gz) {
    for (const layer of [1, 0, 2]) {
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

  // ── Update (ghost + roof transparency) ───────────────────────────────────

  update(camera) {
    // Roof transparency: fade when player is nearby
    const px = this.game.player?.gx ?? -999;
    const pz = this.game.player?.gz ?? -999;
    for (const [, b] of this._buildings) {
      if (b.layer !== 2) continue;
      const dist = Math.max(Math.abs(b.gx - px), Math.abs(b.gz - pz));
      const target = dist <= 2 ? 0.12 : 1.0;
      b.mesh.material.opacity += (target - b.mesh.material.opacity) * 0.12;
    }

    if (!this.mode || !this._ghost) return;
    this._raycaster.setFromCamera(this._pointer, camera);
    const pt = new THREE.Vector3();
    if (this._raycaster.ray.intersectPlane(this._groundPlane, pt)) {
      const { gx, gz } = this.grid.worldToGrid(pt.x, pt.z);
      if (gx !== this._ghostGx || gz !== this._ghostGz) {
        this._ghostGx = gx;
        this._ghostGz = gz;
        const def = BUILDINGS[this.selectedId];
        const layer = getLayer(this.selectedId);
        const { wx, wz } = this.grid.gridToWorld(gx, gz);
        this._ghost.position.set(wx, this._yFor(this.selectedId, def), wz);
        const canPlace = (layer === 2 || this.grid.isWalkable(gx, gz))
          && !this._buildings.has(lkey(gx, gz, layer));
        this._ghost.material.color.setHex(canPlace ? 0x88ff88 : 0xff4444);
        this._ghost.material.opacity = canPlace ? 0.5 : 0.4;
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
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: def.color,
      emissive: def.emissive || 0x000000,
      emissiveIntensity: def.emissiveIntensity || 0,
    }));
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
