const SAVE_KEY = 'matimake_rpg_v1';
const AUTO_INTERVAL = 60; // seconds

export class SaveSystem {
  constructor(game) {
    this.game = game;
    this._timer = 0;
  }

  hasSave() { return !!localStorage.getItem(SAVE_KEY); }

  save(silent = false) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this._serialize()));
      if (!silent) this.game.showDialog('セーブしました！💾');
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      this._deserialize(JSON.parse(raw));
      return true;
    } catch (e) {
      console.error('Load failed:', e);
      localStorage.removeItem(SAVE_KEY);
      return false;
    }
  }

  deleteSave() { localStorage.removeItem(SAVE_KEY); }

  update(delta) {
    this._timer += delta;
    if (this._timer >= AUTO_INTERVAL) {
      this._timer = 0;
      this.save(true); // silent autosave
    }
  }

  // ── Serialize ─────────────────────────────────────────────────────────────

  _serialize() {
    const g = this.game;

    const buildings = [];
    for (const [, b] of g.buildSys._buildings) {
      buildings.push({
        id: b.id, gx: b.gx, gz: b.gz, layer: b.layer,
        rotation: Math.round(b.mesh.rotation.y / (Math.PI / 2)),
        wallFloor: b.wallFloor || 0,
      });
    }

    const farmPlots = [];
    for (const [, p] of g.farmMgr.plots) {
      farmPlots.push({ gx: p.gx, gz: p.gz, state: p.state, cropId: p.cropId, growthStage: p.growthStage, growthTimer: p.growthTimer, watered: p.watered });
    }

    const chests = {};
    for (const [key, slots] of g.buildSys._chestInventories) {
      if (slots.length > 0) chests[key] = slots.map(s => ({ ...s }));
    }

    return {
      version: 1,
      timestamp: Date.now(),
      player: { x: g.player.position.x, z: g.player.position.z, hp: g.player.hp },
      inventory: g.inventory.slots.map(s => ({ ...s })),
      buildings,
      farmPlots,
      chests,
      quests: {
        active: g.questMgr.active.map(q => ({
          id: q.id,
          objectives: q.objectives.map(o => ({ id: o.id, current: o.current })),
        })),
        completed: g.questMgr.completed.map(q => q.id),
      },
      season: { totalDays: g.season.totalDays, elapsed: g.season._elapsed },
      resources: g.resMgr?.serialize(),
    };
  }

  // ── Deserialize ───────────────────────────────────────────────────────────

  _deserialize(data) {
    const g = this.game;

    if (data.player) {
      g.player.position.set(data.player.x, 1.0, data.player.z);
      g.player.hp = data.player.hp;
    }

    if (data.inventory) {
      g.inventory.slots = data.inventory;
      g.inventory.render();
    }

    if (data.buildings) {
      for (const b of data.buildings) {
        g.buildSys.placeFromSave(b.id, b.gx, b.gz, b.layer ?? 0, b.rotation ?? 0, b.wallFloor ?? 0);
      }
    }

    if (data.farmPlots) {
      for (const p of data.farmPlots) {
        const key = `${p.gx},${p.gz}`;
        const plot = { gx: p.gx, gz: p.gz, state: p.state, cropId: p.cropId, growthStage: p.growthStage, growthTimer: p.growthTimer, watered: p.watered };
        g.farmMgr.plots.set(key, plot);
        g.grid.setTile(p.gx, p.gz, 4); // TILE.TILLED
        g.farmMgr._updateCropMesh(key, plot);
      }
    }

    if (data.chests) {
      for (const [key, slots] of Object.entries(data.chests)) {
        g.buildSys._chestInventories.set(key, slots);
      }
    }

    if (data.quests) {
      g.questMgr.restoreProgress(data.quests.active || [], data.quests.completed || []);
    }

    if (data.season) {
      g.season.totalDays = data.season.totalDays || 0;
      g.season._elapsed = data.season.elapsed || 0;
    }

    if (data.resources && g.resMgr) {
      g.resMgr.loadFromSave(data.resources);
    } else {
      g.resMgr?.generate();
    }
  }
}
