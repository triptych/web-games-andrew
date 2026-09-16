// ============================================================
// ui/hud.js - the top bar, the log strip, and the control bar (GDD §27.1)
// DOM, not canvas: better at text, scrolling and screen readers.
// ============================================================
import { LANTERN_CAPACITY } from '../data/constants.js';
import { CAPABILITY_INFO } from '../gen/hollow/identity.js';
import { clockString, hourOf } from '../game/time.js';
import { STATUSES } from '../game/status.js';
import { contextVerb } from '../game/actions.js';
import { drawMinimap } from '../render/minimap.js';

let els = {};

export function initHud(refs) {
  els = refs;
}

export function renderHud(state) {
  const p = state.player;
  if (!p || !els.hearts) return;

  // hearts: one glyph per Vigor, half-filled by HP within it
  const hp = Math.max(0, p.hp), max = p.maxHp;
  const pips = Math.max(1, p.vigor);
  const perPip = max / pips;
  let hearts = '';
  for (let i = 0; i < pips; i++) {
    const v = Math.max(0, Math.min(1, (hp - i * perPip) / perPip));
    hearts += v > 0.66 ? '♥' : v > 0.15 ? '♡' : '·';
  }
  els.hearts.textContent = hearts;
  els.hearts.setAttribute('aria-label', `${Math.round(hp)} of ${Math.round(max)} health`);
  els.hp.textContent = `${Math.round(hp)}/${Math.round(max)}`;

  const oilPct = Math.round((p.lanternOil / LANTERN_CAPACITY) * 100);
  els.oil.textContent = `${p.lanternLit ? (p.greenFlame ? '✳' : '◉') : '○'} ${p.lanternOil}`;
  els.oil.className = 'stat' + (p.lanternOil < 12 ? ' low' : '');
  els.oil.title = `Lantern oil ${oilPct}%`;

  els.clock.textContent = `${nightGlyph(state)} ${clockString(state.tick)}`;
  els.coin.textContent = `◎ ${p.coin}`;
  els.place.textContent = state.placeLabel || '';

  // statuses, as icons with counters
  els.statuses.innerHTML = '';
  for (const s of p.statuses) {
    const def = STATUSES[s.key];
    if (!def) continue;
    const span = document.createElement('span');
    span.className = 'status' + (def.bad ? ' bad' : ' good');
    span.textContent = `${def.icon}${s.turns < 9000 ? s.turns : ''}`;
    span.title = def.name;
    els.statuses.appendChild(span);
  }

  // the context button says what it will do
  const c = contextVerb(state);
  els.contextBtn.textContent = c.verb.charAt(0).toUpperCase() + c.verb.slice(1);
  els.contextBtn.dataset.verb = c.verb;

  // the tool belt
  renderTools(state, p);

  // the log strip
  renderLog(state);

  if (els.minimap) {
    const mctx = els.minimap.getContext('2d');
    drawMinimap(mctx, state, els.minimap.width);
  }
}

function nightGlyph(state) {
  const h = hourOf(state.tick);
  if (h >= 20 || h < 4) return '☾';
  if (h < 7 || h >= 19) return '◑';
  return '☀';
}

const TOOL_ORDER = ['ember_jar', 'grapple_vine', 'bell', 'spade', 'green_flame', 'boat_whistle'];

function renderTools(state, p) {
  if (!els.tools) return;
  els.tools.innerHTML = '';
  const owned = TOOL_ORDER.filter(k => p.caps.has(k));
  for (let i = 0; i < 4; i++) {
    const key = owned[i];
    const btn = document.createElement('button');
    btn.className = 'toolbtn' + (key ? '' : ' empty');
    if (key) {
      const info = CAPABILITY_INFO[key];
      btn.textContent = info.icon;
      btn.title = `${info.name} — ${info.gate}`;
      btn.setAttribute('aria-label', info.name);
      btn.dataset.tool = key;
      const ch = p.toolCharges[key] ?? 0;
      const pip = document.createElement('span');
      pip.className = 'charges';
      pip.textContent = ch > 0 ? String(ch) : '–';
      btn.appendChild(pip);
    } else {
      btn.textContent = '';
      btn.setAttribute('aria-label', 'empty tool slot');
      btn.disabled = true;
    }
    els.tools.appendChild(btn);
  }
}

let lastLogLen = 0;
function renderLog(state) {
  if (!els.log) return;
  if (state.log.length === lastLogLen) return;
  lastLogLen = state.log.length;
  const recent = state.log.slice(-2);
  els.log.innerHTML = '';
  for (const l of recent) {
    const div = document.createElement('div');
    div.className = 'logline ' + (l.tone || 'plain');
    div.textContent = l.text + (l.count > 1 ? ` (x${l.count})` : '');
    els.log.appendChild(div);
  }
  els.log.scrollTop = els.log.scrollHeight;
}

export function renderFullLog(state, host) {
  host.innerHTML = '';
  for (const l of state.log.slice(-80)) {
    const div = document.createElement('div');
    div.className = 'logline ' + (l.tone || 'plain');
    div.textContent = l.text + (l.count > 1 ? ` (x${l.count})` : '');
    host.appendChild(div);
  }
  host.scrollTop = host.scrollHeight;
}
