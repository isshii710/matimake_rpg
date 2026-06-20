import * as THREE from 'three';
import { TILE } from './TileTypes.js';
import { GRID_SIZE } from './Grid.js';

const TREE_MAX_HP = 3;
const ROCK_MAX_HP = 4;

// Shared geometries (created once)
let _trunkGeo, _foliageGeos, _rockGeoA, _rockGeoB;
function getTreeGeos() {
  if (!_trunkGeo) {
    _trunkGeo = new THREE.CylinderGeometry(0.10, 0.15, 0.95, 6);
    _foliageGeos = [
      new THREE.ConeGeometry(0.52, 0.70, 6),
      new THREE.ConeGeometry(0.42, 0.65, 6),
      new THREE.ConeGeometry(0.30, 0.55, 6),
    ];
  }
  return { trunkGeo: _trunkGeo, foliageGeos: _foliageGeos };
}
function getRockGeos() {
  if (!_rockGeoA) {
    _rockGeoA = new THREE.OctahedronGeometry(0.32, 0);
    _rockGeoB = new THREE.OctahedronGeometry(0.20, 0);
  }
  return { rockGeoA: _rockGeoA, rockGeoB: _rockGeoB };
}

// Shared materials
const TRUNK_MAT  = new THREE.MeshLambertMaterial({ color: 0x5a3010 });
const LEAF_MAT   = new THREE.MeshLambertMaterial({ color: 0x2d8a28 });
const ROCK_MAT   = new THREE.MeshLambertMaterial({ color: 0x72706a });
const MOUNT_MAT  = new THREE.MeshLambertMaterial({ color: 0x5a5550 });

export class ResourceManager {
  constructor(scene, grid, game) {
    this.scene = scene;
    this.grid = grid;
    this.game = game;
    this._resources = new Map(); // `${gx},${gz}` -> { type, hp, maxHp, mesh }
    this._generated = false;
  }

  // ── Generation ─────────────────────────────────────────────────────────────

  generate() {
    if (this._generated) return;
    this._generated = true;
    this._placeAll();
  }

  _placeAll() {
    const half = GRID_SIZE / 2;
    const rng = mulberry32(2025);

    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const dx = Math.abs(x - half + 0.5);
        const dz = Math.abs(z - half + 0.5);
        const dist = Math.max(dx, dz);
        if (dist < 10) continue; // keep village area clear

        const tile = this.grid.getTile(x, z);
        const r = rng();

        if ((tile === TILE.GRASS || tile === TILE.DIRT || tile === TILE.DANGER_GRASS) && r < 0.18) {
          this._addTree(x, z, TREE_MAX_HP);
        } else if (tile === TILE.STONE && r < 0.28) {
          this._addRock(x, z, ROCK_MAX_HP);
        } else if (tile === TILE.MOUNTAIN && r < 0.45) {
          this._addBoulder(x, z, ROCK_MAX_HP);
        }
      }
    }
  }

  _addTree(gx, gz, hp) {
    const groundY = this.grid.getGroundY(gx, gz);
    const { wx, wz } = this.grid.gridToWorld(gx, gz);
    const { trunkGeo, foliageGeos } = getTreeGeos();

    const group = new THREE.Group();

    const trunk = new THREE.Mesh(trunkGeo, TRUNK_MAT);
    trunk.position.y = groundY + 0.48;
    group.add(trunk);

    // 3-layer foliage (layered cones)
    const heights = [0.95 + groundY, 1.35 + groundY, 1.70 + groundY];
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(foliageGeos[i], LEAF_MAT);
      cone.position.y = heights[i];
      group.add(cone);
    }

    group.position.set(wx, 0, wz);
    group.rotation.y = vhash(gx, gz, 7) * Math.PI * 2;
    this.scene.add(group);

    const key = `${gx},${gz}`;
    this._resources.set(key, { type: 'tree', hp, maxHp: TREE_MAX_HP, mesh: group, gx, gz });
  }

  _addRock(gx, gz, hp) {
    const groundY = this.grid.getGroundY(gx, gz);
    const { wx, wz } = this.grid.gridToWorld(gx, gz);
    const { rockGeoA, rockGeoB } = getRockGeos();

    const group = new THREE.Group();
    const r = vhash(gx, gz, 3);

    const main = new THREE.Mesh(rockGeoA, ROCK_MAT);
    main.position.set(0, groundY + 0.30, 0);
    main.scale.set(0.9 + r * 0.3, 0.65 + r * 0.2, 0.85 + r * 0.25);
    main.rotation.y = r * Math.PI;
    group.add(main);

    const small = new THREE.Mesh(rockGeoB, ROCK_MAT);
    small.position.set(0.22 - r * 0.1, groundY + 0.18, 0.1 - r * 0.15);
    small.rotation.y = r * 2;
    group.add(small);

    group.position.set(wx, 0, wz);
    this.scene.add(group);

    const key = `${gx},${gz}`;
    this._resources.set(key, { type: 'rock', hp, maxHp: ROCK_MAX_HP, mesh: group, gx, gz });
  }

  _addBoulder(gx, gz, hp) {
    const groundY = this.grid.getGroundY(gx, gz);
    const { wx, wz } = this.grid.gridToWorld(gx, gz);

    const geo = new THREE.OctahedronGeometry(0.42, 0);
    const mesh = new THREE.Mesh(geo, MOUNT_MAT);
    const r = vhash(gx, gz, 5);
    mesh.position.set(wx, groundY + 0.38, wz);
    mesh.scale.set(0.9 + r * 0.3, 0.55 + r * 0.2, 0.85 + r * 0.3);
    mesh.rotation.y = r * Math.PI;
    this.scene.add(mesh);

    const key = `${gx},${gz}`;
    // boulders wrap in a group-like structure for uniform hit handling
    const group = new THREE.Group();
    group.add(mesh);
    group.position.set(0, 0, 0);
    this.scene.add(group); // group at origin; mesh has world pos

    // Actually simpler: just store the mesh directly
    this.scene.remove(group); // cleanup the empty group
    const fakeGroup = { children: [mesh], isGroup: false };
    this._resources.set(key, { type: 'boulder', hp, maxHp: ROCK_MAX_HP, mesh: fakeGroup, gx, gz, _mesh: mesh });
  }

  // ── Hit ────────────────────────────────────────────────────────────────────

  hit(gx, gz, toolType) {
    const r = this._resources.get(`${gx},${gz}`);
    if (!r) return false;

    const needsAxe = r.type === 'tree';
    const needsPick = r.type === 'rock' || r.type === 'boulder';

    if (needsAxe && toolType !== 'axe') {
      this.game.showDialog('木を切るには斧が必要！');
      return false;
    }
    if (needsPick && toolType !== 'pickaxe') {
      this.game.showDialog('岩を砕くにはつるはしが必要！');
      return false;
    }

    r.hp--;
    this._flashHit(r);

    if (r.hp <= 0) {
      this._removeResource(gx, gz, r);
      return true;
    }

    const remaining = r.hp;
    if (r.type === 'tree') this.game.showDialog(`🌲 木を攻撃！あと${remaining}回`);
    else this.game.showDialog(`🪨 岩を攻撃！あと${remaining}回`);
    return false;
  }

  _flashHit(r) {
    const meshes = r._mesh ? [r._mesh] : (r.mesh.children || []);
    for (const m of meshes) {
      if (!m.material) continue;
      const orig = m.material.color.getHex();
      m.material = m.material.clone();
      m.material.color.setHex(0xffffff);
      setTimeout(() => { m.material.color.setHex(orig); }, 80);
    }
  }

  _removeResource(gx, gz, r) {
    // Remove from scene
    const meshes = r._mesh ? [r._mesh] : (r.mesh.children || []);
    for (const m of meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    if (r.mesh.isGroup !== false) this.scene.remove(r.mesh);
    this._resources.delete(`${gx},${gz}`);

    // Give drops
    const woodDrop = 2 + Math.floor(vhash(gx, gz, 99) * 3);
    const stoneDrop = 1 + Math.floor(vhash(gx, gz, 77) * 2);

    if (r.type === 'tree') {
      this.game.inventory.add('wood', woodDrop);
      this.game.showDialog(`🌲 木を切り倒した！木材×${woodDrop}獲得`);
    } else {
      this.game.inventory.add('stone', stoneDrop);
      this.game.showDialog(`🪨 岩を砕いた！石材×${stoneDrop}獲得`);
    }
    this.game.questMgr?.onEvent('gather', { target: r.type });
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  isSolid(gx, gz) {
    return this._resources.has(`${gx},${gz}`);
  }

  getResource(gx, gz) {
    return this._resources.get(`${gx},${gz}`) || null;
  }

  // ── Save / Load ────────────────────────────────────────────────────────────

  serialize() {
    const list = [];
    for (const r of this._resources.values()) {
      list.push({ gx: r.gx, gz: r.gz, type: r.type, hp: r.hp });
    }
    return list;
  }

  loadFromSave(data) {
    if (this._generated) return;
    this._generated = true;
    for (const r of data) {
      if (r.type === 'tree')    this._addTree(r.gx, r.gz, r.hp);
      else if (r.type === 'rock')    this._addRock(r.gx, r.gz, r.hp);
      else if (r.type === 'boulder') this._addBoulder(r.gx, r.gz, r.hp);
    }
  }

  update(_delta) {
    // Future: animate water ripples on river, sway trees, etc.
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function vhash(a, b, seed) {
  let n = ((a * 1619 + b * 31337 + seed * 6971) | 0);
  n ^= (n >>> 13);
  n = Math.imul(n, Math.imul(n, n) * 15731 + 789221) + 1376312589 | 0;
  return (n >>> 0) / 0x100000000;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let z = Math.imul(seed ^ seed >>> 15, 1 | seed);
    z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
}
