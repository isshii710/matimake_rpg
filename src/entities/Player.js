import * as THREE from 'three';
import { ITEMS } from '../data/Items.js';

const PLAYER_SPEED = 4.0;
const ATTACK_RANGE = 1.8;
const ATTACK_COOLDOWN = 0.5;
const ATTACK_DAMAGE = 20;
const TOOL_REACH = 2; // tiles in front

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

    // Animation state
    this._walkTimer  = 0;
    this._walkPhase  = 0;   // 0.0 – 1.0
    this._isMoving   = false;
    this._isAttacking = false;
    this._attackAnim  = 0;   // 0-1 countdown

    this.mesh = this._createSprite();
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);

    this.attackIndicator = this._createAttackIndicator();
    this.scene.add(this.attackIndicator);
  }

  // ── Sprite / Animation ───────────────────────────────────────────────────

  _createSprite() {
    this._animCanvas = document.createElement('canvas');
    this._animCanvas.width = 32;
    this._animCanvas.height = 56;
    this._animCtx = this._animCanvas.getContext('2d');

    this._drawFrame(0, false, null);

    this._animTex = new THREE.CanvasTexture(this._animCanvas);
    const mat = new THREE.SpriteMaterial({ map: this._animTex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.9, 1.575, 1);
    sprite.renderOrder = 2;
    return sprite;
  }

  _drawFrame(walkPhase, isAttacking, toolId) {
    const ctx = this._animCtx;
    const W = 32, H = 56;
    ctx.clearRect(0, 0, W, H);

    // Walk cycle: sin wave for leg swing
    const swing = Math.sin(walkPhase * Math.PI * 2);
    const legL  = Math.round(swing * 3);          // -3 to +3
    const legR  = Math.round(-swing * 3);
    const bob   = Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 1;

    // Attack: arms raised & swung
    const armY  = isAttacking ? -6 : 0;
    const armSwing = isAttacking ? 8 : 0; // right arm swings forward

    // Tool icon offset (right hand holds tool)
    const bodyY = Math.round(bob);

    // ── Hair ──
    ctx.fillStyle = '#7733bb';
    ctx.fillRect(6, 2 + bodyY, 20, 10);
    ctx.fillRect(4, 6 + bodyY, 24, 6);

    // ── Face ──
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(8, 8 + bodyY, 16, 16);

    // ── Eyes ──
    ctx.fillStyle = '#222';
    ctx.fillRect(11, 13 + bodyY, 3, 3);
    ctx.fillRect(18, 13 + bodyY, 3, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(12, 13 + bodyY, 1, 1);
    ctx.fillRect(19, 13 + bodyY, 1, 1);

    // Smile (idle) / determined (attacking)
    if (!isAttacking) {
      ctx.fillStyle = '#a06030';
      ctx.fillRect(12, 21 + bodyY, 8, 1);
    } else {
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(12, 22 + bodyY, 8, 2);
    }

    // ── Body ──
    ctx.fillStyle = '#3366cc';
    ctx.fillRect(9, 24 + bodyY, 14, 18);
    // Belt
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(9, 36 + bodyY, 14, 3);

    // ── Arms (left static, right animated for attack) ──
    ctx.fillStyle = '#3366cc';
    // Left arm
    ctx.fillRect(4, 24 + bodyY + armY, 5, 14);
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(4, 38 + bodyY + armY, 5, 4);
    // Right arm (swings during attack / holds tool)
    ctx.fillStyle = '#3366cc';
    ctx.fillRect(23, 24 + bodyY + armY - armSwing, 5, 14);
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(23, 38 + bodyY + armY - armSwing, 5, 4);

    // Tool icon in right hand
    if (toolId) {
      const icon = ITEMS[toolId]?.icon || '';
      if (icon) {
        ctx.font = '9px sans-serif';
        ctx.fillText(icon, 26, 38 + bodyY + armY - armSwing);
      }
    }

    // ── Legs ──
    ctx.fillStyle = '#2244aa';
    // Left leg
    ctx.fillRect(9, 42 + bodyY - legL, 6, 12 + legL);
    // Right leg
    ctx.fillRect(17, 42 + bodyY - legR, 6, 12 + legR);

    // ── Feet ──
    ctx.fillStyle = '#333';
    ctx.fillRect(8,  52 + bodyY - legL, 7, 3);
    ctx.fillRect(16, 52 + bodyY - legR, 7, 3);

    this._animTex.needsUpdate = true;
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

  // ── Update ───────────────────────────────────────────────────────────────

  update(delta, keys, dpad) {
    this._move(delta, keys, dpad);
    this._updateAttack(delta, keys, dpad);
    this._updateAnim(delta);
    this._updateStamina(delta);
    this._updateDangerState();

    this._attackFlash = Math.max(0, this._attackFlash - delta * 3);
    this.attackIndicator.material.opacity = this._attackFlash * 0.6;
    this.attackIndicator.position.copy(this.position);
    this.attackIndicator.position.y = 0.1;
    this.mesh.position.copy(this.position);
  }

  _updateAnim(delta) {
    if (this._isAttacking) {
      this._attackAnim = Math.max(0, this._attackAnim - delta * 4);
      if (this._attackAnim <= 0) this._isAttacking = false;
    }

    const toolId = this.game.inventory?._selectedToolId || null;

    if (this._isMoving) {
      this._walkTimer += delta;
      this._walkPhase = (this._walkPhase + delta * 3.5) % 1;
      this._drawFrame(this._walkPhase, this._isAttacking, toolId);
    } else if (this._isAttacking) {
      this._drawFrame(0, true, toolId);
    } else {
      // Idle: subtle breathing
      this._walkTimer += delta;
      const breathe = Math.sin(this._walkTimer * 1.2) * 0.15;
      this._drawFrame(breathe, false, toolId);
    }
  }

  _move(delta, keys, dpad) {
    let dx = 0, dz = 0;

    if (keys['KeyW'] || keys['ArrowUp']    || dpad?.up)    { dx -= 1; dz -= 1; }
    if (keys['KeyS'] || keys['ArrowDown']  || dpad?.down)  { dx += 1; dz += 1; }
    if (keys['KeyA'] || keys['ArrowLeft']  || dpad?.left)  { dx -= 1; dz += 1; }
    if (keys['KeyD'] || keys['ArrowRight'] || dpad?.right) { dx += 1; dz -= 1; }

    if (dx !== 0 || dz !== 0) {
      this._isMoving = true;
      const len = Math.sqrt(dx * dx + dz * dz);
      dx = (dx / len) * PLAYER_SPEED * delta;
      dz = (dz / len) * PLAYER_SPEED * delta;

      this._facingDir.set(dx, 0, dz).normalize();

      const nx = this.position.x + dx;
      const nz = this.position.z + dz;
      const { gx, gz } = this.grid.worldToGrid(nx, nz);

      const walkable = this.grid.isWalkable(gx, gz)
        && !this.game.buildSys.isSolid(gx, gz)
        && !this.game.resMgr?.isSolid(gx, gz);

      if (walkable) {
        this.position.x = nx;
        this.position.z = nz;
      }
    } else {
      this._isMoving = false;
    }
  }

  _updateAttack(delta, keys, dpad) {
    this._attackCooldown = Math.max(0, this._attackCooldown - delta);
    if ((keys['Space'] || dpad?.attack) && this._attackCooldown <= 0) {
      this._attackCooldown = ATTACK_COOLDOWN;
      this._attackFlash = 1;
      this._isAttacking = true;
      this._attackAnim  = 1;
      this._doAttack();
    }
  }

  _doAttack() {
    const toolId   = this.game.inventory?._selectedToolId;
    const toolDef  = toolId ? ITEMS[toolId] : null;

    if (toolDef?.isTool) {
      // Try to hit a resource in facing direction
      const { gx: pgx, gz: pgz } = this.grid.worldToGrid(this.position.x, this.position.z);
      const fd = this._facingDir;
      for (let dist = 1; dist <= TOOL_REACH; dist++) {
        const tx = pgx + Math.round(fd.x) * dist;
        const tz = pgz + Math.round(fd.z) * dist;
        if (this.game.resMgr?.hit(tx, tz, toolDef.toolType)) return;
        if (this.game.resMgr?.getResource(tx, tz)) return; // found but wrong tool (already warned)
      }
      this.game.showDialog('資源が見当たらない...');
      return;
    }

    // Normal combat attack
    for (const enemy of this.game.enemyMgr.enemies) {
      const dist = this.position.distanceTo(enemy.position);
      if (dist <= ATTACK_RANGE) {
        enemy.takeDamage(ATTACK_DAMAGE, this.game);
      }
    }
  }

  _updateStamina(delta) {
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
      this.hp = this.maxHp / 2;
      this.position.set(0.5, 1.0, 0.5);
      this.game.showDialog('力尽きた...村に戻ってきた。');
    }
  }

  get gx() { return this.grid.worldToGrid(this.position.x, this.position.z).gx; }
  get gz() { return this.grid.worldToGrid(this.position.x, this.position.z).gz; }
}
