// Procedural wall, floor and ceiling textures in EGA colours, one atlas per theme.
// 8 columns × 4 rows of 32 px tiles. Tile numbers are in TILE.

import { Pix } from './pix.js';
import { hash3 } from '../rng.js';
import { THEMES } from '../sim/dungeon.js';

export const T = 32;
export const COLS = 8, ROWS = 2;
export const TILE = { wallA: 0, wallB: 1, sconce: 2, banner: 3, bones: 4, door: 5, arch: 6, floor: 7, floorB: 8, ceil: 9, down: 10, up: 11, moss: 12, crack: 13, grate: 14, rubble: 15 };

function bricks(p, ox, oy, a, m, h, seed, crack = false) {
    // 4 courses of bricks, offset every other course
    for (let r = 0; r < 4; r++) {
        const y0 = oy + r * 8, off = r % 2 ? 8 : 0;
        for (let bx = -1; bx < 3; bx++) {
            const x0 = ox + bx * 16 + off;
            for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
                const px = x0 + x, py = y0 + y;
                if (px < ox || px >= ox + T) continue;
                let c = a;
                if (y === 7 || x === 15) c = m;
                else if (y === 0) c = hash3(px, py, seed) < 0.22 ? h : a;
                else {
                    const n = hash3(px, py, seed + 7);
                    if (n < 0.05) c = m;
                    else if (((px + py) & 1) === 0 && y > 4 && n < 0.35) c = m;
                }
                p.px(px, py, c);
            }
        }
    }
    if (crack) { p.line(ox + 14, oy + 2, ox + 17, oy + 12, 0); p.line(ox + 17, oy + 12, ox + 13, oy + 22, 0); p.line(ox + 13, oy + 22, ox + 16, oy + 30, 0); }
}

export function buildAtlas(themeIdx) {
    const th = THEMES[themeIdx % THEMES.length];
    const [a, m, h] = th.wall, [fa, fb] = th.floor, [ca, cb] = th.ceil;
    const p = new Pix(T * COLS, T * ROWS);
    const at = (i) => [(i % COLS) * T, ((i / COLS) | 0) * T];
    const seed = themeIdx * 31;
    // walls
    for (const [i, s, crack] of [[TILE.wallA, 1, false], [TILE.wallB, 2, false], [TILE.sconce, 3, false], [TILE.banner, 4, false], [TILE.bones, 5, false], [TILE.moss, 6, false], [TILE.crack, 7, true], [TILE.rubble, 8, false]]) {
        const [ox, oy] = at(i);
        bricks(p, ox, oy, a, m, h, seed + s, crack);
    }
    {   // sconce: bracket, flame and a halo of light
        const [ox, oy] = at(TILE.sconce);
        p.rect(ox + 14, oy + 14, 4, 8, 8); p.rect(ox + 12, oy + 20, 8, 2, 8); p.rect(ox + 15, oy + 8, 2, 7, 6);
        p.px(ox + 15, oy + 6, 14); p.px(ox + 16, oy + 6, 14); p.rect(ox + 15, oy + 7, 2, 3, 14); p.px(ox + 15, oy + 9, 12); p.px(ox + 16, oy + 5, 15);
        for (const [dx, dy] of [[12, 8], [19, 8], [11, 12], [20, 12], [15, 3]]) p.px(ox + dx, oy + dy, h);
    }
    {   // banner
        const [ox, oy] = at(TILE.banner);
        const bc = { crypt: 4, dungeon: 4, moss: 1, ice: 5, ember: 14, sewer: 6, amethyst: 13, bone: 4, fungal: 1, obsidian: 4 }[th.id];
        p.rect(ox + 8, oy + 3, 16, 2, 6); p.poly([[ox + 9, oy + 5], [ox + 23, oy + 5], [ox + 23, oy + 24], [ox + 16, oy + 29], [ox + 9, oy + 24]], bc);
        p.rect(ox + 15, oy + 9, 2, 12, 14); p.rect(ox + 11, oy + 13, 10, 2, 14);
    }
    {   // bones in a heap
        const [ox, oy] = at(TILE.bones);
        p.ell(ox + 10, oy + 26, 5, 4, 15); p.px(ox + 8, oy + 25, 0); p.px(ox + 12, oy + 25, 0); p.rect(ox + 9, oy + 28, 3, 2, 15);
        p.line(ox + 16, oy + 29, ox + 28, oy + 22, 15); p.line(ox + 18, oy + 30, ox + 29, oy + 25, 7); p.line(ox + 14, oy + 26, ox + 24, oy + 30, 7);
    }
    {   // moss and drips
        const [ox, oy] = at(TILE.moss);
        for (let i = 0; i < 70; i++) { const x = (hash3(i, 1, seed) * 32) | 0, y = (hash3(i, 2, seed) * 32) | 0; if (y < 8 + hash3(x, 0, seed) * 16) p.px(ox + x, oy + y, hash3(i, 3, seed) < 0.5 ? 2 : 10); }
    }
    {   // rubble
        const [ox, oy] = at(TILE.rubble);
        for (const [x, y, r] of [[8, 27, 4], [16, 29, 3], [23, 26, 5], [28, 30, 2]]) p.ell(ox + x, oy + y, r, r * 0.7, h);
    }
    {   // door: planks, iron bands and a ring
        const [ox, oy] = at(TILE.door);
        p.rect(ox, oy, T, T, 0);
        for (let x = 2; x < 30; x++) for (let y = 2; y < T; y++) {
            const plank = ((x - 2) / 7) | 0;
            let c = 6; if ((x - 2) % 7 === 6) c = 0; else if (hash3(x, y, 9 + plank) < 0.12) c = 0; else if (hash3(x, y, 3) > 0.9) c = 14;
            p.px(ox + x, oy + y, c);
        }
        p.rect(ox + 2, oy + 6, 28, 2, 8); p.rect(ox + 2, oy + 24, 28, 2, 8);
        p.ell(ox + 24, oy + 17, 2.5, 2.5, 14); p.ell(ox + 24, oy + 17, 1, 1, 0);
        p.rect(ox, oy, T, 2, 8); p.rect(ox, oy, 2, T, 8); p.rect(ox + 30, oy, 2, T, 8);
    }
    {   // an open doorway: arch cut out of the wall, wooden frame around it
        const [ox, oy] = at(TILE.arch);
        bricks(p, ox, oy, a, m, h, seed + 11);
        p.ctx.clearRect(ox + 6, oy + 10, 20, 22);
        p.ctx.clearRect(ox + 8, oy + 6, 16, 6);
        p.ctx.clearRect(ox + 11, oy + 4, 10, 3);
        for (let y = 5; y < 32; y++) { p.px(ox + 5, oy + y, 6); p.px(ox + 26, oy + y, 6); }
        p.rect(ox + 8, oy + 4, 16, 1, 6);
        p.px(ox + 6, oy + 9, 6); p.px(ox + 25, oy + 9, 6);
    }
    // floors
    for (const [i, s] of [[TILE.floor, 1], [TILE.floorB, 2]]) {
        const [ox, oy] = at(i);
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
            const edge = x === 0 || y === 0 || (x === 16 && y < 16) || (y === 16 && x >= 16) || (y === 16 && x < 8 && false);
            let c = (x + y) & 1 && hash3(x, y, s + seed) < 0.5 ? fb : fa;
            if (edge) c = 0;
            else if (hash3(x, y, 40 + s + seed) < 0.06) c = fb === 0 ? fa : fb;
            p.px(ox + x, oy + y, c);
        }
    }
    {   // ceiling
        const [ox, oy] = at(TILE.ceil);
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) p.px(ox + x, oy + y, (x % 16 === 0 || y % 16 === 0) ? cb : (hash3(x, y, seed + 70) < 0.08 ? cb : ca));
    }
    {   // stairs down: nested rectangles getting darker; up: lighter
        for (const [i, down] of [[TILE.down, true], [TILE.up, false]]) {
            const [ox, oy] = at(i);
            p.rect(ox, oy, T, T, fa);
            for (let k = 0; k < 7; k++) {
                const c = down ? [8, 8, 7, 8, 0, 0, 0][k] : [15, 7, 15, 7, 15, 7, 15][k];
                p.rect(ox + 2 + k * 2, oy + 2 + k * 2, T - 4 - k * 4, T - 4 - k * 4, k % 2 ? (down ? 0 : 7) : c);
            }
            p.rect(ox + 13, oy + 13, 6, 6, down ? 0 : 14);
            for (let k = 0; k < 4; k++) { p.px(ox + 1, oy + 1 + k, 14); p.px(ox + 30, oy + 30 - k, 14); }
        }
    }
    {   // grate
        const [ox, oy] = at(TILE.grate);
        p.rect(ox, oy, T, T, 0); for (let i = 3; i < 30; i += 5) { p.rect(ox + i, oy + 2, 2, 28, 8); p.rect(ox + 2, oy + i, 28, 2, 8); }
    }
    return p.canvas;
}
