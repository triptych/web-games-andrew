// The painted world: a continent grown around the towns and roads, its ground painted per pixel from
// biome colours and noise, then roads, rivers, shores and dry-brush strokes laid over it. Deterministic.

import { TOWNS, TOWN, ROADS, REGIONS } from '../sim/data/towns.js';
import { BIOME } from './props.js';
import { hex, mix, lighten, darken, alpha, canvas, ctx2, rnd } from './paint.js';
import { hash3 } from '../rng.js';

export const EXT = { x0: -8, z0: -8, w: 116, h: 88 };           // world rectangle the terrain covers
export const PPU = 12;                                         // texture pixels per world unit

// ------------------------------------------------------------ noise
const sm = (t) => t * t * (3 - 2 * t);
export function vnoise(x, z, seed = 0) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = sm(x - xi), zf = sm(z - zi);
    const a = hash3(xi, zi, seed), b = hash3(xi + 1, zi, seed), c = hash3(xi, zi + 1, seed), d = hash3(xi + 1, zi + 1, seed);
    return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}
export function fbm(x, z, seed = 0, oct = 4) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f, seed + i * 7) * a; a *= 0.5; f *= 2; }
    return s;
}

// ------------------------------------------------------------ roads
export function roadCtrl(r) {
    const A = TOWN[r.a], B = TOWN[r.b];
    const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
    const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz) || 1;
    const off = (hash3(A.x * 7, B.z * 5, 3) - 0.5) * 0.3 * L;
    return { ax: A.x, az: A.z, cx: mx - (dz / L) * off, cz: mz + (dx / L) * off, bx: B.x, bz: B.z };
}
/** A point on the road from `from` to `to` at fraction t (0..1). */
export function roadPoint(from, to, t) {
    const r = ROADS.find((q) => (q.a === from && q.b === to) || (q.a === to && q.b === from));
    if (!r) { const A = TOWN[from], B = TOWN[to]; return { x: A.x + (B.x - A.x) * t, z: A.z + (B.z - A.z) * t }; }
    const k = roadCtrl(r);
    const u = r.a === from ? t : 1 - t;
    const v = 1 - u;
    return { x: v * v * k.ax + 2 * v * u * k.cx + u * u * k.bx, z: v * v * k.az + 2 * v * u * k.cz + u * u * k.bz, r };
}
const roadSamples = [];
for (const r of ROADS) for (let i = 0; i <= 24; i++) { const p = roadPoint(r.a, r.b, i / 24); roadSamples.push([p.x, p.z]); }

// ------------------------------------------------------------ land
/** 0..1, >0.5 is land. Grown from blobs at every town and along every road, then roughened by noise. */
export function landField(x, z) {
    let v = 0;
    for (const t of TOWNS) { const d = Math.hypot(x - t.x, z - t.z); v = Math.max(v, Math.exp(-(d * d) / (2 * 15 * 15))); }
    for (let i = 0; i < roadSamples.length; i += 2) { const d = Math.hypot(x - roadSamples[i][0], z - roadSamples[i][1]); v = Math.max(v, 0.92 * Math.exp(-(d * d) / (2 * 8.5 * 8.5))); }
    // northern and eastern mainland is joined up by a broad plain
    v += (fbm(x * 0.07, z * 0.07, 11) - 0.5) * 0.5;
    return v;
}
export const SHORE = 0.46;
export const isLand = (x, z) => landField(x, z) > SHORE;
/** Terrain height: gentle hills inland, mountains in the north and the western hills, a basin for the sea. */
export function heightAt(x, z) {
    const lf = landField(x, z);
    const coast = Math.max(0, Math.min(1, (lf - SHORE) / 0.2));
    let h = -1.2 + coast * 1.5;
    if (coast > 0) {
        h += (fbm(x * 0.09, z * 0.09, 5) - 0.5) * 2.2 * coast;
        // flatten near towns so buildings sit level
        let near = 0;
        for (const t of TOWNS) near = Math.max(near, Math.exp(-((x - t.x) ** 2 + (z - t.z) ** 2) / 14));
        h = h * (1 - near * 0.85) + 0.5 * near * 0.85;
        // ridges: the Frostmark in the north, the foothills west of Stonebridge
        h += Math.max(0, 1 - Math.hypot(x - 40, z - 4) / 16) * 2.4 * coast;
        h += Math.max(0, 1 - Math.hypot(x - 28, z - 36) / 10) * 1.3 * coast;
    }
    return h;
}

// ------------------------------------------------------------ colour of the ground
const GROUND = {};
for (const t of TOWNS) GROUND[t.id] = [hex(BIOME[t.biome].ground), hex(BIOME[t.biome].ground2)];
function groundColor(x, z, n1, n2) {
    // weights by inverse square distance to each town, so biomes melt into each other
    let wsum = 0, r = 0, g = 0, b = 0;
    for (const t of TOWNS) {
        const d2 = (x - t.x) ** 2 + (z - t.z) ** 2 + 6;
        const w = 1 / (d2 * d2);
        const G = GROUND[t.id];
        const k = n1;
        r += w * (G[0][0] * (1 - k) + G[1][0] * k); g += w * (G[0][1] * (1 - k) + G[1][1] * k); b += w * (G[0][2] * (1 - k) + G[1][2] * k);
        wsum += w;
    }
    return [r / wsum, g / wsum, b / wsum];
}
function nearRoad(x, z) {
    let best = 99;
    for (let i = 0; i < roadSamples.length; i++) { const d = Math.hypot(x - roadSamples[i][0], z - roadSamples[i][1]); if (d < best) best = d; }
    return best;
}

/** Paint the whole continent to a canvas. Heavy (a second or so), done once. */
export function paintWorld() {
    const W = Math.round(EXT.w * PPU), H = Math.round(EXT.h * PPU);
    const cv = canvas(W, H), c = ctx2(cv);
    const img = c.createImageData(W, H);
    const d = img.data;
    const sea = [[0.32, 0.62, 0.80], [0.18, 0.44, 0.66]];
    // pass 1: land and sea per pixel, at reduced resolution for the expensive fields then bilinearly reused
    const STEP = 4;
    const gw = Math.ceil(W / STEP) + 1, gh = Math.ceil(H / STEP) + 1;
    const lfg = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) lfg[j * gw + i] = landField(EXT.x0 + (i * STEP) / PPU, EXT.z0 + (j * STEP) / PPU);
    const lfAt = (px, py) => {
        const fx = px / STEP, fy = py / STEP, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
        const a = lfg[iy * gw + ix], b = lfg[iy * gw + Math.min(gw - 1, ix + 1)], e = lfg[Math.min(gh - 1, iy + 1) * gw + ix], f = lfg[Math.min(gh - 1, iy + 1) * gw + Math.min(gw - 1, ix + 1)];
        return a + (b - a) * tx + (e - a) * ty + (a - b - e + f) * tx * ty;
    };
    for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
            const x = EXT.x0 + px / PPU, z = EXT.z0 + py / PPU;
            const lf = lfAt(px, py);
            const n1 = fbm(x * 0.35, z * 0.35, 21, 3), n2 = fbm(x * 1.7, z * 1.7, 23, 2);
            let col;
            if (lf > SHORE) {
                col = groundColor(x, z, n1, n2);
                const shade = 0.9 + (n2 - 0.5) * 0.3 + (n1 - 0.5) * 0.18;
                col = [col[0] * shade, col[1] * shade, col[2] * shade];
                // beach
                const beach = Math.max(0, 1 - (lf - SHORE) / 0.045);
                if (beach > 0) { col = [col[0] + (232 - col[0]) * beach * 0.8, col[1] + (214 - col[1]) * beach * 0.8, col[2] + (160 - col[2]) * beach * 0.8]; }
            } else {
                const depth = Math.min(1, (SHORE - lf) / 0.3);
                const sh = Math.max(0, 1 - (SHORE - lf) / 0.07);
                const base = [sea[0][0] + (sea[1][0] - sea[0][0]) * depth, sea[0][1] + (sea[1][1] - sea[0][1]) * depth, sea[0][2] + (sea[1][2] - sea[0][2]) * depth].map((v) => v * 255);
                const wave = (n2 - 0.5) * 24;
                col = [base[0] + wave * 0.5 + sh * 70, base[1] + wave + sh * 70, base[2] + wave + sh * 40];
            }
            const o = (py * W + px) * 4;
            d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
    }
    c.putImageData(img, 0, 0);
    const X = (x) => (x - EXT.x0) * PPU, Z = (z) => (z - EXT.z0) * PPU;
    // pass 2: dry-brush strokes sampled from the pixels below, so every region keeps its own colour
    const r = rnd(99);
    c.lineCap = 'round';
    for (let i = 0; i < 26000; i++) {
        const px = r() * W, py = r() * H;
        const o4 = (Math.floor(py) * W + Math.floor(px)) * 4;
        const p = [d[o4], d[o4 + 1], d[o4 + 2]];
        const len = 6 + r() * 22, ang = -0.8 + (r() - 0.5) * 0.9, k = r();
        c.strokeStyle = k < 0.55 ? `rgba(${Math.min(255, p[0] + 26)},${Math.min(255, p[1] + 26)},${Math.min(255, p[2] + 20)},${0.1 + r() * 0.1})` : `rgba(${p[0] * 0.8},${p[1] * 0.8},${p[2] * 0.86},${0.08 + r() * 0.08})`;
        c.lineWidth = 2 + r() * 5;
        c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len); c.stroke();
    }
    // pass 3: roads, a pale ribbon with darker edges, drawn as smooth beziers
    for (const [lw, col] of [[26, 'rgba(90,60,30,0.22)'], [18, '#d8bc86'], [13, '#e8d0a0'], [3, 'rgba(255,240,200,0.5)']]) {
        c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
        for (const rd of ROADS) { const k = roadCtrl(rd); c.beginPath(); c.moveTo(X(k.ax), Z(k.az)); c.quadraticCurveTo(X(k.cx), Z(k.cz), X(k.bx), Z(k.bz)); c.stroke(); }
    }
    // cobbles / dirt plazas under each town
    for (const t of TOWNS) {
        const g = c.createRadialGradient(X(t.x), Z(t.z), 0, X(t.x), Z(t.z), 4.4 * PPU);
        g.addColorStop(0, 'rgba(226,206,160,0.95)'); g.addColorStop(0.65, 'rgba(216,190,140,0.6)'); g.addColorStop(1, 'rgba(216,190,140,0)');
        c.fillStyle = g; c.beginPath(); c.arc(X(t.x), Z(t.z), 4.4 * PPU, 0, 7); c.fill();
    }
    // a river from the Frostmark down toward the sea at Saltmarsh
    const river = [[40, 12], [44, 22], [38, 32], [46, 42], [54, 52], [60, 64], [62, 72]];
    for (const [lw, col] of [[16, 'rgba(60,110,150,0.45)'], [10, '#5ea8d0'], [4, 'rgba(210,240,255,0.55)']]) {
        c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
        river.forEach(([x, z], i) => { const px = X(x + (fbm(x, z, 3) - 0.5) * 3), pz = Z(z); i ? c.lineTo(px, pz) : c.moveTo(px, pz); });
        c.stroke();
    }
    return cv;
}

/** Trees, bushes, rocks, flowers and mountains: where they go, by biome. */
export function scatter() {
    const out = [];
    const r = rnd(4242);
    const clear = (x, z, rad) => TOWNS.every((t) => Math.hypot(x - t.x, z - t.z) > rad) && nearRoad(x, z) > 1.9;
    // forests near forest/elven/snow/hills towns, orchards near meadows; sparse elsewhere
    for (let i = 0; i < 2600; i++) {
        const x = EXT.x0 + 6 + r() * (EXT.w - 12), z = EXT.z0 + 6 + r() * (EXT.h - 12);
        if (landField(x, z) < SHORE + 0.08 || !clear(x, z, 8.2)) continue;
        let near = null, nd = 1e9;
        for (const t of TOWNS) { const d = Math.hypot(x - t.x, z - t.z); if (d < nd) { nd = d; near = t; } }
        const dens = fbm(x * 0.12, z * 0.12, 33);
        const biome = near.biome;
        const forestish = ['forest', 'elven', 'snow', 'hills', 'meadow', 'river', 'hub', 'royal'].includes(biome);
        const p = (forestish ? 0.42 : 0.18) * (dens > 0.52 ? 1.0 : 0.12);
        if (r() > p || out.filter((o) => o.kind === 'tree').length > 300) continue;
        let type = BIOME[biome].tree;
        if (biome === 'snow' || z < 14) type = 'snowpine';
        if (biome === 'meadow' && r() < 0.35) type = 'pine';
        if (biome === 'elven' && r() < 0.5) type = 'elf';
        out.push({ kind: 'tree', type, x, z, s: 0.8 + r() * 0.55, seed: Math.floor(r() * 5) });
    }
    for (let i = 0; i < 700; i++) {
        const x = EXT.x0 + 4 + r() * (EXT.w - 8), z = EXT.z0 + 4 + r() * (EXT.h - 8);
        if (landField(x, z) < SHORE + 0.07 || !clear(x, z, 5.4)) continue;
        const k = r();
        if (out.filter((o) => o.kind !== 'tree').length > 300) break;
        out.push({ kind: k < 0.45 ? 'bush' : k < 0.75 ? 'rock' : 'tuft', x, z, s: 0.6 + r() * 0.5, seed: Math.floor(r() * 5), flower: r() < 0.4 });
    }
    // mountain ranges: the Frostmark, the east, the foothills
    const ranges = [[[18, 6, 8], [26, 3, 9], [34, 1, 8], [48, 2, 9], [54, 4, 7]], [[96, 22, 7], [99, 30, 9], [98, 40, 8], [100, 8, 7]], [[20, 34, 6], [18, 42, 7], [22, 30, 6]], [[74, 2, 8], [82, 0, 9], [92, 1, 8]]];
    ranges.flat().forEach(([x, z, s], i) => { if (landField(x, z) > SHORE - 0.1 && clear(x, z, 5)) out.push({ kind: 'mountain', x, z, s, seed: i, snow: z < 22 || i % 2 === 0 }); });
    return out;
}
