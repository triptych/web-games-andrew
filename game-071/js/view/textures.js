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

// ---------------------------------------------------------------- structure layers
// 0 logs · 1 planks · 2 shingles · 3 thatch · 4 masonry · 5 fieldstone · 6 plaster · 7 flagstones
// 8 iron · 9 cloth · 10 beam · 11 straw · 12 carved stone · 13 brass · 14 window · 15 hide · 16 turf
export const SLAYER = { log: 0, plank: 1, shingle: 2, thatch: 3, masonry: 4, field: 5, plaster: 6, flag: 7, iron: 8, cloth: 9, beam: 10, straw: 11, carved: 12, brass: 13, window: 14, hide: 15, turf: 16 };
// metres covered by one tile of each layer
export const SLAYER_SCALE = [2.4, 2.0, 2.0, 2.4, 3.0, 3.0, 2.5, 3.0, 1.5, 1.5, 1.6, 2.0, 2.5, 2.0, 1.2, 2.2, 3.0];
export const SLAYER_ROUGH = [0.9, 0.85, 0.82, 0.95, 0.88, 0.92, 0.93, 0.85, 0.45, 0.95, 0.85, 0.97, 0.86, 0.35, 0.2, 0.8, 0.98];
export const SLAYER_METAL = [0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0.9, 0.1, 0, 0];

function structLayer(k, S) {
    const col = new Float32Array(S * S * 3), h = new Float32Array(S * S);
    const set = (i, r, g, b, hh) => { col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b; h[i] = hh; };
    const n1 = pfbm(S, 8, 4, 500 + k), n2 = pnoise(S, 64, 520 + k), grain = pnoise(S, 128, 540 + k);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = y * S + x, u = x / S, v = y / S;
        switch (k) {
            case 0: { // horizontal logs, 8 per tile, rounded with end-grain-ish knots
                const f = (v * 8) % 1, round = Math.sin(f * Math.PI);
                const gr = 0.5 + 0.5 * Math.sin(u * 60 + n1[i] * 8 + Math.floor(v * 8) * 3);
                const val = (0.3 + 0.18 * gr + 0.1 * (n2[i] - 0.5)) * (0.45 + 0.55 * round);
                set(i, val * 1.15, val * 0.88, val * 0.62, round * 0.8 + gr * 0.1); break;
            }
            case 1: { // vertical planks, 6 per tile with gaps
                const f = (u * 6) % 1, gap = sstep(0.0, 0.04, f) * sstep(1.0, 0.96, f);
                const gr = 0.5 + 0.5 * Math.sin(v * 40 + n1[i] * 10 + Math.floor(u * 6) * 5);
                const tone = 0.85 + 0.3 * ((Math.floor(u * 6) * 0.37) % 1);
                const val = (0.32 + 0.12 * gr + 0.06 * (grain[i] - 0.5)) * tone * (0.35 + 0.65 * gap);
                set(i, val * 1.12, val * 0.86, val * 0.62, gap * 0.6 + gr * 0.1); break;
            }
            case 2: { // wooden shingles in staggered rows
                const row = Math.floor(v * 10), f = (v * 10) % 1, off = (row % 2) * 0.5;
                const cu = (u * 7 + off) % 1, edge = sstep(0.0, 0.06, cu) * sstep(1.0, 0.94, cu);
                const lift = f;   // each shingle thickens toward its bottom edge
                const tone = 0.75 + 0.35 * hash01i(Math.floor(u * 7 + off), row);
                const val = (0.24 + 0.1 * (n2[i] - 0.5) + 0.06 * Math.sin(v * 200 + n1[i] * 9)) * tone * (0.5 + 0.5 * edge) * (0.6 + 0.4 * lift);
                set(i, val * 1.1, val * 0.9, val * 0.72, lift * 0.7 * edge); break;
            }
            case 3: { // thatch: dense straw strokes
                const st = 0.5 + 0.5 * Math.sin(u * 220 + n1[i] * 30 + grain[i] * 6);
                const val = 0.38 + 0.18 * st + 0.12 * (n1[i] - 0.5);
                set(i, val * 1.05, val * 0.88, val * 0.55, st * 0.5 + n1[i] * 0.4); break;
            }
            case 4: case 12: { // masonry blocks (12 adds carved knotwork bands)
                const rows = 6, row = Math.floor(v * rows), off = (row % 2) * 0.5;
                const bu = (u * 3 + off) % 1, bv = (v * rows) % 1;
                const mort = sstep(0.0, 0.05, bu) * sstep(1.0, 0.95, bu) * sstep(0.0, 0.08, bv) * sstep(1.0, 0.92, bv);
                const tone = 0.8 + 0.3 * hash01i(Math.floor(u * 3 + off), row);
                let val = (0.4 + 0.14 * (n1[i] - 0.5) + 0.06 * (grain[i] - 0.5)) * tone * (0.45 + 0.55 * mort);
                if (k === 12) {
                    const band = row === 2 || row === 3;
                    const knot = band ? Math.abs(Math.sin(u * Math.PI * 12 + Math.sin(v * Math.PI * 12) * 2)) : 1;
                    val *= band ? 0.75 + 0.35 * sstep(0.2, 0.5, knot) : 1;
                    set(i, val * 0.92, val * 0.95, val * 1.0, mort * 0.7 + (band ? knot * 0.2 : 0));
                } else set(i, val * 1.0, val * 0.97, val * 0.92, mort * 0.8 + n1[i] * 0.2);
                break;
            }
            case 5: case 7: { // fieldstone / flagstones: cellular stones
                if (!structLayer.w5) structLayer.w5 = pworley(S, 9, 555);
                if (!structLayer.w7) structLayer.w7 = pworley(S, 6, 777);
                const w = k === 5 ? structLayer.w5 : structLayer.w7;
                const e = sstep(0.0, 0.08, w.f2[i] - w.f1[i]);
                const val = (0.36 + 0.2 * w.id[i] + 0.1 * (n1[i] - 0.5)) * (0.35 + 0.65 * e);
                set(i, val * 1.0, val * 0.97, val * 0.9, e * 0.6 + (1 - w.f1[i]) * 0.3); break;
            }
            case 6: { // plaster with stains
                const val = 0.72 + 0.1 * (n1[i] - 0.5) + 0.05 * (grain[i] - 0.5) - sstep(0.6, 0.8, n1[i]) * 0.15;
                set(i, val * 0.98, val * 0.94, val * 0.86, 0.5 + n1[i] * 0.2); break;
            }
            case 8: { // dark iron with hammer marks
                const val = 0.25 + 0.1 * (n1[i] - 0.5) + 0.05 * grain[i];
                set(i, val * 0.9, val * 0.92, val, 0.5 + grain[i] * 0.2); break;
            }
            case 9: { // woven cloth (white; tinted by vertex colour)
                const weave = 0.5 + 0.25 * Math.sin(u * 400) + 0.25 * Math.sin(v * 400);
                const val = 0.7 + 0.12 * weave + 0.08 * (n1[i] - 0.5);
                set(i, val, val, val, weave * 0.3); break;
            }
            case 10: { // dark beam wood
                const gr = 0.5 + 0.5 * Math.sin(v * 50 + n1[i] * 12);
                const val = 0.18 + 0.08 * gr + 0.04 * (grain[i] - 0.5);
                set(i, val * 1.1, val * 0.85, val * 0.62, gr * 0.3 + 0.3); break;
            }
            case 11: { // straw / hay
                const st = 0.5 + 0.5 * Math.sin(u * 160 + v * 40 + n1[i] * 20);
                const val = 0.55 + 0.2 * st;
                set(i, val * 1.05, val * 0.9, val * 0.5, st * 0.4); break;
            }
            case 13: { // brass plates with rivets
                const pu = (u * 4) % 1, pv = (v * 4) % 1;
                const seam = sstep(0.0, 0.03, pu) * sstep(0.0, 0.03, pv);
                const rivet = (Math.hypot(pu - 0.08, pv - 0.08) < 0.035 || Math.hypot(pu - 0.92, pv - 0.08) < 0.035) ? 1 : 0;
                const val = (0.55 + 0.15 * (n1[i] - 0.5)) * (0.6 + 0.4 * seam) + rivet * 0.2;
                set(i, val * 1.0, val * 0.72, val * 0.35, seam * 0.5 + rivet * 0.5); break;
            }
            case 14: { // leaded window: dark glass in a lattice (emissive at night via shader)
                const lu = (u * 4) % 1, lv = (v * 4) % 1;
                const lead = Math.min(sstep(0.0, 0.08, lu) * sstep(1.0, 0.92, lu), sstep(0.0, 0.08, lv) * sstep(1.0, 0.92, lv));
                const val = 0.12 + 0.1 * n1[i];
                set(i, lead > 0.5 ? val * 0.8 : 0.12, lead > 0.5 ? val * 0.9 : 0.1, lead > 0.5 ? val : 0.08, lead * 0.4); break;
            }
            case 15: { // stretched hide
                const val = 0.48 + 0.14 * (n1[i] - 0.5) + 0.06 * (grain[i] - 0.5);
                set(i, val * 1.08, val * 0.9, val * 0.68, n1[i] * 0.5); break;
            }
            case 16: { // turf / grass sod
                const val = 0.3 + 0.12 * (n1[i] - 0.5) + 0.1 * grain[i];
                set(i, val * 0.75, val * 1.0, val * 0.45, n1[i] * 0.4 + grain[i] * 0.3); break;
            }
        }
    }
    return { col, h };
}
function hash01i(a, b) { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

export function makeStructureTextures(size = 256, anisotropy = 4) {
    const alb = [], nrm = [];
    for (let k = 0; k < 17; k++) {
        const { col, h } = structLayer(k, size);
        alb.push(packRGBA(size, col, h));
        nrm.push(heightToNormal(h, size, k === 14 ? 1 : k === 9 ? 1.5 : 4 * size / 256));
    }
    return { albedo: makeArray(alb, size, true, anisotropy), normal: makeArray(nrm, size, false, anisotropy) };
}
