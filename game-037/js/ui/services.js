// ============================================================
// ui/services.js - the sheets you get from a prop, not from the top bar
// Shops, the stash, notice boards, the mortar, the anvil, level-ups, settings.
// ============================================================
import { KNACKS } from '../data/knacks.js';
import { BASE_ITEMS } from '../data/items.js';
import { displayName, addItem, removeItem, identifyItem } from '../game/inventory.js';
import { buyPrice, sellPrice, buy, sell, payService, repairCost, stockOf } from '../game/economy.js';
import { questsOf, refreshNeeds } from '../game/quests.js';
import { takeKnack, recomputePlayer } from '../game/player.js';
import { rosterOf } from '../world/entities.js';
import { logLine } from '../game/state.js';

/** The panel module hands these its state and a way to re-open a panel. */
let state = null, openPanel = null;
export function bindServices(st, opener) { state = st; openPanel = opener; }

export function shopPanel(body, arg) {
  const p = state.player;
  const npc = arg && arg.npc ? arg.npc : nearestMerchant();
  if (!npc) { body.innerHTML = '<p class="muted">Nobody here is selling.</p>'; return; }
  body.innerHTML = `<p class="muted">${npc.shortName}, ${npc.trade}. You have ${p.coin} coin.</p>`;

  const buying = document.createElement('div');
  buying.className = 'group';
  buying.innerHTML = '<h3>For sale</h3>';
  for (const it of stockOf(state, npc)) {
    const row = document.createElement('div');
    row.className = 'row item';
    row.innerHTML = `<span class="iname">${displayName(it)}${(it.stack || 1) > 1 ? ' ×' + it.stack : ''}</span><span class="meta">${buyPrice(state, npc, it)}c</span>`;
    const b = document.createElement('button');
    b.textContent = 'Buy';
    b.onclick = () => { buy(state, npc, it); openPanel(state, 'shop', { npc }); };
    row.appendChild(b);
    buying.appendChild(row);
  }
  body.appendChild(buying);

  const selling = document.createElement('div');
  selling.className = 'group';
  selling.innerHTML = '<h3>Yours</h3>';
  for (const it of p.inventory.filter(i => !i.bound)) {
    const row = document.createElement('div');
    row.className = 'row item';
    row.innerHTML = `<span class="iname">${displayName(it)}${(it.stack || 1) > 1 ? ' ×' + it.stack : ''}</span><span class="meta">${sellPrice(state, npc, it)}c</span>`;
    const b = document.createElement('button');
    b.textContent = 'Sell';
    b.onclick = () => { sell(state, npc, it); openPanel(state, 'shop', { npc }); };
    row.appendChild(b);
    selling.appendChild(row);
  }
  body.appendChild(selling);
}

function nearestMerchant() {
  let best = null, bd = Infinity;
  for (const e of state.entities) {
    if (!e.isNpc) continue;
    const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
    if (d < bd) { bd = d; best = e.npc; }
  }
  return best;
}

export function stashPanel(body) {
  const p = state.player;
  body.innerHTML = '<p class="muted">One chest, shared by every inn. Leave what you cannot carry.</p>';
  const inChest = document.createElement('div');
  inChest.className = 'group';
  inChest.innerHTML = '<h3>In the chest</h3>';
  for (const it of state.stash) {
    const row = document.createElement('div');
    row.className = 'row item';
    row.innerHTML = `<span class="iname">${displayName(it)}</span>`;
    const b = document.createElement('button');
    b.textContent = 'Take';
    b.onclick = () => {
      state.stash.splice(state.stash.indexOf(it), 1);
      addItem(p, it);
      openPanel(state, 'stash');
    };
    row.appendChild(b);
    inChest.appendChild(row);
  }
  if (!state.stash.length) inChest.insertAdjacentHTML('beforeend', '<p class="muted">Empty.</p>');
  body.appendChild(inChest);

  const mine = document.createElement('div');
  mine.className = 'group';
  mine.innerHTML = '<h3>On you</h3>';
  for (const it of p.inventory.filter(i => !i.bound)) {
    const row = document.createElement('div');
    row.className = 'row item';
    row.innerHTML = `<span class="iname">${displayName(it)}</span>`;
    const b = document.createElement('button');
    b.textContent = 'Leave';
    b.onclick = () => { removeItem(p, it, it.stack || 1); state.stash.push(it); openPanel(state, 'stash'); };
    row.appendChild(b);
    mine.appendChild(row);
  }
  body.appendChild(mine);
}

/** The discoverability backstop: work you can find without talking to anybody. */
export function noticesPanel(body, arg) {
  const settleId = arg && arg.settlement;
  const settle = state.W.settlements.get(settleId);
  if (!settle) { body.innerHTML = '<p class="muted">Blank.</p>'; return; }
  body.innerHTML = `<p class="muted">Pinned up in ${settle.name}.</p>`;
  const roster = rosterOf(state, settleId).filter(n => n.state === 'alive');
  let shown = 0;
  for (const npc of roster) {
    refreshNeeds(state, npc);
    for (const q of questsOf(state, npc.id)) {
      if (q.state === 'active' || shown >= 6) continue;
      shown++;
      const row = document.createElement('div');
      row.className = 'row quest';
      row.innerHTML = `<div class="qmain"><b>${q.title}</b><small>${q.summary}</small></div>`;
      const b = document.createElement('button');
      b.textContent = 'Take it';
      b.onclick = () => {
        // disposition rewards are halved: you did not ask in person
        for (const r of q.rewards) if (r.kind === 'disposition') r.value = Math.round(r.value / 2);
        q.state = 'active';
        logLine(`${q.title}. ${q.beats[0] ? q.beats[0].hint : ''}`, 'good');
        openPanel(state, 'notices', arg);
      };
      row.appendChild(b);
      body.appendChild(row);
    }
  }
  if (!shown) body.insertAdjacentHTML('beforeend', '<p class="muted">Nothing pinned up today.</p>');
}

export function identifyPanel(body) {
  const p = state.player;
  body.innerHTML = '<p class="muted">Twenty-five coin and a little time. It always works.</p>';
  const unknown = p.inventory.filter(i => !i.identified);
  if (!unknown.length) { body.insertAdjacentHTML('beforeend', '<p class="muted">You know what everything is.</p>'); return; }
  for (const it of unknown) {
    const row = document.createElement('div');
    row.className = 'row item';
    row.innerHTML = `<span class="iname">${displayName(it)}</span><span class="meta">25c</span>`;
    const b = document.createElement('button');
    b.textContent = 'Identify';
    b.onclick = () => {
      if (!payService(state, 'identify')) return;
      identifyItem(p, it);
      openPanel(state, 'identify');
    };
    row.appendChild(b);
    body.appendChild(row);
  }
}

export function repairPanel(body) {
  const p = state.player;
  body.innerHTML = '<p class="muted">Eight coin the quarter, more for better work.</p>';
  const damaged = [...Object.values(p.equipment), ...p.inventory].filter(i => i && i.condition < 100);
  if (!damaged.length) { body.insertAdjacentHTML('beforeend', '<p class="muted">Nothing needs it.</p>'); return; }
  for (const it of damaged) {
    const cost = Math.round(repairCost(it) * (p.mods.repairCost || 1));
    const row = document.createElement('div');
    row.className = 'row item';
    row.innerHTML = `<span class="iname">${displayName(it)}</span><span class="meta">${it.condition}% · ${cost}c</span>`;
    const b = document.createElement('button');
    b.textContent = 'Mend';
    b.onclick = () => {
      if (p.coin < cost) { logLine('Not enough coin.', 'plain'); return; }
      p.coin -= cost;
      it.condition = 100;
      recomputePlayer(p);
      openPanel(state, 'repair');
    };
    row.appendChild(b);
    body.appendChild(row);
  }
}

export function levelUpPanel(body) {
  const p = state.player;
  const choice = state.pendingLevelChoice;
  if (!choice) { body.innerHTML = '<p class="muted">Nothing to choose.</p>'; return; }
  body.innerHTML = '<p class="muted">Pick one. It is yours for good.</p>';
  for (const key of choice.options) {
    const k = KNACKS[key];
    const row = document.createElement('div');
    row.className = 'row quest';
    row.innerHTML = `<div class="qmain"><b>${k.name}</b><small>${k.blurb}</small></div>`;
    const b = document.createElement('button');
    b.textContent = 'Take it';
    b.onclick = () => { takeKnack(p, key); state.pendingLevelChoice = null; closePanel(); };
    row.appendChild(b);
    body.appendChild(row);
  }
}

export function settingsPanel(body) {
  const s = state.settings;
  const mk = (label, key, values) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="slot">${label}</span>`;
    for (const v of values) {
      const b = document.createElement('button');
      b.textContent = String(v.label);
      b.className = s[key] === v.value ? '' : 'ghost';
      b.onclick = () => { s[key] = v.value; applySettings(state); openPanel(state, 'settings'); };
      row.appendChild(b);
    }
    body.appendChild(row);
  };
  mk('Text size', 'textSize', [{ label: '100%', value: 1 }, { label: '115%', value: 1.15 }, { label: '130%', value: 1.3 }]);
  mk('Handedness', 'handedness', [{ label: 'Right', value: 'right' }, { label: 'Left', value: 'left' }]);
  mk('Sound', 'audio', [{ label: 'On', value: true }, { label: 'Off', value: false }]);
  mk('Haptics', 'haptics', [{ label: 'On', value: true }, { label: 'Off', value: false }]);
  mk('Reduced motion', 'reducedMotion', [{ label: 'On', value: true }, { label: 'Off', value: false }]);
  mk('Dev overlay', 'showDev', [{ label: 'On', value: true }, { label: 'Off', value: false }]);
  const seed = document.createElement('p');
  seed.className = 'muted';
  seed.textContent = `Seed: "${state.master.string}" · difficulty ${state.difficulty}`;
  body.appendChild(seed);
}

