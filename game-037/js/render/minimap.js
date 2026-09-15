// ============================================================
// render/minimap.js - the corner map and the full world map (GDD §25.8)
// The world map renders from field functions, so it works for places the
// player has not walked, at a coarse level - but shows only discovered detail.
// ============================================================
import { WORLD_W, WORLD_H, CHUNK } from '../data/constants.js';
import { F, tileDef } from '../data/tiles.js';
import { O } from '../data/objects.js';
import { elevationAt, biomeAt, riverAt, regionAt } from '../gen/fields.js';
import { BIOMES } from '../data/biomes.js';
import { hsl } from './palette.js';
import { flagsAt, groundAt, objectAt, inBounds } from '../world/access.js';

/** The 64x64 corner map: explored tiles, the player, and what matters. */
export function drawMinimap(ctx, state, size = 128) {
  const p = state.player;
  const half = 32;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(12,14,20,0.82)';
  ctx.fillRect(0, 0, size, size);
  const px = size / (half * 2);

  for (let dy = -half; dy < half; dy++) {
    for (let dx = -half; dx < half; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if (!inBounds(state, x, y)) continue;
      const fl = flagsAt(state, x, y);
      if (!(fl & F.EXPLORED)) continue;
      const g = tileDef(groundAt(state, x, y));
      ctx.fillStyle = miniColour(g, fl);
      ctx.fillRect((dx + half) * px, (dy + half) * px, Math.ceil(px), Math.ceil(px));
      const o = objectAt(state, x, y);
      if (o === O.hollow_mouth) { ctx.fillStyle = '#e0b060'; ctx.fillRect((dx + half) * px - 1, (dy + half) * px - 1, px + 2, px + 2); }
    }
  }

  // marks the player left with the Green Flame
  for (const m of state.marks) {
    const dx = m.x - p.x, dy = m.y - p.y;
    if (Math.abs(dx) >= half || Math.abs(dy) >= half) continue;
    ctx.fillStyle = '#7ce8a0';
    ctx.fillRect((dx + half) * px, (dy + half) * px, 2, 2);
  }

  ctx.fillStyle = '#fff6e0';
  ctx.fillRect(half * px - 1, half * px - 1, 3, 3);
}

function miniColour(tile, fl) {
  if (fl & F.ROAD) return '#7a6a52';
  if (tile.liquid) return tile.deep ? '#24415e' : '#3d6f86';
  if (tile.solid) return '#3a3a42';
  if (tile.indoor) return '#5b4a3a';
  if (tile.key === 'snow' || tile.key === 'ice') return '#c9d6e0';
  if (tile.key === 'sand' || tile.key === 'shingle') return '#b6a274';
  if (tile.key === 'bare_stone' || tile.key === 'scree') return '#6f6f72';
  if (tile.key === 'heather') return '#6a5476';
  if (tile.key === 'mud' || tile.key === 'tilled') return '#5c4a33';
  return '#4c6b3f';
}

/** The full world map, drawn in a field-notebook style. */
export function drawWorldMap(ctx, state, w, h, pan = { x: 0, y: 0, scale: 1 }) {
  const W = state.W;
  const step = Math.max(1, Math.round(WORLD_W / (w * pan.scale)));
  ctx.fillStyle = '#e8ddc4';
  ctx.fillRect(0, 0, w, h);

  const visited = new Set();
  for (const key of state.world.chunks.keys()) visited.add(key);

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const tx = Math.floor((px / w) * WORLD_W / pan.scale + pan.x);
      const ty = Math.floor((py / h) * WORLD_H / pan.scale + pan.y);
      if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) continue;
      const e = elevationAt(W, tx, ty);
      const region = W.regions.get(regionAt(W, tx, ty));
      const discovered = region && (state.knowledge.places.has(region.id) || region.tier <= 1 || visitedNear(state, tx, ty));
      if (!discovered) {
        // undiscovered country is paper, with a hand-drawn edge
        ctx.fillStyle = ((px + py) % 23 === 0) ? '#ded2b6' : '#e8ddc4';
        ctx.fillRect(px, py, 1, 1);
        continue;
      }
      ctx.fillStyle = mapColour(W, tx, ty, e, region);
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // settlements, Hollow mouths, the player
  const toScreen = (tx, ty) => [
    ((tx - pan.x) * pan.scale / WORLD_W) * w,
    ((ty - pan.y) * pan.scale / WORLD_H) * h,
  ];
  ctx.font = '10px ui-serif, Georgia, serif';

  // A field notebook has room for the names that fit. Anything that would sit
  // on top of another label is left off until you zoom in.
  const taken = [];
  const fits = (x, y, text) => {
    const box = [x, y - 9, x + ctx.measureText(text).width + 6, y + 3];
    if (box[0] < 0 || box[1] < 0 || box[2] > w || box[3] > h) return false;
    for (const t of taken) {
      if (box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1]) return false;
    }
    taken.push(box);
    return true;
  };
  const label = (x, y, text) => {
    if (!fits(x + 6, y + 3, text)) return;
    ctx.fillStyle = 'rgba(232,221,196,0.75)';
    ctx.fillRect(x + 4, y - 6, ctx.measureText(text).width + 4, 10);
    ctx.fillStyle = '#2a2318';
    ctx.fillText(text, x + 6, y + 3);
  };

  for (const s of W.settlements.values()) {
    if (!state.knowledge.places.has(s.id)) continue;
    const [sx, sy] = toScreen(s.x, s.y);
    if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
    ctx.fillStyle = '#2a2318';
    ctx.fillRect(sx - 2, sy - 2, 5, 5);
    label(sx, sy, s.name);
  }
  for (const hh of W.hollows.values()) {
    if (!hh.discovered) continue;
    const [sx, sy] = toScreen(hh.mouth.x, hh.mouth.y);
    if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
    ctx.fillStyle = hh.lit ? '#c07a2a' : '#1a1a20';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 4, sy + 3); ctx.lineTo(sx - 4, sy + 3);
    ctx.closePath(); ctx.fill();
    // Hollow names only once you have zoomed in far enough to read them
    if (pan.scale >= 1.8) label(sx, sy, hh.name);
  }
  const [ppx, ppy] = toScreen(state.player.x, state.player.y);
  ctx.fillStyle = '#b0402a';
  ctx.beginPath(); ctx.arc(ppx, ppy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
}

function visitedNear(state, tx, ty) {
  const cx = tx >> 5, cy = ty >> 5;
  return state.world.chunks.has((cy << 6) | cx) || state.mapSeen && state.mapSeen.has((cy << 6) | cx);
}

function mapColour(W, tx, ty, e, region) {
  if (e < 0.30) return '#7d99ad';
  if (riverAt(W, tx, ty) > 0.3) return '#8fb0c4';
  const biome = biomeAt(W, tx, ty);
  const B = BIOMES[biome] || BIOMES.meadow;
  let [hh, s, l] = B.ambient;
  // regions tint by tier once discovered: the danger reading, on the map
  if (region) { l = l * (1 - region.quiet * 0.35); s = s * (1 - region.quiet * 0.6); }
  return hsl(hh, s * 0.6, 0.35 + l * 0.5);
}
