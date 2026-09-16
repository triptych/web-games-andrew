// ============================================================
// render/atlas.js - procedural sprite synthesis (GDD §26)
// Recipes are data; this is the only thing that knows how to draw them.
// Four Quiet variants are baked at boot, so the Quiet costs nothing per frame.
// ============================================================
import { deriveRNG, hashStr } from '../core/rand.js';
import { DOMAINS, QUIET_VARIANTS } from '../data/constants.js';
import { GROUND_RECIPES, SPRITE_RECIPES, ACTOR_RECIPES, DECOR_RECIPES, ITEM_RECIPES, PLAYER_RECIPES } from '../data/sprites.js';
import { buildPaletteSet, roleColour, hsl } from './palette.js';

/** One atlas page per Quiet variant, holding every sprite as a sub-rect. */
export class Atlas {
  constructor(master) {
    this.master = master;
    this.paletteSet = buildPaletteSet(master);
    this.pages = [];
    this.rects = new Map();     // key -> { x, y, w, h, ax, ay }
    this.ready = false;
  }

  get(key) { return this.rects.get(key) || null; }

  /** Draw a sprite at a screen position, at a Quiet variant. */
  draw(ctx, key, sx, sy, variant = 0, alpha = 1) {
    const r = this.rects.get(key);
    if (!r) return this.fallback(ctx, key, sx, sy);
    const page = this.pages[Math.min(variant, this.pages.length - 1)];
    if (alpha !== 1) { ctx.globalAlpha = alpha; }
    ctx.drawImage(page, r.x, r.y, r.w, r.h, sx, sy - (r.h - 16), r.w, r.h);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  /** A missing sprite must be visibly wrong, never invisible. */
  fallback(ctx, key, sx, sy) {
    ctx.fillStyle = '#b0408080';
    ctx.fillRect(sx + 2, sy + 2, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.fillText((key || '?')[0].toUpperCase(), sx + 5, sy + 12);
  }
}

const PAGE = 1024;

/** Build the atlas. Budget: under 600 ms with four variants. */
export function buildAtlas(master) {
  const atlas = new Atlas(master);
  const entries = [];
  const push = (prefix, table, kind) => {
    for (const [key, recipe] of Object.entries(table)) {
      entries.push({ key: prefix + key, recipe, kind, name: key });
    }
  };
  push('g:', GROUND_RECIPES, 'ground');
  push('o:', SPRITE_RECIPES, 'object');
  push('a:', ACTOR_RECIPES, 'actor');
  push('d:', DECOR_RECIPES, 'decor');
  push('i:', ITEM_RECIPES, 'item');
  push('p:', PLAYER_RECIPES, 'player');

  // Pack: simple shelf packer. Sprites are 16x16 to 16x24.
  let x = 0, y = 0, rowH = 0;
  for (const e of entries) {
    const [w, h] = e.recipe.size || [16, 16];
    if (x + w > PAGE) { x = 0; y += rowH + 1; rowH = 0; }
    e.rect = { x, y, w, h };
    x += w + 1;
    rowH = Math.max(rowH, h);
  }
  const pageH = Math.min(PAGE, y + rowH + 2);

  for (let v = 0; v < QUIET_VARIANTS.length; v++) {
    const q = QUIET_VARIANTS[v];
    const canvas = makeCanvas(PAGE, pageH);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (const e of entries) {
      ctx.save();
      ctx.translate(e.rect.x, e.rect.y);
      try {
        renderRecipe(ctx, e.recipe, atlas.paletteSet, q,
          deriveRNG(master, DOMAINS.SPRITES, hashStr(e.key)), e.kind);
      } catch (err) {
        ctx.fillStyle = '#b04080';
        ctx.fillRect(2, 2, 12, 12);
      }
      ctx.restore();
      if (v === 0) atlas.rects.set(e.key, { ...e.rect, anchor: e.recipe.anchor || [8, e.rect.h - 1] });
    }
    atlas.pages.push(canvas);
  }
  atlas.ready = true;
  return atlas;
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// --- the recipe evaluator -------------------------------------------------

/** Evaluate one recipe's ops into the current transform. */
export function renderRecipe(ctx, recipe, paletteSet, q, rng, kind) {
  const [w, h] = recipe.size || [16, 16];
  const paletteKey = recipe.palette || 'stone';
  const col = (role, palOverride) => roleColour(paletteSet, palOverride || paletteKey, role, q);
  // a per-sprite pixel map, so `region` ops can target "whatever ended up canopy"
  const regions = new Map();

  const paint = (px, py, colour, role, alpha = 1) => {
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colour;
    ctx.fillRect(px, py, 1, 1);
    ctx.globalAlpha = 1;
    if (role) {
      let set = regions.get(role);
      if (!set) { set = []; regions.set(role, set); }
      set.push([px, py]);
    }
    painted.add(py * w + px);
  };
  const painted = new Set();

  for (const op of recipe.ops || []) {
    const colour = op.color ? col(op.color, op.palette) : col('main');
    const alpha = op.alpha ?? 1;
    switch (op.op) {
      case 'rect': {
        for (let py = op.at[1]; py < op.at[1] + op.h; py++) {
          for (let px = op.at[0]; px < op.at[0] + op.w; px++) paint(px, py, colour, op.color, alpha);
        }
        break;
      }
      case 'blob': {
        const r = op.r, jitter = op.jitter || 0;
        for (let py = Math.floor(op.at[1] - r - 1); py <= op.at[1] + r + 1; py++) {
          for (let px = Math.floor(op.at[0] - r - 1); px <= op.at[0] + r + 1; px++) {
            const d = Math.hypot(px - op.at[0], py - op.at[1]);
            const wob = r * (1 + (rng.next() - 0.5) * jitter);
            if (d <= wob) paint(px, py, colour, op.color, alpha);
          }
        }
        break;
      }
      case 'ellipse': {
        for (let py = Math.floor(op.at[1] - op.ry - 1); py <= op.at[1] + op.ry + 1; py++) {
          for (let px = Math.floor(op.at[0] - op.rx - 1); px <= op.at[0] + op.rx + 1; px++) {
            const dx = (px - op.at[0]) / op.rx, dy = (py - op.at[1]) / op.ry;
            if (dx * dx + dy * dy <= 1) paint(px, py, colour, op.color, alpha);
          }
        }
        break;
      }
      case 'line': {
        const [x0, y0] = op.from, [x1, y1] = op.to;
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
        for (let s = 0; s <= n; s++) {
          const px = Math.round(x0 + (x1 - x0) * s / n), py = Math.round(y0 + (y1 - y0) * s / n);
          const t = op.thickness || 1;
          for (let o = 0; o < t; o++) paint(px + (o % 2), py + ((o / 2) | 0), colour, op.color, alpha);
        }
        break;
      }
      case 'poly': {
        const pts = op.points;
        let minY = h, maxY = 0;
        for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
        for (let py = Math.max(0, minY); py <= Math.min(h - 1, maxY); py++) {
          const xs = [];
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            if ((a[1] <= py && b[1] > py) || (b[1] <= py && a[1] > py)) {
              xs.push(a[0] + (py - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
            }
          }
          xs.sort((m, n2) => m - n2);
          for (let i = 0; i + 1 < xs.length; i += 2) {
            for (let px = Math.round(xs[i]); px <= Math.round(xs[i + 1]); px++) paint(px, py, colour, op.color, alpha);
          }
        }
        break;
      }
      case 'noise': {
        if (q >= 0.6) break;                       // detail leaves at high Quiet
        const target = op.region === 'all' ? null : regions.get(op.region);
        const density = op.density || 0.1;
        if (op.circle) {
          for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
            if (Math.hypot(px - w / 2, py - h / 2) > op.circle) continue;
            if (rng.chance(density)) paint(px, py, colour, op.color, alpha);
          }
        } else if (target) {
          for (const [px, py] of target) if (rng.chance(density)) paint(px, py, colour, null, alpha);
        } else {
          for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
            if (rng.chance(density)) paint(px, py, colour, op.color, alpha);
          }
        }
        break;
      }
      case 'dither': {
        if (q >= 0.6) break;
        const a = col(op.colorA), b = col(op.colorB);
        for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
          paint(px, py, ((px + py) % 2) ? a : b, null, alpha);
        }
        break;
      }
      case 'stripes': {
        const every = op.every || 4, t = op.thickness || 1;
        if (op.dir === 'v') {
          for (let px = 0; px < w; px += every) for (let o = 0; o < t; o++) {
            for (let py = 0; py < h; py++) paint(px + o, py, colour, op.color, alpha);
          }
        } else {
          for (let py = 0; py < h; py += every) for (let o = 0; o < t; o++) {
            for (let px = 0; px < w; px++) {
              const wob = op.wave ? Math.round(Math.sin(px * 0.6) * op.wave) : 0;
              paint(px, py + o + wob, colour, op.color, alpha);
            }
          }
        }
        break;
      }
      case 'cells': {
        const size = op.size || 5;
        const a = col(op.color), b = col(op.color2);
        for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
          const cx = Math.floor(px / size), cy = Math.floor(py / size);
          const edge = (px % size === 0) || (py % size === 0);
          if (edge) paint(px, py, b, null, alpha);
          else if ((cx + cy) % 2 === 0) paint(px, py, a, null, alpha * 0.5);
        }
        break;
      }
      case 'strokes': {
        const count = op.count || 5, len = op.len || 4;
        for (let i = 0; i < count; i++) {
          const px = rng.int(0, w - 1);
          const py0 = op.dir === 'down' ? (op.from || 0) : h - 1;
          for (let s = 0; s < len; s++) {
            const py = op.dir === 'down' ? py0 + s : py0 - s;
            const px2 = op.dir === 'right' ? px + s : px + (rng.chance(0.25) ? (rng.chance(0.5) ? 1 : -1) : 0);
            paint(px2, py, colour, op.color, alpha);
          }
        }
        break;
      }
      case 'scatter': {
        for (let i = 0; i < (op.count || 4); i++) {
          const px = rng.int(1, w - 2), py = rng.int(1, h - 2);
          const r = op.r || 1;
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            paint(px + dx, py + dy, colour, op.color, alpha);
          }
        }
        break;
      }
      case 'shade': {
        const target = regions.get(op.from);
        if (!target) break;
        const amount = op.amount || 0.2;
        const dir = op.dir === 'down' ? [0, 1] : op.dir === 'auto' ? [1, 1] : [1, 1];
        ctx.globalAlpha = amount;
        ctx.fillStyle = '#000';
        for (const [px, py] of target) {
          if (!painted.has((py + dir[1]) * w + (px + dir[0]))) ctx.fillRect(px, py, 1, 1);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'outline': {
        const oc = col(op.color || 'outline');
        const edge = [];
        for (const i of painted) {
          const px = i % w, py = (i / w) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = px + dx, ny = py + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (!painted.has(ny * w + nx)) edge.push([nx, ny]);
          }
        }
        ctx.fillStyle = oc;
        for (const [px, py] of edge) ctx.fillRect(px, py, 1, 1);
        break;
      }
      case 'mask': {
        const target = regions.get(op.region);
        if (!target) break;
        ctx.clearRect(op.at ? op.at[0] : 0, op.at ? op.at[1] : 0, op.w || w, op.h || h);
        break;
      }
      default: break;
    }
  }
}
