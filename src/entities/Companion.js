import * as THREE from 'three';

const FOLLOW_SPEED = 5.5;
const FOLLOW_OFFSET = [
  new THREE.Vector3(-0.9, 0, 0.6),
  new THREE.Vector3(-1.4, 0, -0.2),
];

export class Companion {
  constructor(scene, id, name, icon, color, gx, gz, grid, opts = {}) {
    this.scene  = scene;
    this.id     = id;
    this.name   = name;
    this.icon   = icon;
    this.grid   = grid;

    this.hp     = opts.hp  || 80;
    this.maxHp  = this.hp;
    this.atk    = opts.atk || [12, 20];
    this.description = opts.description || '';
    this.recruited   = false;

    this._homeGx     = gx;
    this._homeGz     = gz;
    this._wanderTimer = Math.random() * 4;
    this._wanderTarget = null;
    this._attackTimer  = 0;
    this._followIndex  = opts.followIndex || 0;

    const { wx, wz } = grid.gridToWorld(gx, gz);
    this.position = new THREE.Vector3(wx, 1.0, wz);

    this.mesh = this._createSprite(color);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  _createSprite(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 48;
    const ctx = canvas.getContext('2d');

    // Body
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(8, 16, 16, 22);

    // Head
    ctx.fillStyle = '#ffcc88';
    ctx.beginPath();
    ctx.arc(16, 10, 9, 0, Math.PI * 2);
    ctx.fill();

    // Icon on chest
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.icon, 16, 30);

    // Legs
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(8, 38, 6, 8);
    ctx.fillRect(18, 38, 6, 8);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.8, 1.2, 1);
    sprite.renderOrder = 2;
    return sprite;
  }

  interact(game) {
    if (this.recruited) {
      game.showDialog(`${this.name}: 「一緒に戦うぞ！頑張ろう！」`);
      return;
    }
    this.recruited = true;
    // Pick the next available follow slot
    const idx = (game.companions || []).filter(c => c.recruited && c !== this).length;
    this._followIndex = Math.min(idx, FOLLOW_OFFSET.length - 1);
    game.showDialog(`${this.name}が仲間になった！\n${this.description}`);
    game.questMgr?.onEvent('recruit', { companion: this.id });
  }

  update(delta, playerPos, enemies, game) {
    if (this.recruited) {
      this._followPlayer(delta, playerPos);
      this._tryAttack(delta, enemies, game);
    } else {
      this._wander(delta);
    }
    this.mesh.position.copy(this.position);
    this.mesh.position.y = 1.0;
  }

  _followPlayer(delta, playerPos) {
    const offset = FOLLOW_OFFSET[this._followIndex] || FOLLOW_OFFSET[0];
    const target = playerPos.clone().add(offset);
    const dir = target.clone().sub(this.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist > 0.25) {
      dir.normalize().multiplyScalar(Math.min(FOLLOW_SPEED * delta, dist));
      this.position.add(dir);
    }
  }

  _wander(delta) {
    this._wanderTimer -= delta;
    if (this._wanderTimer <= 0) {
      this._wanderTimer = 4 + Math.random() * 3;
      const dx = Math.round((Math.random() - 0.5) * 6);
      const dz = Math.round((Math.random() - 0.5) * 6);
      const ngx = Math.max(0, Math.min(63, this._homeGx + dx));
      const ngz = Math.max(0, Math.min(63, this._homeGz + dz));
      if (this.grid.isWalkable(ngx, ngz)) {
        const { wx, wz } = this.grid.gridToWorld(ngx, ngz);
        this._wanderTarget = new THREE.Vector3(wx, 1.0, wz);
      }
    }
    if (this._wanderTarget) {
      const dir = this._wanderTarget.clone().sub(this.position);
      const dist = dir.length();
      if (dist > 0.05) {
        dir.normalize().multiplyScalar(Math.min(0.8 * delta, dist));
        this.position.add(dir);
      }
    }
  }

  _tryAttack(delta, enemies, game) {
    if (game.battleSys?.active) return; // no real-time attack during turn-based battle
    this._attackTimer = Math.max(0, this._attackTimer - delta);
    if (this._attackTimer > 0) return;

    for (const e of enemies) {
      if (this.position.distanceTo(e.position) < 2.2) {
        const dmg = this.atk[0] + Math.floor(Math.random() * (this.atk[1] - this.atk[0] + 1));
        e.takeDamage(dmg, game);
        this._attackTimer = 2.5;
        return;
      }
    }
  }

  // Called by BattleSystem for their turn in turn-based combat
  battleAct(enemy, game) {
    const dmg = this.atk[0] + Math.floor(Math.random() * (this.atk[1] - this.atk[0] + 1));
    enemy.takeDamage(dmg, game);
    return `${this.name}の攻撃！${dmg}ダメージ！`;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
  }
}
