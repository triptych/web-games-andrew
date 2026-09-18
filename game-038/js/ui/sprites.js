// ============================================================
// ui/sprites.js - the bridge from genes to pixels on screen (GDD 5)
// Every sprite is baked once into an offscreen canvas keyed by gene hash,
// then drawn with drawImage. Idle animation is two baked frames, not a
// per-frame redraw, so a roster screen full of dragons costs nothing.
// ============================================================
import { buildDragonSprite, buildEggSprite, palettteFor, SPRITE_SIZE } from '../gen/sprite.js';
import { PixelBuffer, IDX, blit, hsl } from '../gen/pixels.js';
import { geneKey } from '../gen/dragon.js';
import { ELEMENTS } from '../data/elements.js';
import { RNG, hashStr } from '../core/rand.js';

const cache = new Map();
const MAX_CACHE = 240;

function bake(buf, palette) {
  const c = document.createElement('canvas');
  c.width = buf.w; c.height = buf.h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  blit(ctx, buf, palette, 0, 0, 1);
  return c;
}

/** Two baked frames for a dragon, cached by its genes. */
export function dragonFrames(d) {
  const key = geneKey(d);
  let entry = cache.get(key);
  if (!entry) {
    const palette = palettteFor(d);
    entry = {
      frames: [bake(buildDragonSprite(d, false), palette), bake(buildDragonSprite(d, true), palette)],
      palette,
    };
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(key, entry);
  }
  return entry;
}

export function eggCanvas(egg) {
  const key = 'egg:' + (egg.id || JSON.stringify(egg.genes));
  let entry = cache.get(key);
  if (!entry) {
    const fake = { genes: egg.genes, elements: egg.elements, ashbound: false, stage: 'hatchling', lineageId: egg.lineageId };
    entry = { frames: [bake(buildEggSprite(egg.genes, egg.genes.hue2), palettteFor(fake))] };
    cache.set(key, entry);
  }
  return entry.frames[0];
}

/**
 * Draw a dragon into a canvas element at an integer scale, facing right by
 * default. `frame` 0/1 picks the wing position.
 */
export function drawDragon(canvas, d, { scale = 3, frame = 0, flip = false, alpha = 1, shadow = true } = {}) {
  const ctx = canvas.getContext('2d');
  const size = SPRITE_SIZE * scale;
  if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size; }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  const { frames } = dragonFrames(d);
  const img = frames[frame % frames.length];
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow) {
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(size / 2, size - scale * 2.5, size * 0.28, scale * 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }
  if (flip) { ctx.translate(size, 0); ctx.scale(-1, 1); }
  ctx.drawImage(img, 0, 0, SPRITE_SIZE, SPRITE_SIZE, 0, 0, size, size);
  ctx.restore();
}

export function drawEgg(canvas, egg, { scale = 3 } = {}) {
  const ctx = canvas.getContext('2d');
  const size = SPRITE_SIZE * scale;
  if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size; }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(eggCanvas(egg), 0, 0, SPRITE_SIZE, SPRITE_SIZE, 0, 0, size, size);
}

/** A ready-made <canvas> for a dragon, animated if asked. */
export function dragonSprite(d, { scale = 3, animate = true, flip = false, className = 'sprite' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${d.name}, a ${d.lineageId}`);
  drawDragon(canvas, d, { scale, flip });
  if (animate) {
    // Every sprite shares one clock, so wings across the screen beat together
    // and there is exactly one timer no matter how many dragons are shown.
    register(canvas, d, scale, flip);
  }
  return canvas;
}

// ---- one shared idle clock ------------------------------------------------
const animated = new Set();
let frame = 0, timer = null;

function register(canvas, d, scale, flip) {
  animated.add({ canvas, d, scale, flip });
  if (!timer) timer = setInterval(tick, 620);
}

function tick() {
  frame ^= 1;
  for (const entry of [...animated]) {
    if (!entry.canvas.isConnected) { animated.delete(entry); continue; }
    drawDragon(entry.canvas, entry.d, { scale: entry.scale, frame, flip: entry.flip });
  }
  if (!animated.size) { clearInterval(timer); timer = null; }
}

export const currentFrame = () => frame;

// ---- small pixel icons ----------------------------------------------------
const iconCache = new Map();

/**
 * A 16x16 generated icon for an item, seeded from its id so the same item
 * always looks the same and no two look alike.
 */
export function itemIcon(itemDef, scale = 2) {
  const key = itemDef.id + ':' + scale;
  if (iconCache.has(key)) return iconCache.get(key);
  const seed = hashStr(itemDef.id);
  const rng = new RNG(seed, seed ^ 0x1234, seed ^ 0x9e37, seed ^ 0x5bf0);
  for (let i = 0; i < 4; i++) rng.next();
  const buf = new PixelBuffer(16, 16);
  const kindShape = {
    restorative: 'flask', cure: 'flask', battle: 'flask', binding: 'cord', food: 'round',
    training: 'seed', relic: 'gem', material: 'shard', breeding: 'egg', key: 'key',
  }[itemDef.kind] || 'gem';

  if (kindShape === 'flask') {
    buf.rect(6, 2, 4, 3, IDX.BONE);
    buf.ellipse(8, 10, 4.2, 4.6, IDX.MAIN);
    buf.ellipse(8, 11.5, 3, 2.8, IDX.LIGHT);
  } else if (kindShape === 'cord') {
    for (let i = 0; i < 5; i++) buf.disc(3 + i * 2.4, 8 + Math.sin(i) * 3, 1.6, i % 2 ? IDX.MAIN : IDX.DARK);
  } else if (kindShape === 'round') {
    buf.disc(8, 9, 5, IDX.MAIN);
    buf.disc(6, 7, 1.6, IDX.LIGHT);
    buf.limb(8, 4, 10, 1.5, 1, 0.6, IDX.MEMB);
  } else if (kindShape === 'seed') {
    buf.ellipse(8, 10, 3.4, 4.6, IDX.MAIN);
    buf.limb(8, 6, 11, 2, 0.9, 0.5, IDX.MEMB);
  } else if (kindShape === 'gem') {
    buf.poly([[8, 1], [14, 7], [8, 15], [2, 7]], IDX.MAIN);
    buf.poly([[8, 1], [11, 7], [8, 9], [5, 7]], IDX.LIGHT);
  } else if (kindShape === 'shard') {
    buf.poly([[5, 14], [3, 6], [8, 2], [12, 9], [10, 14]], IDX.MAIN);
    buf.poly([[8, 2], [12, 9], [9, 9]], IDX.LIGHT);
  } else if (kindShape === 'egg') {
    buf.ellipse(8, 9, 4.4, 5.6, IDX.MAIN);
    buf.ellipse(6.5, 6.5, 1.8, 2.2, IDX.LIGHT);
  } else if (kindShape === 'key') {
    buf.disc(5, 5, 3, IDX.BONE);
    buf.disc(5, 5, 1.2, IDX.EMPTY);
    buf.limb(6.5, 7, 12, 13, 1.2, 1.2, IDX.BONE);
    buf.rect(11, 10, 3, 1.4, IDX.BONE);
  }
  buf.shade();
  buf.outline();

  // Hue follows the item's kind, with a little per-item drift: a shelf of
  // restoratives should read as a shelf of restoratives at a glance, rather
  // than as fifteen unrelated colours.
  const KIND_HUE = {
    restorative: 140, cure: 195, battle: 15, binding: 45, food: 30,
    training: 105, relic: 275, material: 215, breeding: 330, key: 50,
  };
  const base = KIND_HUE[itemDef.kind] ?? 0;
  const hue = (base + (hashStr(itemDef.id) % 46) - 23 + 360) % 360;
  const rare = itemDef.rarity || 1;
  const palette = [
    null,
    hsl(hue, 0.5, 0.12), hsl(hue, 0.5, 0.26), hsl(hue, 0.55, 0.36),
    hsl(hue, 0.6, 0.5), hsl(hue, 0.55, 0.66), hsl(hue, 0.5, 0.8),
    hsl((hue + 40) % 360, 0.55, 0.42), hsl((hue + 40) % 360, 0.5, 0.62),
    '#fff', hsl(45, 0.3, 0.8 - rare * 0.03), hsl(hue, 0.4, 0.7),
    hsl((hue + 180) % 360, 0.6, 0.6), '#ffe9a8',
  ];
  const canvas = bakeScaled(buf, palette, scale);
  iconCache.set(key, canvas);
  return canvas;
}

function bakeScaled(buf, palette, scale) {
  const c = document.createElement('canvas');
  c.width = buf.w * scale; c.height = buf.h * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  blit(ctx, buf, palette, 0, 0, scale);
  return c;
}

/** An <img>-like element for an item, ready to drop into a list row. */
export function itemIconEl(itemDef, scale = 2) {
  const src = itemIcon(itemDef, scale);
  const c = document.createElement('canvas');
  c.className = 'item-icon';
  c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

export function clearSpriteCache() { cache.clear(); iconCache.clear(); }
