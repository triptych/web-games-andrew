// The tile texture atlas: 8 × 8 tiles of 32 px, painted with value noise, speckle and hand-placed details. Nearest-filtered,
// so the ground keeps the same crisp pixel density as the sprites standing on it.

import * as THREE from 'three';
import { Px, hex, mix } from './pixel.js';
import { hash3 } from '../rng.js';

export const TS = 32;
export const TEX = {
    grass: 0, grass2: 1, grass3: 2, flowers: 3, forest: 4, woods: 5, sand: 6, sand2: 7, snow: 8, snow2: 9, rock: 10, dirt: 11, dirt2: 12, stone: 13, stone2: 14, wood: 15,
    ice: 16, swamp: 17, ash: 18, brick: 19, carpet: 20, dark: 21, dark2: 22, moss: 23, temple: 24, sandstone: 25, icefloor: 26, walltop: 27, bridge: 28, bed: 29, bedsand: 30, lavarock: 31,
    cliffEarth: 32, cliffRock: 33, cliffSand: 34, cliffIce: 35, wallDark: 36, wallRock: 37, wallCoral: 38, wallSand: 39, wallIce: 40, wallObs: 41, wallBasalt: 42, wallHedge: 43,
    plaster: 44, roof: 45, trim: 46, crack: 47, crate: 48, water: 49, glass: 50,
};

const n2 = (x, y, s) => hash3(x, y, s);
function noiseFill(P, pal, seed, block = 2, bias = 0) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const v = n2((x / block) | 0, (y / block) | 0, seed) * 0.7 + n2(x >> 3, y >> 3, seed + 9) * 0.3 + bias;
        P.set(x, y, pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length)))]);
    }
}
function speck(P, col, count, seed, w = 1, h = 1) {
    for (let i = 0; i < count; i++) {
        const x = Math.floor(n2(i, 3, seed) * TS), y = Math.floor(n2(i, 7, seed) * TS);
        for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) P.set((x + a) % TS, (y + b) % TS, col);
    }
}
function blades(P, cols, count, seed) {
    for (let i = 0; i < count; i++) {
        const x = Math.floor(n2(i, 1, seed) * TS), y = Math.floor(n2(i, 2, seed) * TS), c = cols[Math.floor(n2(i, 4, seed) * cols.length)];
        P.set(x, y, c); P.set(x, (y + 1) % TS, c); if (n2(i, 5, seed) > 0.5) P.set((x + 1) % TS, y, c);
    }
}
function bricks(P, w, h, mortar, cols, seed, off = true) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const row = Math.floor(y / h), ox = off && row % 2 ? w / 2 : 0;
        const bx = Math.floor((x + ox) / w);
        const edge = y % h === 0 || (x + ox) % w === 0;
        const base = cols[Math.floor(n2(bx, row, seed) * cols.length)];
        P.set(x, y, edge ? mortar : (y % h === 1 || (x + ox) % w === 1 ? mix(base, '#ffffff', 0.14) : base));
    }
}

const PAINT = {
    grass(P, s) { noiseFill(P, ['#5aa83c', '#62b244', '#6cbc4c', '#58a43a'], s); blades(P, ['#3e8a2c', '#86d060', '#4c9a34'], 26, s + 1); },
    flowers(P, s) { PAINT.grass(P, s); for (let i = 0; i < 7; i++) { const x = 3 + Math.floor(n2(i, 1, s) * 26), y = 3 + Math.floor(n2(i, 2, s) * 26), c = ['#ffe44a', '#ff7ab0', '#ffffff', '#ff9a4a'][i % 4]; P.set(x, y, c); P.set(x + 1, y, c); P.set(x, y + 1, mix(c, '#fff', 0.3)); P.set(x - 1, y, '#3e8a2c'); } },
    forest(P, s) { noiseFill(P, ['#2e6a2a', '#357430', '#2a6026', '#3a7a34'], s); blades(P, ['#1e4a1c', '#4a9a3c'], 22, s + 1); speck(P, '#1a3a18', 12, s + 2, 2, 1); },
    woods(P, s) { noiseFill(P, ['#4a8a34', '#52943a', '#468230', '#589c40'], s); blades(P, ['#2e6a24', '#7ac05a'], 20, s + 1); speck(P, '#8a6a30', 8, s + 3, 2, 1); speck(P, '#c8a040', 5, s + 4); },
    sand(P, s) { noiseFill(P, ['#e8cf8c', '#efd898', '#e0c680', '#f2dca0'], s); speck(P, '#c8a860', 14, s + 1); speck(P, '#fff2c0', 8, s + 2); for (let y = 6; y < TS; y += 11) for (let x = 0; x < TS; x++) if (n2(x >> 1, y, s) > 0.45) P.set(x, y + ((x >> 3) % 2), '#d4b874'); },
    snow(P, s) { noiseFill(P, ['#f4f8ff', '#eaf2fc', '#dfeaf8', '#f8fcff'], s); speck(P, '#ffffff', 10, s + 1); speck(P, '#b8cce8', 8, s + 2); },
    rock(P, s) { noiseFill(P, ['#8a8a94', '#7a7a86', '#9a9aa4', '#6e6e7a'], s, 3); speck(P, '#52525c', 14, s + 1, 2, 1); speck(P, '#b8b8c4', 8, s + 2); },
    dirt(P, s) { noiseFill(P, ['#9a7248', '#8a6440', '#a47c50', '#86603c'], s); speck(P, '#6a4a2a', 14, s + 1, 2, 1); speck(P, '#c0a070', 10, s + 2); },
    stone(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const bx = x >> 4, by = y >> 4, edge = x % 16 === 0 || y % 16 === 0; const base = ['#b8b4a8', '#aca89c', '#c2beb2', '#a8a498'][Math.floor(n2(bx, by, s) * 4)]; P.set(x, y, edge ? '#6a665c' : (x % 16 === 1 || y % 16 === 1 ? mix(base, '#fff', 0.2) : mix(base, '#000', n2(x, y, s + 1) * 0.06))); } speck(P, '#8a867a', 10, s + 2); },
    wood(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const pl = Math.floor(y / 8), edge = y % 8 === 0; const base = ['#a8763c', '#9a6a34', '#b4824a', '#946432'][Math.floor(n2(pl, 1, s) * 4)]; P.set(x, y, edge ? '#5a3a1c' : mix(base, '#000', n2(x >> 2, y, s) * 0.14)); } for (let pl = 0; pl < 4; pl++) { P.set(2 + (pl * 11) % 28, pl * 8 + 3, '#4a2a14'); P.set(29 - (pl * 7) % 24, pl * 8 + 4, '#4a2a14'); } },
    ice(P, s) { noiseFill(P, ['#b8e8ff', '#a8e0fa', '#c8f0ff', '#9ad8f6'], s, 3); speck(P, '#ffffff', 8, s + 1); for (let i = 0; i < 3; i++) { let x = Math.floor(n2(i, 1, s) * 28), y = Math.floor(n2(i, 2, s) * 28); for (let k = 0; k < 8; k++) { P.set(x, y, '#e8fbff'); x = (x + 1) % TS; y = (y + (n2(k, i, s) > 0.5 ? 1 : 0)) % TS; } } },
    swamp(P, s) { noiseFill(P, ['#4a6a3a', '#3e5e34', '#56743e', '#34502c'], s, 3); speck(P, '#2a3e24', 14, s + 1, 2, 2); speck(P, '#7a9a4a', 6, s + 2); },
    ash(P, s) { noiseFill(P, ['#4a4448', '#3e383c', '#544e52', '#363034'], s); speck(P, '#ff7a30', 4, s + 1); speck(P, '#262024', 14, s + 2, 2, 1); speck(P, '#6a6064', 8, s + 3); },
    brick(P, s) { bricks(P, 8, 4, '#6a5a50', ['#b8967a', '#a8866c', '#c0a084', '#9e7e66'], s); },
    carpet(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const e = x < 3 || y < 3 || x > 28 || y > 28; const d = (x + y) % 8 === 0; P.set(x, y, e ? '#e8c050' : d ? '#a82a3a' : '#8a1e2e'); } },
    dark(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const edge = x % 16 === 0 || y % 16 === 0; P.set(x, y, edge ? '#161420' : mix('#3a3848', '#1a1824', n2(x >> 1, y >> 1, s) * 0.5)); } speck(P, '#5a5870', 8, s + 1); },
    moss(P, s) { noiseFill(P, ['#3e5a34', '#486a3a', '#34502c', '#52763e'], s, 2); speck(P, '#8ab86a', 6, s + 1); speck(P, '#2a3e24', 10, s + 2, 2, 1); for (let i = 0; i < 2; i++) P.set(Math.floor(n2(i, 1, s) * 30), Math.floor(n2(i, 2, s) * 30), '#9ae8c0'); },
    temple(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = ((x >> 4) + (y >> 4)) % 2; const e = x % 16 === 0 || y % 16 === 0; P.set(x, y, e ? '#1a4a5a' : c ? mix('#3a9aa8', '#fff', n2(x, y, s) * 0.08) : mix('#e8e0c8', '#000', n2(x, y, s) * 0.08)); } P.set(8, 8, '#ffe08a'); P.set(24, 24, '#ffe08a'); },
    sandstone(P, s) { bricks(P, 16, 8, '#a8884c', ['#e0c486', '#d8ba7a', '#e8cc92', '#d0b070'], s); speck(P, '#9a7a3a', 6, s + 1); for (let i = 0; i < 3; i++) { const x = 4 + i * 9, y = 2 + (i % 2) * 8; P.set(x, y, '#8a6a2a'); P.set(x + 1, y + 1, '#8a6a2a'); P.set(x + 2, y, '#8a6a2a'); } },
    icefloor(P, s) { noiseFill(P, ['#cdeeff', '#c0e6fa', '#d8f4ff', '#b8e0f6'], s, 4); for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (x % 16 === 0 || y % 16 === 0) P.set(x, y, '#8ac4e4'); speck(P, '#ffffff', 10, s + 1); },
    walltop(P, s) { noiseFill(P, ['#78768e', '#706e88', '#827f98', '#68667e'], s, 3); speck(P, '#9a98b0', 8, s + 1); speck(P, '#585670', 10, s + 2); },
    bridge(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const pl = Math.floor(x / 8), edge = x % 8 === 0; const base = ['#a8763c', '#9a6a34', '#b4824a'][Math.floor(n2(pl, y >> 3, s) * 3)]; P.set(x, y, edge ? '#4a2a14' : mix(base, '#000', n2(x, y >> 2, s) * 0.12)); } },
    bed(P, s) { noiseFill(P, ['#2a4a7a', '#274570', '#2e5084'], s, 3); },
    bedsand(P, s) { noiseFill(P, ['#c8b078', '#d0b880', '#c0a870'], s, 3); speck(P, '#e8d8a0', 8, s + 1); },
    lavarock(P, s) { noiseFill(P, ['#2a2024', '#32262a', '#241a1e'], s, 3); for (let i = 0; i < 5; i++) { let x = Math.floor(n2(i, 1, s) * 28), y = Math.floor(n2(i, 2, s) * 28); for (let k = 0; k < 6; k++) { P.set(x, y, '#ff7a20'); x = (x + 1) % TS; y = (y + (n2(k, i, s) > 0.5 ? 1 : 0)) % TS; } } },
    cliffEarth(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const band = Math.floor((y + n2(x >> 3, 1, s) * 6) / 6); const cs = ['#8a6440', '#7a5632', '#966c44', '#6e4e2e']; P.set(x, y, mix(cs[band % 4], '#000', n2(x >> 1, y >> 1, s) * 0.12)); } for (let x = 0; x < TS; x++) { P.set(x, 0, '#5aa83c'); P.set(x, 1, n2(x, 1, s) > 0.4 ? '#4a8a34' : '#8a6440'); } },
    cliffRock(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const band = Math.floor((y + n2(x >> 3, 2, s) * 5) / 5); const cs = ['#7a7a86', '#6a6a76', '#868692', '#5e5e6a']; P.set(x, y, mix(cs[band % 4], '#000', n2(x >> 1, y >> 1, s) * 0.14)); } speck(P, '#4a4a56', 12, s + 1, 1, 3); },
    cliffSand(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const band = Math.floor((y + n2(x >> 3, 3, s) * 4) / 4); const cs = ['#d8bc7c', '#cdb070', '#e0c488', '#c4a664']; P.set(x, y, mix(cs[band % 4], '#000', n2(x >> 1, y >> 1, s) * 0.08)); } },
    cliffIce(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const band = Math.floor((y + n2(x >> 3, 4, s) * 5) / 5); const cs = ['#a8e0fa', '#98d4f2', '#b8eaff', '#8accea']; P.set(x, y, cs[band % 4]); } speck(P, '#ffffff', 10, s + 1, 1, 2); },
    wallDark(P, s) { bricks(P, 8, 5, '#14121c', ['#3e3c4e', '#36344a', '#464458', '#2e2c3e'], s); },
    wallRock(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const band = Math.floor((y + n2(x >> 2, 5, s) * 5) / 6); const cs = ['#5a5660', '#4e4a58', '#66626e', '#44404c']; P.set(x, y, mix(cs[band % 4], '#000', n2(x >> 1, y >> 1, s) * 0.16)); } speck(P, '#322e3a', 14, s + 1, 1, 3); speck(P, '#ffb060', 2, s + 3); },
    wallCoral(P, s) { bricks(P, 8, 6, '#0e2a3a', ['#2a6a7a', '#2e7484', '#246070', '#34808e'], s); speck(P, '#ff9ab0', 6, s + 1); speck(P, '#7fffe0', 4, s + 2); },
    wallSand(P, s) { bricks(P, 16, 8, '#8a6a2e', ['#c8a868', '#c0a060', '#d0b070', '#b89858'], s); for (let i = 0; i < 2; i++) { const x = 4 + i * 14, y = 2 + i * 9; P.set(x, y, '#6a4a1a'); P.set(x + 1, y + 1, '#6a4a1a'); P.set(x + 2, y, '#6a4a1a'); P.set(x + 1, y + 2, '#6a4a1a'); } },
    wallIce(P, s) { bricks(P, 16, 8, '#5a9ac4', ['#a8e0fa', '#98d4f2', '#b8eaff', '#8accea'], s); speck(P, '#ffffff', 12, s + 1); },
    wallObs(P, s) { bricks(P, 16, 8, '#08060e', ['#1e1a30', '#241f3a', '#1a162a', '#2a2444'], s); speck(P, '#9a60ff', 5, s + 1); speck(P, '#c8a0ff', 3, s + 2); },
    wallBasalt(P, s) { bricks(P, 8, 8, '#140c0c', ['#3a2a2a', '#322424', '#443232', '#2e2020'], s, false); speck(P, '#ff6a20', 8, s + 1); },
    wallHedge(P, s) { noiseFill(P, ['#2a5a26', '#306a2c', '#24501e', '#367432'], s, 2); speck(P, '#4a9a40', 16, s + 1, 2, 2); speck(P, '#1a3a16', 14, s + 2, 2, 1); speck(P, '#ffe44a', 2, s + 3); },
    plaster(P, s) { noiseFill(P, ['#f0e4cc', '#e8dcc4', '#f4e8d2', '#e4d8bc'], s, 3); for (let x = 0; x < TS; x++) { P.set(x, 0, '#7a5a3a'); P.set(x, 1, '#7a5a3a'); P.set(x, TS - 1, '#7a5a3a'); } for (let y = 0; y < TS; y++) { P.set(0, y, '#7a5a3a'); P.set(TS - 1, y, '#7a5a3a'); } },
    roof(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const row = Math.floor(y / 6), ox = row % 2 ? 4 : 0; const bx = Math.floor((x + ox) / 8); const edge = y % 6 === 5 || (x + ox) % 8 === 7; const v = 0.78 + n2(bx, row, s) * 0.22; const c = Math.round(255 * v); P.set(x, y, edge ? [150, 150, 150] : [c, c, c]); } },
    trim(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) P.set(x, y, mix('#8a6a40', '#000', n2(x >> 2, y, s) * 0.16)); },
    crack(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { if (n2(x >> 1, y >> 1, s) > 0.8 || (Math.abs(x - 16 + Math.sin(y * 0.6) * 4) < 1.4 && y > 4 && y < 28)) P.set(x, y, '#120e14'); } },
    crate(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const e = x < 3 || y < 3 || x > 28 || y > 28 || Math.abs(x - y) < 2 || Math.abs(x + y - 31) < 2; P.set(x, y, e ? '#6a4420' : mix('#a8763c', '#000', n2(x >> 2, y, s) * 0.14)); } },
    water(P, s) { noiseFill(P, ['#3a8ad8', '#4a9ae0', '#3482d0'], s, 4); },
    glass(P, s) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) P.set(x, y, mix('#ffd890', '#ff9a40', y / TS)); },
};

export function buildAtlas() {
    const atlas = document.createElement('canvas'); atlas.width = atlas.height = TS * 8;
    const ctx = atlas.getContext('2d');
    for (const [name, i] of Object.entries(TEX)) {
        const P = new Px(TS, TS);
        const fn = PAINT[name] || PAINT[name.replace(/\d$/, '')] || PAINT.grass;
        fn(P, 11 + i * 17);
        ctx.drawImage(P.toCanvas(), (i % 8) * TS, Math.floor(i / 8) * TS);
    }
    const t = new THREE.CanvasTexture(atlas);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
}

export const tileRect = (i) => ({ x: (i % 8) * TS, y: Math.floor(i / 8) * TS });

/** UV rect of tile i in the atlas, with a half-texel inset so nearest filtering never bleeds a neighbour. */
export function tileUV(i) {
    const e = 0.5 / (TS * 8), s = 1 / 8;
    const u0 = (i % 8) * s + e, v1 = 1 - Math.floor(i / 8) * s - e;
    return { u0, v0: v1 - s + 2 * e, u1: u0 + s - 2 * e, v1 };
}

// Small standalone sprites: grass tufts, flowers, a glow
export function tuftTexture(kind = 'grass') {
    const P = new Px(16, 16);
    const col = { grass: ['#3e8a2c', '#62b244', '#86d060'], snow: ['#b8cce8', '#dfeaf8', '#ffffff'], sand: ['#c8a860', '#e0c680', '#f2dca0'], ash: ['#4a4448', '#6a6064', '#ff7a30'], flower: ['#3e8a2c', '#ff7ab0', '#ffe44a'] }[kind] || ['#3e8a2c', '#62b244', '#86d060'];
    if (kind === 'flower') {
        P.mline(8, 15, 8, 6, 1).fill(col[0]); P.mell(8, 5, 3, 3).fill(col[1]); P.mp(8, 5).fill(col[2]); P.mline(8, 12, 5, 9, 1).fill(col[0]); P.mell(4, 8, 2, 2).fill('#ffffff'); P.mp(4, 8).fill(col[2]);
    } else {
        for (const [x, y0, y1] of [[4, 15, 8], [7, 15, 3], [10, 15, 6], [13, 15, 9], [2, 15, 11]]) { P.mline(x, y0, x + ((x * 3) % 3) - 1, y1, 1).fill(col[(x >> 1) % 3]); }
    }
    const t = new THREE.CanvasTexture(P.toCanvas());
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
