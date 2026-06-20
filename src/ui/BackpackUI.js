import { ITEMS } from '../data/Items.js';

export class BackpackUI {
  constructor(game) {
    this.game = game;
    this._el = document.getElementById('backpack-panel');
    this._open = false;

    const closeBtn = document.getElementById('backpack-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
  }

  toggle() {
    this._open = !this._open;
    if (this._el) this._el.style.display = this._open ? 'block' : 'none';
    if (this._open) this.render();
  }

  close() {
    this._open = false;
    if (this._el) this._el.style.display = 'none';
  }

  render() {
    const el = document.getElementById('backpack-grid');
    if (!el) return;
    const inv = this.game.inventory;
    el.innerHTML = '';
    for (let i = 0; i < inv.maxSlots; i++) {
      const slot = inv.slots[i];
      const div = document.createElement('div');
      div.className = 'inv-slot' + (slot ? '' : ' empty');
      if (slot) {
        const def = ITEMS[slot.id] || {};
        div.innerHTML = `<span class="inv-icon">${def.icon || '?'}</span><span class="inv-count">${slot.count}</span>`;
        div.title = def.name || slot.id;
        const isSeed = slot.id.endsWith('_seed');
        const isBuilding = def.isBuildingItem;
        const isSelected = slot.id === inv._selectedSeedId || slot.id === inv._selectedBuildingId;
        if (isSelected) div.classList.add('selected');
        if (isSeed) {
          div.addEventListener('click', () => {
            inv._selectedBuildingId = null;
            this.game.buildSys?.exitBuildMode();
            inv._selectedSeedId = inv._selectedSeedId === slot.id ? null : slot.id;
            const cropId = slot.id.replace('_seed', '');
            this.game.farmMode.selectedCrop = inv._selectedSeedId ? cropId : null;
            inv.render();
            this.render();
          });
        } else if (isBuilding) {
          div.addEventListener('click', () => {
            inv._selectedSeedId = null;
            this.game.farmMode.selectedCrop = null;
            if (inv._selectedBuildingId === slot.id) {
              inv._selectedBuildingId = null;
              this.game.buildSys?.exitBuildMode();
            } else {
              inv._selectedBuildingId = slot.id;
              this.game.buildSys?.enterBuildMode(slot.id);
              this.game.showDialog(`${def.name}を選択。クリックで設置！`);
            }
            inv.render();
            this.render();
          });
        }
      }
      el.appendChild(div);
    }
  }
}
