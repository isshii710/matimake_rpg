import { ITEMS } from '../data/Items.js';

export class ShopManager {
  constructor(game) {
    this.game = game;
    this._shops = new Map(); // `${gx},${gz}` -> { name, items }
    this._el = null;
    this._open = false;
    this._currentShop = null;
    this._buildEl();
  }

  registerShop(gx, gz, name, items) {
    this._shops.set(`${gx},${gz}`, { name, items });
    // Also register in a radius so player can find it nearby
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${gx + dx},${gz + dz}`;
        if (!this._shops.has(key)) this._shops.set(key, { name, items });
      }
    }
  }

  getShopAt(gx, gz) {
    return this._shops.get(`${gx},${gz}`) || null;
  }

  open(shop) {
    // Dungeon entrance triggers boss fight, not a shop UI
    if (shop.name.includes('ダンジョン')) {
      this.game.showDialog('ダンジョン入口... 危険な気配がする！\n（ドラゴンが待ち受けている）');
      this.game.enemyMgr?.spawnBoss();
      return;
    }
    this._currentShop = shop;
    this._open = true;
    this._render();
    if (this._el) this._el.style.display = 'flex';
  }

  close() {
    this._open = false;
    this._currentShop = null;
    if (this._el) this._el.style.display = 'none';
  }

  get isOpen() { return this._open; }

  _buildEl() {
    this._el = document.createElement('div');
    this._el.id = 'shop-modal';
    this._el.style.cssText = `
      display:none; position:fixed; top:50%; left:50%;
      transform:translate(-50%,-50%);
      width:min(420px,94vw); max-height:80vh;
      background:rgba(10,6,2,0.97); border:1px solid #8B6914;
      border-radius:8px; padding:14px; z-index:30;
      pointer-events:auto; flex-direction:column; gap:10px;
      box-shadow:0 8px 32px rgba(0,0,0,0.9); overflow-y:auto;
      font-family:'Segoe UI','Hiragino Kaku Gothic ProN',sans-serif;
    `;
    this._el.innerHTML = `
      <div id="shop-title" style="color:#d4a540;font-size:14px;font-weight:bold;text-align:center;border-bottom:1px solid #4a3010;padding-bottom:6px;"></div>
      <div style="color:#a08040;font-size:11px;text-align:center;">所持ゴールド: <span id="shop-gold" style="color:#ffcc44;">0</span>G</div>
      <div id="shop-list" style="display:flex;flex-direction:column;gap:5px;"></div>
      <div style="font-size:10px;color:#605040;text-align:center;">Eまたは閉じるボタンで退出</div>
      <button id="shop-close" style="background:rgba(40,24,8,0.9);border:1px solid #6B4F14;border-radius:4px;color:#a08040;padding:5px;cursor:pointer;font-size:12px;font-family:inherit;">閉じる [Esc]</button>
    `;
    document.body.appendChild(this._el);
    this._el.querySelector('#shop-close').addEventListener('click', () => this.close());
  }

  _render() {
    if (!this._currentShop) return;
    const shop = this._currentShop;
    const inv = this.game.inventory;
    const gold = inv.getCount('gold');

    const titleEl = this._el.querySelector('#shop-title');
    if (titleEl) titleEl.textContent = `🏪 ${shop.name}`;

    const goldEl = this._el.querySelector('#shop-gold');
    if (goldEl) goldEl.textContent = gold;

    const list = this._el.querySelector('#shop-list');
    if (!list) return;
    list.innerHTML = '';

    for (const entry of shop.items) {
      const def = ITEMS[entry.id];
      if (!def) continue;
      const canAfford = gold >= entry.price;
      const div = document.createElement('div');
      div.style.cssText = `
        background:rgba(20,12,4,0.8); border:1px solid ${canAfford ? '#3a2808' : '#2a1a04'};
        border-radius:4px; padding:8px 10px; display:flex;
        align-items:center; gap:10px; opacity:${canAfford ? 1 : 0.55};
        cursor:${canAfford ? 'pointer' : 'default'};
      `;
      div.innerHTML = `
        <span style="font-size:22px;">${def.icon || '?'}</span>
        <div style="flex:1;">
          <div style="font-size:13px;color:#f0d890;">${def.name}</div>
          <div style="font-size:10px;color:#a09060;">所持: ${inv.getCount(entry.id)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:13px;color:#ffcc44;">${entry.price}G</div>
          <div style="font-size:10px;color:#60aa60;">購入</div>
        </div>
      `;
      if (canAfford) {
        div.addEventListener('click', () => {
          if (inv.getCount('gold') >= entry.price) {
            inv.remove('gold', entry.price);
            inv.add(entry.id, 1);
            this.game.showDialog(`${def.name}を購入！`);
            this._render();
          }
        });
      }
      list.appendChild(div);
    }

    // Sell section – sell items for half price
    const sellHeader = document.createElement('div');
    sellHeader.style.cssText = 'color:#a08040;font-size:11px;margin-top:6px;padding-top:6px;border-top:1px solid #2a1a04;';
    sellHeader.textContent = '── 売却（購入価格の50%）';
    list.appendChild(sellHeader);

    const sellable = [
      { id: 'wood', price: 3 }, { id: 'stone', price: 3 },
      { id: 'iron', price: 8 }, { id: 'leather', price: 6 },
      { id: 'cloth', price: 5 }, { id: 'wheat', price: 4 },
      { id: 'pumpkin', price: 6 }, { id: 'herb', price: 5 },
    ];
    for (const entry of sellable) {
      const def = ITEMS[entry.id];
      const count = inv.getCount(entry.id);
      if (!def || count <= 0) continue;
      const div = document.createElement('div');
      div.style.cssText = `
        background:rgba(12,20,8,0.7); border:1px solid #1a3010;
        border-radius:4px; padding:6px 10px; display:flex;
        align-items:center; gap:10px; cursor:pointer;
      `;
      div.innerHTML = `
        <span style="font-size:20px;">${def.icon || '?'}</span>
        <div style="flex:1;"><div style="font-size:12px;color:#d0e8b0;">${def.name}</div>
        <div style="font-size:10px;color:#608040;">所持: ${count}</div></div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:#88cc44;">${entry.price}G</div>
          <div style="font-size:10px;color:#608040;">売却×1</div>
        </div>
      `;
      div.addEventListener('click', () => {
        if (inv.has(entry.id, 1)) {
          inv.remove(entry.id, 1);
          inv.add('gold', entry.price);
          this.game.showDialog(`${def.name}を${entry.price}Gで売却！`);
          this._render();
        }
      });
      list.appendChild(div);
    }
  }
}
