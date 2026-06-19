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
      const isSelected = this.game.buildSys.selectedId === b.id && this.game.buildSys.mode;
      return `<div class="build-item ${isSelected ? 'active' : ''}" data-id="${b.id}">
        <div class="build-name">${b.name}</div>
        <div class="build-cost">${costStr || '無料'}</div>
        <div class="build-desc">${b.description}</div>
      </div>`;
    }).join('');

    this._listEl.querySelectorAll('.build-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        if (this.game.buildSys.selectedId === id && this.game.buildSys.mode) {
          this.exitBuildMode();
        } else {
          this.game.buildSys.enterBuildMode(id);
          this._render();
        }
      });
    });
  }
}
