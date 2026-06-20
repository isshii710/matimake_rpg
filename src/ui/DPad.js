const JOYSTICK_RADIUS = 52;
const KNOB_RADIUS = 20;
const DEAD_ZONE = 12;
const DRAG_THRESHOLD = 8;

export class DPad {
  constructor() {
    this.up = false;
    this.down = false;
    this.left = false;
    this.right = false;
    this.attack = false;
    this.isDragging = false;

    this._activeTouch = null;
    this._baseX = 0;
    this._baseY = 0;
    this._attackBtn = document.getElementById('attack-btn');

    if (!('ontouchstart' in window) && !navigator.maxTouchPoints) {
      if (this._attackBtn) this._attackBtn.style.display = 'none';
      return;
    }

    this._createElements();
    this._bindCanvas();
    this._bindAttack();
  }

  _createElements() {
    this._base = document.createElement('div');
    this._base.id = 'joystick-base';

    this._knob = document.createElement('div');
    this._knob.id = 'joystick-knob';

    this._base.appendChild(this._knob);
    document.body.appendChild(this._base);
  }

  _bindCanvas() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    canvas.addEventListener('touchstart', e => {
      if (this._activeTouch !== null) return;
      const touch = e.changedTouches[0];
      this._activeTouch = touch.identifier;
      this._baseX = touch.clientX;
      this._baseY = touch.clientY;
      this.isDragging = false;
      this._showAt(this._baseX, this._baseY);
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      for (const touch of e.changedTouches) {
        if (touch.identifier !== this._activeTouch) continue;
        const dx = touch.clientX - this._baseX;
        const dy = touch.clientY - this._baseY;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) this.isDragging = true;
        this._update(touch.clientX, touch.clientY);
      }
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      for (const touch of e.changedTouches) {
        if (touch.identifier !== this._activeTouch) continue;
        this._activeTouch = null;
        this._hide();
      }
    }, { passive: false });

    canvas.addEventListener('touchcancel', () => {
      this._activeTouch = null;
      this._hide();
    }, { passive: false });
  }

  _showAt(x, y) {
    this._base.style.left = (x - JOYSTICK_RADIUS) + 'px';
    this._base.style.top  = (y - JOYSTICK_RADIUS) + 'px';
    this._knob.style.left = JOYSTICK_RADIUS + 'px';
    this._knob.style.top  = JOYSTICK_RADIUS + 'px';
    this._base.style.display = 'block';
  }

  _hide() {
    this._base.style.display = 'none';
    this.up = this.down = this.left = this.right = false;
  }

  _update(x, y) {
    const dx = x - this._baseX;
    const dy = y - this._baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxKnob = JOYSTICK_RADIUS - KNOB_RADIUS - 4;
    const angle = Math.atan2(dy, dx);

    this._knob.style.left = (JOYSTICK_RADIUS + Math.cos(angle) * Math.min(dist, maxKnob)) + 'px';
    this._knob.style.top  = (JOYSTICK_RADIUS + Math.sin(angle) * Math.min(dist, maxKnob)) + 'px';

    if (dist < DEAD_ZONE) {
      this.up = this.down = this.left = this.right = false;
      return;
    }

    const deg = (angle * 180 / Math.PI + 360) % 360;
    this.up    = deg > 202.5 && deg < 337.5;
    this.down  = deg > 22.5  && deg < 157.5;
    this.left  = deg > 112.5 && deg < 247.5;
    this.right = deg < 67.5  || deg > 292.5;
  }

  _bindAttack() {
    if (!this._attackBtn) return;
    this._attackBtn.addEventListener('touchstart', e => { e.preventDefault(); this.attack = true; }, { passive: false });
    this._attackBtn.addEventListener('touchend',   e => { e.preventDefault(); this.attack = false; }, { passive: false });
  }
}
