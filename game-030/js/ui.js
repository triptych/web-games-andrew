// ============================================================
// ui.js — DOM panels: dialogue box, pause menu, inventory,
// quest log, shop. Each is a small controller with its own
// key handling; main.js routes input based on game mode.
// ============================================================
import { state } from './state.js';
import { ITEMS, QUESTS, SHOP_STOCK } from './data.js';
import { events } from './events.js';
import { sfx } from './sounds.js';

const $ = (id) => document.getElementById(id);

// ---------------- Dialogue ----------------
export class Dialogue {
  constructor() {
    this.box = $('textbox');
    this.speaker = $('textbox-speaker');
    this.body = $('textbox-body');
    this.lines = [];
    this.idx = 0;
    this.onDone = null;
    this.typing = false;
    this.fullText = '';
    this.shown = 0;
  }
  show(lines, onDone) {
    this.lines = lines || [];
    this.idx = 0; this.onDone = onDone;
    this.box.classList.remove('hidden');
    this._render();
  }
  _render() {
    const [who, text] = this.lines[this.idx];
    this.speaker.textContent = who || '';
    this.speaker.style.display = who ? 'block' : 'none';
    this.fullText = text; this.shown = 0; this.typing = true;
    this.body.textContent = '';
    this._type();
  }
  _type() {
    if (!this.typing) return;
    if (this.shown < this.fullText.length) {
      this.shown += 2;
      this.body.textContent = this.fullText.slice(0, this.shown);
      this._timer = setTimeout(() => this._type(), 16);
    } else {
      this.body.textContent = this.fullText;
      this.typing = false;
    }
  }
  advance() {
    if (this.typing) { // skip typewriter
      clearTimeout(this._timer);
      this.typing = false;
      this.body.textContent = this.fullText;
      return;
    }
    sfx.cursor();
    this.idx++;
    if (this.idx >= this.lines.length) { this.close(); }
    else this._render();
  }
  close() {
    this.box.classList.add('hidden');
    const cb = this.onDone; this.onDone = null;
    if (cb) cb();
  }
  get open() { return !this.box.classList.contains('hidden'); }
}

// ---------------- Pause Menu ----------------
export class Menu {
  constructor(openPanel) {
    this.el = $('menu');
    this.list = $('menu-list');
    this.items = ['Inventory', 'Quests', 'Status', 'Close'];
    this.idx = 0;
    this.openPanel = openPanel; // callback(name)
  }
  open() { this.el.classList.remove('hidden'); this.idx = 0; this.render(); }
  close() { this.el.classList.add('hidden'); }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  render() {
    this.list.innerHTML = this.items.map((it, i) =>
      `<li class="${i === this.idx ? 'sel' : ''}">${it}</li>`).join('');
    [...this.list.children].forEach((li, i) => li.onclick = () => { this.idx = i; this.choose(); });
  }
  handleKey(k) {
    if (k === 'arrowdown' || k === 's') { this.idx = (this.idx + 1) % this.items.length; sfx.cursor(); this.render(); }
    else if (k === 'arrowup' || k === 'w') { this.idx = (this.idx - 1 + this.items.length) % this.items.length; sfx.cursor(); this.render(); }
    else if (k === 'enter' || k === ' ' || k === 'x') { this.choose(); }
    else if (k === 'escape' || k === 'm' || k === 'z') { sfx.cancel(); this.close(); }
  }
  choose() {
    sfx.confirm();
    const pick = this.items[this.idx];
    if (pick === 'Close') this.close();
    else this.openPanel(pick.toLowerCase());
  }
}

// ---------------- Inventory ----------------
export class Inventory {
  constructor() { this.el = $('inventory'); this.list = $('inventory-list'); this.idx = 0; }
  open() { this.el.classList.remove('hidden'); this.idx = 0; this.render(); }
  close() { this.el.classList.add('hidden'); }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  entries() { return Object.keys(state.inventory).map(id => ({ id, ...ITEMS[id], qty: state.inventory[id] })); }
  render() {
    const es = this.entries();
    if (es.length === 0) { this.list.innerHTML = '<li class="disabled">Empty. Go find some loot!</li>'; return; }
    this.idx = Math.min(this.idx, es.length - 1);
    this.list.innerHTML = es.map((e, i) => {
      const eq = (e.kind === 'weapon' && state.hero.weapon === e.id) ? ' <small>[equipped]</small>' : '';
      return `<li class="${i === this.idx ? 'sel' : ''}">
        <span>${e.icon} ${e.name}${eq}</span>
        <span class="qty">×${e.qty}</span>
      </li>
      <li style="cursor:default;font-size:12px;color:var(--ink-dim);padding-top:0">${e.desc}</li>`;
    }).join('');
  }
  handleKey(k) {
    const es = this.entries();
    if (k === 'arrowdown' || k === 's') { this.idx = (this.idx + 1) % Math.max(1, es.length); sfx.cursor(); this.render(); }
    else if (k === 'arrowup' || k === 'w') { this.idx = (this.idx - 1 + es.length) % Math.max(1, es.length); sfx.cursor(); this.render(); }
    else if (k === 'enter' || k === ' ' || k === 'x') { this.use(es[this.idx]); }
    else if (k === 'escape' || k === 'i' || k === 'z') { sfx.cancel(); this.close(); return 'back'; }
  }
  use(entry) {
    if (!entry) return;
    if (entry.kind === 'consumable') {
      if (entry.heal) { state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + entry.heal); sfx.heal(); }
      else if (entry.mp) { state.hero.sp = Math.min(state.hero.maxSp, state.hero.sp + entry.mp); sfx.heal(); }
      else { sfx.cancel(); return; }
      state.removeItem(entry.id, 1);
      this.render();
    } else if (entry.kind === 'weapon') {
      state.equip(entry.id); sfx.confirm(); this.render();
    } else { sfx.cancel(); }
  }
}

// ---------------- Quest Log ----------------
export class QuestLog {
  constructor() { this.el = $('quests'); this.list = $('quest-list'); }
  open() { this.el.classList.remove('hidden'); this.render(); }
  close() { this.el.classList.add('hidden'); }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  render() {
    const ids = Object.keys(state.quests);
    if (ids.length === 0) { this.list.innerHTML = '<li class="disabled">No quests yet. Talk to the folk of Coppergate.</li>'; return; }
    this.list.innerHTML = ids.map(id => {
      const q = QUESTS[id], done = state.quests[id].done;
      return `<li>
        <span class="quest-name ${done ? 'done' : ''}">${done ? '✓ ' : '• '}${q.name}</span>
        <span class="quest-desc">${q.desc}</span>
      </li>`;
    }).join('');
  }
  handleKey(k) {
    if (k === 'escape' || k === 'q' || k === 'z' || k === 'enter') { sfx.cancel(); this.close(); return 'back'; }
  }
}

// ---------------- Status (reuses menu panel area via dialogue-ish) ----------------
export function statusLines() {
  const h = state.hero;
  return [
    ["Status", `Level ${h.level} · EXP ${h.exp}/${h.nextExp}`],
    ["Status", `HP ${h.hp}/${h.maxHp} · SP ${h.sp}/${h.maxSp}`],
    ["Status", `ATK ${state.atk} (base ${h.atk}${h.weapon ? ' + ' + ITEMS[h.weapon].name : ''}) · DEF ${h.def}`],
    ["Status", `Gold: ${state.gold} ◈`],
  ];
}

// ---------------- Shop ----------------
export class Shop {
  constructor() {
    this.el = $('shop');
    this.buyList = $('shop-buy');
    this.sellList = $('shop-sell');
    this.goldEl = $('shop-gold');
    this.col = 'buy';   // buy | sell
    this.idx = 0;
    this._offGold = null;
  }
  open() {
    this.el.classList.remove('hidden');
    this.col = 'buy'; this.idx = 0;
    this.render();
    this._offGold = events.on('goldChanged', () => this.render());
  }
  close() {
    this.el.classList.add('hidden');
    if (this._offGold) { this._offGold(); this._offGold = null; }
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }

  buyItems() { return SHOP_STOCK.map(id => ({ id, ...ITEMS[id] })); }
  sellItems() {
    return Object.keys(state.inventory)
      .filter(id => ITEMS[id].kind !== 'key')
      .map(id => ({ id, ...ITEMS[id], qty: state.inventory[id] }));
  }
  currentList() { return this.col === 'buy' ? this.buyItems() : this.sellItems(); }
  sellPrice(id) { return Math.max(1, Math.floor(ITEMS[id].price / 2)); }

  render() {
    this.goldEl.textContent = `Your gold: ${state.gold} ◈`;
    const buys = this.buyItems();
    this.buyList.innerHTML = buys.map((e, i) => {
      const sel = (this.col === 'buy' && i === this.idx) ? 'sel' : '';
      const cant = state.gold < e.price ? 'disabled' : '';
      return `<li class="${sel} ${cant}" data-col="buy" data-i="${i}">
        <span>${e.icon} ${e.name}</span><span class="price">${e.price} ◈</span></li>`;
    }).join('');

    const sells = this.sellItems();
    this.sellList.innerHTML = sells.length
      ? sells.map((e, i) => {
          const sel = (this.col === 'sell' && i === this.idx) ? 'sel' : '';
          return `<li class="${sel}" data-col="sell" data-i="${i}">
            <span>${e.icon} ${e.name} <span class="qty">×${e.qty}</span></span>
            <span class="price">${this.sellPrice(e.id)} ◈</span></li>`;
        }).join('')
      : '<li class="disabled">Nothing to sell.</li>';

    // click handlers
    [...this.el.querySelectorAll('li[data-col]')].forEach(li => {
      li.onclick = () => {
        this.col = li.dataset.col; this.idx = +li.dataset.i;
        this.confirm(); this.render();
      };
    });
  }

  handleKey(k) {
    const list = this.currentList();
    if (k === 'tab' || k === 'arrowleft' || k === 'arrowright' || k === 'a' || k === 'd') {
      this.col = this.col === 'buy' ? 'sell' : 'buy'; this.idx = 0; sfx.cursor(); this.render();
    } else if (k === 'arrowdown' || k === 's') {
      this.idx = (this.idx + 1) % Math.max(1, list.length); sfx.cursor(); this.render();
    } else if (k === 'arrowup' || k === 'w') {
      this.idx = (this.idx - 1 + list.length) % Math.max(1, list.length); sfx.cursor(); this.render();
    } else if (k === 'enter' || k === ' ' || k === 'x') {
      this.confirm(); this.render();
    } else if (k === 'escape' || k === 'z') {
      sfx.cancel(); this.close(); return 'back';
    }
  }

  confirm() {
    const list = this.currentList();
    const e = list[this.idx];
    if (!e) return;
    if (this.col === 'buy') {
      if (state.spend(e.price)) { state.addItem(e.id, 1); sfx.coin(); }
      else sfx.cancel();
    } else {
      if (state.hasItem(e.id)) {
        state.removeItem(e.id, 1); state.addGold(this.sellPrice(e.id)); sfx.coin();
        if (this.idx >= this.sellItems().length) this.idx = Math.max(0, this.sellItems().length - 1);
      } else sfx.cancel();
    }
  }
}
