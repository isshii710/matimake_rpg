import * as THREE from 'three';
// postprocessing は動的importで読み込む（失敗してもゲームが止まらない）

import { Grid } from './world/Grid.js';
import { FogOfWar } from './world/FogOfWar.js';
import { Player } from './entities/Player.js';
import { EnemyManager } from './entities/Enemy.js';
import { NPC } from './entities/NPC.js';
import { BuildSystem } from './building/BuildSystem.js';
import { FarmManager } from './farming/FarmPlot.js';
import { Season } from './farming/Season.js';
import { HUD } from './ui/HUD.js';
import { Inventory } from './ui/Inventory.js';
import { BuildMenu } from './ui/BuildMenu.js';
import { DPad } from './ui/DPad.js';
import { QuestManager } from './quest/QuestManager.js';
import { SaveSystem } from './save/SaveSystem.js';
import { BackpackUI } from './ui/BackpackUI.js';
import { ChestUI } from './ui/ChestUI.js';
import { TILE } from './world/TileTypes.js';
import { ResourceManager } from './world/Resources.js';

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// ─── ローディング画面フェイルセーフ ────────────────────────────────────────
// 10秒経っても読み込めなければ強制的に非表示にしてエラー表示
const loadingEl = document.getElementById('loading');
const failsafe = setTimeout(() => {
  if (loadingEl) loadingEl.style.display = 'none';
  const err = document.getElementById('load-error');
  if (err) err.style.display = 'block';
}, 10000);

function hideLoading() {
  clearTimeout(failsafe);
  if (loadingEl) {
    loadingEl.style.transition = 'opacity 0.5s';
    loadingEl.style.opacity = '0';
    setTimeout(() => { loadingEl.style.display = 'none'; }, 500);
  }
}

// ─── Renderer ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isMobile,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !isMobile;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.6;

// ─── Scene ─────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0806);
scene.fog = new THREE.FogExp2(0x100806, isMobile ? 0.010 : 0.013);

// ─── Camera ────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(25, 22, 25);
camera.lookAt(0, 0, 0);

// ─── Postprocessing（失敗してもOK） ────────────────────────────────────────
let composer = null;
async function setupPostProcessing() {
  if (isMobile) return null; // モバイルはskip
  try {
    const pp = await import('postprocessing');
    const c = new pp.EffectComposer(renderer);
    c.addPass(new pp.RenderPass(scene, camera));
    c.addPass(new pp.EffectPass(camera,
      new pp.BloomEffect({ intensity: 2.2, radius: 0.90, luminanceThreshold: 0.15, luminanceSmoothing: 0.05 }),
      new pp.VignetteEffect({ darkness: 0.80, offset: 0.28 }),
    ));
    return c;
  } catch (e) {
    console.warn('Postprocessing unavailable:', e);
    return null;
  }
}

// ─── Lighting ──────────────────────────────────────────────────────────────
function setupLighting() {
  // Warm ambient (dark night-village feel)
  scene.add(new THREE.AmbientLight(0x3a2210, 0.55));
  // Hemisphere: warm sky vs warm-brown ground
  scene.add(new THREE.HemisphereLight(0x5566aa, 0xcc8822, 0.50));

  // Main sun – golden-hour from upper-left
  const sun = new THREE.DirectionalLight(0xffbb66, 1.35);
  sun.position.set(-15, 28, -10);
  if (!isMobile) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { near: 0.5, far: 100, left: -35, right: 35, top: 35, bottom: -35 });
    sun.shadow.bias = -0.0005;
  }
  scene.add(sun);

  // Soft fill from the opposite side
  const fill = new THREE.DirectionalLight(0x6688bb, 0.30);
  fill.position.set(12, 10, 8);
  scene.add(fill);

  // Warm point lights scattered around village
  const pts = isMobile
    ? [[0,1.8,0,0xff8833,2.2,10],[5,1.8,3,0xffaa44,1.8,9],[-5,1.8,-4,0xff9933,1.8,9]]
    : [
        [0,1.8,0,0xff8833,2.4,12],[5,1.8,3,0xffaa44,2.0,10],
        [-5,1.8,3,0xff9933,2.0,10],[4,1.8,-5,0xffcc55,1.8,9],
        [-4,1.8,-5,0xffaa33,1.8,9],[7,1.8,0,0xff9944,1.6,8],
        [-7,1.8,0,0xff8822,1.6,8],[0,1.8,7,0xffbb44,1.8,9],
        [3,1.8,-2,0xff7733,1.4,7],[-3,1.8,2,0xffaa55,1.4,7],
      ];
  for (const [x, y, z, col, intensity, dist] of pts) {
    const pl = new THREE.PointLight(col, intensity, dist);
    pl.position.set(x, y, z);
    scene.add(pl);
  }
}
setupLighting();

// ─── Game state ────────────────────────────────────────────────────────────
const game = {
  scene, camera, renderer, composer,
  farmMode: { selectedCrop: null },
  showDialog(text) { this.hud?.showDialog(text); },
};

// ─── Input ─────────────────────────────────────────────────────────────────
const keys = {};
const prevKeys = {};
document.addEventListener('keydown', e => {
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ─── 初期化 ────────────────────────────────────────────────────────────────
async function init() {
  try {
    game.grid     = new Grid(scene);
    game.fogOfWar = new FogOfWar(scene, isMobile);
    game.season   = new Season();
    game.buildSys = new BuildSystem(scene, game.grid, game);
    game.farmMgr  = new FarmManager(scene, game.grid, game);
    game.questMgr = new QuestManager(game);
    game.inventory = new Inventory(game);
    game.player   = new Player(scene, game.grid, game);
    game.enemyMgr = new EnemyManager(scene, game.grid, game);
    game.hud      = new HUD(game);
    game.buildMenu = new BuildMenu(game);
    game.dpad     = new DPad();

    game.npcs = [
      new NPC(scene, 'elder',  '村長', 0x8B4513, 33, 31, game.grid),
      new NPC(scene, 'farmer', '農夫', 0x2D5A27, 30, 34, game.grid),
    ];

    game.resMgr     = new ResourceManager(scene, game.grid, game);
    game.saveSys    = new SaveSystem(game);
    game.backpackUI = new BackpackUI(game);
    game.chestUI    = new ChestUI(game);

    document.getElementById('save-btn')?.addEventListener('click', () => game.saveSys.save());
    document.getElementById('bag-btn')?.addEventListener('click', () => {
      game.chestUI?.close();
      game.backpackUI.toggle();
    });

    // Try to load a saved game; otherwise place starter buildings
    const hadSave = game.saveSys.hasSave();
    if (hadSave) {
      game.saveSys.load();
    } else {
      placeStarterBuildings();
      game.resMgr.generate();
    }

    // postprocessingは非同期で（失敗してもゲームは動く）
    composer = await setupPostProcessing();
    game.composer = composer;

    hideLoading();
    const welcomeMsg = hadSave
      ? 'セーブデータを読み込みました！Sキーでセーブ・Iキーでバッグ'
      : 'ようこそ！WASDで移動・SPACEで攻撃・Bで建設・Eで調べる・Sでセーブ';
    setTimeout(() => game.showDialog(welcomeMsg), 600);
    requestAnimationFrame(loop);

  } catch (err) {
    console.error('Init error:', err);
    hideLoading();
    const errEl = document.getElementById('load-error');
    if (errEl) {
      errEl.textContent = `エラー: ${err.message}`;
      errEl.style.display = 'block';
    }
  }
}

function placeStarterBuildings() {
  game.buildSys.placeFromSave('campfire', 32, 33, 0, 0);
  game.buildSys.placeFromSave('well',     30, 30, 0, 0);
  game.buildSys.placeFromSave('lantern',  35, 30, 0, 0);
  game.buildSys.placeFromSave('lantern',  29, 35, 0, 0);
  game.inventory.add('wood', 10);
  game.inventory.add('stone', 7);
  game.inventory.add('iron', 3);
  game.inventory.add('cloth', 2);
}

// ─── Camera follow ─────────────────────────────────────────────────────────
const CAM_OFFSET = new THREE.Vector3(25, 22, 25);
const camTarget  = new THREE.Vector3();
const camLookAt  = new THREE.Vector3();

function updateCamera() {
  camTarget.copy(game.player.position).add(CAM_OFFSET);
  camera.position.lerp(camTarget, 0.07);
  camLookAt.lerp(game.player.position, 0.07);
  camera.lookAt(camLookAt);
}

// ─── Click interaction ─────────────────────────────────────────────────────
const raycaster   = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

canvas.addEventListener('click', onCanvasClick);
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (game.dpad?.isDragging) return;
  const t = e.changedTouches[0];
  onCanvasClick({ clientX: t.clientX, clientY: t.clientY });
}, { passive: false });

function onCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera({ x, y }, camera);
  const pt = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(groundPlane, pt)) return;

  const { gx, gz } = game.grid.worldToGrid(pt.x, pt.z);

  if (game.buildSys.demolishMode) { game.buildSys.demolish(gx, gz); return; }
  if (game.buildSys.mode) { game.buildSys.place(game.buildSys._ghostGx, game.buildSys._ghostGz); return; }

  const plot = game.farmMgr.getPlot(gx, gz);
  if (plot) {
    if (plot.state === 'ready') { game.farmMgr.harvest(gx, gz); }
    else if (plot.state === 'empty' && game.farmMode.selectedCrop) { game.farmMgr.plant(gx, gz, game.farmMode.selectedCrop); }
    else if ((plot.state === 'planted' || plot.state === 'growing') && game.inventory.has('water_bucket', 1)) {
      game.farmMgr.water(gx, gz);
      game.showDialog('水やり完了！水バケツを使った（井戸でまた汲める）');
    }
    else if (plot.state === 'planted' || plot.state === 'growing') {
      game.showDialog(`成長中 (${plot.growthStage + 1}/4)... 水やりで加速！井戸でEを押して水を汲もう`);
    }
    else { game.showDialog(`成長中... ステージ ${plot.growthStage + 1}/4`); }
    return;
  }

  const tile = game.grid.getTile(gx, gz);
  if (tile === TILE.GRASS || tile === TILE.DIRT) {
    const dist = Math.hypot(game.player.position.x - pt.x, game.player.position.z - pt.z);
    if (dist < 3) { game.farmMgr.till(gx, gz) && game.showDialog('土を耕した！種を選んでクリック！'); }
    else { game.showDialog('もっと近づいてから！'); }
    return;
  }

  const building = game.buildSys.getBuilding(gx, gz);
  if (building?.def?.isWell) { game.inventory.add('water_bucket', 1); game.showDialog('水バケツを汲んだ！'); return; }
  if (building?.def?.isChest) {
    const dist = Math.hypot(game.player.position.x - pt.x, game.player.position.z - pt.z);
    if (dist < 3) { game.chestUI.open(building.gx, building.gz); return; }
    else { game.showDialog('もっと近づいてから！'); return; }
  }

  for (const npc of game.npcs) {
    const ng = game.grid.worldToGrid(npc.position.x, npc.position.z);
    if (Math.abs(ng.gx - gx) <= 1 && Math.abs(ng.gz - gz) <= 1) { npc.interact(game); return; }
  }
}

// ─── Shortcuts ─────────────────────────────────────────────────────────────
function handleShortcuts() {
  if (keys['KeyB'] && !prevKeys['KeyB']) game.buildMenu.toggle();
  if (keys['KeyE'] && !prevKeys['KeyE']) interactNearby();
  if (keys['KeyI'] && !prevKeys['KeyI']) {
    game.chestUI?.close();
    game.backpackUI.toggle();
  }
  if (keys['KeyS'] && !prevKeys['KeyS']) {
    if (!game.buildSys.mode && !game.buildSys.demolishMode) game.saveSys.save();
  }
  if (keys['KeyR'] && !prevKeys['KeyR']) {
    if (game.buildSys.mode) game.buildSys.rotate();
  }
  if (keys['KeyD'] && !prevKeys['KeyD']) {
    if (game.buildSys.demolishMode) game.buildSys.exitBuildMode();
    else game.buildSys.enterDemolishMode();
  }
  if (keys['Escape'] && !prevKeys['Escape']) {
    if (game.chestUI?._isOpen) { game.chestUI.close(); }
    else if (game.backpackUI?._open) { game.backpackUI.close(); }
    else if (game.buildSys.mode || game.buildSys.demolishMode) game.buildMenu.exitBuildMode();
    else {
      game.farmMode.selectedCrop = null;
      game.inventory._selectedSeedId = null;
      game.inventory._selectedBuildingId = null;
      game.inventory._selectedToolId = null;
      game.inventory.render();
    }
  }
  Object.assign(prevKeys, keys);
}

function interactNearby() {
  for (const npc of game.npcs) {
    if (game.player.position.distanceTo(npc.position) < 2.5) { npc.interact(game); return; }
  }
  const gx = game.player.gx, gz = game.player.gz;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const b = game.buildSys.getBuilding(gx + dx, gz + dz);
    if (b?.def?.isWell) { game.inventory.add('water_bucket', 1); game.showDialog('水バケツを汲んだ！💧'); return; }
    if (b?.def?.isChest) { game.chestUI.open(b.gx, b.gz); return; }
    const plot = game.farmMgr.getPlot(gx + dx, gz + dz);
    if (plot?.state === 'ready') { game.farmMgr.harvest(gx + dx, gz + dz); return; }
    if ((plot?.state === 'planted' || plot?.state === 'growing') && game.inventory.has('water_bucket', 1)) { game.farmMgr.water(gx + dx, gz + dz); return; }
  }
  game.showDialog('近くに調べるものがない...');
}

// ─── Game loop ─────────────────────────────────────────────────────────────
let lastTime = 0;
function loop(time) {
  requestAnimationFrame(loop);
  const delta = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  handleShortcuts();
  game.saveSys.update(delta);
  game.season.update(delta);
  game.player.update(delta, keys, game.dpad);
  game.enemyMgr.update(delta);
  game.farmMgr.update(delta);
  game.fogOfWar.update(time / 1000);
  game.resMgr?.update(delta);
  game.buildSys.update(camera);
  for (const npc of game.npcs) npc.update(delta);
  game.hud.update(delta);
  game.hud.updateQuests(game.questMgr.active);
  updateCamera();

  if (composer) composer.render(delta);
  else renderer.render(scene, camera);
}

// ─── Resize ────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer?.setSize(window.innerWidth, window.innerHeight);
});

// ─── Start ─────────────────────────────────────────────────────────────────
init();
