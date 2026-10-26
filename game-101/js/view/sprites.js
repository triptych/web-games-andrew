// Procedural EGA sprites: monsters, strangers, things on the floor, item icons and face portraits.
// All made from filled shapes in the sixteen colours, then outlined in black.

import { Pix, rngFor, memo } from './pix.js';

const W = 48;

// ------------------------------------------------------------------ monsters
// Each draw(p, [base, shade, light], rnd) paints into a 48×48 canvas, facing the viewer.
const DRAW = {
    rat(p, [b, s, l], r) {
        p.ell(24, 32, 13, 8, b); p.ell(24, 35, 12, 5, s); p.ell(35, 29, 7, 6, b); p.ell(40, 31, 3, 2, l);
        p.ell(31, 22, 3, 4, l); p.ell(37, 22, 3, 4, l); p.px(37, 28, 12); p.px(38, 28, 12); p.px(43, 31, 0);
        p.line(11, 34, 3, 28, s); p.line(3, 28, 2, 22, s); p.rect(15, 38, 3, 4, s); p.rect(28, 38, 3, 4, s);
        for (let i = 0; i < 3; i++) p.px(41 + i, 33 + (i & 1), 15);
        p.ell(21, 29, 6, 3, l);
    },
    bat(p, [b, s, l], r) {
        p.ell(24, 26, 6, 8, b); p.ell(24, 22, 5, 5, b); p.poly([[19, 14], [20, 22], [24, 17]], s); p.poly([[29, 14], [28, 22], [24, 17]], s);
        p.poly([[18, 22], [2, 14], [4, 22], [1, 30], [8, 28], [10, 34], [17, 30]], s); p.poly([[30, 22], [46, 14], [44, 22], [47, 30], [40, 28], [38, 34], [31, 30]], s);
        p.line(2, 14, 17, 26, b); p.line(46, 14, 31, 26, b);
        p.px(21, 21, 12); p.px(27, 21, 12); p.px(22, 21, 12); p.px(26, 21, 12); p.px(23, 26, 15); p.px(25, 26, 15); p.ell(24, 28, 3, 3, l);
    },
    slime(p, [b, s, l], r) {
        for (let y = 14; y < 42; y++) {
            const t = (y - 14) / 28, w = Math.sqrt(1 - Math.pow(1 - Math.min(1, t * 1.3), 2)) * 20 * (y > 36 ? 1.05 : 1);
            p.rect(24 - w, y, Math.round(w * 2), 1, b);
        }
        p.rect(6, 40, 36, 3, s); p.ell(15, 22, 4, 3, l); p.ell(13, 26, 2, 2, l);
        p.rect(17, 27, 5, 5, 15); p.rect(27, 27, 5, 5, 15); p.rect(19, 28, 2, 4, 0); p.rect(29, 28, 2, 4, 0);
        p.line(20, 35, 28, 35, s); p.px(19, 34, s); p.px(29, 34, s);
        p.px(10, 36, l); p.px(37, 33, l);
        p.shadeBottom(s, 34);
    },
    goblin(p, [b, s, l], r) {
        p.rect(17, 28, 14, 14, 6); p.rect(17, 28, 14, 3, 14); p.rect(16, 40, 5, 5, s); p.rect(27, 40, 5, 5, s);
        p.ell(24, 18, 9, 9, b); p.poly([[14, 16], [3, 10], [13, 22]], b); p.poly([[34, 16], [45, 10], [35, 22]], b);
        p.px(20, 17, 14); p.px(28, 17, 14); p.px(20, 18, 0); p.px(28, 18, 0); p.line(21, 24, 27, 24, 0); p.px(22, 25, 15); p.px(26, 25, 15);
        p.ell(24, 20, 2, 2, s); p.line(36, 30, 42, 14, 6); p.ell(42, 12, 3, 4, 8); p.line(14, 30, 11, 36, b); p.line(34, 30, 37, 34, b);
        p.ell(21, 13, 4, 2, l);
    },
    skeleton(p, [b, s, l], r) {
        p.ell(24, 13, 8, 8, l); p.rect(18, 18, 12, 4, l); p.rect(19, 12, 4, 4, 0); p.rect(26, 12, 4, 4, 0); p.rect(23, 17, 2, 2, 0);
        for (let i = 0; i < 4; i++) p.rect(20 + i * 3, 20, 2, 2, 0);
        p.rect(23, 23, 3, 12, l);
        for (let i = 0; i < 4; i++) { p.line(24, 25 + i * 3, 15, 24 + i * 3, b); p.line(24, 25 + i * 3, 33, 24 + i * 3, b); }
        p.rect(19, 36, 10, 3, s); p.rect(19, 39, 3, 7, b); p.rect(27, 39, 3, 7, b);
        p.line(15, 25, 10, 36, b); p.line(33, 25, 40, 18, b); p.line(40, 18, 40, 6, 7); p.rect(38, 17, 5, 2, 6);
    },
    spider(p, [b, s, l], r) {
        p.ell(24, 30, 11, 9, b); p.ell(24, 20, 6, 5, s); p.ell(24, 33, 6, 4, l);
        for (let i = 0; i < 4; i++) { const y = 18 + i * 4; p.line(18, y + 4, 6 - i, y - 4 + i * 2, s); p.line(6 - i, y - 4 + i * 2, 3 - i, y + 8, s); p.line(30, y + 4, 42 + i, y - 4 + i * 2, s); p.line(42 + i, y - 4 + i * 2, 45 + i, y + 8, s); }
        p.px(21, 19, 12); p.px(27, 19, 12); p.px(23, 17, 12); p.px(25, 17, 12); p.px(22, 22, 15); p.px(26, 22, 15);
        p.ell(24, 29, 3, 3, 12); p.px(24, 29, 0);
    },
    wolf(p, [b, s, l], r) {
        p.ell(21, 29, 15, 9, b); p.ell(34, 20, 8, 7, b); p.poly([[40, 20], [47, 25], [41, 27]], l); p.px(46, 25, 0);
        p.poly([[30, 15], [30, 7], [35, 14]], b); p.poly([[36, 14], [40, 8], [41, 16]], b); p.px(37, 19, 14); p.px(38, 19, 0);
        p.rect(10, 34, 4, 10, s); p.rect(17, 36, 4, 8, b); p.rect(27, 36, 4, 8, b); p.rect(32, 33, 4, 11, s);
        p.poly([[7, 24], [0, 16], [4, 30]], s); p.ell(20, 25, 9, 3, l); p.line(42, 26, 43, 28, 15); p.line(45, 26, 44, 28, 15);
        p.ell(33, 24, 4, 3, l);
    },
    mushroom(p, [b, s, l], r) {
        p.ell(24, 17, 18, 12, b); p.rect(6, 18, 36, 6, b); p.rect(6, 24, 36, 2, s); p.rect(19, 25, 10, 17, l); p.rect(16, 40, 16, 4, s);
        for (let i = 0; i < 5; i++) p.ell(10 + rnd(r, 28), 9 + rnd(r, 12), 2 + rnd(r, 2), 2, 15);
        p.px(21, 31, 0); p.px(27, 31, 0); p.line(22, 35, 26, 35, 0); p.line(19, 30, 14, 34, l); p.line(29, 30, 34, 34, l);
        p.ell(24, 13, 4, 2, l);
    },
    zombie(p, [b, s, l], r) {
        p.ell(24, 11, 7, 8, b); p.rect(15, 18, 18, 17, 3); p.rect(15, 18, 18, 3, 1); p.rect(17, 34, 6, 12, 1); p.rect(26, 34, 6, 12, 1);
        p.rect(7, 19, 8, 4, b); p.rect(33, 19, 10, 4, b); p.rect(4, 17, 4, 4, b); p.rect(41, 17, 4, 4, b);
        p.px(21, 10, 12); p.px(27, 10, 12); p.px(21, 11, 0); p.px(27, 11, 0); p.rect(21, 15, 7, 2, 0); p.px(22, 15, 15); p.px(25, 15, 15);
        p.rect(17, 24, 3, 3, s); p.rect(28, 28, 4, 3, s); p.px(23, 7, 8); p.px(26, 6, 8); p.px(24, 6, 8);
    },
    snake(p, [b, s, l], r) {
        const pts = []; for (let i = 0; i < 14; i++) pts.push([10 + i * 2.4 + Math.sin(i * 0.9) * 2, 38 - Math.sin(i * 0.55) * 9 - i * 0.9]);
        pts.forEach(([x, y], i) => { p.ell(x, y + 2, 5 - i * 0.12, 4.5 - i * 0.12, s); });
        pts.forEach(([x, y], i) => { p.ell(x, y, 5 - i * 0.12, 4.5 - i * 0.12, i % 3 === 0 ? l : b); });
        const [hx, hy] = pts[pts.length - 1];
        p.ell(hx + 3, hy - 4, 7, 6, b); p.px(hx + 2, hy - 7, 14); p.px(hx + 6, hy - 7, 14); p.px(hx + 2, hy - 7, 0); p.px(hx + 6, hy - 7, 0);
        p.line(hx + 10, hy - 3, hx + 14, hy - 3, 12); p.px(hx + 15, hy - 4, 12); p.px(hx + 15, hy - 2, 12);
    },
    imp(p, [b, s, l], r) {
        p.ell(24, 26, 9, 10, b); p.ell(24, 13, 8, 8, b); p.poly([[17, 9], [13, 0], [21, 7]], l); p.poly([[31, 9], [35, 0], [27, 7]], l);
        p.poly([[16, 22], [2, 14], [8, 24], [3, 32], [14, 30]], s); p.poly([[32, 22], [46, 14], [40, 24], [45, 32], [34, 30]], s);
        p.px(21, 12, 14); p.px(27, 12, 14); p.px(21, 13, 0); p.px(27, 13, 0); p.line(20, 17, 28, 17, 0); p.px(21, 18, 15); p.px(27, 18, 15);
        p.rect(18, 34, 4, 9, s); p.rect(26, 34, 4, 9, s); p.line(32, 32, 42, 38, b); p.poly([[41, 36], [46, 36], [43, 42]], l);
        p.ell(24, 27, 4, 5, l);
    },
    ghost(p, [b, s, l], r) {
        for (let y = 6; y < 42; y++) { const w = y < 20 ? 8 + (y - 6) * 0.7 : 17; p.rect(24 - w, y, Math.round(w * 2), 1, b); }
        for (let i = 0; i < 6; i++) { const x = 7 + i * 6.2; p.poly([[x, 40], [x + 6, 40], [x + 3, 46 - (i & 1) * 2]], b); }
        p.ell(24, 14, 8, 8, b); p.rect(16, 20, 16, 4, b);
        p.ell(19, 18, 3, 4, 0); p.ell(29, 18, 3, 4, 0); p.ell(24, 28, 3, 4, 0); p.px(19, 17, l); p.px(29, 17, l);
        p.line(8, 28, 2, 36, b); p.line(40, 28, 46, 36, b); p.shadeBottom(s, 24);
    },
    crab(p, [b, s, l], r) {
        p.ell(24, 30, 16, 10, b); p.ell(24, 27, 12, 6, l); p.rect(10, 34, 28, 3, s);
        p.ell(6, 22, 6, 5, b); p.poly([[2, 20], [0, 12], [8, 18]], s); p.poly([[8, 22], [12, 14], [10, 22]], s);
        p.ell(42, 22, 6, 5, b); p.poly([[46, 20], [48, 12], [40, 18]], s); p.poly([[40, 22], [36, 14], [38, 22]], s);
        for (let i = 0; i < 3; i++) { p.line(10 + i * 2, 36 + i, 4, 40 + i * 2, s); p.line(38 - i * 2, 36 + i, 44, 40 + i * 2, s); }
        p.line(19, 22, 17, 14, s); p.line(29, 22, 31, 14, s); p.ell(17, 13, 3, 3, 15); p.ell(31, 13, 3, 3, 15); p.px(17, 13, 0); p.px(31, 13, 0);
    },
    eye(p, [b, s, l], r) {
        p.ell(24, 22, 16, 15, b); p.ell(24, 22, 12, 12, 15); p.ell(24, 22, 7, 7, s); p.ell(24, 22, 3, 4, 0); p.px(22, 19, 15);
        for (let i = 0; i < 6; i++) { const a = i * 1.05; p.line(24 + Math.cos(a) * 12, 22 + Math.sin(a) * 12, 24 + Math.cos(a) * 8, 22 + Math.sin(a) * 8, 12); }
        for (let i = 0; i < 4; i++) { p.line(14 + i * 7, 36, 12 + i * 8, 44, s); p.px(12 + i * 8, 44, l); }
        p.poly([[14, 10], [10, 2], [18, 8]], s); p.poly([[34, 10], [38, 2], [30, 8]], s);
    },
    golem(p, [b, s, l], r) {
        p.rect(14, 18, 20, 18, b); p.rect(14, 18, 20, 4, l); p.rect(12, 22, 6, 14, s); p.rect(30, 22, 6, 14, s);
        p.rect(17, 5, 14, 13, b); p.rect(17, 5, 14, 3, l); p.rect(20, 11, 3, 3, 14); p.rect(27, 11, 3, 3, 14);
        p.rect(3, 20, 10, 12, b); p.rect(35, 20, 10, 12, b); p.rect(2, 32, 12, 8, s); p.rect(34, 32, 12, 8, s);
        p.rect(15, 36, 8, 10, b); p.rect(26, 36, 8, 10, b); p.rect(14, 44, 10, 3, s); p.rect(25, 44, 10, 3, s);
        for (let i = 0; i < 6; i++) { p.px(15 + rnd(r, 18), 19 + rnd(r, 16), s); p.px(15 + rnd(r, 18), 19 + rnd(r, 16), l); }
        p.line(22, 24, 26, 30, 0); p.line(26, 30, 24, 34, 0);
    },
    wraith(p, [b, s, l], r) {
        p.poly([[24, 3], [34, 12], [38, 30], [46, 44], [30, 40], [24, 47], [18, 40], [2, 44], [10, 30], [14, 12]], b);
        p.ell(24, 17, 8, 9, 0); p.ell(19, 17, 2, 3, l); p.ell(29, 17, 2, 3, l); p.px(19, 17, 15); p.px(29, 17, 15);
        p.line(10, 34, 4, 38, s); p.line(38, 34, 44, 38, s);
        p.poly([[18, 26], [30, 26], [28, 44], [20, 44]], s);
        p.line(12, 14, 10, 30, l); p.line(36, 14, 38, 30, l);
    },
    mimic(p, [b, s, l], r) {
        p.rect(6, 24, 36, 18, b); p.rect(6, 24, 36, 3, l); p.rect(6, 38, 36, 4, s); p.rect(6, 30, 36, 2, 14);
        p.poly([[6, 24], [10, 8], [38, 8], [42, 24]], b); p.rect(10, 8, 28, 3, l);
        for (let i = 0; i < 8; i++) { p.poly([[8 + i * 4.4, 24], [12 + i * 4.4, 24], [10 + i * 4.4, 30]], 15); p.poly([[8 + i * 4.4, 24], [12 + i * 4.4, 24], [10 + i * 4.4, 19]], 15); }
        p.rect(12, 26, 24, 5, 4); p.ell(24, 30, 6, 3, 12);
        p.px(16, 14, 12); p.px(32, 14, 12); p.rect(15, 13, 3, 3, 14); p.rect(31, 13, 3, 3, 14); p.px(16, 14, 0); p.px(32, 14, 0);
        p.rect(22, 20, 4, 6, 14); p.px(23, 22, 0);
    },
    drake(p, [b, s, l], r) {
        p.ell(24, 30, 12, 11, b); p.ell(24, 33, 8, 8, l); p.ell(24, 14, 8, 7, b); p.poly([[18, 16], [14, 22], [34, 22], [30, 16]], b);
        p.poly([[18, 8], [12, 0], [22, 6]], l); p.poly([[30, 8], [36, 0], [26, 6]], l);
        p.poly([[14, 28], [0, 12], [6, 28], [2, 38], [14, 36]], s); p.poly([[34, 28], [48, 12], [42, 28], [46, 38], [34, 36]], s);
        p.px(20, 13, 14); p.px(28, 13, 14); p.px(20, 14, 0); p.px(28, 14, 0); p.px(22, 20, 0); p.px(26, 20, 0);
        p.rect(17, 40, 5, 6, s); p.rect(27, 40, 5, 6, s); p.line(35, 40, 46, 44, b); p.poly([[44, 42], [48, 46], [42, 46]], l);
        p.line(24, 24, 24, 38, s);
    },
    knight(p, [b, s, l], r) {
        p.rect(15, 18, 18, 18, b); p.rect(15, 18, 18, 3, l); p.rect(12, 18, 5, 8, l); p.rect(31, 18, 5, 8, l);
        p.ell(24, 11, 7, 8, b); p.rect(17, 11, 14, 4, s); p.rect(19, 12, 10, 2, 11); p.line(24, 2, 24, 5, 12); p.rect(22, 2, 5, 2, 12);
        p.rect(16, 36, 6, 10, s); p.rect(26, 36, 6, 10, s); p.rect(9, 26, 5, 8, b); p.rect(34, 26, 5, 8, b);
        p.poly([[2, 24], [11, 24], [11, 38], [6, 44], [2, 38]], s); p.rect(5, 28, 3, 8, l);
        p.line(40, 30, 40, 4, 7); p.rect(38, 30, 5, 3, 6); p.line(41, 4, 41, 28, 15);
    },
    demon(p, [b, s, l], r) {
        p.ell(24, 28, 11, 12, b); p.ell(24, 11, 8, 8, b); p.poly([[16, 8], [8, 0], [14, 14]], l); p.poly([[32, 8], [40, 0], [34, 14]], l);
        p.poly([[14, 22], [0, 8], [4, 24], [0, 36], [14, 34]], s); p.poly([[34, 22], [48, 8], [44, 24], [48, 36], [34, 34]], s);
        p.px(20, 10, 14); p.px(28, 10, 14); p.rect(19, 9, 3, 3, 14); p.rect(27, 9, 3, 3, 14); p.px(20, 10, 4); p.px(28, 10, 4);
        p.line(19, 16, 29, 16, 0); for (let i = 0; i < 4; i++) p.px(20 + i * 2, 17, 15);
        p.rect(17, 38, 6, 8, s); p.rect(26, 38, 6, 8, s); p.line(35, 36, 46, 42, b); p.poly([[44, 38], [48, 44], [42, 44]], l);
        p.ell(24, 28, 5, 7, l); p.line(10, 30, 8, 38, b); p.line(38, 30, 40, 38, b);
    },
};
function rnd(r, n) { return Math.floor(r() * n); }

export function monsterCanvas(spr) {
    return memo(`m:${spr.fam}:${spr.seed}:${spr.pal}:${spr.boss}`, () => {
        const p = new Pix(W, W);
        const draw = DRAW[spr.fam] || DRAW.slime;
        draw(p, spr.pal, rngFor(spr.seed));
        if (spr.boss) {
            // a crown of thorns and burning eyes
            for (let i = 0; i < 5; i++) p.poly([[12 + i * 6, 2], [15 + i * 6, 2], [13.5 + i * 6, -3]], 14);
            p.rect(11, 2, 28, 2, 14);
        }
        p.outline(0);
        return p.canvas;
    });
}

// ------------------------------------------------------------------ strangers
const SKIN = [7, 6, 14, 12];
export function npcCanvas(kind, seed) {
    return memo(`n:${kind}:${seed % 7}`, () => {
        const p = new Pix(32, 40);
        const robe = { merchant: 6, hermit: 8, adventurer: 9, gambler: 4, riddler: 5, healer: 15, questgiver: 2 }[kind];
        const trim = { merchant: 14, hermit: 7, adventurer: 7, gambler: 14, riddler: 13, healer: 12, questgiver: 14 }[kind];
        const skin = SKIN[seed % 4];
        p.poly([[16, 14], [26, 38], [6, 38]], robe); p.rect(7, 36, 18, 3, trim); p.rect(14, 16, 4, 20, trim);
        p.ell(16, 10, 6, 6, skin); p.px(14, 10, 0); p.px(18, 10, 0); p.line(14, 13, 18, 13, 4);
        p.line(7, 20, 4, 30, robe); p.line(25, 20, 28, 30, robe); p.px(4, 30, skin); p.px(28, 30, skin);
        switch (kind) {
            case 'merchant': p.ell(16, 4, 9, 3, 6); p.rect(10, 1, 12, 4, 6); p.ell(25, 24, 6, 7, 14); p.rect(23, 18, 4, 2, 6); break;
            case 'hermit': p.poly([[10, 12], [22, 12], [16, 24]], 7); p.poly([[9, 6], [23, 6], [20, 1], [12, 1]], 8); p.line(28, 6, 28, 38, 6); break;
            case 'adventurer': p.rect(10, 3, 12, 4, 7); p.rect(10, 6, 12, 2, 12); p.rect(12, 26, 8, 3, 12); p.line(5, 22, 5, 30, 12); break;
            case 'gambler': p.ell(16, 4, 8, 3, 4); p.rect(11, 0, 10, 4, 4); p.line(21, 2, 27, -2, 14); p.rect(24, 24, 5, 7, 15); p.px(26, 27, 4); break;
            case 'riddler': p.rect(10, 7, 12, 4, 13); p.px(13, 9, 0); p.px(19, 9, 0); p.poly([[10, 3], [22, 3], [16, -2]], 5); p.ell(28, 20, 2, 2, 14); break;
            case 'healer': p.poly([[9, 8], [23, 8], [20, 1], [12, 1]], 15); p.rect(15, 20, 2, 8, 12); p.rect(12, 23, 8, 2, 12); p.ell(28, 28, 2, 3, 11); break;
            case 'questgiver': p.rect(10, 2, 12, 4, 2); p.rect(13, 22, 6, 6, 15); p.rect(14, 24, 4, 1, 0); p.px(15, 26, 0); break;
        }
        p.outline(0);
        return p.canvas;
    });
}

// ------------------------------------------------------------------ things on the floor
export function featureCanvas(type, sub = '', opened = false) {
    return memo(`f:${type}:${sub}:${opened}`, () => {
        const p = new Pix(32, 32);
        switch (type) {
            case 'chest':
                if (opened) { p.rect(6, 20, 20, 10, 6); p.rect(6, 20, 20, 2, 14); p.poly([[6, 20], [8, 8], [24, 8], [26, 20]], 6); p.rect(8, 22, 16, 6, 0); p.rect(6, 28, 20, 2, 8); }
                else { p.rect(6, 16, 20, 14, 6); p.rect(6, 16, 20, 2, 14); p.ell(16, 16, 10, 7, 6); p.rect(6, 15, 20, 3, 14); p.rect(14, 18, 4, 5, 14); p.px(16, 20, 0); p.rect(6, 28, 20, 2, 8); p.rect(6, 22, 20, 1, 8); }
                break;
            case 'gather': {
                const col = { herb: 10, ore: 7, bug: 6, relic: 14 }[sub] || 10;
                if (sub === 'herb') { for (let i = 0; i < 6; i++) { const x = 6 + i * 4; p.line(x, 30, x + (i % 2 ? 2 : -2), 12 + (i % 3) * 3, 2); p.ell(x + (i % 2 ? 2 : -2), 12 + (i % 3) * 3, 3, 2, col); } p.px(10, 10, 14); p.px(22, 8, 14); }
                else if (sub === 'ore') { p.poly([[4, 30], [8, 16], [14, 20], [18, 8], [26, 18], [29, 30]], 8); p.poly([[10, 28], [14, 18], [19, 14], [22, 28]], 7); p.px(14, 18, 15); p.px(20, 14, 11); p.px(18, 22, 14); p.px(11, 24, 11); }
                else if (sub === 'bug') { p.ell(16, 26, 12, 5, 8); p.ell(16, 20, 5, 4, 6); p.ell(12, 24, 2, 1.5, 14); p.ell(22, 25, 2, 1.5, 14); p.px(14, 18, 12); p.px(18, 18, 12); p.line(11, 17, 8, 12, 6); p.line(21, 17, 24, 12, 6); }
                else { p.ell(16, 26, 12, 6, 6); p.ell(16, 22, 8, 5, 8); p.rect(13, 14, 6, 9, 14); p.px(14, 15, 15); p.px(24, 14, 15); p.px(8, 18, 15); }
                break;
            }
            case 'spring':
                p.ell(16, 24, 13, 6, 8); p.ell(16, 23, 11, 5, 9); p.ell(16, 23, 8, 3, 11); p.rect(14, 6, 4, 16, 11); p.px(13, 10, 15); p.px(19, 12, 15); p.ell(16, 5, 4, 2, 11); p.px(9, 15, 15); p.px(23, 17, 15);
                break;
            case 'altar':
                p.rect(6, 22, 20, 8, 7); p.rect(8, 16, 16, 6, 8); p.rect(6, 28, 20, 2, 0); p.ell(16, 12, 4, 5, sub === 'blood' ? 4 : 14); p.ell(16, 10, 2, 3, sub === 'blood' ? 12 : 15);
                break;
            case 'sign':
                p.rect(15, 14, 3, 16, 6); p.rect(5, 6, 22, 11, 6); p.rect(6, 7, 20, 9, 14); for (let i = 0; i < 3; i++) p.rect(8, 9 + i * 3, 16 - (i % 2) * 5, 1, 0);
                break;
            case 'relic':
                p.ell(16, 28, 10, 3, 8); p.ell(16, 16, 7, 8, 14); p.ell(16, 16, 4, 5, 15); p.px(7, 8, 15); p.px(25, 10, 15); p.px(16, 4, 15); p.px(5, 20, 14); p.px(27, 22, 14);
                break;
            case 'den':
                p.ell(16, 24, 14, 7, 0); p.ell(16, 22, 11, 5, 8); p.ell(16, 23, 8, 3, 0); p.line(4, 24, 8, 16, 15); p.line(26, 22, 30, 14, 15); p.rect(10, 28, 4, 2, 15); p.px(20, 20, 12); p.px(22, 20, 12);
                break;
            case 'trap':
                p.rect(6, 22, 20, 8, 8); p.rect(8, 24, 16, 4, 12); for (let i = 0; i < 5; i++) p.px(9 + i * 3, 25, 0); p.rect(6, 22, 20, 1, 7);
                break;
            case 'stairs': break;
        }
        p.outline(0);
        return p.canvas;
    });
}

// ------------------------------------------------------------------ item icons (16×16)
const TIER_COL = [6, 12, 6, 7, 15, 11, 9, 13, 10, 14, 5, 3];
export function itemIcon(it) {
    const tier = Math.min(TIER_COL.length - 1, Math.floor((it.ilvl || 1) / 6));
    const col = it.t === 'w' || it.t === 'a' ? TIER_COL[tier] : 15;
    return memo(`i:${it.t}:${it.base || it.eff || it.cid || it.kind}:${col}:${it.rar}:${it.slot || ''}`, () => {
        const p = new Pix(16, 16);
        const dk = 8;
        switch (it.t) {
            case 'w':
                switch (it.grp) {
                    case 'sword': p.line(3, 13, 12, 3, col); p.line(4, 13, 13, 3, col); p.line(5, 11, 3, 9, 6); p.line(2, 14, 4, 12, 6); p.line(5, 11, 7, 13, 6); break;
                    case 'dagger': p.line(5, 11, 11, 4, col); p.line(6, 11, 12, 4, col); p.rect(4, 11, 3, 2, 6); p.px(3, 13, 6); break;
                    case 'axe': p.line(3, 14, 12, 3, 6); p.poly([[8, 2], [14, 4], [13, 9], [10, 7]], col); break;
                    case 'mace': case 'flail': p.line(3, 14, 10, 6, 6); p.ell(11, 5, 3, 3, col); p.px(11, 1, col); p.px(14, 5, col); p.px(11, 9, col); break;
                    case 'spear': p.line(2, 14, 12, 3, 6); p.poly([[11, 1], [15, 1], [14, 6], [11, 5]], col); break;
                    case 'bow': p.line(4, 2, 4, 14, 6); p.line(4, 2, 10, 8, 6); p.line(4, 14, 10, 8, 6); p.line(5, 3, 5, 13, 15); p.line(3, 8, 13, 8, 7); break;
                    case 'staff': p.line(3, 14, 12, 3, 6); p.ell(12, 3, 2.5, 2.5, it.rar > 1 ? 13 : 11); break;
                    case 'wand': p.line(3, 13, 11, 5, 6); p.px(12, 4, 14); p.px(13, 3, 15); p.px(11, 3, 14); p.px(13, 5, 14); break;
                    case 'whip': p.line(3, 13, 6, 8, 6); p.line(6, 8, 10, 10, col); p.line(10, 10, 13, 4, col); break;
                    default: p.line(3, 13, 12, 3, col);
                }
                break;
            case 'a':
                switch (it.slot) {
                    case 'shield': p.poly([[3, 2], [13, 2], [13, 9], [8, 14], [3, 9]], col); p.rect(7, 3, 2, 9, dk); p.rect(4, 6, 8, 2, dk); break;
                    case 'head': p.ell(8, 8, 5, 5, col); p.rect(3, 8, 10, 5, col); p.rect(6, 9, 4, 2, 0); p.px(8, 3, 12); break;
                    case 'body': p.poly([[3, 3], [6, 2], [10, 2], [13, 3], [14, 7], [12, 8], [12, 14], [4, 14], [4, 8], [2, 7]], col); p.rect(7, 2, 2, 4, 0); p.rect(5, 10, 6, 1, dk); break;
                    case 'hands': p.rect(4, 5, 8, 8, col); p.rect(3, 3, 2, 4, col); p.rect(6, 2, 2, 4, col); p.rect(9, 3, 2, 4, col); p.rect(12, 5, 2, 3, col); p.rect(4, 11, 8, 2, dk); break;
                    case 'feet': p.rect(4, 3, 5, 9, col); p.rect(4, 11, 10, 3, col); p.rect(4, 13, 10, 1, dk); break;
                }
                break;
            case 'c': p.ell(8, 9, 4, 4, 14); p.ell(8, 9, 2, 2, 0); p.rect(7, 3, 2, 3, it.rar > 1 ? 13 : 11); p.px(8, 3, 15); break;
            case 'p': {
                const c = { red: 12, blue: 9, green: 10, amber: 6, violet: 13, silver: 11, black: 8, gold: 14 }[it.color] || 12;
                p.rect(7, 2, 2, 3, 6); p.rect(6, 4, 4, 2, 7); p.ell(8, 10, 5, 5, 7); p.ell(8, 10, 4, 4, c); p.px(6, 8, 15); p.px(7, 8, 15);
                break;
            }
            case 's': p.rect(3, 3, 10, 11, 14); p.rect(3, 3, 10, 1, 6); p.rect(3, 13, 10, 1, 6); for (let i = 0; i < 4; i++) p.rect(5, 5 + i * 2, 6 - (i & 1) * 2, 1, 4); p.px(11, 11, 12); break;
            case 'm': p.line(3, 14, 11, 5, 6); p.ell(12, 4, 2.5, 2.5, 11); p.px(12, 4, 15); break;
            case 't': p.rect(3, 3, 10, 11, 5); p.rect(3, 3, 2, 11, 13); p.rect(6, 5, 5, 2, 14); p.rect(6, 9, 5, 1, 14); break;
            case 'x': {
                const k = it.kind;
                if (k === 'herb') { p.line(8, 14, 8, 6, 2); p.ell(5, 6, 3, 2, 10); p.ell(11, 5, 3, 2, 10); p.ell(8, 3, 2, 2, 10); }
                else if (k === 'ore') { p.poly([[2, 14], [4, 7], [8, 4], [13, 8], [14, 14]], 8); p.px(6, 8, 15); p.px(10, 7, 11); p.px(9, 11, 14); }
                else if (k === 'bug') { p.ell(8, 9, 4, 3, 6); p.ell(8, 6, 2, 2, 8); p.line(4, 12, 2, 14, 8); p.line(12, 12, 14, 14, 8); p.line(6, 5, 4, 2, 8); p.line(10, 5, 12, 2, 8); }
                else if (k === 'relic') { p.ell(8, 8, 5, 6, 14); p.ell(8, 8, 3, 4, 6); p.px(8, 8, 14); }
                else { p.poly([[8, 2], [13, 7], [8, 14], [3, 7]], [12, 14, 10, 9, 11, 15][it.tier] ?? 11); p.line(3, 7, 13, 7, 15); p.line(8, 2, 8, 14, 15); }
                break;
            }
        }
        p.outline(0);
        return p.canvas;
    });
}

// ------------------------------------------------------------------ portraits (24×24)
const HAIR = [8, 6, 14, 0, 12, 7];
export function portraitCanvas(m) {
    return memo(`p:${m.cls}:${m.face % 24}`, () => {
        const p = new Pix(24, 24);
        const skin = SKIN[m.face % 4], hair = HAIR[(m.face >> 2) % HAIR.length];
        p.rect(4, 19, 16, 5, { warrior: 12, rogue: 10, cleric: 15, mage: 9, ranger: 2, alchemist: 14 }[m.cls]);
        p.ell(12, 11, 6, 7, skin);
        p.px(9, 11, 0); p.px(15, 11, 0); p.px(10, 11, 15); p.px(14, 11, 15); p.line(10, 15, 14, 15, 4);
        switch (m.cls) {
            case 'warrior': p.rect(5, 3, 14, 6, 7); p.rect(5, 8, 3, 7, 7); p.rect(16, 8, 3, 7, 7); p.rect(11, 8, 2, 5, 8); p.line(12, 0, 12, 3, 12); break;
            case 'rogue': p.poly([[5, 4], [19, 4], [20, 12], [4, 12]], 2); p.rect(6, 10, 12, 3, 0); p.px(9, 11, 15); p.px(15, 11, 15); break;
            case 'cleric': p.poly([[4, 10], [6, 2], [18, 2], [20, 10]], 15); p.rect(11, 3, 2, 3, 12); p.rect(10, 4, 4, 1, 12); break;
            case 'mage': p.poly([[12, -3], [20, 8], [4, 8]], 9); p.rect(3, 7, 18, 2, 1); p.px(12, 4, 14); break;
            case 'ranger': p.poly([[4, 8], [8, 2], [16, 2], [20, 8]], 6); p.rect(3, 7, 18, 2, 2); p.line(18, 2, 22, 0, 10); break;
            case 'alchemist': p.rect(4, 3, 16, 5, hair); p.ell(8, 8, 3, 3, 11); p.ell(16, 8, 3, 3, 11); p.rect(8, 8, 8, 1, 7); break;
        }
        p.outline(0);
        return p.canvas;
    });
}
export function dataURL(canvas) { return canvas.toDataURL(); }
