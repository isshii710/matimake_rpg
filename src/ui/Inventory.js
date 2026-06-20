import { ITEMS } from '../data/Items.js';

export class Inventory {
  constructor(game) {
    this.game = game;
    this.slots = [];      // [{ id, count }]
    this.maxSlots = 20;
    this.selectedSlot = 0;

    this._el = document.getElementById('inventory');
    this._selectedSeedId = null;
    this._selectedBuildingId = null;
    this._selectedToolId = null;

    // Start with some basic resources
    this.add('wood', 10);
    this.add('stone', 8);
    this.add('wheat_seed', 5);
    this.add('pumpkin_seed', 3);
    this.add('herb_seed', 3);
    this.add('water_bucket', 3);

    this.render();
  }

  add(itemId, count = 1) {
    const def = ITEMS[itemId];
    if (!def) return false;

    if (def.stackable) {
      const slot = this.slots.find(s => s.id === itemId);
      if (slot) {
        slot.count = Math.min((def.maxStack || 99), slot.count + count);
        this.render();
        return true;
      }
    }

    if (this.slots.length >= this.maxSlots) return false;
    this.slots.push({ id: itemId, count });
    this.render();
    return true;
  }

  remove(itemId, count = 1) {
    const idx = this.slots.findIndex(s => s.id === itemId);
    if (idx === -1) return false;
    this.slots[idx].count -= count;
    if (this.slots[idx].count <= 0) {
      this.slots.splice(idx, 1);
      if (this._selectedBuildingId === itemId) {
        this._selectedBuildingId = null;
        this.game.buildSys?.exitBuildMode();
      }
    }
    this.render();
    return true;
  }

  has(itemId, count = 1) {
    const slot = this.slots.find(s => s.id === itemId);
    return slot && slot.count >= count;
  }

  getCount(itemId) {
    const slot = this.slots.find(s => s.id === itemId);
    return slot ? slot.count : 0;
  }

  getSelectedSeed() {
    return this._selectedSeedId;
  }

  render() {
    if (!this._el) return;
    const display = this.slots.slice(0, 8);

    this._el.innerHTML = display.map((slot, i) => {
      const def = ITEMS[slot.id] || {};
      const isSelected = slot.id === this._selectedSeedId || slot.id === this._selectedBuildingId || slot.id === this._selectedToolId;
      return `<div class="inv-slot ${isSelected ? 'selected' : ''}" data-idx="${i}" title="${def.name || slot.id}">
        <span class="inv-icon">${def.icon || '?'}</span>
        <span class="inv-count">${slot.count}</span>
      </div>`;
    }).join('');

    // Add empty slots to fill to 8
    for (let i = display.length; i < 8; i++) {
      this._el.innerHTML += `<div class="inv-slot empty"></div>`;
    }

    // Click handlers
    this._el.querySelectorAll('.inv-slot:not(.empty)').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        const slot = this.slots[idx];
        if (!slot) return;
        const def = ITEMS[slot.id] || {};

        if (slot.id.endsWith('_seed')) {
          this._selectedBuildingId = null;
          this._selectedToolId = null;
          this.game.buildSys?.exitBuildMode();
          this._selectedSeedId = this._selectedSeedId === slot.id ? null : slot.id;
          const cropId = slot.id.replace('_seed', '');
          this.game.farmMode.selectedCrop = this._selectedSeedId ? cropId : null;
          this.render();
          if (this._selectedSeedId) {
            this.game.showDialog(`${def.name || slot.id}を選択。畑をクリックして植えよう！`);
          }
        } else if (def.isTool) {
          this._selectedSeedId = null;
          this._selectedBuildingId = null;
          this.game.farmMode.selectedCrop = null;
          this.game.buildSys?.exitBuildMode();
          if (this._selectedToolId === slot.id) {
            this._selectedToolId = null;
            this.game.showDialog('道具を外した');
          } else {
            this._selectedToolId = slot.id;
            this.game.showDialog(`${def.name}を装備！SPACEで使用`);
          }
          this.render();
        } else if (def.isBuildingItem) {
          this._selectedSeedId = null;
          this._selectedToolId = null;
          this.game.farmMode.selectedCrop = null;
          if (this._selectedBuildingId === slot.id) {
            this._selectedBuildingId = null;
            this.game.buildSys?.exitBuildMode();
          } else {
            this._selectedBuildingId = slot.id;
            this.game.buildSys?.enterBuildMode(slot.id);
            this.game.showDialog(`${def.name}を選択。クリックで設置！`);
          }
          this.render();
        }
      });
    });
  }
}
