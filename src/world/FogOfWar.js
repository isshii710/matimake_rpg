import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE } from './Grid.js';

const BUFFER_RADIUS = 16;
const SAFE_RADIUS = 8;

export class FogOfWar {
  constructor(scene, mobile = false) {
    this.scene = scene;
    this.particles = [];
    this._createFogPlane();
    this._createParticles(mobile);
  }

  _createFogPlane() {
    // Semi-transparent red overlay covering the danger zone ring
    const outerSize = GRID_SIZE * TILE_SIZE;
    const innerSize = BUFFER_RADIUS * 2 * TILE_SIZE;

    // We create 4 large rectangles forming a border
    const fogMat = new THREE.MeshBasicMaterial({
      color: 0x330000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });

    const borders = [
      // top strip
      { w: outerSize, d: (GRID_SIZE / 2 - BUFFER_RADIUS) * TILE_SIZE, ox: 0, oz: -(BUFFER_RADIUS + (GRID_SIZE / 2 - BUFFER_RADIUS) / 2) * TILE_SIZE },
      // bottom strip
      { w: outerSize, d: (GRID_SIZE / 2 - BUFFER_RADIUS) * TILE_SIZE, ox: 0, oz: (BUFFER_RADIUS + (GRID_SIZE / 2 - BUFFER_RADIUS) / 2) * TILE_SIZE },
      // left strip
      { w: (GRID_SIZE / 2 - BUFFER_RADIUS) * TILE_SIZE, d: innerSize, ox: -(BUFFER_RADIUS + (GRID_SIZE / 2 - BUFFER_RADIUS) / 2) * TILE_SIZE, oz: 0 },
      // right strip
      { w: (GRID_SIZE / 2 - BUFFER_RADIUS) * TILE_SIZE, d: innerSize, ox: (BUFFER_RADIUS + (GRID_SIZE / 2 - BUFFER_RADIUS) / 2) * TILE_SIZE, oz: 0 },
    ];

    this.fogPlanes = [];
    for (const b of borders) {
      const geo = new THREE.PlaneGeometry(b.w, b.d);
      const mesh = new THREE.Mesh(geo, fogMat.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(b.ox, 0.3, b.oz);
      mesh.renderOrder = 1;
      this.scene.add(mesh);
      this.fogPlanes.push(mesh);
    }
  }

  _createParticles(mobile = false) {
    const count = mobile ? 20 : 80;
    const geo = new THREE.SphereGeometry(0.3, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x440000,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });

    const half = GRID_SIZE / 2;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat.clone());
      const angle = Math.random() * Math.PI * 2;
      const r = (BUFFER_RADIUS + Math.random() * (half - BUFFER_RADIUS - 1)) * TILE_SIZE;
      mesh.position.set(
        Math.cos(angle) * r,
        0.5 + Math.random() * 1.5,
        Math.sin(angle) * r,
      );
      mesh.userData.speed = 0.3 + Math.random() * 0.5;
      mesh.userData.phase = Math.random() * Math.PI * 2;
      this.scene.add(mesh);
      this.particles.push(mesh);
    }
  }

  update(time) {
    for (const p of this.particles) {
      p.position.y = 0.5 + Math.sin(time * p.userData.speed + p.userData.phase) * 0.6;
      p.material.opacity = 0.08 + Math.abs(Math.sin(time * 0.4 + p.userData.phase)) * 0.12;
    }
  }
}
