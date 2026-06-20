import { ITEMS } from '../data/Items.js';

const CHEST_SIZE = 20;

export class ChestUI {
  constructor(game) {
    this.game = game;
    this._el = document.getElementById('chest-modal');
    this._gx = null;
    this._gz = null;

    const closeBtn = document.getElementById('chest-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
  }

  open(gx, gz) {
    this._gx = gx;
    this._gz = gz;
    if (this._el) this._el.style.display = 'flex';
    this.render();
  }

  close() {
    this._gx = null;
    this._gz = null;
    if (this._el) this._el.style.display = 'none';
  }

  get _isOpen() { return this._gx !== null; }

  _chestSlots() {
    return this.game.buildSys.getChestInventory(this._gx, this._gz);
  }

  _addToChest(itemId, count) {
    const slots = this._chestSlots();
    const def = ITEMS[itemId];
    if (def?.stackable) {
      const s = slots.find(s => s.id === itemId);
      if (s) { s.count = Math.min(def.maxStack || 99, s.count + count); return true; }
    }
    if (slots.length >= CHEST_SIZE) return false;
    slots.push({ id: itemId, count });
    return true;
  }

  _removeFromChest(itemId, count) {
    const slots = this._chestSlots();
    const idx = slots.findIndex(s => s.id === itemId);
    if (idx === -1) return false;
    slots[idx].count -= count;
    if (slots[idx].count <= 0) slots.splice(idx, 1);
    return true;
  }

  render() {
    this._renderChest();
    this._renderPlayer();
  }

  _renderChest() {
    const el = document.getElementById('chest-slots');
    if (!el) return;
    const slots = this._chestSlots();
    el.innerHTML = '';
    for (let i = 0; i < CHEST_SIZE; i++) {
      const slot = slots[i];
      const div = document.createElement('div');
      div.className = 'inv-slot chest-inv-slot' + (slot ? '' : ' empty');
      if (slot) {
        const def = ITEMS[slot.id] || {};
        div.innerHTML = `<span class="inv-icon">${def.icon || '?'}</span><span class="inv-count">${slot.count}</span>`;
        div.title = `${def.name || slot.id} — クリックで取り出す`;
        div.addEventListener('click', () => {
          if (this.game.inventory.add(slot.id, slot.count)) {
            this._removeFromChest(slot.id, slot.count);
          } else {
            this.game.showDialog('インベントリが満杯！');
          }
          this.render();
          this.game.inventory.render();
        });
      }
      el.appendChild(div);
    }
  }

  _renderPlayer() {
    const el = document.getElementById('chest-player-slots');
    if (!el) return;
    const inv = this.game.inventory;
    el.innerHTML = '';
    for (let i = 0; i < inv.maxSlots; i++) {
      const slot = inv.slots[i];
      const div = document.createElement('div');
      div.className = 'inv-slot chest-inv-slot' + (slot ? '' : ' empty');
      if (slot) {
        const def = ITEMS[slot.id] || {};
        div.innerHTML = `<span class="inv-icon">${def.icon || '?'}</span><span class="inv-count">${slot.count}</span>`;
        div.title = `${def.name || slot.id} — クリックで預ける`;
        div.addEventListener('click', () => {
          if (this._addToChest(slot.id, slot.count)) {
            inv.remove(slot.id, slot.count);
          } else {
            this.game.showDialog('チェストが満杯！');
          }
          this.render();
          inv.render();
        });
      }
      el.appendChild(div);
    }
  }
}
