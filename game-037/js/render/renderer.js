// ============================================================
// render/renderer.js - the draw pipeline (GDD §25.2)
// One canvas for the world; DOM for text. Redraw only when something changed.
// ============================================================
import { TILE, TARGET_TILES_ACROSS, AMBIENT, QUIET_VARIANTS } from '../data/constants.js';
import { T, F, tileDef } from '../data/tiles.js';
import { O, objDef } from '../data/objects.js';
import { MONSTERS } from '../data/monsters.js';
import { BIOMES } from '../data/biomes.js';
import { STATUSES } from '../game/status.js';
import { decorKey } from '../gen/chunk.js';
import { biomeAt } from '../gen/fields.js';
import { quietAt } from '../gen/regions.js';
import { groundAt, objectAt, decorAt, flagsAt, propAt, inBounds } from '../world/access.js';
import { hsl } from './palette.js';
import { effects, tick as tickEffects, progressOf, shakeOffset, floaters } from './effects.js';
import { ambientDarkness } from '../game/time.js';
import { floorItemsAt } from '../game/actions.js';

export const view = {
  zoom: 2, cx: 0, cy: 0, targetCx: 0, targetCy: 0, w: 0, h: 0,
  tilesX: 0, tilesY: 0, dirty: true, snap: true,
};

let canvas = null, ctx = null, lightCanvas = null, lightCtx = null, atlas = null;

export function initRenderer(canvasEl, atlasRef) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d', { alpha: false });
  atlas = atlasRef;
  lightCanvas = document.createElement('canvas');
  lightCtx = lightCanvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

export function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cssW = canvas.clientWidth || window.innerWidth;
  const cssH = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  // Integer zoom keeps the pixels crisp, but a naive floor on a desktop DPR
  // lands at 8x and shows eight tiles. Pick the tile count from the CSS width
  // first, then round to the nearest zoom that keeps it in a legible band.
  const desiredAcross = Math.max(TARGET_TILES_ACROSS, Math.min(29, Math.round(cssW / 24)));
  let zoom = Math.max(2, Math.round(canvas.width / (TILE * desiredAcross)));
  while (canvas.width / (TILE * zoom) > 36 && zoom < 10) zoom++;
  while (canvas.width / (TILE * zoom) < 13 && zoom > 2) zoom--;
  view.zoom = zoom;
  view.w = canvas.width; view.h = canvas.height;
  view.tilesX = Math.ceil(canvas.width / (TILE * view.zoom)) + 2;
  view.tilesY = Math.ceil(canvas.height / (TILE * view.zoom)) + 3;
  lightCanvas.width = Math.max(1, Math.ceil(canvas.width / 2));
  lightCanvas.height = Math.max(1, Math.ceil(canvas.height / 2));
  ctx.imageSmoothingEnabled = false;
  view.dirty = true;
}

export const markDirty = () => { view.dirty = true; };

/** Camera with a 3-tile dead zone, eased. Snaps on teleport and floor change. */
export function updateCamera(state) {
  const p = state.player;
  if (!p) return;
  const dz = 3;
  if (Math.abs(p.x - view.targetCx) > dz) view.targetCx = p.x - Math.sign(p.x - view.targetCx) * dz;
  if (Math.abs(p.y - view.targetCy) > dz) view.targetCy = p.y - Math.sign(p.y - view.targetCy) * dz;
  if (view.snap) { view.cx = p.x; view.cy = p.y; view.targetCx = p.x; view.targetCy = p.y; view.snap = false; }
  else {
    view.cx += (view.targetCx - view.cx) * 0.18;
    view.cy += (view.targetCy - view.cy) * 0.18;
  }
}

export function snapCamera() { view.snap = true; }

const variantFor = q => {
  for (let i = QUIET_VARIANTS.length - 1; i >= 0; i--) if (q >= QUIET_VARIANTS[i]) return i;
  return 0;
};

/** The whole frame. Steps are the contract in §25.2. */
export function render(state, now) {
  if (!ctx || !atlas || !atlas.ready) return;
  const p = state.player;
  if (!p) return;

  const z = view.zoom, ts = TILE;
  const [shx, shy] = shakeOffset(now);
  const originX = Math.round(view.cx * ts - view.w / (2 * z) + shx);
  const originY = Math.round(view.cy * ts - view.h / (2 * z) + shy);

  const x0 = Math.floor(originX / ts) - 1, y0 = Math.floor(originY / ts) - 1;
  const x1 = x0 + view.tilesX + 2, y1 = y0 + view.tilesY + 2;

  // 1. clear to the biome's ambient colour
  const biome = state.mode === 'hollow' ? null : biomeAt(state.W, p.x, p.y);
  const amb = state.mode === 'hollow' ? [220, 0.06, 0.08] : ambientOf(state, biome);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Unwalked country is not a colour the player can read anything into.
  ctx.fillStyle = hsl(amb[0], amb[1] * 0.35, Math.min(0.10, amb[2] * 0.22));
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.setTransform(z, 0, 0, z, -originX * z, -originY * z);
  ctx.imageSmoothingEnabled = false;

  const visible = state.visible || new Set();
  const quietOf = (x, y) => state.mode === 'hollow'
    ? 0.2
    : quietAt(state.W, state.W.regions, x, y);

  const seen = [];
  // 2-5. ground, decals, decor, items
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inBounds(state, x, y)) continue;
      const fl = flagsAt(state, x, y);
      const isVisible = visible.has(x * 4096 + y);
      if (!isVisible && !(fl & F.EXPLORED)) continue;
      const q = quietOf(x, y);
      const v = variantFor(q);
      const sx = x * ts, sy = y * ts;

      const g = tileDef(groundAt(state, x, y));
      atlas.draw(ctx, 'g:' + g.key, sx, sy, v);
      const d = decorAt(state, x, y);
      if (d) atlas.draw(ctx, 'd:' + decorKey(d), sx, sy, v);
      const items = floorItemsAt(state, x, y);
      if (items && items.length) atlas.draw(ctx, 'i:' + itemSprite(items[0]), sx, sy, v);

      if (!isVisible) { ctx.fillStyle = 'rgba(8,10,18,0.55)'; ctx.fillRect(sx, sy, ts, ts); }
      else seen.push([x, y, v]);
    }
  }

  // 6. object layer, sorted by y for overlap
  const objs = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inBounds(state, x, y)) continue;
    const fl = flagsAt(state, x, y);
    const isVisible = visible.has(x * 4096 + y);
    if (!isVisible && !(fl & F.EXPLORED)) continue;
    const o = objectAt(state, x, y);
    if (!o) continue;
    if ((fl & F.SECRET) && !(propAt(state, x, y) || {}).revealed && o === O.cracked_wall) { /* still drawn */ }
    objs.push([x, y, o, isVisible, variantFor(quietOf(x, y))]);
  }
  objs.sort((a, b) => a[1] - b[1]);
  for (const [x, y, o, isVisible, v] of objs) {
    const def = objDef(o);
    atlas.draw(ctx, 'o:' + def.sprite, x * ts, y * ts, v);
    if (!isVisible) { ctx.fillStyle = 'rgba(8,10,18,0.55)'; ctx.fillRect(x * ts, y * ts - 8, ts, ts + 8); }
  }

  // 7-8. actors, sorted by y then id, plus awareness marks
  const actors = [p, ...state.entities.filter(e => e.hp > 0 || e.isNpc)]
    .filter(a => visible.has(a.x * 4096 + a.y) || a === p)
    .sort((a, b) => a.y - b.y || String(a.id).localeCompare(String(b.id)));
  for (const a of actors) drawActor(ctx, state, a, ts, now);

  // 9. effects: telegraph markers
  for (const e of state.entities) {
    if (!e.windup || e.hp <= 0) continue;
    ctx.fillStyle = 'rgba(220,70,70,0.30)';
    ctx.fillRect(e.windup.x * ts, e.windup.y * ts, ts, ts);
    ctx.strokeStyle = 'rgba(240,120,120,0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(e.windup.x * ts + 0.5, e.windup.y * ts + 0.5, ts - 1, ts - 1);
  }

  // 10. roofs, faded out for the building the player is in
  drawRoofs(ctx, state, x0, y0, x1, y1, ts, now);

  // 11. lighting and the Quiet composite
  composite(state, originX, originY, z, ts);

  // 12. floaters
  ctx.setTransform(z, 0, 0, z, -originX * z, -originY * z);
  for (const f of floaters()) {
    const t = progressOf(f, now);
    ctx.globalAlpha = 1 - t;
    ctx.font = 'bold 7px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(f.text, f.x * ts + 8, f.y * ts + 4 - t * 10);
    ctx.fillStyle = f.color || '#fff';
    ctx.fillText(f.text, f.x * ts + 8, f.y * ts + 4 - t * 10);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';

  // 13. edge chevrons for the marked objective
  drawChevron(state, ts, z, originX, originY);

  view.dirty = false;
}

function ambientOf(state, biome) {
  const B = BIOMES[biome] || BIOMES.meadow;
  return B.ambient;
}

function itemSprite(item) {
  if (!item) return 'coin';
  const kind = item.kind;
  if (kind === 'weapon') return 'weapon';
  if (kind === 'armour') return 'armour';
  if (kind === 'lantern') return 'lantern';
  if (kind === 'tonic') return 'tonic';
  if (kind === 'food') return 'food';
  if (kind === 'reagent') return 'reagent';
  if (kind === 'oil') return 'oil';
  if (kind === 'trinket') return 'trinket';
  if (kind === 'key') return 'key';
  if (kind === 'shard') return 'shard';
  if (kind === 'lore') return 'lore';
  if (kind === 'ammo') return 'ammo';
  return 'coin';
}

function drawActor(ctx, state, a, ts, now) {
  let px = a.x * ts, py = a.y * ts;
  const mv = effects.queue.find(e => e.kind === 'lerpMove' && e.actorId === a.id);
  if (mv) {
    const t = progressOf(mv, now);
    px = (mv.from.x + (mv.to.x - mv.from.x) * t) * ts;
    py = (mv.from.y + (mv.to.y - mv.from.y) * t) * ts;
  }

  const flash = effects.queue.find(e => e.kind === 'hitFlash' && e.actorId === a.id);

  if (a.isPlayer) {
    atlas.draw(ctx, 'p:player_body', px, py, 0);
    atlas.draw(ctx, 'p:player_head', px, py, 0);
    atlas.draw(ctx, 'p:player_hair', px, py, 0);
    if (a.lanternLit) atlas.draw(ctx, 'p:player_lantern', px, py, 0);
    atlas.draw(ctx, 'p:player_weapon', px, py, 0);
  } else if (a.isNpc) {
    atlas.draw(ctx, 'a:biped', px, py, 0);
    ctx.fillStyle = 'rgba(255,240,200,0.9)';
    ctx.fillRect(px + 6, py - 3, 4, 2);
  } else {
    const A = MONSTERS[a.archetype];
    const sil = A ? A.sprite.silhouette : 'biped';
    atlas.draw(ctx, 'a:' + sil, px, py, a.forgotten ? 3 : 0);
    if (a.elite) {
      ctx.strokeStyle = 'rgba(255,200,90,0.95)';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1.5, py - 2.5, ts - 3, ts + 1);
      ctx.setLineDash([]);
    }
    // awareness marks: a glyph, never colour alone
    if (a.hostile !== false && a.hp > 0) {
      const mark = a.asleep ? 'z' : a.awareness === 'unaware' ? '' : a.awareness === 'suspicious' ? '?' : '!';
      if (mark) {
        ctx.font = 'bold 7px ui-monospace, monospace';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 2;
        ctx.strokeText(mark, px + 6, py - 4);
        ctx.fillStyle = mark === '!' ? '#ff9a7a' : '#ffe6a0';
        ctx.fillText(mark, px + 6, py - 4);
      }
    }
    // health pips, only for the damaged
    if (a.hp < a.maxHp) {
      const w = ts - 4, frac = Math.max(0, a.hp / a.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(px + 2, py + ts - 2, w, 2);
      ctx.fillStyle = frac > 0.5 ? '#8fbf6a' : frac > 0.25 ? '#d6b45a' : '#c0604a';
      ctx.fillRect(px + 2, py + ts - 2, w * frac, 2);
    }
  }

  if (flash) {
    ctx.globalAlpha = 0.6 * (1 - progressOf(flash, now));
    ctx.fillStyle = '#fff';
    ctx.fillRect(px, py - 6, ts, ts + 6);
    ctx.globalAlpha = 1;
  }

  // status icons
  if (a.statuses && a.statuses.length) {
    ctx.font = '6px ui-monospace, monospace';
    let ox = 0;
    for (const s of a.statuses.slice(0, 4)) {
      const def = statusIcon(s.key);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(px + ox, py - 10, 5, 5);
      ctx.fillStyle = def.colour;
      ctx.fillText(def.icon, px + ox, py - 5);
      ox += 5;
    }
  }
}

function statusIcon(key) {
  const d = STATUSES[key];
  return { icon: d ? d.icon : '?', colour: d && d.bad ? '#e08a7a' : '#a8d08a' };
}

function drawRoofs(ctx, state, x0, y0, x1, y1, ts, now) {
  if (state.mode === 'hollow') return;
  const p = state.player;
  const chunks = state.world.chunks;
  for (const c of chunks.values()) {
    if (!c.roofs || !c.roofs.length) continue;
    for (const r of c.roofs) {
      if (r.x > x1 || r.x + r.w < x0 || r.y > y1 || r.y + r.h < y0) continue;
      if (!(flagsAt(state, r.x + 1, r.y + 1) & F.EXPLORED)) continue;
      const inside = p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
      r.alpha = r.alpha === undefined ? 1 : r.alpha;
      const target = inside ? 0.15 : 1;
      r.alpha += (target - r.alpha) * 0.25;
      if (r.alpha < 0.02) continue;
      ctx.globalAlpha = r.alpha;
      // A roof reads as one surface with a ridge, not a chequerboard.
      const [light, dark] = ROOF_COLOURS[r.style] || ROOF_COLOURS.thatch;
      const ridgeY = r.y + Math.floor(r.h / 2);
      for (let y = r.y; y < r.y + r.h; y++) {
        ctx.fillStyle = y === ridgeY ? light : (y < ridgeY ? light : dark);
        ctx.fillRect(r.x * ts, y * ts, r.w * ts, ts);
        if (y % 2 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.10)';
          ctx.fillRect(r.x * ts, y * ts, r.w * ts, 2);
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(r.x * ts, ridgeY * ts, r.w * ts, 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x * ts + 0.5, r.y * ts + 0.5, r.w * ts - 1, r.h * ts - 1);
      ctx.globalAlpha = 1;
    }
  }
}

const ROOF_COLOURS = {
  thatch: ['#b08b45', '#9d7c3c'], reed_roof: ['#c0a85e', '#ab9450'],
  slate: ['#535f6b', '#485460'], tar: ['#33383f', '#2b3036'],
  turf: ['#5d7a44', '#526c3c'], tile_roof: ['#8a4a38', '#7c4232'],
};
const roofColour = (style, alt) => (ROOF_COLOURS[style] || ROOF_COLOURS.thatch)[alt];

/** One half-resolution light canvas, multiplied over the world. */
function composite(state, originX, originY, z, ts) {
  const p = state.player;
  const dark = ambientDarkness();
  const lw = lightCanvas.width, lh = lightCanvas.height;
  lightCtx.setTransform(1, 0, 0, 1, 0, 0);
  lightCtx.globalCompositeOperation = 'source-over';
  lightCtx.fillStyle = `rgba(6,8,16,${dark})`;
  lightCtx.fillRect(0, 0, lw, lh);
  if (dark <= 0.001) return;

  lightCtx.globalCompositeOperation = 'destination-out';
  const toLight = (wx, wy) => [((wx * ts - originX) * z) / 2, ((wy * ts - originY) * z) / 2];

  const addLight = (wx, wy, radius, strength = 1, colour = null) => {
    const [lx, ly] = toLight(wx, wy);
    const r = (radius * ts * z) / 2;
    if (lx < -r || ly < -r || lx > lw + r || ly > lh + r) return;
    const grad = lightCtx.createRadialGradient(lx + (ts * z) / 4, ly + (ts * z) / 4, 0, lx + (ts * z) / 4, ly + (ts * z) / 4, r);
    grad.addColorStop(0, `rgba(255,255,255,${strength})`);
    grad.addColorStop(0.6, `rgba(255,255,255,${strength * 0.55})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    lightCtx.fillStyle = grad;
    lightCtx.beginPath();
    lightCtx.arc(lx + (ts * z) / 4, ly + (ts * z) / 4, r, 0, Math.PI * 2);
    lightCtx.fill();
  };

  if (p.lightRadius > 0) addLight(p.x, p.y, p.lightRadius + 0.5, 0.96);
  for (const c of state.world.chunks.values()) {
    for (const [i, prop] of c.props) {
      if (prop.kind !== 'hearth' && !prop.lit) continue;
      const lx = c.cx * 32 + (i & 31), ly = c.cy * 32 + (i >> 5);
      addLight(lx, ly, 4, 0.6);
    }
  }
  if (state.hollow && state.hollow.floor) {
    for (const [i, prop] of state.hollow.floor.props) {
      if (!prop.lit) continue;
      const f = state.hollow.floor;
      addLight(i % f.w, Math.floor(i / f.w), 5, 0.7);
    }
  }

  lightCtx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lightCanvas, 0, 0, view.w, view.h);
  ctx.globalCompositeOperation = 'source-over';

  // the lantern's own warmth, over the top
  if (p.lightRadius > 0) {
    const [lx, ly] = [((p.x * ts - originX) * z), ((p.y * ts - originY) * z)];
    const r = p.lightRadius * ts * z;
    const grad = ctx.createRadialGradient(lx + ts * z / 2, ly + ts * z / 2, 0, lx + ts * z / 2, ly + ts * z / 2, r);
    const warm = p.greenFlame ? '120,230,160' : '255,206,130';
    grad.addColorStop(0, `rgba(${warm},0.16)`);
    grad.addColorStop(1, `rgba(${warm},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
  }
}

function drawChevron(state, ts, z, originX, originY) {
  const q = state.markedQuest && state.quests.get(state.markedQuest);
  if (!q) return;
  const target = questTargetTile(state, q);
  if (!target) return;
  const p = state.player;
  const dx = target.x - p.x, dy = target.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 6) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cx = view.w / 2, cy = view.h / 2;
  const r = Math.min(view.w, view.h) * 0.40;
  const a = Math.atan2(dy, dx);
  const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(255,220,150,0.9)';
  ctx.beginPath();
  ctx.moveTo(10, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,230,180,0.9)';
  ctx.font = '11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(d) + '', px, py + 20);
  ctx.textAlign = 'left';
}

export function questTargetTile(state, q) {
  const beat = q.beats[q.current];
  if (!beat) return null;
  const t = beat.target || {};
  if (t.tile) return t.tile;
  if (t.hollow) { const h = state.W.hollows.get(t.hollow); return h ? h.mouth : null; }
  if (t.settlement) { const s = state.W.settlements.get(t.settlement); return s ? { x: s.x, y: s.y } : null; }
  if (t.region) { const r = state.W.regions.get(t.region); return r ? { x: r.x, y: r.y } : null; }
  if (t.npc) {
    const e = state.entities.find(en => en.id === t.npc);
    if (e) return { x: e.x, y: e.y };
    const settleId = t.npc.slice(2, t.npc.lastIndexOf(':'));
    const s = state.W.settlements.get(settleId);
    return s ? { x: s.x, y: s.y } : null;
  }
  return null;
}

export { tickEffects };
