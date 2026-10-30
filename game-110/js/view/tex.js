// Pixel textures for the castle, painted per lair: walls, floors, wood, carpet and banners. Every texture is a small
// canvas drawn nearest-filtered, so the 3D rooms read as pixel art next to the sprites.

import * as THREE from 'three';
import { Px, mix, hex } from './pixel.js';
import { hash3 } from '../rng.js';

/** One palette per lair. wall/accent/floor tint the rooms; sky is the night outside (top, horizon), cozy the day. */
export const PALETTES = {
    gloom: { wall: '#5a4878', wall2: '#45375e', paper: '#6a3f86', paper2: '#7d4f9c', stone: '#6a6480', floorA: '#f1cddf', floorB: '#c49ab9', wood: '#7a5238', carpet: '#9a2448', trim: '#d6a446', marbleA: '#ece4f2', marbleB: '#2a2236', sky: ['#120a2a', '#3a2466'], cozy: ['#7fc0ff', '#ffd6ec'], ground: '#2a2440', clear: 0x140e22, mountain: '#24183e', lamp: 0xffb070 },
    cinder: { wall: '#6e3a32', wall2: '#55291f', paper: '#8a3a2a', paper2: '#a24a32', stone: '#5a4440', floorA: '#ffd2a8', floorB: '#d8925e', wood: '#5a3020', carpet: '#c8402a', trim: '#ffb43a', marbleA: '#f6e2d0', marbleB: '#2a1612', sky: ['#1e0606', '#9a2a10'], cozy: ['#ffb07f', '#ffe6c0'], ground: '#3a1a12', clear: 0x1a0806, mountain: '#2e0e08', lamp: 0xff8a40 },
    frost: { wall: '#4f6a8e', wall2: '#3e5676', paper: '#4a6aa8', paper2: '#5a7cbc', stone: '#7a8aa4', floorA: '#e6f2ff', floorB: '#a8c4e6', wood: '#6a6a80', carpet: '#3a5ab8', trim: '#cfe8ff', marbleA: '#f2f8ff', marbleB: '#1c2a40', sky: ['#081428', '#2a4a7a'], cozy: ['#a8dcff', '#f0f8ff'], ground: '#c8d8ec', clear: 0x0a1424, mountain: '#1a2a48', lamp: 0xbfe0ff },
    mire: { wall: '#4a5a3e', wall2: '#3a4830', paper: '#3e6a4a', paper2: '#4e7c58', stone: '#5a6450', floorA: '#d8e8c0', floorB: '#9ab884', wood: '#5a4a2a', carpet: '#6a2a5a', trim: '#c8b44a', marbleA: '#e6eedc', marbleB: '#1c2418', sky: ['#0a1408', '#2e4a26'], cozy: ['#b8e6a8', '#f6f0c8'], ground: '#2a3a20', clear: 0x0c140a, mountain: '#16240f', lamp: 0xd8ff9a },
    eclipse: { wall: '#3a3048', wall2: '#2a2238', paper: '#2a2a4a', paper2: '#3a3a5e', stone: '#4a4458', floorA: '#fff0c8', floorB: '#d8b870', wood: '#4a3424', carpet: '#7a1a2a', trim: '#ffd54a', marbleA: '#f4eedc', marbleB: '#1a1424', sky: ['#05040c', '#2a1a3a'], cozy: ['#ffd8a0', '#fff4dc'], ground: '#1a1424', clear: 0x07060e, mountain: '#140e20', lamp: 0xffe08a },
};

export function mkTex(canvas, repeat = 1) {
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (Array.isArray(repeat)) t.repeat.set(repeat[0], repeat[1]); else t.repeat.set(repeat, repeat);
    return t;
}

const jitter = (c, x, y, z, amt) => mix(c, hash3(x, y, z) < 0.5 ? '#000000' : '#ffffff', hash3(y, x, z + 7) * amt);

function setPx(P, x, y, c) { P.set(x, y, hex(c)); }

/** Stone bricks: offset courses, mortar lines, a little moss or soot. */
export function brickTex(base, seed = 1) {
    const P = new Px(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const row = y >> 3, off = (row & 1) * 8;
        const bx = ((x + off) & 31) >> 4;
        const mortar = (y & 7) === 7 || ((x + off) & 15) === 15;
        let c = mortar ? mix(base, '#000000', 0.42) : jitter(mix(base, '#ffffff', hash3(row, bx, seed) * 0.12), x, y, seed, 0.06);
        if (!mortar && (y & 7) === 0) c = mix(c, '#ffffff', 0.1);
        setPx(P, x, y, c);
    }
    return P;
}
/** Striped wallpaper with a little damask dot. */
export function paperTex(a, b) {
    const P = new Px(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let c = x < 8 ? a : b;
        if ((x === 11 || x === 12) && (y % 8 === 3 || y % 8 === 4)) c = mix(b, '#ffffff', 0.25);
        if (x === 3 && y % 8 === 0) c = mix(a, '#ffffff', 0.2);
        setPx(P, x, y, jitter(c, x, y, 3, 0.03));
    }
    return P;
}
/** Wood panelling or floorboards. */
export function plankTex(base) {
    const P = new Px(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const plank = y >> 3, seam = (y & 7) === 7 || ((x + plank * 11) % 32) === 0;
        let c = mix(base, '#ffffff', hash3(plank, 0, 9) * 0.12);
        c = mix(c, '#000000', (Math.sin(x * 0.9 + plank * 3) * 0.5 + 0.5) * 0.08);
        if (seam) c = mix(base, '#000000', 0.45);
        setPx(P, x, y, jitter(c, x, y, 5, 0.04));
    }
    return P;
}
/** Checkered tiles with a bevel. */
export function checkTex(a, b) {
    const P = new Px(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const t = ((x >> 3) + (y >> 3)) & 1;
        let c = t ? a : b;
        if ((x & 7) === 0 || (y & 7) === 0) c = mix(c, '#ffffff', 0.18);
        if ((x & 7) === 7 || (y & 7) === 7) c = mix(c, '#000000', 0.16);
        setPx(P, x, y, jitter(c, x, y, 11, 0.025));
    }
    return P;
}
/** Big flagstones for the Great Hall. */
export function flagTex(base) {
    const P = new Px(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const cx = x >> 4, cy = y >> 4, edge = (x & 15) === 15 || (y & 15) === 15;
        let c = mix(base, '#ffffff', hash3(cx, cy, 13) * 0.14);
        if (edge) c = mix(base, '#000000', 0.4);
        setPx(P, x, y, jitter(c, x, y, 17, 0.05));
    }
    return P;
}
/** A carpet runner with a border. */
export function carpetTex(base, trim) {
    const P = new Px(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let c = base;
        if (x < 2 || x > 13) c = trim;
        else if (x === 2 || x === 13) c = mix(base, '#000000', 0.3);
        else if ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0) c = mix(base, trim, 0.35);
        setPx(P, x, y, jitter(c, x, y, 19, 0.03));
    }
    return P;
}
/** A hanging banner with a skull. */
export function bannerTex(base, trim, emblem) {
    const P = new Px(16, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
        const tail = y > 26 && Math.abs(x - 7.5) < (y - 26) * 1.4;
        if (tail) continue;
        let c = base;
        if (x < 1 || x > 14 || y < 2) c = trim;
        setPx(P, x, y, jitter(c, x, y, 23, 0.04));
    }
    P.blit(emblem, 0, 9);
    return P;
}

/** The sky outside: a gradient, mountains and a moon, for the backdrop behind the castle. */
export function backdropTex(pal) {
    const P = new Px(160, 60);
    for (let y = 0; y < 60; y++) for (let x = 0; x < 160; x++) {
        let c = mix(pal.sky[0], pal.sky[1], Math.pow(y / 59, 1.4));
        if (hash3(x, y, 31) > 0.985 && y < 36) c = mix(c, '#ffffff', 0.7);
        setPx(P, x, y, c);
    }
    for (let x = 0; x < 160; x++) {
        const h = 38 + Math.sin(x * 0.07) * 6 + Math.sin(x * 0.19 + 2) * 3 + hash3(x >> 2, 0, 41) * 2;
        for (let y = Math.floor(h); y < 60; y++) setPx(P, x, y, mix(pal.mountain, '#000000', (y - h) / 40));
    }
    P.mell(128, 14, 7, 7).paint('#fff4d6', { soft: true, noline: true });
    P.mell(131, 12, 6, 6).fill(pal.sky[0]);
    return P;
}

export function buildRoomTextures(pal, emblem) {
    return {
        brick: brickTex(pal.wall, 2),
        stone: brickTex(pal.stone, 5),
        paper: paperTex(pal.paper, pal.paper2),
        plank: plankTex(pal.wood),
        wallWood: plankTex(mix(pal.wood, '#000000', 0.15)),
        check: checkTex(pal.floorA, pal.floorB),
        marble: checkTex(pal.marbleA, pal.marbleB),
        flag: flagTex(pal.stone),
        carpet: carpetTex(pal.carpet, pal.trim),
        banner: bannerTex(mix(pal.wall2, '#000000', 0.35), pal.trim, emblem),
        backdrop: backdropTex(pal),
    };
}
