export const QUESTS = [
  {
    id: 'build_house',
    title: '最初の家を建てよう',
    description: '壁×4・床×2・屋根×1を設置して家を作ろう。',
    category: '建設',
    objectives: [
      { id: 'walls', text: '壁を設置する', type: 'build', target: ['wood_wall', 'stone_wall'], count: 4, current: 0 },
      { id: 'floors', text: '床を設置する', type: 'build', target: ['wood_floor', 'stone_floor'], count: 2, current: 0 },
      { id: 'roofs', text: '屋根を設置する', type: 'build', target: ['roof'], count: 1, current: 0 },
    ],
    reward: { wood: 5, stone: 3 },
    rewardText: '木材×5・石材×3',
  },
  {
    id: 'build_campfire',
    title: '暖を取ろう',
    description: '焚き火を設置して集落を温かくしよう。',
    category: '建設',
    objectives: [
      { id: 'fire', text: '焚き火を設置する', type: 'build', target: ['campfire'], count: 1, current: 0 },
    ],
    reward: { stone: 3 },
    rewardText: '石材×3',
  },
  {
    id: 'make_farm',
    title: '畑を作ろう',
    description: '土を耕して畑タイルを4マス作ろう。',
    category: '農業',
    objectives: [
      { id: 'plots', text: '畑を耕す', type: 'till', count: 4, current: 0 },
    ],
    reward: { wheat_seed: 5, pumpkin_seed: 2 },
    rewardText: '麦の種×5・カボチャの種×2',
  },
  {
    id: 'first_harvest',
    title: '最初の収穫',
    description: '麦を3本収穫しよう。',
    category: '農業',
    objectives: [
      { id: 'harvest', text: '麦を収穫する', type: 'harvest', target: 'wheat', count: 3, current: 0 },
    ],
    reward: { herb_seed: 3, stone: 2 },
    rewardText: 'ハーブの種×3・石材×2',
  },
  {
    id: 'explore_danger',
    title: '外を調べろ',
    description: '集落の外の危険エリアに踏み込もう。',
    category: '探索',
    objectives: [
      { id: 'enter_danger', text: '危険エリアに入る', type: 'enter_danger', count: 1, current: 0 },
    ],
    reward: { iron: 2 },
    rewardText: '鉄くず×2',
  },
  {
    id: 'slay_slimes',
    title: 'スライム討伐',
    description: 'スライムを3体倒そう。',
    category: '戦闘',
    objectives: [
      { id: 'kills', text: 'スライムを倒す', type: 'kill', target: 'slime', count: 3, current: 0 },
    ],
    reward: { leather: 3, stone: 2 },
    rewardText: '革×3・石材×2',
  },
];
