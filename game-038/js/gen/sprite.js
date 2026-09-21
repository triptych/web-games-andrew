// ============================================================
// gen/sprite.js - a dragon's sprite is a pure function of its genes (GDD 5)
// Build order: tail -> far limbs -> body -> near limbs -> neck -> head ->
// jaw -> horns -> crest -> wings -> pattern -> shade -> outline -> eye.
// Nothing here touches the DOM, so silhouettes can be checked headlessly.
// ============================================================
import { PixelBuffer, IDX, BODY_IDX, hsl } from './pixels.js';
import { RNG, hashStr } from '../core/rand.js';
import { geneKey } from './dragon.js';
import { ELEMENTS } from '../data/elements.js';

export const SPRITE_SIZE = 32;

/**
 * Anatomy per body plan, in the 32x32 grid, facing right.
 * These numbers are the art: they are the difference between "a dragon"
 * and "a lizard-shaped smear".
 */
const SKELETONS = {
  quad: {
    body: { cx: 14, cy: 19, rx: 8, ry: 5.4 },
    belly: { cx: 14, cy: 21.5, rx: 6.4, ry: 2.6 },
    neck: [[19.5, 16], [23, 13.5], [25, 10]], neckR: [3.2, 2.2],
    head: { x: 26.5, y: 8.8, r: 3.2 },
    jaw: [[28, 9.6], [30.8, 10.4]], jawR: [2, 1.1],
    legs: [[18, 22, 20, 27, 2.1, 1.4], [10, 22, 8, 27, 2.3, 1.5],
           [16, 22, 17, 26, 1.9, 1.3], [12, 22, 11, 26, 2.0, 1.3]],
    farLegs: 2,
    tail: [[7, 19], [3, 19.5], [1, 25]], tailR: [3.2, 0.9],
    wing: { x: 13, y: 14.5, scale: 1.0, tilt: -0.15 },
    crest: { from: [21, 14.5], to: [8, 15.5] },
    horn: { x: 26.5, y: 6.6 },
  },
  drake: {
    body: { cx: 13.5, cy: 18.5, rx: 7, ry: 5.8 },
    belly: { cx: 14, cy: 21, rx: 5.4, ry: 2.8 },
    neck: [[18, 15], [22, 12], [24, 8]], neckR: [3, 2.1],
    head: { x: 25.5, y: 7, r: 3.1 },
    jaw: [[27, 7.8], [30.4, 8.6]], jawR: [1.9, 1.0],
    legs: [[17, 22, 19, 27, 2.0, 1.3], [10, 22, 8.5, 27, 2.2, 1.4]],
    farLegs: 1,
    tail: [[7, 19], [2.5, 19], [1, 13]], tailR: [3, 0.8],
    wing: { x: 12.5, y: 13.5, scale: 1.05, tilt: -0.25 },
    crest: { from: [19, 13], to: [8, 14] },
    horn: { x: 25.5, y: 4.8 },
  },
  wyvern: {
    body: { cx: 13, cy: 18, rx: 6.2, ry: 6.2 },
    belly: { cx: 13.5, cy: 20.5, rx: 4.8, ry: 3 },
    neck: [[17, 14], [21, 10], [23, 6]], neckR: [2.8, 2.0],
    head: { x: 24.5, y: 5, r: 3.0 },
    jaw: [[26, 5.8], [29.6, 6.4]], jawR: [1.8, 1.0],
    legs: [[14, 23, 15, 28, 2.1, 1.4], [10, 23, 9, 28, 2.1, 1.4]],
    farLegs: 1,
    tail: [[7.5, 20], [3, 23], [1.5, 28]], tailR: [2.8, 0.8],
    wing: { x: 12, y: 12, scale: 1.3, tilt: -0.4 },
    crest: { from: [18, 11], to: [8, 13] },
    horn: { x: 24.5, y: 2.8 },
  },
  serpent: {
    coil: [[2, 27], [7, 22], [12, 25], [17, 19], [21, 13]],
    coilR: 3.2,
    neck: [[21, 13], [23.5, 10.5], [25, 8]], neckR: [2.6, 2.0],
    head: { x: 26, y: 6.8, r: 2.9 },
    jaw: [[27.4, 7.6], [30.6, 8.2]], jawR: [1.7, 0.9],
    legs: [],
    farLegs: 0,
    tail: null,
    wing: { x: 15, y: 17, scale: 0.8, tilt: 0.05 },
    crest: { from: [22, 12], to: [10, 22] },
    horn: { x: 26, y: 4.6 },
  },
  amphithere: {
    coil: [[2, 25], [6, 20], [11, 23], [16, 18], [20.5, 12]],
    coilR: 2.9,
    neck: [[20.5, 12], [23, 9.5], [24.8, 7]], neckR: [2.5, 1.9],
    head: { x: 26, y: 6, r: 2.8 },
    jaw: [[27.4, 6.8], [30.4, 7.4]], jawR: [1.7, 0.9],
    legs: [],
    farLegs: 0,
    tail: null,
    wing: { x: 14, y: 14, scale: 1.25, tilt: -0.3 },
    crest: { from: [21, 11], to: [9, 20] },
    horn: { x: 26, y: 3.8 },
  },
};

/** Five-stop ramp plus membrane, bone and eye, derived from the colour genes. */
export function palettteFor(d) {
  const g = d.genes;
  const ash = d.ashbound;
  const sat = ash ? Math.max(0.05, g.sat * 0.25) : g.sat;
  const light = ash ? Math.min(0.55, g.light * 0.85 + 0.06) : g.light;
  const h = g.hue, h2 = g.hue2;
  const elem = ELEMENTS[d.elements[0]];
  return [
    null,                                             // 0 EMPTY
    hsl(h, Math.min(1, sat + 0.1), Math.max(0.05, light * 0.22)),  // 1 OUTLINE
    hsl(h, sat, Math.max(0.08, light * 0.45)),        // 2 SHADOW
    hsl(h, sat, Math.max(0.12, light * 0.72)),        // 3 DARK
    hsl(h, sat, light),                               // 4 MAIN
    hsl(h, sat * 0.92, Math.min(0.92, light * 1.28)), // 5 LIGHT
    hsl(h, sat * 0.8, Math.min(0.97, light * 1.55)),  // 6 HIGH
    hsl(h2, sat * 0.85, Math.max(0.12, light * 0.7)), // 7 MEMB
    hsl(h2, sat * 0.8, Math.min(0.9, light * 1.15)),  // 8 MEMB_LIGHT
    ash ? '#c9c4bb' : hsl(g.eye, 0.85, 0.62),         // 9 EYE
    hsl((h + 40) % 360, 0.18, ash ? 0.62 : 0.82),     // 10 BONE
    hsl(h2, sat * 0.6, Math.min(0.88, light * 1.35)), // 11 BELLY
    ash ? '#9a93a8' : (elem ? elem.colour : hsl(h2, 0.8, 0.6)),    // 12 ACCENT
    ash ? '#6c6577' : hsl(g.eye, 0.9, 0.75),          // 13 GLOW
  ];
}

function drawWing(buf, type, anchor, flap, size, mirrorTilt = 0) {
  const { x, y, scale, tilt } = anchor;
  const s = scale * size;
  const lift = flap ? -2.2 : 1.2;                     // the two frames
  const t = tilt + mirrorTilt;

  if (type === 'vestigial') {
    buf.limb(x, y, x - 3 * s, y - 2 * s + lift * 0.4, 2.2, 1, IDX.MEMB);
    buf.limb(x, y, x - 1.5 * s, y - 3.4 * s + lift * 0.4, 1.8, 0.8, IDX.MEMB);
    return;
  }
  if (type === 'feathered') {
    for (let i = 0; i < 5; i++) {
      const spread = i / 4;
      const len = (6.5 + i * 1.3) * s;
      const ang = 0.15 + spread * 0.8 - t * 0.5 - lift * 0.05;   // up and back
      buf.limb(x, y, x - Math.cos(ang) * len, y - Math.sin(ang) * len * 0.9,
               1.7 - i * 0.12, 0.7, i % 2 ? IDX.MEMB : IDX.MEMB_LIGHT);
    }
    return;
  }
  if (type === 'finned') {
    const tipX = x - 8 * s, tipY = y - 1 * s + lift;
    buf.poly([[x + 1, y + 1], [tipX, tipY - 3 * s], [tipX - 1.5 * s, tipY + 2 * s], [x, y + 3]], IDX.MEMB);
    for (let i = 1; i <= 3; i++) {
      buf.limb(x, y, x - (3 + i * 1.7) * s, tipY - 2.4 * s + i * 1.5 * s, 0.7, 0.6, IDX.MEMB_LIGHT);
    }
    return;
  }
  // membrane (and twin, which is two membranes offset)
  const passes = type === 'twin' ? 2 : 1;
  for (let p = 0; p < passes; p++) {
    const px = x - p * 2.4 * s, py = y + p * 2.6 * s;
    const spanX = -8.5 * s, spanY = (-8 + lift) * s;
    const elbowX = px + spanX * 0.55, elbowY = py + spanY * 0.85 + t * 4;
    const tipX = px + spanX, tipY = py + spanY * 0.35 + t * 5;
    buf.poly([[px + 2, py], [elbowX, elbowY], [tipX, tipY], [tipX + 2.4 * s, tipY + 5 * s], [px, py + 3.4 * s]], IDX.MEMB);
    buf.limb(px, py, elbowX, elbowY, 1.5, 1.0, IDX.MEMB_LIGHT);
    buf.limb(elbowX, elbowY, tipX, tipY, 1.1, 0.7, IDX.MEMB_LIGHT);
    // three finger struts holding the membrane open
    for (let i = 0; i < 3; i++) {
      const fx = elbowX + (tipX - elbowX) * (i / 2) * 0.9;
      const fy = elbowY + (tipY - elbowY) * (i / 2) * 0.9;
      buf.limb(fx, fy, fx + 1.2 * s, fy + (3.8 - i * 0.7) * s, 0.7, 0.55, IDX.MEMB_LIGHT);
    }
  }
}

function drawHorns(buf, type, h, size) {
  const s = size;
  if (type === 'none') return;
  if (type === 'crown') {
    for (let i = -1; i <= 1; i++) {
      buf.limb(h.x + i * 1.7, h.y, h.x + i * 2.2, h.y - (3.4 - Math.abs(i) * 0.9) * s, 0.8, 0.4, IDX.BONE);
    }
  } else if (type === 'swept') {
    buf.limb(h.x - 0.5, h.y, h.x - 4.4 * s, h.y - 3.2 * s, 0.9, 0.4, IDX.BONE);
    buf.limb(h.x + 1.4, h.y + 0.4, h.x - 1.8 * s, h.y - 4.0 * s, 0.8, 0.4, IDX.BONE);
  } else if (type === 'spiral') {
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      buf.disc(h.x - 0.6 + Math.sin(t * 5) * 1.5 * s - t * 1.2, h.y - t * 4.6 * s, 1.0 - t * 0.5, IDX.BONE);
    }
  } else if (type === 'antler') {
    buf.limb(h.x, h.y, h.x - 2.2 * s, h.y - 4.0 * s, 0.8, 0.4, IDX.BONE);
    buf.limb(h.x - 1.2 * s, h.y - 2.2 * s, h.x - 3.8 * s, h.y - 3.2 * s, 0.6, 0.4, IDX.BONE);
    buf.limb(h.x - 1.6 * s, h.y - 3.4 * s, h.x - 0.4 * s, h.y - 5.6 * s, 0.6, 0.4, IDX.BONE);
    buf.limb(h.x + 1.4, h.y + 0.2, h.x + 2.4 * s, h.y - 3.2 * s, 0.7, 0.4, IDX.BONE);
  }
}

function drawTailTip(buf, type, x, y, dx, dy, size) {
  const s = size;
  const nx = dx / (Math.hypot(dx, dy) || 1), ny = dy / (Math.hypot(dx, dy) || 1);
  if (type === 'spade') {
    buf.poly([[x + nx * 3 * s, y + ny * 3 * s], [x - ny * 2.4 * s, y + nx * 2.4 * s],
              [x + ny * 2.4 * s, y - nx * 2.4 * s]], IDX.MEMB);
  } else if (type === 'fan') {
    for (let i = -2; i <= 2; i++) {
      buf.limb(x, y, x + nx * 3.4 * s - ny * i * 1.5 * s, y + ny * 3.4 * s + nx * i * 1.5 * s, 1.0, 0.5, IDX.MEMB);
    }
  } else if (type === 'spikes') {
    for (let i = 0; i < 4; i++) {
      const px = x - nx * i * 1.9 * s, py = y - ny * i * 1.9 * s;
      buf.limb(px, py, px - ny * 2.2 * s, py + nx * 2.2 * s, 0.9, 0.4, IDX.BONE);
    }
  } else if (type === 'club') {
    buf.disc(x + nx * 1.6 * s, y + ny * 1.6 * s, 2.6 * s, IDX.MAIN);
    buf.disc(x + nx * 1.6 * s, y + ny * 1.6 * s, 1.2 * s, IDX.DARK);
  } else if (type === 'whip') {
    buf.limb(x, y, x + nx * 3.2 * s, y + ny * 3.2 * s, 0.8, 0.4, IDX.MAIN);
  }
}

function drawCrest(buf, type, crest, size) {
  if (!crest || type === 'none') return;
  const [fx, fy] = crest.from, [tx, ty] = crest.to;
  const s = size;
  if (type === 'frill') {
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x = fx + (tx - fx) * t * 0.45, y = fy + (ty - fy) * t * 0.45;
      buf.limb(x, y, x + 1.2 * s, y - (3.2 - i * 0.35) * s, 1.0, 0.5, IDX.MEMB);
    }
  } else if (type === 'mane') {
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const x = fx + (tx - fx) * t * 0.55, y = fy + (ty - fy) * t * 0.55;
      buf.disc(x, y - 1.5 * s, 1.4 * s - t * 0.6, IDX.MEMB);
    }
  } else if (type === 'sail') {
    buf.poly([[fx, fy], [fx - 2 * s, fy - 4.4 * s], [tx + 3 * s, ty - 3.4 * s], [tx, ty]], IDX.MEMB);
  } else if (type === 'plates') {
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x = fx + (tx - fx) * t * 0.85, y = fy + (ty - fy) * t * 0.85;
      buf.poly([[x - 0.9 * s, y + 0.4], [x, y - (2.4 - t * 0.8) * s], [x + 0.9 * s, y + 0.4]], IDX.BONE);
    }
  }
}

/** Pattern pass: only ever paints pixels already inside the silhouette. */
function drawPattern(buf, pattern, rng, bounds) {
  if (!bounds || pattern === 'plain') return;
  const { x0, y0, x1, y1 } = bounds;
  const onBody = (x, y) => BODY_IDX.has(buf.get(x, y));
  if (pattern === 'banded') {
    const step = rng.int(3, 4);
    const off = rng.int(0, step - 1);
    for (let x = x0; x <= x1; x++) {
      if ((x + off) % step !== 0) continue;
      for (let y = y0; y <= y1; y++) if (onBody(x, y)) buf.set(x, y, IDX.DARK);
    }
  } else if (pattern === 'spotted') {
    const spots = rng.int(6, 11);
    for (let i = 0; i < spots; i++) {
      const cx = rng.int(x0, x1), cy = rng.int(y0, y1);
      if (!onBody(cx, cy)) continue;
      const r = rng.chance(0.4) ? 1.4 : 0.9;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && onBody(x, y)) buf.set(x, y, IDX.SHADOW);
      }
    }
  } else if (pattern === 'mottled') {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!onBody(x, y)) continue;
      const n = rng.next();
      if (n < 0.16) buf.set(x, y, IDX.SHADOW);
      else if (n < 0.28) buf.set(x, y, IDX.LIGHT);
    }
  } else if (pattern === 'gradient') {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      for (let x = x0; x <= x1; x++) {
        if (!onBody(x, y)) continue;
        if (t < 0.32) buf.set(x, y, IDX.LIGHT);
        else if (t > 0.74) buf.set(x, y, IDX.SHADOW);
      }
    }
  } else if (pattern === 'veined') {
    const veins = rng.int(2, 4);
    for (let i = 0; i < veins; i++) {
      let x = rng.int(x0, x1), y = rng.int(y0, y1);
      for (let step = 0; step < 14; step++) {
        if (onBody(x, y)) buf.set(x, y, IDX.HIGH);
        x += rng.int(-1, 1); y += rng.int(0, 1);
        if (x < x0 || x > x1 || y > y1) break;
      }
    }
  }
}

/** Ashbound dragons get grey speckle over the top: visibly wrong, fixable. */
function ashPass(buf, rng, bounds) {
  if (!bounds) return;
  for (let y = bounds.y0; y <= bounds.y1; y++) for (let x = bounds.x0; x <= bounds.x1; x++) {
    if (BODY_IDX.has(buf.get(x, y)) && rng.chance(0.22)) buf.set(x, y, IDX.SHADOW);
  }
}

/**
 * Build one frame of a dragon.
 * @param d      dragon
 * @param flap   true for the wings-up frame
 * @returns PixelBuffer of SPRITE_SIZE x SPRITE_SIZE, facing right
 */
export function buildDragonSprite(d, flap = false) {
  // Seeded from the genes ALONE, with no frame in the mix. Every random
  // decision in this function is about what the ANIMAL looks like, not about
  // what this particular frame looks like: the only thing that may differ
  // between the two frames is the pose (wing lift and a one-pixel bob), and
  // both of those are computed, not rolled. Mix `flap` into this seed and the
  // pattern pass re-rolls every frame - the bands change spacing and offset
  // twice a second, which reads as flickering vertical bars, not as scales.
  const seed = hashStr(geneKey(d) + '|skin');
  const rng = new RNG(seed, seed ^ 0x9e3779b9, seed ^ 0x85ebca6b, seed ^ 0xc2b2ae35);
  for (let i = 0; i < 6; i++) rng.next();

  const g = d.genes;
  const sk = SKELETONS[g.body] || SKELETONS.drake;
  const buf = new PixelBuffer(SPRITE_SIZE, SPRITE_SIZE);
  const stageScale = d.stage === 'hatchling' ? 0.74 : d.stage === 'wyrm' ? 1.08 : d.stage === 'elder' ? 1.16 : 1;
  const size = (0.85 + g.size * 0.15) * stageScale;
  const bob = flap ? -1 : 0;

  // Work in a scaled, centred frame so hatchlings are small and elders fill it.
  const cx = 16, cy = 18;
  const T = (x, y) => [cx + (x - 16) * size, cy + (y - 18) * size + bob];
  const put = {
    disc: (x, y, r, v) => { const [a, b] = T(x, y); buf.disc(a, b, r * size, v); },
    ellipse: (x, y, rx, ry, v) => { const [a, b] = T(x, y); buf.ellipse(a, b, rx * size, ry * size, v); },
    limb: (x0, y0, x1, y1, r0, r1, v) => {
      const [a0, b0] = T(x0, y0), [a1, b1] = T(x1, y1);
      buf.limb(a0, b0, a1, b1, r0 * size, r1 * size, v);
    },
    curve: (pts, r0, r1, v) => buf.curve(pts.map(p => T(p[0], p[1])), r0 * size, r1 * size, v),
    poly: (pts, v) => buf.poly(pts.map(p => T(p[0], p[1])), v),
  };

  // --- wings first: a side-on wing anchors behind the shoulder ----------
  const wingAnchor = { ...sk.wing, x: T(sk.wing.x, sk.wing.y)[0], y: T(sk.wing.x, sk.wing.y)[1] };
  drawWing(buf, g.wings, wingAnchor, flap, size);

  // --- tail / coil ------------------------------------------------------
  if (sk.coil) {
    for (let i = 0; i + 1 < sk.coil.length; i++) {
      const [x0, y0] = sk.coil[i], [x1, y1] = sk.coil[i + 1];
      put.limb(x0, y0, x1, y1, sk.coilR - i * 0.15, sk.coilR - (i + 1) * 0.15, IDX.MAIN);
    }
    const tip = sk.coil[0];
    const [tx, ty] = T(tip[0], tip[1]);
    drawTailTip(buf, g.tail, tx, ty, -1, 0.4, size);
  } else if (sk.tail) {
    put.curve(sk.tail, sk.tailR[0], sk.tailR[1], IDX.MAIN);
    const end = sk.tail[2], prev = sk.tail[1];
    const [ex, ey] = T(end[0], end[1]);
    const [px, py] = T(prev[0], prev[1]);
    drawTailTip(buf, g.tail, ex, ey, ex - px, ey - py, size);
  }

  // --- far legs (drawn dark, behind the body) ---------------------------
  const legs = sk.legs || [];
  for (let i = 0; i < legs.length; i++) {
    const [x0, y0, x1, y1, r0, r1] = legs[i];
    if (i < (legs.length - (sk.farLegs || 0))) continue;
    put.limb(x0, y0, x1, y1, r0, r1, IDX.SHADOW);
    put.disc(x1, y1 + 0.4, r1 + 0.5, IDX.SHADOW);
  }

  // --- body -------------------------------------------------------------
  if (sk.body) {
    put.ellipse(sk.body.cx, sk.body.cy, sk.body.rx, sk.body.ry, IDX.MAIN);
    if (sk.belly) put.ellipse(sk.belly.cx, sk.belly.cy, sk.belly.rx, sk.belly.ry, IDX.BELLY);
  }

  // --- near legs --------------------------------------------------------
  for (let i = 0; i < legs.length - (sk.farLegs || 0); i++) {
    const [x0, y0, x1, y1, r0, r1] = legs[i];
    put.limb(x0, y0, x1, y1, r0, r1, IDX.MAIN);
    put.disc(x1, y1 + 0.4, r1 + 0.6, IDX.DARK);
    // three claws
    for (let c = -1; c <= 1; c++) put.disc(x1 + c * 0.9 + 0.8, y1 + 1.1, 0.45, IDX.BONE);
  }

  // --- neck, head, jaw --------------------------------------------------
  put.curve(sk.neck, sk.neckR[0], sk.neckR[1], IDX.MAIN);
  put.disc(sk.head.x, sk.head.y, sk.head.r, IDX.MAIN);
  put.limb(sk.jaw[0][0], sk.jaw[0][1], sk.jaw[1][0], sk.jaw[1][1], sk.jawR[0], sk.jawR[1], IDX.MAIN);
  // nostril and mouth line
  put.disc(sk.jaw[1][0] - 0.4, sk.jaw[1][1] - 0.7, 0.42, IDX.SHADOW);

  // --- crest, horns -----------------------------------------------------
  const crestPts = { from: T(sk.crest.from[0], sk.crest.from[1]), to: T(sk.crest.to[0], sk.crest.to[1]) };
  drawCrest(buf, g.crest, crestPts, size);
  const hornPt = { x: T(sk.horn.x, sk.horn.y)[0], y: T(sk.horn.x, sk.horn.y)[1] };
  drawHorns(buf, g.horns, hornPt, size);

  // --- surface passes ---------------------------------------------------
  const bounds = buf.bounds();
  drawPattern(buf, g.pattern, rng, bounds);
  if (d.ashbound) ashPass(buf, rng, bounds);
  buf.shade();
  buf.outline();

  // --- eye last, so nothing paints over it ------------------------------
  const [ex, ey] = T(sk.head.x + 1.1, sk.head.y - 0.4);
  buf.set(Math.round(ex), Math.round(ey), IDX.EYE);
  buf.set(Math.round(ex), Math.round(ey) - 1, IDX.OUTLINE);
  if (d.boss || d.stage === 'elder') buf.set(Math.round(ex) + 1, Math.round(ey), IDX.GLOW);

  return buf;
}

/** The egg sprite draws from the *child's* genes, so colour is a hint. */
export function buildEggSprite(genes, hue2) {
  const buf = new PixelBuffer(SPRITE_SIZE, SPRITE_SIZE);
  const seed = hashStr(JSON.stringify(genes));
  const rng = new RNG(seed, seed ^ 0x51ed, seed ^ 0x1234567, seed ^ 0xabc);
  for (let i = 0; i < 4; i++) rng.next();
  buf.ellipse(16, 19, 6.5, 8.5, IDX.MAIN);
  buf.ellipse(14, 15, 3.2, 4.2, IDX.LIGHT);
  const spots = rng.int(5, 10);
  for (let i = 0; i < spots; i++) {
    const cx = rng.int(11, 21), cy = rng.int(12, 26);
    if (BODY_IDX.has(buf.get(cx, cy))) buf.disc(cx, cy, rng.chance(0.5) ? 1.3 : 0.9, IDX.MEMB);
  }
  buf.shade();
  buf.outline();
  return buf;
}

/** ASCII dump, used by the headless tests to eyeball a silhouette. */
export function asciiArt(buf) {
  const chars = { 0: ' ', 1: '#', 2: ':', 3: '-', 4: 'o', 5: '+', 6: '*', 7: '/', 8: '\\', 9: '@', 10: '^', 11: '=', 12: '%', 13: '!' };
  let out = '';
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) out += chars[buf.get(x, y)] ?? '?';
    out += '\n';
  }
  return out;
}
