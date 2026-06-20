import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE } from '../world/Grid.js';

const ENEMY_TYPES = {
  slime: {
    name: 'スライム', icon: '🟢', hp: 30, speed: 1.5, damage: 5, level: 1,
    color: 0x44cc44, size: [0.8, 0.6, 1],
    drops: [{ item: 'stone', min: 1, max: 2, chance: 0.8 }],
    xp: 5,
  },
  goblin: {
    name: 'ゴブリン', icon: '👺', hp: 60, speed: 2.2, damage: 12, level: 3,
    color: 0x996633, size: [0.7, 1.1, 1],
    drops: [
      { item: 'wood', min: 1, max: 3, chance: 0.7 },
      { item: 'leather', min: 1, max: 1, chance: 0.5 },
      { item: 'iron', min: 1, max: 1, chance: 0.3 },
    ],
    xp: 12,
  },
  skeleton: {
    name: 'スケルトン', icon: '💀', hp: 80, speed: 1.8, damage: 18, level: 5,
    color: 0xd0ccc0, size: [0.7, 1.2, 1],
    drops: [
      { item: 'iron', min: 1, max: 2, chance: 0.6 },
      { item: 'stone', min: 1, max: 3, chance: 0.8 },
    ],
    xp: 20,
  },
  orc: {
    name: 'オーク', icon: '👹', hp: 120, speed: 1.6, damage: 25, level: 7,
    color: 0x226622, size: [1.0, 1.3, 1],
    drops: [
      { item: 'leather', min: 1, max: 3, chance: 0.7 },
      { item: 'iron', min: 1, max: 2, chance: 0.5 },
      { item: 'gold', min: 10, max: 25, chance: 0.9 },
    ],
    xp: 35,
  },
  dragon: {
    name: 'ドラゴン', icon: '🐉', hp: 300, speed: 2.0, damage: 45, level: 15,
    color: 0xcc2200, size: [1.5, 1.5, 1],
    drops: [
      { item: 'iron', min: 5, max: 10, chance: 1.0 },
      { item: 'gold', min: 80, max: 150, chance: 1.0 },
      { item: 'leather', min: 3, max: 6, chance: 1.0 },
    ],
    xp: 200, isBoss: true,
  },
};

const CHASE_RANGE = 8;
const ATTACK_RANGE = 1.2;
const ATTACK_COOLDOWN = 1.5;
const SPAWN_RADIUS_MIN = 20;
const SPAWN_RADIUS_MAX = 30;
const MAX_ENEMIES = 8;

export class EnemyManager {
  constructor(scene, grid, game) {
    this.scene = scene;
    this.grid = grid;
    this.game = game;
    this.enemies = [];
    this._spawnTimer = 0;
    this._spawnInterval = 8;

    // Initial spawn
    for (let i = 0; i < 4; i++) this._spawnEnemy('slime');
    for (let i = 0; i < 2; i++) this._spawnEnemy('goblin');
  }

  _spawnEnemy(type) {
    const angle = Math.random() * Math.PI * 2;
    const r = SPAWN_RADIUS_MIN + Math.random() * (SPAWN_RADIUS_MAX - SPAWN_RADIUS_MIN);
    const wx = Math.cos(angle) * r;
    const wz = Math.sin(angle) * r;
    const { gx, gz } = this.grid.worldToGrid(wx, wz);

    if (!this.grid.isWalkable(gx, gz)) return;

    const e = new Enemy(this.scene, type, wx, wz, ENEMY_TYPES[type]);
    this.enemies.push(e);
  }

  spawnBoss() {
    // Spawn dragon boss near dungeon entrance (NE of map center)
    const e = new Enemy(this.scene, 'dragon', 15, -12, ENEMY_TYPES.dragon);
    this.enemies.push(e);
    this.game.showDialog('🐉 ドラゴンが現れた！逃げろ！');
  }

  update(delta) {
    if (this.game.battleSys?.active) return; // freeze during turn-based combat

    this._spawnTimer += delta;
    if (this._spawnTimer >= this._spawnInterval && this.enemies.length < MAX_ENEMIES) {
      this._spawnTimer = 0;
      const r = Math.random();
      const type = r < 0.35 ? 'slime' : r < 0.65 ? 'goblin' : r < 0.85 ? 'skeleton' : 'orc';
      this._spawnEnemy(type);
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(delta, this.game.player, this.game);
      if (e.dead) {
        this.scene.remove(e.mesh);
        e.mesh.material.dispose();
        this.enemies.splice(i, 1);
      }
    }
  }
}

class Enemy {
  constructor(scene, type, wx, wz, def) {
    this.type = type;
    this.def = def;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.dead = false;
    this._attackCooldown = 0;
    this._hitFlash = 0;

    this.position = new THREE.Vector3(wx, 1.0, wz);
    this.mesh = this._createSprite(def.color, def.size);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);

    // HP bar as small mesh above enemy
    this._hpBar = this._createHpBar();
    this._hpBar.position.copy(this.position);
    this._hpBar.position.y = 2.0;
    scene.add(this._hpBar);
  }

  _createSprite(color, size) {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');

    const col = `#${color.toString(16).padStart(6, '0')}`;
    if (this.type === 'slime') {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(16, 20, 13, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(11, 17, 3, 0, Math.PI * 2);
      ctx.arc(21, 17, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(12, 16, 1, 0, Math.PI * 2);
      ctx.arc(22, 16, 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Goblin
      ctx.fillStyle = col;
      ctx.fillRect(10, 12, 12, 16);
      ctx.fillStyle = '#cc9944';
      ctx.fillRect(9, 4, 14, 12);
      ctx.fillStyle = '#222';
      ctx.fillRect(11, 8, 3, 3);
      ctx.fillRect(18, 8, 3, 3);
      ctx.fillStyle = col;
      ctx.fillRect(10, 28, 5, 4);
      ctx.fillRect(17, 28, 5, 4);
      // Ears
      ctx.fillStyle = '#cc9944';
      ctx.fillRect(5, 6, 5, 5);
      ctx.fillRect(22, 6, 5, 5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size[0], size[1], size[2]);
    sprite.renderOrder = 2;
    return sprite;
  }

  _createHpBar() {
    const geo = new THREE.PlaneGeometry(0.8, 0.1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff44, side: THREE.DoubleSide });
    return new THREE.Mesh(geo, mat);
  }

  update(delta, player, game) {
    if (this.dead) return;
    if (game.battleSys?.active) return; // freeze during turn-based combat

    this._attackCooldown = Math.max(0, this._attackCooldown - delta);
    this._hitFlash = Math.max(0, this._hitFlash - delta * 4);

    const distToPlayer = this.position.distanceTo(player.position);

    if (distToPlayer < CHASE_RANGE) {
      // Chase player
      const dir = player.position.clone().sub(this.position);
      dir.y = 0;
      dir.normalize().multiplyScalar(this.def.speed * delta);
      this.position.add(dir);

      // Attack
      if (distToPlayer < ATTACK_RANGE && this._attackCooldown <= 0) {
        this._attackCooldown = ATTACK_COOLDOWN;
        player.takeDamage(this.def.damage);
      }
    } else {
      // Wander slightly
      if (Math.random() < 0.01) {
        const angle = Math.random() * Math.PI * 2;
        this.position.x += Math.cos(angle) * 0.3;
        this.position.z += Math.sin(angle) * 0.3;
      }
    }

    const flashCol = this._hitFlash > 0 ? 0xff4444 : (this.type === 'slime' ? 0x44cc44 : 0x996633);
    this.mesh.material.color.setHex(flashCol);

    this.mesh.position.copy(this.position);
    this._hpBar.position.set(this.position.x, this.position.y + 1.2, this.position.z);
    this._hpBar.material.color.setHex(this.hp / this.maxHp > 0.5 ? 0x00ff44 : 0xff6600);
    this._hpBar.scale.x = this.hp / this.maxHp;
    this._hpBar.lookAt(game.camera.position);
  }

  takeDamage(amount, game) {
    this.hp -= amount;
    this._hitFlash = 1;
    if (this.hp <= 0) {
      this.dead = true;
      this._dropLoot(game);
      game.questMgr.onEvent('kill', { target: this.type });
      this._hpBar.geometry.dispose();
      game.scene.remove(this._hpBar);
    }
  }

  _dropLoot(game) {
    const dropped = [];
    for (const drop of this.def.drops) {
      if (Math.random() < drop.chance) {
        const count = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
        game.inventory.add(drop.item, count);
        dropped.push(`${drop.item}×${count}`);
      }
    }
    if (dropped.length > 0) {
      game.showDialog(`${this.def.name}を倒した！\n獲得: ${dropped.join(', ')}`);
    }
    if (this.def.isBoss) {
      game.showDialog('ボスを倒した！英雄になった！');
    }
  }
}
