// Dragon Quest-style turn-based battle system.
// Triggered when player presses SPACE near an enemy.

export class BattleSystem {
  constructor(game) {
    this.game = game;
    this.active = false;
    this._enemy = null;
    this._phase = 'player'; // 'player' | 'busy' | 'result'
    this._log = [];
    this._el = null;
    this._buildUI();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  tryStart() {
    if (this.active) return false;
    const player = this.game.player;
    let closest = null;
    let closestDist = 2.5;
    for (const e of this.game.enemyMgr.enemies) {
      const d = player.position.distanceTo(e.position);
      if (d < closestDist) { closestDist = d; closest = e; }
    }
    if (!closest) return false;
    this._startBattle(closest);
    return true;
  }

  endBattle(won, fled = false) {
    this.active = false;
    this._enemy = null;
    this._hide();
    if (fled) this.game.showDialog('逃げ出した！');
    else if (won) this.game.showDialog('戦闘勝利！');
    else this.game.showDialog('力尽きた...');
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  _startBattle(enemy) {
    this.active = true;
    this._enemy = enemy;
    this._phase = 'player';
    this._log = [`${enemy.def.name}が現れた！`];
    this._show();
    this._render();
  }

  _playerAction(action) {
    if (this._phase !== 'player') return;
    this._phase = 'busy';
    const player = this.game.player;
    const enemy  = this._enemy;
    let msg = '';

    if (action === 'attack') {
      const dmg = 18 + Math.floor(Math.random() * 12);
      enemy.takeDamage(dmg, this.game);
      msg = `プレイヤーの攻撃！${enemy.def.name}に${dmg}ダメージ！`;

    } else if (action === 'magic') {
      const mpCost = 20;
      const mag = this.game.magicSys;
      if (mag && mag.mp >= mpCost) {
        mag.mp -= mpCost;
        const dmg = 38 + Math.floor(Math.random() * 18);
        enemy.takeDamage(dmg, this.game);
        msg = `🔥 ファイアボール！${dmg}ダメージ！`;
      } else {
        msg = 'MPが足りない！';
        this._phase = 'player';
        this._addLog(msg);
        this._render();
        return;
      }

    } else if (action === 'item') {
      if (this.game.inventory.has('herb', 1)) {
        this.game.inventory.remove('herb', 1);
        const heal = 35;
        player.hp = Math.min(player.maxHp, player.hp + heal);
        msg = `🌿 ハーブを使った！HP+${heal}`;
      } else {
        msg = 'アイテムがない！（ハーブが必要）';
        this._phase = 'player';
        this._addLog(msg);
        this._render();
        return;
      }

    } else if (action === 'run') {
      if (Math.random() < 0.55) { this.endBattle(false, true); return; }
      msg = '逃げられなかった！';
    }

    this._addLog(msg);
    this._render();

    if (enemy.dead) {
      const xp = enemy.def.xp || 5;
      this._addLog(`${enemy.def.name}を倒した！ ${xp}XP獲得`);
      this._render();
      setTimeout(() => this.endBattle(true), 1800);
      return;
    }

    // Companion turns (auto)
    const compMsgs = this._companionActs(enemy);
    for (const m of compMsgs) { this._addLog(m); this._render(); }
    if (enemy.dead) {
      const xp = enemy.def.xp || 5;
      this._addLog(`${enemy.def.name}を倒した！ ${xp}XP獲得`);
      this._render();
      setTimeout(() => this.endBattle(true), 1800);
      return;
    }

    setTimeout(() => this._enemyTurn(), 900);
  }

  _enemyTurn() {
    if (!this.active) return;
    this._phase = 'enemy';
    const player = this.game.player;
    const enemy  = this._enemy;

    const dmg = Math.max(1, Math.floor(enemy.def.damage * (0.8 + Math.random() * 0.4)));
    player.takeDamage(dmg);
    this._addLog(`${enemy.def.name}の攻撃！${dmg}ダメージ！`);
    this._render();

    setTimeout(() => {
      if (!this.active) return;
      if (player.hp <= 0) {
        this._addLog('倒されてしまった...');
        this._render();
        setTimeout(() => this.endBattle(false), 1800);
        return;
      }
      this._phase = 'player';
      this._render();
    }, 900);
  }

  _companionActs(enemy) {
    const msgs = [];
    for (const c of this.game.companions || []) {
      if (!c.recruited || enemy.dead) continue;
      msgs.push(c.battleAct(enemy, this.game));
    }
    return msgs;
  }

  _addLog(msg) {
    this._log.unshift(msg);
    if (this._log.length > 4) this._log.pop();
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  _buildUI() {
    this._el = document.createElement('div');
    this._el.id = 'battle-screen';
    this._el.style.cssText = `
      display:none; position:fixed; inset:0; z-index:40;
      background:rgba(4,2,8,0.92);
      flex-direction:column; align-items:center; justify-content:center;
      font-family:'Segoe UI','Hiragino Kaku Gothic ProN',sans-serif;
    `;
    this._el.innerHTML = `
      <div id="b-enemy-area" style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:24px;">
        <div id="b-enemy-sprite" style="font-size:96px;line-height:1;filter:drop-shadow(0 0 18px rgba(180,80,20,0.9));"></div>
        <div id="b-enemy-name" style="color:#f0d880;font-size:16px;font-weight:bold;"></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:#a08040;font-size:11px;">HP</span>
          <div style="width:160px;height:12px;background:#1a0e04;border:1px solid #4a3010;border-radius:3px;overflow:hidden;">
            <div id="b-enemy-hp" style="height:100%;background:linear-gradient(90deg,#cc2222,#ff5544);transition:width 0.3s;"></div>
          </div>
          <span id="b-enemy-hp-txt" style="color:#cc8888;font-size:11px;"></span>
        </div>
      </div>

      <div id="b-log" style="
        width:min(460px,90vw); background:rgba(10,6,2,0.85);
        border:1px solid #4a3010; border-radius:6px; padding:10px 14px;
        min-height:80px; margin-bottom:16px;
        display:flex; flex-direction:column; gap:3px;
      "></div>

      <div id="b-player-area" style="display:flex;align-items:flex-start;gap:16px;margin-bottom:16px;flex-wrap:wrap;justify-content:center;">
        <div>
          <div style="color:#f0d880;font-size:13px;font-weight:bold;">プレイヤー</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
            <span style="color:#a08040;font-size:10px;">HP</span>
            <div style="width:100px;height:9px;background:#1a0e04;border:1px solid #4a3010;border-radius:2px;overflow:hidden;">
              <div id="b-player-hp" style="height:100%;background:linear-gradient(90deg,#22bb44,#88ee66);transition:width 0.3s;"></div>
            </div>
            <span id="b-player-hp-txt" style="color:#88cc88;font-size:10px;"></span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <span style="color:#a08040;font-size:10px;">MP</span>
            <div style="width:100px;height:9px;background:#1a0e04;border:1px solid #4a3010;border-radius:2px;overflow:hidden;">
              <div id="b-player-mp" style="height:100%;background:linear-gradient(90deg,#6622aa,#aa44ff);transition:width 0.3s;"></div>
            </div>
          </div>
        </div>
        <div id="b-companions" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>

      <div id="b-commands" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
        <button data-action="attack" style="background:rgba(60,20,10,0.9);border:1px solid #cc4422;border-radius:5px;color:#ff8866;padding:10px 20px;cursor:pointer;font-size:14px;font-family:inherit;min-width:90px;transition:background 0.15s;">⚔ たたかう</button>
        <button data-action="magic"  style="background:rgba(20,10,50,0.9);border:1px solid #6633aa;border-radius:5px;color:#cc88ff;padding:10px 20px;cursor:pointer;font-size:14px;font-family:inherit;min-width:90px;transition:background 0.15s;">🔥 まほう</button>
        <button data-action="item"   style="background:rgba(10,30,10,0.9);border:1px solid #336622;border-radius:5px;color:#88dd66;padding:10px 20px;cursor:pointer;font-size:14px;font-family:inherit;min-width:90px;transition:background 0.15s;">🌿 アイテム</button>
        <button data-action="run"    style="background:rgba(10,20,40,0.9);border:1px solid #224466;border-radius:5px;color:#6699cc;padding:10px 20px;cursor:pointer;font-size:14px;font-family:inherit;min-width:90px;transition:background 0.15s;">💨 にげる</button>
      </div>
      <div style="color:#504030;font-size:10px;margin-top:10px;">ターン制バトル – コマンドを選択</div>
    `;
    document.body.appendChild(this._el);

    this._el.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => this._playerAction(btn.dataset.action));
      btn.addEventListener('mouseenter', () => btn.style.filter = 'brightness(1.4)');
      btn.addEventListener('mouseleave', () => btn.style.filter = '');
    });
  }

  _show() { this._el.style.display = 'flex'; }
  _hide() { this._el.style.display = 'none'; }

  _render() {
    const enemy  = this._enemy;
    const player = this.game.player;
    const mag    = this.game.magicSys;

    // Enemy
    this._el.querySelector('#b-enemy-sprite').textContent = enemy?.def?.icon || '👾';
    this._el.querySelector('#b-enemy-name').textContent = enemy ? `${enemy.def.name}  Lv.${enemy.def.level || 1}` : '';
    const epct = enemy ? (enemy.hp / enemy.maxHp) * 100 : 0;
    this._el.querySelector('#b-enemy-hp').style.width = epct + '%';
    this._el.querySelector('#b-enemy-hp-txt').textContent = enemy ? `${enemy.hp}/${enemy.maxHp}` : '';

    // Player
    const ppct = (player.hp / player.maxHp) * 100;
    this._el.querySelector('#b-player-hp').style.width = ppct + '%';
    this._el.querySelector('#b-player-hp-txt').textContent = `${player.hp}/${player.maxHp}`;
    if (mag) {
      const mpct = (mag.mp / mag.maxMp) * 100;
      this._el.querySelector('#b-player-mp').style.width = mpct + '%';
    }

    // Log
    const logEl = this._el.querySelector('#b-log');
    logEl.innerHTML = this._log.map((msg, i) =>
      `<div style="color:${i === 0 ? '#f0e0a0' : '#807060'};font-size:${i === 0 ? 13 : 11}px;">${msg}</div>`
    ).join('');

    // Companion HP bars
    const compEl = this._el.querySelector('#b-companions');
    if (compEl) {
      compEl.innerHTML = '';
      for (const c of this.game.companions || []) {
        if (!c.recruited) continue;
        const pct = (c.hp / c.maxHp) * 100;
        const div = document.createElement('div');
        div.innerHTML = `
          <div style="color:#d0e8f0;font-size:12px;font-weight:bold;">${c.icon} ${c.name}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <span style="color:#a08040;font-size:10px;">HP</span>
            <div style="width:80px;height:8px;background:#1a0e04;border:1px solid #4a3010;border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#2288aa,#55ccee);transition:width 0.3s;"></div>
            </div>
            <span style="color:#88ccdd;font-size:10px;">${c.hp}/${c.maxHp}</span>
          </div>
        `;
        compEl.appendChild(div);
      }
    }

    // Disable commands when not player turn
    const disabled = this._phase !== 'player';
    this._el.querySelectorAll('[data-action]').forEach(btn => {
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.4' : '1';
    });
  }
}
