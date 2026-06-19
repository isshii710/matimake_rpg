import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass,
  BloomEffect, VignetteEffect,
} from 'postprocessing';

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
import { TILE } from './world/TileTypes.js';

// ─── Renderer ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.3;

// ─── Scene ─────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060302);
scene.fog = new THREE.FogExp2(0x060302, 0.016);

// ─── Camera ────────────────────────────────────────────────────────────────
// Low FOV (25°) creates a quasi-orthographic look similar to HD-2D style
const camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(25, 22, 25);
camera.lookAt(0, 0, 0);

// ─── Post-processing ───────────────────────────────────────────────────────
let composer = null;
try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    intensity: 1.6,
    radius: 0.85,
    luminanceThreshold: 0.18,
    luminanceSmoothing: 0.03,
  });

  const vignette = new VignetteEffect({ darkness: 0.72, offset: 0.32 });

  composer.addPass(new EffectPass(camera, bloom, vignette));
} catch (err) {
  console.warn('Postprocessing unavailable, using basic renderer:', err);
}

// ─── Lighting ──────────────────────────────────────────────────────────────
function setupLighting() {
  scene.add(new THREE.AmbientLight(0x553322, 0.55));
  scene.add(new THREE.HemisphereLight(0x4466aa, 0xcc8833, 0.45));

  const sun = new THREE.DirectionalLight(0xff9966, 0.9);
  sun.position.set(-12, 22, -8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { near: 0.5, far: 80, left: -30, right: 30, top: 30, bottom: -30 });
  scene.add(sun);

  // Village centre lantern lights
  const warmPos = [[0,2,0],[5,2,3],[-5,2,3],[4,2,-5],[-4,2,-5],[7,2,0],[-7,2,0],[0,2,7]];
  for (const [x, y, z] of warmPos) {
    const pl = new THREE.PointLight(0xff9944, 1.8, 11);
    pl.position.set(x, y, z);
    scene.add(pl);
  }
}
setupLighting();

// ─── Game state ────────────────────────────────────────────────────────────
const game = {
  scene,
  camera,
  renderer,
  composer,
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

// ─── Systems ───────────────────────────────────────────────────────────────
game.grid     = new Grid(scene);
game.fogOfWar = new FogOfWar(scene);
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

// ─── Starter scene ─────────────────────────────────────────────────────────
function placeStarterBuildings() {
  const place = (id, gx, gz, extraItems = {}) => {
    for (const [item, n] of Object.entries(extraItems)) game.inventory.add(item, n);
    game.buildSys.enterBuildMode(id);
    game.buildSys.place(gx, gz);
    game.buildSys.exitBuildMode();
  };

  place('campfire', 32, 33, { stone: 5 });
  place('well',     30, 30, { stone: 10 });
  place('lantern',  35, 30, { iron: 2, cloth: 2 });
  place('lantern',  29, 35, { iron: 1, cloth: 1 });

  // Re-add starter resources after spending
  game.inventory.add('wood', 15);
  game.inventory.add('stone', 12);
  game.inventory.add('iron', 2);
}
placeStarterBuildings();

setTimeout(() => {
  game.showDialog('ようこそ！WASDで移動・SPACEで攻撃・Bで建設メニュー・Eで調べる');
}, 500);

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

// ─── Click / touch interaction ─────────────────────────────────────────────
const raycaster  = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

canvas.addEventListener('click', onCanvasClick);

function screenToRayPt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera({ x, y }, camera);
  const pt = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, pt) ? pt : null;
}

function onCanvasClick(e) {
  const pt = screenToRayPt(e.clientX, e.clientY);
  if (!pt) return;

  const { gx, gz } = game.grid.worldToGrid(pt.x, pt.z);

  if (game.buildSys.mode) {
    game.buildSys.place(gx, gz);
    return;
  }

  // Farm plot interaction
  const plot = game.farmMgr.getPlot(gx, gz);
  if (plot) {
    if (plot.state === 'ready') {
      game.farmMgr.harvest(gx, gz);
    } else if (plot.state === 'empty' && game.farmMode.selectedCrop) {
      game.farmMgr.plant(gx, gz, game.farmMode.selectedCrop);
    } else if ((plot.state === 'planted' || plot.state === 'growing') && game.inventory.has('water_bucket', 1)) {
      game.farmMgr.water(gx, gz);
    } else if (plot.state === 'planted') {
      game.showDialog('水バケツが必要！井戸の近くでEキーを押そう。');
    } else {
      const cropName = plot.cropId || '???';
      game.showDialog(`${cropName}: ステージ ${plot.growthStage + 1}/4 (${plot.state})`);
    }
    return;
  }

  // Tilling
  const tile = game.grid.getTile(gx, gz);
  if (tile === TILE.GRASS || tile === TILE.DIRT) {
    const dist = Math.hypot(game.player.position.x - pt.x, game.player.position.z - pt.z);
    if (dist < 3) {
      if (game.farmMgr.till(gx, gz)) {
        game.showDialog('土を耕した！インベントリで種を選んでクリック！');
      }
    } else {
      game.showDialog('もっと近づいてからタップ！');
    }
    return;
  }

  // Well interaction
  const building = game.buildSys.getBuilding(gx, gz);
  if (building?.def?.isWell) {
    game.inventory.add('water_bucket', 1);
    game.showDialog('水バケツを汲んだ！💧');
    return;
  }

  // Remove building (R key + click)
  if (keys['KeyR'] && building) {
    game.buildSys.remove(gx, gz);
    game.showDialog('建物を撤去した（素材50%回収）');
    return;
  }

  // NPC interaction
  for (const npc of game.npcs) {
    const ng = game.grid.worldToGrid(npc.position.x, npc.position.z);
    if (Math.abs(ng.gx - gx) <= 1 && Math.abs(ng.gz - gz) <= 1) {
      npc.interact(game);
      return;
    }
  }
}

// ─── Keyboard shortcuts ────────────────────────────────────────────────────
function handleShortcuts() {
  if (keys['KeyB'] && !prevKeys['KeyB']) game.buildMenu.toggle();

  if (keys['KeyE'] && !prevKeys['KeyE']) interactNearby();

  if (keys['Escape'] && !prevKeys['Escape']) {
    if (game.buildSys.mode) {
      game.buildMenu.exitBuildMode();
    } else {
      game.farmMode.selectedCrop = null;
      game.inventory._selectedSeedId = null;
      game.inventory.render();
    }
  }

  Object.assign(prevKeys, keys);
}

function interactNearby() {
  const gx = game.player.gx;
  const gz = game.player.gz;

  // NPC check
  for (const npc of game.npcs) {
    if (game.player.position.distanceTo(npc.position) < 2.5) {
      npc.interact(game);
      return;
    }
  }

  // Scan nearby tiles
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const b = game.buildSys.getBuilding(gx + dx, gz + dz);
      if (b?.def?.isWell) {
        game.inventory.add('water_bucket', 1);
        game.showDialog('水バケツを汲んだ！💧');
        return;
      }

      const plot = game.farmMgr.getPlot(gx + dx, gz + dz);
      if (plot?.state === 'ready') {
        game.farmMgr.harvest(gx + dx, gz + dz);
        return;
      }
      if ((plot?.state === 'planted' || plot?.state === 'growing') && game.inventory.has('water_bucket', 1)) {
        game.farmMgr.water(gx + dx, gz + dz);
        return;
      }
    }
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
  game.season.update(delta);
  game.player.update(delta, keys, game.dpad);
  game.enemyMgr.update(delta);
  game.farmMgr.update(delta);
  game.fogOfWar.update(time / 1000);
  game.buildSys.update(camera);
  for (const npc of game.npcs) npc.update(delta);
  game.hud.update(delta);
  game.hud.updateQuests(game.questMgr.active);

  updateCamera();

  if (composer) {
    composer.render(delta);
  } else {
    renderer.render(scene, camera);
  }
}

// ─── Resize ────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer?.setSize(window.innerWidth, window.innerHeight);
});

// ─── Start ─────────────────────────────────────────────────────────────────
document.getElementById('loading')?.classList.add('hidden');
requestAnimationFrame(loop);
