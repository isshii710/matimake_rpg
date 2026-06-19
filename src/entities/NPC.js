import * as THREE from 'three';

const NPC_SPEED = 0.8;
const WANDER_INTERVAL = 4;
const SAFE_WANDER_RANGE = 6;

export class NPC {
  constructor(scene, id, name, color, gx, gz, grid) {
    this.scene = scene;
    this.id = id;
    this.name = name;
    this.grid = grid;

    const { wx, wz } = grid.gridToWorld(gx, gz);
    this.position = new THREE.Vector3(wx, 1.0, wz);
    this.target = this.position.clone();
    this._wanderTimer = Math.random() * WANDER_INTERVAL;
    this._homeGx = gx;
    this._homeGz = gz;

    this.mesh = this._createSprite(name[0], color);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);

    this.dialog = null;
    this._dialogEl = null;
  }

  _createSprite(initial, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 48;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(8, 16, 16, 22);

    ctx.fillStyle = '#ffcc88';
    ctx.beginPath();
    ctx.arc(16, 10, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(initial, 16, 13);

    // Legs
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(8, 38, 6, 8);
    ctx.fillRect(18, 38, 6, 8);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.8, 1.2, 1);
    return sprite;
  }

  update(delta) {
    // Wander logic
    this._wanderTimer -= delta;
    if (this._wanderTimer <= 0) {
      this._wanderTimer = WANDER_INTERVAL + Math.random() * 3;
      const dx = Math.round((Math.random() - 0.5) * SAFE_WANDER_RANGE * 2);
      const dz = Math.round((Math.random() - 0.5) * SAFE_WANDER_RANGE * 2);
      const ngx = Math.max(0, Math.min(63, this._homeGx + dx));
      const ngz = Math.max(0, Math.min(63, this._homeGz + dz));
      if (this.grid.isWalkable(ngx, ngz)) {
        const { wx, wz } = this.grid.gridToWorld(ngx, ngz);
        this.target.set(wx, 1.0, wz);
      }
    }

    // Move toward target
    const dir = this.target.clone().sub(this.position);
    const dist = dir.length();
    if (dist > 0.05) {
      dir.normalize().multiplyScalar(Math.min(NPC_SPEED * delta, dist));
      this.position.add(dir);
    }

    this.mesh.position.copy(this.position);
  }

  interact(game) {
    const lines = [
      `${this.name}: 「ここは小さな集落だが、きっと大きくなる！」`,
      `${this.name}: 「外は危ない。準備を整えてから行くんだぞ。」`,
      `${this.name}: 「農業を始めるなら、まず土を耕すことだ。」`,
    ];
    game.showDialog(lines[Math.floor(Math.random() * lines.length)]);
  }
}
