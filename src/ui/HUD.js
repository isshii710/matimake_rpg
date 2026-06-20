export class HUD {
  constructor(game) {
    this.game = game;
    this._hpBar = document.getElementById('hp-fill');
    this._hpText = document.getElementById('hp-text');
    this._staminaBar = document.getElementById('stamina-fill');
    this._questList = document.getElementById('quest-list');
    this._dayLabel = document.getElementById('day-label');
    this._dialogBox = document.getElementById('dialog-box');
    this._dialogTimer = 0;
    this._modeLabel = document.getElementById('mode-label');
  }

  update(delta) {
    const p = this.game.player;
    if (!p) return;

    // HP bar
    const hpPct = (p.hp / p.maxHp) * 100;
    if (this._hpBar) {
      this._hpBar.style.width = hpPct + '%';
      this._hpBar.style.background = hpPct > 50 ? '#44dd44' : hpPct > 25 ? '#ffaa00' : '#dd2222';
    }
    if (this._hpText) this._hpText.textContent = `${p.hp}/${p.maxHp}`;

    // Stamina bar
    const stPct = (p.stamina / p.maxStamina) * 100;
    if (this._staminaBar) this._staminaBar.style.width = stPct + '%';

    // Day/season
    if (this._dayLabel) this._dayLabel.textContent = this.game.season.getLabel();

    // Dialog timer
    if (this._dialogTimer > 0) {
      this._dialogTimer -= delta;
      if (this._dialogTimer <= 0) this.hideDialog();
    }

    // Mode label
    if (this._modeLabel) {
      const bs = this.game.buildSys;
      if (bs.demolishMode) {
        this._modeLabel.textContent = '⛏ 撤去モード: タップで撤去（素材50%回収）';
        this._modeLabel.style.display = 'block';
        this._modeLabel.style.borderColor = '#cc3322';
        this._modeLabel.style.color = '#ff7755';
      } else if (bs.mode) {
        const name = bs.selectedId || '';
        this._modeLabel.textContent = `🔨 建設: ${name}  ↻R=回転`;
        this._modeLabel.style.display = 'block';
        this._modeLabel.style.borderColor = '#8B6914';
        this._modeLabel.style.color = '#d4a540';
      } else if (this.game.farmMode.selectedCrop) {
        this._modeLabel.textContent = `🌱 農業: ${this.game.farmMode.selectedCrop}  タップで植える`;
        this._modeLabel.style.display = 'block';
        this._modeLabel.style.borderColor = '#8B6914';
        this._modeLabel.style.color = '#d4a540';
      } else {
        this._modeLabel.style.display = 'none';
      }
    }
  }

  updateQuests(quests) {
    if (!this._questList) return;
    const display = quests.slice(0, 3);
    this._questList.innerHTML = display.map(q => {
      const objHtml = q.objectives.map(o =>
        `<div class="quest-obj ${o.current >= o.count ? 'done' : ''}">
          ${o.current >= o.count ? '✓' : '○'} ${o.text} (${o.current}/${o.count})
        </div>`
      ).join('');
      return `<div class="quest-item">
        <div class="quest-title">${q.title}</div>
        ${objHtml}
      </div>`;
    }).join('');
  }

  showDialog(text) {
    if (!this._dialogBox) return;
    this._dialogBox.textContent = text;
    this._dialogBox.classList.add('visible');
    this._dialogTimer = 4;
  }

  hideDialog() {
    if (!this._dialogBox) return;
    this._dialogBox.classList.remove('visible');
  }
}
