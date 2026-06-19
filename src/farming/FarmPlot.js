import * as THREE from 'three';
import { TILE } from '../world/TileTypes.js';
import { CROPS } from './Crops.js';

export class FarmManager {
  constructor(scene, grid, game) {
    this.scene = scene;
    this.grid = grid;
    this.game = game;
    this.plots = new Map(); // key: `${gx},${gz}` -> plot data
    this._meshes = new Map(); // key -> THREE.Mesh
  }

  till(gx, gz) {
    const tile = this.grid.getTile(gx, gz);
    if (tile !== TILE.GRASS && tile !== TILE.DIRT) return false;
    if (this.plots.has(`${gx},${gz}`)) return false;

    this.grid.setTile(gx, gz, TILE.TILLED);
    this.plots.set(`${gx},${gz}`, {
      gx, gz,
      state: 'empty', // empty | planted | watered | growing | ready
      cropId: null,
      growthStage: 0,
      growthTimer: 0,
      watered: false,
    });
    this.game.questMgr.onEvent('till', {});
    return true;
  }

  plant(gx, gz, cropId) {
    const key = `${gx},${gz}`;
    const plot = this.plots.get(key);
    if (!plot || plot.state !== 'empty') return false;
    if (!CROPS[cropId]) return false;

    const seedItem = CROPS[cropId].seedItem;
    if (!this.game.inventory.has(seedItem, 1)) {
      this.game.showDialog(`${seedItem}が足りない！`);
      return false;
    }

    this.game.inventory.remove(seedItem, 1);
    plot.cropId = cropId;
    plot.state = 'planted';
    plot.growthStage = 0;
    plot.growthTimer = 0;
    this._updateCropMesh(key, plot);
    return true;
  }

  water(gx, gz) {
    const key = `${gx},${gz}`;
    const plot = this.plots.get(key);
    if (!plot || plot.state === 'empty' || plot.state === 'ready') return false;
    if (!this.game.inventory.has('water_bucket', 1)) {
      this.game.showDialog('水バケツが必要です！');
      return false;
    }
    this.game.inventory.remove('water_bucket', 1);
    plot.watered = true;
    plot.state = 'growing';
    this._updateCropMesh(key, plot);
    return true;
  }

  harvest(gx, gz) {
    const key = `${gx},${gz}`;
    const plot = this.plots.get(key);
    if (!plot || plot.state !== 'ready') return false;

    const crop = CROPS[plot.cropId];
    const count = crop.harvestCount[0] + Math.floor(Math.random() * (crop.harvestCount[1] - crop.harvestCount[0] + 1));
    this.game.inventory.add(crop.harvestItem, count);
    this.game.questMgr.onEvent('harvest', { target: plot.cropId, count });
    this.game.showDialog(`${crop.name}を${count}個収穫した！`);

    plot.state = 'empty';
    plot.cropId = null;
    plot.growthStage = 0;
    plot.watered = false;
    this._removeCropMesh(key);
    return true;
  }

  update(delta) {
    for (const [key, plot] of this.plots) {
      if (plot.state !== 'growing') continue;

      plot.growthTimer += delta;
      const crop = CROPS[plot.cropId];
      if (!crop) continue;

      if (plot.growthTimer >= crop.growthTime) {
        plot.growthTimer = 0;
        plot.growthStage++;
        if (plot.growthStage >= crop.stages) {
          plot.growthStage = crop.stages - 1;
          plot.state = 'ready';
        }
        this._updateCropMesh(key, plot);
      }
    }
  }

  getPlot(gx, gz) {
    return this.plots.get(`${gx},${gz}`) || null;
  }

  _updateCropMesh(key, plot) {
    this._removeCropMesh(key);
    if (plot.state === 'empty') return;

    const crop = CROPS[plot.cropId];
    if (!crop) return;

    const stage = plot.growthStage;
    const h = crop.stageHeights[stage];
    const color = crop.stageColors[stage];

    const geo = new THREE.CylinderGeometry(0.1, 0.15, h, 6);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);

    const { wx, wz } = this.grid.gridToWorld(plot.gx, plot.gz);
    mesh.position.set(wx, 0.075 + h / 2, wz);

    // Ready indicator: glow ring
    if (plot.state === 'ready') {
      const ringGeo = new THREE.TorusGeometry(0.3, 0.05, 4, 8);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = h + 0.1;
      mesh.add(ring);
    }

    this.scene.add(mesh);
    this._meshes.set(key, mesh);
  }

  _removeCropMesh(key) {
    const old = this._meshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.geometry.dispose();
      this._meshes.delete(key);
    }
  }
}
