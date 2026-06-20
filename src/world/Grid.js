import * as THREE from 'three';
import { TILE, TILE_COLOR, TILE_Y, TILE_WALKABLE } from './TileTypes.js';
import { grassTex, dirtTex, stoneTex, waterTex, tilledTex, dangerGrassTex, mountainTex, sandTex } from './TextureFactory.js';

export const GRID_SIZE = 64;
export const TILE_SIZE = 1;
const TILE_THICKNESS = 0.15;

const TILE_TEX = {};
function getTileTex(type) {
  if (TILE_TEX[type] !== undefined) return TILE_TEX[type];
  switch (Number(type)) {
    case TILE.GRASS:        TILE_TEX[type] = grassTex();       break;
    case TILE.DIRT:         TILE_TEX[type] = dirtTex();        break;
    case TILE.STONE:        TILE_TEX[type] = stoneTex();       break;
    case TILE.WATER:        TILE_TEX[type] = waterTex();       break;
    case TILE.TILLED:       TILE_TEX[type] = tilledTex();      break;
    case TILE.DANGER_GRASS: TILE_TEX[type] = dangerGrassTex(); break;
    case TILE.MOUNTAIN:     TILE_TEX[type] = mountainTex();    break;
    case TILE.SAND:         TILE_TEX[type] = sandTex();        break;
    default:                TILE_TEX[type] = null;
  }
  return TILE_TEX[type];
}

// ── Value noise & fbm ───────────────────────────────────────────────────────

function vhash(a, b, seed) {
  let n = ((a * 1619 + b * 31337 + seed * 6971) | 0);
  n ^= (n >>> 13);
  n = Math.imul(n, Math.imul(n, n) * 15731 + 789221) + 1376312589 | 0;
  return (n >>> 0) / 0x100000000;
}

function vnoise(x, y, seed) {
  const xi = Math.floor(x) | 0, yi = Math.floor(y) | 0;
  const fx = x - Math.floor(x), fy = y - Math.floor(y);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const n00 = vhash(xi, yi, seed),   n10 = vhash(xi+1, yi, seed);
  const n01 = vhash(xi, yi+1, seed), n11 = vhash(xi+1, yi+1, seed);
  return n00*(1-ux)*(1-uy) + n10*ux*(1-uy) + n01*(1-ux)*uy + n11*ux*uy;
}

function fbm(x, y, seed, octaves = 5, persistence = 0.5) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    val += vnoise(x * freq, y * freq, seed + i * 7919) * amp;
    max += amp; amp *= persistence; freq *= 2.0;
  }
  return val / max;
}

export class Grid {
  constructor(scene) {
    this.scene = scene;
    this.data = new Uint8Array(GRID_SIZE * GRID_SIZE);
    this.instancedMeshes = {};
    this._typeCounts = {};
    this._typeInstances = {};

    this._generate();
    this._buildMeshes();
  }

  _generate() {
    const half = GRID_SIZE / 2;   // 32
    const OCEAN_DIST  = 29;        // water border
    const SAND_DIST   = 26;        // sand before ocean
    const VILLAGE_DIST = 8;        // inner village (preserved)

    // ── noise-based height map ──
    const H = new Float32Array(GRID_SIZE * GRID_SIZE);
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const nx = (x - half) / 18, nz = (z - half) / 18;
        H[z * GRID_SIZE + x] = fbm(nx + 0.3, nz + 0.7, 42);
      }
    }

    // ── assign tiles ──
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const idx = z * GRID_SIZE + x;
        const dx = Math.abs(x - half + 0.5);
        const dz = Math.abs(z - half + 0.5);
        const dist = Math.max(dx, dz);
        const h = H[idx];

        let tile;

        if (dist >= OCEAN_DIST) {
          tile = TILE.WATER;
        } else if (dist >= SAND_DIST) {
          tile = TILE.SAND;
        } else if (dist < VILLAGE_DIST) {
          // village center: stone paths + grass + dirt (original)
          const pattern = ((x + z) % 5 === 0) || ((x - z + GRID_SIZE) % 7 === 0);
          if (pattern) tile = TILE.STONE;
          else if (h < 0.38) tile = TILE.DIRT;
          else tile = TILE.GRASS;
        } else {
          // outer world based on height
          if (h < 0.22)       tile = TILE.WATER;
          else if (h < 0.30)  tile = TILE.SAND;
          else if (h < 0.44)  tile = TILE.DIRT;
          else if (h < 0.64)  tile = TILE.GRASS;
          else if (h < 0.76)  tile = TILE.STONE;
          else if (h < 0.86)  tile = TILE.MOUNTAIN;
          else                 tile = TILE.MOUNTAIN;
        }

        this.data[idx] = tile;
      }
    }

    // ── carve river from top-left highlands to bottom ocean ──
    this._carveRiver();

    // ── open village plaza ──
    for (let z = 28; z < 36; z++) {
      for (let x = 28; x < 36; x++) {
        const t = this.data[z * GRID_SIZE + x];
        if (t !== TILE.STONE) this.data[z * GRID_SIZE + x] = TILE.GRASS;
      }
    }
  }

  _carveRiver() {
    // River meanders from upper region down to southern ocean
    // Waypoints in grid coords
    const waypoints = [
      [18, 4], [20, 10], [22, 16], [24, 22],
      [26, 27], [28, 31], [30, 37], [34, 44],
      [40, 50], [46, 58], [52, 63],
    ];

    const rng = mulberry32(99);

    for (let i = 0; i < waypoints.length - 1; i++) {
      let [x, z] = waypoints[i];
      const [ex, ez] = waypoints[i + 1];

      while (x !== ex || z !== ez) {
        const dx = Math.sign(ex - x), dz = Math.sign(ez - z);
        const r = rng();
        if (r < 0.55) {
          if (Math.abs(ex - x) > Math.abs(ez - z)) x += dx; else z += dz;
        } else if (r < 0.80) {
          x += dx; z += dz;
        } else {
          if (rng() < 0.5) x += (rng() < 0.5 ? 1 : -1);
          else z += (rng() < 0.5 ? 1 : -1);
        }

        x = Math.max(1, Math.min(GRID_SIZE - 2, x));
        z = Math.max(1, Math.min(GRID_SIZE - 2, z));

        // Carve 2-tile wide river
        for (let dz2 = -1; dz2 <= 1; dz2++) {
          for (let dx2 = -1; dx2 <= 1; dx2++) {
            const rx = x + dx2, rz = z + dz2;
            if (rx >= 0 && rx < GRID_SIZE && rz >= 0 && rz < GRID_SIZE) {
              const dist = Math.max(Math.abs(rx - 32), Math.abs(rz - 32));
              if (dist > 9) { // don't carve through village center
                this.data[rz * GRID_SIZE + rx] = TILE.WATER;
              }
            }
          }
        }
      }
    }
  }

  _buildMeshes() {
    for (const im of Object.values(this.instancedMeshes)) {
      this.scene.remove(im);
      im.geometry.dispose();
      im.material.dispose();
    }
    this.instancedMeshes = {};
    this._typeCounts = {};
    this._typeInstances = {};

    for (let i = 0; i < this.data.length; i++) {
      const t = this.data[i];
      this._typeCounts[t] = (this._typeCounts[t] || 0) + 1;
    }

    const geo = new THREE.BoxGeometry(TILE_SIZE - 0.02, TILE_THICKNESS, TILE_SIZE - 0.02);

    for (const [type, count] of Object.entries(this._typeCounts)) {
      const tex = getTileTex(type);
      const mat = new THREE.MeshLambertMaterial({
        color: tex ? 0xffffff : TILE_COLOR[type],
        map: tex || null,
      });
      const im = new THREE.InstancedMesh(geo, mat, count);
      im.receiveShadow = true;
      im.userData.tileType = Number(type);
      this.instancedMeshes[type] = im;
      this._typeInstances[type] = new Int32Array(GRID_SIZE * GRID_SIZE).fill(-1);
      this.scene.add(im);
    }

    const dummy = new THREE.Object3D();
    const typeIdx = {};
    for (const type of Object.keys(this._typeCounts)) typeIdx[type] = 0;

    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const idx = z * GRID_SIZE + x;
        const type = String(this.data[idx]);
        const { wx, wz } = this.gridToWorld(x, z);
        const wy = TILE_Y[this.data[idx]] ?? 0;

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

  getGroundY(gx, gz) {
    const t = this.getTile(gx, gz);
    return (TILE_Y[t] ?? 0) + TILE_THICKNESS / 2;
  }

  isWalkable(gx, gz) {
    const t = this.getTile(gx, gz);
    return t !== -1 && (TILE_WALKABLE[t] !== false);
  }

  isDangerZone(gx, gz) {
    const dx = Math.abs(gx - GRID_SIZE / 2);
    const dz = Math.abs(gz - GRID_SIZE / 2);
    return Math.max(dx, dz) >= 16;
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

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let z = Math.imul(seed ^ seed >>> 15, 1 | seed);
    z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
}
