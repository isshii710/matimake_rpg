// Places pre-built settlements and shops across the map.
// buildWorld() is called on a fresh game (no save).
// registerShops() registers shop locations for shop interaction,
// must be called on both fresh game AND after loading a save.

export function buildWorld(game) {
  registerShops(game);
  _buildMainVillage(game);
  _buildNorthVillage(game);
  _buildSouthVillage(game);
  _buildForestOutpost(game);
}

export function registerShops(game) {
  if (!game.shopMgr) return;
  const g = game;
  // Main village shops
  _registerShop(g, 36, 32, '道具屋', [
    { id: 'axe',     price: 80 },
    { id: 'pickaxe', price: 100 },
    { id: 'water_bucket', price: 20 },
  ]);
  _registerShop(g, 29, 29, '家具屋', [
    { id: 'table',  price: 40 },
    { id: 'bed',    price: 60 },
    { id: 'chest',  price: 50 },
    { id: 'lantern', price: 30 },
  ]);
  // North village
  _registerShop(g, 22, 15, '武器屋', [
    { id: 'iron', price: 15 },
    { id: 'cloth', price: 10 },
    { id: 'leather', price: 12 },
  ]);
  // South village
  _registerShop(g, 44, 46, '防具屋', [
    { id: 'leather', price: 12 },
    { id: 'cloth', price: 8 },
    { id: 'iron', price: 15 },
  ]);
}

function _registerShop(game, gx, gz, name, items) {
  game.shopMgr.registerShop(gx, gz, name, items);
}

// ── Main village (around player start, grid center ~32,32) ────────────────

function _buildMainVillage(game) {
  const bs = game.buildSys;
  // Starter campfire / well already placed by placeStarterBuildings()

  // House 1: elder's house (NE of center)
  _placeHouse(game, 35, 27, 'wood');

  // House 2: farmer's house (SW)
  _placeHouse(game, 28, 36, 'wood');

  // Tool shop
  _placeShop(game, 36, 32, '道具屋', [
    { id: 'axe',     price: 80 },
    { id: 'pickaxe', price: 100 },
    { id: 'water_bucket', price: 20 },
  ]);

  // Furniture shop
  _placeShop(game, 29, 29, '家具屋', [
    { id: 'table',  price: 40 },
    { id: 'bed',    price: 60 },
    { id: 'chest',  price: 50 },
    { id: 'lantern', price: 30 },
  ]);
}

// ── North village (grid ~32, 10) ──────────────────────────────────────────

function _buildNorthVillage(game) {
  const cx = 22, cz = 12;
  game.buildSys.placeFromSave('campfire', cx, cz, 0, 0);
  game.buildSys.placeFromSave('well', cx + 2, cz - 1, 0, 0);

  _placeHouse(game, cx + 4, cz - 2, 'stone');
  _placeHouse(game, cx - 4, cz + 1, 'wood');

  // Weapon shop
  _placeShop(game, cx, cz + 3, '武器屋', [
    { id: 'iron', price: 15 },
    { id: 'cloth', price: 10 },
    { id: 'leather', price: 12 },
  ]);

  // Quests for this village are defined in QuestManager
}

// ── South village (grid ~42, 52) ──────────────────────────────────────────

function _buildSouthVillage(game) {
  const cx = 44, cz = 50;
  game.buildSys.placeFromSave('campfire', cx, cz, 0, 0);
  game.buildSys.placeFromSave('well', cx - 2, cz + 2, 0, 0);

  _placeHouse(game, cx + 3, cz - 3, 'stone');
  _placeHouse(game, cx - 3, cz + 3, 'wood');
  _placeHouse(game, cx + 5, cz + 2, 'wood');

  // Armor shop
  _placeShop(game, cx, cz - 4, '防具屋', [
    { id: 'leather', price: 12 },
    { id: 'cloth', price: 8 },
    { id: 'iron', price: 15 },
  ]);
}

// ── Forest outpost (grid ~15, 40) ─────────────────────────────────────────

function _buildForestOutpost(game) {
  const cx = 14, cz = 42;
  game.buildSys.placeFromSave('campfire', cx, cz, 0, 0);
  game.buildSys.placeFromSave('lantern', cx + 2, cz - 1, 0, 0);
  game.buildSys.placeFromSave('lantern', cx - 2, cz + 1, 0, 0);

  _placeHouse(game, cx - 2, cz - 3, 'wood');
}

// ── Helpers ───────────────────────────────────────────────────────────────

function _placeHouse(game, cx, cz, mat) {
  const bs = game.buildSys;
  const wallId  = mat === 'stone' ? 'stone_wall' : 'wood_wall';
  const floorId = mat === 'stone' ? 'stone_floor' : 'wood_floor';
  const roofId  = 'roof';

  // 3x3 floor
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      bs.placeFromSave(floorId, cx + dx, cz + dz, 0, 0);
    }
  }

  // North wall (z = cz-2)  – 3 wall segments across x
  bs.placeFromSave(wallId, cx - 1, cz - 2, 1, 0);
  bs.placeFromSave(wallId, cx,     cz - 2, 1, 0);
  bs.placeFromSave(wallId, cx + 1, cz - 2, 1, 0);

  // South wall (z = cz+2) with door in middle
  bs.placeFromSave(wallId, cx - 1, cz + 2, 1, 0);
  bs.placeFromSave('door',  cx,     cz + 2, 1, 0);
  bs.placeFromSave(wallId, cx + 1, cz + 2, 1, 0);

  // West wall (x = cx-2)
  bs.placeFromSave(wallId, cx - 2, cz - 1, 1, 1);
  bs.placeFromSave(wallId, cx - 2, cz,     1, 1);
  bs.placeFromSave(wallId, cx - 2, cz + 1, 1, 1);

  // East wall (x = cx+2)
  bs.placeFromSave(wallId, cx + 2, cz - 1, 1, 1);
  bs.placeFromSave(wallId, cx + 2, cz,     1, 1);
  bs.placeFromSave(wallId, cx + 2, cz + 1, 1, 1);

  // Roof tiles
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      bs.placeFromSave(roofId, cx + dx, cz + dz, 2, 0);
    }
  }
  // Extra roof overhang
  bs.placeFromSave(roofId, cx - 2, cz, 2, 0);
  bs.placeFromSave(roofId, cx + 2, cz, 2, 0);
  bs.placeFromSave(roofId, cx, cz - 2, 2, 0);

  // Lantern inside
  bs.placeFromSave('lantern', cx - 1, cz - 1, 0, 0);
}

function _placeShop(game, cx, cz, _name, _items) {
  // Visual markers for the shop location
  game.buildSys.placeFromSave('campfire', cx, cz - 1, 0, 0);
  game.buildSys.placeFromSave('lantern',  cx, cz + 1, 0, 0);
  // Shop registration is handled by registerShops() which is called separately
}
