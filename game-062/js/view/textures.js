// Procedural canvas textures: floors, walls, fruit skins, splats, glows. No image files.
// Every generator is cached by key, so building a floor twice costs nothing.

import * as THREE from 'three';

const cache = new Map();
const mk = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Tiny seeded RNG for texture detail (cosmetic only).
function trng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Tileable value noise sampled on a period grid.
function makeNoise(seed, period) {
    const r = trng(seed);
    const g = new Float32Array(period * period).map(() => r());
    const at = (x, y) => g[((y % period + period) % period) * period + ((x % period + period) % period)];
    return (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
        const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
        const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
        const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
        return a + (b - a) * sy;
    };
}
function fbm(n, x, y, oct = 4) { let a = 0.5, s = 0, f = 1, norm = 0; for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; norm += a; a *= 0.5; f *= 2; } return s / norm; }

function toTex(canvas, { repeat = true, srgb = true } = {}) {
    const t = new THREE.CanvasTexture(canvas);
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** Paint per-pixel with fn(x, y) → [r,g,b] into a canvas. */
function paint(size, fn) {
    const c = mk(size);
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const [r, gg, b, a = 255] = fn(x, y);
        const i = (y * size + x) * 4;
        img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = a;
    }
    g.putImageData(img, 0, 0);
    return c;
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const mix = (a, b, t) => a + (b - a) * t;
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

// ------------------------------------------------------------------ floors
// A flagstone pattern: irregular stones (jittered grid + per-stone tint) with dark mortar.
function flagstones(size, seed, palette, opts = {}) {
    const n = makeNoise(seed, 16), n2 = makeNoise(seed + 9, 64);
    const cells = opts.cells || 4;
    const r = trng(seed);
    const pts = [];
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + 0.2 + r() * 0.6) / cells, (j + 0.2 + r() * 0.6) / cells, r()]);
    const color = new Uint8ClampedArray(size * size * 3);
    const height = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        let d1 = 9, d2 = 9, id = 0;
        for (let k = 0; k < pts.length; k++) {
            for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
                const dx = u - (pts[k][0] + ox), dy = v - (pts[k][1] + oy);
                const d = dx * dx + dy * dy;
                if (d < d1) { d2 = d1; d1 = d; id = k; } else if (d < d2) d2 = d;
            }
        }
        const edge = Math.sqrt(d2) - Math.sqrt(d1);
        const mortar = edge < 0.012 ? 1 : edge < 0.022 ? (0.022 - edge) / 0.01 : 0;
        const tint = pts[id][2];
        const nz = fbm(n, u * 16, v * 16, 4), fine = n2(u * 64, v * 64);
        const base = palette.stone(tint, nz, fine, u, v);
        const m = palette.mortar;
        const k = mortar;
        const i = y * size + x;
        color[i * 3] = clamp(mix(base[0], m[0], k));
        color[i * 3 + 1] = clamp(mix(base[1], m[1], k));
        color[i * 3 + 2] = clamp(mix(base[2], m[2], k));
        height[i] = (1 - k) * (0.7 + nz * 0.3) + fine * 0.08;
    }
    return { color, height };
}

function finishMaps(size, color, height, extra = null) {
    const c = paint(size, (x, y) => { const i = y * size + x; return [color[i * 3], color[i * 3 + 1], color[i * 3 + 2]]; });
    const h = paint(size, (x, y) => { const v = height[y * size + x] * 255; return [v, v, v]; });
    const out = { map: toTex(c), bump: toTex(h, { srgb: false }) };
    if (extra) out.emissive = toTex(extra);
    return out;
}

export function floorTex(theme) {
    const key = 'floor:' + theme;
    if (cache.has(key)) return cache.get(key);
    const S = 512;
    let res;
    if (theme === 'cellar') {
        const { color, height } = flagstones(S, 11, {
            mortar: [38, 28, 22],
            stone: (t, nz, f) => { const b = 0.75 + nz * 0.45 + f * 0.1; const c = t < 0.33 ? [132, 108, 84] : t < 0.66 ? [118, 98, 80] : [140, 118, 90]; return [c[0] * b, c[1] * b, c[2] * b]; },
        });
        res = finishMaps(S, color, height);
    } else if (theme === 'jam') {
        const { color, height } = flagstones(S, 23, {
            mortar: [40, 14, 30],
            stone: (t, nz, f, u, v) => { const b = 0.7 + nz * 0.5 + f * 0.08; const c = t < 0.5 ? [104, 72, 104] : [92, 64, 96]; const stain = fbm(makeNoiseCached(5), u * 6, v * 6, 3) > 0.62 ? 0.55 : 0; return [mix(c[0] * b, 150, stain), mix(c[1] * b, 20, stain), mix(c[2] * b, 60, stain)]; },
        }, { cells: 3 });
        res = finishMaps(S, color, height);
    } else if (theme === 'core') {
        const n = makeNoise(31, 16), n2 = makeNoise(37, 32);
        const color = new Uint8ClampedArray(S * S * 3), height = new Float32Array(S * S);
        const glow = paint(S, () => [0, 0, 0]);
        const gg = glow.getContext('2d');
        const gimg = gg.getImageData(0, 0, S, S);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const u = x / S, v = y / S;
            const nz = fbm(n, u * 16, v * 16, 5);
            const crack = Math.abs(fbm(n2, u * 16, v * 16, 3) - 0.5);
            const c = crack < 0.012 ? 1 : 0;
            const i = y * S + x;
            const b = 0.55 + nz * 0.7;
            color[i * 3] = clamp(78 * b + c * 120); color[i * 3 + 1] = clamp(56 * b + c * 40); color[i * 3 + 2] = clamp(60 * b + c * 30);
            height[i] = nz - c * 0.6;
            const gl = crack < 0.016 ? (0.016 - crack) / 0.016 : 0;
            gimg.data[i * 4] = 255 * gl; gimg.data[i * 4 + 1] = 90 * gl; gimg.data[i * 4 + 2] = 60 * gl;
        }
        gg.putImageData(gimg, 0, 0);
        res = finishMaps(S, color, height, glow);
    } else if (theme === 'grass') {
        const n = makeNoise(41, 16), n2 = makeNoise(43, 128);
        const color = new Uint8ClampedArray(S * S * 3), height = new Float32Array(S * S);
        const r = trng(7);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const u = x / S, v = y / S;
            const nz = fbm(n, u * 8, v * 8, 4), bl = n2(u * 128, v * 128);
            const i = y * S + x;
            color[i * 3] = clamp(78 + nz * 50 + bl * 30); color[i * 3 + 1] = clamp(128 + nz * 60 + bl * 40); color[i * 3 + 2] = clamp(52 + nz * 20);
            height[i] = bl * 0.6 + nz * 0.4;
        }
        // Little flowers.
        for (let k = 0; k < 160; k++) {
            const x = Math.floor(r() * S), y = Math.floor(r() * S), col = [[255, 240, 120], [255, 170, 200], [250, 250, 250], [190, 160, 255]][k % 4];
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (dx && dy) continue; const i = (((y + dy + S) % S) * S + ((x + dx + S) % S)); color.set(col, i * 3); height[i] = 1; }
        }
        res = finishMaps(S, color, height);
    } else { // path cobbles
        const { color, height } = flagstones(S, 51, {
            mortar: [92, 80, 58],
            stone: (t, nz, f) => { const b = 0.8 + nz * 0.35 + f * 0.08; return [196 * b, 176 * b, 140 * b]; },
        }, { cells: 6 });
        res = finishMaps(S, color, height);
    }
    cache.set(key, res);
    return res;
}
const noiseCache = new Map();
function makeNoiseCached(seed) { if (!noiseCache.has(seed)) noiseCache.set(seed, makeNoise(seed, 16)); return noiseCache.get(seed); }

export function wallTex(theme) {
    const key = 'wall:' + theme;
    if (cache.has(key)) return cache.get(key);
    const S = 256;
    const n = makeNoise(61 + theme.length, 16);
    const r = trng(theme.length * 13);
    const color = new Uint8ClampedArray(S * S * 3), height = new Float32Array(S * S);
    if (theme === 'cellar' || theme === 'jam' || theme === 'town') {
        // Bricks: rows of offset blocks.
        const rows = theme === 'jam' ? 4 : 6, cols = theme === 'jam' ? 2 : 3;
        const tints = Array.from({ length: rows * cols * 2 }, () => r());
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const v = y / S, row = Math.floor(v * rows), off = row % 2 ? 0.5 / cols : 0;
            const u = (x / S + off) % 1, col = Math.floor(u * cols);
            const fu = u * cols - col, fv = v * rows - row;
            const edge = Math.min(fu, 1 - fu, (fv) * cols / rows * 2, (1 - fv) * cols / rows * 2);
            const mortar = edge < 0.035 ? 1 : 0;
            const t = tints[row * cols + col];
            const nz = fbm(n, x / S * 12, y / S * 12, 4);
            const i = y * S + x;
            let c;
            if (theme === 'cellar') c = [120 + t * 40, 82 + t * 22, 58 + t * 14];
            else if (theme === 'jam') c = [86 + t * 30, 60 + t * 18, 92 + t * 24];
            else c = [200 + t * 30, 190 + t * 25, 168 + t * 20];
            const b = 0.7 + nz * 0.45;
            const m = theme === 'jam' ? [30, 12, 26] : theme === 'town' ? [140, 128, 110] : [44, 32, 24];
            color[i * 3] = clamp(mortar ? m[0] : c[0] * b); color[i * 3 + 1] = clamp(mortar ? m[1] : c[1] * b); color[i * 3 + 2] = clamp(mortar ? m[2] : c[2] * b);
            height[i] = mortar ? 0 : 0.6 + nz * 0.4;
        }
        if (theme === 'jam') {
            // Jam drips from the top.
            for (let k = 0; k < 9; k++) {
                const x0 = Math.floor(r() * S), len = 30 + r() * 120, w = 4 + r() * 7;
                for (let y = 0; y < len; y++) for (let x = -w; x <= w; x++) {
                    const ww = w * (1 - (y / len) * 0.6) + (y > len - 8 ? 3 : 0);
                    if (Math.abs(x) > ww) continue;
                    const i = y * S + ((x0 + x + S) % S);
                    color[i * 3] = 150; color[i * 3 + 1] = 18; color[i * 3 + 2] = 50; height[i] = 1;
                }
            }
        }
    } else {
        // Core: lumpy rock with glowing veins.
        const n2 = makeNoise(77, 32);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const u = x / S, v = y / S;
            const nz = fbm(n, u * 10, v * 10, 5), vein = Math.abs(fbm(n2, u * 20, v * 20, 2) - 0.5);
            const i = y * S + x;
            const b = 0.45 + nz * 0.8;
            const vg = vein < 0.02 ? 1 : 0;
            color[i * 3] = clamp(92 * b + vg * 160); color[i * 3 + 1] = clamp(50 * b + vg * 50); color[i * 3 + 2] = clamp(60 * b + vg * 20);
            height[i] = nz;
        }
    }
    const res = finishMaps(S, color, height);
    cache.set(key, res);
    return res;
}

// ------------------------------------------------------------------ fruit skins
// Each returns { map, bump?, rough? } for a lathe-unwrapped body (u around, v bottom→top).
export function skinTex(kind, base) {
    const key = `skin:${kind}:${base}`;
    if (cache.has(key)) return cache.get(key);
    const S = 256;
    const c0 = hex(base);
    const n = makeNoise(kind.length * 31 + 3, 16);
    const r = trng(kind.length * 7 + 1);
    let res;
    const plain = (fn, bumpFn) => {
        const col = paint(S, (x, y) => fn(x / S, 1 - y / S));
        const out = { map: toTex(col) };
        if (bumpFn) out.bump = toTex(paint(S, (x, y) => { const v = bumpFn(x / S, 1 - y / S) * 255; return [v, v, v]; }), { srgb: false });
        return out;
    };
    switch (kind) {
        case 'orange': case 'lemon': case 'lime':
            res = plain((u, v) => { const d = fbm(n, u * 40, v * 20, 2); const b = 0.88 + d * 0.22; return [c0[0] * b, c0[1] * b, c0[2] * b]; },
                (u, v) => { const d = n(u * 90, v * 45); return 0.5 + (d - 0.5) * 1.6; });
            break;
        case 'strawberry': {
            const seeds = [];
            for (let j = 0; j < 9; j++) for (let i = 0; i < 14; i++) seeds.push([(i + (j % 2) * 0.5) / 14, 0.1 + (j / 9) * 0.82]);
            res = plain((u, v) => {
                let s = 0;
                for (const [su, sv] of seeds) { const du = Math.min(Math.abs(u - su), 1 - Math.abs(u - su)) * 2.2, dv = v - sv; const d = du * du + dv * dv * 1.4; if (d < 0.0006) s = 1; else if (d < 0.0014) s = Math.max(s, 0.4); }
                const shade = 0.85 + fbm(n, u * 10, v * 10, 2) * 0.25;
                return s > 0.9 ? [250, 225, 110] : [mix(c0[0] * shade, 120, s), mix(c0[1] * shade, 10, s), mix(c0[2] * shade, 20, s)];
            }, (u, v) => {
                let s = 0.6;
                for (const [su, sv] of seeds) { const du = Math.min(Math.abs(u - su), 1 - Math.abs(u - su)) * 2.2, dv = v - sv; const d = du * du + dv * dv * 1.4; if (d < 0.0014) s = 0.1; }
                return s;
            });
            break;
        }
        case 'watermelon':
            res = plain((u, v) => { const s = Math.sin(u * Math.PI * 2 * 9 + fbm(n, u * 6, v * 8, 3) * 6) > 0.1 ? 1 : 0; return s ? [34, 98, 40] : [96, 168, 70]; });
            break;
        case 'pineapple':
            res = plain((u, v) => {
                const a = (u * 12 + v * 8) % 1, b = (u * 12 - v * 8 + 10) % 1;
                const e = Math.min(a, 1 - a, b, 1 - b);
                const ctr = Math.max(0, 0.5 - e) * 2;
                return e < 0.06 ? [120, 74, 20] : [200 * (0.7 + ctr * 0.4), 150 * (0.7 + ctr * 0.4), 40];
            }, (u, v) => { const a = (u * 12 + v * 8) % 1, b = (u * 12 - v * 8 + 10) % 1; return Math.min(a, 1 - a, b, 1 - b) * 2; });
            break;
        case 'kiwi': case 'coconut': case 'peach':
            res = plain((u, v) => {
                const f = n(u * 120, v * 120), g = fbm(n, u * 8, v * 6, 3);
                if (kind === 'peach') { const blush = Math.max(0, Math.sin(u * 6.28) * 0.5 + 0.2) * (0.3 + v * 0.7); return [mix(c0[0], 230, blush * 0.4), mix(c0[1], 90, blush), mix(c0[2], 70, blush)]; }
                const b = 0.7 + f * 0.4 + g * 0.2;
                return [c0[0] * b, c0[1] * b, c0[2] * b];
            }, (u, v) => n(u * 140, v * 140));
            break;
        case 'banana':
            res = plain((u, v) => { const streak = Math.abs(((u * 5) % 1) - 0.5) < 0.03 ? 0.75 : 1; const spot = fbm(n, u * 18, v * 18, 2) > 0.7 ? 0.5 : 1; const tip = v > 0.94 || v < 0.05 ? 0.35 : 1; return [c0[0] * streak * spot * tip, c0[1] * streak * spot * tip, c0[2] * streak * tip]; });
            break;
        case 'pumpkin':
            res = plain((u, v) => { const rib = 0.75 + 0.25 * Math.abs(Math.sin(u * Math.PI * 8)); return [c0[0] * rib, c0[1] * rib, c0[2] * rib]; }, (u) => Math.abs(Math.sin(u * Math.PI * 8)));
            break;
        case 'cactus':
            // Vertical ribs with little pale areoles along each ridge.
            res = plain((u, v) => {
                const rib = Math.abs(Math.sin(u * Math.PI * 10));
                const are = rib > 0.96 && Math.abs(((v * 9) % 1) - 0.5) < 0.08;
                const b = (0.62 + rib * 0.45) * (0.9 + fbm(n, u * 6, v * 6, 2) * 0.2);
                return are ? [238, 236, 200] : [c0[0] * b, c0[1] * b, c0[2] * b];
            }, (u) => Math.abs(Math.sin(u * Math.PI * 10)));
            break;
        case 'mold': // rotten overlay used as a full skin for grapes, tomatoes…
        default:
            res = plain((u, v) => { const g = fbm(n, u * 10, v * 8, 4); const b = 0.82 + g * 0.3; return [c0[0] * b, c0[1] * b, c0[2] * b]; },
                (u, v) => 0.5 + fbm(n, u * 30, v * 30, 2) * 0.5);
    }
    cache.set(key, res);
    return res;
}

/** Fuzzy mould patches drawn over a base colour (rotten monsters). */
export function rottenTex(base, seed = 1) {
    const key = `rot:${base}:${seed}`;
    if (cache.has(key)) return cache.get(key);
    const S = 256, c0 = hex(base);
    const n = makeNoise(seed * 17 + 5, 16), n2 = makeNoise(seed * 7 + 11, 64);
    const col = paint(S, (x, y) => {
        const u = x / S, v = y / S;
        const m = fbm(n, u * 6, v * 5, 4);
        const g = 0.85 + n2(u * 64, v * 64) * 0.25;
        if (m > 0.64) { const k = Math.min(1, (m - 0.64) * 9); return [mix(c0[0] * g, 196, k), mix(c0[1] * g, 214, k), mix(c0[2] * g, 170, k)]; }
        if (m > 0.58) return [c0[0] * 0.55, c0[1] * 0.6, c0[2] * 0.45];
        return [c0[0] * g, c0[1] * g, c0[2] * g];
    });
    const bump = paint(S, (x, y) => { const m = fbm(n, x / S * 6, y / S * 5, 4); const v = (m > 0.64 ? 0.9 : 0.4) * 255 + n2(x / 4, y / 4) * 40; return [v, v, v]; });
    const res = { map: toTex(col), bump: toTex(bump, { srgb: false }) };
    cache.set(key, res);
    return res;
}

// ------------------------------------------------------------------ fx textures
export function splatTex() {
    if (cache.has('splat')) return cache.get('splat');
    const S = 128, c = mk(S), g = c.getContext('2d');
    const r = trng(99);
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(64, 64, 26, 0, 6.283); g.fill();
    for (let k = 0; k < 14; k++) {
        const a = r() * 6.283, d = 18 + r() * 34, rr = 4 + r() * 11;
        g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rr, 0, 6.283); g.fill();
        g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a - 0.15) * d, 64 + Math.sin(a - 0.15) * d); g.lineTo(64 + Math.cos(a + 0.15) * d, 64 + Math.sin(a + 0.15) * d); g.fill();
    }
    for (let k = 0; k < 18; k++) { const a = r() * 6.283, d = 40 + r() * 20; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1.5 + r() * 3, 0, 6.283); g.fill(); }
    const t = toTex(c, { repeat: false, srgb: false });
    cache.set('splat', t);
    return t;
}

export function glowTex() {
    if (cache.has('glow')) return cache.get('glow');
    const c = mk(128), g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,255,255,0.7)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.16)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = toTex(c, { repeat: false });
    cache.set('glow', t);
    return t;
}

export function ringTex() {
    if (cache.has('ring')) return cache.get('ring');
    const c = mk(256), g = c.getContext('2d');
    g.strokeStyle = '#fff'; g.lineWidth = 10;
    g.beginPath(); g.arc(128, 128, 118, 0, 6.283); g.stroke();
    const grd = g.createRadialGradient(128, 128, 60, 128, 128, 120);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(255,255,255,0.35)');
    g.fillStyle = grd; g.beginPath(); g.arc(128, 128, 118, 0, 6.283); g.fill();
    const t = toTex(c, { repeat: false, srgb: false });
    cache.set('ring', t);
    return t;
}

/** Soft blob shadow under actors (cheap contact shadow on top of real shadows). */
export function blobTex() {
    if (cache.has('blob')) return cache.get('blob');
    const c = mk(64), g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(0.6, 'rgba(0,0,0,0.25)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const t = toTex(c, { repeat: false, srgb: false });
    cache.set('blob', t);
    return t;
}

/** Carved pumpkin face for Jack o' Lanterns (emissive map). */
export function jackFaceTex() {
    if (cache.has('jack')) return cache.get('jack');
    const c = mk(256), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#ffd36a';
    // Face spans u 0.38..0.62 (front of the lathe is u=0.25 in three's lathe → we draw centred and rotate in the model).
    const tri = (x, y, s) => { g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y + s * 0.7); g.lineTo(x - s, y + s * 0.7); g.fill(); };
    tri(108, 110, 14); tri(148, 110, 14);
    g.beginPath(); g.moveTo(96, 150); g.lineTo(160, 150); g.lineTo(150, 170); g.lineTo(138, 160); g.lineTo(128, 172); g.lineTo(118, 160); g.lineTo(106, 170); g.closePath(); g.fill();
    const t = toTex(c, { repeat: false });
    cache.set('jack', t);
    return t;
}

/** Noise texture for liquids (tileable, grayscale). */
export function liquidTex() {
    if (cache.has('liquid')) return cache.get('liquid');
    const n = makeNoise(321, 16);
    const c = paint(128, (x, y) => { const v = fbm(n, x / 128 * 16, y / 128 * 16, 4) * 255; return [v, v, v]; });
    const t = toTex(c, { srgb: false });
    cache.set('liquid', t);
    return t;
}

/** Wood planks for crates, doors, the well and the town. */
export function woodTex(tone = 0) {
    const key = 'wood:' + tone;
    if (cache.has(key)) return cache.get(key);
    const n = makeNoise(500 + tone, 16);
    const base = tone === 1 ? [150, 104, 60] : tone === 2 ? [96, 66, 44] : [182, 134, 84];
    const c = paint(128, (x, y) => {
        const plank = Math.floor(y / 32);
        const grain = fbm(n, x / 128 * 3 + plank * 7, y / 128 * 24, 3);
        const seam = y % 32 < 2 ? 0.45 : 1;
        const b = (0.75 + grain * 0.4) * seam * (0.92 + (plank % 2) * 0.1);
        return [base[0] * b, base[1] * b, base[2] * b];
    });
    const t = toTex(c);
    cache.set(key, t);
    return t;
}

/** Text label baked into a texture (signs, plaques). */
export function labelTex(text, { w = 256, h = 64, bg = '#3a2616', fg = '#ffe9b0', font = 'bold 30px Georgia, serif' } = {}) {
    const key = `label:${text}:${w}:${h}:${bg}:${fg}`;
    if (cache.has(key)) return cache.get(key);
    const c = mk(w, h), g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
    const t = toTex(c, { repeat: false });
    cache.set(key, t);
    return t;
}
