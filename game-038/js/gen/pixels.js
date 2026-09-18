// ============================================================
// gen/pixels.js - a tiny indexed-colour pixel buffer (GDD 5)
// Everything drawn in this game goes through here: dragons, eggs, item
// icons, map markers. Indices, not colours, so a palette swap is free and
// the pattern/outline passes can reason about what a pixel *is*.
// ============================================================

export const IDX = {
  EMPTY: 0, OUTLINE: 1, SHADOW: 2, DARK: 3, MAIN: 4, LIGHT: 5, HIGH: 6,
  MEMB: 7, MEMB_LIGHT: 8, EYE: 9, BONE: 10, BELLY: 11, ACCENT: 12, GLOW: 13,
};

/** Indices that count as "body" for the pattern and shading passes. */
export const BODY_IDX = new Set([IDX.SHADOW, IDX.DARK, IDX.MAIN, IDX.LIGHT, IDX.HIGH, IDX.BELLY]);

export class PixelBuffer {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.data = new Uint8Array(w * h);
  }
  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inside(x, y) ? this.data[this.idx(x, y)] : IDX.EMPTY; }
  set(x, y, v) { if (this.inside(x, y)) this.data[this.idx(x, y)] = v; }
  /** Only paint where something is already drawn. */
  over(x, y, v) { if (this.inside(x, y) && this.data[this.idx(x, y)] !== IDX.EMPTY) this.data[this.idx(x, y)] = v; }
  /** Only paint empty pixels. */
  under(x, y, v) { if (this.inside(x, y) && this.data[this.idx(x, y)] === IDX.EMPTY) this.data[this.idx(x, y)] = v; }

  rect(x, y, w, h, v) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, v);
  }

  disc(cx, cy, r, v) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, v);
      }
    }
  }

  ellipse(cx, cy, rx, ry, v) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, v);
      }
    }
  }

  /** A line of discs - the workhorse for limbs, necks and tails. */
  limb(x0, y0, x1, y1, r0, r1, v) {
    const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t, v);
    }
  }

  /** A quadratic curve of discs; `pts` is [p0, control, p1]. */
  curve(pts, r0, r1, v) {
    const [p0, pc, p1] = pts;
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, it = 1 - t;
      const x = it * it * p0[0] + 2 * it * t * pc[0] + t * t * p1[0];
      const y = it * it * p0[1] + 2 * it * t * pc[1] + t * t * p1[1];
      this.disc(x, y, r0 + (r1 - r0) * t, v);
    }
  }

  poly(points, v) {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of points) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) this.set(x, y, v);
      }
    }
  }

  /** Wrap every drawn pixel in a one-pixel outline. The 8-bit look, mostly. */
  outline(v = IDX.OUTLINE) {
    const copy = this.data.slice();
    const at = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h) ? IDX.EMPTY : copy[y * this.w + x];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (at(x, y) !== IDX.EMPTY) continue;
      if (at(x - 1, y) > IDX.OUTLINE || at(x + 1, y) > IDX.OUTLINE ||
          at(x, y - 1) > IDX.OUTLINE || at(x, y + 1) > IDX.OUTLINE) this.set(x, y, v);
    }
  }

  /** Light from the upper left: lift lit pixels, drop shaded ones. */
  shade() {
    const copy = this.data.slice();
    const at = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h) ? IDX.EMPTY : copy[y * this.w + x];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const v = at(x, y);
      if (!BODY_IDX.has(v)) continue;
      const openAbove = at(x, y - 1) === IDX.EMPTY || at(x - 1, y - 1) === IDX.EMPTY;
      const openBelow = at(x, y + 1) === IDX.EMPTY || at(x + 1, y + 1) === IDX.EMPTY;
      if (openAbove && v === IDX.MAIN) this.set(x, y, IDX.LIGHT);
      else if (openBelow && v === IDX.MAIN) this.set(x, y, IDX.DARK);
    }
  }

  /** Mirror horizontally (enemies face the other way). */
  mirrored() {
    const out = new PixelBuffer(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      out.set(this.w - 1 - x, y, this.get(x, y));
    }
    return out;
  }

  /** Bounding box of drawn pixels, or null for an empty buffer. */
  bounds() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.data[this.idx(x, y)] !== IDX.EMPTY) {
        if (x < x0) x0 = x; if (y < y0) y0 = y;
        if (x > x1) x1 = x; if (y > y1) y1 = y;
      }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  count() {
    let n = 0;
    for (let i = 0; i < this.data.length; i++) if (this.data[i] !== IDX.EMPTY) n++;
    return n;
  }
}

/** hsl -> '#rrggbb', because palettes are computed, not written down. */
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** '#rrggbb' -> [r,g,b]. */
export function rgbOf(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/**
 * Paint an indexed buffer onto a canvas context at integer scale.
 * `palette` is an array of hex strings indexed by IDX; index 0 is skipped.
 */
export function blit(ctx, buf, palette, dx, dy, scale = 1, alpha = 1) {
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha = alpha;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const v = buf.data[y * buf.w + x];
      if (v === IDX.EMPTY) continue;
      const colour = palette[v];
      if (!colour) continue;
      ctx.fillStyle = colour;
      ctx.fillRect(dx + x * scale, dy + y * scale, scale, scale);
    }
  }
  ctx.restore();
}

/** Bake a buffer into an offscreen canvas once, so frames are one drawImage. */
export function toCanvas(buf, palette, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = buf.w * scale;
  canvas.height = buf.h * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  blit(ctx, buf, palette, 0, 0, scale);
  return canvas;
}
