import * as THREE from 'three';
import { TILE } from '../world/TileTypes.js';

const PLAYER_SPEED = 4.0;
const ATTACK_RANGE = 1.8;
const ATTACK_COOLDOWN = 0.5;
const ATTACK_DAMAGE = 20;

export class Player {
  constructor(scene, grid, game) {
    this.scene = scene;
    this.grid = grid;
    this.game = game;

    this.position = new THREE.Vector3(0.5, 1.0, 0.5);
    this.hp = 100;
    this.maxHp = 100;
    this.stamina = 100;
    this.maxStamina = 100;
    this._attackCooldown = 0;
    this._attackFlash = 0;
    this._inDanger = false;
    this._facingDir = new THREE.Vector3(0, 0, -1);

    this.mesh = this._createSprite();
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);

    this.attackIndicator = this._createAttackIndicator();
    this.scene.add(this.attackIndicator);
  }

  _createSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 56;
    const ctx = canvas.getContext('2d');

    // Hair
    ctx.fillStyle = '#7733bb';
    ctx.fillRect(6, 2, 20, 10);
    ctx.fillRect(4, 6, 24, 6);

    // Face
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(8, 8, 16, 16);

    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(11, 13, 3, 3);
    ctx.fillRect(18, 13, 3, 3);
    // Highlights
    ctx.fillStyle = '#fff';
    ctx.fillRect(12, 13, 1, 1);
    ctx.fillRect(19, 13, 1, 1);

    // Body
    ctx.fillStyle = '#3366cc';
    ctx.fillRect(9, 24, 14, 18);
    // Belt
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(9, 36, 14, 4);

    // Arms
    ctx.fillStyle = '#3366cc';
    ctx.fillRect(4, 24, 5, 14);
    ctx.fillRect(23, 24, 5, 14);
    // Hands
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(4, 38, 5, 4);
    ctx.fillRect(23, 38, 5, 4);

    // Legs
    ctx.fillStyle = '#2244aa';
    ctx.fillRect(9, 42, 6, 12);
    ctx.fillRect(17, 42, 6, 12);
    // Feet
    ctx.fillStyle = '#333';
    ctx.fillRect(8, 52, 8, 4);
    ctx.fillRect(16, 52, 8, 4);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.9, 1.575, 1);
    sprite.renderOrder = 2;
    return sprite;
  }

  _createAttackIndicator() {
    const geo = new THREE.RingGeometry(0.5, 0.65, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffaa00, transparent: true, opacity: 0, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2;
    return ring;
  }

  update(delta, keys, dpad) {
    this._move(delta, keys, dpad);
    this._updateAttack(delta, keys, dpad);
    this._updateStamina(delta);
    this._updateDangerState();
    this._attackFlash = Math.max(0, this._attackFlash - delta * 3);
    this.attackIndicator.material.opacity = this._attackFlash * 0.6;
    this.attackIndicator.position.copy(this.position);
    this.attackIndicator.position.y = 0.1;
    this.mesh.position.copy(this.position);
  }

  _move(delta, keys, dpad) {
    let dx = 0, dz = 0;

    if (keys['KeyW'] || keys['ArrowUp'] || dpad?.up) { dx -= 1; dz -= 1; }
    if (keys['KeyS'] || keys['ArrowDown'] || dpad?.down) { dx += 1; dz += 1; }
    if (keys['KeyA'] || keys['ArrowLeft'] || dpad?.left) { dx -= 1; dz += 1; }
    if (keys['KeyD'] || keys['ArrowRight'] || dpad?.right) { dx += 1; dz -= 1; }

    if (dx !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dz * dz);
      dx = (dx / len) * PLAYER_SPEED * delta;
      dz = (dz / len) * PLAYER_SPEED * delta;

      this._facingDir.set(dx, 0, dz).normalize();

      const nx = this.position.x + dx;
      const nz = this.position.z + dz;
      const { gx, gz } = this.grid.worldToGrid(nx, nz);

      if (this.grid.isWalkable(gx, gz) && !this.game.buildSys.isSolid(gx, gz)) {
        this.position.x = nx;
        this.position.z = nz;
      }
    }
  }

  _updateAttack(delta, keys, dpad) {
    this._attackCooldown = Math.max(0, this._attackCooldown - delta);
    if ((keys['Space'] || dpad?.attack) && this._attackCooldown <= 0) {
      this._attackCooldown = ATTACK_COOLDOWN;
      this._attackFlash = 1;
      this._doAttack();
    }
  }

  _doAttack() {
    for (const enemy of this.game.enemyMgr.enemies) {
      const dist = this.position.distanceTo(enemy.position);
      if (dist <= ATTACK_RANGE) {
        enemy.takeDamage(ATTACK_DAMAGE, this.game);
      }
    }
  }

  _updateStamina(delta) {
    // Stamina recovers over time
    this.stamina = Math.min(this.maxStamina, this.stamina + 5 * delta);
  }

  _updateDangerState() {
    const { gx, gz } = this.grid.worldToGrid(this.position.x, this.position.z);
    const wasInDanger = this._inDanger;
    this._inDanger = this.grid.isDangerZone(gx, gz);
    if (this._inDanger && !wasInDanger) {
      this.game.questMgr.onEvent('enter_danger', {});
    }
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      // Respawn
      this.hp = this.maxHp / 2;
      this.position.set(0.5, 1.0, 0.5);
      this.game.showDialog('力尽きた...村に戻ってきた。');
    }
  }

  get gx() { return this.grid.worldToGrid(this.position.x, this.position.z).gx; }
  get gz() { return this.grid.worldToGrid(this.position.x, this.position.z).gz; }
}
