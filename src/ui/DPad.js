export class DPad {
  constructor() {
    this.up = false;
    this.down = false;
    this.left = false;
    this.right = false;
    this.attack = false;

    this._el = document.getElementById('dpad');
    this._attackBtn = document.getElementById('attack-btn');

    if (!this._el) return;

    // Only show DPad on touch devices
    if (!('ontouchstart' in window) && !navigator.maxTouchPoints) {
      this._el.style.display = 'none';
      if (this._attackBtn) this._attackBtn.style.display = 'none';
      return;
    }

    this._bindDPad();
    this._bindAttack();
  }

  _bindDPad() {
    const directions = { up: 'up', down: 'down', left: 'left', right: 'right' };
    for (const [dir, prop] of Object.entries(directions)) {
      const btn = document.getElementById(`dpad-${dir}`);
      if (!btn) continue;
      btn.addEventListener('touchstart', e => { e.preventDefault(); this[prop] = true; }, { passive: false });
      btn.addEventListener('touchend', e => { e.preventDefault(); this[prop] = false; }, { passive: false });
    }

    // Joystick-style: track touch position on dpad area
    this._el.addEventListener('touchstart', this._onTouch.bind(this), { passive: false });
    this._el.addEventListener('touchmove', this._onTouch.bind(this), { passive: false });
    this._el.addEventListener('touchend', e => {
      e.preventDefault();
      this.up = this.down = this.left = this.right = false;
    }, { passive: false });
  }

  _onTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this._el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = touch.clientX - cx;
    const dy = touch.clientY - cy;
    const angle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 15) {
      this.up = this.down = this.left = this.right = false;
      return;
    }

    // Isometric directions
    const deg = (angle * 180 / Math.PI + 360) % 360;
    this.up    = deg > 225 && deg < 315;
    this.down  = deg > 45  && deg < 135;
    this.left  = deg > 135 && deg < 225;
    this.right = (deg > 315 || deg < 45);
  }

  _bindAttack() {
    if (!this._attackBtn) return;
    this._attackBtn.addEventListener('touchstart', e => { e.preventDefault(); this.attack = true; }, { passive: false });
    this._attackBtn.addEventListener('touchend', e => { e.preventDefault(); this.attack = false; }, { passive: false });
  }
}
