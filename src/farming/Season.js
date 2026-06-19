const SEASON_NAMES = ['春', '夏', '秋', '冬'];
const DAYS_PER_SEASON = 30;

export class Season {
  constructor() {
    this.totalDays = 0;
    this.timeOfDay = 0.5; // 0=midnight, 0.5=noon, 1=midnight
    this.daySeconds = 120; // real seconds per in-game day
    this._elapsed = 0;
  }

  get day() { return (this.totalDays % DAYS_PER_SEASON) + 1; }
  get seasonIndex() { return Math.floor(this.totalDays / DAYS_PER_SEASON) % 4; }
  get seasonName() { return SEASON_NAMES[this.seasonIndex]; }
  get year() { return Math.floor(this.totalDays / (DAYS_PER_SEASON * 4)) + 1; }

  update(delta) {
    this._elapsed += delta;
    if (this._elapsed >= this.daySeconds) {
      this._elapsed -= this.daySeconds;
      this.totalDays++;
    }
    this.timeOfDay = this._elapsed / this.daySeconds;
  }

  getLabel() {
    return `年${this.year} ${this.seasonName} ${this.day}日`;
  }
}
