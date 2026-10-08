/**
 * textures.js — every texture in the game, generated in code.
 *
 * Tileable value noise and cellular noise on periodic lattices, layer recipes for the terrain
 * (albedo + height in alpha, and normal maps from the heights), and helpers to pack layers
 * into DataArrayTextures with mipmaps.
 */
import * as THREE from 'three';
import { mulberry32 } from '../sim/rng.js';

// ---------------------------------------------------------------- periodic noise fields
function latticeVals(period, seed) {
    const r = mulberry32(seed);
    const v = new Float32Array(period * period);
    for (let i = 0; i < v.length; i++) v[i] = r();
    return v;
}

/** Tileable value noise, `period` lattice cells across the texture. Returns size² in [0,1]. */
export function pnoise(size, period, seed) {
    const v = latticeVals(period, seed);
    const out = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
        const fy = y / size * period, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
        const y0 = iy % period, y1 = (iy + 1) % period;
        for (let x = 0; x < size; x++) {
            const fx = x / size * period, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
            const x0 = ix % period, x1 = (ix + 1) % period;
            const a = v[y0 * period + x0], b = v[y0 * period + x1], c = v[y1 * period + x0], d = v[y1 * period + x1];
            out[y * size + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
        }
    }
    return out;
}

/** Tileable fbm. */
export function pfbm(size, period, oct, seed, gain = 0.5) {
    const out = new Float32Array(size * size);
    let amp = 1, norm = 0, p = period;
    for (let o = 0; o < oct; o++) {
        const n = pnoise(size, p, seed + o * 101);
        for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
        norm += amp; amp *= gain; p *= 2;
        if (p > size) break;
    }
    for (let i = 0; i < out.length; i++) out[i] /= norm;
    return out;
}

/** Tileable cellular noise: F1 (nearest), F2 and the id of the nearest cell. */
export function pworley(size, cells, seed) {
    const r = mulberry32(seed);
    const pts = [];
    for (let i = 0; i < cells * cells; i++) pts.push([r(), r(), r()]);
    const f1 = new Float32Array(size * size), f2 = new Float32Array(size * size), id = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
        const gy = y / size * cells, cy = Math.floor(gy);
        for (let x = 0; x < size; x++) {
            const gx = x / size * cells, cx = Math.floor(gx);
            let d1 = 9, d2 = 9, best = 0;
            for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
                const qx = cx + ox, qy = cy + oy;
                const wx = ((qx % cells) + cells) % cells, wy = ((qy % cells) + cells) % cells;
                const p = pts[wy * cells + wx];
                const dx = qx + p[0] - gx, dy = qy + p[1] - gy;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < d1) { d2 = d1; d1 = d; best = p[2]; } else if (d < d2) d2 = d;
            }
            const k = y * size + x;
            f1[k] = d1; f2[k] = d2; id[k] = best;
        }
    }
    return { f1, f2, id };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Height field → tangent-space normal map bytes (RGBA). */
export function heightToNormal(h, size, strength) {
    const out = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
            const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
            let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
            const len = Math.hypot(nx, ny, nz);
            nx /= len; ny /= len; nz /= len;
            const o = (y * size + x) * 4;
            out[o] = (nx * 0.5 + 0.5) * 255; out[o + 1] = (ny * 0.5 + 0.5) * 255; out[o + 2] = (nz * 0.5 + 0.5) * 255; out[o + 3] = 255;
        }
    }
    return out;
}

/** Pack colour (0..1 floats, rgb arrays) and height into RGBA bytes. */
function packRGBA(size, col, height) {
    const out = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        out[i * 4] = clamp01(col[i * 3]) * 255;
        out[i * 4 + 1] = clamp01(col[i * 3 + 1]) * 255;
        out[i * 4 + 2] = clamp01(col[i * 3 + 2]) * 255;
        out[i * 4 + 3] = clamp01(height[i]) * 255;
    }
    return out;
}

// ---------------------------------------------------------------- terrain layers
// 0 grass · 1 soil · 2 rock · 3 snow · 4 road · 5 forest floor · 6 shingle/sand
export const TERRAIN_LAYERS = ['grass', 'soil', 'rock', 'snow', 'road', 'forest', 'sand'];
const NORMAL_STRENGTH = [2.5, 3.0, 5.5, 1.6, 4.5, 3.5, 4.0];

function layerGrass(S) {
    const a = pfbm(S, 8, 5, 11), b = pnoise(S, 64, 12), c = pnoise(S, 32, 13), clump = pfbm(S, 4, 3, 14);
    const col = new Float32Array(S * S * 3), h = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
        const blades = b[i] * 0.55 + c[i] * 0.45;
        const v = 0.42 + 0.35 * blades + 0.25 * (a[i] - 0.5) + 0.15 * (clump[i] - 0.5);
        const dry = sstep(0.55, 0.75, clump[i]) * 0.25;
        col[i * 3] = v * (0.92 + dry); col[i * 3 + 1] = v * 1.02; col[i * 3 + 2] = v * (0.74 - dry * 0.3);
        h[i] = 0.35 + blades * 0.5 + (clump[i] - 0.5) * 0.3;
    }
    return { col, h };
}

function layerSoil(S) {
    const a = pfbm(S, 6, 5, 21), w = pworley(S, 22, 22), f = pnoise(S, 48, 23);
    const col = new Float32Array(S * S * 3), h = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
        const pebble = sstep(0.3, 0.12, w.f1[i]) * (w.id[i] > 0.8 ? 0.6 : 0);
        const v = 0.48 + 0.3 * (a[i] - 0.5) + 0.1 * (f[i] - 0.5);
        const pv = 0.55 + w.id[i] * 0.25;
        const m = pebble;
        col[i * 3] = (v * 1.0) * (1 - m) + pv * m; col[i * 3 + 1] = (v * 0.9) * (1 - m) + pv * 0.97 * m; col[i * 3 + 2] = (v * 0.78) * (1 - m) + pv * 0.92 * m;
        h[i] = 0.3 + a[i] * 0.3 + m * 0.4;
    }
    return { col, h };
}

function layerRock(S) {
    const a = pfbm(S, 4, 6, 31), b = pfbm(S, 8, 5, 32), c1 = pnoise(S, 6, 35), c2 = pnoise(S, 12, 36), s = pfbm(S, 16, 3, 33), lich = pfbm(S, 10, 4, 34);
    const col = new Float32Array(S * S * 3), h = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = y * S + x;
        // warped horizontal strata
        const strata = 0.5 + 0.5 * Math.sin((y / S) * Math.PI * 2 * 7 + a[i] * 9 + b[i] * 3);
        // cracks: thin lines where noise crosses its middle value
        const crack = Math.max(sstep(0.035, 0.0, Math.abs(c1[i] - 0.5)) * 0.9, sstep(0.025, 0.0, Math.abs(c2[i] - 0.5)) * 0.5);
        let v = 0.42 + 0.2 * (a[i] - 0.5) + 0.07 * strata + 0.08 * (b[i] - 0.5) + 0.05 * (s[i] - 0.5);
        v *= 1 - crack * 0.6;
        const L = sstep(0.6, 0.7, lich[i]) * 0.6;
        col[i * 3] = v * (1 - L) + 0.43 * L * (0.8 + s[i] * 0.4); col[i * 3 + 1] = v * 0.985 * (1 - L) + 0.46 * L * (0.8 + s[i] * 0.4); col[i * 3 + 2] = v * 0.95 * (1 - L) + 0.31 * L;
        h[i] = clamp01(0.45 + (a[i] - 0.5) * 0.8 + (b[i] - 0.5) * 0.4 - crack * 0.45 + strata * 0.12);
    }
    return { col, h };
}

function layerSnow(S) {
    const a = pfbm(S, 4, 5, 41), b = pnoise(S, 64, 42), d = pfbm(S, 12, 3, 43);
    const col = new Float32Array(S * S * 3), h = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
        const v = 0.9 + 0.08 * (a[i] - 0.5) + 0.04 * (b[i] - 0.5);
        col[i * 3] = v * 0.94; col[i * 3 + 1] = v * 0.97; col[i * 3 + 2] = v * 1.02;
        h[i] = 0.4 + 0.45 * (a[i] - 0.5) + 0.15 * d[i];
    }
    return { col, h };
}

function layerRoad(S) {
    const a = pfbm(S, 6, 5, 51), w = pworley(S, 34, 52), f = pnoise(S, 40, 53), g = pnoise(S, 128, 54);
    const col = new Float32Array(S * S * 3), h = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
        const stone = sstep(0.42, 0.22, w.f1[i]) * (w.id[i] > 0.72 ? 1 : 0);
        const grit = g[i] > 0.82 ? (g[i] - 0.82) * 2.5 : 0;
        const dirt = 0.4 + 0.18 * (a[i] - 0.5) + 0.07 * (f[i] - 0.5) + grit * 0.25;
        const sv = 0.42 + 0.18 * w.id[i] + 0.1 * (a[i] - 0.5);
        const m = stone * 0.85;
        col[i * 3] = dirt * 0.98 * (1 - m) + sv * m; col[i * 3 + 1] = dirt * 0.86 * (1 - m) + sv * 0.97 * m; col[i * 3 + 2] = dirt * 0.7 * (1 - m) + sv * 0.92 * m;
        h[i] = 0.3 + a[i] * 0.25 + m * (0.4 - w.f1[i] * 0.4) + grit * 0.1;
    }
    return { col, h };
}

function layerForest(S) {
    const r = mulberry32(61);
    const a = pfbm(S, 8, 5, 62), moss = pfbm(S, 5, 4, 63);
    const needles = new Float32Array(S * S);
    for (let n = 0; n < S * S / 10; n++) {   // short random strokes
        const x0 = r() * S, y0 = r() * S, ang = r() * Math.PI, len = 3 + r() * 6, v = 0.4 + r() * 0.6;
        for (let t = 0; t < len; t++) {
            const x = Math.floor(x0 + Math.cos(ang) * t + S) % S, y = Math.floor(y0 + Math.sin(ang) * t + S) % S;
            needles[y * S + x] = Math.max(needles[y * S + x], v);
        }
    }
    const col = new Float32Array(S * S * 3), h = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
        const m = sstep(0.5, 0.65, moss[i]);
        const v = 0.3 + 0.2 * (a[i] - 0.5) + needles[i] * 0.22;
        col[i * 3] = v * 1.05 * (1 - m) + 0.28 * m; col[i * 3 + 1] = v * 0.82 * (1 - m) + 0.36 * m; col[i * 3 + 2] = v * 0.6 * (1 - m) + 0.16 * m;
        h[i] = 0.3 + needles[i] * 0.4 + m * 0.2 + a[i] * 0.2;
    }
    return { col, h };
}

function layerSand(S) {
    const a = pfbm(S, 8, 5, 71), w = pworley(S, 30, 72), g = pnoise(S, 96, 73);
    const col = new Float32Array(S * S * 3), h = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
        const peb = sstep(0.45, 0.2, w.f1[i]);
        const v = 0.55 + 0.12 * (a[i] - 0.5) + 0.08 * (g[i] - 0.5) + (w.id[i] - 0.5) * 0.2 * peb;
        col[i * 3] = v * 0.98; col[i * 3 + 1] = v * 0.95; col[i * 3 + 2] = v * 0.88;
        h[i] = 0.3 + peb * 0.45 + g[i] * 0.15;
    }
    return { col, h };
}

const RECIPES = [layerGrass, layerSoil, layerRock, layerSnow, layerRoad, layerForest, layerSand];

function makeArray(layers, S, srgb, anisotropy) {
    const data = new Uint8Array(S * S * 4 * layers.length);
    layers.forEach((l, k) => data.set(l, k * S * S * 4));
    const t = new THREE.DataArrayTexture(data, S, S, layers.length);
    t.format = THREE.RGBAFormat;
    t.type = THREE.UnsignedByteType;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = anisotropy;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
}

/** { albedo: DataArrayTexture (rgb + height), normal: DataArrayTexture } */
export function makeTerrainTextures(size = 256, anisotropy = 4) {
    const alb = [], nrm = [];
    RECIPES.forEach((fn, k) => {
        const { col, h } = fn(size);
        alb.push(packRGBA(size, col, h));
        nrm.push(heightToNormal(h, size, NORMAL_STRENGTH[k] * size / 256));
    });
    return { albedo: makeArray(alb, size, true, anisotropy), normal: makeArray(nrm, size, false, anisotropy) };
}

/** Tileable normal map for water: two octaves of soft swell. */
export function makeWaterNormal(size = 256) {
    const a = pfbm(size, 8, 4, 91), b = pfbm(size, 16, 3, 92);
    const h = new Float32Array(size * size);
    for (let i = 0; i < h.length; i++) h[i] = a[i] * 0.7 + b[i] * 0.3;
    const t = new THREE.DataTexture(heightToNormal(h, size, 9), size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
}

/** Canvas → texture helper for painted textures (cards, atlases, UI). */
export function canvasTexture(w, h, draw, opts = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = opts.linear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = opts.anisotropy || 4;
    return t;
}

export { clamp01, sstep };
