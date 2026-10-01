/**
 * textures.js — every surface is painted in code on a canvas: ten floor styles
 * and ten wall styles (one pair per world), plus wood and metal for props.
 * Each returns { map, bump }; bump is a luminance copy for MeshStandardMaterial.
 * Painters are seeded, so a world always looks the same. All tileable.
 */

import * as THREE from 'three';
import { makeRng } from '../sim/rng.js';

const SIZE = 256;
const cache = new Map();

function canvas(size = SIZE) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
}

// ------------------------------------------------------------------ Noise

function lattice(rng, n) {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rng.next();
    return g;
}
/** Tileable value noise sampler with period n over [0,1). */
function valueNoise(rng, n) {
    const g = lattice(rng, n);
    const s = (t) => t * t * (3 - 2 * t);
    return (u, v) => {
        const x = u * n, y = v * n;
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const fx = s(x - x0), fy = s(y - y0);
        const i0 = ((x0 % n) + n) % n, j0 = ((y0 % n) + n) % n, i1 = (i0 + 1) % n, j1 = (j0 + 1) % n;
        const a = g[j0 * n + i0], b = g[j0 * n + i1], c = g[j1 * n + i0], d = g[j1 * n + i1];
        return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
}
function fbm(rng, base = 4, oct = 4) {
    const ns = [];
    for (let o = 0; o < oct; o++) ns.push(valueNoise(rng, base << o));
    return (u, v) => { let s = 0, a = 0.5, t = 0; for (const n of ns) { s += n(u, v) * a; t += a; a *= 0.5; } return s / t; };
}

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** Per-pixel fill: colour from two tones by fbm, with extra fine grain. */
function noiseFill(ctx, rng, c1, c2, base = 4, oct = 5, contrast = 1.2, grain = 18) {
    const img = ctx.getImageData(0, 0, SIZE, SIZE);
    const d = img.data;
    const n = fbm(rng, base, oct);
    const A = hex(c1), B = hex(c2);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        let t = (n(x / SIZE, y / SIZE) - 0.5) * contrast + 0.5;
        t = Math.max(0, Math.min(1, t));
        const c = mix(A, B, t);
        const g = (rng.next() - 0.5) * grain;
        const i = (y * SIZE + x) * 4;
        d[i] = c[0] + g; d[i + 1] = c[1] + g; d[i + 2] = c[2] + g; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
}

/** Overlay fbm darkening/lightening on what is already painted. */
function grime(ctx, rng, amount = 0.25, base = 3) {
    const img = ctx.getImageData(0, 0, SIZE, SIZE);
    const d = img.data;
    const n = fbm(rng, base, 4);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const k = 1 + (n(x / SIZE, y / SIZE) - 0.5) * 2 * amount;
        const i = (y * SIZE + x) * 4;
        d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
    }
    ctx.putImageData(img, 0, 0);
}

/** Voronoi stones: each cell gets a tint; edges become mortar. Tileable. */
function stones(ctx, rng, count, palette, mortar, edge = 0.06, bevel = 0.35) {
    const pts = [];
    for (let i = 0; i < count; i++) pts.push([rng.next(), rng.next(), hex(rng.pick(palette)), rng.range(-14, 14)]);
    const img = ctx.getImageData(0, 0, SIZE, SIZE);
    const d = img.data;
    const M = hex(mortar);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const u = x / SIZE, v = y / SIZE;
        let d1 = 9, d2 = 9, best = null;
        for (const p of pts) {
            let dx = Math.abs(u - p[0]); dx = Math.min(dx, 1 - dx);
            let dy = Math.abs(v - p[1]); dy = Math.min(dy, 1 - dy);
            const dd = Math.sqrt(dx * dx + dy * dy);
            if (dd < d1) { d2 = d1; d1 = dd; best = p; } else if (dd < d2) d2 = dd;
        }
        const e = d2 - d1;
        const i = (y * SIZE + x) * 4;
        if (e < edge * 0.5) { d[i] = M[0]; d[i + 1] = M[1]; d[i + 2] = M[2]; continue; }
        const shade = 1 - Math.max(0, bevel * (1 - (e - edge * 0.5) / edge));
        const base = [d[i], d[i + 1], d[i + 2]];
        const c = mix(base, best[2], 0.6);
        d[i] = (c[0] + best[3]) * shade; d[i + 1] = (c[1] + best[3]) * shade; d[i + 2] = (c[2] + best[3]) * shade;
    }
    ctx.putImageData(img, 0, 0);
}

function bricks(ctx, rng, rows, cols, palette, mortar, mw = 3, jitter = 10) {
    const h = SIZE / rows, w = SIZE / cols;
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let r = 0; r < rows; r++) {
        const off = (r % 2) * w / 2;
        for (let c = -1; c <= cols; c++) {
            const x = c * w + off, y = r * h;
            const col = hex(rng.pick(palette));
            const j = rng.range(-jitter, jitter);
            ctx.fillStyle = css([col[0] + j, col[1] + j, col[2] + j]);
            ctx.fillRect(x + mw / 2, y + mw / 2, w - mw, h - mw);
            // Bevel: light top-left, dark bottom-right.
            ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + mw / 2, y + mw / 2, w - mw, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + mw / 2, y + h - mw / 2 - 2, w - mw, 2);
        }
    }
}

function speckle(ctx, rng, n, colors, r0 = 0.5, r1 = 1.6, alpha = 1) {
    for (let i = 0; i < n; i++) {
        ctx.fillStyle = css(hex(rng.pick(colors)), alpha);
        ctx.beginPath();
        ctx.arc(rng.next() * SIZE, rng.next() * SIZE, rng.range(r0, r1), 0, Math.PI * 2);
        ctx.fill();
    }
}

function cracks(ctx, rng, n, color, width = 1.2, len = 40) {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
        let x = rng.next() * SIZE, y = rng.next() * SIZE, a = rng.next() * Math.PI * 2;
        ctx.lineWidth = width * rng.range(0.6, 1.3);
        ctx.beginPath(); ctx.moveTo(x, y);
        const steps = rng.int(4, 9);
        for (let k = 0; k < steps; k++) { a += rng.range(-0.8, 0.8); x += Math.cos(a) * len / steps; y += Math.sin(a) * len / steps; ctx.lineTo(x, y); }
        ctx.stroke();
    }
}

function strata(ctx, rng, colors, bands = 7) {
    let y = 0;
    while (y < SIZE) {
        const h = rng.range(SIZE / bands * 0.5, SIZE / bands * 1.5);
        ctx.fillStyle = css(hex(rng.pick(colors)), 0.55);
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= SIZE; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 3);
        for (let x = SIZE; x >= 0; x -= 16) ctx.lineTo(x, y + h + Math.sin(x * 0.04 + y) * 3);
        ctx.fill();
        y += h;
    }
}

// ------------------------------------------------------------------ Styles

const PAINT = {
    // ---- floors
    dirt(ctx, r) { noiseFill(ctx, r, 0x3a2a1c, 0x6a5038, 4, 5, 1.4); speckle(ctx, r, 220, [0x7a6a58, 0x2a2018, 0x8a7a60], 0.6, 2.4); cracks(ctx, r, 6, 'rgba(40,28,16,0.6)', 1.5, 50); },
    mud(ctx, r) { noiseFill(ctx, r, 0x1c2a22, 0x3a4a34, 3, 5, 1.6); speckle(ctx, r, 80, [0x4a6a40, 0x2a4030], 1, 3, 0.6); grime(ctx, r, 0.25); speckle(ctx, r, 40, [0x6affd0], 0.4, 1.1, 0.5); },
    tiles(ctx, r) {
        noiseFill(ctx, r, 0x34405a, 0x4a5876, 4, 3, 0.8);
        const n = 2, s = SIZE / n;
        ctx.strokeStyle = 'rgba(12,16,30,0.9)'; ctx.lineWidth = 4;
        for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, SIZE); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(SIZE, i * s); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(180,170,120,0.25)'; ctx.lineWidth = 2;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.strokeRect(i * s + 14, j * s + 14, s - 28, s - 28); }
        cracks(ctx, r, 5, 'rgba(10,12,24,0.7)', 1, 60); grime(ctx, r, 0.3);
    },
    basalt(ctx, r) { noiseFill(ctx, r, 0x1a1414, 0x2e2622, 4, 4, 1); stones(ctx, r, 9, [0x2a2220, 0x342a26, 0x221a18], 0x5a1a08, 0.05, 0.4); cracks(ctx, r, 10, 'rgba(255,90,20,0.55)', 1.2, 36); },
    crystalfloor(ctx, r) { noiseFill(ctx, r, 0x2a2240, 0x40345e, 3, 5, 1.2); stones(ctx, r, 14, [0x3a2e5a, 0x4a3a6e, 0x30284a], 0x16102a, 0.04, 0.3); speckle(ctx, r, 70, [0xd0b0ff, 0xffffff, 0x9a80ff], 0.4, 1.4, 0.8); },
    flagstone(ctx, r) { noiseFill(ctx, r, 0x4a4844, 0x6a6660, 4, 4, 1); stones(ctx, r, 10, [0x5a5650, 0x66625a, 0x4e4a46, 0x726c62], 0x1e1c1a, 0.06, 0.45); grime(ctx, r, 0.35); },
    brassplate(ctx, r) {
        noiseFill(ctx, r, 0x6a5428, 0x8a7038, 6, 3, 0.6);
        const s = SIZE / 2;
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
            ctx.strokeStyle = 'rgba(30,22,8,0.9)'; ctx.lineWidth = 4; ctx.strokeRect(i * s + 2, j * s + 2, s - 4, s - 4);
            ctx.fillStyle = 'rgba(255,230,160,0.08)'; ctx.fillRect(i * s + 6, j * s + 6, s - 12, 4);
            for (const [a, b] of [[10, 10], [s - 10, 10], [10, s - 10], [s - 10, s - 10]]) { ctx.fillStyle = '#c8a860'; ctx.beginPath(); ctx.arc(i * s + a, j * s + b, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#3a2a10'; ctx.beginPath(); ctx.arc(i * s + a + 1, j * s + b + 1, 2, 0, 7); ctx.fill(); }
        }
        cracks(ctx, r, 18, 'rgba(255,240,200,0.12)', 0.6, 30); grime(ctx, r, 0.25);
    },
    ice(ctx, r) { noiseFill(ctx, r, 0x6a90b0, 0xa8d0ea, 3, 5, 1.1); cracks(ctx, r, 16, 'rgba(255,255,255,0.55)', 1, 60); cracks(ctx, r, 10, 'rgba(30,60,90,0.4)', 1.4, 40); speckle(ctx, r, 120, [0xffffff], 0.3, 1, 0.6); },
    starstone(ctx, r) { noiseFill(ctx, r, 0x120e22, 0x241c3a, 4, 5, 1.2); stones(ctx, r, 8, [0x1a1430, 0x221a3a], 0x06040e, 0.04, 0.3); speckle(ctx, r, 160, [0xffffff, 0xb0a0ff, 0xffd0a0], 0.3, 1.1); },
    obsidian(ctx, r) { noiseFill(ctx, r, 0x08060c, 0x1a1424, 3, 5, 1.4); stones(ctx, r, 7, [0x0e0a14, 0x16101e], 0x2a1a40, 0.03, 0.2); cracks(ctx, r, 6, 'rgba(160,100,255,0.35)', 1, 50); },
    // ---- walls
    earth(ctx, r) { noiseFill(ctx, r, 0x3a2a1a, 0x5a4228, 3, 5, 1.2); strata(ctx, r, [0x4a3420, 0x2e2014, 0x5a4630, 0x3a2a1c]); speckle(ctx, r, 90, [0x8a7a6a, 0x5a5048], 1, 4); cracks(ctx, r, 9, 'rgba(120,90,50,0.8)', 2.2, 70); },
    cave(ctx, r) { noiseFill(ctx, r, 0x1a2a2a, 0x34484a, 3, 6, 1.6); grime(ctx, r, 0.4, 2); speckle(ctx, r, 60, [0x5affc0, 0x3aa080], 0.6, 2, 0.6); },
    shelves(ctx, r) {
        ctx.fillStyle = '#2a1a10'; ctx.fillRect(0, 0, SIZE, SIZE);
        const rows = 4, h = SIZE / rows;
        const spines = [0x6a2a2a, 0x2a4a6a, 0x3a5a2a, 0x6a5a2a, 0x4a2a5a, 0x7a6a50, 0x2a2a2a, 0x8a3a20];
        for (let k = 0; k < rows; k++) {
            let x = 6;
            while (x < SIZE - 8) {
                const w = r.int(6, 14), bh = r.int(h * 0.55, h * 0.82);
                const c = hex(r.pick(spines));
                ctx.fillStyle = css(c); ctx.fillRect(x, k * h + h - 8 - bh, w, bh);
                ctx.fillStyle = 'rgba(255,220,150,0.25)'; ctx.fillRect(x + 1, k * h + h - 8 - bh + 6, w - 2, 2);
                ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + w - 2, k * h + h - 8 - bh, 2, bh);
                x += w + r.int(0, 2);
            }
            ctx.fillStyle = '#4a3020'; ctx.fillRect(0, k * h + h - 8, SIZE, 8);
            ctx.fillStyle = 'rgba(255,200,130,0.15)'; ctx.fillRect(0, k * h + h - 8, SIZE, 2);
        }
        ctx.fillStyle = '#3a2416'; ctx.fillRect(0, 0, 6, SIZE); ctx.fillRect(SIZE - 6, 0, 6, SIZE);
        grime(ctx, r, 0.3);
    },
    forgebrick(ctx, r) { bricks(ctx, r, 8, 4, ['#2a1e1a', '#34261e', '#221816', '#3a2a22'], '#6a1a04', 5, 8); grime(ctx, r, 0.35); cracks(ctx, r, 5, 'rgba(255,120,40,0.4)', 1, 30); },
    crystal(ctx, r) {
        noiseFill(ctx, r, 0x241c3a, 0x3e3060, 3, 5, 1.4);
        for (let i = 0; i < 18; i++) {
            const x = r.next() * SIZE, y = r.next() * SIZE, s = r.range(8, 26), a = r.next() * Math.PI;
            const c = hex(r.pick([0xb080ff, 0xd0b0ff, 0x8a60ff, 0xff90e0]));
            ctx.fillStyle = css(c, 0.75);
            ctx.beginPath();
            for (let k = 0; k < 6; k++) { const t = a + k * Math.PI / 3; ctx.lineTo(x + Math.cos(t) * s * (k % 2 ? 0.45 : 1), y + Math.sin(t) * s * (k % 2 ? 0.45 : 1)); }
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
        }
    },
    skullwall(ctx, r) {
        bricks(ctx, r, 6, 3, ['#5a564e', '#4e4a44', '#625e56'], '#1a1816', 4, 10);
        for (let i = 0; i < 5; i++) {
            const x = r.int(20, SIZE - 20), y = r.int(20, SIZE - 20);
            ctx.fillStyle = '#100e0c'; ctx.beginPath(); ctx.ellipse(x, y, 13, 11, 0, 0, 7); ctx.fill();
            ctx.fillStyle = '#d8d0b8'; ctx.beginPath(); ctx.arc(x, y - 1, 7, 0, 7); ctx.fill(); ctx.fillRect(x - 4, y + 3, 8, 5);
            ctx.fillStyle = '#100e0c'; ctx.beginPath(); ctx.arc(x - 3, y - 1, 1.8, 0, 7); ctx.arc(x + 3, y - 1, 1.8, 0, 7); ctx.fill();
        }
        grime(ctx, r, 0.35);
    },
    brass(ctx, r) {
        noiseFill(ctx, r, 0x5a4420, 0x7a6030, 6, 3, 0.7);
        for (let k = 0; k < 3; k++) {
            const y = r.int(20, SIZE - 20);
            ctx.fillStyle = '#3a2a10'; ctx.fillRect(0, y - 9, SIZE, 18);
            ctx.fillStyle = '#b08a40'; ctx.fillRect(0, y - 7, SIZE, 14);
            ctx.fillStyle = 'rgba(255,240,200,0.4)'; ctx.fillRect(0, y - 6, SIZE, 3);
        }
        for (let i = 0; i < 40; i++) { ctx.fillStyle = '#d0b070'; ctx.beginPath(); ctx.arc(r.next() * SIZE, r.next() * SIZE, 2.4, 0, 7); ctx.fill(); }
        grime(ctx, r, 0.3);
    },
    iceWall(ctx, r) { noiseFill(ctx, r, 0x5a80a8, 0xc0e0f6, 2, 6, 1.4); strata(ctx, r, [0xe0f4ff, 0x80a8d0, 0xa0c8e8], 9); cracks(ctx, r, 12, 'rgba(255,255,255,0.6)', 1, 60); },
    voidrock(ctx, r) { noiseFill(ctx, r, 0x0e0a1a, 0x2a2040, 3, 6, 1.6); speckle(ctx, r, 140, [0xffffff, 0xc0b0ff], 0.3, 1); cracks(ctx, r, 8, 'rgba(170,120,255,0.5)', 1.2, 50); },
    obsidianWall(ctx, r) { bricks(ctx, r, 5, 2, ['#0c0a10', '#120e18', '#08060c'], '#3a2460', 3, 4); grime(ctx, r, 0.4); cracks(ctx, r, 4, 'rgba(200,150,255,0.3)', 1, 40); },
    // ---- props
    wood(ctx, r) {
        noiseFill(ctx, r, 0x4a2e18, 0x6a4424, 2, 4, 1);
        ctx.strokeStyle = 'rgba(30,16,6,0.5)';
        for (let i = 0; i < 40; i++) { ctx.lineWidth = r.range(0.5, 2); const y = r.next() * SIZE; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(SIZE / 3, y + r.range(-6, 6), SIZE * 2 / 3, y + r.range(-6, 6), SIZE, y); ctx.stroke(); }
        ctx.fillStyle = 'rgba(20,10,4,0.8)'; for (let i = 1; i < 4; i++) ctx.fillRect(0, i * SIZE / 4 - 2, SIZE, 4);
    },
    metal(ctx, r) { noiseFill(ctx, r, 0x3a3a40, 0x6a6a74, 6, 4, 0.8); cracks(ctx, r, 30, 'rgba(255,255,255,0.1)', 0.6, 40); grime(ctx, r, 0.3); },
};

/** { map, bump } for a style. */
export function surface(style) {
    if (cache.has(style)) return cache.get(style);
    const paint = PAINT[style] || PAINT.flagstone;
    const c = canvas();
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const rng = makeRng(Object.keys(PAINT).indexOf(style) * 7919 + 101);
    paint(ctx, rng);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    // Bump: luminance, slightly blurred.
    const b = canvas();
    const bctx = b.getContext('2d', { willReadFrequently: true });
    bctx.filter = 'blur(1px) grayscale(1)';
    bctx.drawImage(c, 0, 0);
    const bump = new THREE.CanvasTexture(b);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    const out = { map, bump };
    cache.set(style, out);
    return out;
}

/** A soft radial sprite (glows, particles). */
let glowTex = null;
export function glowTexture() {
    if (glowTex) return glowTex;
    const c = canvas(64);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
    return glowTex;
}
