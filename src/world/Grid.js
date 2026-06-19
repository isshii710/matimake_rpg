import * as THREE from 'three';
import { TILE, TILE_COLOR, TILE_Y, TILE_WALKABLE } from './TileTypes.js';

export const GRID_SIZE = 64;
export const TILE_SIZE = 1;
const TILE_THICKNESS = 0.15;
const SAFE_RADIUS = 8;     // inner village
const BUFFER_RADIUS = 16;  // edge of well-lit zone

export class Grid {
  constructor(scene) {
    this.scene = scene;
    this.data = new Uint8Array(GRID_SIZE * GRID_SIZE);
    this.instancedMeshes = {};
    this._typeCounts = {};
    this._typeInstances = {}; // maps tile index -> instance index per type

    this._generate();
    this._buildMeshes();
  }

  _generate() {
    const half = GRID_SIZE / 2;
    const rng = mulberry32(42);

    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const dx = Math.abs(x - half + 0.5);
        const dz = Math.abs(z - half + 0.5);
        const dist = Math.max(dx, dz);
        let tile;

        if (dist < SAFE_RADIUS) {
          // Village center: stone paths + dirt patches
          const pattern = ((x + z) % 5 === 0) || ((x - z + GRID_SIZE) % 7 === 0);
          if (pattern) tile = TILE.STONE;
          else if (rng() < 0.25) tile = TILE.DIRT;
          else tile = TILE.GRASS;
        } else if (dist < BUFFER_RADIUS) {
          // Buffer zone
          if (rng() < 0.08) tile = TILE.DIRT;
          else tile = TILE.GRASS;
        } else {
          // Danger zone
          if (rng() < 0.04) tile = TILE.WATER;
          else tile = TILE.DANGER_GRASS;
        }

        this.data[z * GRID_SIZE + x] = tile;
      }
    }

    // Carve a central open area
    for (let z = 28; z < 36; z++) {
      for (let x = 28; x < 36; x++) {
        if (this.data[z * GRID_SIZE + x] === TILE.STONE) continue;
        this.data[z * GRID_SIZE + x] = TILE.GRASS;
      }
    }
  }

  _buildMeshes() {
    // Remove existing instanced meshes
    for (const im of Object.values(this.instancedMeshes)) {
      this.scene.remove(im);
      im.geometry.dispose();
      im.material.dispose();
    }
    this.instancedMeshes = {};
    this._typeCounts = {};
    this._typeInstances = {};

    // Count tiles per type
    for (let i = 0; i < this.data.length; i++) {
      const t = this.data[i];
      this._typeCounts[t] = (this._typeCounts[t] || 0) + 1;
    }

    const geo = new THREE.BoxGeometry(TILE_SIZE - 0.02, TILE_THICKNESS, TILE_SIZE - 0.02);

    for (const [type, count] of Object.entries(this._typeCounts)) {
      const mat = new THREE.MeshLambertMaterial({ color: TILE_COLOR[type] });
      const im = new THREE.InstancedMesh(geo, mat, count);
      im.receiveShadow = true;
      im.userData.tileType = Number(type);
      this.instancedMeshes[type] = im;
      this._typeInstances[type] = new Int32Array(GRID_SIZE * GRID_SIZE).fill(-1);
      this.scene.add(im);
    }

    // Set instance matrices
    const dummy = new THREE.Object3D();
    const typeIdx = {};
    for (const type of Object.keys(this._typeCounts)) typeIdx[type] = 0;

    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const idx = z * GRID_SIZE + x;
        const type = String(this.data[idx]);
        const { wx, wz } = this.gridToWorld(x, z);
        const wy = TILE_Y[this.data[idx]] || 0;

        dummy.position.set(wx, wy, wz);
        dummy.updateMatrix();

        const instanceIndex = typeIdx[type]++;
        this.instancedMeshes[type].setMatrixAt(instanceIndex, dummy.matrix);
        this._typeInstances[type][idx] = instanceIndex;
      }
    }

    for (const im of Object.values(this.instancedMeshes)) {
      im.instanceMatrix.needsUpdate = true;
    }
  }

  setTile(gx, gz, tileType) {
    if (!this._inBounds(gx, gz)) return;
    this.data[gz * GRID_SIZE + gx] = tileType;
    this._buildMeshes();
  }

  getTile(gx, gz) {
    if (!this._inBounds(gx, gz)) return -1;
    return this.data[gz * GRID_SIZE + gx];
  }

  isWalkable(gx, gz) {
    const t = this.getTile(gx, gz);
    return t !== -1 && (TILE_WALKABLE[t] !== false);
  }

  isDangerZone(gx, gz) {
    const dx = Math.abs(gx - GRID_SIZE / 2);
    const dz = Math.abs(gz - GRID_SIZE / 2);
    return Math.max(dx, dz) >= BUFFER_RADIUS;
  }

  gridToWorld(gx, gz) {
    return {
      wx: (gx - GRID_SIZE / 2 + 0.5) * TILE_SIZE,
      wz: (gz - GRID_SIZE / 2 + 0.5) * TILE_SIZE,
    };
  }

  worldToGrid(wx, wz) {
    return {
      gx: Math.floor(wx / TILE_SIZE + GRID_SIZE / 2),
      gz: Math.floor(wz / TILE_SIZE + GRID_SIZE / 2),
    };
  }

  _inBounds(gx, gz) {
    return gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE;
  }

  getInstancedMeshes() {
    return Object.values(this.instancedMeshes);
  }
}

// Fast deterministic RNG
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let z = Math.imul(seed ^ seed >>> 15, 1 | seed);
    z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
}
