import { QUESTS } from './Quests.js';

export class QuestManager {
  constructor(game) {
    this.game = game;
    this.active = [];
    this.completed = [];

    // Deep copy quests
    for (const q of QUESTS) {
      this.active.push(JSON.parse(JSON.stringify(q)));
    }
  }

  onEvent(type, data) {
    let changed = false;
    for (const q of this.active) {
      for (const obj of q.objectives) {
        if (obj.type !== type) continue;

        let matches = false;
        if (type === 'build' && obj.target?.includes(data.target)) matches = true;
        if (type === 'kill' && obj.target === data.target) matches = true;
        if (type === 'harvest' && obj.target === data.target) matches = true;
        if (type === 'till') matches = true;
        if (type === 'enter_danger') matches = true;

        if (matches && obj.current < obj.count) {
          const increment = data.count || 1;
          obj.current = Math.min(obj.count, obj.current + increment);
          changed = true;
        }
      }
    }

    if (changed) {
      this._checkCompletion();
      this.game.hud?.updateQuests(this.active);
    }
  }

  _checkCompletion() {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const q = this.active[i];
      const done = q.objectives.every(o => o.current >= o.count);
      if (done) {
        this.completed.push(q);
        this.active.splice(i, 1);
        this._grantReward(q);
        this.game.showDialog(`クエスト完了：「${q.title}」\n報酬: ${q.rewardText}`);
      }
    }
  }

  _grantReward(q) {
    for (const [item, count] of Object.entries(q.reward)) {
      this.game.inventory.add(item, count);
    }
  }

  restoreProgress(activeData, completedIds) {
    this.active = [];
    this.completed = [];
    for (const q of QUESTS) {
      if (completedIds.includes(q.id)) {
        this.completed.push(JSON.parse(JSON.stringify(q)));
        continue;
      }
      const copy = JSON.parse(JSON.stringify(q));
      const saved = activeData.find(a => a.id === q.id);
      if (saved) {
        for (const obj of copy.objectives) {
          const so = saved.objectives.find(o => o.id === obj.id);
          if (so) obj.current = so.current;
        }
      }
      this.active.push(copy);
    }
  }

  getProgress(questId) {
    const q = this.active.find(q => q.id === questId);
    if (!q) return null;
    return q.objectives.map(o => ({ text: o.text, current: o.current, count: o.count }));
  }
}
