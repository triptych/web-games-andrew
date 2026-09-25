// ============================================================
// Ground tiles, world objects, buildings and the Heartwood.
// ============================================================

import { Pix, hsl, ramp, shade, OUTLINE, h2 } from './core.js';
import { G, O } from '../../data/tiles.js';
import { BUILDING } from '../../data/buildings.js';
import { ITEM } from '../../data/items.js';
import { paintItem, ITEM_PAINTERS } from './items.js';

// ---------------------------------------------------------------- palettes
const GRASS_HUE = { 0: 95, 1: 118, 2: 78, 3: 140, 4: 35, 5: 200 };
export function grassRamp(rg, season, hueShift = 0, dark = false) {
    let h = GRASS_HUE[rg] ?? 95, s = 0.5, l = dark ? 0.405 : 0.44;
    if (rg === 1) { s = 0.48; l -= 0.04; }
    if (rg === 2) { s = 0.5; l += 0.04; }
    if (season === 1) { h -= 6; s += 0.05; }
    if (season === 2) { h -= 40; s += 0.05; l += 0.02; }
    return ramp(h + hueShift, s, l);
}

export function paintGround(g, rg, season, v, hueShift = 0) {
    const p = new Pix(16, 16);
    const rnd = (x, y, k = 0) => h2(v * 7 + k, x, y);
    const winter = season === 3 && rg !== 4;
    const fill = (base, speck, pr = 0.12, speck2 = null) => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const r = rnd(x, y);
            p.set(x, y, r < pr ? speck : speck2 && r > 1 - pr ? speck2 : base);
        }
    };
    switch (g) {
        case G.GRASS: case G.GRASS2: {
            if (winter || rg === 5) { const s = ramp(210, 0.25, 0.9); fill(s[1], s[3], 0.1, s[0]); if (rg !== 5 && rnd(3, 3, 9) < 0.5) p.set(rnd(1, 1) * 16, rnd(2, 2) * 16, grassRamp(rg, 0)[0]); break; }
            const r = grassRamp(rg, season, hueShift, g === G.GRASS2);
            fill(r[1], r[2], 0.08, r[0]);
            for (let k = 0; k < 4; k++) { const x = (rnd(k, 0, 3) * 15) | 0, y = (rnd(0, k, 4) * 13 + 2) | 0; p.set(x, y, r[0]); p.set(x, y - 1, r[2]); }
            break;
        }
        case G.PATH: { const r = ramp(35, 0.35, 0.58); fill(r[1], r[0], 0.08, r[2]); if (winter) for (let k = 0; k < 20; k++) p.set(rnd(k, 1) * 16, rnd(1, k) * 16, [240, 245, 250, 255]); break; }
        case G.SAND: { const r = ramp(45, 0.5, 0.72); fill(r[1], r[2], 0.1, r[0]); break; }
        case G.WATER: { const r = ramp(205 + hueShift * 0.3, 0.55, 0.45); fill(r[1], r[2], 0.03); for (let k = 0; k < 2; k++) { const x = (rnd(k, 5) * 10) | 0, y = (rnd(5, k) * 14) | 0; p.hline(x, x + 3, y, r[2]); } break; }
        case G.SHALLOW: { const r = ramp(185, 0.45, 0.55); fill(r[1], r[2], 0.06, r[0]); break; }
        case G.CLIFF: {
            const hue = rg === 4 ? 15 : rg === 5 ? 215 : rg === 3 ? 180 : 30;
            const r = ramp(hue, rg === 5 ? 0.12 : 0.18, rg === 5 ? 0.58 : 0.42);
            fill(r[1], r[0], 0.1, r[2]);
            for (let k = 0; k < 3; k++) { const x = (rnd(k, 9) * 12) | 0, y = (rnd(9, k) * 12) | 0; p.line(x, y, x + 3, y + 2, r[0]); }
            if (rg === 5) for (let x = 0; x < 16; x++) if (rnd(x, 0, 2) < 0.5) p.set(x, 0, [245, 250, 255, 255]);
            break;
        }
        case G.ROCKY: { const r = ramp(30, 0.14, 0.45); fill(r[1], r[0], 0.1, r[2]); break; }
        case G.ASH: { const r = ramp(20, 0.08, 0.3); fill(r[1], r[0], 0.12, [120, 50, 30, 255]); break; }
        case G.SNOW: { const r = ramp(210, 0.3, 0.88); fill(r[1], r[3], 0.08, r[0]); break; }
        case G.ICE: { const r = ramp(195, 0.5, 0.78); fill(r[1], r[3], 0.05); p.line(2, 12, 9, 5, r[3]); p.line(8, 14, 14, 9, r[2]); break; }
        case G.LAVA: { const r = ramp(18, 0.9, 0.5); fill(r[1], [255, 220, 90, 255], 0.08, r[0]); break; }
        case G.MARSH: { const r = ramp(150, 0.35, 0.36); fill(r[1], r[2], 0.1, r[0]); if (rnd(0, 0, 1) < 0.4) p.ellipse(8, 9, 3, 1.5, ramp(190, 0.4, 0.45)[1]); break; }
        case G.PLAZA: { const r = ramp(35, 0.12, 0.66); p.rect(0, 0, 16, 16, r[0]); for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const ox = x * 8 + (y % 2) * 4; p.rect(ox % 16 + 1, y * 8 + 1, 6, 6, rnd(x, y) < 0.5 ? r[1] : r[2]); } break; }
        case G.FARM: { const r = ramp(28, 0.4, 0.4); fill(r[1], r[2], 0.1, r[0]); break; }
        case G.FLOOR: { const hue = [30, 110, 60, 190, 12, 240][rg] ?? 30; const r = ramp(hue, 0.12, 0.38); p.rect(0, 0, 16, 16, r[0]); p.rect(1, 1, 7, 7, r[1]); p.rect(9, 1, 6, 7, r[1]); p.rect(1, 9, 14, 6, r[1]); if (rnd(2, 2) < 0.3) p.set(rnd(3, 3) * 14 + 1, 10, r[2]); break; }
        case G.WALL: { const hue = [30, 110, 60, 190, 12, 240][rg] ?? 30; const r = ramp(hue, 0.15, 0.26); p.rect(0, 0, 16, 16, r[1]); for (let y = 0; y < 16; y += 4) { p.hline(0, 15, y, r[0]); for (let x = (y / 4) % 2 * 4; x < 16; x += 8) p.vline(x, y, y + 3, r[0]); } break; }
        case G.VOID: p.rect(0, 0, 16, 16, [8, 6, 12, 255]); break;
        case G.BRIDGE: { const r = ramp(30, 0.45, 0.5); for (let y = 0; y < 16; y += 4) { p.rect(0, y, 16, 3, r[1 + ((y / 4) % 2)]); p.hline(0, 15, y + 3, r[0]); } break; }
    }
    return p;
}

// ---------------------------------------------------------------- objects
const TRUNK = ramp(25, 0.4, 0.34);
function canopy(p, cx, cy, rad, rmp, seed, blossoms) {
    p.circle(cx, cy, rad, rmp[1], (x, y) => {
        const n = h2(seed, (x * 9) | 0, (y * 9) | 0);
        if (y > 0.45 || (x > 0.5 && y > 0)) return rmp[0];
        if (x < -0.2 && y < -0.2) return n < 0.5 ? rmp[3] : rmp[2];
        return n < 0.15 ? rmp[2] : rmp[1];
    });
    for (let k = 0; k < 5; k++) { const a = h2(seed, k) * 6.28, d = h2(k, seed) * rad * 0.8; p.circle(cx + Math.cos(a) * d, cy + Math.sin(a) * d - 1, 2.2, rmp[2]); }
    if (blossoms) for (let k = 0; k < 9; k++) { const a = h2(seed, k, 3) * 6.28, d = h2(k, seed, 4) * rad * 0.9; p.set(cx + Math.cos(a) * d, cy + Math.sin(a) * d, blossoms); }
}
function treeRamp(rg, season, v) {
    if (season === 2) return ramp([20, 35, 50, 8][v % 4], 0.65, 0.48);
    if (rg === 3) return ramp(85, 0.45, 0.45);
    return ramp(rg === 2 ? 100 : 125, 0.5, season === 1 ? 0.34 : 0.38);
}

export function paintObject(o, v, rg, season, extra = {}) {
    const winter = season === 3 && rg !== 4;
    let p, ox = 0, oy = 0;
    switch (o) {
        case O.TREE: {
            p = new Pix(24, 34); ox = -4; oy = -18;
            p.rect(10, 22, 4, 12, TRUNK[1]); p.vline(10, 22, 33, TRUNK[2]); p.vline(13, 22, 33, TRUNK[0]); p.rect(9, 32, 6, 2, TRUNK[0]);
            if (winter) {
                for (const [a, b, c, d] of [[12, 22, 5, 10], [12, 22, 19, 9], [12, 18, 8, 6], [12, 18, 16, 5], [12, 14, 12, 4]]) p.line(a, b, c, d, TRUNK[1]);
                for (const [x, y] of [[5, 9], [19, 8], [8, 5], [16, 4], [12, 3]]) p.set(x, y - 1, [245, 250, 255, 255]);
            } else if (rg === 3) {
                canopy(p, 12, 12, 10, treeRamp(rg, season, v), v, null);
                for (let x = 3; x < 22; x += 3) p.vline(x, 14, 22 + (x % 5), treeRamp(rg, season, v)[0]);
            } else canopy(p, 12, 13, 10.5, treeRamp(rg, season, v), v * 13 + rg, season === 0 && (v % 3 === 0) ? [255, 190, 210, 255] : season === 1 && v % 5 === 0 ? [230, 60, 60, 255] : null);
            p.outline(OUTLINE); break;
        }
        case O.PINE: case O.OLDTREE: {
            const old = o === O.OLDTREE;
            p = new Pix(old ? 20 : 18, old ? 30 : 32); ox = old ? -2 : -1; oy = old ? -14 : -16;
            const w = p.w, r = old ? ramp(140, 0.35, 0.26) : ramp(150, 0.4, 0.3);
            p.rect((w >> 1) - 1, p.h - 6, 3, 6, TRUNK[0]);
            for (let layer = 0; layer < 4; layer++) {
                const top = 2 + layer * 6, bot = top + 10, half = 3 + layer * 2.2;
                for (let y = top; y < bot && y < p.h - 4; y++) { const t = (y - top) / 10; const hw = half * t + 1; p.hline(w / 2 - hw, w / 2 + hw - 1, y, t < 0.3 ? r[2] : y % 3 === 0 ? r[0] : r[1]); }
                if (winter || rg === 5) p.hline(w / 2 - half * 0.3, w / 2 + half * 0.3, top + 3, [240, 245, 255, 255]);
            }
            p.outline(OUTLINE); break;
        }
        case O.DEADTREE: { p = new Pix(16, 28); oy = -12; const r = ramp(20, 0.1, 0.35); p.rect(7, 10, 3, 18, r[1]); p.line(8, 14, 2, 6, r[1]); p.line(9, 12, 14, 4, r[1]); p.line(8, 8, 8, 1, r[1]); p.outline(OUTLINE); break; }
        case O.BUSH: { p = new Pix(16, 16); const r = winter ? ramp(210, 0.2, 0.8) : ramp(115, 0.45, 0.36); p.circle(8, 10, 6, r[1], (x, y) => (y < -0.3 ? r[2] : y > 0.4 ? r[0] : r[1])); p.circle(5, 8, 3, r[2]); if (!winter && season < 2 && v % 3 === 0) { p.set(6, 9, [220, 60, 90, 255]); p.set(10, 11, [220, 60, 90, 255]); } p.outline(OUTLINE); break; }
        case O.ROCK: case O.BIGROCK: case O.ORE: {
            const big = o === O.BIGROCK;
            p = new Pix(16, 16);
            const hue = rg === 4 ? 15 : rg === 5 ? 215 : 30;
            const r = ramp(hue, big ? 0.12 : 0.1, big ? 0.4 : 0.5);
            p.ellipse(8, big ? 9 : 10, big ? 7.5 : 6, big ? 6.5 : 4.8, r[1], (x, y) => (x < -0.3 && y < -0.2 ? r[3] : y > 0.35 ? r[0] : x > 0.4 ? r[0] : r[1]));
            if (big) { p.line(5, 6, 8, 10, r[0]); p.line(8, 10, 12, 8, r[0]); }
            if (o === O.ORE) { const oreHue = [0, 22, 215, 48, 280, 0][v] ?? 22; const orr = ramp(oreHue, v === 5 ? 0 : 0.7, v === 5 ? 0.15 : 0.6); for (const [x, y] of [[5, 9], [9, 11], [10, 8], [6, 12], [11, 11]]) { p.set(x, y, orr[2]); p.set(x + 1, y, orr[1]); } }
            if (winter && rg !== 5) p.hline(5, 10, 6, [245, 250, 255, 255]);
            p.outline(OUTLINE); break;
        }
        case O.GEM: { const it = ITEM[extra.gem ?? 'emerald']; p = new Pix(16, 16); const r = ramp(it.hue, 0.6, 0.55); const rk = ramp(30, 0.1, 0.45); p.ellipse(8, 12, 6, 3, rk[1]); for (const [x, h] of [[5, 7], [8, 10], [11, 6]]) { p.rect(x - 1, 13 - h, 3, h, r[1]); p.vline(x - 1, 13 - h, 12, r[3]); } p.outline(OUTLINE); break; }
        case O.CRYSTAL: { p = new Pix(16, 16); const r = rg === 4 ? ramp(55, 0.8, 0.6) : ramp(195, 0.6, 0.7); for (const [x, h] of [[5, 8], [8, 12], [11, 7]]) { p.rect(x - 1, 15 - h, 3, h, r[1]); p.vline(x - 1, 15 - h, 14, r[3]); p.set(x, 14 - h, r[2]); } p.outline(OUTLINE); break; }
        case O.WEED: { p = new Pix(16, 16); const r = winter ? ramp(40, 0.2, 0.5) : ramp(100, 0.5, 0.35); for (let k = 0; k < 5; k++) p.line(4 + k * 2, 14, 3 + k * 2.4 + (k % 2), 6 + (k % 3), r[k % 2 ? 1 : 2]); p.outline(OUTLINE); break; }
        case O.TUFT: { p = new Pix(16, 16); const r = winter ? ramp(45, 0.25, 0.6) : season === 2 ? ramp(45, 0.5, 0.5) : ramp(90, 0.55, 0.45); for (let k = 0; k < 7; k++) p.line(3 + k * 1.6, 15, 2 + k * 1.8, 7 + (k % 3) * 2, r[k % 3]); break; }
        case O.FLOWER: {
            p = new Pix(16, 16);
            if (winter) break;
            const hue = [0, 50, 280, 200, 330, 30][v % 6];
            for (let k = 0; k < 3; k++) { const x = 3 + ((v * 7 + k * 5) % 10), y = 5 + ((v * 3 + k * 4) % 8); p.vline(x, y + 1, y + 3, [60, 130, 50, 255]); p.set(x, y, hsl(hue, 0.7, 0.65)); p.set(x - 1, y, hsl(hue, 0.7, 0.75)); p.set(x + 1, y, hsl(hue, 0.7, 0.55)); p.set(x, y - 1, hsl(hue, 0.7, 0.75)); p.set(x, y, [255, 240, 150, 255]); }
            break;
        }
        case O.STUMP: { p = new Pix(16, 16); p.ellipse(8, 10, 5, 3, TRUNK[1]); p.rect(3, 10, 10, 4, TRUNK[1]); p.ellipse(8, 10, 4, 2.3, ramp(35, 0.4, 0.6)[1]); p.ellipse(8, 10, 1.8, 1, TRUNK[1]); p.outline(OUTLINE); break; }
        case O.THORN: { p = new Pix(16, 18); oy = -2; const r = ramp(300, 0.35, 0.3), g = ramp(110, 0.4, 0.3); for (let k = 0; k < 9; k++) { const a = k * 0.7; p.line(8 + Math.cos(a) * 7, 12 + Math.sin(a) * 5, 8 - Math.cos(a) * 6, 6 - Math.sin(a * 1.3) * 5, k % 2 ? r[1] : g[1]); } for (let k = 0; k < 10; k++) p.set(2 + h2(k, 1) * 12, 2 + h2(1, k) * 14, [240, 230, 220, 255]); p.outline(OUTLINE); break; }
        case O.BOULDER: { p = new Pix(18, 20); ox = -1; oy = -4; const r = ramp(30, 0.12, 0.5); p.ellipse(9, 11, 8.5, 8.5, r[1], (x, y) => (x < -0.3 && y < -0.3 ? r[3] : y > 0.4 ? r[0] : r[1])); p.line(6, 5, 9, 11, r[0]); p.line(9, 11, 7, 17, r[0]); p.line(9, 11, 14, 9, r[0]); p.ellipse(6, 5, 3, 1.5, ramp(110, 0.4, 0.4)[1]); p.outline(OUTLINE); break; }
        case O.DARK: { p = new Pix(16, 20); oy = -4; for (let y = 0; y < 20; y++) for (let x = 0; x < 16; x++) { const n = h2(x + (extra.frame ?? 0), y, 77); const d = Math.hypot(x - 8, y - 11) / 10; if (n > d * 0.6) p.set(x, y, [10, 6, 20, Math.min(255, 255 * (1.1 - d))]); } p.set(5, 9, [200, 180, 255, 255]); p.set(10, 9, [200, 180, 255, 255]); break; }
        case O.CHEST: { p = new Pix(16, 16); const open = extra.open; const s = extra.special ? ramp(45, 0.6, 0.5) : ramp(28, 0.5, 0.42); p.rect(2, 6, 12, 8, s[1]); p.rect(2, open ? 3 : 6, 12, 3, s[2]); if (!open) p.hline(2, 13, 9, s[0]); else p.rect(3, 7, 10, 2, [20, 14, 20, 255]); p.rect(7, open ? 5 : 8, 2, 3, hsl(45, 0.8, 0.6)); p.outline(OUTLINE); break; }
        case O.SIGN: case O.LOTSIGN: { p = new Pix(16, 16); const w = ramp(30, 0.45, 0.5); p.vline(7, 8, 15, w[0]); p.vline(8, 8, 15, w[1]); p.rect(2, 2, 12, 7, w[1]); p.hline(2, 13, 2, w[2]); p.hline(3, 12, 4, w[0]); p.hline(3, 10, 6, w[0]); if (extra.locked) p.rect(10, 6, 3, 3, [180, 60, 60, 255]); p.outline(OUTLINE); break; }
        case O.BOARD: {
            p = new Pix(24, 28); ox = -4; oy = -12; const w = ramp(30, 0.45, 0.45);
            if (!extra.built) { p.vline(6, 16, 27, w[1]); p.vline(17, 16, 27, w[1]); p.hline(4, 19, 20, [230, 220, 180, 255]); p.rect(9, 12, 6, 6, [240, 235, 210, 255]); p.set(11, 14, [60, 50, 60, 255]); p.set(12, 13, [60, 50, 60, 255]); p.set(12, 16, [60, 50, 60, 255]); p.outline(OUTLINE); break; }
            p.vline(4, 6, 27, w[0]); p.vline(19, 6, 27, w[0]); p.rect(2, 4, 20, 16, w[1]); p.rect(3, 5, 18, 14, ramp(30, 0.35, 0.62)[1]); p.rect(1, 2, 22, 3, ramp(0, 0.5, 0.45)[1]);
            for (let k = 0; k < (extra.posts ?? 3); k++) { const x = 4 + (k % 3) * 6, y = 6 + Math.floor(k / 3) * 6; p.rect(x, y, 5, 5, [245, 240, 225, 255]); p.hline(x + 1, x + 3, y + 2, [120, 110, 120, 255]); p.set(x + 2, y, [220, 50, 50, 255]); }
            p.outline(OUTLINE); break;
        }
        case O.BIN: { p = new Pix(16, 16); const w = ramp(28, 0.5, 0.45); p.rect(1, 5, 14, 10, w[1]); p.rect(0, 3, 16, 3, w[2]); p.hline(1, 14, 10, w[0]); p.rect(6, 7, 4, 2, [230, 200, 80, 255]); p.outline(OUTLINE); break; }
        case O.RUIN: { p = new Pix(16, 22); oy = -6; const r = ramp(40, 0.1, 0.62); p.rect(4, 4, 8, 17, r[1]); p.vline(4, 4, 20, r[2]); p.hline(3, 12, 3, r[2]); p.hline(3, 12, 21, r[0]); p.outline(OUTLINE); break; }
        case O.LILY: { p = new Pix(16, 16); const r = ramp(120, 0.5, 0.4); p.ellipse(8, 9, 5, 3, r[1]); p.set(8, 8, [0, 0, 0, 0]); if (v % 3 === 0) p.circle(9, 8, 1.5, [255, 200, 220, 255]); break; }
        case O.REED: { p = new Pix(16, 18); oy = -2; const g = ramp(90, 0.45, 0.4); for (let k = 0; k < 3; k++) { const x = 4 + k * 4; p.vline(x, 4 + k, 17, g[1]); p.rect(x, 3 + k, 1, 4, ramp(25, 0.5, 0.35)[1]); } break; }
        case O.TORCH: { p = new Pix(16, 16); const f = extra.frame ?? 0; p.rect(7, 8, 2, 6, TRUNK[1]); p.circle(8, 6 - f * 0.5, 2.5, [255, 150, 40, 255]); p.circle(8, 6.5 - f * 0.5, 1.3, [255, 240, 150, 255]); break; }
        case O.PEDESTAL: { p = new Pix(16, 16); const r = ramp(220, 0.08, 0.6); p.rect(4, 8, 8, 7, r[1]); p.rect(3, 6, 10, 2, r[2]); p.rect(3, 14, 10, 2, r[0]); p.outline(OUTLINE); break; }
        case O.UP: case O.DOWN: {
            p = new Pix(16, 16); const r = ramp(30, 0.1, 0.5);
            if (o === O.DOWN) { p.rect(1, 1, 14, 14, [14, 10, 18, 255]); for (let k = 0; k < 4; k++) p.rect(2 + k, 2 + k * 3, 12 - k * 2, 2, r[3 - k]); }
            else { for (let k = 0; k < 4; k++) p.rect(1 + k, 12 - k * 3, 14 - k * 2, 3, r[k]); p.rect(6, 0, 4, 2, [255, 255, 220, 200]); }
            p.outline(OUTLINE); break;
        }
        case O.LOCKED: { p = new Pix(16, 16); const w = ramp(28, 0.45, 0.35); p.rect(1, 1, 14, 14, w[1]); for (let x = 3; x < 14; x += 4) p.vline(x, 1, 14, w[0]); p.rect(6, 6, 4, 5, hsl(45, 0.8, 0.55)); p.set(7, 8, [20, 14, 20, 255]); p.set(8, 8, [20, 14, 20, 255]); p.outline(OUTLINE); break; }
        case O.KEY: { p = paintItem(ITEM.dungeon_key); break; }
        case O.FORAGE: { p = paintItem(ITEM[extra.item] ?? ITEM.wild_berry); break; }
        case O.PLACED: { p = paintPlaced(extra.item, extra); oy = p.h > 16 ? 16 - p.h : 0; break; }
        case O.GLIMMER: { const r = paintGlimmer(extra.kind, extra.awake, extra.used); p = r.p; ox = r.ox; oy = r.oy; break; }
        case O.HEART: case O.FACADE: return null;
        default: return null;
    }
    return { p, ox, oy };
}

function paintPlaced(id, extra) {
    if (id === 'lamp') { const p = new Pix(16, 28); p.vline(7, 8, 27, [60, 60, 72, 255]); p.vline(8, 8, 27, [80, 80, 96, 255]); p.rect(5, 26, 6, 2, [50, 50, 60, 255]); p.rect(4, 2, 8, 7, extra.night ? [255, 230, 140, 255] : [220, 220, 200, 255]); p.rect(3, 1, 10, 1, [50, 50, 60, 255]); p.rect(3, 9, 10, 1, [50, 50, 60, 255]); p.outline(OUTLINE); return p; }
    if (id === 'fence') { const p = new Pix(16, 16); const w = ramp(30, 0.45, 0.55); p.rect(1, 4, 2, 11, w[2]); p.rect(13, 4, 2, 11, w[2]); p.hline(0, 15, 7, w[1]); p.hline(0, 15, 11, w[1]); p.outline(OUTLINE); return p; }
    const p = paintItem(ITEM[id] ?? ITEM.chest_item);
    if (id === 'furnace' && extra.busy) { p.rect(6, 8, 4, 4, [255, 200, 60, 255]); }
    return p;
}

export function paintGlimmer(kind, awake, used) {
    let p = new Pix(16, 16), ox = 0, oy = 0;
    if (!awake) return { p, ox, oy };      // faded: nothing to see
    const glow = [255, 245, 170, 90];
    switch (kind) {
        case 'acorn': p.circle(8, 9, 6, glow); p.ellipse(8, 10, 3.5, 4, hsl(40, 0.8, 0.55), (x, y) => (x < -0.2 && y < -0.2 ? hsl(45, 0.9, 0.8) : hsl(40, 0.8, 0.55))); p.ellipse(8, 6.5, 4, 1.8, hsl(25, 0.5, 0.35)); p.set(8, 4, hsl(25, 0.5, 0.35)); break;
        case 'starfruit': p.circle(8, 8, 6.5, glow); ITEM_PAINTERS.star(p, ramp(50, 0.9, 0.55)); break;
        case 'scroll': p.circle(8, 8, 6.5, glow); ITEM_PAINTERS.scroll(p, ramp(280, 0.6, 0.55)); break;
        case 'cache': p.circle(8, 9, 7, glow); { const s = ramp(275, 0.5, 0.45); p.rect(2, 7, 12, 7, s[1]); p.rect(2, used ? 4 : 6, 12, 3, s[2]); p.rect(7, 8, 2, 3, hsl(50, 0.9, 0.6)); } break;
        case 'ring': {
            p = new Pix(32, 32); ox = -8; oy = -8;
            for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; const x = 16 + Math.cos(t) * 11, y = 16 + Math.sin(t) * 9; p.rect(x - 1, y, 3, 3, [240, 235, 225, 255]); p.ellipse(x, y, 2.6, 1.6, hsl(a % 2 ? 330 : 280, 0.6, 0.6)); }
            p.ellipse(16, 17, 8, 6, [200, 255, 230, 60]);
            break;
        }
        case 'shrine': { p = new Pix(16, 24); oy = -8; const r = ramp(220, 0.08, 0.6); p.rect(3, 12, 10, 11, r[1]); p.rect(1, 9, 14, 3, r[2]); p.rect(2, 22, 12, 2, r[0]); p.circle(8, 5, 3.5, used ? [180, 190, 210, 255] : [180, 255, 230, 255]); p.circle(8, 5, 5.5, used ? [0, 0, 0, 0] : [180, 255, 230, 70]); p.rect(6, 15, 4, 5, r[0]); break; }
        case 'moonwell': { p = new Pix(20, 20); ox = -2; oy = -4; const r = ramp(220, 0.1, 0.55); p.ellipse(10, 12, 9, 6, r[1]); p.ellipse(10, 11, 7, 4, used ? [60, 80, 110, 255] : [170, 220, 255, 255]); p.ellipse(10, 11, 3, 1.5, [255, 255, 255, 200]); p.rect(1, 12, 18, 6, r[1]); p.hline(1, 18, 17, r[0]); break; }
    }
    p.outline(OUTLINE);
    return { p, ox, oy };
}

// ---------------------------------------------------------------- facades
export function paintFacade(kind, rg) {
    const p = new Pix(48, 40);
    if (kind === 'dungeon') {
        const hue = [30, 110, 60, 190, 12, 240][rg];
        const r = ramp(hue, 0.12, 0.5);
        p.rect(2, 10, 44, 30, r[1]);
        for (let y = 10; y < 40; y += 5) { p.hline(2, 45, y, r[0]); for (let x = 2 + ((y / 5) % 2) * 5; x < 46; x += 10) p.vline(x, y, y + 4, r[0]); }
        p.rect(0, 6, 48, 5, r[2]); for (let x = 0; x < 48; x += 8) p.rect(x, 2, 5, 5, r[2]);
        p.rect(16, 20, 16, 20, [12, 8, 16, 255]); p.circle(24, 20, 8, [12, 8, 16, 255]);
        p.vline(15, 16, 39, r[3]); p.vline(32, 16, 39, r[3]);
        p.circle(24, 13, 3, hsl(hue + 180, 0.6, 0.6));
    } else {
        const hue = rg === 4 ? 15 : rg === 5 ? 215 : 30;
        const r = ramp(hue, 0.14, 0.45);
        p.ellipse(24, 30, 23, 18, r[1], (x, y) => (x < -0.3 && y < -0.3 ? r[2] : y > 0.5 ? r[0] : r[1]));
        p.ellipse(24, 34, 9, 10, [12, 8, 16, 255]);
        p.rect(15, 34, 18, 6, [12, 8, 16, 255]);
        p.line(16, 26, 20, 29, r[0]); p.line(30, 22, 34, 28, r[0]);
    }
    p.outline(OUTLINE);
    return p;
}

// ---------------------------------------------------------------- buildings (64 x 80)
export function paintBuilding(type, opt = {}) {
    const p = new Pix(64, 80);
    const B = BUILDING[type];
    const roofH = opt.roof ?? B?.roof ?? 20, wallH = opt.wall ?? B?.wall ?? 35;
    const R = ramp(roofH, 0.5, 0.45), Wl = ramp(wallH, type === 'forge' || type === 'tower' || type === 'lodge' ? 0.1 : 0.35, 0.68);
    const woodR = ramp(28, 0.45, 0.38);
    const shape = opt.shape ?? type;
    const door = (x = 26) => { p.rect(x, 60, 12, 20, woodR[1]); p.rect(x, 60, 12, 2, woodR[2]); p.vline(x + 6, 62, 79, woodR[0]); p.set(x + 9, 70, hsl(45, 0.8, 0.6)); };
    const window = (x, y) => { p.rect(x, y, 10, 10, woodR[0]); p.rect(x + 1, y + 1, 8, 8, opt.night ? [255, 220, 130, 255] : [150, 200, 230, 255]); p.vline(x + 5, y + 1, y + 8, woodR[0]); p.hline(x + 1, x + 8, y + 5, woodR[0]); p.set(x + 2, y + 2, [255, 255, 255, 255]); };
    const walls = (top = 36) => { p.rect(3, top, 58, 80 - top, Wl[1]); for (let y = top + 4; y < 80; y += 6) p.hline(3, 60, y, Wl[0]); p.vline(3, top, 79, Wl[2]); p.vline(60, top, 79, Wl[0]); };
    const roof = (top = 6, bottom = 40) => {
        for (let y = top; y < bottom; y++) {
            const t = (y - top) / (bottom - top), hw = 12 + t * 20;
            p.hline(32 - hw, 32 + hw - 1, y, (y - top) % 5 === 0 ? R[0] : t < 0.15 ? R[2] : R[1]);
        }
        p.hline(0, 63, bottom - 1, R[0]);
    };
    const sign = (icon) => { p.rect(22, 44, 20, 12, woodR[2]); p.rect(23, 45, 18, 10, ramp(40, 0.4, 0.8)[1]); if (icon) { const ic = paintItem({ ic: icon, hue: B?.roof ?? 30 }); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const a = ic.d[(y * 16 + x) * 4 + 3]; if (a > 100 && (x % 2 === 0 || true)) { const s = 0.62; const X = 25 + Math.floor(x * s), Y = 45 + Math.floor(y * s); p.set(X + 2, Y, [ic.d[(y * 16 + x) * 4], ic.d[(y * 16 + x) * 4 + 1], ic.d[(y * 16 + x) * 4 + 2], 255]); } } } };
    const chimney = (x) => { p.rect(x, 4, 7, 14, ramp(10, 0.3, 0.4)[1]); p.rect(x - 1, 3, 9, 2, ramp(10, 0.3, 0.3)[1]); };

    switch (shape) {
        case 'tent': {
            const t = ramp(40, 0.4, 0.7);
            for (let y = 20; y < 80; y++) { const hw = (y - 20) * 0.5 + 2; p.hline(32 - hw, 32 + hw, y, y % 7 === 0 ? t[0] : x0(y) ? t[2] : t[1]); }
            function x0(y) { return y < 40; }
            p.rect(27, 60, 10, 20, [60, 40, 40, 255]); p.line(32, 60, 27, 79, t[2]); p.vline(32, 12, 20, woodR[0]); p.rect(33, 12, 8, 5, [220, 80, 80, 255]);
            break;
        }
        case 'barn': { walls(34); roof(4, 38); p.rect(20, 52, 24, 28, woodR[1]); p.line(20, 52, 43, 79, [240, 240, 240, 255]); p.line(43, 52, 20, 79, [240, 240, 240, 255]); p.rect(20, 52, 24, 2, [240, 240, 240, 255]); window(28, 40); break; }
        case 'greenhouse': {
            const g = [170, 230, 220, 200];
            p.rect(4, 30, 56, 50, g); for (let x = 4; x < 60; x += 8) p.vline(x, 30, 79, [230, 240, 235, 255]); for (let y = 30; y < 80; y += 10) p.hline(4, 59, y, [230, 240, 235, 255]);
            for (let y = 8; y < 31; y++) { const hw = 10 + (y - 8) * 0.95; p.hline(32 - hw, 32 + hw, y, y % 4 === 0 ? [230, 240, 235, 255] : g); }
            p.rect(26, 60, 12, 20, [140, 200, 190, 255]); for (let k = 0; k < 6; k++) p.circle(10 + k * 9, 72, 3, hsl(110 + k * 20, 0.5, 0.45));
            break;
        }
        case 'tower': {
            const s = ramp(215, 0.08, 0.6);
            p.rect(14, 8, 36, 72, s[1]); for (let y = 12; y < 80; y += 6) p.hline(14, 49, y, s[0]); p.vline(14, 8, 79, s[2]);
            for (let x = 12; x < 52; x += 8) p.rect(x, 2, 6, 7, s[2]); p.rect(12, 8, 40, 3, s[0]);
            p.rect(28, 20, 8, 12, [40, 30, 40, 255]); door(26); p.rect(40, 0, 2, 16, woodR[0]); p.rect(42, 0, 10, 6, R[1]);
            break;
        }
        case 'hall': {
            walls(38); roof(4, 42); window(8, 48); window(46, 48); door();
            p.rect(24, 8, 16, 14, ramp(45, 0.2, 0.85)[1]); p.circle(32, 15, 5, [250, 250, 240, 255]); p.line(32, 15, 32, 12, [40, 40, 40, 255]); p.line(32, 15, 34, 15, [40, 40, 40, 255]);
            p.rect(4, 38, 4, 42, ramp(40, 0.1, 0.85)[1]); p.rect(56, 38, 4, 42, ramp(40, 0.1, 0.85)[1]);
            break;
        }
        case 'library': { walls(38); roof(6, 42); for (const x of [6, 18, 42, 54]) { p.rect(x, 40, 4, 40, [235, 230, 215, 255]); p.vline(x, 40, 79, [255, 255, 245, 255]); } door(); window(8, 50); sign('scroll'); break; }
        default: {
            walls(38); roof(6, 42);
            if (opt.chimney || ['cabin', 'cafe', 'forge', 'farmhouse', 'tavern'].includes(type)) chimney(44);
            window(7, 50); window(47, 50); door();
            if (type !== 'cabin') sign(B?.icon); else { p.rect(8, 64, 10, 3, woodR[1]); for (let k = 0; k < 3; k++) p.circle(10 + k * 3, 63, 1.5, hsl(330 + k * 30, 0.7, 0.65)); }
            if (type === 'forge') { p.rect(48, 70, 10, 6, [70, 70, 80, 255]); p.rect(50, 66, 6, 4, [90, 90, 100, 255]); }
            if (type === 'coop') { p.rect(40, 70, 6, 6, [30, 20, 20, 255]); }
        }
    }
    if (opt.construction) { for (let y = 0; y < 80; y += 2) for (let x = (y / 2) % 4; x < 64; x += 4) if (p.get(x, y) > 0) p.set(x, y, [240, 200, 120, 120]); }
    p.outline(OUTLINE);
    return p;
}

// ---------------------------------------------------------------- the Heartwood (64 x 104), stage 0..5
export function paintHeartwood(stage, season) {
    const p = new Pix(80, 104);
    const bark = ramp(25, 0.3, stage ? 0.36 : 0.3);
    // roots and split trunk
    for (let y = 56; y < 104; y++) {
        const t = (y - 56) / 48, hw = 12 + t * t * 16;
        for (let x = 40 - hw; x < 40 + hw; x++) {
            const split = stage === 0 && Math.abs(x - 40) < 2.5 - t * 2 && y < 90;
            if (split) continue;
            const n = h2(x, y, 3);
            p.set(x, y, n < 0.15 ? bark[0] : x < 40 - hw * 0.5 ? bark[2] : bark[1]);
        }
    }
    for (let k = 0; k < 6; k++) p.line(40 + (k - 2.5) * 5, 100, 40 + (k - 2.5) * 11, 103, bark[0]);
    // branches
    const br = [[40, 60, 18, 26], [40, 60, 62, 24], [40, 58, 30, 14], [40, 58, 52, 12], [40, 60, 40, 6]];
    for (const [a, b, c, d] of br) { p.line(a, b, c, d, bark[1]); p.line(a + 1, b, c + 1, d, bark[0]); }
    if (stage > 0) {
        const leaf = season === 2 ? ramp(35, 0.7, 0.5) : season === 3 ? ramp(190, 0.3, 0.8) : ramp(120, 0.55, 0.42);
        const clusters = [[40, 22, 14], [20, 30, 12], [60, 28, 12], [30, 14, 10], [52, 14, 10], [40, 40, 12], [14, 42, 9], [66, 40, 9]];
        clusters.slice(0, 2 + stage + (stage >= 4 ? 2 : 0)).forEach(([x, y, r], k) => canopy(p, x, y, r * (0.6 + stage * 0.08), leaf, k * 31, null));
        if (stage >= 3) for (let k = 0; k < stage * 12; k++) { const x = 8 + h2(k, 9) * 64, y = 4 + h2(9, k) * 44; if (p.get(x, y) > 0) p.set(x, y, stage >= 5 ? hsl(320 + h2(k, 1) * 60, 0.8, 0.8) : [255, 250, 200, 255]); }
        if (stage >= 5) for (let k = 0; k < 30; k++) { const x = 6 + h2(k, 19) * 68, y = 2 + h2(19, k) * 50; if (p.get(x, y) > 0) p.set(x, y, [255, 240, 150, 255]); }
    }
    // the heart hollow
    p.ellipse(40, 76, 5, 7, stage >= 5 ? [255, 240, 170, 255] : stage > 0 ? [120, 240, 200, 255] : [30, 20, 26, 255]);
    for (let k = 0; k < stage; k++) p.circle(34 + k * 3, 90, 1.2, [150, 255, 220, 255]);
    p.outline(OUTLINE);
    return p;
}

// ---------------------------------------------------------------- crops and soil
export function paintSoil(watered) {
    const p = new Pix(16, 16);
    const r = watered ? ramp(25, 0.35, 0.24) : ramp(28, 0.42, 0.36);
    p.rect(1, 1, 14, 14, r[1]);
    for (let y = 3; y < 15; y += 4) p.hline(2, 13, y, r[0]);
    for (let y = 2; y < 15; y += 4) p.hline(2, 13, y, r[2]);
    return p;
}
export function paintCrop(crop, stage) {
    const p = new Pix(16, 20);
    const g = ramp(110, 0.55, 0.38), c = ramp(crop.hue, 0.65, 0.5);
    const Y = 19;
    if (stage === 0) { p.set(7, Y - 2, g[1]); p.set(8, Y - 3, g[2]); p.set(6, Y - 3, g[2]); p.set(8, Y - 1, g[0]); return p; }
    if (stage === 1) { p.vline(8, Y - 6, Y - 1, g[0]); p.ellipse(6, Y - 5, 2, 1, g[1]); p.ellipse(10, Y - 6, 2, 1, g[2]); p.outline(OUTLINE); return p; }
    const tall = crop.shape === 'corn' || crop.shape === 'grain';
    const h = stage === 2 ? (tall ? 12 : 8) : (tall ? 16 : 10);
    if (tall) {
        for (const x of [5, 8, 11]) { p.vline(x, Y - h, Y - 1, g[1]); p.line(x, Y - h + 5, x - 2, Y - h + 3, g[2]); }
        if (stage === 3) { if (crop.shape === 'corn') { p.ellipse(9, Y - 10, 1.8, 3.5, c[2]); p.ellipse(6, Y - 12, 1.8, 3.5, c[1]); } else for (const x of [5, 8, 11]) { p.rect(x - 1, Y - h - 1, 3, 4, c[2]); } }
    } else {
        p.vline(8, Y - h, Y - 1, g[0]);
        for (let k = 0; k < 4; k++) { const y = Y - 2 - k * (h / 4); p.ellipse(8 - 3, y, 2.6, 1.3, g[1 + (k % 2)]); p.ellipse(8 + 3, y - 1, 2.6, 1.3, g[1 + ((k + 1) % 2)]); }
        if (stage === 3) {
            if (['round', 'melon', 'pumpkin'].includes(crop.shape)) p.circle(8, Y - 3, crop.shape === 'round' ? 3 : 4.2, c[1], (x, y) => (x < -0.3 && y < -0.3 ? c[3] : c[1]));
            else if (crop.shape === 'root') { p.ellipse(8, Y - 2, 3, 2.2, c[1]); p.set(7, Y - 3, c[3]); }
            else if (crop.shape === 'leafy') p.circle(8, Y - 5, 3.4, c[2], (x, y) => (y < 0 ? c[3] : c[2]));
            else if (crop.shape === 'star') { p.circle(8, Y - h, 3, c[2]); p.set(8, Y - h, [255, 255, 220, 255]); p.set(5, Y - h - 2, [255, 255, 200, 255]); }
            else for (const [x, y] of [[5, Y - 6], [11, Y - 7], [8, Y - 4], [6, Y - 9], [10, Y - 3]]) p.circle(x, y, 1.4, c[1]);
        }
    }
    p.outline(OUTLINE);
    return p;
}
