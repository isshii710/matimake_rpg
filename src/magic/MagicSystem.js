import * as THREE from 'three';

export const SPELLS = {
  fireball: { id: 'fireball', name: 'ファイアボール', mp: 20, icon: '🔥', damage: 40, aoe: 2.5, color: 0xff4400, key: '1' },
  heal:     { id: 'heal',     name: 'ヒール',         mp: 15, icon: '💚', heal: 40,   color: 0x44ff88, key: '2' },
  thunder:  { id: 'thunder',  name: 'サンダー',       mp: 30, icon: '⚡', damage: 70, range: 6, color: 0xffff44, key: '3' },
};

export class MagicSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.mp = 100;
    this.maxMp = 100;
    this._effects = [];
    this._cooldown = 0;
    this._COOL = 1.0;
  }

  update(delta) {
    this.mp = Math.min(this.maxMp, this.mp + 6 * delta);
    this._cooldown = Math.max(0, this._cooldown - delta);

    for (let i = this._effects.length - 1; i >= 0; i--) {
      const fx = this._effects[i];
      fx.age += delta;
      if (fx.age >= fx.duration) {
        if (fx.onEnd) fx.onEnd();
        this.scene.remove(fx.obj);
        if (fx.obj.geometry) fx.obj.geometry.dispose();
        if (fx.obj.material) fx.obj.material.dispose();
        this._effects.splice(i, 1);
      } else {
        fx.tick(delta, fx);
      }
    }
  }

  cast(spellId) {
    if (this._cooldown > 0) return;
    const spell = SPELLS[spellId];
    if (!spell) return;
    if (this.mp < spell.mp) {
      this.game.showDialog('MPが足りない！');
      return;
    }
    this.mp -= spell.mp;
    this._cooldown = this._COOL;

    if (spellId === 'fireball') this._fireball(spell);
    else if (spellId === 'heal')    this._heal(spell);
    else if (spellId === 'thunder') this._thunder(spell);
  }

  // ── Fireball ──────────────────────────────────────────────────────────────

  _fireball(spell) {
    const player = this.game.player;
    const fd = player._facingDir;
    const start = player.position.clone().add(new THREE.Vector3(0, 0.8, 0));
    const target = player.position.clone().addScaledVector(fd, 4).add(new THREE.Vector3(0, 0.8, 0));

    const count = 30;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = start.x + (Math.random()-0.5)*0.2;
      pos[i*3+1] = start.y + (Math.random()-0.5)*0.2;
      pos[i*3+2] = start.z + (Math.random()-0.5)*0.2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xff5500, size: 0.22, transparent: true, opacity: 0.95 });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);

    const dir = target.clone().sub(start).normalize();
    const speed = 7;
    const dist = start.distanceTo(target);
    let travelled = 0;

    this._effects.push({
      obj: pts, age: 0, duration: dist / speed + 0.05,
      tick: (dt, fx) => {
        const d = Math.min(speed * dt, dist - travelled);
        travelled += d;
        pts.position.addScaledVector(dir, d);
        mat.color.setHSL(0.06 - fx.age * 0.05, 1, 0.5);
        mat.opacity = 0.95 - fx.age * 0.3;
        geo.attributes.position.needsUpdate = true;
      },
      onEnd: () => {
        const hitPos = start.clone().addScaledVector(dir, dist);
        this._explode(hitPos, 0xff4400, 50);
        let hit = false;
        for (const enemy of this.game.enemyMgr.enemies) {
          if (enemy.position.distanceTo(hitPos) <= spell.aoe) {
            enemy.takeDamage(spell.damage, this.game);
            hit = true;
          }
        }
        this.game.showDialog(hit ? `🔥 ファイアボール命中！${spell.damage}ダメージ！` : '🔥 外れた！');
      },
    });
    this.game.showDialog('🔥 ファイアボール！');
  }

  // ── Heal ─────────────────────────────────────────────────────────────────

  _heal(spell) {
    const player = this.game.player;
    const prev = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + spell.heal);
    const gained = player.hp - prev;
    this._burst(player.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 0x44ff88, 25, true);
    this.game.showDialog(`💚 ヒール！HP+${gained}`);
  }

  // ── Thunder ───────────────────────────────────────────────────────────────

  _thunder(spell) {
    const player = this.game.player;
    const fd = player._facingDir;

    let target = null;
    let bestDist = spell.range;
    for (const enemy of this.game.enemyMgr.enemies) {
      const toEnemy = enemy.position.clone().sub(player.position);
      const dot = toEnemy.normalize().dot(fd);
      const dist = player.position.distanceTo(enemy.position);
      if (dot > 0.4 && dist < bestDist) { bestDist = dist; target = enemy; }
    }

    if (!target) {
      this.game.showDialog('⚡ 的がいない！');
      this.mp += spell.mp;
      this._cooldown = 0;
      return;
    }

    const from = player.position.clone().add(new THREE.Vector3(0, 3, 0));
    const to   = target.position.clone().add(new THREE.Vector3(0, 1, 0));
    this._lightning(from, to);
    this._explode(to, 0xffff44, 20);
    target.takeDamage(spell.damage, this.game);
    this.game.showDialog(`⚡ サンダー！${spell.damage}ダメージ！`);
  }

  // ── Particle effects ──────────────────────────────────────────────────────

  _explode(pos, color, count) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      positions[i*3]   = pos.x;
      positions[i*3+1] = pos.y;
      positions[i*3+2] = pos.z;
      vels.push(new THREE.Vector3(
        (Math.random()-0.5) * 5,
        Math.random() * 4 + 1,
        (Math.random()-0.5) * 5
      ));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.20, transparent: true, opacity: 1.0 });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);

    this._effects.push({
      obj: pts, age: 0, duration: 0.8,
      tick: (dt, fx) => {
        const p = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
          vels[i].y -= 9.8 * dt;
          p[i*3]   += vels[i].x * dt;
          p[i*3+1] += vels[i].y * dt;
          p[i*3+2] += vels[i].z * dt;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = Math.max(0, 1.0 - fx.age / 0.8);
      },
      onEnd: null,
    });
  }

  _burst(pos, color, count, riseUp = false) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      positions[i*3]   = pos.x + Math.cos(angle) * 0.15;
      positions[i*3+1] = pos.y;
      positions[i*3+2] = pos.z + Math.sin(angle) * 0.15;
      vels.push(new THREE.Vector3(
        Math.cos(angle) * (riseUp ? 1.5 : 3),
        Math.random() * 3 + (riseUp ? 3 : 1),
        Math.sin(angle) * (riseUp ? 1.5 : 3)
      ));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.18, transparent: true, opacity: 1.0 });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);

    this._effects.push({
      obj: pts, age: 0, duration: 1.0,
      tick: (dt, fx) => {
        const p = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
          vels[i].y -= 4 * dt;
          p[i*3]   += vels[i].x * dt;
          p[i*3+1] += vels[i].y * dt;
          p[i*3+2] += vels[i].z * dt;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = Math.max(0, 1.0 - fx.age);
      },
      onEnd: null,
    });
  }

  _lightning(from, to) {
    const segs = 10;
    const posArr = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const pt = from.clone().lerp(to, t);
      if (i > 0 && i < segs) {
        pt.x += (Math.random()-0.5) * 0.6;
        pt.y += (Math.random()-0.5) * 0.3;
        pt.z += (Math.random()-0.5) * 0.6;
      }
      posArr.push(pt.x, pt.y, pt.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posArr), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    this._effects.push({
      obj: line, age: 0, duration: 0.35,
      tick: (dt, fx) => {
        mat.opacity = Math.max(0, 1.0 - fx.age / 0.35);
        const p = geo.attributes.position.array;
        for (let i = 1; i < segs; i++) {
          const t = i / segs;
          const base = from.clone().lerp(to, t);
          p[i*3]   = base.x + (Math.random()-0.5) * 0.5;
          p[i*3+1] = base.y + (Math.random()-0.5) * 0.25;
          p[i*3+2] = base.z + (Math.random()-0.5) * 0.5;
        }
        geo.attributes.position.needsUpdate = true;
      },
      onEnd: null,
    });
  }
}
