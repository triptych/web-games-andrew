// ============================================================
// ui/panels.js - the four panels plus the service sheets (GDD §27.7)
// Full-screen DOM sheets, one-thumb operable, dismissible by swipe.
// Panels pause nothing; the game is turn-based and nothing is happening.
// ============================================================
import { KNACKS } from '../data/knacks.js';
import { CAPABILITY_INFO } from '../gen/hollow/identity.js';
import { BASE_ITEMS } from '../data/items.js';
import { displayName, equip, unequip, useItem, removeItem, addItem, brew, identifyItem } from '../game/inventory.js';
import { itemValue, itemStats } from '../gen/item.js';
import { activeQuests, questsOf, dropQuest, refreshNeeds, questContext, findNpc } from '../game/quests.js';
import { buyPrice, sellPrice, buy, sell, payService, repairCost, stockOf } from '../game/economy.js';
import { spendAttribute, takeKnack, carriedWeight, recomputePlayer } from '../game/player.js';
import { renderFullLog } from './hud.js';
import { questTargetTile } from '../render/renderer.js';
import { rosterOf } from '../world/entities.js';
import { logLine } from '../game/state.js';
import {
  bindServices, shopPanel, stashPanel, noticesPanel,
  identifyPanel, repairPanel, levelUpPanel, settingsPanel,
} from './services.js';

const SERVICE_PANELS = {
  shop: shopPanel, stash: stashPanel, notices: noticesPanel,
  identify: identifyPanel, repair: repairPanel, levelup: levelUpPanel, settings: settingsPanel,
};

let host = null, onClose = null, state = null, refresh = null;

export function initPanels(el, refreshFn) { host = el; refresh = refreshFn; }

export function openPanel(st, name, arg) {
  state = st;
  host.innerHTML = '';
  host.hidden = false;
  host.dataset.panel = name;
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  const head = document.createElement('div');
  head.className = 'sheet-head';
  const title = document.createElement('h2');
  title.textContent = titleFor(name, arg);
  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close');
  close.onclick = closePanel;
  head.append(title, close);
  const body = document.createElement('div');
  body.className = 'sheet-body';
  sheet.append(head, body);
  host.appendChild(sheet);

  switch (name) {
    case 'inventory': inventoryPanel(body); break;
    case 'journal': journalPanel(body); break;
    case 'character': characterPanel(body); break;
    case 'ledger': ledgerPanel(body); break;
    case 'log': renderFullLog(state, body); break;
    case 'shop': case 'stash': case 'notices':
    case 'identify': case 'repair': case 'levelup': case 'settings':
      bindServices(state, openPanel);
      SERVICE_PANELS[name](body, arg);
      break;
    default: body.textContent = 'Nothing here.';
  }
}

function titleFor(name, arg) {
  return {
    inventory: 'What you are carrying', journal: 'Journal', character: 'The keeper',
    ledger: 'Ledger', log: 'What happened', shop: 'Trade', stash: 'The keepers’ chest',
    notices: 'Notice board', identify: 'The mortar', repair: 'The anvil',
    levelup: 'Steadier than you were', settings: 'Settings',
  }[name] || name;
}

export function closePanel() {
  host.hidden = true;
  host.innerHTML = '';
  if (refresh) refresh();
}

// --- inventory ------------------------------------------------------------

function inventoryPanel(body) {
  const p = state.player;
  const w = carriedWeight(p);
  const head = document.createElement('p');
  head.className = 'muted';
  head.textContent = `${w.toFixed(1)} of ${p.carry} carried · ${p.coin} coin`;
  body.appendChild(head);

  const eq = document.createElement('div');
  eq.className = 'group';
  eq.innerHTML = '<h3>Worn and held</h3>';
  for (const slot of ['hand', 'offhand', 'body', 'head', 'trinket1', 'trinket2']) {
    const it = p.equipment[slot];
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="slot">${slotName(slot)}</span><span class="iname">${it ? displayName(it) : '—'}</span>`;
    if (it) {
      const st = itemStats(it);
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = it.kind === 'weapon' ? `dmg ${st.damage} · ${st.energy}e` :
        it.kind === 'armour' ? `arm ${st.armour}` : it.kind === 'lantern' ? `light ${p.lightRadius}` : '';
      row.appendChild(meta);
      const btn = document.createElement('button');
      btn.textContent = 'Take off';
      btn.onclick = () => { unequip(p, slot); openPanel(state, 'inventory'); };
      row.appendChild(btn);
    }
    eq.appendChild(row);
  }
  body.appendChild(eq);

  const cats = { weapon: [], armour: [], tonic: [], food: [], reagent: [], other: [] };
  for (const it of p.inventory) {
    const k = it.kind === 'weapon' ? 'weapon' : it.kind === 'armour' || it.kind === 'lantern' ? 'armour'
      : it.kind === 'tonic' || it.kind === 'trinket' ? 'tonic' : it.kind === 'food' || it.kind === 'oil' ? 'food'
        : it.kind === 'reagent' ? 'reagent' : 'other';
    cats[k].push(it);
  }
  for (const [cat, list] of Object.entries(cats)) {
    if (!list.length) continue;
    const g = document.createElement('div');
    g.className = 'group';
    g.innerHTML = `<h3>${catName(cat)}</h3>`;
    for (const it of list) g.appendChild(itemRow(it));
    body.appendChild(g);
  }
  if (!p.inventory.length) body.insertAdjacentHTML('beforeend', '<p class="muted">Your pack is empty.</p>');
}

function itemRow(it) {
  const p = state.player;
  const row = document.createElement('div');
  row.className = 'row item';
  const name = document.createElement('span');
  name.className = 'iname';
  name.textContent = displayName(it) + ((it.stack || 1) > 1 ? ` ×${it.stack}` : '');
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = `${(it.weight || 0).toFixed(1)}kg${it.condition < 100 ? ' · ' + it.condition + '%' : ''}`;
  row.append(name, meta);

  const def = BASE_ITEMS[it.base];
  if (def && (def.slot || def.kind === 'tonic' || def.kind === 'food' || def.kind === 'oil' || def.kind === 'consumable')) {
    const use = document.createElement('button');
    use.textContent = def.slot && def.kind !== 'tonic' ? 'Wear' : 'Use';
    use.onclick = () => { useItem(p, it); openPanel(state, 'inventory'); };
    row.appendChild(use);
  }
  if (def && def.tonic) {
    const b = document.createElement('button');
    b.textContent = 'Brew';
    b.onclick = () => { brew(p, it.base); openPanel(state, 'inventory'); };
    row.appendChild(b);
  }
  if (!it.bound) {
    const drop = document.createElement('button');
    drop.className = 'ghost';
    drop.textContent = 'Drop';
    drop.onclick = () => { removeItem(p, it, it.stack || 1); openPanel(state, 'inventory'); };
    row.appendChild(drop);
  }
  return row;
}

const slotName = s => ({ hand: 'In hand', offhand: 'Offhand', body: 'Body', head: 'Head', trinket1: 'Trinket', trinket2: 'Trinket' }[s] || s);
const catName = c => ({ weapon: 'Weapons', armour: 'Wearables', tonic: 'Tonics and trinkets', food: 'Food and oil', reagent: 'Reagents', other: 'Other' }[c] || c);

// --- journal --------------------------------------------------------------

function journalPanel(body) {
  const quests = activeQuests(state);
  if (!quests.length) {
    body.innerHTML = '<p class="muted">Nothing on. Ask somebody what they need, or read a notice board at an inn.</p>';
    return;
  }
  // grouped by place, because players navigate spatially
  const byPlace = new Map();
  for (const q of quests) {
    const s = state.W.settlements.get(q.settlementId);
    const key = s ? s.name : 'Elsewhere';
    if (!byPlace.has(key)) byPlace.set(key, []);
    byPlace.get(key).push(q);
  }
  for (const [place, list] of byPlace) {
    const g = document.createElement('div');
    g.className = 'group';
    g.innerHTML = `<h3>${place}</h3>`;
    for (const q of list) {
      const beat = q.beats[q.current];
      const row = document.createElement('div');
      row.className = 'row quest' + (state.markedQuest === q.id ? ' marked' : '');
      const target = questTargetTile(state, q);
      const dist = target ? Math.round(Math.hypot(target.x - state.player.x, target.y - state.player.y)) : null;
      row.innerHTML = `<div class="qmain"><b>${q.title}</b><small>${beat ? beat.hint : 'Go back and say so.'}</small></div>` +
        (dist !== null ? `<span class="meta">${dist} ${arrowTo(target)}</span>` : '');
      const mark = document.createElement('button');
      mark.textContent = state.markedQuest === q.id ? 'Marked' : 'Mark';
      mark.onclick = () => { state.markedQuest = state.markedQuest === q.id ? null : q.id; openPanel(state, 'journal'); };
      const drop = document.createElement('button');
      drop.className = 'ghost';
      drop.textContent = 'Drop';
      drop.onclick = () => {
        if (!confirm(`Drop "${q.title}"?`)) return;
        dropQuest(state, q); openPanel(state, 'journal');
      };
      row.append(mark, drop);
      g.appendChild(row);
    }
    body.appendChild(g);
  }
  const threads = [...state.W.threads.values()].filter(t => t.state === 'active');
  if (threads.length) {
    const g = document.createElement('div');
    g.className = 'group';
    g.innerHTML = '<h3>Threads</h3>';
    for (const t of threads) {
      const region = state.W.regions.get(t.regionId);
      const beat = t.beats[t.current];
      const row = document.createElement('div');
      row.className = 'row quest';
      row.innerHTML = `<div class="qmain"><b>${region ? region.name : 'A region'}</b><small>${beat ? beat.hint : t.premise}</small></div>`;
      g.appendChild(row);
    }
    body.appendChild(g);
  }
}

function arrowTo(t) {
  if (!t) return '';
  const dx = t.x - state.player.x, dy = t.y - state.player.y;
  const a = Math.atan2(dy, dx);
  const i = Math.round((a + Math.PI) / (Math.PI / 4)) % 8;
  return ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'][i];
}

// --- character ------------------------------------------------------------

function characterPanel(body) {
  const p = state.player;
  body.innerHTML = `<p class="muted">Level ${p.level} · ${p.xp} xp · Vigor ${p.vigor} (${p.shards}/4 shards)</p>`;
  const g = document.createElement('div');
  g.className = 'group';
  g.innerHTML = '<h3>Attributes</h3>';
  for (const [k, label] of [['body', 'Body'], ['hand', 'Hand'], ['wit', 'Wit'], ['heart', 'Heart']]) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="slot">${label}</span><span class="iname">${p.attrs[k]}</span><span class="meta">${attrBlurb(k)}</span>`;
    if (p.attrPoints > 0) {
      const b = document.createElement('button');
      b.textContent = '+1';
      b.onclick = () => { spendAttribute(p, k); openPanel(state, 'character'); };
      row.appendChild(b);
    }
    g.appendChild(row);
  }
  body.appendChild(g);

  const d = document.createElement('div');
  d.className = 'group';
  d.innerHTML = `<h3>Derived</h3>
    <div class="row"><span class="slot">Health</span><span class="iname">${Math.round(p.hp)}/${Math.round(p.maxHp)}</span></div>
    <div class="row"><span class="slot">Armour</span><span class="iname">${p.armour}</span></div>
    <div class="row"><span class="slot">Crit</span><span class="iname">${Math.round(p.critChance * 100)}%</span></div>
    <div class="row"><span class="slot">Carry</span><span class="iname">${carriedWeight(p).toFixed(1)}/${p.carry}</span></div>
    <div class="row"><span class="slot">Light</span><span class="iname">${p.lightRadius}</span></div>
    <div class="row"><span class="slot">Stealth</span><span class="iname">${p.stealth.toFixed(1)}</span></div>`;
  body.appendChild(d);

  const caps = document.createElement('div');
  caps.className = 'group';
  caps.innerHTML = '<h3>What you can do</h3>';
  const all = ['ember_jar', 'grapple_vine', 'bell', 'spade', 'green_flame', 'boat_whistle'];
  for (const k of all) {
    const info = CAPABILITY_INFO[k];
    const has = p.caps.has(k);
    const row = document.createElement('div');
    row.className = 'row' + (has ? '' : ' muted');
    row.innerHTML = `<span class="slot">${info.icon}</span><span class="iname">${has ? info.name : '———'}</span><span class="meta">${has ? info.gate : 'not found yet'}</span>`;
    caps.appendChild(row);
  }
  body.appendChild(caps);

  if (p.knacks.length) {
    const kn = document.createElement('div');
    kn.className = 'group';
    kn.innerHTML = '<h3>Knacks</h3>';
    for (const k of p.knacks) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span class="iname">${KNACKS[k].name}</span><span class="meta">${KNACKS[k].blurb}</span>`;
      kn.appendChild(row);
    }
    body.appendChild(kn);
  }
}

const attrBlurb = k => ({
  body: 'health, melee, carry', hand: 'ranged, crits, locks',
  wit: 'tools, secrets, puzzles', heart: 'people, the Quiet, forage',
}[k]);

// --- ledger ---------------------------------------------------------------

function ledgerPanel(body) {
  if (!state.ledger.length) { body.innerHTML = '<p class="muted">Nothing worth writing down yet.</p>'; return; }
  for (const l of [...state.ledger].reverse()) {
    const row = document.createElement('div');
    row.className = 'row ledger';
    row.innerHTML = `<span class="meta">day ${Math.floor(l.tick / 2400)}</span><span class="iname">${l.text}</span>`;
    body.appendChild(row);
  }
}

// --- services -------------------------------------------------------------

export function applySettings(st) {
  document.documentElement.style.setProperty('--text-scale', st.settings.textSize);
  document.body.classList.toggle('left-handed', st.settings.handedness === 'left');
  document.body.classList.toggle('reduced-motion', !!st.settings.reducedMotion);
}

export { host as panelHost };
