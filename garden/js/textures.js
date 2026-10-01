// Procedural canvas textures: marble, granite, flagstones, mosaic, wood, bark,
// copper patina, hedge leaves and terrain detail. No image files anywhere.

import * as THREE from 'three';
import { rng, tileNoise, clamp, lerp } from './util.js';

let SIZE = 512;
let anisotropy = 4;
export function setTextureQuality(size, aniso) {
    SIZE = size;
    anisotropy = aniso;
}

function canvas(w, h = w) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

const hex = (h) => {
    const c = new THREE.Color(h);
    return [c.r * 255, c.g * 255, c.b * 255];
};

function toTexture(cnv, { srgb = true, repeat = 1 } = {}) {
    const t = new THREE.CanvasTexture(cnv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = anisotropy;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
}

/** Height field (Float32Array, 0..1) -> tangent-space normal map canvas. */
function normalCanvas(height, n, strength) {
    const cnv = canvas(n);
    const ctx = cnv.getContext('2d');
    const img = ctx.createImageData(n, n);
    const at = (x, y) => height[((y + n) % n) * n + ((x + n) % n)];
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
            const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
            const inv = 1 / Math.hypot(dx, dy, 1);
            const i = (y * n + x) * 4;
            img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
            img.data[i + 1] = (dy * inv * 0.5 + 0.5) * 255;
            img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return cnv;
}

/** Fill a canvas from a per-pixel function returning [r,g,b] (0..255) and a height. */
function paint(n, fn) {
    const cnv = canvas(n);
    const ctx = cnv.getContext('2d');
    const img = ctx.createImageData(n, n);
    const height = new Float32Array(n * n);
    const out = [0, 0, 0, 0];
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            out[3] = 0.5;
            fn(x, y, out);
            const i = (y * n + x) * 4;
            img.data[i] = clamp(out[0], 0, 255);
            img.data[i + 1] = clamp(out[1], 0, 255);
            img.data[i + 2] = clamp(out[2], 0, 255);
            img.data[i + 3] = 255;
            height[y * n + x] = out[3];
        }
    }
    ctx.putImageData(img, 0, 0);
    return { cnv, height };
}

/** Tileable cellular noise: nearest/second-nearest distance and cell id. */
function voronoi(n, cells, seed) {
    const r = rng(seed);
    const pts = [];
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + 0.15 + r() * 0.7) / cells, (j + 0.15 + r() * 0.7) / cells, r()]);
    return (u, v) => {
        const ci = Math.floor(u * cells), cj = Math.floor(v * cells);
        let f1 = 9, f2 = 9, id = 0;
        for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
                let ii = ci + di, jj = cj + dj, ox = 0, oy = 0;
                if (ii < 0) { ii += cells; ox = -1; } else if (ii >= cells) { ii -= cells; ox = 1; }
                if (jj < 0) { jj += cells; oy = -1; } else if (jj >= cells) { jj -= cells; oy = 1; }
                const p = pts[jj * cells + ii];
                const d = Math.hypot(p[0] + ox - u, p[1] + oy - v);
                if (d < f1) { f2 = f1; f1 = d; id = p[2]; } else if (d < f2) f2 = d;
            }
        }
        return { f1, f2, id };
    };
}

const cache = new Map();
function cached(key, make) {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
}

export function marble() {
    return cached('marble', () => {
        const n = SIZE;
        const { cnv, height } = paint(n, (x, y, o) => {
            const u = (x / n) * 6, v = (y / n) * 6;
            const warp = tileNoise(u * 1.3, v * 1.3, 7.8, 4) * 2.4;
            const vein = Math.abs(Math.sin((u + v * 0.6) * 1.9 + warp * 3.1));
            const fine = Math.pow(1 - vein, 14) * 0.7;
            const cloud = tileNoise(u * 2, v * 2, 12, 3) * 0.5 + 0.5;
            const base = 236 - cloud * 18;
            o[0] = base - fine * 70;
            o[1] = base - fine * 66 - 2;
            o[2] = base - fine * 58 + 3;
            o[3] = 0.5 + cloud * 0.05 - fine * 0.08;
        });
        return { map: toTexture(cnv), normalMap: toTexture(normalCanvas(height, n, 4), { srgb: false }) };
    });
}

/** Weathered granite (pinkish grey, Myst-like) for pedestals, walls and cliffs. */
export function granite() {
    return cached('granite', () => {
        const n = SIZE;
        const r = rng(7);
        const speck = new Float32Array(n * n);
        for (let i = 0; i < n * n * 0.06; i++) speck[Math.floor(r() * n * n)] = r() < 0.5 ? -1 : 1;
        const { cnv, height } = paint(n, (x, y, o) => {
            const u = (x / n) * 8, v = (y / n) * 8;
            const a = tileNoise(u, v, 8, 5);
            const b = tileNoise(u * 3, v * 3, 24, 2);
            const s = speck[y * n + x];
            const g = 150 + a * 30 + b * 14 + s * 22;
            o[0] = g + 8;
            o[1] = g - 2;
            o[2] = g - 6;
            o[3] = 0.5 + a * 0.3 + b * 0.1;
        });
        return { map: toTexture(cnv), normalMap: toTexture(normalCanvas(height, n, 6), { srgb: false }) };
    });
}

export function flagstones() {
    return cached('flag', () => {
        const n = SIZE;
        const vor = voronoi(n, 5, 21);
        const { cnv, height } = paint(n, (x, y, o) => {
            const u = x / n, v = y / n;
            const { f1, f2, id } = vor(u, v);
            const edge = f2 - f1;
            const grit = tileNoise(u * 40, v * 40, 40, 2);
            const tone = tileNoise(u * 6, v * 6, 6, 3);
            const mortar = edge < 0.018;
            const bevel = clamp(edge / 0.05, 0, 1);
            if (mortar) {
                const moss = tileNoise(u * 20, v * 20, 20, 2) > 0;
                o[0] = moss ? 70 : 92; o[1] = moss ? 92 : 84; o[2] = moss ? 48 : 72;
                o[3] = 0.1;
            } else {
                const base = 150 + id * 50 + tone * 18 + grit * 10;
                const warm = (id - 0.5) * 18;
                o[0] = base + warm; o[1] = base - 4; o[2] = base - 10 - warm * 0.6;
                const shade = 0.75 + bevel * 0.25;
                o[0] *= shade; o[1] *= shade; o[2] *= shade;
                o[3] = 0.45 + bevel * 0.4 + grit * 0.04 + tone * 0.05;
            }
        });
        return { map: toTexture(cnv), normalMap: toTexture(normalCanvas(height, n, 7), { srgb: false }) };
    });
}

/** Radial mosaic for the hub plaza: rings, a compass star and the genre spokes. */
export function plazaMosaic(slots, accents) {
    return cached('mosaic', () => {
        const n = SIZE * 2;
        const cnv = canvas(n);
        const ctx = cnv.getContext('2d');
        const c = n / 2;
        const flag = flagstones().map.image;
        ctx.fillStyle = ctx.createPattern(flag, 'repeat');
        ctx.fillRect(0, 0, n, n);
        ctx.fillStyle = 'rgba(205,192,168,0.35)';
        ctx.fillRect(0, 0, n, n);
        const ring = (r, w, col) => {
            ctx.beginPath();
            ctx.arc(c, c, r * c, 0, Math.PI * 2);
            ctx.lineWidth = w * c;
            ctx.strokeStyle = col;
            ctx.stroke();
        };
        ring(0.97, 0.05, '#6b5d4f');
        ring(0.9, 0.012, '#b08a4a');
        ring(0.42, 0.03, '#6b5d4f');
        ring(0.36, 0.01, '#b08a4a');
        // spokes toward each path in the genre accent
        for (let i = 0; i < slots; i++) {
            const a = (i / slots) * Math.PI * 2;
            const col = accents[i] || '#d9c79f';
            ctx.save();
            ctx.translate(c, c);
            ctx.rotate(-a);
            const grad = ctx.createLinearGradient(0, 0.42 * c, 0, 0.95 * c);
            grad.addColorStop(0, col);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(-0.02 * c, 0.42 * c);
            ctx.lineTo(-0.07 * c, 0.7 * c);
            ctx.lineTo(0, 0.95 * c);
            ctx.lineTo(0.07 * c, 0.7 * c);
            ctx.lineTo(0.02 * c, 0.42 * c);
            ctx.fill();
            ctx.restore();
        }
        // compass star
        ctx.save();
        ctx.translate(c, c);
        for (let i = 0; i < 16; i++) {
            ctx.rotate(Math.PI / 8);
            const long = i % 2 === 0;
            ctx.fillStyle = i % 4 === 0 ? '#3d4f6b' : long ? '#c9a45c' : '#7f6a50';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0.035 * c, 0.06 * c);
            ctx.lineTo(0, (long ? 0.34 : 0.22) * c);
            ctx.lineTo(-0.035 * c, 0.06 * c);
            ctx.fill();
        }
        ctx.restore();
        ring(0.08, 0.02, '#c9a45c');
        const t = toTexture(cnv);
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        return t;
    });
}

export function woodPlanks() {
    return cached('wood', () => {
        const n = SIZE;
        const { cnv, height } = paint(n, (x, y, o) => {
            const u = x / n, v = y / n;
            const plank = Math.floor(u * 6);
            const pu = u * 6 - plank;
            const r = rng(plank * 97 + 3);
            const tint = r();
            const grain = tileNoise(u * 60, v * 4 + plank * 3, 60, 3);
            const rings = Math.sin((v * 30 + grain * 4 + plank * 7) * 2) * 0.5 + 0.5;
            const gap = pu < 0.03 || pu > 0.97;
            const g = 105 + tint * 40 + rings * 18 + grain * 15;
            o[0] = gap ? 40 : g * 1.05;
            o[1] = gap ? 30 : g * 0.82;
            o[2] = gap ? 22 : g * 0.6;
            o[3] = gap ? 0 : 0.5 + rings * 0.1;
        });
        return { map: toTexture(cnv), normalMap: toTexture(normalCanvas(height, n, 5), { srgb: false }) };
    });
}

export function bark() {
    return cached('bark', () => {
        const n = SIZE / 2;
        const { cnv, height } = paint(n, (x, y, o) => {
            const u = x / n, v = y / n;
            const ridges = tileNoise(u * 16, v * 3, 16, 4);
            const r = Math.pow(Math.abs(Math.sin(u * 40 + ridges * 6)), 0.6);
            const g = 60 + r * 45 + ridges * 20;
            o[0] = g * 1.1; o[1] = g * 0.9; o[2] = g * 0.75;
            o[3] = r;
        });
        return { map: toTexture(cnv), normalMap: toTexture(normalCanvas(height, n, 5), { srgb: false }) };
    });
}

export function copperPatina() {
    return cached('copper', () => {
        const n = SIZE / 2;
        const { cnv, height } = paint(n, (x, y, o) => {
            const u = x / n, v = y / n;
            const a = tileNoise(u * 6, v * 6, 6, 5);
            const b = tileNoise(u * 20, v * 20, 20, 2);
            const streak = tileNoise(u * 30, v * 2, 30, 3);
            const p = clamp(0.55 + a * 0.6 + streak * 0.3, 0, 1);
            const c0 = hex('#8a5a32'), c1 = hex('#5fae98');
            o[0] = lerp(c0[0], c1[0], p) + b * 15;
            o[1] = lerp(c0[1], c1[1], p) + b * 15;
            o[2] = lerp(c0[2], c1[2], p) + b * 15;
            o[3] = 0.5 + a * 0.2;
        });
        return { map: toTexture(cnv), normalMap: toTexture(normalCanvas(height, n, 3), { srgb: false }) };
    });
}

export function leaves() {
    return cached('leaves', () => {
        const n = SIZE / 2;
        const vor = voronoi(n, 14, 5);
        const { cnv, height } = paint(n, (x, y, o) => {
            const u = x / n, v = y / n;
            const { f1, id } = vor(u, v);
            const t = tileNoise(u * 8, v * 8, 8, 3);
            const lit = clamp(1 - f1 * 9, 0, 1);
            o[0] = 30 + id * 25 + lit * 35 + t * 10;
            o[1] = 70 + id * 40 + lit * 60 + t * 15;
            o[2] = 25 + id * 12 + lit * 20;
            o[3] = lit * 0.8 + t * 0.1;
        });
        return { map: toTexture(cnv), normalMap: toTexture(normalCanvas(height, n, 4), { srgb: false }) };
    });
}

/** Grey detail for the terrain: R = grass/soil grain, G = rock grain. */
export function terrainDetail() {
    return cached('tdetail', () => {
        const n = SIZE;
        const { cnv } = paint(n, (x, y, o) => {
            const u = x / n, v = y / n;
            const g = tileNoise(u * 32, v * 32, 32, 3) * 0.5 + tileNoise(u * 96, v * 96, 96, 1) * 0.5;
            const r = tileNoise(u * 12, v * 12, 12, 5);
            o[0] = 170 + g * 120;
            o[1] = 165 + r * 110 + tileNoise(u * 64, v * 64, 64, 2) * 30;
            o[2] = 200;
        });
        return toTexture(cnv, { srgb: false });
    });
}

/** Soft round sprite for particles. */
export function glowSprite() {
    return cached('glow', () => {
        const n = 64;
        const cnv = canvas(n);
        const ctx = cnv.getContext('2d');
        const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, n, n);
        const t = new THREE.CanvasTexture(cnv);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    });
}

export { canvas, toTexture };
