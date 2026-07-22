import { events } from './events.js';
import { ITEMS, QUESTS } from './data.js';

const STARTING_GOLD = 60;

/**
 * Global game state. Setters auto-emit events so UI stays in sync.
 */
class GameState {
  constructor() { this.reset(); }

  reset() {
    // Party (single hero for now; array so we can add members later)
    this.hero = {
      name: 'You',
      hp: 90, maxHp: 90,
      sp: 30, maxSp: 30,
      atk: 10, def: 4,
      level: 1, exp: 0, nextExp: 30,
      weapon: null,      // item id or null
    };
    this._gold = STARTING_GOLD;
    this.inventory = {}; // itemId -> qty
    this.quests = {};    // questId -> { done: bool }
    this.flags = {};     // arbitrary story flags
    this.map = 'lane';
    this.px = 8; this.py = 7; // tile coords on current map

    // starter kit
    this.addItem('tea', 2);
    this.addItem('wrench', 1);
    this.equip('wrench');
  }

  // ---- Gold ----
  get gold() { return this._gold; }
  set gold(v) { this._gold = Math.max(0, v); events.emit('goldChanged', this._gold); }
  addGold(n) { this.gold += n; }
  spend(n) { if (this._gold >= n) { this.gold -= n; return true; } return false; }

  // ---- Inventory ----
  addItem(id, qty = 1) {
    this.inventory[id] = (this.inventory[id] || 0) + qty;
    events.emit('itemGained', id, qty);
  }
  removeItem(id, qty = 1) {
    if (!this.inventory[id]) return false;
    this.inventory[id] -= qty;
    if (this.inventory[id] <= 0) delete this.inventory[id];
    return true;
  }
  hasItem(id) { return (this.inventory[id] || 0) > 0; }
  countItem(id) { return this.inventory[id] || 0; }

  // ---- Equipment ----
  get atk() { return this.hero.atk + (this.hero.weapon ? (ITEMS[this.hero.weapon].atk || 0) : 0); }
  equip(id) {
    if (ITEMS[id] && ITEMS[id].kind === 'weapon') this.hero.weapon = id;
  }

  // ---- Leveling ----
  gainExp(n) {
    this.hero.exp += n;
    while (this.hero.exp >= this.hero.nextExp) {
      this.hero.exp -= this.hero.nextExp;
      this.hero.level++;
      this.hero.maxHp += 12; this.hero.hp = this.hero.maxHp;
      this.hero.maxSp += 5;  this.hero.sp = this.hero.maxSp;
      this.hero.atk += 2;    this.hero.def += 1;
      this.hero.nextExp = Math.round(this.hero.nextExp * 1.5);
      events.emit('levelUp', this.hero.level);
    }
  }

  // ---- Quests ----
  startQuest(id) {
    if (!this.quests[id]) { this.quests[id] = { done: false }; events.emit('questUpdated', id); }
  }
  hasQuest(id) { return !!this.quests[id]; }
  completeQuest(id) {
    if (this.quests[id] && !this.quests[id].done) {
      this.quests[id].done = true;
      const r = QUESTS[id].reward || {};
      if (r.gold) this.addGold(r.gold);
      if (r.exp) this.gainExp(r.exp);
      if (r.item) this.addItem(r.item, 1);
      events.emit('questUpdated', id);
      events.emit('questComplete', id, r);
    }
  }
}

export const state = new GameState();
