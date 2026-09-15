// ============================================================
// ui/mapscreen.js - the world map, in a field-notebook style (GDD §25.8)
// The player's mental model, made visible. Worth real polish effort.
// ============================================================
import { drawWorldMap } from '../render/minimap.js';
import { TICKS_PER_HOUR } from '../data/constants.js';
import { logLine } from '../game/state.js';

let host = null, canvas = null, state = null, pan = { x: 0, y: 0, scale: 1 }, refresh = null;

export function initMapScreen(el, refreshFn) {
  host = el;
  refresh = refreshFn;
}

export function openMap(st) {
  state = st;
  host.hidden = false;
  host.innerHTML = '';
  const sheet = document.createElement('div');
  sheet.className = 'sheet map';
  const head = document.createElement('div');
  head.className = 'sheet-head';
  head.innerHTML = '<h2>The country</h2>';
  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = '×';
  close.onclick = () => { host.hidden = true; host.innerHTML = ''; if (refresh) refresh(); };
  head.appendChild(close);
  sheet.appendChild(head);

  canvas = document.createElement('canvas');
  canvas.className = 'mapcanvas';
  const size = Math.min(window.innerWidth - 24, window.innerHeight - 180, 620);
  canvas.width = size; canvas.height = size;
  sheet.appendChild(canvas);

  const info = document.createElement('div');
  info.className = 'mapinfo';
  sheet.appendChild(info);

  const travel = document.createElement('div');
  travel.className = 'group';
  sheet.appendChild(travel);
  renderTravel(travel);

  host.appendChild(sheet);
  pan = { x: 0, y: 0, scale: 1 };
  redraw(info);

  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    pan.x -= (e.clientX - lastX) * (1536 / canvas.width) / pan.scale;
    pan.y -= (e.clientY - lastY) * (1536 / canvas.height) / pan.scale;
    lastX = e.clientX; lastY = e.clientY;
    redraw(info);
  });
  canvas.addEventListener('pointerup', e => { dragging = false; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    pan.scale = Math.max(1, Math.min(6, pan.scale * (e.deltaY < 0 ? 1.2 : 0.83)));
    redraw(info);
  }, { passive: false });
  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    const tx = Math.round(((e.clientX - r.left) / r.width) * 1536 / pan.scale + pan.x);
    const ty = Math.round(((e.clientY - r.top) / r.height) * 1536 / pan.scale + pan.y);
    describe(info, tx, ty);
  });
}

function redraw(info) {
  const ctx = canvas.getContext('2d');
  drawWorldMap(ctx, state, canvas.width, canvas.height, pan);
  if (info && !info.textContent) info.textContent = 'Tap a place you have been.';
}

function describe(info, tx, ty) {
  let best = null, bd = 900;
  for (const s of state.W.settlements.values()) {
    if (!state.knowledge.places.has(s.id)) continue;
    const d = (s.x - tx) ** 2 + (s.y - ty) ** 2;
    if (d < bd) { bd = d; best = { kind: 'settlement', o: s }; }
  }
  for (const h of state.W.hollows.values()) {
    if (!h.discovered) continue;
    const d = (h.mouth.x - tx) ** 2 + (h.mouth.y - ty) ** 2;
    if (d < bd) { bd = d; best = { kind: 'hollow', o: h }; }
  }
  if (!best) { info.textContent = 'Nothing you know about, out there.'; return; }
  if (best.kind === 'settlement') {
    const region = state.W.regions.get(best.o.regionId);
    info.textContent = `${best.o.name}, a ${best.o.size} in ${region.name}. Quiet ${(region.quiet * 100) | 0}%.`;
  } else {
    const h = best.o;
    const region = state.W.regions.get(h.regionId);
    info.textContent = `${h.name}. ${h.lit ? 'Lit.' : 'Not lit.'} ${h.depth} floors. ${dangerReading(region.tier)}`;
  }
}

const dangerReading = tier => [
  'Nothing in there you have not met.', 'It will test you.', 'Take oil.',
  'The air here is older.', 'You are not ready for this.', 'Do not go alone.', 'Do not go.',
][Math.min(6, tier)];

/** Hearth-to-hearth travel, once three Hollows are lit. */
function renderTravel(host2) {
  let lit = 0;
  for (const h of state.W.hollows.values()) if (h.lit) lit++;
  if (lit < 3) {
    host2.innerHTML = `<p class="muted">Light three Hollows and the hearths will take you between them. (${lit}/3)</p>`;
    return;
  }
  host2.innerHTML = '<h3>Travel from a lit hearth</h3>';
  const p = state.player;
  const nearHearth = [...state.W.settlements.values()].some(s => Math.hypot(s.x - p.x, s.y - p.y) < 14);
  if (!nearHearth) { host2.insertAdjacentHTML('beforeend', '<p class="muted">Stand at a hearth first.</p>'); return; }
  for (const s of state.W.settlements.values()) {
    if (!state.knowledge.places.has(s.id)) continue;
    if (Math.hypot(s.x - p.x, s.y - p.y) < 14) continue;
    const region = state.W.regions.get(s.regionId);
    const cost = 40 + 6 * Math.abs(region.tier - 0);
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="iname">${s.name}</span><span class="meta">${cost} turns, 1 oil</span>`;
    const b = document.createElement('button');
    b.textContent = 'Walk there';
    b.onclick = () => {
      const cheap = p.mods.cheapTravel;
      if (!cheap && p.lanternOil < 1) { logLine('You would want oil for that walk.', 'plain'); return; }
      if (!cheap) p.lanternOil -= 1;
      p.x = s.x; p.y = s.y;
      state.travelPending = Math.round(cost * (cheap ? 0.5 : 1));
      host.hidden = true; host.innerHTML = '';
      if (refresh) refresh();
    };
    row.appendChild(b);
    host2.appendChild(row);
  }
}
