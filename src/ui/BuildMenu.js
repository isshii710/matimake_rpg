import { BUILDINGS, BUILDING_CATEGORIES } from '../building/Buildings.js';
import { ITEMS } from '../data/Items.js';

export class BuildMenu {
  constructor(game) {
    this.game = game;
    this._el = document.getElementById('build-menu');
    this._tabsEl = document.getElementById('build-tabs');
    this._listEl = document.getElementById('build-list');
    this._activeCategory = BUILDING_CATEGORIES[0];
    this._open = false;

    this._render();
    this._bindToggle();
  }

  _bindToggle() {
    const btn = document.getElementById('build-toggle');
    if (btn) btn.addEventListener('click', () => this.toggle());
    const dem = document.getElementById('demolish-toggle');
    if (dem) dem.addEventListener('click', () => {
      if (this.game.buildSys.demolishMode) {
        this.game.buildSys.exitBuildMode();
      } else {
        this._open = false;
        this._el.style.display = 'none';
        this.game.buildSys.enterDemolishMode();
        this._render();
      }
    });
    const rotBtn = document.getElementById('rotate-btn');
    if (rotBtn) rotBtn.addEventListener('click', () => {
      if (this.game.buildSys.mode) this.game.buildSys.rotate();
    });
  }

  toggle() {
    this._open = !this._open;
    this._el.style.display = this._open ? 'block' : 'none';
    if (this._open) this._render();
  }

  open() { this._open = true; this._el.style.display = 'block'; this._render(); }
  close() { this._open = false; this._el.style.display = 'none'; this.exitBuildMode(); }

  exitBuildMode() {
    this.game.buildSys.exitBuildMode();
    this._render();
  }

  _render() {
    if (!this._el) return;

    // Tabs
    this._tabsEl.innerHTML = BUILDING_CATEGORIES.map(cat =>
      `<button class="tab-btn ${cat === this._activeCategory ? 'active' : ''}" data-cat="${cat}">${cat}</button>`
    ).join('');
    this._tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeCategory = btn.dataset.cat;
        this._render();
      });
    });

    // Building list
    const items = Object.values(BUILDINGS).filter(b =>
      b.category === this._activeCategory && !b.hidden
    );

    this._listEl.innerHTML = items.map(b => {
      const costStr = Object.entries(b.cost)
        .map(([id, n]) => `${ITEMS[id]?.icon || id}×${n}`)
        .join(' ');
      const count = this.game.inventory.getCount(b.id);
      const canAfford = Object.entries(b.cost).every(([id, n]) => this.game.inventory.has(id, n));
      const isSelected = this.game.buildSys.selectedId === b.id && this.game.buildSys.mode;
      const label = b.isTool ? (count > 0 ? `${b.name} <span style="color:#aef;font-size:0.8em">所持${count}</span>` : b.name) : `${b.name}${count > 0 ? ` <span style="color:#aef;font-size:0.8em">所持×${count}</span>` : ''}`;
      return `<div class="build-item ${isSelected ? 'active' : ''}" data-id="${b.id}" style="opacity:${canAfford || count > 0 ? 1 : 0.5}">
        <div class="build-name">${label}</div>
        <div class="build-cost">${costStr || '無料'}</div>
        <div class="build-desc">${b.description}</div>
      </div>`;
    }).join('');

    this._listEl.querySelectorAll('.build-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const def = BUILDINGS[id];
        if (this.game.buildSys.craftBuilding(id)) {
          if (!def?.isTool) {
            // Building item: hide menu, ghost is active
            this._open = false;
            this._el.style.display = 'none';
          } else {
            this._render(); // Tool: just refresh count
          }
        } else {
          this._render();
        }
      });
    });
  }
}
