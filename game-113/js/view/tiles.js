// Themes (palette, light, fog, props) and the procedural 16×16 pixel textures every tile is dressed in.

import * as THREE from 'three';
import { Px, mix, hex } from './pixel.js';
import { hash3 } from '../rng.js';

export const THEMES = {
    hollow: {
        ground: '#3a3352', ground2: '#463c66', path: '#5b4a86', wall: '#2c2540', cliff: '#1e1a2e', house: '#3a3352', roof: '#4a3a6a', water: '#2a1a4a', dock: '#5a4a6a',
        sky: 0x0d0a18, fog: 0x120d22, fogNear: 14, fogFar: 40, hemi: [0x8a7ad8, 0x1a1028, 0.55], sun: [0xc8b8ff, 0.7], lightCol: 0xd88aff, tree: 'shroom', grade: { warm: 0, dusk: 0.3, bloom: 0.6 },
        motes: 0xc8a8ff,
    },
    beach: {
        ground: '#3e4a5e', ground2: '#2fa8a0', path: '#6a7a8a', wall: '#24304a', cliff: '#182238', house: '#3a4a5a', roof: '#2a6a7a', water: '#0f5a6a', dock: '#7a5a3a',
        sky: 0x07121c, fog: 0x0a1a28, fogNear: 14, fogFar: 38, hemi: [0x7ae8f0, 0x14283a, 0.95], sun: [0x9ae8ff, 0.75], lightCol: 0x5ae8ff, tree: 'shroom', grade: { warm: 0, dusk: 0.15, bloom: 0.7 },
        motes: 0x7ff6ff, glowSand: true,
    },
    aurelune: {
        ground: '#4a4038', ground2: '#5a5040', path: '#c8a24a', wall: '#6a5a3a', cliff: '#2a2218', house: '#b8903a', roof: '#3a8a7a', water: '#1a3a3a', dock: '#7a5a3a',
        sky: 0x120c06, fog: 0x1a1208, fogNear: 14, fogFar: 40, hemi: [0xffd8a0, 0x1a1008, 0.55], sun: [0xffe0a8, 0.7], lightCol: 0xffb84a, tree: 'shroom', grade: { warm: 0.6, dusk: 0, bloom: 0.65 },
        motes: 0xffd38a,
    },
    marisonde: {
        ground: '#e8d8a8', ground2: '#d8c890', path: '#b8b0a0', wall: '#c8bca8', cliff: '#a89880', house: '#f0ece0', roof: '#e86a5a', water: '#2a8ad8', dock: '#9a6a3a',
        sky: 0x8ad0ff, fog: 0xbfe6ff, fogNear: 22, fogFar: 60, hemi: [0xcfeaff, 0x8a7a5a, 0.85], sun: [0xfff4dc, 2.1], lightCol: 0xffd38a, tree: 'palm', grade: { warm: 0.25, dusk: 0, bloom: 0.35 },
        motes: 0xffffff, day: true,
    },
    sunreach: {
        ground: '#6aa84a', ground2: '#7ab85a', path: '#c8a070', wall: '#8a7a5a', cliff: '#5a6a3a', house: '#e8d8b0', roof: '#a84a3a', water: '#3a7ac8', dock: '#8a6a3a',
        sky: 0xffd9a0, fog: 0xffe2b8, fogNear: 22, fogFar: 60, hemi: [0xfff0d0, 0x5a6a2a, 0.85], sun: [0xffe0b0, 2.0], lightCol: 0xffc86a, tree: 'oak', grade: { warm: 0.55, dusk: 0, bloom: 0.35 },
        motes: 0xfff0a0, day: true,
    },
    frosthold: {
        ground: '#e6eef8', ground2: '#d4e2f2', path: '#8a94a8', wall: '#a8c8e8', cliff: '#7a8aa8', house: '#5a4a4a', roof: '#f4f8ff', water: '#5a8ab8', dock: '#6a5a4a',
        sky: 0xc8dcf0, fog: 0xdce8f6, fogNear: 18, fogFar: 52, hemi: [0xe8f0ff, 0x6a7a9a, 0.9], sun: [0xe8f0ff, 1.7], lightCol: 0xffb86a, tree: 'pine', grade: { warm: 0, dusk: 0.05, bloom: 0.4 },
        motes: 0xffffff, day: true, snow: true,
    },
    spire: {
        ground: '#26202e', ground2: '#2e2438', path: '#4a3a66', wall: '#1a1424', cliff: '#100c18', house: '#26202e', roof: '#3a2a5a', water: '#1a0a2a', dock: '#3a2a4a',
        sky: 0x07040c, fog: 0x0c0614, fogNear: 12, fogFar: 36, hemi: [0x9a6aff, 0x0a0410, 0.45], sun: [0xb88aff, 0.55], lightCol: 0xc86bff, tree: 'shroom', grade: { warm: 0, dusk: 0.45, bloom: 0.75 },
        motes: 0xc86bff,
    },
};

const mkTex = (canvas, repeat = false) => {
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
};
export { mkTex };

const shadeC = (c, k) => mix(hex(c), k > 0 ? '#ffffff' : '#000000', Math.abs(k));

/** One 16×16 texture for a tile kind in a theme. */
export function tileTexture(theme, kind, variant = 0) {
    const T = THEMES[theme];
    const P = new Px(16, 16);
    const n = (x, y, s = 0) => hash3(x + variant * 31, y + s * 17, kind.length * 13 + variant);
    const fill = (base, spread, s) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, shadeC(base, (n(x, y, s) - 0.5) * spread)); };
    switch (kind) {
        case 'ground': {
            fill(T.ground, 0.16, 1);
            for (let i = 0; i < 6; i++) { const x = Math.floor(n(i, 3) * 16), y = Math.floor(n(3, i) * 16); P.set(x, y, shadeC(T.ground, n(i, i) > 0.5 ? 0.18 : -0.2)); }
            if (T.snow) for (let i = 0; i < 4; i++) P.set(Math.floor(n(i, 9) * 16), Math.floor(n(9, i) * 16), '#ffffff');
            break;
        }
        case 'ground2': {
            fill(T.ground2, 0.2, 2);
            if (T.glowSand) for (let i = 0; i < 7; i++) P.set(Math.floor(n(i, 5) * 16), Math.floor(n(5, i) * 16), '#c8fff8');
            else for (let i = 0; i < 8; i++) { const x = Math.floor(n(i, 7) * 15), y = Math.floor(n(7, i) * 15); P.set(x, y, shadeC(T.ground2, 0.25)); P.set(x, y + 1, shadeC(T.ground2, -0.2)); }
            break;
        }
        case 'path': {
            // flagstones with dark joints
            fill(T.path, 0.14, 3);
            const off = variant % 2 ? 4 : 0;
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const row = Math.floor(y / 8), jx = (x + (row % 2 ? 8 : 0) + off) % 8 === 0, jy = y % 8 === 0;
                if (jx || jy) P.set(x, y, shadeC(T.path, -0.35));
                else if (y % 8 === 1 || (x + (row % 2 ? 8 : 0) + off) % 8 === 1) P.set(x, y, shadeC(T.path, 0.12));
            }
            break;
        }
        case 'dock': {
            fill(T.dock, 0.1, 4);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x % 4 === 0) P.set(x, y, shadeC(T.dock, -0.4)); else if ((y * 3 + x) % 11 === 0) P.set(x, y, shadeC(T.dock, -0.15));
            P.set(2, 3, '#2a1a10'); P.set(6, 11, '#2a1a10'); P.set(10, 5, '#2a1a10'); P.set(14, 13, '#2a1a10');
            break;
        }
        case 'wall': case 'cliff': {
            const base = kind === 'wall' ? T.wall : T.cliff;
            fill(base, 0.12, 5);
            // blocks / strata
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const row = Math.floor(y / 4), jx = (x + row * 5) % 8 === 0, jy = y % 4 === 0;
                if (jy || jx) P.set(x, y, shadeC(base, -0.3));
                else if (y % 4 === 1) P.set(x, y, shadeC(base, 0.1));
            }
            break;
        }
        case 'house': {
            fill(T.house, 0.06, 6);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (y % 5 === 0) P.set(x, y, shadeC(T.house, -0.18));
            // a little window
            for (let y = 5; y < 10; y++) for (let x = 5; x < 11; x++) P.set(x, y, y === 5 || x === 5 || x === 10 || y === 9 ? shadeC(T.house, -0.45) : (T.day ? '#5a8ab8' : '#ffd38a'));
            break;
        }
        case 'roof': {
            fill(T.roof, 0.08, 7);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (y % 3 === 0) P.set(x, y, shadeC(T.roof, -0.25)); else if ((x + Math.floor(y / 3) * 2) % 4 === 0) P.set(x, y, shadeC(T.roof, -0.12));
            break;
        }
        case 'top': {
            // the top of a wall: the ground colour of the place, darker, with grass or snow edges
            fill(mix(hex(T.wall), hex(T.ground), 0.35), 0.14, 8);
            break;
        }
        default: fill('#ff00ff', 0, 0);
    }
    return mkTex(P.toCanvas());
}

/** Billboard props: trees, coral, flowers, wheat, as pixel textures. */
export function propPx(kind, theme) {
    const T = THEMES[theme];
    let P;
    if (kind === 'palm') {
        P = new Px(32, 48);
        P.mpoly([[15, 47], [18, 47], [19, 16], [16, 16]]).paint('#9a6a3a', { tex: (x, y) => (y % 4 === 0 ? -1 : 0) });
        for (const [a, b] of [[[17, 16], [3, 22]], [[17, 16], [30, 23]], [[17, 15], [7, 8]], [[17, 15], [27, 7]], [[17, 14], [17, 2]]]) P.mline(a[0], a[1], b[0], b[1], 4);
        P.paint('#3aa84a', { tex: (x, y) => ((x + y) % 3 === 0 ? 1 : 0) });
        P.mell(16, 17, 2, 2).mell(19, 18, 2, 2).paint('#6a4a2a');
    } else if (kind === 'oak') {
        P = new Px(32, 44);
        P.mrect(14, 28, 5, 16).paint('#7a5a3a');
        P.mell(16, 18, 13, 12).paint('#4a9a3a', { tex: (x, y) => ((x * 3 + y * 5) % 7 === 0 ? 1 : (x + y) % 9 === 0 ? -1 : 0) });
        P.mell(11, 13, 6, 5).paint('#6ab84a');
        for (const [x, y] of [[9, 20], [20, 12], [22, 22]]) P.mell(x, y, 1.4, 1.4).paint('#e84a4a');
    } else if (kind === 'pine') {
        P = new Px(28, 48);
        P.mrect(12, 38, 4, 10).paint('#6a4a3a');
        for (let i = 0; i < 4; i++) P.mpoly([[14, 4 + i * 8], [26 - i, 18 + i * 7], [2 + i, 18 + i * 7]]);
        P.paint('#2a6a5a', { tex: (x, y) => ((x + y) % 4 === 0 ? -1 : 0) });
        for (let i = 0; i < 4; i++) P.mpoly([[14, 4 + i * 8], [20 - i, 14 + i * 7], [8 + i, 14 + i * 7]]);
        P.paint('#f4f8ff', { soft: true });
    } else if (kind === 'shroom') {
        // glowing cave mushrooms
        P = new Px(28, 36);
        P.mrect(12, 18, 4, 18).mrect(5, 26, 3, 10).mrect(21, 24, 3, 12).paint('#d8d0e8');
        const c = T.lightCol ? '#' + T.lightCol.toString(16).padStart(6, '0') : '#7ff6ff';
        P.mell(14, 16, 10, 6).msub((q) => q.mrect(0, 18, 28, 10)).paint(c, { light: '#ffffff' });
        P.mell(6, 25, 5, 3).msub((q) => q.mrect(0, 26, 28, 10)).paint(c);
        P.mell(22, 23, 5, 3).msub((q) => q.mrect(0, 24, 28, 10)).paint(c);
        for (const [x, y] of [[10, 13], [16, 12], [19, 15]]) P.set(x, y, '#ffffff');
    } else if (kind === 'coral') {
        P = new Px(24, 30);
        for (const [a, b] of [[[12, 30], [12, 6]], [[12, 20], [4, 10]], [[12, 16], [20, 6]], [[6, 14], [3, 4]], [[18, 10], [22, 2]]]) P.mline(a[0], a[1], b[0], b[1], 3);
        P.paint('#ff7a8a', { tex: (x, y) => ((x + y) % 4 === 0 ? 1 : 0) });
    } else if (kind === 'flowers') {
        P = new Px(16, 10);
        const cols = ['#ff7aa8', '#ffe27a', '#ffffff', '#a88aff'];
        for (let i = 0; i < 5; i++) { const x = 2 + i * 3, y = 3 + (i % 2) * 3; P.mline(x, y + 1, x, 10).fill('#3a8a3a'); P.mell(x, y, 1.5, 1.5).paint(cols[i % 4]); }
    } else if (kind === 'wheat') {
        P = new Px(16, 22);
        for (let i = 0; i < 6; i++) { const x = 1 + i * 2.6; P.mline(x, 22, x + (i % 2 ? 1 : -1), 6).fill('#b8902a'); P.mell(x + (i % 2 ? 1 : -1), 5, 1.4, 3).paint('#f0c84a'); }
    } else if (kind === 'grass') {
        P = new Px(12, 8);
        for (let i = 0; i < 5; i++) P.mline(1 + i * 2.5, 8, 1 + i * 2.5 + (i % 2 ? 1 : -1), 2 + (i % 3)).fill(i % 2 ? '#3a8a3a' : '#5ab84a');
    } else {
        P = new Px(8, 8); P.mell(4, 4, 3, 3).paint('#ff00ff');
    }
    P.outline('#1c1424', 0.6);
    return P;
}
