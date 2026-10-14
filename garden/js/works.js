// The Works: the machine hall under the clock tower that keeps the island
// running. A ring of iron grating around a shaft that drops out of sight, the
// drive column that turns the tower's clock, great gears, boilers, pistons,
// pipes and steam, and screens everywhere showing the garden's own source
// code, its games and models from them. Built on the first visit, with its
// own scene and a stand-in `world` for the walking controls.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Batch, xf, under } from './materials.js';
import { lathe, gearShape } from './architecture.js';
import { canvas, toTexture, glowSprite } from './textures.js';
import { genreOf } from './genres.js';
import { rng, TAU, lerp, clamp } from './util.js';

export const HALL_R = 30;   // the hall's wall
const PIT_R = 10;           // the shaft's railing
const CEIL = 26;
const WALK_IN = PIT_R + 0.55, WALK_OUT = HALL_R - 1.6;
const SLOT = TAU / 12;      // the hall is laid out in twelve bays; bay 0 holds the stair door

// garden sources shown on the code screens (fetched from this folder)
const SOURCES = ['works.js', 'terrain.js', 'controls.js', 'architecture.js', 'statues.js', 'hologram.js', 'music.js', 'vines.js', 'water.js', 'sky.js', 'fox.js'];

const onWall = (a, r, y) => xf(Math.sin(a) * r, y, Math.cos(a) * r, a + Math.PI);

/** A circular arc as a curve, for pipes that run around the hall. */
class Arc extends THREE.Curve {
    constructor(r, y, a0, a1) {
        super();
        Object.assign(this, { r, y, a0, a1 });
    }
    getPoint(t, out = new THREE.Vector3()) {
        const a = lerp(this.a0, this.a1, t);
        return out.set(Math.sin(a) * this.r, this.y, Math.cos(a) * this.r);
    }
}

// ------------------------------------------------------------- textures

function grateTexture() {
    const n = 128, c = canvas(n), ctx = c.getContext('2d');
    ctx.fillStyle = '#3a3633';
    ctx.fillRect(0, 0, n, n);
    const r = rng('grate');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const x = i * 32, y = j * 32;
        ctx.fillStyle = '#121010';
        ctx.fillRect(x + 4, y + 4, 24, 24);
        ctx.fillStyle = `rgba(150,90,40,${0.1 + r() * 0.2})`;
        ctx.fillRect(x + r() * 20, y + r() * 20, 6 + r() * 10, 3);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let k = 0; k <= n; k += 32) {
        ctx.beginPath();
        ctx.moveTo(k + 1.5, 0);
        ctx.lineTo(k + 1.5, n);
        ctx.moveTo(0, k + 1.5);
        ctx.lineTo(n, k + 1.5);
        ctx.stroke();
    }
    return toTexture(c, { repeat: 26 });
}

function brickTexture() {
    const w = 256, h = 256, c = canvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#2a1e18';
    ctx.fillRect(0, 0, w, h);
    const r = rng('bricks');
    const bh = 16, bw = 42;
    for (let row = 0; row < h / bh; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let x = -bw; x < w + bw; x += bw) {
            const v = 70 + r() * 40;
            ctx.fillStyle = `rgb(${v * 1.15},${v * 0.62},${v * 0.45})`;
            ctx.fillRect(x + off + 1.5, row * bh + 1.5, bw - 3, bh - 3);
            if (r() < 0.25) {
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.fillRect(x + off + 1.5, row * bh + 1.5, bw - 3, bh - 3);
            }
        }
    }
    // soot rising from the floor
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const t = toTexture(c);
    t.repeat.set(36, 6);
    return t;
}

function stripeTexture() {
    const c = canvas(128, 16), ctx = c.getContext('2d');
    ctx.fillStyle = '#e0b020';
    ctx.fillRect(0, 0, 128, 16);
    ctx.fillStyle = '#151515';
    for (let x = -16; x < 128; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 16);
        ctx.lineTo(x + 16, 0);
        ctx.lineTo(x + 32, 0);
        ctx.lineTo(x + 16, 16);
        ctx.fill();
    }
    const t = toTexture(c);
    t.repeat.set(40, 1);
    return t;
}

function gaugeTexture(label) {
    const n = 128, c = canvas(n), ctx = c.getContext('2d');
    ctx.fillStyle = '#efe6cf';
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#2a1c0e';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 10; i++) {
        const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
        ctx.beginPath();
        ctx.moveTo(64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48);
        ctx.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
        ctx.stroke();
    }
    ctx.strokeStyle = '#c0302a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(64, 64, 53, Math.PI * 1.9, Math.PI * 2.25);
    ctx.stroke();
    ctx.fillStyle = '#2a1c0e';
    ctx.font = '600 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 64, 96);
    return toTexture(c);
}

function signTex(text, sub) {
    const c = canvas(512, 128), ctx = c.getContext('2d');
    ctx.fillStyle = '#1d140c';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#d9b46a';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 112);
    ctx.fillStyle = '#ffd98a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 46px "Cinzel", Georgia, serif';
    ctx.fillText(text, 256, sub ? 52 : 64, 470);
    if (sub) {
        ctx.font = 'italic 22px Georgia, serif';
        ctx.fillStyle = '#d9c08a';
        ctx.fillText(sub, 256, 95, 470);
    }
    return toTexture(c);
}

// ---------------------------------------------------------------- models

/** Low-poly models of things from the games, as lists of [geometry, matrix]. */
function modelLibrary() {
    const T = (geo, x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => [geo, xf(x, y, z, ry, sx, sy, sz, rx, rz)];
    const gear = new THREE.ExtrudeGeometry(gearShape(0.6, 10, 0.16, 0.16), { depth: 0.22, bevelEnabled: false, curveSegments: 3 });
    gear.translate(0, 0, -0.11);
    return [
        { name: 'Starfighter', match: /space|shoot|ship|star/i, parts: [
            T(new THREE.ConeGeometry(0.24, 1.7, 6), 0, 0, 0.1, 0, 1, 1, 1, Math.PI / 2),
            T(new THREE.BoxGeometry(1.9, 0.05, 0.5), 0, 0, -0.25),
            T(new THREE.BoxGeometry(0.05, 0.45, 0.35), 0.5, 0.2, -0.4),
            T(new THREE.BoxGeometry(0.05, 0.45, 0.35), -0.5, 0.2, -0.4),
            T(new THREE.CylinderGeometry(0.12, 0.15, 0.5, 8), 0.3, -0.05, -0.6, 0, 1, 1, 1, Math.PI / 2),
            T(new THREE.CylinderGeometry(0.12, 0.15, 0.5, 8), -0.3, -0.05, -0.6, 0, 1, 1, 1, Math.PI / 2),
        ] },
        { name: 'Cut Gem', match: /match|gem|jewel/i, parts: [T(lathe([[0, -0.75], [0.8, 0], [0.55, 0.32], [0, 0.32]], 8))] },
        { name: 'Chrome Chalice', match: /chalice|grail/i, parts: [T(lathe([[0, 0], [0.45, 0], [0.45, 0.06], [0.1, 0.15], [0.08, 0.6], [0.15, 0.7], [0.45, 0.85], [0.55, 1.25], [0.5, 1.27], [0.4, 0.9], [0, 0.82]], 12), 0, -0.65, 0)] },
        { name: 'Toy Engine', match: /train|rail|loco/i, parts: [
            T(new THREE.CylinderGeometry(0.28, 0.28, 1.0, 12), 0, 0.15, 0.2, 0, 1, 1, 1, Math.PI / 2),
            T(new THREE.BoxGeometry(0.62, 0.62, 0.5), 0, 0.25, -0.5),
            T(new THREE.BoxGeometry(0.7, 0.06, 0.6), 0, 0.6, -0.5),
            T(new THREE.CylinderGeometry(0.08, 0.12, 0.35, 8), 0, 0.55, 0.5),
            T(new THREE.BoxGeometry(0.72, 0.12, 1.6), 0, -0.18, -0.05),
            ...[-0.5, 0, 0.45].flatMap((z) => [T(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 12), 0.38, -0.27, z, 0, 1, 1, 1, 0, Math.PI / 2), T(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 12), -0.38, -0.27, z, 0, 1, 1, 1, 0, Math.PI / 2)]),
        ] },
        { name: 'Knight\'s Sword', match: /sword|knight|blade|dungeon|rogue/i, parts: [
            T(new THREE.BoxGeometry(0.14, 1.3, 0.03), 0, 0.25, 0),
            T(new THREE.ConeGeometry(0.1, 0.25, 4), 0, 1.02, 0, Math.PI / 4, 1, 1, 0.25),
            T(new THREE.BoxGeometry(0.6, 0.08, 0.1), 0, -0.42, 0),
            T(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 6), 0, -0.64, 0),
            T(new THREE.IcosahedronGeometry(0.08, 0), 0, -0.86, 0),
        ] },
        { name: 'Drive Gear', match: /clock|gear|machine|factory|steam/i, parts: [T(gear), T(gear.clone(), 0.95, 0.38, 0, 0, 0.55, 0.55, 1, 0, 0.3)] },
        { name: 'Treasure Chest', match: /treasure|loot|chest|gold/i, parts: [
            T(new THREE.BoxGeometry(1.0, 0.5, 0.62), 0, -0.2, 0),
            T(new THREE.CylinderGeometry(0.31, 0.31, 1.0, 10, 1, false, 0, Math.PI), 0, 0.05, 0, 0, 1, 1, 1, 0, Math.PI / 2),
            T(new THREE.BoxGeometry(0.12, 0.2, 0.66), 0, -0.02, 0.0),
        ] },
        { name: 'Crystal Orb', match: /magic|wizard|crystal|mage|spell/i, parts: [T(new THREE.IcosahedronGeometry(0.55, 1)), T(new THREE.TorusGeometry(0.8, 0.03, 4, 32), 0, 0, 0, 0, 1, 1, 1, 1.2), T(new THREE.CylinderGeometry(0.3, 0.42, 0.25, 8), 0, -0.68, 0)] },
        { name: 'Delver\'s Lantern', match: /lantern|delve|cave|dark/i, parts: [
            T(lathe([[0, 0], [0.32, 0], [0.32, 0.08], [0.24, 0.12], [0.24, 0.72], [0.34, 0.78], [0.12, 0.98], [0, 1.0]], 6), 0, -0.55, 0),
            T(new THREE.TorusGeometry(0.14, 0.025, 4, 12), 0, 0.55, 0),
        ] },
    ];
}

/** Edge list (Float32Array of xyz pairs) and a mesh-free bound for a model. */
function modelEdges(model) {
    const arrs = [];
    let n = 0;
    for (const [g, m] of model.parts) {
        const e = new THREE.EdgesGeometry(g.clone().applyMatrix4(m), 24);
        arrs.push(e.attributes.position.array);
        n += e.attributes.position.array.length;
        e.dispose();
    }
    const out = new Float32Array(n);
    let o = 0;
    for (const a of arrs) {
        out.set(a, o);
        o += a.length;
    }
    let r = 0;
    for (let i = 0; i < out.length; i += 3) r = Math.max(r, Math.hypot(out[i], out[i + 1], out[i + 2]));
    return { edges: out, radius: r || 1 };
}

// ---------------------------------------------------------------- screens

const MONO = '"SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';
const KEYWORDS = new Set('const let var function return if else for while of in new class extends import export from this true false null undefined break continue switch case default async await try catch throw typeof'.split(' '));
const THEMES = [
    { bg: '#06120b', fg: '#7dff9b', dim: '#2f7a45', kw: '#c8ffb0', str: '#ffe08a', num: '#9fe8ff', com: '#3c8a55', bar: '#0f2a18' },
    { bg: '#140c04', fg: '#ffbf5a', dim: '#7a5420', kw: '#ffe0a0', str: '#ffd27a', num: '#ffa060', com: '#8a6430', bar: '#2a1806' },
    { bg: '#0b0f1a', fg: '#c9d4ea', dim: '#4a5672', kw: '#c792ea', str: '#c3e88d', num: '#f78c6c', com: '#5c6a8a', bar: '#151c2e' },
];

function scanlines(ctx, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
}

function header(ctx, w, text, theme, right = '') {
    ctx.fillStyle = theme.bar;
    ctx.fillRect(0, 0, w, 22);
    ctx.fillStyle = theme.fg;
    ctx.font = `600 13px ${MONO}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, 8, 11, w * 0.7);
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.dim;
    ctx.fillText(right, w - 8, 11);
    ctx.textAlign = 'left';
}

function wrap(ctx, text, maxW) {
    const words = text.split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && cur) {
            lines.push(cur);
            cur = w;
        } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
}

/** Pixel-art "screenshots" of a game, drawn from its genre. */
function drawGameArt(ctx, w, h, game, t) {
    const r = rng(game.id);
    const g = genreOf(game);
    const acc = g.accent, acc2 = g.accent2 || '#ffffff';
    const id = g.id;
    if (id === 'puzzle') {
        ctx.fillStyle = '#141838';
        ctx.fillRect(0, 0, w, h);
        const cols = 9, rows = 6, cs = Math.min(w / (cols + 1), (h - 50) / rows);
        const ox = (w - cols * cs) / 2, oy = 28;
        const pal = ['#ff4d6d', '#ffd23f', '#3ddc97', '#4ea8ff', '#c77dff'];
        const sel = Math.floor(t * 1.5) % (cols * rows);
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
            const k = Math.floor(r() * 5);
            const cx = ox + (i + 0.5) * cs, cy = oy + (j + 0.5) * cs;
            const pop = (j * cols + i) % 11 === Math.floor(t) % 11 ? 1 + 0.25 * Math.sin(t * 12) : 1;
            const s = cs * 0.36 * pop;
            ctx.fillStyle = pal[k];
            ctx.beginPath();
            if (k % 3 === 0) ctx.arc(cx, cy, s, 0, TAU);
            else if (k % 3 === 1) {
                ctx.moveTo(cx, cy - s);
                ctx.lineTo(cx + s, cy);
                ctx.lineTo(cx, cy + s);
                ctx.lineTo(cx - s, cy);
            } else ctx.rect(cx - s * 0.8, cy - s * 0.8, s * 1.6, s * 1.6);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillRect(cx - s * 0.4, cy - s * 0.5, s * 0.3, s * 0.3);
            if (j * cols + i === sel) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(cx - cs / 2 + 2, cy - cs / 2 + 2, cs - 4, cs - 4);
            }
        }
    } else if (id === 'dungeon') {
        const ts = Math.max(8, Math.floor(h / 13));
        const cols = Math.ceil(w / ts), rows = Math.ceil(h / ts);
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
            const wall = j < 2 || j >= rows - 2 || i === 0 || i === cols - 1 || r() < 0.08;
            ctx.fillStyle = wall ? (r() < 0.5 ? '#3b2f2a' : '#463830') : (i + j) % 2 ? '#1c1714' : '#221b17';
            ctx.fillRect(i * ts, j * ts, ts - 1, ts - 1);
        }
        const hx = ((t * 1.2) % (cols - 4) + 2) * ts, hy = Math.floor(rows / 2) * ts;
        for (let k = 0; k < 4; k++) {
            const fx = (2 + k * 5) * ts, fy = 2 * ts;
            ctx.fillStyle = `rgba(255,${140 + Math.random() * 60},40,0.9)`;
            ctx.fillRect(fx + ts * 0.3, fy - ts * 0.6, ts * 0.4, ts * 0.5);
        }
        ctx.fillStyle = '#e04030';
        for (let k = 0; k < 3; k++) ctx.fillRect(((k * 7 + 5) % cols) * ts + 2, (3 + k * 2) * ts + 2, ts - 5, ts - 5);
        ctx.fillStyle = acc2;
        ctx.fillRect(hx + 2, hy + 2, ts - 5, ts - 5);
        const fog = ctx.createRadialGradient(hx, hy, ts * 2, hx, hy, w * 0.5);
        fog.addColorStop(0, 'rgba(0,0,0,0)');
        fog.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = fog;
        ctx.fillRect(0, 0, w, h);
    } else if (id === 'rpg') {
        ctx.fillStyle = '#3f8f3a';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2f6fd0';
        ctx.beginPath();
        ctx.ellipse(w * (0.2 + r() * 0.2), h * 0.6, w * 0.18, h * 0.16, 0.3, 0, TAU);
        ctx.fill();
        for (let k = 0; k < 26; k++) {
            const x = r() * w, y = 24 + r() * (h - 70);
            ctx.fillStyle = r() < 0.3 ? '#8a8a90' : '#1f5a26';
            ctx.beginPath();
            ctx.moveTo(x, y - 12);
            ctx.lineTo(x + 8, y + 4);
            ctx.lineTo(x - 8, y + 4);
            ctx.fill();
        }
        const cx = w * 0.72, cy = h * 0.32;
        ctx.fillStyle = '#d8d0c0';
        ctx.fillRect(cx - 20, cy - 10, 40, 24);
        ctx.fillRect(cx - 26, cy - 22, 10, 36);
        ctx.fillRect(cx + 16, cy - 22, 10, 36);
        ctx.fillStyle = acc;
        ctx.fillRect(cx - 2, cy - 30, 2, 14);
        ctx.fillStyle = '#ffe0a0';
        ctx.fillRect(w * 0.45 + Math.sin(t) * 30, h * 0.5, 7, 9);
        ctx.fillStyle = 'rgba(10,20,60,0.9)';
        ctx.fillRect(10, h - 44, w - 20, 34);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(10, h - 44, w - 20, 34);
        ctx.fillStyle = '#ffffff';
        ctx.font = `12px ${MONO}`;
        const line = (game.description.split('.')[0] || '').slice(0, Math.floor((t * 20) % 120));
        ctx.fillText(line, 18, h - 26, w - 36);
    } else if (id === 'story') {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#1a1036');
        sky.addColorStop(1, '#b0568a');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff3d0';
        ctx.beginPath();
        ctx.arc(w * 0.75, h * 0.28, h * 0.1, 0, TAU);
        ctx.fill();
        for (let layer = 0; layer < 3; layer++) {
            ctx.fillStyle = ['#3a2050', '#2a1640', '#180c28'][layer];
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * (0.55 + layer * 0.1) - Math.abs(Math.sin(x * 0.02 + layer * 2 + r() * 0.2)) * 40);
            ctx.lineTo(w, h);
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(14, h - 58, w - 28, 46);
        ctx.fillStyle = '#ffeedd';
        ctx.font = 'italic 13px Georgia, serif';
        const words = game.description.slice(0, Math.floor((t * 24) % 160));
        wrap(ctx, words, w - 50).slice(0, 2).forEach((l, i) => ctx.fillText(l, 24, h - 40 + i * 16));
    } else if (id === 'strategy') {
        ctx.fillStyle = '#10161c';
        ctx.fillRect(0, 0, w, h);
        const seeds = [0, 1, 2].map(() => ({ x: r() * w, y: 30 + r() * (h - 60) }));
        const cols = ['#d04848', '#4878d0', '#48b060'];
        const hs = Math.max(10, w / 22);
        for (let j = 0; j * hs * 0.86 < h; j++) for (let i = 0; i * hs < w + hs; i++) {
            const x = i * hs + (j % 2 ? hs / 2 : 0), y = 24 + j * hs * 0.86;
            let best = 0, bd = Infinity;
            seeds.forEach((s, k) => {
                const d = Math.hypot(s.x - x, s.y - y);
                if (d < bd) {
                    bd = d;
                    best = k;
                }
            });
            ctx.fillStyle = cols[best];
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
                const a = (k / 6) * TAU + Math.PI / 6;
                ctx.lineTo(x + Math.cos(a) * hs * 0.48, y + Math.sin(a) * hs * 0.48);
            }
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        for (const s of seeds) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, 5, 0, TAU);
            ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = `12px ${MONO}`;
        ctx.fillText(`TURN ${1 + Math.floor(t / 3) % 99}`, w - 70, h - 12);
    } else if (id === 'cozy') {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#8fd0ff');
        sky.addColorStop(1, '#e8f6ff');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 4; k++) {
            const x = ((r() * w + t * 8) % (w + 80)) - 40, y = 30 + r() * 40;
            ctx.beginPath();
            ctx.ellipse(x, y, 26, 9, 0, 0, TAU);
            ctx.fill();
        }
        for (let layer = 0; layer < 2; layer++) {
            ctx.fillStyle = layer ? '#5aa84a' : '#86c96a';
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h * (0.55 + layer * 0.15) + Math.sin(x * 0.015 + layer * 3) * 14);
            ctx.lineTo(w, h);
            ctx.fill();
        }
        for (let k = 0; k < 5; k++) {
            const x = 20 + r() * (w - 40), y = h * 0.62 + r() * 20;
            ctx.fillStyle = ['#ffd6a0', '#ffffff', '#ffc0c0'][k % 3];
            ctx.fillRect(x, y, 18, 14);
            ctx.fillStyle = '#c0503a';
            ctx.beginPath();
            ctx.moveTo(x - 3, y);
            ctx.lineTo(x + 9, y - 10);
            ctx.lineTo(x + 21, y);
            ctx.fill();
        }
        const ty = h - 22;
        ctx.fillStyle = '#6a4a30';
        ctx.fillRect(0, ty + 8, w, 3);
        const tx = ((t * 40) % (w + 120)) - 100;
        ctx.fillStyle = acc;
        ctx.fillRect(tx, ty - 6, 30, 14);
        ctx.fillStyle = acc2;
        ctx.fillRect(tx + 34, ty - 2, 26, 10);
        ctx.fillRect(tx + 64, ty - 2, 26, 10);
    } else {
        // arcade and anything else: a shoot-'em-up attract mode
        ctx.fillStyle = '#05010e';
        ctx.fillRect(0, 0, w, h);
        for (let k = 0; k < 70; k++) {
            const x = r() * w, sp = 20 + r() * 60;
            const y = (r() * h + t * sp) % h;
            ctx.fillStyle = `rgba(255,255,255,${0.3 + (sp / 80) * 0.7})`;
            ctx.fillRect(x, y, 1.5, 1.5);
        }
        const ex = Math.sin(t * 0.8) * 30;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 7; i++) {
            const x = w / 2 + (i - 3) * 34 + ex, y = 40 + j * 24;
            ctx.fillStyle = j === 0 ? acc : acc2;
            ctx.fillRect(x - 9, y - 5, 18, 8);
            ctx.fillRect(x - 12 + (Math.floor(t * 4) % 2) * 3, y + 3, 4, 5);
            ctx.fillRect(x + 8 - (Math.floor(t * 4) % 2) * 3, y + 3, 4, 5);
        }
        const px = w / 2 + Math.sin(t * 1.3) * w * 0.3, py = h - 34;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(px, py - 12);
        ctx.lineTo(px + 10, py + 8);
        ctx.lineTo(px - 10, py + 8);
        ctx.fill();
        ctx.fillStyle = '#7fffff';
        for (let k = 0; k < 4; k++) ctx.fillRect(px - 1, py - 20 - ((t * 220 + k * 50) % (h - 60)), 2, 8);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 13px ${MONO}`;
        ctx.fillText(`SCORE ${String(Math.floor(t * 130) % 1000000).padStart(6, '0')}`, 10, 34);
    }
}

class Screen {
    constructor(kind, w, h, seed) {
        this.kind = kind;
        this.w = w;
        this.h = h;
        this.canvas = canvas(w, h);
        this.ctx = this.canvas.getContext('2d');
        this.tex = toTexture(this.canvas);
        this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping;
        this.tex.anisotropy = 1;
        this.r = rng(seed);
        this.theme = THEMES[seed % THEMES.length];
        this.next = 0;
        this.state = {};
        this.material = new THREE.MeshBasicMaterial({ map: this.tex, color: new THREE.Color(1.25, 1.25, 1.25) });
    }
}

// ------------------------------------------------------------------ steam

const steamVert = /* glsl */ `
uniform float uTime, uScale;
attribute vec4 aDir;    // direction, speed
attribute vec4 aParams; // size, phase, life, burst period (0 = always on)
attribute float aEmit;  // the emitter's own phase, for bursts
varying float vAlpha;
void main(){
  float life = aParams.z;
  float age = mod(uTime + aParams.y * life, life);
  float k = age / life;
  vec3 p = position + aDir.xyz * aDir.w * age * (1.0 - 0.4 * k) + vec3(0.0, 0.5 * age * age, 0.0);
  p.x += sin(uTime * 1.1 + aParams.y * 23.0) * 0.5 * k;
  p.z += cos(uTime * 0.9 + aParams.y * 17.0) * 0.5 * k;
  float a = smoothstep(0.0, 0.12, k) * (1.0 - k);
  if (aParams.w > 0.0) {
    // a burst vents for the first quarter of each period
    float born = uTime - age;
    a *= step(fract(born / aParams.w + aEmit), 0.25);
  }
  vAlpha = a;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = a > 0.001 ? aParams.x * (0.5 + 2.2 * k) * uScale / -mv.z : 0.0;
  gl_Position = projectionMatrix * mv;
}`;

const steamFrag = /* glsl */ `
uniform sampler2D uMap;
varying float vAlpha;
void main(){
  float m = texture2D(uMap, gl_PointCoord).a;
  float a = m * vAlpha * 0.32;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.86, 0.84, 0.8), a);
  #include <colorspace_fragment>
}`;

// ------------------------------------------------------------------- hall

export class Works {
    /**
     * @param {object} env  { renderer, games, sky, island, statues, ui, audio }
     */
    constructor(env) {
        this.env = env;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0e0b09);
        this.scene.fog = new THREE.FogExp2(0x120d0a, 0.017);
        const pmrem = new THREE.PMREMGenerator(env.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environmentIntensity = 0.3;
        pmrem.dispose();

        this.mats = {
            ...env.mats,
            grate: new THREE.MeshStandardMaterial({ map: grateTexture(), roughness: 0.65, metalness: 0.55, color: 0xb0a8a0 }),
            brick: new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.95, color: 0xb09888 }),
            pitWall: new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.95, color: 0x806858, side: THREE.BackSide }),
            redPipe: new THREE.MeshStandardMaterial({ color: 0x8a2c1e, roughness: 0.45, metalness: 0.35 }),
            greenPipe: new THREE.MeshStandardMaterial({ color: 0x2f5a46, roughness: 0.5, metalness: 0.35 }),
            ceiling: new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1, side: THREE.BackSide }),
            stripe: new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.7 }),
            furnace: new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff6a1a, emissiveIntensity: 2.5, roughness: 0.8 }),
            core: new THREE.MeshStandardMaterial({ color: 0x302010, emissive: 0xffc36a, emissiveIntensity: 2.2, roughness: 0.3 }),
            lamp: new THREE.MeshStandardMaterial({ color: 0x302010, emissive: 0xffc070, emissiveIntensity: 2.0, roughness: 0.4 }),
            lens: new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x7ffcff, emissiveIntensity: 2.0, roughness: 0.2 }),
        };
        this.mats.brick.map.repeat.set(36, 6);
        this.mats.pitWall.map = this.mats.pitWall.map.clone();
        this.mats.pitWall.map.repeat.set(12, 16);
        this.mats.pitWall.map.needsUpdate = true;

        this.colliders = [];
        this.spinners = [];   // { obj, axis: 'x'|'y'|'z', speed }
        this.pistons = [];
        this.needles = [];
        this.flickers = [];
        this.screens = [];
        this.emitters = [];
        this.holos = [];
        this.sources = [];
        this.time = 0;
        this.models = modelLibrary().map((m) => ({ ...m, ...modelEdges(m), game: this._gameFor(m.match) }));
        this._loadSources();

        const batch = new Batch();
        this._shell(batch);
        this._core(batch);
        this._pipes(batch);
        for (let k = 1; k < 12; k++) {
            if (k % 2) this._console(batch, k * SLOT);
            else this._boiler(batch, k * SLOT, k === 6 ? 1.35 : 1);
        }
        for (const k of [1.5, 4.5, 7.5, 10.5]) this._piston(batch, k * SLOT);
        for (const k of [0.5, 2.5, 3.5, 5.5, 6.5, 8.5, 9.5, 11.5]) this._wallGears(k * SLOT, k);
        for (let k = 0; k < 4; k++) this._holoTable(batch, (k + 0.5) * (TAU / 4), k);
        this._door(batch);
        this._lights();
        this.scene.add(batch.build(this.mats, { castShadow: false, receiveShadow: false }));
        this._steam();
        this._grid();

        // what the walking controls need to know about this place
        const self = this;
        this.world = {
            ui: env.ui,
            layout: null,
            island: { heightAt: (x, z) => (self.walkable(x, z) ? 1 : -5) },
            walkHeight: () => 0,
            onDeck: () => false,
            collidersNear: (x, z) => self.grid.get(self._key(x, z)) || [],
            onArrive: null,
        };
        this.spawn = { x: 0, z: HALL_R - 5, yaw: 0 };
        // walking into this spot climbs back up the stair
        this.exit = { x: 0, z: WALK_OUT - 0.25 };
    }

    walkable(x, z) {
        const r = Math.hypot(x, z);
        return r > WALK_IN && r < WALK_OUT;
    }

    _key(x, z) {
        return Math.floor(x / 4) * 7919 + Math.floor(z / 4);
    }

    _grid() {
        this.grid = new Map();
        for (const c of this.colliders) {
            for (let i = Math.floor((c.x - c.r) / 4); i <= Math.floor((c.x + c.r) / 4); i++) {
                for (let j = Math.floor((c.z - c.r) / 4); j <= Math.floor((c.z + c.r) / 4); j++) {
                    const k = i * 7919 + j;
                    if (!this.grid.has(k)) this.grid.set(k, []);
                    this.grid.get(k).push(c);
                }
            }
        }
    }

    _gameFor(re) {
        const games = this.env.games;
        return games.find((g) => re.test(g.title)) || games.find((g) => re.test(g.description)) || null;
    }

    _loadSources() {
        for (const f of SOURCES) {
            fetch(new URL(`./${f}`, import.meta.url))
                .then((r) => (r.ok ? r.text() : ''))
                .then((txt) => {
                    if (txt) this.sources.push({ name: `garden/js/${f}`, lines: txt.replace(/\t/g, '    ').split('\n') });
                })
                .catch(() => {});
        }
    }

    // ------------------------------------------------------------ building

    _shell(batch) {
        const s = this.scene, m = this.mats;
        // grated floor ring with a hazard stripe at the shaft's edge
        const floor = new THREE.Mesh(new THREE.RingGeometry(PIT_R, HALL_R + 0.5, 96, 1).rotateX(-Math.PI / 2), m.grate);
        s.add(floor);
        const stripe = new THREE.Mesh(this._ringStrip(PIT_R, PIT_R + 0.7, 0.01), m.stripe);
        s.add(stripe);
        // walls, ceiling and the shaft
        s.add(new THREE.Mesh(new THREE.CylinderGeometry(HALL_R + 0.5, HALL_R + 0.5, CEIL + 1, 72, 1, true).translate(0, CEIL / 2, 0), Object.assign(m.brick, { side: THREE.BackSide })));
        s.add(new THREE.Mesh(new THREE.CircleGeometry(HALL_R + 0.6, 72).rotateX(Math.PI / 2).translate(0, CEIL, 0), m.ceiling));
        s.add(new THREE.Mesh(new THREE.CylinderGeometry(PIT_R, PIT_R, 80, 48, 1, true).translate(0, -40, 0), m.pitWall));
        const glow = new THREE.Mesh(new THREE.CircleGeometry(PIT_R, 40).rotateX(-Math.PI / 2).translate(0, -78, 0), new THREE.MeshBasicMaterial({ color: 0xff7a2a, fog: false }));
        s.add(glow);
        batch.add('iron', lathe([[PIT_R - 0.05, -0.5], [PIT_R + 0.25, -0.5], [PIT_R + 0.25, 0.08], [PIT_R - 0.05, 0.08]], 72), xf(0, 0, 0));
        // railing round the shaft
        for (let i = 0; i < 64; i++) {
            const a = (i / 64) * TAU;
            batch.add('iron', new THREE.CylinderGeometry(0.045, 0.06, 1.1, 6), xf(Math.sin(a) * (PIT_R + 0.12), 0.55, Math.cos(a) * (PIT_R + 0.12)));
        }
        for (const y of [0.55, 1.1]) batch.add('brass', new THREE.TorusGeometry(PIT_R + 0.12, y > 1 ? 0.055 : 0.035, 6, 120).rotateX(Math.PI / 2), xf(0, y, 0));
        // buttresses with rivets, and girders across the ceiling to the drive
        for (let k = 0; k < 12; k++) {
            const a = (k + 0.5) * SLOT;
            batch.add('iron', new THREE.BoxGeometry(0.9, CEIL, 0.5), onWall(a, HALL_R - 0.05, CEIL / 2));
            batch.add('iron', new THREE.BoxGeometry(0.3, CEIL, 0.6), onWall(a, HALL_R - 0.4, CEIL / 2));
            for (let y = 1; y < CEIL; y += 1.2) batch.add('brass', new THREE.SphereGeometry(0.06, 5, 4), under(onWall(a, HALL_R - 0.72, y), xf(0, 0, 0)));
        }
        for (let k = 0; k < 16; k++) {
            const a = (k / 16) * TAU;
            const len = HALL_R - 1.8;
            batch.add('iron', new THREE.BoxGeometry(0.35, 0.9, len), xf(Math.sin(a) * (1.8 + len / 2), CEIL - 0.6, Math.cos(a) * (1.8 + len / 2), a));
        }
        for (const r of [8, 16, 24]) batch.add('iron', lathe([[r - 0.2, -0.45], [r + 0.2, -0.45], [r + 0.2, 0.45], [r - 0.2, 0.45]], 64), xf(0, CEIL - 1.0, 0));
        // hanging work lamps
        for (let k = 0; k < 8; k++) {
            const a = (k + 0.25) * (TAU / 8), r = 18;
            const x = Math.sin(a) * r, z = Math.cos(a) * r;
            batch.add('iron', new THREE.CylinderGeometry(0.02, 0.02, 9, 4), xf(x, CEIL - 5.5, z));
            batch.add('iron', new THREE.ConeGeometry(0.6, 0.45, 12, 1, true), xf(x, CEIL - 10.1, z));
            batch.add('lamp', new THREE.SphereGeometry(0.18, 10, 8), xf(x, CEIL - 10.35, z));
        }
    }

    /** A flat ring (as a strip, so a stripe texture runs round it). */
    _ringStrip(r0, r1, y) {
        const n = 96, pos = [], uv = [], idx = [];
        for (let i = 0; i <= n; i++) {
            const a = (i / n) * TAU;
            pos.push(Math.sin(a) * r0, y, Math.cos(a) * r0, Math.sin(a) * r1, y, Math.cos(a) * r1);
            uv.push(i / n, 0, i / n, 1);
            if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
    }

    _gear(R, depth, mat, toothH = 0.5) {
        const teeth = Math.max(7, Math.round(R * 4.3));
        const g = new THREE.ExtrudeGeometry(gearShape(R, teeth, toothH, Math.max(0.3, R * 0.16)), { depth, bevelEnabled: false, curveSegments: 4 });
        g.translate(0, 0, -depth / 2);
        const mesh = new THREE.Mesh(g, mat);
        mesh.userData.teeth = teeth;
        return mesh;
    }

    /** The drive column, the great gears and the glowing heart of the machine. */
    _core(batch) {
        const s = this.scene, m = this.mats;
        // the column turns: give it ribs so you can see it
        const column = new THREE.Group();
        column.add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, CEIL + 80, 24, 1).translate(0, (CEIL - 80) / 2, 0), m.brass));
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * TAU;
            column.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, CEIL + 80, 0.22).translate(Math.sin(a) * 1.55, (CEIL - 80) / 2, Math.cos(a) * 1.55), m.iron));
        }
        s.add(column);
        const drive = 0.18; // the column's turn rate (rad/s)
        this.spinners.push({ obj: column, axis: 'y', speed: drive });
        batch.add('iron', new THREE.CylinderGeometry(3.2, 2.4, 1.6, 24), xf(0, CEIL - 0.8, 0));
        // great gears on the column, pinions hung from the ceiling to mesh with them
        for (const [y, R, mat] of [[3.4, 7.2, m.bronze], [-4, 6.2, m.brass], [-15, 7.6, m.bronze], [-27, 5.8, m.brass]]) {
            const g = this._gear(R, 0.9, mat);
            g.rotation.x = Math.PI / 2;
            const holder = new THREE.Group();
            holder.position.y = y;
            holder.add(g);
            s.add(holder);
            this.spinners.push({ obj: holder, axis: 'y', speed: drive });
            const n = y > 0 ? 3 : 2;
            for (let k = 0; k < n; k++) {
                const a = (k / n) * TAU + y * 0.3;
                const pr = 1.8, d = R + pr + 0.5;
                const p = this._gear(pr, 0.8, m.brass, 0.5);
                p.rotation.x = Math.PI / 2;
                const ph = new THREE.Group();
                ph.position.set(Math.sin(a) * d, y, Math.cos(a) * d);
                ph.add(p);
                s.add(ph);
                this.spinners.push({ obj: ph, axis: 'y', speed: -drive * (g.userData.teeth / p.userData.teeth) });
                if (y > 0) batch.add('iron', new THREE.CylinderGeometry(0.16, 0.16, CEIL - y, 8), xf(ph.position.x, (CEIL + y) / 2, ph.position.z));
                else batch.add('iron', new THREE.BoxGeometry(0.4, 0.4, PIT_R - d + 0.3), xf(Math.sin(a) * (d + PIT_R) / 2, y, Math.cos(a) * (d + PIT_R) / 2, a));
            }
        }
        // the heart: a glowing sphere in turning brass rings
        const heart = new THREE.Group();
        heart.position.y = 12.5;
        heart.add(new THREE.Mesh(new THREE.SphereGeometry(2.3, 32, 20), m.core));
        s.add(heart);
        this.heart = heart;
        for (const [r, tilt, sp] of [[3.4, 0.3, 0.5], [4.1, 1.2, -0.35], [4.8, 2.0, 0.25]]) {
            const ring = new THREE.Group();
            ring.rotation.set(tilt, 0, tilt * 0.6);
            const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 6, 80), m.brass);
            ring.add(t);
            for (let k = 0; k < 4; k++) {
                const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), m.core);
                b.position.set(Math.cos((k / 4) * TAU) * r, Math.sin((k / 4) * TAU) * r, 0);
                ring.add(b);
            }
            const holder = new THREE.Group();
            holder.add(ring);
            heart.add(holder);
            this.spinners.push({ obj: ring, axis: 'z', speed: sp });
            this.spinners.push({ obj: holder, axis: 'y', speed: sp * 0.4 });
        }
        // a ticker of game titles runs round the column
        const band = new Screen('band', 2048, 128, 7);
        band.tex.wrapS = THREE.RepeatWrapping;
        band.tex.repeat.set(2, 1);
        this._drawBand(band);
        const bandMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 1.1, 48, 1, true), band.material);
        bandMesh.position.y = 7.6;
        s.add(bandMesh);
        this.band = band;
        for (const y of [7.0, 8.2]) batch.add('brass', new THREE.TorusGeometry(1.78, 0.07, 6, 48).rotateX(Math.PI / 2), xf(0, y, 0));
    }

    _pipes(batch) {
        const m = this.mats;
        const tube = (curve, r, key, segs = 64) => batch.add(key, new THREE.TubeGeometry(curve, segs, r, 8, false), xf());
        const gap = 0.32; // keep the stair door clear
        for (const [y, r, key, rr] of [[2.4, 0.26, 'redPipe', HALL_R - 0.55], [4.9, 0.34, 'copper', HALL_R - 0.6], [12.5, 0.22, 'brass', HALL_R - 0.5], [18, 0.4, 'greenPipe', HALL_R - 0.7]]) {
            tube(new Arc(rr, y, gap, TAU - gap), r, key, 160);
            for (let a = gap + 0.2; a < TAU - gap; a += 0.42) {
                batch.add('iron', new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.14, 10).rotateX(Math.PI / 2), xf(Math.sin(a) * rr, y, Math.cos(a) * rr, a + Math.PI / 2));
            }
        }
        // risers up the walls between the bays
        const keys = ['copper', 'iron', 'redPipe', 'brass', 'greenPipe'];
        for (let k = 0; k < 12; k++) {
            for (const [off, r] of [[-0.16, 0.18], [0.17, 0.26]]) {
                const a = k * SLOT + off;
                if (k === 0) continue;
                const key = keys[(k * 2 + (off > 0 ? 1 : 0)) % keys.length];
                const x = Math.sin(a) * (HALL_R - 0.45), z = Math.cos(a) * (HALL_R - 0.45);
                batch.add(key, new THREE.CylinderGeometry(r, r, CEIL, 10), xf(x, CEIL / 2, z));
                for (let y = 1.2; y < CEIL; y += 2.6) batch.add('iron', new THREE.CylinderGeometry(r * 1.4, r * 1.4, 0.12, 10), xf(x, y, z));
            }
        }
        // pipes sagging across the ceiling into the drive housing
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * TAU + 0.2;
            const p = (r, y) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
            const curve = new THREE.CatmullRomCurve3([p(HALL_R - 0.6, CEIL - 3), p(HALL_R - 4, CEIL - 3.4), p(16, CEIL - 5.5 - (k % 3)), p(6, CEIL - 3.8), p(2.8, CEIL - 1.6)]);
            tube(curve, k % 2 ? 0.22 : 0.3, k % 2 ? 'copper' : 'iron', 48);
        }
        // pipes running down the shaft
        for (let k = 0; k < 6; k++) {
            const a = (k / 6) * TAU + 0.5;
            batch.add(keys[k % keys.length], new THREE.CylinderGeometry(0.28, 0.28, 80, 8), xf(Math.sin(a) * (PIT_R - 0.4), -40, Math.cos(a) * (PIT_R - 0.4)));
        }
        // valve wheels on the low ring
        for (let k = 0; k < 6; k++) {
            const a = (k + 0.5) * (TAU / 6) + 0.2;
            const wheel = new THREE.Group();
            wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 20), m.redPipe));
            for (let s = 0; s < 3; s++) wheel.add(new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.05, 0.05).rotateZ((s / 3) * Math.PI), m.iron));
            const holder = new THREE.Group();
            holder.position.set(Math.sin(a) * (HALL_R - 1.15), 2.4, Math.cos(a) * (HALL_R - 1.15));
            holder.rotation.y = a + Math.PI;
            holder.add(wheel);
            this.scene.add(holder);
            this.spinners.push({ obj: wheel, axis: 'z', speed: 0.25 * (k % 2 ? 1 : -1), wobble: true });
            this.emitters.push({ x: Math.sin(a) * (HALL_R - 0.9), y: 2.7, z: Math.cos(a) * (HALL_R - 0.9), dir: [-Math.sin(a) * 0.6, 0.6, -Math.cos(a) * 0.6], speed: 1.6, n: 26, size: 0.55, life: 2.2, period: 6 + k });
        }
    }

    _monitor(batch, base, x, y, z, ry, w, h, kind, seed, cw, ch) {
        const local = under(base, xf(x, y, z, ry));
        batch.add('iron', new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.12), under(local, xf(0, 0, -0.07)));
        batch.add('brass', new THREE.BoxGeometry(w + 0.2, 0.04, 0.14), under(local, xf(0, -h / 2 - 0.1, -0.06)));
        const scr = new Screen(kind, cw, ch, seed);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), scr.material);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(local);
        this.scene.add(mesh);
        this.screens.push(scr);
        return scr;
    }

    /** A desk of three monitors against the wall, with a big screen above it. */
    _console(batch, a) {
        const k = Math.round(a / SLOT);
        const r = HALL_R - 3.3;
        const base = xf(Math.sin(a) * r, 0, Math.cos(a) * r, a + Math.PI);
        batch.add('iron', new THREE.BoxGeometry(3.8, 0.9, 1.0), under(base, xf(0, 0.45, 0)));
        batch.add('darkWood', new THREE.BoxGeometry(3.9, 0.08, 1.1), under(base, xf(0, 0.94, 0.02, 0, 1, 1, 1, 0.18)));
        batch.add('brass', new THREE.BoxGeometry(3.9, 0.05, 0.05), under(base, xf(0, 0.92, 0.58)));
        const order = [['code', 'game', 'model'], ['log', 'scope', 'map'], ['model', 'code', 'game']];
        const set = order[k % 3];
        const side = ['scope', 'log', 'code', 'map', 'log', 'scope'][k % 6];
        this._monitor(batch, base, 0, 1.85, -0.25, 0, 1.75, 1.08, set[0], k * 3, 512, 316);
        this._monitor(batch, base, -1.55, 1.62, -0.05, 0.45, 1.15, 0.72, set[1], k * 3 + 1, 352, 220);
        this._monitor(batch, base, 1.55, 1.62, -0.05, -0.45, 1.15, 0.72, side, k * 3 + 2, 352, 220);
        batch.add('iron', new THREE.BoxGeometry(0.14, 1.4, 0.14), under(base, xf(0, 1.0, -0.38)));
        // the big wall screen above
        const big = ['game', 'code', 'model', 'map', 'game', 'library'][Math.floor(k / 2) % 6];
        const wb = onWall(a, HALL_R - 0.9, 9.6);
        this._monitor(batch, wb, 0, 0, 0, 0, 6.4, 3.6, big, 100 + k, 768, 432);
        for (const sx of [-2.4, 2.4]) batch.add('iron', new THREE.BoxGeometry(0.12, 0.12, 0.9), under(wb, xf(sx, 1.95, -0.4)));
        for (const sx of [-1, 1]) this.colliders.push({ x: Math.sin(a) * r + Math.cos(a) * sx * 1.1, z: Math.cos(a) * r - Math.sin(a) * sx * 1.1, r: 1.0 });
    }

    _boiler(batch, a, s) {
        const m = this.mats;
        const r = HALL_R - 4.4 * s;
        const R = 2.2 * s, H = 6.2 * s;
        const x = Math.sin(a) * r, z = Math.cos(a) * r;
        const base = xf(x, 0, z, a + Math.PI);
        batch.add('granite', new THREE.CylinderGeometry(R + 0.35, R + 0.45, 0.4, 28), under(base, xf(0, 0.2, 0)));
        batch.add('copper', new THREE.CylinderGeometry(R, R, H, 32, 1, true), under(base, xf(0, 0.4 + H / 2, 0)));
        batch.add('copper', lathe([[R, 0], [R * 0.92, R * 0.35], [R * 0.6, R * 0.62], [0.4, R * 0.75], [0, R * 0.76]], 32), under(base, xf(0, 0.4 + H, 0)));
        for (const y of [0.9, H * 0.5, H - 0.4]) batch.add('brass', new THREE.TorusGeometry(R + 0.03, 0.07, 6, 40).rotateX(Math.PI / 2), under(base, xf(0, 0.4 + y, 0)));
        // furnace door with the fire behind it
        batch.add('iron', new THREE.BoxGeometry(1.5 * s, 1.1 * s, 0.3), under(base, xf(0, 1.1 * s, R - 0.05)));
        batch.add('furnace', new THREE.PlaneGeometry(1.1 * s, 0.7 * s), under(base, xf(0, 1.1 * s, R + 0.11)));
        for (let i = -2; i <= 2; i++) batch.add('iron', new THREE.BoxGeometry(0.05, 0.7 * s, 0.05), under(base, xf(i * 0.2 * s, 1.1 * s, R + 0.13)));
        // pressure gauge with a live needle
        const g = under(base, xf(0, 3.2 * s, R + 0.02));
        batch.add('brass', new THREE.TorusGeometry(0.38, 0.06, 6, 24), g);
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), new THREE.MeshStandardMaterial({ map: gaugeTexture('PSI'), roughness: 0.6 }));
        face.matrixAutoUpdate = false;
        face.matrix.copy(under(g, xf(0, 0, 0.01)));
        this.scene.add(face);
        const needle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.01).translate(0, 0.12, 0), m.iron);
        const nh = new THREE.Group();
        nh.matrixAutoUpdate = false;
        nh.matrix.copy(under(g, xf(0, 0, 0.03)));
        nh.add(needle);
        this.scene.add(nh);
        this.needles.push({ needle, seed: a * 7 });
        // flue up to the high ring, and a safety valve that vents
        const top = 0.4 + H + R * 0.76;
        batch.add('iron', new THREE.CylinderGeometry(0.3, 0.3, 18 - top + 0.5, 10), under(base, xf(0, (18 + top) / 2, 0)));
        batch.add('brass', new THREE.CylinderGeometry(0.12, 0.16, 0.6, 8), under(base, xf(0.9 * s, top - 0.2, 0)));
        const vx = x - Math.cos(a) * 0.9 * s, vz = z + Math.sin(a) * 0.9 * s;
        this.emitters.push({ x: vx, y: top + 0.1, z: vz, dir: [0, 1, 0], speed: 2.6, n: 70, size: 0.9, life: 3.2, period: 7 + (a % 3) });
        this.flickers.push({ x: x - Math.sin(a) * (R + 1.2), z: z - Math.cos(a) * (R + 1.2), seed: a });
        this.colliders.push({ x, z, r: R + 0.5 });
    }

    /** A steam engine: a cylinder driving a flywheel on the wall through a connecting rod. */
    _piston(batch, a) {
        const m = this.mats;
        const r = HALL_R - 2.0;
        const base = xf(Math.sin(a) * r, 0, Math.cos(a) * r, a + Math.PI);
        batch.add('granite', new THREE.BoxGeometry(1.6, 0.5, 1.6), under(base, xf(0, 0.25, 0)));
        batch.add('iron', new THREE.CylinderGeometry(0.55, 0.6, 2.4, 20), under(base, xf(0, 1.7, 0)));
        batch.add('brass', new THREE.CylinderGeometry(0.62, 0.62, 0.14, 20), under(base, xf(0, 2.9, 0)));
        const g = new THREE.Group();
        g.matrixAutoUpdate = false;
        g.matrix.copy(base);
        this.scene.add(g);
        const crank = 0.9, rodLen = 3.2, cy = 7.6;
        const wheel = new THREE.Group();
        wheel.position.set(0, cy, -0.6);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.16, 8, 40), m.iron);
        wheel.add(rim);
        for (let s = 0; s < 6; s++) wheel.add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.08).rotateZ((s / 6) * Math.PI), m.iron));
        wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 12).rotateX(Math.PI / 2), m.brass));
        g.add(wheel);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 8), m.brass);
        const conrod = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1, 0.12), m.iron);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), m.brass);
        g.add(rod, conrod, head);
        batch.add('iron', new THREE.BoxGeometry(0.3, cy + 0.5, 0.3), under(base, xf(0, (cy + 0.5) / 2, -0.95)));
        this.pistons.push({ wheel, rod, conrod, head, crank, rodLen, cy, speed: 1.6 + (a % 1) * 0.6, phase: a * 3 });
        this.emitters.push({ x: Math.sin(a) * (r - 0.7), y: 2.6, z: Math.cos(a) * (r - 0.7), dir: [-Math.sin(a), 0.3, -Math.cos(a)], speed: 1.8, n: 24, size: 0.5, life: 1.6, period: 1.6 * Math.PI * 2 / (1.6 + (a % 1) * 0.6) });
        this.colliders.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, r: 1.15 });
    }

    /** A train of gears high on the wall, meshing as they turn. */
    _wallGears(a, seed) {
        const m = this.mats;
        const r = rng(Math.floor(seed * 10));
        const base = onWall(a, HALL_R - 1.1, 0);
        let R = 1.8 + r() * 1.4;
        let x = 0, y = 15 + r() * 3, speed = 0.3 * (r() < 0.5 ? 1 : -1), teeth = 0;
        const n = 2 + Math.floor(r() * 2);
        const heading = r() < 0.5 ? 0 : Math.PI;
        for (let i = 0; i < n; i++) {
            const g = this._gear(R, 0.45, i % 2 ? m.brass : m.bronze, 0.38);
            if (i > 0) speed = -speed * (teeth / g.userData.teeth);
            teeth = g.userData.teeth;
            const holder = new THREE.Group();
            holder.matrixAutoUpdate = false;
            holder.matrix.copy(under(base, xf(x, y, -i * 0.05)));
            holder.add(g);
            holder.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.2, 0.7, 12).rotateX(Math.PI / 2), m.iron));
            this.scene.add(holder);
            this.spinners.push({ obj: g, axis: 'z', speed });
            // the next gear meshes beside this one
            const R2 = 1.0 + r() * 1.6;
            const ang = heading + (r() - 0.5) * 1.3;
            const d = R + R2 + 0.38;
            x += Math.cos(ang) * d;
            y = clamp(y + Math.sin(ang) * d, 13 + R2, CEIL - 3 - R2);
            R = R2;
        }
    }

    /** A projector table throwing a turning wireframe model into the air. */
    _holoTable(batch, a, k) {
        const m = this.mats;
        const r = 14;
        const x = Math.sin(a) * r, z = Math.cos(a) * r;
        batch.add('iron', lathe([[0, 0], [0.8, 0], [0.8, 0.1], [0.45, 0.25], [0.35, 0.8], [0.7, 0.95], [0.7, 1.05], [0, 1.05]], 20), xf(x, 0, z));
        batch.add('brass', new THREE.TorusGeometry(0.7, 0.05, 6, 24).rotateX(Math.PI / 2), xf(x, 1.05, z));
        batch.add('lens', new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16), xf(x, 1.07, z));
        const beamMat = new THREE.ShaderMaterial({
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: 'varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * 0.18; gl_FragColor = vec4(vec3(0.5, 1.0, 1.0) * a, 1.0); }',
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        });
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.22, 1.5, 24, 1, true), beamMat);
        beam.position.set(x, 1.85, z);
        this.scene.add(beam);
        const model = this.models[[0, 2, 3, 1][k]];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(model.edges, 3));
        const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9ffcff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        lines.scale.setScalar(0.75 / model.radius);
        const holder = new THREE.Group();
        holder.position.set(x, 2.35, z);
        holder.add(lines);
        this.scene.add(holder);
        this.holos.push({ holder, lines, phase: k * 1.7 });
        // a label on the rim, facing out
        const label = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.32), new THREE.MeshBasicMaterial({ map: signTex(model.name, model.game ? model.game.title : 'The Garden'), color: new THREE.Color(1.1, 1.1, 1.1) }));
        label.position.set(x + Math.sin(a) * 0.82, 0.75, z + Math.cos(a) * 0.82);
        label.rotation.y = a;
        label.rotation.x = -0.25;
        this.scene.add(label);
        this.colliders.push({ x, z, r: 1.0 });
    }

    /** The stair door back up to the clock tower, with the welcome board above it. */
    _door(batch) {
        const m = this.mats;
        const z = HALL_R - 0.35;
        const frameShape = new THREE.Shape();
        const outer = (w, h, s) => {
            s.moveTo(-w, 0);
            s.lineTo(w, 0);
            s.lineTo(w, h - w);
            s.absarc(0, h - w, w, 0, Math.PI, false);
            s.lineTo(-w, 0);
            return s;
        };
        outer(1.7, 4.0, frameShape);
        frameShape.holes.push(new THREE.Path(outer(1.25, 3.5, new THREE.Shape()).getPoints(16)));
        batch.add('brass', new THREE.ExtrudeGeometry(frameShape, { depth: 0.35, bevelEnabled: false, curveSegments: 16 }), xf(0, 0, z - 0.2, Math.PI));
        // warm light from the stairwell
        const glowMat = new THREE.ShaderMaterial({
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: 'varying vec2 vUv; void main(){ vec3 c = mix(vec3(1.6, 0.95, 0.45), vec3(0.35, 0.18, 0.08), vUv.y); float steps = step(0.5, fract(vUv.y * 7.0)) * 0.25 * (1.0 - vUv.y); gl_FragColor = vec4(c * (1.0 - steps), 1.0); #include <colorspace_fragment> }',
        });
        const glow = new THREE.Mesh(new THREE.ShapeGeometry(outer(1.25, 3.5, new THREE.Shape()), 16), glowMat);
        glow.position.set(0, 0, z - 0.1);
        glow.rotation.y = Math.PI;
        glow.userData.kind = 'door';
        this.scene.add(glow);
        this.doorMesh = glow;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: signTex('▲ Clock Tower', 'Back up to the garden'), color: new THREE.Color(1.2, 1.2, 1.2) }));
        sign.position.set(0, 4.5, z - 0.3);
        sign.rotation.y = Math.PI;
        this.scene.add(sign);
        const board = onWall(0, HALL_R - 0.9, 8.8);
        this._monitor(batch, board, 0, 0, 0, 0, 9.0, 3.4, 'library', 77, 1024, 388);
        batch.add('lamp', new THREE.SphereGeometry(0.15, 10, 8), xf(-1.9, 3.2, z - 0.6));
        batch.add('lamp', new THREE.SphereGeometry(0.15, 10, 8), xf(1.9, 3.2, z - 0.6));
    }

    _lights() {
        const s = this.scene;
        s.add(new THREE.HemisphereLight(0xc0c8d8, 0x4a2c18, 1.1));
        this.heartLight = new THREE.PointLight(0xffc870, 260, 60, 1.6);
        this.heartLight.position.set(0, 12.5, 0);
        this.pitLight = new THREE.PointLight(0xff7a2a, 500, 70, 1.6);
        this.pitLight.position.set(0, -14, 0);
        s.add(this.heartLight, this.pitLight);
        // the furnaces light the floor in front of them (all but the big one at the back)
        this.fireLights = [];
        for (const f of this.flickers.filter((_, i) => i !== 2)) {
            const l = new THREE.PointLight(0xff8030, 40, 14, 1.8);
            l.position.set(f.x, 1.3, f.z);
            l.userData.seed = f.seed;
            s.add(l);
            this.fireLights.push(l);
        }
        const door = new THREE.PointLight(0xffb060, 30, 12, 1.8);
        door.position.set(0, 2.4, HALL_R - 2.2);
        s.add(door);
    }

    _steam() {
        const pos = [], dir = [], params = [], emit = [];
        const r = rng('steam');
        // floor vents round the shaft, and a slow column rising out of it
        for (let k = 0; k < 6; k++) {
            const a = (k / 6) * TAU + 0.1;
            this.emitters.push({ x: Math.sin(a) * 12, y: 0.05, z: Math.cos(a) * 12, dir: [0, 1, 0], speed: 1.4, n: 40, size: 0.8, life: 2.6, period: 9 + k * 1.3 });
        }
        for (let k = 0; k < 140; k++) {
            const a = r() * TAU, d = r() * (PIT_R - 2);
            this.emitters.push({ x: Math.sin(a) * d, y: -6 - r() * 6, z: Math.cos(a) * d, dir: [0, 1, 0], speed: 2.0, n: 1, size: 2.4, life: 9, period: 0 });
        }
        for (const e of this.emitters) {
            e.phase = r();
            for (let i = 0; i < e.n; i++) {
                pos.push(e.x + (r() - 0.5) * 0.2, e.y, e.z + (r() - 0.5) * 0.2);
                const s = 0.25;
                dir.push(e.dir[0] + (r() - 0.5) * s, e.dir[1] + (r() - 0.5) * s, e.dir[2] + (r() - 0.5) * s, e.speed * (0.7 + r() * 0.6));
                params.push(e.size * (0.7 + r() * 0.6), r(), e.life * (0.8 + r() * 0.4), e.period);
                emit.push(e.phase);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 4));
        g.setAttribute('aParams', new THREE.Float32BufferAttribute(params, 4));
        g.setAttribute('aEmit', new THREE.Float32BufferAttribute(emit, 1));
        this.steamUniforms = { uTime: { value: 0 }, uScale: { value: 400 }, uMap: { value: glowSprite() } };
        const mat = new THREE.ShaderMaterial({ uniforms: this.steamUniforms, vertexShader: steamVert, fragmentShader: steamFrag, transparent: true, depthWrite: false });
        const pts = new THREE.Points(g, mat);
        pts.frustumCulled = false;
        pts.renderOrder = 5;
        this.scene.add(pts);
        this.bursts = this.emitters.filter((e) => e.period > 0).map((e) => ({ ...e, last: -1 }));
    }

    // -------------------------------------------------------------- screens

    _drawBand(scr) {
        const { ctx, w, h } = scr;
        ctx.fillStyle = '#100804';
        ctx.fillRect(0, 0, w, h);
        ctx.font = `600 54px ${MONO}`;
        ctx.textBaseline = 'middle';
        const games = [...this.env.games].sort(() => scr.r() - 0.5);
        let x = 20;
        for (const g of games) {
            const text = `${g.icon} ${g.title.toUpperCase()}   ◆   `;
            const tw = ctx.measureText(text).width;
            if (x + tw > w - 20) break;
            ctx.fillStyle = genreOf(g).accent;
            ctx.fillText(text, x, h / 2 + 2);
            x += tw;
        }
        scanlines(ctx, w, h);
        scr.tex.needsUpdate = true;
    }

    _draw(scr, t) {
        const { ctx, w, h, theme } = scr;
        const st = scr.state;
        const env = this.env;
        ctx.save();
        if (scr.kind === 'code') {
            if (!st.src || st.left <= 0) {
                if (this.sources.length) {
                    st.src = this.sources[Math.floor(scr.r() * this.sources.length)];
                    st.line = Math.floor(scr.r() * Math.max(1, st.src.lines.length - 40));
                    st.left = 80 + Math.floor(scr.r() * 120);
                } else Object.assign(st, { src: { name: 'garden/js/works.js', lines: ['// fetching the garden’s source…'] }, line: 0, left: 0 });
            }
            const lh = Math.max(13, Math.floor(h / 22));
            const rows = Math.floor((h - 26) / lh);
            const step = t - (st.lastStep || 0);
            if (step > 0.18) {
                st.lastStep = t;
                st.line = (st.line + 1) % st.src.lines.length;
                st.left--;
            }
            ctx.fillStyle = theme.bg;
            ctx.fillRect(0, 0, w, h);
            header(ctx, w, st.src.name, theme, `${st.line + 1}/${st.src.lines.length}`);
            ctx.font = `${lh - 3}px ${MONO}`;
            ctx.textBaseline = 'top';
            const cw = ctx.measureText('M').width;
            const gutter = cw * 5;
            for (let i = 0; i < rows; i++) {
                const n = (st.line + i) % st.src.lines.length;
                const y = 26 + i * lh;
                ctx.fillStyle = theme.dim;
                ctx.fillText(String(n + 1).padStart(4, ' '), 4, y);
                this._codeLine(ctx, st.src.lines[n], gutter + 8, y, cw, theme, w);
            }
            if (Math.floor(t * 2) % 2) {
                ctx.fillStyle = theme.fg;
                ctx.fillRect(gutter + 8, 26 + (rows - 1) * lh, cw, lh - 3);
            }
        } else if (scr.kind === 'game') {
            if (!st.game || t > st.until) {
                st.game = env.games[Math.floor(scr.r() * env.games.length)];
                st.until = t + 7 + scr.r() * 4;
                st.t0 = t;
            }
            drawGameArt(ctx, w, h, st.game, t - st.t0);
            const g = st.game;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, w, 20);
            ctx.fillRect(0, h - 30, w, 30);
            ctx.fillStyle = '#ffffff';
            ctx.font = `600 12px ${MONO}`;
            ctx.textBaseline = 'middle';
            ctx.fillText(`▶ ${g.id.toUpperCase()}  v${g.version}`, 8, 10);
            ctx.textAlign = 'right';
            ctx.fillStyle = genreOf(g).accent;
            ctx.fillText(genreOf(g).short.toUpperCase(), w - 8, 10);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            ctx.font = `700 ${Math.round(h * 0.06)}px Georgia, serif`;
            ctx.fillText(`${g.icon} ${g.title}`, 10, h - 15, w - 20);
        } else if (scr.kind === 'model') {
            if (st.m === undefined || t > st.until) {
                st.m = Math.floor(scr.r() * this.models.length);
                st.until = t + 9 + scr.r() * 5;
            }
            const model = this.models[st.m];
            ctx.fillStyle = '#020a10';
            ctx.fillRect(0, 0, w, h);
            const cx = w / 2, cy = h * 0.52, sc = (h * 0.34) / model.radius;
            const ry = t * 0.7 + scr.r.range ? t * 0.7 : 0, rx = 0.35;
            const cyR = Math.cos(ry), syR = Math.sin(ry), cxR = Math.cos(rx), sxR = Math.sin(rx);
            const proj = (x, y, z) => {
                const x1 = x * cyR + z * syR, z1 = -x * syR + z * cyR;
                const y2 = y * cxR - z1 * sxR, z2 = y * sxR + z1 * cxR;
                const p = 3.2 / (3.2 + z2 / model.radius);
                return [cx + x1 * sc * p, cy - y2 * sc * p];
            };
            // turntable grid
            ctx.strokeStyle = 'rgba(80,200,255,0.18)';
            ctx.lineWidth = 1;
            const gy = -model.radius;
            for (let i = -4; i <= 4; i++) {
                const k = (i / 4) * model.radius * 1.4;
                const L = model.radius * 1.4;
                let [ax, ay] = proj(k, gy, -L), [bx, by] = proj(k, gy, L);
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(bx, by);
                [ax, ay] = proj(-L, gy, k);
                [bx, by] = proj(L, gy, k);
                ctx.moveTo(ax, ay);
                ctx.lineTo(bx, by);
                ctx.stroke();
            }
            const e = model.edges;
            for (const [width, col] of [[4, 'rgba(60,220,255,0.18)'], [1.2, '#a8f6ff']]) {
                ctx.strokeStyle = col;
                ctx.lineWidth = width;
                ctx.beginPath();
                for (let i = 0; i < e.length; i += 6) {
                    const [ax, ay] = proj(e[i], e[i + 1], e[i + 2]);
                    const [bx, by] = proj(e[i + 3], e[i + 4], e[i + 5]);
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(bx, by);
                }
                ctx.stroke();
            }
            const blue = { ...THEMES[2], fg: '#a8f6ff', bar: '#06202c', dim: '#4a90a8' };
            header(ctx, w, `MODEL VIEWER — ${model.name.toUpperCase()}`, blue, `${e.length / 6} edges`);
            ctx.fillStyle = '#7fd8f0';
            ctx.font = `12px ${MONO}`;
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(model.game ? `from ${model.game.title} (${model.game.id})` : 'from the garden', 8, h - 10, w - 16);
            ctx.strokeStyle = '#7fd8f0';
            ctx.lineWidth = 2;
            for (const [x, y, dx, dy] of [[10, 32, 1, 1], [w - 10, 32, -1, 1], [10, h - 26, 1, -1], [w - 10, h - 26, -1, -1]]) {
                ctx.beginPath();
                ctx.moveTo(x, y + dy * 14);
                ctx.lineTo(x, y);
                ctx.lineTo(x + dx * 14, y);
                ctx.stroke();
            }
        } else if (scr.kind === 'log') {
            st.lines ??= [];
            if (!st.last || t - st.last > 0.5) {
                st.last = t;
                st.lines.push(this._logLine(scr.r));
                if (st.lines.length > 40) st.lines.shift();
            }
            const amber = THEMES[1];
            ctx.fillStyle = amber.bg;
            ctx.fillRect(0, 0, w, h);
            header(ctx, w, 'works.log', amber, 'tail -f');
            const lh = 14;
            ctx.font = `11px ${MONO}`;
            ctx.textBaseline = 'top';
            const rows = Math.floor((h - 26) / lh);
            st.lines.slice(-rows).forEach((l, i) => {
                ctx.fillStyle = l.warn ? '#ff8060' : i === rows - 1 ? amber.kw : amber.fg;
                ctx.fillText(l.text, 6, 26 + i * lh, w - 12);
            });
        } else if (scr.kind === 'scope') {
            const green = THEMES[0];
            ctx.fillStyle = green.bg;
            ctx.fillRect(0, 0, w, h);
            header(ctx, w, 'DRIVE TELEMETRY', green, env.sky ? `GARDEN ${env.sky.clockText()}` : '');
            const top = 28, ph = (h - top) * 0.55;
            ctx.strokeStyle = 'rgba(125,255,155,0.15)';
            ctx.lineWidth = 1;
            for (let x = 0; x < w; x += 22) {
                ctx.beginPath();
                ctx.moveTo(x, top);
                ctx.lineTo(x, top + ph);
                ctx.stroke();
            }
            for (const [col, f, amp, off] of [['#7dff9b', 2.0, 0.35, 0], ['#ffe08a', 3.3, 0.2, 1.4], ['#9fe8ff', 0.7, 0.28, 2.2]]) {
                ctx.strokeStyle = col;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let x = 0; x <= w; x += 3) {
                    const u = x / w;
                    const v = Math.sin(u * TAU * f + t * (2 + f) + off) * amp + Math.sin(u * TAU * f * 3.1 - t * 1.3) * amp * 0.25;
                    const y = top + ph / 2 + v * ph;
                    x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
            const bars = [['BOILER PSI', 0.62 + 0.2 * Math.sin(t * 0.9 + scr.r.range(0, 0) )], ['DRIVE RPM', 0.5 + 0.08 * Math.sin(t * 2.3)], ['STEAM', 0.45 + 0.35 * Math.abs(Math.sin(t * 0.4))], ['VINE SAP', 0.7 + 0.1 * Math.sin(t * 0.2)]];
            ctx.font = `11px ${MONO}`;
            ctx.textBaseline = 'middle';
            const by = top + ph + 8, bh = (h - by - 4) / bars.length;
            bars.forEach(([label, v], i) => {
                const y = by + i * bh;
                ctx.fillStyle = green.dim;
                ctx.fillText(label, 6, y + bh / 2);
                ctx.fillStyle = 'rgba(125,255,155,0.15)';
                ctx.fillRect(w * 0.36, y + 3, w * 0.5, bh - 6);
                ctx.fillStyle = v > 0.78 ? '#ff8060' : green.fg;
                ctx.fillRect(w * 0.36, y + 3, w * 0.5 * clamp(v, 0, 1), bh - 6);
                ctx.fillStyle = green.fg;
                ctx.fillText(String(Math.round(v * 100)).padStart(3, ' '), w * 0.88, y + bh / 2);
            });
        } else if (scr.kind === 'map') {
            this.mapImage ??= this._mapImage();
            ctx.fillStyle = '#020c0a';
            ctx.fillRect(0, 0, w, h);
            const s = h - 30;
            const ox = 8, oy = 26;
            ctx.globalAlpha = 0.9;
            ctx.drawImage(this.mapImage.canvas, ox, oy, s, s);
            ctx.globalAlpha = 1;
            const cx = ox + s / 2, cy = oy + s / 2;
            const sweep = (t * 1.2) % TAU;
            const grad = ctx.createConicGradient ? ctx.createConicGradient(sweep, cx, cy) : null;
            if (grad) {
                grad.addColorStop(0, 'rgba(120,255,200,0.35)');
                grad.addColorStop(0.08, 'rgba(120,255,200,0)');
                grad.addColorStop(1, 'rgba(120,255,200,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, s / 2, 0, TAU);
                ctx.fill();
            }
            const [tx, ty] = this.mapImage.toPx(this.mapImage.tower.x, this.mapImage.tower.z, s);
            if (Math.floor(t * 3) % 2) {
                ctx.fillStyle = '#ffd060';
                ctx.beginPath();
                ctx.arc(ox + tx, oy + ty, 4, 0, TAU);
                ctx.fill();
            }
            const green = { ...THEMES[0], fg: '#9fffd0' };
            header(ctx, w, 'ISLAND SURVEY', green, `${env.games.length} STATUES`);
            ctx.fillStyle = '#9fffd0';
            ctx.font = `11px ${MONO}`;
            ctx.textBaseline = 'top';
            const tx0 = ox + s + 10;
            const info = [
                'YOU ARE HERE:',
                ' THE WORKS',
                ' (under the tower)',
                '',
                `TIME  ${env.sky ? env.sky.clockText() : '--:--'}`,
                `PATHS ${env.layout.spokes.length}`,
                `TIDE  ${(Math.sin(t * 0.05) * 0.6).toFixed(2)} m`,
                `WIND  ${(3 + Math.sin(t * 0.3) * 1.5).toFixed(1)} kn`,
            ];
            info.forEach((l, i) => ctx.fillText(l, tx0, 32 + i * 15, w - tx0 - 4));
        } else if (scr.kind === 'library') {
            ctx.fillStyle = '#0e0905';
            ctx.fillRect(0, 0, w, h);
            const games = env.games;
            const cols = 13, rows = Math.ceil(games.length / cols);
            const gw = w * 0.62, cs = Math.min(gw / cols, (h - 40) / rows);
            const sel = Math.floor(t / 2.2) % games.length;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `${Math.floor(cs * 0.62)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
            games.forEach((g, i) => {
                const x = 14 + (i % cols) * cs + cs / 2, y = 36 + Math.floor(i / cols) * cs + cs / 2;
                if (i === sel) {
                    ctx.fillStyle = genreOf(g).accent;
                    ctx.fillRect(x - cs / 2 + 1, y - cs / 2 + 1, cs - 2, cs - 2);
                }
                ctx.fillText(g.icon, x, y + 1);
            });
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffd98a';
            ctx.font = `700 22px "Cinzel", Georgia, serif`;
            ctx.fillText(`THE WORKS — ${games.length} GAMES ON THE ISLAND`, 14, 18);
            const g = games[sel];
            const px = 14 + cols * cs + 20, pw = w - px - 14;
            ctx.fillStyle = genreOf(g).accent;
            ctx.font = `700 26px Georgia, serif`;
            ctx.fillText(`${g.icon} ${g.title}`, px, 60, pw);
            ctx.fillStyle = '#d9c08a';
            ctx.font = `13px ${MONO}`;
            ctx.fillText(`${g.id} · v${g.version} · ${genreOf(g).short}`, px, 90, pw);
            ctx.fillStyle = '#efe2c2';
            ctx.font = `15px Georgia, serif`;
            ctx.textBaseline = 'top';
            wrap(ctx, g.description, pw).slice(0, 13).forEach((l, i) => ctx.fillText(l, px, 108 + i * 20));
        }
        scanlines(ctx, w, h);
        ctx.restore();
        scr.tex.needsUpdate = true;
    }

    _codeLine(ctx, line, x, y, cw, theme, maxW) {
        const re = /(\/\/.*$|\/\*.*?\*\/|^\s*\*.*$)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+|.)/g;
        let m;
        while ((m = re.exec(line)) && x < maxW) {
            const tok = m[0];
            ctx.fillStyle = m[1] ? theme.com : m[2] ? theme.str : m[3] ? theme.num : m[4] && KEYWORDS.has(tok) ? theme.kw : theme.fg;
            if (!m[5] || tok.trim()) ctx.fillText(tok, x, y);
            x += tok.length * cw;
        }
    }

    _logLine(r) {
        const env = this.env;
        const clock = env.sky ? env.sky.clockText() : '--:--';
        const g = env.games[Math.floor(r() * env.games.length)];
        const n = Math.floor(r() * 64);
        const items = [
            () => `statue '${g.title}': plaque polished`,
            () => `statue ${g.id}: hover glow nominal`,
            () => `drive shaft ${(1.7 + r() * 0.05).toFixed(2)} rpm`,
            () => `boiler ${1 + (n % 6)}: ${(80 + r() * 40).toFixed(0)} psi`,
            () => `valve ${n} vented`,
            () => `vines: ${1 + (n % 5)} woke along the ${genreOf(g).short} path`,
            () => `lamp ${n} trimmed`,
            () => `clock tower: hands synced to ${clock}`,
            () => `fountain pump ok`,
            () => `fox sightings: ${n % 7 ? 0 : 1}`,
            () => `loaded ${g.folder}/index.html`,
            () => `tide ${(r() * 1.2 - 0.6).toFixed(2)} m`,
        ];
        const warn = r() < 0.06;
        return { text: `[${clock}] ${warn ? 'WARN pressure spike, venting' : r.pick(items)()}`, warn };
    }

    _mapImage() {
        const { island, layout, statues } = this.env;
        const n = 160;
        const c = canvas(n), ctx = c.getContext('2d');
        let R = 0;
        for (const sp of layout.spokes) R = Math.max(R, Math.hypot(sp.pavilion.x, sp.pavilion.z) + 22);
        R = Math.max(R, Math.hypot(layout.islet.x, layout.islet.z) + 14);
        const img = ctx.createImageData(n, n);
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
            const x = -R + ((i + 0.5) / n) * 2 * R, z = -R + ((j + 0.5) / n) * 2 * R;
            const h = island.heightAt(x, z);
            const k = (j * n + i) * 4;
            if (h < 0) {
                img.data[k] = 4; img.data[k + 1] = 30; img.data[k + 2] = 34;
            } else {
                const p = island.pathDistAt(x, z) < 1.8;
                img.data[k] = p ? 200 : 20 + h * 6;
                img.data[k + 1] = p ? 255 : 90 + h * 14;
                img.data[k + 2] = p ? 220 : 60 + h * 8;
            }
            img.data[k + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        const toPx = (x, z, s = n) => [((x + R) / (2 * R)) * s, ((z + R) / (2 * R)) * s];
        ctx.fillStyle = '#ffffff';
        for (const st of statues) {
            const [x, y] = toPx(st.x, st.z);
            ctx.fillRect(x - 0.5, y - 0.5, 1.5, 1.5);
        }
        return { canvas: c, toPx, tower: layout.islet };
    }

    // ---------------------------------------------------------------- frame

    /** One frame below ground. Returns the steam bursts that just started near the player. */
    update(dt, t, pos, viewportH) {
        this.time = t;
        for (const s of this.spinners) {
            const v = s.wobble ? s.speed * Math.max(0, Math.sin(t * 0.4 + s.speed * 9)) : s.speed;
            s.obj.rotation[s.axis] += v * dt;
        }
        for (const p of this.pistons) {
            const th = t * p.speed + p.phase;
            p.wheel.rotation.z = th;
            const px = Math.cos(th) * p.crank, py = p.cy + Math.sin(th) * p.crank;
            const hy = py - Math.sqrt(p.rodLen * p.rodLen - px * px);
            p.head.position.set(0, hy, 0);
            // piston rod from the cylinder up to the crosshead
            const ry0 = 2.9;
            p.rod.position.set(0, (ry0 + hy) / 2, 0);
            p.rod.scale.y = hy - ry0;
            // the connecting rod from crosshead to crank pin
            p.conrod.position.set(px / 2, (hy + py) / 2, -0.3);
            p.conrod.scale.y = p.rodLen;
            p.conrod.rotation.z = -Math.atan2(px, py - hy);
        }
        for (const nd of this.needles) nd.needle.rotation.z = -0.4 - 0.9 * (0.5 + 0.5 * Math.sin(t * 0.7 + nd.seed)) - Math.sin(t * 23 + nd.seed) * 0.03;
        for (const l of this.fireLights) l.intensity = 34 + Math.sin(t * 13 + l.userData.seed) * 5 + Math.sin(t * 7.3 + l.userData.seed * 2) * 6;
        this.mats.furnace.emissiveIntensity = 2.3 + Math.sin(t * 11) * 0.25 + Math.sin(t * 4.3) * 0.2;
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
        this.mats.core.emissiveIntensity = 1.8 + pulse * 0.9;
        this.heartLight.intensity = 220 + pulse * 80;
        for (const h of this.holos) {
            h.lines.rotation.y = t * 0.6 + h.phase;
            h.holder.position.y = 2.35 + Math.sin(t * 1.3 + h.phase) * 0.08;
            h.lines.material.opacity = 0.75 + 0.2 * Math.sin(t * 9 + h.phase);
        }
        this.band.tex.offset.x = (t * 0.02) % 1;
        this.steamUniforms.uTime.value = t;
        this.steamUniforms.uScale.value = viewportH * 0.9;

        // a few screens redraw each frame, taking turns
        let budget = 4;
        for (const s of this.screens) {
            if (budget <= 0) break;
            if (t < s.next) continue;
            this._draw(s, t);
            s.next = t + (s.kind === 'log' ? 0.25 : s.kind === 'library' ? 0.2 : 0.09);
            budget--;
        }
        // rotate the list so every screen gets its turn
        if (budget <= 0) this.screens.push(this.screens.shift());

        const hisses = [];
        for (const b of this.bursts) {
            const c = Math.floor(t / b.period + b.phase);
            if (c !== b.last) {
                if (b.last >= 0) {
                    const d = Math.hypot(pos.x - b.x, pos.z - b.z);
                    if (d < 16) hisses.push(1 - d / 16);
                }
                b.last = c;
            }
        }
        return hisses;
    }
}
