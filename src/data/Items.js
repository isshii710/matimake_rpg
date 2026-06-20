export const ITEMS = {
  wood:         { id: 'wood',         name: '木材',       icon: '🪵', stackable: true,  maxStack: 99 },
  stone:        { id: 'stone',        name: '石材',       icon: '🪨', stackable: true,  maxStack: 99 },
  iron:         { id: 'iron',         name: '鉄くず',     icon: '⚙️',  stackable: true,  maxStack: 99 },
  leather:      { id: 'leather',      name: '革',         icon: '🫀', stackable: true,  maxStack: 99 },
  cloth:        { id: 'cloth',        name: '布',         icon: '🧵', stackable: true,  maxStack: 99 },
  wheat:        { id: 'wheat',        name: '麦',         icon: '🌾', stackable: true,  maxStack: 99 },
  pumpkin:      { id: 'pumpkin',      name: 'カボチャ',   icon: '🎃', stackable: true,  maxStack: 99 },
  herb:         { id: 'herb',         name: 'ハーブ',     icon: '🌿', stackable: true,  maxStack: 99 },
  wheat_seed:   { id: 'wheat_seed',   name: '麦の種',     icon: '🌱', stackable: true,  maxStack: 99 },
  pumpkin_seed: { id: 'pumpkin_seed', name: 'カボチャの種', icon: '🌱', stackable: true, maxStack: 99 },
  herb_seed:    { id: 'herb_seed',    name: 'ハーブの種', icon: '🌱', stackable: true,  maxStack: 99 },
  water_bucket: { id: 'water_bucket', name: '水バケツ',   icon: '🪣', stackable: true,  maxStack: 5  },

  // ── 道具 ────────────────────────────────────────────────────────────────
  axe:     { id: 'axe',     name: '斧',       icon: '🪓', stackable: false, maxStack: 1, isTool: true, toolType: 'axe' },
  pickaxe: { id: 'pickaxe', name: 'つるはし', icon: '⛏️',  stackable: false, maxStack: 1, isTool: true, toolType: 'pickaxe' },

  // ── 建築アイテム（クラフトしてインベントリに入る） ──────────────────────
  wood_wall:   { id: 'wood_wall',   name: '木の壁',   icon: '🧱', stackable: true, maxStack: 20, isBuildingItem: true },
  stone_wall:  { id: 'stone_wall',  name: '石の壁',   icon: '🪨', stackable: true, maxStack: 20, isBuildingItem: true },
  wood_floor:  { id: 'wood_floor',  name: '木の床',   icon: '🟤', stackable: true, maxStack: 20, isBuildingItem: true },
  stone_floor: { id: 'stone_floor', name: '石畳',     icon: '⬜', stackable: true, maxStack: 20, isBuildingItem: true },
  roof:        { id: 'roof',        name: '三角屋根', icon: '🔺', stackable: true, maxStack: 20, isBuildingItem: true },
  flat_roof:   { id: 'flat_roof',   name: '平らな屋根板', icon: '🟦', stackable: true, maxStack: 20, isBuildingItem: true },
  door:        { id: 'door',        name: 'ドア',     icon: '🚪', stackable: true, maxStack: 20, isBuildingItem: true },
  campfire:    { id: 'campfire',    name: '焚き火',   icon: '🔥', stackable: true, maxStack: 10, isBuildingItem: true },
  lantern:     { id: 'lantern',     name: 'ランタン', icon: '🏮', stackable: true, maxStack: 10, isBuildingItem: true },
  table:       { id: 'table',       name: 'テーブル', icon: '🪑', stackable: true, maxStack: 10, isBuildingItem: true },
  bed:         { id: 'bed',         name: 'ベッド',   icon: '🛏', stackable: true, maxStack: 5,  isBuildingItem: true },
  well:        { id: 'well',        name: '井戸',     icon: '💧', stackable: true, maxStack: 5,  isBuildingItem: true },
  chest:       { id: 'chest',       name: 'チェスト', icon: '📦', stackable: true, maxStack: 10, isBuildingItem: true },
};
