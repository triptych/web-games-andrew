// ============================================================
// battle.js — turn-based combat.
// Player picks Attack / Skill / Item / Flee, then enemies act.
// DOM-driven UI (#battle overlay).
// ============================================================
import { state } from './state.js';
import { ENEMIES, ABILITIES, ITEMS } from './data.js';
import { sfx } from './sounds.js';
import { events } from './events.js';

export class Battle {
  constructor(dom) {
    this.dom = dom;              // { root, enemies, party, log, menu }
    this.onEnd = null;          // callback(result)
    this.active = false;
  }

  start(foeIds, isBoss = false) {
    this.active = true;
    this.isBoss = isBoss;
    this.foes = foeIds.map((id, i) => {
      const def = ENEMIES[id];
      return { id, uid: i, name: def.name, sprite: def.sprite,
               hp: def.hp, maxHp: def.hp, atk: def.atk, def: def.def,
               exp: def.exp, gold: def.gold, drops: def.drops || [], dead: false };
    });
    this.target = 0;
    this.menuMode = 'root';     // root | skill | item | target
    this.menuIndex = 0;
    this.busy = false;
    this.dom.root.classList.remove('hidden');
    this.log('An encounter! ' + this._foeSummary());
    this.render();
  }

  _foeSummary() {
    const counts = {};
    this.foes.forEach(f => counts[f.name] = (counts[f.name] || 0) + 1);
    return Object.entries(counts).map(([n, c]) => c > 1 ? `${c} ${n}s` : `a ${n}`).join(', ') + '.';
  }

  log(msg) { this.dom.log.textContent = msg; }

  aliveFoes() { return this.foes.filter(f => !f.dead); }

  firstAliveTargetFrom(idx) {
    for (let i = 0; i < this.foes.length; i++) {
      const j = (idx + i) % this.foes.length;
      if (!this.foes[j].dead) return j;
    }
    return 0;
  }

  // ---------- Input ----------
  handleKey(key) {
    if (!this.active || this.busy) return;
    const k = key.toLowerCase();

    if (this.menuMode === 'root') {
      const opts = this._rootOptions();
      if (k === 'arrowright' || k === 'd') { this.menuIndex = (this.menuIndex + 1) % opts.length; sfx.cursor(); }
      else if (k === 'arrowleft' || k === 'a') { this.menuIndex = (this.menuIndex - 1 + opts.length) % opts.length; sfx.cursor(); }
      else if (k === 'enter' || k === ' ' || k === 'x') { this._chooseRoot(opts[this.menuIndex]); }
    }
    else if (this.menuMode === 'target') {
      const alive = this.foes.map((f, i) => i).filter(i => !this.foes[i].dead);
      const pos = alive.indexOf(this.target);
      if (k === 'arrowright' || k === 'd') { this.target = alive[(pos + 1) % alive.length]; sfx.cursor(); }
      else if (k === 'arrowleft' || k === 'a') { this.target = alive[(pos - 1 + alive.length) % alive.length]; sfx.cursor(); }
      else if (k === 'enter' || k === ' ' || k === 'x') { this._confirmTarget(); }
      else if (k === 'escape' || k === 'z') { this.menuMode = 'root'; sfx.cancel(); }
    }
    else if (this.menuMode === 'skill' || this.menuMode === 'item') {
      const list = this._subList();
      if (k === 'arrowdown' || k === 's') { this.menuIndex = (this.menuIndex + 1) % list.length; sfx.cursor(); }
      else if (k === 'arrowup' || k === 'w') { this.menuIndex = (this.menuIndex - 1 + list.length) % list.length; sfx.cursor(); }
      else if (k === 'enter' || k === ' ' || k === 'x') { this._chooseSub(list[this.menuIndex]); }
      else if (k === 'escape' || k === 'z') { this.menuMode = 'root'; this.menuIndex = 0; sfx.cancel(); }
    }
    this.render();
  }

  _rootOptions() { return ['Attack', 'Skill', 'Item', 'Flee']; }

  _chooseRoot(opt) {
    sfx.confirm();
    if (opt === 'Attack') { this.pending = { type: 'attack' }; this.menuMode = 'target'; this.target = this.firstAliveTargetFrom(0); }
    else if (opt === 'Skill') { this.menuMode = 'skill'; this.menuIndex = 0; }
    else if (opt === 'Item') { this.menuMode = 'item'; this.menuIndex = 0; }
    else if (opt === 'Flee') { this._flee(); }
  }

  _subList() {
    if (this.menuMode === 'skill') {
      return Object.entries(ABILITIES).map(([id, a]) => ({ id, ...a, disabled: state.hero.sp < a.cost }));
    } else {
      // usable items (consumables only)
      return Object.keys(state.inventory)
        .filter(id => ITEMS[id].kind === 'consumable')
        .map(id => ({ id, ...ITEMS[id], qty: state.inventory[id] }));
    }
  }

  _chooseSub(entry) {
    if (!entry) return;
    if (entry.disabled) { sfx.cancel(); return; }
    sfx.confirm();
    if (this.menuMode === 'skill') {
      const ab = ABILITIES[entry.id];
      if (ab.heal) { this.pending = { type: 'skill', id: entry.id }; this._resolvePlayerAction(); }
      else if (ab.aoe) { this.pending = { type: 'skill', id: entry.id }; this._resolvePlayerAction(); }
      else { this.pending = { type: 'skill', id: entry.id }; this.menuMode = 'target'; this.target = this.firstAliveTargetFrom(0); }
    } else {
      const it = ITEMS[entry.id];
      if (it.flee) { this._itemFlee(entry.id); return; }
      this.pending = { type: 'item', id: entry.id };
      this._resolvePlayerAction();
    }
  }

  _confirmTarget() { sfx.confirm(); this._resolvePlayerAction(); }

  // ---------- Resolution ----------
  async _resolvePlayerAction() {
    this.busy = true;
    const p = this.pending;

    if (p.type === 'attack') {
      const foe = this.foes[this.target];
      const dmg = Math.max(1, state.atk + rand(-2, 2) - foe.def);
      await this._strike(foe, dmg, 'hit');
      this.log(`You strike ${foe.name} for ${dmg}!`);
    }
    else if (p.type === 'skill') {
      const ab = ABILITIES[p.id];
      state.hero.sp -= ab.cost;
      sfx.cast();
      if (ab.heal) {
        state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + ab.heal);
        sfx.heal();
        this.log(`You patch yourself up for ${ab.heal} HP.`);
        await wait(500);
      } else if (ab.aoe) {
        for (const foe of this.aliveFoes()) {
          const dmg = Math.max(1, ab.power + rand(-2, 2) - Math.floor(foe.def / 2));
          await this._strike(foe, dmg, 'cast', true);
        }
        this.log(`Scatter-Gear rips through the enemies!`);
      } else {
        const foe = this.foes[this.target];
        const dmg = Math.max(1, ab.power + rand(-2, 2) - Math.floor(foe.def / 2));
        await this._strike(foe, dmg, 'cast');
        this.log(`${ab.name} blasts ${foe.name} for ${dmg}!`);
      }
    }
    else if (p.type === 'item') {
      const it = ITEMS[p.id];
      state.removeItem(p.id, 1);
      if (it.heal) { state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + it.heal); sfx.heal(); this.log(`You use ${it.name}. +${it.heal} HP.`); }
      else if (it.mp) { state.hero.sp = Math.min(state.hero.maxSp, state.hero.sp + it.mp); sfx.heal(); this.log(`You use ${it.name}. +${it.mp} SP.`); }
      await wait(500);
    }

    this.render();
    await wait(400);

    if (this.aliveFoes().length === 0) { return this._win(); }

    await this._enemyTurn();
  }

  async _strike(foe, dmg, sound, quick = false) {
    if (sound === 'hit') sfx.hit(); else sfx.cast();
    foe.hp = Math.max(0, foe.hp - dmg);
    this._floatDamage(foe.uid, dmg, '#ffd24a');
    this._shake(foe.uid);
    if (foe.hp <= 0) foe.dead = true;
    this.render();
    await wait(quick ? 180 : 350);
  }

  async _enemyTurn() {
    for (const foe of this.aliveFoes()) {
      await wait(350);
      const dmg = Math.max(1, foe.atk + rand(-2, 3) - state.hero.def);
      state.hero.hp = Math.max(0, state.hero.hp - dmg);
      sfx.hit();
      this._floatParty(dmg);
      events.emit('partyDamaged');
      this.log(`${foe.name} hits you for ${dmg}!`);
      this.render();
      if (state.hero.hp <= 0) { await wait(500); return this._lose(); }
    }
    // back to player
    this.busy = false;
    this.menuMode = 'root';
    this.menuIndex = 0;
    this.render();
  }

  _flee() {
    if (this.isBoss) { this.log("There's no running from Big Bertha!"); this.render(); return; }
    sfx.cancel();
    if (Math.random() < 0.6) { this.log('You slipped away!'); this._finish('flee'); }
    else { this.log("Couldn't escape!"); this.busy = true; this.render(); this._enemyTurn(); }
  }
  _itemFlee(id) {
    state.removeItem(id, 1); sfx.confirm();
    if (this.isBoss) { this.log('The smoke does nothing against Bertha!'); this.render(); return; }
    this.log('You vanish in a puff of smoke!'); this._finish('flee');
  }

  async _win() {
    sfx.victory();
    let exp = 0, gold = 0; const loot = [];
    this.foes.forEach(f => {
      exp += f.exp; gold += f.gold;
      f.drops.forEach(([id, chance]) => { if (Math.random() < chance) loot.push(id); });
    });
    state.addGold(gold);
    const before = state.hero.level;
    state.gainExp(exp);
    loot.forEach(id => state.addItem(id, 1));
    if (this.isBoss) { state.flags.berthaDefeated = true; state.addItem('goldgear', 1); }

    let msg = `Victory! +${exp} EXP, +${gold} gold.`;
    if (loot.length) msg += ' Found: ' + loot.map(id => ITEMS[id].name).join(', ') + '.';
    if (state.hero.level > before) msg += ` Level up! Now L${state.hero.level}.`;
    if (this.isBoss) msg += ' Big Bertha dropped the Golden Gear!';
    this.log(msg);
    this.render();
    await wait(1600);
    this._finish('win');
  }

  async _lose() {
    sfx.defeat();
    this.log('You collapse... but Trina drags you home to recover.');
    // soft failure: revive at town with half HP
    this.render();
    await wait(1800);
    state.hero.hp = Math.floor(state.hero.maxHp / 2);
    state.map = 'lane'; state.px = 8; state.py = 7;
    this._finish('lose');
  }

  _finish(result) {
    this.active = false;
    this.dom.root.classList.add('hidden');
    if (this.onEnd) this.onEnd(result);
  }

  // ---------- Effects ----------
  _floatDamage(uid, dmg, color) {
    const el = this.dom.enemies.querySelector(`[data-uid="${uid}"]`);
    if (!el) return;
    const f = document.createElement('div');
    f.className = 'float-dmg'; f.textContent = dmg; f.style.color = color;
    const r = el.getBoundingClientRect(), pr = this.dom.root.getBoundingClientRect();
    f.style.left = (r.left - pr.left + r.width / 2) + 'px';
    f.style.top = (r.top - pr.top) + 'px';
    this.dom.root.appendChild(f);
    setTimeout(() => f.remove(), 800);
  }
  _floatParty(dmg) {
    const f = document.createElement('div');
    f.className = 'float-dmg'; f.textContent = dmg; f.style.color = '#d05858';
    f.style.left = '50%'; f.style.bottom = '120px';
    this.dom.root.appendChild(f);
    setTimeout(() => f.remove(), 800);
  }
  _shake(uid) {
    const el = this.dom.enemies.querySelector(`[data-uid="${uid}"]`);
    if (el) { el.classList.add('hurt'); setTimeout(() => el.classList.remove('hurt'), 300); }
  }

  // ---------- Render ----------
  render() {
    // enemies
    this.dom.enemies.innerHTML = this.foes.map(f => {
      const pct = Math.round((f.hp / f.maxHp) * 100);
      const low = pct < 35 ? 'low' : '';
      const targeted = (this.menuMode === 'target' && this.target === f.uid && !f.dead) ? 'target' : '';
      return `<div class="enemy ${f.dead ? 'dead' : ''} ${targeted}" data-uid="${f.uid}">
        <div class="enemy-sprite">${f.sprite}</div>
        <div class="enemy-name">${f.name}</div>
        <div class="hpbar ${low}"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join('');
    // click targeting
    this.dom.enemies.querySelectorAll('.enemy').forEach(el => {
      el.onclick = () => {
        if (this.busy) return;
        const uid = +el.dataset.uid;
        if (this.foes[uid].dead) return;
        if (this.menuMode === 'target') { this.target = uid; this._confirmTarget(); }
      };
    });

    // party
    const h = state.hero;
    const hpPct = Math.round((h.hp / h.maxHp) * 100);
    this.dom.party.innerHTML = `<div class="pc active">
      <div class="pc-name">${h.name} · L${h.level}</div>
      <div class="hpbar ${hpPct<35?'low':''}"><i style="width:${hpPct}%"></i></div>
      <div class="pc-stats">HP ${h.hp}/${h.maxHp} · <span class="mp">SP ${h.sp}/${h.maxSp}</span></div>
    </div>`;

    // menu
    if (this.menuMode === 'root') {
      const opts = this._rootOptions();
      this.dom.menu.innerHTML = opts.map((o, i) =>
        `<button class="${i === this.menuIndex ? 'sel' : ''}">${o}</button>`).join('');
      this._wireMenuButtons(opts);
    } else if (this.menuMode === 'target') {
      this.dom.menu.innerHTML = `<div style="align-self:center;color:var(--ink-dim)">Choose a target — ◀ ▶ / click · Esc back</div>`;
    } else {
      const list = this._subList();
      if (list.length === 0) {
        this.dom.menu.innerHTML = `<div style="color:var(--ink-dim)">Nothing here. Esc to go back.</div>`;
      } else {
        this.dom.menu.innerHTML = list.map((e, i) => {
          const label = this.menuMode === 'skill'
            ? `${e.name} <small>(${e.cost} SP)</small>`
            : `${e.icon} ${e.name} ×${e.qty}`;
          return `<button class="sub-btn ${i === this.menuIndex ? 'sel' : ''}" ${e.disabled ? 'disabled' : ''}>${label}</button>`;
        }).join('');
        this._wireSubButtons(list);
      }
    }
  }

  _wireMenuButtons(opts) {
    [...this.dom.menu.querySelectorAll('button')].forEach((b, i) => {
      b.onclick = () => { if (this.busy) return; this.menuIndex = i; this._chooseRoot(opts[i]); this.render(); };
    });
  }
  _wireSubButtons(list) {
    [...this.dom.menu.querySelectorAll('button')].forEach((b, i) => {
      b.onclick = () => { if (this.busy) return; this.menuIndex = i; this._chooseSub(list[i]); this.render(); };
    });
  }
}

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
