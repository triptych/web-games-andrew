// The countryside beside the road: what grows and stands where, and how each thing is drawn.
//
// scatter(biome, k) says what stands on road segment k, from the integer hash alone, so the same stretch of
// road always has the same trees and nothing is stored. Things come in three bands:
//   verge — grass, flowers, pebbles and the like at the road's edge,
//   middle — trees, rocks, logs and animals, thick in groves and thin in clearings (low-frequency noise),
//   far — tree lines, outcrops and the odd landmark out towards the horizon.
// Every tree, rock and cactus takes its size, shape, lean and colour from its own hash, so no two match.
// Birds are separate: flocks that cross the sky now and then.

import { hash3 } from '../rng.js';
import { shade, mix, shadow } from './sprites.js';
import { drawProp } from './sprites.js';

const TAU = Math.PI * 2;
const ROADW = 1100;
const r = (k, i, salt) => hash3(k, i, salt);          // [0, 1)

function noise1(x, salt) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    const a = hash3(i, salt, 91), b = hash3(i + 1, salt, 91);
    return a + (b - a) * u;
}

function ell(ctx, x, y, rx, ry, fill, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
}

// ------------------------------------------------------------------ what grows where
// weights for the middle band; small things for the verge; big things for the far band
const FLORA = {
    meadow: {
        mid: [['oak', 10], ['birch', 4], ['poplar', 3], ['blossom', 2], ['autumn', 2], ['bush', 5], ['rock', 3], ['boulders', 1.5], ['log', 1.5], ['stump', 1.5], ['haystack', 1], ['sheep', 1.6], ['deer', 0.5], ['fence', 1]],
        verge: [['tuft', 6], ['flowers', 4], ['pebbles', 2], ['smallrock', 1.5], ['toadstool', 0.6]],
        far: [['treeline', 6], ['oak', 4], ['poplar', 2], ['windmill', 0.35], ['boulders', 1], ['sheep', 0.6]],
        grove: 0.55, density: 1,
    },
    desert: {
        mid: [['saguaro', 5], ['barrel', 3], ['pear', 3], ['rock', 5], ['mesa', 1.2], ['boulders', 3], ['deadbush', 3], ['bones', 0.8], ['dune', 3], ['palm', 0.8]],
        verge: [['pebbles', 5], ['drytuft', 5], ['smallrock', 2]],
        far: [['mesa', 4], ['dune', 4], ['saguaro', 2], ['boulders', 2]],
        grove: 0.25, density: 0.75,
    },
    mire: {
        mid: [['willow', 6], ['swamptree', 5], ['deadtree', 2], ['giantshroom', 2], ['mossrock', 3], ['log', 2], ['reeds', 4], ['pool', 2.5], ['deer', 0.4]],
        verge: [['reeds', 5], ['tuft', 4], ['toadstool', 2], ['lily', 1.5]],
        far: [['treeline', 6], ['willow', 3], ['swamptree', 3]],
        grove: 0.7, density: 1.1,
    },
    frost: {
        mid: [['pine', 12], ['snowpine', 6], ['rock', 3], ['boulders', 2], ['deadpine', 1.5], ['log', 1], ['icespire', 1]],
        verge: [['snowtuft', 5], ['pebbles', 2], ['iceshards', 1.5]],
        far: [['pineline', 8], ['boulders', 2], ['icespire', 1]],
        grove: 0.65, density: 1.1,
    },
    ember: {
        mid: [['deadtree', 6], ['lavarock', 4], ['obsidian', 3], ['vent', 2], ['rock', 3], ['boulders', 2], ['ashtree', 2]],
        verge: [['ashtuft', 4], ['pebbles', 3], ['ember', 2]],
        far: [['obsidian', 4], ['deadtree', 3], ['boulders', 2]],
        grove: 0.3, density: 0.8,
    },
    star: {
        mid: [['crystal', 6], ['obelisk', 2], ['startree', 5], ['floatrock', 2], ['rock', 3], ['glowshroom', 2]],
        verge: [['glowtuft', 5], ['pebbles', 2], ['shard', 2]],
        far: [['crystal', 4], ['startree', 3], ['floatrock', 2]],
        grove: 0.45, density: 0.9,
    },
};

function pickW(list, u) {
    let t = 0;
    for (const [, w] of list) t += w;
    let x = u * t;
    for (const [k, w] of list) { x -= w; if (x <= 0) return k; }
    return list[list.length - 1][0];
}

/** What stands on segment k: [{ kind, side, dist, dz, v, band }]. dist is from the road's centre line. */
export function scatter(biome, k) {
    const F = FLORA[biome] || FLORA.meadow;
    const out = [];
    for (const side of [-1, 1]) {
        const sd = side > 0 ? 1 : 2;
        // groves and clearings: a slow noise along the road, different on each side
        const grove = noise1(k / 23 + sd * 57, 3 + sd);
        const thick = Math.max(0, (grove - (1 - F.grove)) / F.grove);      // 0 in a clearing, up to 1 deep in a grove
        // verge: small things at the road's edge
        for (let i = 0; i < 2; i++) {
            if (r(k, 10 + i * 2 + sd, 5) < 0.55 * F.density) {
                out.push({ kind: pickW(F.verge, r(k, 30 + i + sd * 3, 5)), side, dist: ROADW * 1.16 + r(k, 40 + i + sd * 3, 5) * 650, dz: r(k, 50 + i + sd * 3, 5) * 200, v: (r(k, 60 + i + sd * 3, 5) * 65536) | 0, band: 0 });
            }
        }
        // middle: denser in groves
        const nMid = (r(k, 70 + sd, 5) < (0.18 + 0.75 * thick) * F.density ? 1 : 0) + (thick > 0.5 && r(k, 72 + sd, 5) < thick - 0.3 ? 1 : 0);
        for (let i = 0; i < nMid; i++) {
            let kind = pickW(F.mid, r(k, 80 + i + sd * 3, 5));
            out.push({ kind, side, dist: ROADW + 650 + r(k, 90 + i + sd * 3, 5) * (thick > 0.3 ? 3200 : 5200), dz: r(k, 100 + i + sd * 3, 5) * 200, v: (r(k, 110 + i + sd * 3, 5) * 65536) | 0, band: 1 });
        }
        // far: every few segments, something out towards the horizon
        if (r(k, 120 + sd, 5) < 0.32 * F.density) {
            out.push({ kind: pickW(F.far, r(k, 130 + sd, 5)), side, dist: 5500 + r(k, 140 + sd, 5) * 9000, dz: r(k, 150 + sd, 5) * 200, v: (r(k, 160 + sd, 5) * 65536) | 0, band: 2 });
        }
    }
    // wide things (mesas, dunes, tree lines) are pushed back until their near edge clears the road
    for (const it of out) it.dist = Math.max(it.dist, ROADW * 1.15 + sizeOf(it.kind) / 2);
    return out;
}

/** How wide a thing is, in world units: to keep fights' verges clear and skip what's too small to see. */
export const sizeOf = (kind) => ({ tuft: 120, flowers: 160, pebbles: 140, smallrock: 160, toadstool: 120, drytuft: 140, lily: 200, snowtuft: 120, iceshards: 160, ashtuft: 120, ember: 120, glowtuft: 140, shard: 120, treeline: 2600, pineline: 2600, windmill: 900, mesa: 2600, dune: 1400 }[kind] || 700);

// ------------------------------------------------------------------ drawing
const LEAF = {
    oak: ['#3f8a3a', '#4c9a40', '#357a34', '#5aa04a', '#467f2e'],
    birch: ['#8ac860', '#9ad470', '#7ab850'],
    poplar: ['#3a7a3a', '#2f6a34', '#4a8a40'],
    blossom: ['#f4b8c8', '#f8d0dc', '#ffffff', '#e8a0b8'],
    autumn: ['#e08a2a', '#d0602a', '#e8b030', '#b8442a'],
    swamp: ['#4a7a50', '#3e6a46', '#5a8a5a'],
    star: ['#6a5ab0', '#8a6ad0', '#4a3a90'],
    ash: ['#5a4a48', '#4a3a3a'],
};

/** A broadleaf tree: species picks the leaves and shape, v makes it this tree and no other. */
function broadleaf(ctx, x, y, s, v, night, species) {
    const h = 0.75 + r(v, 1, 9) * 0.7, w = 0.8 + r(v, 2, 9) * 0.55, lean = (r(v, 3, 9) - 0.5) * 0.25;
    const dim = night ? -0.5 : 0;
    const pal = LEAF[species] || LEAF.oak;
    const leaf = pal[Math.floor(r(v, 4, 9) * pal.length)];
    const tilt = (yy) => x + lean * (y - yy);
    shadow(ctx, x, y, 750 * w, s);
    const trunkH = (species === 'poplar' ? 300 : 380) * h;
    const bark = species === 'birch' ? '#e8e4d8' : species === 'star' ? '#2a2440' : '#6a4a30';
    ctx.strokeStyle = shade(bark, dim); ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, (species === 'birch' ? 34 : 70) * s * w);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tilt(y - trunkH * s), y - trunkH * s); ctx.stroke();
    if (species === 'birch') {
        ctx.fillStyle = shade('#2a2a2a', dim);
        for (let i = 0; i < 4; i++) ctx.fillRect(x - 14 * s * w + lean * (i * 80 * s), y - (60 + i * 80) * s * h, 20 * s * w, 8 * s);
    }
    // a couple of branches into the crown
    ctx.lineWidth = Math.max(1, 26 * s * w);
    for (let b = 0; b < 2; b++) {
        const by = y - trunkH * s * (0.6 + b * 0.25), dir = b ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(tilt(by), by); ctx.lineTo(tilt(by) + dir * 140 * s * w, by - 150 * s * h); ctx.stroke();
    }
    const cx = tilt(y - trunkH * s - 160 * s * h), cy = y - trunkH * s - 170 * s * h;
    if (species === 'poplar') {
        ell(ctx, cx, cy - 140 * s * h, 170 * s * w, 420 * s * h, shade(leaf, dim - 0.1));
        ell(ctx, cx - 40 * s * w, cy - 200 * s * h, 110 * s * w, 300 * s * h, shade(leaf, dim + 0.08));
        return;
    }
    // a crown of blobs placed by the tree's own hash, dark underneath and lit on top
    const n = 4 + Math.floor(r(v, 5, 9) * 3);
    const blobs = [];
    for (let i = 0; i < n; i++) {
        const a = r(v, 10 + i, 9) * TAU, d = r(v, 20 + i, 9);
        blobs.push({ x: Math.cos(a) * d * 210 * w, y: Math.sin(a) * d * 150 * h - 40 * h, rx: (150 + r(v, 30 + i, 9) * 120) * w, ry: (130 + r(v, 40 + i, 9) * 90) * h });
    }
    for (const b of blobs) ell(ctx, cx + b.x * s, cy + b.y * s + 30 * s, b.rx * s, b.ry * s, shade(leaf, dim - 0.22));
    for (const b of blobs) ell(ctx, cx + b.x * s, cy + b.y * s, b.rx * s * 0.92, b.ry * s * 0.9, shade(leaf, dim));
    for (const b of blobs.slice(0, 3)) ell(ctx, cx + b.x * s - 30 * s, cy + b.y * s - 40 * s, b.rx * s * 0.5, b.ry * s * 0.45, shade(leaf, dim + 0.14));
    if (species === 'blossom' || (species === 'oak' && r(v, 6, 9) < 0.25)) {
        // blossom, or apples
        const dot = species === 'blossom' ? '#ffffff' : '#d8342a';
        for (let i = 0; i < 9; i++) ell(ctx, cx + (r(v, 50 + i, 9) - 0.5) * 420 * s * w, cy + (r(v, 60 + i, 9) - 0.6) * 300 * s * h, 16 * s, 16 * s, night ? shade(dot, -0.5) : dot);
    }
}

function pine(ctx, x, y, s, v, night, snow) {
    const h = 0.7 + r(v, 1, 8) * 0.8, w = 0.7 + r(v, 2, 8) * 0.5, tiers = 3 + Math.floor(r(v, 3, 8) * 3);
    const dim = night ? -0.45 : 0;
    const green = ['#2f5a48', '#2a5040', '#3a6650', '#24483a'][Math.floor(r(v, 4, 8) * 4)];
    shadow(ctx, x, y, 520 * w, s);
    ctx.fillStyle = shade('#4a3424', dim);
    ctx.fillRect(x - 28 * s * w, y - 200 * s * h, 56 * s * w, 200 * s * h);
    const top = 1250 * h;
    for (let t = 0; t < tiers; t++) {
        const k = t / tiers;
        const yb = y - (180 + k * (top - 300)) * s, half = (360 - k * 260) * w * s, tall = (top / tiers + 160) * s;
        ctx.fillStyle = shade(green, dim + t * 0.03);
        ctx.beginPath(); ctx.moveTo(x, yb - tall); ctx.lineTo(x + half, yb); ctx.lineTo(x - half, yb); ctx.closePath(); ctx.fill();
        if (snow) {
            ctx.fillStyle = shade('#f4f8ff', dim);
            ctx.beginPath(); ctx.moveTo(x, yb - tall); ctx.lineTo(x + half * 0.5, yb - tall * 0.5); ctx.lineTo(x + half * 0.1, yb - tall * 0.42); ctx.lineTo(x - half * 0.5, yb - tall * 0.5); ctx.closePath(); ctx.fill();
        }
    }
}

function rock(ctx, x, y, s, v, night, base, cap) {
    const n = 5 + Math.floor(r(v, 1, 7) * 4), sz = 0.5 + r(v, 2, 7) * 1.3, flat = 0.55 + r(v, 3, 7) * 0.6;
    const dim = night ? -0.45 : 0;
    const col = base || ['#8a8278', '#7a8090', '#6a6058', '#948a7a', '#7a7468'][Math.floor(r(v, 4, 7) * 5)];
    shadow(ctx, x, y, 520 * sz, s);
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const a = Math.PI + (i / n) * Math.PI;
        const rr = (0.75 + r(v, 10 + i, 7) * 0.35) * 260 * sz;
        pts.push([x + Math.cos(a) * rr * s, y + Math.sin(a) * rr * flat * s]);
    }
    ctx.fillStyle = shade(col, dim);
    ctx.beginPath(); ctx.moveTo(pts[0][0], y); pts.forEach((p) => ctx.lineTo(p[0], p[1])); ctx.lineTo(pts[n][0], y); ctx.closePath(); ctx.fill();
    // the lit face
    ctx.fillStyle = shade(col, dim + 0.16);
    ctx.beginPath(); ctx.moveTo(pts[1][0], pts[1][1]); for (let i = 2; i < Math.ceil(n * 0.6); i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.lineTo(x, y - 40 * s * sz); ctx.closePath(); ctx.fill();
    if (cap) {
        ctx.fillStyle = shade(cap, dim);
        ctx.beginPath(); ctx.moveTo(pts[1][0], pts[1][1]); for (let i = 2; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[n - 1][0], pts[n - 1][1] + 40 * s); ctx.lineTo(pts[1][0], pts[1][1] + 40 * s); ctx.closePath(); ctx.fill();
    }
}

function grassBlades(ctx, x, y, s, v, col, n = 7, h = 160) {
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, 12 * s); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const dx = (r(v, i, 6) - 0.5) * 220, hh = h * (0.6 + r(v, i + 20, 6) * 0.7), bend = (r(v, i + 40, 6) - 0.5) * 80;
        ctx.moveTo(x + dx * s, y); ctx.quadraticCurveTo(x + (dx + bend * 0.3) * s, y - hh * 0.6 * s, x + (dx + bend) * s, y - hh * s);
    }
    ctx.stroke();
}

function animal(ctx, x, y, s, v, night, kind, t) {
    const dim = night ? -0.45 : 0;
    const face = r(v, 1, 4) < 0.5 ? -1 : 1;          // which way it faces
    const graze = Math.max(0, Math.sin(t * 0.8 + v)) * 40;   // head down now and then
    shadow(ctx, x, y, 420, s);
    if (kind === 'sheep') {
        ctx.fillStyle = shade('#2a2420', dim);
        for (const dx of [-70, -25, 25, 70]) ctx.fillRect(x + dx * s - 9 * s, y - 120 * s, 18 * s, 120 * s);
        const wool = shade('#f2eee4', dim);
        for (let i = 0; i < 5; i++) ell(ctx, x + (i - 2) * 45 * s, y - 175 * s - (i % 2) * 25 * s, 75 * s, 65 * s, wool);
        ell(ctx, x + face * 140 * s, y - 175 * s + graze * s, 45 * s, 38 * s, shade('#2a2420', dim));
    } else {
        ctx.fillStyle = shade('#6a4a2e', dim);
        for (const dx of [-110, -70, 70, 110]) ctx.fillRect(x + dx * s - 10 * s, y - 230 * s, 20 * s, 230 * s);
        ell(ctx, x, y - 270 * s, 160 * s, 70 * s, shade('#8a6038', dim));
        const hx = x + face * 190 * s, hy = y - 380 * s + graze * 2 * s;
        ctx.strokeStyle = shade('#8a6038', dim); ctx.lineWidth = Math.max(1, 40 * s);
        ctx.beginPath(); ctx.moveTo(x + face * 120 * s, y - 290 * s); ctx.lineTo(hx, hy); ctx.stroke();
        ell(ctx, hx + face * 25 * s, hy, 45 * s, 30 * s, shade('#8a6038', dim));
        if (r(v, 2, 4) < 0.5) {
            ctx.strokeStyle = shade('#d8c8a0', dim); ctx.lineWidth = Math.max(1, 8 * s);
            ctx.beginPath(); ctx.moveTo(hx, hy - 25 * s); ctx.lineTo(hx - 30 * s, hy - 110 * s); ctx.moveTo(hx - 15 * s, hy - 70 * s); ctx.lineTo(hx - 60 * s, hy - 90 * s);
            ctx.moveTo(hx + 10 * s, hy - 25 * s); ctx.lineTo(hx + 40 * s, hy - 110 * s); ctx.stroke();
        }
    }
}

/** Draw one thing at screen (x, y) for its base, s pixels per world unit. */
export function drawScenery(ctx, kind, x, y, s, v, night, t) {
    const dim = night ? -0.45 : 0;
    switch (kind) {
        case 'oak': case 'birch': case 'poplar': case 'blossom': case 'autumn': return broadleaf(ctx, x, y, s, v, night, kind);
        case 'swamptree': return broadleaf(ctx, x, y, s, v, night, 'swamp');
        case 'startree': return broadleaf(ctx, x, y, s, v, night, 'star');
        case 'ashtree': return broadleaf(ctx, x, y, s * 0.8, v, night, 'ash');
        case 'pine': return pine(ctx, x, y, s, v, night, r(v, 9, 8) < 0.2);
        case 'snowpine': return pine(ctx, x, y, s, v, night, true);
        case 'deadpine': case 'deadtree': {
            const h = 0.7 + r(v, 1, 5) * 0.6;
            ctx.strokeStyle = shade(kind === 'deadpine' ? '#5a4a40' : '#2a1e1a', dim * 0.5); ctx.lineCap = 'round';
            ctx.lineWidth = Math.max(1, 55 * s);
            const top = y - 620 * h * s;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r(v, 2, 5) - 0.5) * 80 * s, top); ctx.stroke();
            ctx.lineWidth = Math.max(1, 22 * s);
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const by = y - (260 + i * 100) * h * s, dir = r(v, 10 + i, 5) < 0.5 ? -1 : 1, len = (120 + r(v, 20 + i, 5) * 160) * s;
                ctx.moveTo(x, by); ctx.lineTo(x + dir * len, by - len * 0.8);
                ctx.moveTo(x + dir * len * 0.6, by - len * 0.48); ctx.lineTo(x + dir * len * 0.9, by - len * 0.3);
            }
            ctx.stroke();
            return;
        }
        case 'willow': {
            const w = 0.8 + r(v, 1, 3) * 0.5, h = 0.8 + r(v, 2, 3) * 0.4;
            shadow(ctx, x, y, 700 * w, s);
            ctx.fillStyle = shade('#4a3a2a', dim);
            ctx.fillRect(x - 45 * s, y - 480 * h * s, 90 * s, 480 * h * s);
            const g = ['#4a7a50', '#5a8a58', '#3e6a46'][Math.floor(r(v, 3, 3) * 3)];
            ell(ctx, x, y - 600 * h * s, 360 * w * s, 210 * h * s, shade(g, dim));
            ctx.strokeStyle = shade(g, dim - 0.1); ctx.lineWidth = Math.max(1, 26 * s);
            ctx.beginPath();
            for (let i = 0; i < 9; i++) { const sx = x + (i - 4) * 80 * w * s; ctx.moveTo(sx, y - 600 * h * s); ctx.quadraticCurveTo(sx + 20 * s, y - 400 * h * s, sx + (i - 4) * 10 * s, y - (220 + r(v, 10 + i, 3) * 160) * h * s); }
            ctx.stroke();
            return;
        }
        case 'bush': {
            const w = 0.6 + r(v, 1, 2) * 0.8;
            shadow(ctx, x, y, 420 * w, s);
            const g = ['#4a8a3c', '#3e7a34', '#5a9a46'][Math.floor(r(v, 2, 2) * 3)];
            for (let i = 0; i < 3; i++) ell(ctx, x + (i - 1) * 110 * w * s, y - (110 + (i % 2) * 40) * s, 140 * w * s, 110 * s, shade(g, dim + (i === 1 ? 0.08 : -0.05)));
            if (r(v, 3, 2) < 0.4) for (let i = 0; i < 6; i++) ell(ctx, x + (r(v, 10 + i, 2) - 0.5) * 300 * w * s, y - (90 + r(v, 20 + i, 2) * 120) * s, 14 * s, 14 * s, night ? '#704050' : ['#ff7a9a', '#ffd84a', '#c060ff'][Math.floor(r(v, 4, 2) * 3)]);
            return;
        }
        case 'rock': return rock(ctx, x, y, s, v, night);
        case 'mossrock': return rock(ctx, x, y, s, v, night, '#6a7068', '#4a7a40');
        case 'boulders':
            rock(ctx, x - 230 * s, y + 10 * s, s * 0.7, v + 1, night);
            rock(ctx, x + 180 * s, y, s * 0.9, v + 2, night);
            rock(ctx, x, y + 30 * s, s * 0.5, v + 3, night);
            return;
        case 'smallrock': return rock(ctx, x, y, s * 0.35, v, night);
        case 'pebbles':
            for (let i = 0; i < 5; i++) ell(ctx, x + (r(v, i, 1) - 0.5) * 260 * s, y - r(v, i + 9, 1) * 30 * s, (16 + r(v, i + 5, 1) * 22) * s, (10 + r(v, i + 7, 1) * 12) * s, shade(['#9a9488', '#7a7468', '#b0a898'][i % 3], dim));
            return;
        case 'tuft': return grassBlades(ctx, x, y, s, v, shade(['#4a8a3a', '#5a9a40', '#3e7a30'][v % 3], dim));
        case 'drytuft': return grassBlades(ctx, x, y, s, v, shade('#b8a060', dim), 6, 120);
        case 'snowtuft': grassBlades(ctx, x, y, s, v, shade('#7a8a7a', dim), 5, 110); ell(ctx, x, y, 120 * s, 22 * s, shade('#ffffff', dim)); return;
        case 'ashtuft': return grassBlades(ctx, x, y, s, v, shade('#5a4a40', dim * 0.5), 5, 120);
        case 'glowtuft': grassBlades(ctx, x, y, s, v, '#8a7ad8', 6, 150); if (night) ell(ctx, x, y - 80 * s, 120 * s, 90 * s, 'rgba(160,140,255,0.15)'); return;
        case 'flowers': {
            grassBlades(ctx, x, y, s, v, shade('#4a8a3a', dim), 5, 120);
            const c = ['#ff7a9a', '#ffd84a', '#ffffff', '#9a7aff', '#ff9a40'][v % 5];
            for (let i = 0; i < 5; i++) ell(ctx, x + (r(v, i, 3) - 0.5) * 200 * s, y - (90 + r(v, i + 5, 3) * 60) * s, 18 * s, 18 * s, night ? shade(c, -0.5) : c);
            return;
        }
        case 'toadstool': {
            const c = ['#d83a2a', '#c87a3a', '#e8d8b0'][v % 3];
            for (let i = 0; i < 2 + (v % 3); i++) {
                const dx = (r(v, i, 4) - 0.5) * 160, hh = 60 + r(v, i + 3, 4) * 50;
                ctx.fillStyle = shade('#f0e8d0', dim); ctx.fillRect(x + dx * s - 8 * s, y - hh * s, 16 * s, hh * s);
                ctx.fillStyle = shade(c, dim); ctx.beginPath(); ctx.ellipse(x + dx * s, y - hh * s, 40 * s, 28 * s, 0, Math.PI, TAU); ctx.fill();
            }
            return;
        }
        case 'lily': ell(ctx, x, y, 180 * s, 40 * s, shade('#3a5a4a', dim)); ell(ctx, x - 40 * s, y - 4 * s, 50 * s, 14 * s, shade('#5a9a4a', dim)); ell(ctx, x + 60 * s, y, 40 * s, 12 * s, shade('#5a9a4a', dim)); if (v % 2) ell(ctx, x - 40 * s, y - 14 * s, 14 * s, 10 * s, '#ffd0e0'); return;
        case 'pool': ell(ctx, x, y, (360 + r(v, 1, 2) * 300) * s, 70 * s, night ? '#1a2a30' : '#5a8a90'); ell(ctx, x - 60 * s, y - 10 * s, 120 * s, 14 * s, night ? '#2a3a40' : '#8ab8c0'); return;
        case 'reeds': {
            const c = shade('#6a8a4a', dim);
            grassBlades(ctx, x, y, s, v, c, 8, 320);
            ctx.fillStyle = shade('#6a4a2a', dim);
            for (let i = 0; i < 3; i++) ctx.fillRect(x + (r(v, i + 60, 6) - 0.5) * 200 * s - 8 * s, y - (300 + r(v, i + 70, 6) * 60) * s, 16 * s, 60 * s);
            return;
        }
        case 'log': {
            const len = 300 + r(v, 1, 2) * 300;
            shadow(ctx, x, y, len * 1.2, s);
            ctx.fillStyle = shade('#6a4a30', dim);
            ctx.fillRect(x - len / 2 * s, y - 90 * s, len * s, 90 * s);
            ell(ctx, x + len / 2 * s, y - 45 * s, 30 * s, 45 * s, shade('#c8a070', dim));
            ell(ctx, x + len / 2 * s, y - 45 * s, 14 * s, 22 * s, shade('#8a6040', dim));
            if (r(v, 2, 2) < 0.5) ell(ctx, x - len / 4 * s, y - 92 * s, 70 * s, 18 * s, shade('#5a8a3a', dim));
            return;
        }
        case 'stump':
            ctx.fillStyle = shade('#6a4a30', dim); ctx.fillRect(x - 60 * s, y - 110 * s, 120 * s, 110 * s);
            ell(ctx, x, y - 110 * s, 60 * s, 22 * s, shade('#c8a070', dim)); ell(ctx, x, y - 110 * s, 30 * s, 10 * s, shade('#a08050', dim));
            return;
        case 'haystack':
            shadow(ctx, x, y, 500, s);
            ctx.fillStyle = shade('#e0b860', dim);
            ctx.beginPath(); ctx.moveTo(x - 230 * s, y); ctx.quadraticCurveTo(x - 220 * s, y - 380 * s, x, y - 400 * s); ctx.quadraticCurveTo(x + 220 * s, y - 380 * s, x + 230 * s, y); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = shade('#b88a40', dim); ctx.lineWidth = Math.max(1, 8 * s);
            ctx.beginPath(); ctx.moveTo(x - 200 * s, y - 150 * s); ctx.quadraticCurveTo(x, y - 190 * s, x + 200 * s, y - 150 * s); ctx.stroke();
            return;
        case 'sheep': case 'deer': return animal(ctx, x, y, s, v, night, kind, t);
        case 'windmill': {
            ctx.fillStyle = shade('#e8dcc0', dim);
            ctx.beginPath(); ctx.moveTo(x - 160 * s, y); ctx.lineTo(x - 100 * s, y - 900 * s); ctx.lineTo(x + 100 * s, y - 900 * s); ctx.lineTo(x + 160 * s, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = shade('#a84a3a', dim);
            ctx.beginPath(); ctx.moveTo(x - 130 * s, y - 900 * s); ctx.lineTo(x, y - 1060 * s); ctx.lineTo(x + 130 * s, y - 900 * s); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = shade('#6a5040', dim); ctx.lineWidth = Math.max(1, 30 * s);
            const a0 = t * 0.6 + v;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) { const a = a0 + (i * Math.PI) / 2; ctx.moveTo(x, y - 880 * s); ctx.lineTo(x + Math.cos(a) * 520 * s, y - 880 * s + Math.sin(a) * 520 * s); }
            ctx.stroke();
            return;
        }
        case 'treeline': case 'pineline': {
            const n = 4 + (v % 3);
            for (let i = 0; i < n; i++) {
                const dx = (i - (n - 1) / 2) * 420 + (r(v, i, 11) - 0.5) * 200;
                if (kind === 'pineline') pine(ctx, x + dx * s, y + (i % 2) * 20 * s, s, v * 7 + i, night, r(v, 30, 11) < 0.5);
                else broadleaf(ctx, x + dx * s, y + (i % 2) * 20 * s, s, v * 7 + i, night, r(v, i + 40, 11) < 0.7 ? 'oak' : 'poplar');
            }
            return;
        }
        case 'saguaro': {
            const h = 0.7 + r(v, 1, 4) * 0.7;
            const c = shade(['#4f8a4a', '#5a9a50', '#467a40'][v % 3], dim);
            shadow(ctx, x, y, 300, s);
            ctx.fillStyle = c;
            ctx.fillRect(x - 55 * s, y - 640 * h * s, 110 * s, 640 * h * s);
            ell(ctx, x, y - 640 * h * s, 55 * s, 45 * s, c);
            const arms = Math.floor(r(v, 2, 4) * 3.5);
            for (let i = 0; i < arms; i++) {
                const side = i % 2 ? 1 : -1, ay = y - (220 + r(v, 10 + i, 4) * 260) * h * s, ah = (120 + r(v, 20 + i, 4) * 160) * s;
                ctx.fillRect(x + side * 55 * s - (side < 0 ? 110 * s : 0), ay, 110 * s, 50 * s);
                ctx.fillRect(x + side * 150 * s - 30 * s, ay - ah, 60 * s, ah + 50 * s);
                ell(ctx, x + side * 150 * s, ay - ah, 30 * s, 25 * s, c);
            }
            return;
        }
        case 'barrel': ell(ctx, x, y - 90 * s, 110 * s, 100 * s, shade('#5a9a50', dim)); ctx.strokeStyle = shade('#3a6a34', dim); ctx.lineWidth = Math.max(1, 8 * s); ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(x + i * 35 * s, y - 180 * s); ctx.quadraticCurveTo(x + i * 55 * s, y - 90 * s, x + i * 35 * s, y); } ctx.stroke(); if (v % 2) ell(ctx, x, y - 190 * s, 30 * s, 20 * s, '#ff5a7a'); return;
        case 'pear': for (let i = 0; i < 4 + (v % 3); i++) ell(ctx, x + (r(v, i, 5) - 0.5) * 260 * s, y - (80 + r(v, i + 9, 5) * 220) * s, 70 * s, 95 * s, shade(['#6aa858', '#5a9a4a'][i % 2], dim), (r(v, i + 20, 5) - 0.5)); return;
        case 'deadbush': ctx.strokeStyle = shade('#8a6a4a', dim); ctx.lineWidth = Math.max(1, 10 * s); ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.15 + r(v, i, 3) * 0.7); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 200 * s, y + Math.sin(a) * 200 * s); } ctx.stroke(); return;
        case 'bones': ctx.strokeStyle = shade('#efe6d0', dim); ctx.lineWidth = Math.max(1, 16 * s); ctx.beginPath(); ctx.moveTo(x - 150 * s, y - 20 * s); ctx.lineTo(x + 150 * s, y - 30 * s); for (let i = 0; i < 4; i++) { ctx.moveTo(x - 90 * s + i * 60 * s, y - 25 * s); ctx.quadraticCurveTo(x - 70 * s + i * 60 * s, y - 120 * s, x - 40 * s + i * 60 * s, y - 25 * s); } ctx.stroke(); ell(ctx, x + 190 * s, y - 40 * s, 50 * s, 40 * s, shade('#efe6d0', dim)); return;
        case 'mesa': {
            const w = 0.8 + r(v, 1, 3) * 0.8, h = 0.6 + r(v, 2, 3) * 0.7;
            ctx.fillStyle = shade('#c47a48', dim);
            ctx.beginPath(); ctx.moveTo(x - 1300 * w * s, y); ctx.lineTo(x - 900 * w * s, y - 900 * h * s); ctx.lineTo(x + 800 * w * s, y - 900 * h * s); ctx.lineTo(x + 1300 * w * s, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = shade('#d89058', dim);
            ctx.fillRect(x - 900 * w * s, y - 900 * h * s, 1700 * w * s, 90 * s);
            return;
        }
        case 'dune': return drawProp(ctx, 'dune', x, y, s * (0.7 + r(v, 1, 2) * 0.8), v, night);
        case 'palm': {
            const lean = (r(v, 1, 2) - 0.5) * 300;
            ctx.strokeStyle = shade('#8a6a40', dim); ctx.lineWidth = Math.max(1, 50 * s);
            ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.2 * s, y - 400 * s, x + lean * s, y - 750 * s); ctx.stroke();
            ctx.strokeStyle = shade('#4a8a3a', dim); ctx.lineWidth = Math.max(1, 40 * s);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) { const a = -Math.PI + (i / 5) * Math.PI; ctx.moveTo(x + lean * s, y - 750 * s); ctx.quadraticCurveTo(x + lean * s + Math.cos(a) * 200 * s, y - 900 * s, x + lean * s + Math.cos(a) * 380 * s, y - 700 * s + Math.abs(Math.cos(a)) * 80 * s); }
            ctx.stroke();
            return;
        }
        case 'giantshroom': case 'glowshroom': {
            const h = 0.6 + r(v, 1, 3) * 0.8;
            const cap = kind === 'glowshroom' ? ['#9a7aff', '#6ad0ff'][v % 2] : ['#c84a4a', '#8a5ac8', '#4ac8a0', '#d8a040'][v % 4];
            ctx.fillStyle = shade('#e8e0c8', dim); ctx.fillRect(x - 40 * s, y - 380 * h * s, 80 * s, 380 * h * s);
            ctx.fillStyle = night && kind === 'glowshroom' ? shade(cap, 0.2) : shade(cap, dim);
            ctx.beginPath(); ctx.ellipse(x, y - 380 * h * s, 230 * s, 160 * s, 0, Math.PI, TAU); ctx.fill();
            if (night) ell(ctx, x, y - 420 * h * s, 300 * s, 230 * s, kind === 'glowshroom' ? 'rgba(150,130,255,0.18)' : 'rgba(120,255,200,0.1)');
            return;
        }
        case 'iceshards': case 'shard': {
            const c = kind === 'shard' ? '#b8a8ff' : '#cfeeff';
            for (let i = 0; i < 3; i++) { const dx = (i - 1) * 50, hh = 90 + r(v, i, 4) * 120; ctx.fillStyle = shade(c, i * 0.1 + (night ? -0.2 : 0)); ctx.beginPath(); ctx.moveTo(x + dx * s, y - hh * s); ctx.lineTo(x + (dx + 25) * s, y); ctx.lineTo(x + (dx - 25) * s, y); ctx.closePath(); ctx.fill(); }
            return;
        }
        case 'icespire': ctx.fillStyle = shade('#bfe6ff', night ? -0.3 : 0); ctx.beginPath(); ctx.moveTo(x - 120 * s, y); ctx.lineTo(x - 30 * s, y - (700 + r(v, 1, 2) * 500) * s); ctx.lineTo(x + 110 * s, y); ctx.closePath(); ctx.fill(); return;
        case 'obsidian': ctx.fillStyle = shade('#2a2228', 0); ctx.beginPath(); ctx.moveTo(x - 200 * s, y); ctx.lineTo(x - 60 * s, y - (600 + r(v, 1, 2) * 600) * s); ctx.lineTo(x + 40 * s, y - (400 + r(v, 2, 2) * 300) * s); ctx.lineTo(x + 180 * s, y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#8a3a5a'; ctx.lineWidth = Math.max(1, 6 * s); ctx.stroke(); return;
        case 'ember': ell(ctx, x, y, 60 * s, 20 * s, '#2a1a18'); ell(ctx, x, y - 4 * s, 30 * s, 8 * s, '#ff8a3a'); return;
        case 'floatrock': {
            const bob = Math.sin(t * 1.2 + v) * 40;
            rock(ctx, x, y - (500 + bob) * s, s * 0.6, v, night, '#4a4470');
            ell(ctx, x, y, 140 * s, 30 * s, 'rgba(0,0,0,0.18)');
            return;
        }
        case 'fence': case 'lavarock': case 'vent': case 'crystal': case 'obelisk':
            return drawProp(ctx, kind, x, y, s * (kind === 'crystal' ? 0.7 + r(v, 1, 2) * 0.8 : 1), v, night);
        default: return drawProp(ctx, kind, x, y, s, v, night);
    }
}

// ------------------------------------------------------------------ birds
const BIRD = {
    meadow: { col: '#2a2a30', size: 1, kinds: ['flock', 'flock', 'vee'] },
    desert: { col: '#3a2a24', size: 1.4, kinds: ['circle', 'flock'] },
    mire: { col: '#2a3030', size: 1.1, kinds: ['flock', 'vee'] },
    frost: { col: '#1a1a24', size: 1.2, kinds: ['vee', 'flock'] },
    ember: { col: '#1a1010', size: 1.2, kinds: ['circle', 'bats'] },
    star: { col: '#d8d0ff', size: 0.9, kinds: ['flock', 'bats'] },
};

/** Flocks crossing the sky now and then, in the region's kind of bird; bats at night. View-only and random. */
export class Birds {
    constructor() { this.flocks = []; this.wait = 2 + Math.random() * 6; }

    update(dt, biome, night) {
        this.wait -= dt;
        if (this.wait <= 0 && this.flocks.length < 2) {
            const B = BIRD[biome] || BIRD.meadow;
            let kind = B.kinds[Math.floor(Math.random() * B.kinds.length)];
            if (night && (biome === 'meadow' || biome === 'mire' || biome === 'frost')) kind = Math.random() < 0.6 ? 'bats' : 'none';
            this.wait = 8 + Math.random() * 18;
            if (kind === 'none') return;
            const dir = Math.random() < 0.5 ? 1 : -1;
            const n = kind === 'circle' ? 1 + Math.floor(Math.random() * 2) : kind === 'vee' ? 5 + Math.floor(Math.random() * 6) : 3 + Math.floor(Math.random() * 7);
            const birds = [];
            for (let i = 0; i < n; i++) {
                const off = kind === 'vee' ? { x: -Math.ceil(i / 2) * 0.035, y: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.03 } : { x: (Math.random() - 0.5) * 0.12, y: (Math.random() - 0.5) * 0.08 };
                birds.push({ ...off, ph: Math.random() * TAU, sp: 0.9 + Math.random() * 0.2 });
            }
            this.flocks.push({ kind, dir, x: dir > 0 ? -0.15 : 1.15, y: 0.08 + Math.random() * 0.25, v: 0.035 + Math.random() * 0.04, col: night ? '#0a0a12' : B.col, size: B.size * (0.8 + Math.random() * 0.5), birds, t: 0, cx: 0.2 + Math.random() * 0.6 });
        }
        for (const f of this.flocks) {
            f.t += dt;
            if (f.kind === 'circle') f.x = f.cx + Math.cos(f.t * 0.35) * 0.12 * f.dir;
            else f.x += f.v * f.dir * dt;
            f.y += Math.sin(f.t * 0.7) * 0.004 * dt;
        }
        this.flocks = this.flocks.filter((f) => (f.kind === 'circle' ? f.t < 40 : f.x > -0.4 && f.x < 1.4));
    }

    /** Draw in the sky above the horizon of the scene rectangle R. */
    draw(ctx, R, horizon, time) {
        for (const f of this.flocks) {
            const fade = f.kind === 'circle' ? Math.min(1, f.t / 3, (40 - f.t) / 3) : 1;
            ctx.globalAlpha = Math.max(0, fade);
            ctx.strokeStyle = f.col;
            ctx.lineCap = 'round';
            const span = (horizon - R.y);
            for (const b of f.birds) {
                const x = R.x + (f.x + b.x * f.dir * -1) * R.w;
                const y = R.y + (f.y + b.y) * span + (f.kind === 'circle' ? Math.sin(f.t * 0.35) * 0.05 * span : 0);
                const sz = Math.max(3, R.h * 0.012) * f.size;
                const flap = f.kind === 'circle' ? 0.25 : Math.sin(time * (f.kind === 'bats' ? 22 : 9) * b.sp + b.ph);
                ctx.lineWidth = Math.max(1, sz * 0.28);
                ctx.beginPath();
                ctx.moveTo(x - sz, y - flap * sz * 0.7);
                ctx.quadraticCurveTo(x - sz * 0.4, y - sz * 0.3 - flap * sz * 0.2, x, y);
                ctx.quadraticCurveTo(x + sz * 0.4, y - sz * 0.3 - flap * sz * 0.2, x + sz, y - flap * sz * 0.7);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }
}

export { mix };
