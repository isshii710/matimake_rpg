import * as THREE from 'three';
import { BUILDINGS } from './Buildings.js';
import { TILE } from '../world/TileTypes.js';

export class BuildSystem {
  constructor(scene, grid, game) {
    this.scene = scene;
    this.grid = grid;
    this.game = game;

    this.mode = false;
    this.selectedId = null;
    this._buildings = new Map(); // key: `${gx},${gz}` -> { id, mesh, light?, def }
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

  enterBuildMode(buildingId) {
    this.mode = true;
    this.selectedId = buildingId;
    this._updateGhost();
  }

  exitBuildMode() {
    this.mode = false;
    this.selectedId = null;
    if (this._ghost) {
      this.scene.remove(this._ghost);
      this._ghost.geometry.dispose();
      this._ghost = null;
    }
  }

  place(gx, gz) {
    if (!this.mode || !this.selectedId) return false;
    const key = `${gx},${gz}`;
    if (this._buildings.has(key)) {
      this.game.showDialog('ここにはすでに建物がある！');
      return false;
    }
    if (!this.grid.isWalkable(gx, gz)) {
      this.game.showDialog('ここには建てられない！');
      return false;
    }

    const def = BUILDINGS[this.selectedId];
    if (!def) return false;

    // Check resources
    for (const [item, count] of Object.entries(def.cost)) {
      if (!this.game.inventory.has(item, count)) {
        this.game.showDialog(`${item}が${count}個必要！`);
        return false;
      }
    }

    // Spend resources
    for (const [item, count] of Object.entries(def.cost)) {
      this.game.inventory.remove(item, count);
    }

    const mesh = this._createBuildingMesh(def);
    const { wx, wz } = this.grid.gridToWorld(gx, gz);
    mesh.position.set(wx, 0.075 + def.h / 2, wz);
    this.scene.add(mesh);

    let light = null;
    if (def.light) {
      light = new THREE.PointLight(def.light.color, def.light.intensity, def.light.distance);
      light.position.set(wx, 1.5, wz);
      this.scene.add(light);
    }

    this._buildings.set(key, { id: this.selectedId, mesh, light, def });
    if (def.solid) this._solidCells.add(key);

    this.game.questMgr.onEvent('build', { target: this.selectedId });

    // Special: well gives water bucket
    if (def.isWell) {
      this.game.showDialog('井戸を建てた！近くで水バケツをくめるようになった。');
    }

    return true;
  }

  remove(gx, gz) {
    const key = `${gx},${gz}`;
    const b = this._buildings.get(key);
    if (!b) return false;

    this.scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    if (b.light) this.scene.remove(b.light);

    // Refund 50%
    for (const [item, count] of Object.entries(b.def.cost)) {
      this.game.inventory.add(item, Math.floor(count * 0.5));
    }

    this._buildings.delete(key);
    this._solidCells.delete(key);
    return true;
  }

  isSolid(gx, gz) {
    return this._solidCells.has(`${gx},${gz}`);
  }

  getBuilding(gx, gz) {
    return this._buildings.get(`${gx},${gz}`) || null;
  }

  isWellNearby(gx, gz, range = 3) {
    for (let dz = -range; dz <= range; dz++) {
      for (let dx = -range; dx <= range; dx++) {
        const b = this._buildings.get(`${gx + dx},${gz + dz}`);
        if (b && b.def.isWell) return true;
      }
    }
    return false;
  }

  update(camera, canvas) {
    if (!this.mode || !this._ghost) return;
    this._raycaster.setFromCamera(this._pointer, camera);
    const pt = new THREE.Vector3();
    if (this._raycaster.ray.intersectPlane(this._groundPlane, pt)) {
      const { gx, gz } = this.grid.worldToGrid(pt.x, pt.z);
      if (gx !== this._ghostGx || gz !== this._ghostGz) {
        this._ghostGx = gx;
        this._ghostGz = gz;
        const { wx, wz } = this.grid.gridToWorld(gx, gz);
        const def = BUILDINGS[this.selectedId];
        this._ghost.position.set(wx, 0.075 + def.h / 2, wz);
        const canPlace = this.grid.isWalkable(gx, gz) && !this._buildings.has(`${gx},${gz}`);
        this._ghost.material.color.setHex(canPlace ? 0x88ff88 : 0xff4444);
        this._ghost.material.opacity = canPlace ? 0.5 : 0.4;
      }
    }
  }

  handleClick(gx, gz) {
    if (!this.mode) return false;
    return this.place(gx, gz);
  }

  _createBuildingMesh(def) {
    let geo;
    if (def.isRoof) {
      geo = new THREE.ConeGeometry(0.72, def.h, 4);
    } else {
      geo = new THREE.BoxGeometry(def.w, def.h, def.d);
    }
    const mat = new THREE.MeshLambertMaterial({
      color: def.color,
      emissive: def.emissive || 0x000000,
      emissiveIntensity: def.emissiveIntensity || 0,
    });
    return new THREE.Mesh(geo, mat);
  }

  _updateGhost() {
    if (this._ghost) {
      this.scene.remove(this._ghost);
      this._ghost.geometry.dispose();
    }
    const def = BUILDINGS[this.selectedId];
    if (!def) return;
    const geo = new THREE.BoxGeometry(def.w, def.h, def.d);
    const mat = new THREE.MeshBasicMaterial({ color: 0x88ff88, transparent: true, opacity: 0.5 });
    this._ghost = new THREE.Mesh(geo, mat);
    this.scene.add(this._ghost);
  }

  _onMouseMove(e) {
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _onRightClick(e) {
    e.preventDefault();
    if (this.mode) this.game.buildMenu.exitBuildMode();
  }
}
