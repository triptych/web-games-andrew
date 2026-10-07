/**
 * terrain.js — the valley for one level: the painted ground, the scenery the map generator placed,
 * the woods (or city blocks) around the edge, the Haven and its growing camp, and the overlay that
 * shows where stations can go.
 *
 * Everything lives in `root`, which sits at (-W/2, 0, -H/2), so children use map (tile) units:
 * tile (x, z) spans x..x+1, z..z+1.
 */

import * as THREE from 'three';
import { W, H, HAVEN_COLS, THEMES } from '../config.js';
import { RNG } from '../rng.js';
import { GRASS, ROAD, idx } from '../sim/mapgen.js';
import { Builder } from './builder.js';
import { toyMat } from './materials.js';

const B = 9;        // border tiles of woods around the map
const PX = 22;      // texture px per tile

const C = {
    trunk: 0x6b4a2e, bark: 0x5a3c24, pine: 0x2f5a3a, pine2: 0x3c6e46, snow: 0xf4f8fc, stone: 0x9a968e, stone2: 0x7f7a72,
    wood: 0x9a6a3e, wood2: 0x7a5232, plank: 0xb98a58, roofRed: 0xa8483a, roofBrown: 0x6e4a36, roofSlate: 0x5a6070,
    cream: 0xefe2c4, white: 0xf4f1ea, window: 0xffd98a, dark: 0x2a2a30, hay: 0xe0bd62, water: 0x5aa0c8, ice: 0xcfe6f2,
    red: 0xc8432e, glass: 0x9fc8e0, lamp: 0xffe7a8, canvas: 0xe8dcc0,
};
const WALLS = [0xefe2c4, 0xd9c7a0, 0xc9d8c2, 0xe6c6b0, 0xd6d0e4, 0xf0d9a8];
const BRICKS = [0x8a4a3a, 0x7a5a4a, 0x6a6a72, 0x8a7a62, 0x5a4a52, 0x9a6a52];
const TENTS = [0xe85d4a, 0x4a8fd8, 0xf2c14e, 0x5ab06a, 0x9a6ad8, 0xf08aa8, 0x3fb3b0, 0xf28c3a, 0xe8e0cc];

// ------------------------------------------------------------------ small models
function tree(b, rng, theme, x, z, s = 1) {
    if (theme === 'winter') {
        b.cyl(0.05 * s, 0.2 * s, C.bark, x, 0, z, { seg: 5 });
        const k = rng.range(0.9, 1.15);
        for (let i = 0; i < 3; i++) {
            const r = (0.36 - i * 0.09) * s * k, y = (0.14 + i * 0.2) * s * k;
            b.cone(r, 0.34 * s * k, i % 2 ? C.pine2 : C.pine, x, y, z, { seg: 7 });
            b.cone(r * 0.72, 0.12 * s * k, C.snow, x, y + 0.2 * s * k, z, { seg: 7 });
        }
        return;
    }
    const h = rng.range(0.28, 0.42) * s;
    b.cyl(0.045 * s, h, C.trunk, x, 0, z, { seg: 5 });
    const pal = theme === 'city' ? [0x4f7a46, 0x5f8a4a, 0x6a9a54] : THEMES.autumn.leaves;
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) {
        b.ico(rng.range(0.17, 0.26) * s, rng.pick(pal), x + rng.range(-0.1, 0.1) * s, h + rng.range(0.08, 0.2) * s, z + rng.range(-0.1, 0.1) * s, { detail: 0 });
    }
}

function house(b, rng, x, z, ry, snowy) {
    const wall = rng.pick(WALLS), roof = snowy ? C.snow : rng.pick([C.roofRed, 0xb86a3a, 0x8a5a9a, 0x4a7a8a, C.roofBrown]);
    const h = new Builder();
    h.box(0.72, 0.46, 0.56, wall, 0, 0, 0);
    h.gable(0.84, 0.3, 0.68, roof, 0, 0.46, 0);
    h.box(0.12, 0.2, 0.02, C.wood2, 0.1, 0, 0.285);
    h.box(0.13, 0.11, 0.02, C.window, -0.18, 0.2, 0.285, { glow: 0.9 });
    h.box(0.02, 0.11, 0.13, C.window, 0.365, 0.2, 0, { glow: 0.9 });
    h.box(0.1, 0.24, 0.1, C.stone2, 0.22, 0.56, -0.12);
    b.merge(h, x, 0, z, ry);
}

function car(b, rng, x, z, ry) {
    const col = rng.pick([0x8a5a4a, 0x5a6a7a, 0x7a7a5a, 0x9a8a6a, 0x4a5a4a, 0xa84a3a]);
    const h = new Builder();
    h.box(0.62, 0.16, 0.32, col, 0, 0.07, 0);
    h.box(0.34, 0.13, 0.28, col, -0.04, 0.23, 0);
    h.box(0.3, 0.1, 0.29, C.glass, -0.04, 0.245, 0);
    for (const [wx, wz] of [[-0.2, -0.16], [0.2, -0.16], [-0.2, 0.16], [0.2, 0.16]]) h.cyl(0.07, 0.05, C.dark, wx, 0.07, wz, { rx: Math.PI / 2, centre: true, seg: 8 });
    b.merge(h, x, 0, z, ry);
}

function lampPost(b, x, z, h = 0.7) {
    b.cyl(0.025, h, C.dark, x, 0, z, { seg: 5 });
    b.box(0.09, 0.11, 0.09, C.lamp, x, h, z, { glow: 1.6 });
    b.box(0.12, 0.02, 0.12, C.dark, x, h + 0.11, z);
}

function scenery(b, rng, it, theme) {
    const cx = it.x + it.w / 2, cz = it.z + it.h / 2, ry = (it.rot * Math.PI) / 2;
    const snowy = theme === 'winter';
    switch (it.type) {
        case 'grove': case 'pines': {
            const n = rng.int(2, 4);
            for (let i = 0; i < n; i++) tree(b, rng, theme === 'city' ? 'city' : theme, it.x + rng.range(0.22, 0.78), it.z + rng.range(0.22, 0.78), rng.range(0.8, 1.15));
            break;
        }
        case 'orchard': {
            for (const [ox, oz] of [[0.28, 0.28], [0.72, 0.3], [0.3, 0.72], [0.74, 0.74]]) {
                b.cyl(0.035, 0.2, C.trunk, it.x + ox, 0, it.z + oz, { seg: 5 });
                b.ico(0.17, 0x6a8a3a, it.x + ox, 0.32, it.z + oz);
                for (let k = 0; k < 3; k++) b.sphere(0.03, 0xd8402a, it.x + ox + rng.range(-0.12, 0.12), 0.28 + rng.range(0, 0.1), it.z + oz + rng.range(-0.12, 0.12), { seg: 5, rings: 3 });
            }
            break;
        }
        case 'house': house(b, rng, cx, cz, ry, false); break;
        case 'cabin': {
            const h = new Builder();
            h.box(0.7, 0.42, 0.55, C.wood, 0, 0, 0);
            for (let i = 0; i < 4; i++) h.box(0.72, 0.03, 0.57, C.wood2, 0, 0.06 + i * 0.1, 0);
            h.gable(0.86, 0.32, 0.7, C.snow, 0, 0.42, 0);
            h.box(0.13, 0.12, 0.02, C.window, -0.15, 0.18, 0.28, { glow: 1 });
            h.box(0.1, 0.3, 0.1, C.stone2, 0.2, 0.5, -0.1);
            h.box(0.12, 0.04, 0.12, C.snow, 0.2, 0.8, -0.1);
            b.merge(h, cx, 0, cz, ry);
            break;
        }
        case 'barn': {
            const h = new Builder();
            h.box(1.5, 0.8, 1.1, 0xa83a2e, 0, 0, 0);
            h.gable(1.62, 0.5, 1.24, 0x4a3a32, 0, 0.8, 0);
            h.box(0.5, 0.56, 0.02, C.white, 0, 0, 0.56);
            h.box(0.46, 0.04, 0.03, 0xa83a2e, 0, 0.26, 0.57, { rz: 0.85 });
            h.box(0.46, 0.04, 0.03, 0xa83a2e, 0, 0.26, 0.57, { rz: -0.85 });
            h.box(0.18, 0.14, 0.02, C.window, 0, 0.92, 0.6, { glow: 0.8 });
            b.merge(h, cx, 0, cz, ry);
            break;
        }
        case 'hay': {
            for (let i = 0; i < 3; i++) b.cyl(0.14, 0.24, C.hay, it.x + 0.25 + i * 0.25, 0.14, it.z + 0.3 + (i % 2) * 0.35, { rz: Math.PI / 2, centre: true, seg: 10 });
            break;
        }
        case 'well': {
            b.cyl(0.24, 0.22, C.stone, cx, 0, cz, { seg: 10 });
            b.cyl(0.18, 0.02, 0x2a4a6a, cx, 0.2, cz, { seg: 10 });
            b.box(0.04, 0.5, 0.04, C.wood2, cx - 0.2, 0, cz);
            b.box(0.04, 0.5, 0.04, C.wood2, cx + 0.2, 0, cz);
            b.gable(0.56, 0.18, 0.4, C.roofRed, cx, 0.5, cz);
            break;
        }
        case 'car': car(b, rng, cx, cz, ry + rng.range(-0.3, 0.3)); break;
        case 'bus': {
            const h = new Builder();
            const col = rng.pick([0xe8b83a, 0x3a6ab8, 0xc84a3a]);
            h.box(1.7, 0.42, 0.42, col, 0, 0.08, 0);
            h.box(1.5, 0.14, 0.43, C.glass, 0.05, 0.3, 0, { glow: 0.15 });
            for (const wx of [-0.6, 0.6]) for (const wz of [-0.21, 0.21]) h.cyl(0.09, 0.06, C.dark, wx, 0.09, wz, { rx: Math.PI / 2, centre: true, seg: 8 });
            b.merge(h, cx, 0, cz, ry);
            break;
        }
        case 'pond': {
            b.cyl(0.85, 0.02, snowy ? C.ice : C.water, cx, 0.01, cz, { seg: 20, sz: 0.75, glow: snowy ? 0 : 0.08 });
            for (let i = 0; i < 9; i++) {
                const a = rng.range(0, 6.28);
                b.ico(rng.range(0.06, 0.11), C.stone, cx + Math.cos(a) * 0.86, 0.03, cz + Math.sin(a) * 0.64);
            }
            if (!snowy) for (let i = 0; i < 6; i++) b.cyl(0.012, rng.range(0.2, 0.34), 0x5a7a3a, cx + rng.range(-0.7, -0.4), 0, cz + rng.range(-0.3, 0.3), { seg: 4 });
            break;
        }
        case 'mill': {
            b.cyl(0.5, 1.3, C.stone, cx, 0, cz, { rt: 0.38, seg: 10 });
            b.cone(0.48, 0.45, snowy ? C.snow : C.roofBrown, cx, 1.3, cz, { seg: 10 });
            const h = new Builder();
            h.box(0.08, 1.6, 0.04, C.plank, 0, -0.8, 0);
            h.box(1.6, 0.08, 0.04, C.plank, 0, -0.04, 0);
            b.merge(h, cx, 1.15, cz + 0.42, 0);
            b.box(0.14, 0.2, 0.02, C.window, cx, 0.5, cz + 0.47, { glow: 1 });
            break;
        }
        case 'woodpile': {
            for (let i = 0; i < 6; i++) b.cyl(0.06, 0.5, C.wood, it.x + 0.5, 0.06 + Math.floor(i / 3) * 0.11, it.z + 0.3 + (i % 3) * 0.13 + (i > 2 ? 0.06 : 0), { rz: Math.PI / 2, centre: true, seg: 7 });
            b.box(0.52, 0.04, 0.42, C.snow, it.x + 0.5, 0.24, it.z + 0.45);
            break;
        }
        case 'snowman': {
            b.sphere(0.2, C.snow, cx, 0.18, cz);
            b.sphere(0.14, C.snow, cx, 0.44, cz);
            b.sphere(0.1, C.snow, cx, 0.62, cz);
            b.cone(0.025, 0.12, 0xf08a2a, cx, 0.6, cz + 0.1, { rx: Math.PI / 2 });
            b.cyl(0.08, 0.1, C.dark, cx, 0.69, cz, { seg: 8 });
            b.cyl(0.12, 0.015, C.dark, cx, 0.69, cz, { seg: 10 });
            tree(b, rng, 'winter', it.x + 0.2, it.z + 0.2, 0.7);
            break;
        }
        case 'terrace': {
            const hgt = rng.range(1.2, 2.4);
            const col = rng.pick(BRICKS);
            const h = new Builder();
            h.box(0.9, hgt, 0.9, col, 0, 0, 0);
            h.box(0.96, 0.06, 0.96, C.stone2, 0, hgt, 0);
            const floors = Math.floor(hgt / 0.34);
            for (let f = 0; f < floors; f++) for (const s of [-0.22, 0.22]) {
                const lit = rng.chance(0.55);
                h.box(0.14, 0.16, 0.02, lit ? C.window : 0x3a4252, s, 0.12 + f * 0.34, 0.455, { glow: lit ? 0.7 : 0 });
                const lit2 = rng.chance(0.5);
                h.box(0.02, 0.16, 0.14, lit2 ? C.window : 0x3a4252, 0.455, 0.12 + f * 0.34, s, { glow: lit2 ? 0.7 : 0 });
            }
            b.merge(h, cx, 0, cz, ry);
            break;
        }
        case 'shop': {
            const h = new Builder();
            const col = rng.pick(WALLS);
            h.box(0.86, 0.9, 0.8, col, 0, 0, 0);
            h.box(0.6, 0.32, 0.02, C.window, 0, 0.12, 0.41, { glow: 1.1 });
            const aw = rng.pick([0xc84a3a, 0x3a8a5a, 0x3a6ab8, 0xd89a3a]);
            for (let i = 0; i < 5; i++) h.box(0.18, 0.03, 0.3, i % 2 ? C.white : aw, -0.36 + i * 0.18, 0.55, 0.52, { rx: -0.35 });
            h.box(0.5, 0.12, 0.02, 0xf2e6c8, 0, 0.7, 0.42, { glow: 0.9 });
            b.merge(h, cx, 0, cz, ry);
            break;
        }
        case 'park': {
            b.box(0.92, 0.03, 0.92, 0x5f8a4a, cx, 0, cz);
            tree(b, rng, 'city', cx - 0.2, cz - 0.15, 0.9);
            b.box(0.34, 0.03, 0.1, C.wood, cx + 0.15, 0.13, cz + 0.22);
            b.box(0.34, 0.1, 0.02, C.wood, cx + 0.15, 0.16, cz + 0.27);
            lampPost(b, cx + 0.32, cz - 0.3, 0.6);
            break;
        }
        case 'kiosk': {
            b.box(0.5, 0.5, 0.5, 0x3a7a6a, cx, 0, cz);
            b.box(0.3, 0.16, 0.02, C.window, cx, 0.24, cz + 0.255, { glow: 1.2 });
            b.pyramid(0.66, 0.24, 0.66, 0x2a4a44, cx, 0.5, cz);
            break;
        }
        case 'fountain': {
            b.cyl(0.8, 0.16, C.stone, cx, 0, cz, { seg: 16 });
            b.cyl(0.7, 0.02, C.water, cx, 0.15, cz, { seg: 16, glow: 0.1 });
            b.cyl(0.08, 0.5, C.stone, cx, 0, cz, { seg: 8 });
            b.cyl(0.24, 0.05, C.stone, cx, 0.5, cz, { seg: 10 });
            for (const [ox, oz] of [[-0.9, -0.9], [0.9, 0.9]]) lampPost(b, cx + ox, cz + oz, 0.65);
            break;
        }
        default: tree(b, rng, theme, cx, cz);
    }
}

// ------------------------------------------------------------------ ground texture
function paintGround(map, theme, rng) {
    const T = THEMES[theme];
    const cw = (W + B * 2) * PX, ch = (H + B * 2) * PX;
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d');
    const hex = (c, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
    g.fillStyle = hex(T.grass[0]);
    g.fillRect(0, 0, cw, ch);
    // grass (or snow) noise: blotches then fine speckles
    for (let i = 0; i < 2600; i++) {
        g.fillStyle = hex(rng.pick(T.grass), rng.range(0.15, 0.4));
        g.beginPath();
        g.arc(rng.range(0, cw), rng.range(0, ch), rng.range(3, 16), 0, Math.PI * 2);
        g.fill();
    }
    for (let i = 0; i < 9000; i++) {
        g.fillStyle = hex(rng.pick(T.grass), rng.range(0.3, 0.7));
        g.fillRect(rng.range(0, cw), rng.range(0, ch), rng.range(1, 3), rng.range(1, 3));
    }
    if (theme === 'autumn') for (let i = 0; i < 1600; i++) {
        g.fillStyle = hex(rng.pick(T.leaves), rng.range(0.4, 0.8));
        g.fillRect(rng.range(0, cw), rng.range(0, ch), 2, 2);
    }
    // the woods' floor around the map is a touch darker
    const sx = (x) => (x + B) * PX, sz = (z) => (z + B) * PX;
    g.fillStyle = theme === 'winter' ? 'rgba(120,140,170,0.12)' : 'rgba(30,40,20,0.16)';
    g.fillRect(0, 0, cw, sz(0)); g.fillRect(0, sz(H), cw, ch - sz(H));
    g.fillRect(0, sz(0), sx(0), sz(H) - sz(0));
    // the Haven's trampled square
    g.fillStyle = hex(T.haven, 0.95);
    g.fillRect(sx(W - HAVEN_COLS) + 4, sz(0) + 4, HAVEN_COLS * PX - 8, H * PX - 8);
    for (let i = 0; i < 500; i++) {
        g.fillStyle = hex(T.roadEdge, rng.range(0.1, 0.3));
        g.fillRect(rng.range(sx(W - HAVEN_COLS), sx(W)), rng.range(sz(0), sz(H)), 3, 2);
    }
    // roads: kerb or verge, the road, worn ruts
    const strokeRoute = (R, width, style, dash = []) => {
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.lineWidth = width * PX; g.strokeStyle = style; g.setLineDash(dash.map((d) => d * PX));
        g.beginPath();
        const p0 = R.pts[0], p1 = R.pts[1];
        const dx = Math.sign(p1.x - p0.x), dz = Math.sign(p1.z - p0.z);
        g.moveTo(sx(p0.x - dx * B), sz(p0.z - dz * B));
        for (const p of R.pts) g.lineTo(sx(p.x), sz(p.z));
        g.stroke();
        g.setLineDash([]);
    };
    for (const R of map.routes) strokeRoute(R, theme === 'city' ? 1.06 : 1.0, theme === 'city' ? '#8d8a84' : hex(T.roadEdge, 0.85));
    for (const R of map.routes) strokeRoute(R, 0.8, hex(T.road));
    for (const R of map.routes) {
        if (theme === 'city') strokeRoute(R, 0.04, 'rgba(240,220,140,0.55)', [0.25, 0.3]);
        else {
            for (const off of [-0.17, 0.17]) {
                g.save(); g.translate(off * PX * 0.7, off * PX * 0.7);
                strokeRoute(R, 0.07, hex(T.rut, 0.6));
                g.restore();
            }
        }
    }
    // gravel on the road
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
        if (map.grid[idx(x, z)] !== ROAD) continue;
        for (let i = 0; i < 14; i++) {
            g.fillStyle = hex(rng.chance(0.5) ? T.roadEdge : T.rut, rng.range(0.2, 0.5));
            g.fillRect(sx(x + rng.range(0.1, 0.9)), sz(z + rng.range(0.1, 0.9)), 2, 2);
        }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

/** Faint squares on every free grass tile: shown while placing. */
function overlayTexture(map, occ) {
    const S = 32;
    const cv = document.createElement('canvas');
    cv.width = W * S; cv.height = H * S;
    const g = cv.getContext('2d');
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
        if (map.grid[idx(x, z)] !== GRASS || (occ && occ[idx(x, z)])) continue;
        g.fillStyle = 'rgba(255,255,240,0.22)';
        g.beginPath();
        g.roundRect(x * S + 3, z * S + 3, S - 6, S - 6, 6);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.45)';
        g.lineWidth = 1.5;
        g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// ------------------------------------------------------------------ the Haven
function buildHaven(theme, gateZ, rng) {
    const b = new Builder();
    const x0 = W - HAVEN_COLS;
    const snowy = theme === 'winter';
    // palisade: the west wall with a gate, and the north and south walls
    const stake = (x, z) => { b.cyl(0.06, rng.range(0.55, 0.7), C.wood2, x, 0, z, { seg: 5 }); b.cone(0.06, 0.1, C.wood2, x, 0.62, z, { seg: 5 }); };
    for (let z = 0.1; z < H; z += 0.14) if (Math.abs(z - (gateZ + 0.5)) > 0.62) stake(x0 + 0.05, z);
    for (let x = x0 + 0.1; x < W; x += 0.14) { stake(x, 0.08); stake(x, H - 0.08); }
    // gate posts and the sign
    for (const s of [-1, 1]) { b.cyl(0.08, 1.05, C.wood2, x0 + 0.05, 0, gateZ + 0.5 + s * 0.62, { seg: 6 }); b.sphere(0.07, C.lamp, x0 + 0.05, 1.1, gateZ + 0.5 + s * 0.62, { glow: 2 }); }
    b.box(0.08, 0.24, 1.38, C.plank, x0 + 0.05, 0.86, gateZ + 0.5);
    b.box(0.1, 0.12, 1.0, 0xfff1c8, x0 + 0.04, 0.92, gateZ + 0.5, { glow: 0.8 });
    // the beacon tower
    const bx = W - 1.5, bz = gateZ < H / 2 ? H - 3.2 : 3.2;
    for (const [ox, oz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) b.cyl(0.05, 2.1, C.wood2, bx + ox, 0, bz + oz, { rt: 0.04, seg: 5 });
    b.box(0.8, 0.06, 0.8, C.plank, bx, 2.05, bz);
    b.box(0.34, 0.4, 0.34, 0xffd27a, bx, 2.12, bz, { glow: 3 });
    b.pyramid(0.6, 0.32, 0.6, C.roofRed, bx, 2.52, bz);
    for (let i = 0; i < 5; i++) b.box(0.62, 0.03, 0.04, C.wood, bx, 0.4 + i * 0.36, bz + 0.3, { rz: i % 2 ? 0.5 : -0.5 });
    // campfire and benches
    const fx = W - 1.5, fz = H / 2 + (gateZ < H / 2 ? 1.5 : -1.5);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; b.ico(0.07, C.stone, fx + Math.cos(a) * 0.2, 0.03, fz + Math.sin(a) * 0.2); }
    b.box(0.6, 0.08, 0.14, C.wood, fx, 0.06, fz - 0.55);
    b.box(0.6, 0.08, 0.14, C.wood, fx, 0.06, fz + 0.55);
    // washing line and crates
    b.cyl(0.02, 0.5, C.wood2, W - 0.4, 0, 1.2, { seg: 4 }); b.cyl(0.02, 0.5, C.wood2, W - 0.4, 0, 2.6, { seg: 4 });
    for (let i = 0; i < 5; i++) b.box(0.02, 0.14, 0.16, rng.pick(TENTS), W - 0.4, 0.33, 1.4 + i * 0.25);
    for (let i = 0; i < 4; i++) b.box(0.22, 0.2, 0.22, C.plank, W - 2.6 + (i % 2) * 0.24, (i > 1 ? 0.2 : 0), H - 1.1 + (i % 2) * 0.04);
    if (snowy) for (let i = 0; i < 20; i++) b.sphere(rng.range(0.08, 0.16), C.snow, rng.range(x0 + 0.2, W - 0.2), 0, rng.range(0.3, H - 0.3), { half: true, seg: 6 });
    return { geo: b.geometry(), beacon: { x: bx, z: bz }, fire: { x: fx, z: fz } };
}

function tentGeo(rng, col) {
    const b = new Builder();
    b.pyramid(0.56, 0.42, 0.5, col, 0, 0, 0);
    b.box(0.12, 0.2, 0.02, 0x3a2a20, 0, 0, 0.255);
    b.cyl(0.012, 0.18, C.wood2, 0, 0.42, 0, { seg: 4 });
    b.box(0.1, 0.06, 0.01, rng.pick(TENTS), 0.05, 0.54, 0);
    return b.geometry();
}

// ------------------------------------------------------------------ the whole valley
export class Terrain {
    constructor(scene) {
        this.scene = scene;
        this.root = new THREE.Group();
        this.root.position.set(-W / 2, 0, -H / 2);
        scene.add(this.root);
        this.disposables = [];
        this.tents = [];
    }

    clear() {
        for (const o of this.root.children.slice()) this.root.remove(o);
        for (const d of this.disposables) d.dispose();
        this.disposables = [];
        this.tents = [];
    }

    build(map, theme) {
        this.clear();
        this.map = map;
        this.theme = theme;
        const rng = new RNG(map.seed ^ 0x7e11);
        // ground
        const tex = paintGround(map, theme, rng);
        const gGeo = new THREE.PlaneGeometry(W + B * 2, H + B * 2);
        gGeo.rotateX(-Math.PI / 2);
        const gMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
        const ground = new THREE.Mesh(gGeo, gMat);
        ground.position.set(W / 2, 0, H / 2);
        ground.receiveShadow = true;
        this.root.add(ground);
        this.disposables.push(tex, gGeo, gMat);

        // scenery on the map
        const b = new Builder();
        for (const it of map.scenery) scenery(b, rng, it, theme);
        // lamp posts along the city road, fence posts along country roads
        for (const [x, z] of map.road) {
            if (!rng.chance(theme === 'city' ? 0.18 : 0.1)) continue;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, nz = z + dz;
                if (nx < 0 || nz < 0 || nx >= W || nz >= H || map.grid[idx(nx, nz)] === ROAD) continue;
                const px = x + 0.5 + dx * 0.56, pz = z + 0.5 + dz * 0.56;
                if (theme === 'city') lampPost(b, px, pz, 0.75);
                else { b.box(0.05, 0.28, 0.05, C.wood2, px, 0, pz); b.box(dx ? 0.03 : 0.6, 0.04, dz ? 0.03 : 0.6, C.wood, px, 0.2, pz); }
                break;
            }
        }
        this.addMesh(b.geometry(), true);

        // the woods or the city around the edge
        this.addMesh(this.border(map, theme, rng), true);
        this.addMesh(this.clutter(map, theme, rng), false);

        // the Haven
        const hv = buildHaven(theme, map.gateZ, rng);
        this.addMesh(hv.geo, true);
        this.beacon = hv.beacon;
        this.campfire = hv.fire;
        // tents that go up as people arrive
        const spots = [];
        for (let z = 0.8; z < H - 0.6; z += 0.75) for (let x = W - HAVEN_COLS + 0.55; x < W - 0.3; x += 0.75) {
            if (Math.abs(z - (map.gateZ + 0.5)) < 0.9 && x < W - 1.6) continue;
            if (Math.hypot(x - hv.beacon.x, z - hv.beacon.z) < 0.8 || Math.hypot(x - hv.fire.x, z - hv.fire.z) < 0.9) continue;
            if (x > W - 0.7 && z < 2.8) continue;
            spots.push([x + rng.range(-0.08, 0.08), z + rng.range(-0.08, 0.08)]);
        }
        rng.shuffle(spots);
        for (const [x, z] of spots.slice(0, 26)) {
            const geo = tentGeo(rng, rng.pick(TENTS));
            const m = new THREE.Mesh(geo, toyMat);
            m.position.set(x, 0, z);
            m.rotation.y = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
            m.castShadow = true;
            m.visible = false;
            m.userData.grow = 0;
            this.root.add(m);
            this.tents.push(m);
            this.disposables.push(geo);
        }

        // placement overlay
        this.overlayTex = overlayTexture(map, null);
        const oGeo = new THREE.PlaneGeometry(W, H);
        oGeo.rotateX(-Math.PI / 2);
        this.overlay = new THREE.Mesh(oGeo, new THREE.MeshBasicMaterial({ map: this.overlayTex, transparent: true, depthWrite: false, opacity: 0 }));
        this.overlay.position.set(W / 2, 0.012, H / 2);
        this.overlay.renderOrder = 2;
        this.root.add(this.overlay);
        this.disposables.push(oGeo, this.overlay.material, this.overlayTex);
        this.setGrowth(0, true);
    }

    addMesh(geo, shadow) {
        const m = new THREE.Mesh(geo, toyMat);
        m.castShadow = shadow;
        m.receiveShadow = true;
        this.root.add(m);
        this.disposables.push(geo);
        return m;
    }

    border(map, theme, rng) {
        const b = new Builder();
        const nearRoad = (x, z) => {
            for (const R of map.routes) {
                const p0 = R.pts[0], p1 = R.pts[1];
                const dx = Math.sign(p1.x - p0.x), dz = Math.sign(p1.z - p0.z);
                // the road runs straight out of the map from its first point
                const t = (x - p0.x) * -dx + (z - p0.z) * -dz;
                const off = Math.abs((x - p0.x) * dz - (z - p0.z) * dx);
                if (t > -0.6 && off < 1.0) return true;
            }
            return false;
        };
        const inMap = (x, z) => x > -0.3 && x < W + 0.3 && z > -0.3 && z < H + 0.3;
        if (theme === 'city') {
            for (let z = -B; z < H + B; z += 1.6) for (let x = -B; x < W + B; x += 1.6) {
                const px = x + rng.range(0, 0.4), pz = z + rng.range(0, 0.4);
                if (inMap(px, pz) || inMap(px + 1.2, pz + 1.2) || nearRoad(px + 0.6, pz + 0.6)) continue;
                if (px > W - 0.5) continue;
                const hgt = rng.range(1.2, 4.2) * (Math.hypot(px - W / 2, pz - H / 2) > 16 ? 1.3 : 1);
                const w = rng.range(1.0, 1.4), d = rng.range(1.0, 1.4);
                b.box(w, hgt, d, rng.pick(BRICKS), px + w / 2, 0, pz + d / 2);
                const floors = Math.floor(hgt / 0.4);
                for (let f = 0; f < floors; f++) for (let k = 0; k < 2; k++) {
                    if (!rng.chance(0.45)) continue;
                    const lx = px + w * (0.3 + k * 0.4);
                    b.box(0.16, 0.16, 0.02, C.window, lx, 0.2 + f * 0.4, pz + d + 0.01, { glow: 0.7 });
                    b.box(0.16, 0.16, 0.02, C.window, lx, 0.2 + f * 0.4, pz - 0.01, { glow: 0.7 });
                }
            }
        } else {
            for (let z = -B; z < H + B; z += 0.62) for (let x = -B; x < W + B; x += 0.62) {
                const px = x + rng.range(-0.25, 0.25), pz = z + rng.range(-0.25, 0.25);
                if (inMap(px, pz) || nearRoad(px, pz)) continue;
                if (px > W - 0.2 && pz > -0.5 && pz < H + 0.5) { if (rng.chance(0.7)) continue; }
                const edge = Math.min(Math.abs(px), Math.abs(pz), Math.abs(pz - H), Math.abs(px - W));
                if (rng.chance(edge < 1.5 ? 0.35 : 0.08)) continue;
                tree(b, rng, theme, px, pz, rng.range(1.0, 1.5) * (edge > 4 ? 1.2 : 1));
            }
        }
        return b.geometry();
    }

    clutter(map, theme, rng) {
        const b = new Builder();
        const flowers = theme === 'autumn' ? [0xe8a33a, 0xd9622b, 0xf2e6c8] : theme === 'city' ? [0xe8d0f0, 0xf2c14e] : [0xf4f8fc];
        for (const c of map.clutter) {
            if (theme === 'winter') {
                if (c.k === 0) b.sphere(0.06 * c.s, C.snow, c.x, 0, c.z, { half: true, seg: 6 });
                else if (c.k === 1) b.ico(0.05 * c.s, C.stone, c.x, 0.02, c.z);
                else b.cone(0.03, 0.12 * c.s, C.pine, c.x, 0, c.z, { seg: 5 });
                continue;
            }
            if (c.k === 0) { b.cone(0.03 * c.s, 0.09 * c.s, theme === 'city' ? 0x4f6a3a : 0x6a8a3a, c.x, 0, c.z, { seg: 4 }); }
            else if (c.k === 1) { b.ico(0.045 * c.s, C.stone, c.x, 0.015, c.z); }
            else { b.cyl(0.006, 0.07, 0x4a6a2a, c.x, 0, c.z, { seg: 3 }); b.sphere(0.022 * c.s, rng.pick(flowers), c.x, 0.075, c.z, { seg: 5, rings: 3 }); }
        }
        if (b.empty) b.box(0.01, 0.01, 0.01, 0, -50, -50, -50);
        return b.geometry();
    }

    /** Show the placement squares (and refresh them for what's taken). */
    showOverlay(on, occ) {
        if (!this.overlay) return;
        if (on && occ) {
            const t = overlayTexture(this.map, occ);
            this.overlay.material.map = t;
            this.overlayTex.dispose();
            this.overlayTex = t;
            this.disposables.push(t);
        }
        this.overlayOn = on;
    }

    /** More tents as more people arrive. */
    setGrowth(saved, snap = false) {
        const want = Math.min(this.tents.length, 4 + Math.floor(saved / 3));
        this.tents.forEach((t, i) => {
            const on = i < want;
            if (on && !t.visible) { t.visible = true; t.userData.grow = snap ? 1 : 0; }
            if (!on) t.visible = false;
        });
    }

    update(dt) {
        if (this.overlay) {
            const o = this.overlay.material;
            o.opacity += ((this.overlayOn ? 1 : 0) - o.opacity) * Math.min(1, dt * 10);
            this.overlay.visible = o.opacity > 0.01;
        }
        for (const t of this.tents) {
            if (!t.visible || t.userData.grow >= 1) continue;
            t.userData.grow = Math.min(1, t.userData.grow + dt * 2.5);
            const g = t.userData.grow;
            const s = g < 1 ? 1 + Math.sin(g * Math.PI) * 0.25 : 1;
            t.scale.set(g * s, g * s, g * s);
        }
    }
}
