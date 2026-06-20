export const TILE = {
  GRASS: 0,
  DIRT: 1,
  STONE: 2,
  WATER: 3,
  TILLED: 4,
  PATH: 5,
  DANGER_GRASS: 6,
  MOUNTAIN: 7,
  SAND: 8,
};

export const TILE_COLOR = {
  [TILE.GRASS]: 0x4a7c3f,
  [TILE.DIRT]: 0x7a5520,
  [TILE.STONE]: 0x888880,
  [TILE.WATER]: 0x2255aa,
  [TILE.TILLED]: 0x3a2010,
  [TILE.PATH]: 0x9a8060,
  [TILE.DANGER_GRASS]: 0x2a3018,
  [TILE.MOUNTAIN]: 0x5a5550,
  [TILE.SAND]: 0xc8b068,
};

export const TILE_Y = {
  [TILE.GRASS]: 0,
  [TILE.DIRT]: 0,
  [TILE.STONE]: 0.02,
  [TILE.WATER]: -0.1,
  [TILE.TILLED]: 0,
  [TILE.PATH]: 0.01,
  [TILE.DANGER_GRASS]: 0,
  [TILE.MOUNTAIN]: 0.14,
  [TILE.SAND]: -0.03,
};

export const TILE_WALKABLE = {
  [TILE.GRASS]: true,
  [TILE.DIRT]: true,
  [TILE.STONE]: true,
  [TILE.WATER]: false,
  [TILE.TILLED]: true,
  [TILE.PATH]: true,
  [TILE.DANGER_GRASS]: true,
  [TILE.MOUNTAIN]: false,
  [TILE.SAND]: true,
};

export const TILE_LABEL = {
  [TILE.GRASS]: '草地',
  [TILE.DIRT]: '土',
  [TILE.STONE]: '岩場',
  [TILE.WATER]: '水',
  [TILE.TILLED]: '耕地',
  [TILE.PATH]: '小道',
  [TILE.DANGER_GRASS]: '荒野',
  [TILE.MOUNTAIN]: '山',
  [TILE.SAND]: '砂浜',
};
