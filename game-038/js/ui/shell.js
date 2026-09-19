// ============================================================
// ui/shell.js - the screen router and the shared widgets (GDD 13)
// Screens are functions that return a node. Nothing here knows any rules;
// it reads state and calls the game layer.
// ============================================================
import { el, $, clear, num, cap } from '../core/util.js';
import { bus } from '../core/bus.js';
import { state } from '../game/state.js';
import { ELEMENTS, elementColour, elementName } from '../data/elements.js';
import { STATUSES } from '../data/statuses.js';
import { lineage } from '../data/lineages.js';
import { NODES } from '../data/world.js';
import { STAT_SHORT, STAT_LABEL, stageName, XP, BOND_MAX, MOVE_SLOTS } from '../data/constants.js';
import { statsOf, maxHp } from '../gen/dragon.js';
import { dragonSprite, itemIconEl, drawDragon } from './sprites.js';
import { sfx, unlock } from '../audio.js';

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V'];
const screens = new Map();
let currentScreen = null;
let currentArgs = null;

export function registerScreen(name, builder) { screens.set(name, builder); }

export function show(name, args = {}) {
  const builder = screens.get(name);
  if (!builder) { console.error('[shell] no screen', name); return; }
  currentScreen = name;
  currentArgs = args;
  const host = $('#screen');
  clear(host);
  host.scrollTop = 0;
  host.append(builder(args));
  syncChrome();
  bus.emit('screen:shown', { name, args });
}

export const currentScreenName = () => currentScreen;
export function refresh() { if (currentScreen) show(currentScreen, currentArgs); }

/** The top bar and tab bar follow the screen, not the other way round. */
export function syncChrome() {
  const inGame = currentScreen && !['title', 'battle', 'scene'].includes(currentScreen);
  $('#topbar').hidden = !currentScreen || currentScreen === 'title';
  $('#tabbar').hidden = !inGame;
  $('#coin').textContent = `● ${num(state.coin)}`;
  $('#act').textContent = `Act ${ROMAN[state.act] || state.act}`;
  const placeEl = $('#place');
  if (placeEl) placeEl.textContent = placeName();
  for (const b of document.querySelectorAll('#tabbar button')) {
    b.setAttribute('aria-current', String(b.dataset.tab === currentScreen));
  }
}

const placeName = () => (NODES[state.node] ? NODES[state.node].name : state.node);

// ------------------------------------------------------------------ toast --
export function toast(text, kind = '') {
  const host = $('#toasts');
  const node = el(`div.toast${kind ? '.' + kind : ''}`, null, text);
  host.append(node);
  setTimeout(() => { node.style.opacity = '0'; node.style.transition = 'opacity 260ms'; }, 2200);
  setTimeout(() => node.remove(), 2500);
}

// ---------------------------------------------------------------- overlay --
let overlayStack = [];

export function openOverlay(content, { onClose = null, dismissable = true } = {}) {
  const host = $('#overlay');
  host.hidden = false;
  document.body.classList.add('overlay-open');
  clear(host);
  const inner = el('div.overlay-inner');
  inner.append(content);
  host.append(inner);
  const entry = { onClose, dismissable };
  overlayStack.push(entry);
  host.onclick = (e) => { if (e.target === host && dismissable) closeOverlay(); };
  return entry;
}

export function closeOverlay() {
  const host = $('#overlay');
  const entry = overlayStack.pop();
  clear(host);
  host.hidden = true;
  document.body.classList.remove('overlay-open');
  if (entry && entry.onClose) entry.onClose();
}

export const overlayOpen = () => !$('#overlay').hidden;

/** A yes/no dialog that reads like a sentence, not a form. */
export function confirmDialog({ title, body, confirmText = 'Do it', cancelText = 'Not now', danger = false, onConfirm }) {
  const content = el('div', null,
    el('h2', null, title),
    body ? el('p.dim', null, body) : null,
    el('div.stack', null,
      el(`button.btn.wide${danger ? '.danger' : '.primary'}`, { onclick: () => { closeOverlay(); sfx.confirm(); onConfirm && onConfirm(); } }, confirmText),
      el('button.btn.wide', { onclick: () => { closeOverlay(); sfx.back(); } }, cancelText)));
  openOverlay(content);
}

export function infoDialog(title, body, after = null) {
  const content = el('div', null,
    el('h2', null, title),
    typeof body === 'string' ? el('p.dim', null, body) : body,
    el('button.btn.wide.primary', { onclick: () => { closeOverlay(); after && after(); } }, 'All right'));
  openOverlay(content, { onClose: null });
}

// ------------------------------------------------------------------ bars --
export function bar(value, max, cls = '') {
  const pctv = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return el(`div.bar${cls ? '.' + cls : ''}`, null, el('i', { style: { width: pctv + '%' } }));
}

export function elementTag(id) {
  if (!id) return null;
  return el('span.el-tag', { style: { color: elementColour(id) } }, elementName(id));
}

export function statusIcons(list) {
  return el('span.statuses', null, ...(list || []).map(s => {
    const def = STATUSES[s.id];
    return el('span', { title: `${def ? def.name : s.id} (${s.turns})` }, def ? def.icon : '?');
  }));
}

// ------------------------------------------------------------ dragon card --
/**
 * The dragon row used by the roster, the party picker and the shop.
 * `mode` decides what the right-hand side shows.
 */
export function dragonCard(d, { onClick = null, mode = 'full', selected = false, scale = 2 } = {}) {
  const s = statsOf(d);
  const lin = lineage(d.lineageId);
  const info = el('div.info', null,
    el('div.name-row', null,
      el('span.name', null, d.name),
      el('span.lvl', null, `Lv ${d.level} ${stageName(d.stage)}`)),
    el('div.tags', null,
      elementTag(d.elements[0]),
      d.elements[1] ? elementTag(d.elements[1]) : null,
      el('span.pill', null, lin.name),
      state.party.includes(d.id) ? el('span.pill.party', null, 'Party') : null,
      d.ashbound ? el('span.pill.ash', null, 'Ashbound') : null,
      (d.generation || 0) > 0 ? el('span.pill.gen', null, `Gen ${d.generation}`) : null),
    el('div.row', { style: { gap: '6px' } },
      el('span.faint', null, 'HP'), bar(d.hp, s.hp),
      el('span.faint', null, `${d.hp}/${s.hp}`)),
    mode === 'full' ? el('div.row', { style: { gap: '6px' } },
      el('span.faint', null, 'LEY'), bar(d.mp, s.mp, 'mp'),
      el('span.faint', null, `${d.mp}/${s.mp}`)) : null,
    mode === 'full' ? el('div.row', { style: { gap: '6px' } },
      el('span.faint', null, 'BOND'), bar(d.bond, BOND_MAX, 'bond'),
      el('span.faint', null, String(d.bond))) : null);

  const card = el(`div.card.dragon-card${onClick ? '.clickable' : ''}`, {
    onclick: onClick ? () => { unlock(); sfx.ui(); onClick(d); } : null,
    style: selected ? { borderColor: 'var(--ember)' } : null,
  },
    el('div.portrait', null, dragonSprite(d, { scale })),
    info);
  if (d.fainted) card.style.opacity = '0.5';
  return card;
}

// -------------------------------------------------------------- item row --
export function itemRow(def, { count = null, price = null, onClick = null, sub = null, disabled = false } = {}) {
  const row = el('div.item-row', null,
    itemIconEl(def, 2),
    el('div.grow', null,
      el('div.iname', null, def.name),
      el('div.desc', null, sub || def.desc || '')),
    count !== null ? el('span.count', null, `×${count}`) : null,
    price !== null ? el('span.price', null, `●${price}`) : null);
  if (!onClick) return el('div.card.tight', null, row);
  const btn = el('button.btn', { onclick: () => { unlock(); sfx.ui(); onClick(def); }, disabled }, row);
  btn.style.width = '100%';
  return btn;
}

// --------------------------------------------------------------- headers --
export function screenHeader(title, subtitle = null, right = null) {
  return el('div.row.spread', { style: { marginBottom: '10px', alignItems: 'flex-start' } },
    el('div.grow', null, el('h1', null, title), subtitle ? el('div.faint', null, subtitle) : null),
    right);
}

export function backButton(label, onClick) {
  return el('button.btn.small', { onclick: () => { sfx.back(); onClick(); } }, `← ${label}`);
}

export function emptyState(text) {
  return el('div.card.center', null, el('p.faint', null, text));
}

export { ROMAN };
