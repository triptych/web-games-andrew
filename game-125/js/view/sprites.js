// Every sprite in SEEDFALL, painted in code with the Px painter: TILLY, six generations of bot, the planet's
// plants and creatures, the Rootmother, scenery, resource nodes and the station's sleepers. Each is built back to
// front (far parts first, then body, near parts, face) so the painter's contact lines separate the parts.
// A sprite is { px: Px, h: world height in metres }. The base of the picture is its feet.

import { Px, mix } from './pixel.js';
import { SPECIES_BY_ID } from '../sim/data.js';

const INK = '#1a1222';
const dk = (c, t = 0.3) => mix(c, '#140818', t);
const lt = (c, t = 0.3) => mix(c, '#fff6e0', t);
const h2 = (x, y, s = 0) => { let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const speck = (s = 0, lo = 0.12, hi = 0.9) => (x, y) => { const v = h2(x, y, s); return v < lo ? -1 : v > hi ? 1 : 0; };
const fur = (s = 0) => (x, y) => { const v = h2((x + (y % 2)) >> 1, y, s); return v < 0.14 ? -1 : v > 0.93 ? 1 : 0; };
const plates = (x, y) => (((x >> 2) + (y >> 2)) % 2 === 0 && (x % 4 === 0 || y % 4 === 0) ? -1 : 0);

function eye(P, x, y, col, s = 2) {
    P.mrect(x, y, s, s).fill(col);
    if (s >= 2) P.mp(x + s - 1, y + s - 1).fill(dk(col, 0.55));
    P.mp(x, y).fill('#ffffff');
}
function cuteEye(P, x, y, w = 3, h = 4, col = INK) {
    P.mrect(x, y, w, h).msub((Q) => Q.mp(x, y).mp(x + w - 1, y).mp(x, y + h - 1).mp(x + w - 1, y + h - 1)).fill(col);
    P.mp(x + 1, y + 1).fill('#ffffff');
    if (w > 2) P.mp(x + w - 2, y + h - 2).fill('#9aa8d8');
}
function tube(P, pts, r0, r1) {
    let total = 0; const seg = [];
    for (let i = 0; i + 1 < pts.length; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(L); total += L; }
    let acc = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
        const n = Math.max(1, Math.ceil(seg[i] * 2));
        for (let k = 0; k <= n; k++) {
            const t = (acc + seg[i] * k / n) / total, r = r0 + (r1 - r0) * t;
            P.mell(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / n, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / n, Math.max(0.6, r), Math.max(0.6, r));
        }
        acc += seg[i];
    }
    return P;
}
const fin = (P, h) => ({ px: P.outline(INK, 0.75), h });

// ---------------------------------------------------------------- TILLY
/** The ship's mind: a floating lamp-orb with a screen face, a halo ring and two little fins. mood changes the face. */
export function tilly(mood = 'happy') {
    const P = new Px(40, 40);
    P.mell(20, 34, 9, 2).paint('#3a6aa8', { soft: true });              // the halo, behind
    P.mpoly([[5, 18], [11, 14], [12, 22]]).paint('#ffb84a');            // fins
    P.mpoly([[35, 18], [29, 14], [28, 22]]).paint('#ffb84a');
    P.mell(20, 19, 12, 12).paint('#f0f4ff', { hi: 1.2 });               // the shell
    P.mell(20, 20, 9, 7.5).paint('#1a2a4a', { soft: true, noline: true }); // the screen
    const C = mood === 'worried' || mood === 'sad' ? '#7ad0ff' : mood === 'excited' ? '#ffe06a' : '#8affc8';
    if (mood === 'happy' || mood === 'excited') {
        P.mrect(14, 17, 3, 1).mrect(13, 18, 1, 1).mrect(17, 18, 1, 1).fill(C);
        P.mrect(23, 17, 3, 1).mrect(22, 18, 1, 1).mrect(26, 18, 1, 1).fill(C);
        P.mrect(17, 23, 6, 1).mrect(16, 22, 1, 1).mrect(23, 22, 1, 1).fill(C);
    } else if (mood === 'worried' || mood === 'sad') {
        P.mrect(14, 18, 3, 2).mrect(23, 18, 3, 2).fill(C);
        P.mrect(13, 16, 2, 1).mrect(25, 16, 2, 1).fill(C);
        if (mood === 'sad') P.mrect(17, 24, 6, 1).mrect(16, 25, 1, 1).mrect(23, 25, 1, 1).fill(C);
        else P.mrect(18, 24, 4, 1).fill(C);
    } else {
        P.mrect(14, 18, 3, 2).fill(C); P.mrect(23, 17, 3, 1).fill(C);
        P.mrect(18, 24, 4, 1).fill(C);
    }
    if (mood === 'excited') P.mp(11, 9).mp(29, 9).mp(20, 5).fill('#ffe06a');
    P.mell(14, 12, 2.2, 1.4).tint((c) => lt(c, 0.6));
    P.mrect(19, 4, 2, 4).paint('#c8d0e0'); P.mell(20, 3, 1.6, 1.6).fill('#ffd76a');   // antenna
    return fin(P, 0.9);
}

// ---------------------------------------------------------------- the bots
const BOT_PAL = [
    ['#d8b070', '#8a7a6a', '#7affc8'],   // Sprout: tin and rust
    ['#e09a3a', '#5a5a6a', '#ffd06a'],   // Digger: hazard orange
    ['#6ac0a8', '#3a5a6a', '#bfffff'],   // Ranger: sealed teal
    ['#c8603a', '#4a3a3a', '#ffb06a'],   // Forgeback: ceramic red
    ['#7a6ad8', '#2a2a4a', '#fff0a0'],   // Lanternhead: violet and lamp
    ['#f0f0e8', '#3a8a5a', '#8aff9a'],   // Gardener: white and leaf green
];
/** A bot of generation g, facing the viewer. */
export function bot(g = 0) {
    const [body, dark, glow] = BOT_PAL[g];
    const W = 40, H = 44, P = new Px(W, H), cx = 20;
    // legs or treads, behind
    if (g === 0) { P.mrect(12, 34, 16, 6).paint('#4a4a52', { tex: (x) => (x % 3 === 0 ? -1 : 0) }); }
    else if (g === 2 || g === 5) { P.mrect(12, 30, 4, 12).mrect(24, 30, 4, 12).paint(dark); P.mrect(10, 40, 8, 3).mrect(22, 40, 8, 3).paint(dk(dark, 0.2)); }
    else { P.mrect(11, 32, 7, 10).mrect(22, 32, 7, 10).paint(dark, { tex: (x, y) => (y % 3 === 0 ? -1 : 0) }); }
    // arms: a cutter on the left, a bucket/tool on the right
    P.mrect(5, 20, 4, 10).paint(dark);
    P.mpoly([[3, 30], [9, 30], [7, 36], [5, 36]]).paint('#c8d0d8', { hi: 1.3 });
    P.mrect(31, 20, 4, 10).paint(dark);
    if (g === 0) P.mpoly([[29, 30], [38, 30], [36, 36], [31, 36]]).paint('#8a8a92');
    else if (g >= 1) P.mrect(31, 29, 6, 3).mrect(36, 28, 3, 5).paint('#5a5a6a');
    // body
    const bw = 18 + Math.min(g, 3) * 1, bh = 16 + Math.min(g, 2);
    P.mrect(cx - bw / 2, 16, bw, bh).msub((Q) => Q.mp(cx - bw / 2, 16).mp(cx + bw / 2 - 1, 16)).paint(body, { tex: g === 3 ? plates : speck(g, 0.06, 0.95) });
    P.mrect(cx - 4, 22, 8, 6).paint(dk(body, 0.25));
    P.mrect(cx - 2, 24, 4, 2).fill(glow);
    if (g === 5) { P.mell(cx + 6, 20, 2, 2).paint('#5ac86a'); P.mell(cx - 6, 21, 1.5, 1.5).paint('#8aff9a'); }
    // head
    const hw = g === 4 ? 14 : 12;
    P.mrect(cx - hw / 2, 6, hw, 10).msub((Q) => Q.mp(cx - hw / 2, 6).mp(cx + hw / 2 - 1, 6)).paint(lt(body, 0.12));
    P.mrect(cx - hw / 2 + 2, 9, hw - 4, 5).fill('#1a2030');
    P.mrect(cx - 3, 10, 2, 3).mrect(cx + 1, 10, 2, 3).fill(glow);
    if (g === 4) { P.mell(cx, 4, 3, 2.5).paint('#fff0a0', { soft: true }); }
    else if (g === 3) P.mrect(cx - 7, 5, 14, 2).paint('#8a3a2a');
    else if (g === 2) P.mrect(cx + 4, 1, 1, 6).fill('#bfffff');
    else if (g === 0) { P.mrect(cx - 1, 2, 2, 4).paint('#8a8a92'); P.mp(cx, 1).fill('#ff6a4a'); }
    else P.mrect(cx - 5, 4, 10, 2).paint('#ffd06a');
    return fin(P, 1.25 + g * 0.08);
}

// ---------------------------------------------------------------- flora
function bloom(pal, big = 1) {
    const [petal, petal2, stem] = pal, P = new Px(32, 40);
    P.mline(16, 39, 16, 18, 2).paint(stem);
    P.mell(10, 30, 5, 2.4).mell(22, 26, 5, 2.4).paint(stem, { tex: speck(3) });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + 0.3; P.mell(16 + Math.cos(a) * 6 * big, 14 + Math.sin(a) * 5 * big, 4 * big, 3.4 * big); }
    P.paint(petal, { hi: 1.1 });
    P.mell(16, 14, 3.4 * big, 3 * big).paint(petal2, { tex: speck(2, 0.2, 0.85) });
    return P;
}
function reed(pal) {
    const [a, b, tip] = pal, P = new Px(32, 48);
    for (const [x, h, lean] of [[10, 30, -3], [15, 40, 1], [20, 34, 3], [24, 24, 4], [7, 20, -4]]) {
        P.mline(x, 47, x + lean, 47 - h, 2).paint(h > 30 ? a : b);
        P.mell(x + lean, 47 - h + 2, 1.6, 4).paint(tip);
    }
    return P;
}
function mushroom(pal, tall = 1) {
    const [cap, stalk, dots] = pal, P = new Px(36, 44);
    P.mrect(14, 22, 8, 22).paint(stalk, { tex: (x, y) => (y % 4 === 0 ? -1 : 0) });
    P.mrect(10, 40, 16, 4).paint(stalk);
    P.mell(18, 18, 16 * tall, 10).msub((Q) => Q.mrect(0, 22, 36, 22)).paint(cap, { hi: 1.2 });
    P.mrect(4, 20, 28, 3).paint(dk(cap, 0.35));
    for (const [x, y] of [[11, 12], [22, 10], [16, 16], [27, 15], [7, 17]]) P.mell(x, y, 1.6, 1.4).fill(dots);
    return P;
}
function fern(pal) {
    const [leafC, rib, tip] = pal, P = new Px(40, 52);
    for (const [ang, len] of [[-2.5, 18], [-2.05, 24], [-1.6, 28], [-1.15, 24], [-0.7, 18], [-1.82, 20], [-1.38, 21]]) {
        const pts = [];
        for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([20 + Math.cos(ang) * len * t, 51 + Math.sin(ang) * len * t + t * t * 5]); }
        tube(P, pts, 2.8, 0.9).paint(leafC, { tex: speck(7, 0.18, 0.88) });
        P.mline(pts[0][0], pts[0][1], pts[5][0], pts[5][1], 1).paint(rib, { noline: true });
        P.mp(pts[6][0], pts[6][1]).fill(tip);
    }
    return P;
}
function lily(pal) {
    const [petal, pad, light] = pal, P = new Px(36, 24);
    P.mell(18, 19, 16, 4.5).msub((Q) => Q.mpoly([[18, 19], [30, 14], [34, 19]])).paint(pad, { tex: speck(5) });
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; P.mpoly([[18, 17], [18 + Math.cos(a - 0.2) * 9, 17 + Math.sin(a - 0.2) * 9], [18 + Math.cos(a) * 11, 17 + Math.sin(a) * 11], [18 + Math.cos(a + 0.2) * 9, 17 + Math.sin(a + 0.2) * 9]]); }
    P.paint(petal, { hi: 1.2 });
    P.mell(18, 14, 2.4, 2).fill(light);
    return P;
}
function cactus(pal) {
    const [skin, flower, spine] = pal, P = new Px(32, 48);
    P.mrect(4, 20, 5, 12).mrect(4, 30, 10, 4).paint(skin);
    P.mrect(23, 14, 5, 14).mrect(18, 26, 10, 4).paint(skin);
    P.mrect(11, 6, 10, 42).msub((Q) => Q.mp(11, 6).mp(20, 6)).paint(skin, { tex: (x) => ((x - 11) % 3 === 0 ? -1 : 0) });
    for (let y = 10; y < 44; y += 5) P.mp(10, y).mp(21, y + 2).fill(spine);
    P.mell(16, 5, 3, 2.5).paint(flower, { hi: 1.3 });
    return P;
}
function vine(pal) {
    const [leafC, fruit, glow] = pal, P = new Px(32, 52);
    tube(P, [[16, 51], [12, 40], [19, 30], [13, 18], [17, 6]], 2.2, 1.2).paint(dk(leafC, 0.2));
    for (const [x, y] of [[9, 42], [22, 34], [9, 24], [21, 14], [12, 8]]) P.mell(x, y, 4, 2.4).paint(leafC);
    for (const [x, y] of [[20, 40], [11, 30], [20, 20], [14, 12]]) { P.mell(x, y, 2.6, 3).paint(fruit, { soft: true }); P.mp(x - 1, y - 1).fill(glow); }
    return P;
}
function heart(pal) {
    const [petal, inner, stem] = pal, P = new Px(36, 44);
    P.mline(18, 43, 18, 20, 3).paint(stem);
    P.mell(11, 34, 6, 2.6).mell(25, 30, 6, 2.6).paint('#4a8a4a');
    P.mell(12, 14, 7, 7).mell(24, 14, 7, 7).mpoly([[5, 16], [31, 16], [18, 30]]).paint(petal, { hi: 1.3 });
    P.mell(18, 16, 4, 4).paint(inner, { soft: true });
    return P;
}

// ---------------------------------------------------------------- fauna
function skitter(pal) {
    const [shell, dark, eyeC] = pal, P = new Px(32, 22);
    for (const x of [6, 12, 20, 26]) P.mline(x, 14, x + (x < 16 ? -3 : 3), 21, 1);
    P.paint(dark);
    P.mell(16, 12, 11, 6.5).paint(shell, { tex: speck(1) });
    P.mrect(8, 9, 16, 1).paint(dk(shell, 0.2), { noline: true });
    eye(P, 10, 11, eyeC); eye(P, 20, 11, eyeC);
    P.mline(9, 6, 6, 1, 1).mline(23, 6, 26, 1, 1).paint(dark);
    return P;
}
function beast(pal) {
    const [hide, dark, tusk] = pal, P = new Px(44, 32);
    P.mrect(9, 22, 5, 10).mrect(30, 22, 5, 10).paint(dk(hide, 0.25));         // far legs
    P.mell(22, 18, 17, 10).paint(hide, { tex: fur(2) });
    for (let i = 0; i < 6; i++) P.mpoly([[8 + i * 5, 10], [11 + i * 5, 1 + (i % 2) * 2], [13 + i * 5, 10]]);
    P.paint(tusk, { hi: 1.1 });
    P.mrect(13, 24, 5, 8).mrect(26, 24, 5, 8).paint(hide);
    P.mell(22, 21, 8, 6).paint(dk(hide, 0.1));
    eye(P, 17, 18, '#ffe06a'); eye(P, 25, 18, '#ffe06a');
    P.mpoly([[15, 24], [13, 28], [17, 26]]).mpoly([[29, 24], [31, 28], [27, 26]]).paint('#fff8e0');
    return P;
}
function hound(pal) {
    const [hide, bark, eyeC] = pal, P = new Px(40, 30);
    P.mrect(9, 20, 4, 10).mrect(27, 20, 4, 10).paint(dk(hide, 0.3));
    P.mell(20, 16, 14, 8).paint(hide, { tex: fur(4) });
    P.mrect(8, 10, 24, 5).paint(bark, { tex: (x) => (x % 4 === 0 ? -1 : 0) });
    P.mrect(12, 22, 4, 8).mrect(24, 22, 4, 8).paint(hide);
    P.mell(20, 18, 7, 6).paint(lt(hide, 0.1));
    P.mpoly([[13, 12], [11, 3], [17, 10]]).mpoly([[27, 12], [29, 3], [23, 10]]).paint(hide);
    eye(P, 16, 16, eyeC); eye(P, 22, 16, eyeC);
    P.mrect(18, 21, 4, 2).fill(INK);
    return P;
}
function blob(pal) {
    const [skin, dark, glow] = pal, P = new Px(32, 30);
    P.mell(16, 18, 13, 11).paint(skin, { hi: 1.2 });
    for (const [x, y, r] of [[8, 12, 3], [23, 9, 4], [15, 6, 2.5], [25, 20, 2.5]]) P.mell(x, y, r, r).paint(glow, { soft: true });
    cuteEye(P, 10, 16, 3, 4); cuteEye(P, 19, 16, 3, 4);
    P.mrect(14, 24, 4, 1).fill(dark);
    return P;
}
function serpent(pal) {
    const [skin, dark, mouth] = pal, P = new Px(40, 26);
    tube(P, [[2, 22], [10, 18], [18, 22], [26, 17], [32, 12]], 2, 5).paint(skin, { tex: (x, y) => ((x + y) % 4 === 0 ? -1 : 0) });
    P.mell(33, 11, 6, 5).paint(skin);
    P.mell(36, 14, 3, 2).fill(mouth);
    eye(P, 31, 8, '#ffe06a');
    P.mline(4, 24, 30, 18, 1).paint(dk(dark, 0.2), { noline: true });
    return P;
}
function flyer(pal) {
    const [wing, body, glow] = pal, P = new Px(44, 30);
    P.mpoly([[22, 14], [2, 4], [6, 16], [3, 22]]).mpoly([[22, 14], [42, 4], [38, 16], [41, 22]]).paint(wing, { soft: true, tex: (x) => (x % 5 === 0 ? -1 : 0) });
    P.mell(22, 15, 5, 9).paint(body);
    P.mpoly([[20, 23], [24, 23], [22, 29]]).paint(body);
    eye(P, 19, 11, glow); eye(P, 24, 11, glow);
    return P;
}
function moth(pal) {
    const [wing, body, glow] = pal, P = new Px(40, 34);
    P.mell(10, 13, 9, 8).mell(30, 13, 9, 8).mell(12, 25, 6, 5).mell(28, 25, 6, 5).paint(wing, { hi: 1.1 });
    P.mell(10, 13, 3, 3).mell(30, 13, 3, 3).paint(glow, { soft: true });
    P.mell(20, 18, 3.4, 9).paint(body, { tex: (x, y) => (y % 3 === 0 ? -1 : 0) });
    P.mline(19, 9, 15, 2, 1).mline(21, 9, 25, 2, 1).paint(body);
    cuteEye(P, 17, 12, 2, 3); cuteEye(P, 22, 12, 2, 3);
    return P;
}
function crawler(pal) {
    const [armor, lava, dark] = pal, P = new Px(48, 32);
    for (const x of [7, 15, 33, 41]) P.mline(x, 20, x + (x < 24 ? -4 : 4), 31, 3);
    P.paint(dark);
    P.mell(24, 18, 20, 10).paint(lava, { soft: true });
    for (let i = 0; i < 5; i++) P.mell(9 + i * 7.5, 13 + (i % 2), 5, 6);
    P.paint(armor, { tex: speck(9, 0.18, 0.92) });
    eye(P, 19, 21, '#ffe06a'); eye(P, 27, 21, '#ffe06a');
    return P;
}
function stalker(pal) {
    const [skin, dark, glow] = pal, P = new Px(32, 64);
    P.mline(12, 40, 9, 63, 3).mline(20, 40, 23, 63, 3).paint(dark);
    P.mell(16, 30, 7, 12).paint(skin, { tex: speck(5) });
    P.mline(9, 22, 3, 46, 2).mline(23, 22, 29, 46, 2).paint(skin);
    P.mell(16, 12, 6, 8).paint(skin);
    P.mrect(12, 10, 8, 2).fill(glow);
    P.mp(13, 11).mp(18, 11).fill('#ffffff');
    return P;
}
function rootling(pal) {
    const [bark, dark, bud] = pal, P = new Px(30, 30);
    for (const x of [7, 13, 18, 23]) P.mline(15, 20, x, 29, 2);
    P.paint(dark);
    P.mell(15, 16, 10, 9).paint(bark, { tex: (x) => (x % 3 === 0 ? -1 : 0) });
    P.mell(15, 6, 5, 4).paint(bud, { hi: 1.3 });
    cuteEye(P, 10, 14, 3, 3, '#ffe06a'); cuteEye(P, 17, 14, 3, 3, '#ffe06a');
    return P;
}
function warden(pal) {
    const [bark, dark, eyeC] = pal, P = new Px(40, 64);
    P.mline(32, 2, 30, 62, 2).paint('#8a7a5a');                          // spear behind
    P.mpoly([[30, 0], [34, 0], [32, 8]]).paint('#c8d0d8');
    P.mrect(12, 40, 6, 24).mrect(22, 40, 6, 24).paint(dark);
    P.mell(20, 30, 11, 14).paint(bark, { tex: (x) => (x % 3 === 0 ? -1 : 0) });
    for (let i = 0; i < 5; i++) P.mpoly([[10 + i * 5, 20], [12 + i * 5, 12], [14 + i * 5, 20]]);
    P.paint('#6a8a3a');
    P.mell(20, 14, 6, 6).paint(bark);
    eye(P, 17, 13, eyeC); eye(P, 22, 13, eyeC);
    P.mline(8, 26, 30, 30, 3).paint(bark);
    return P;
}
/** The Rootmother: a hill of roots with a heart-flower crown and a face of knotted bark. */
export function rootmother() {
    const P = new Px(112, 120);
    for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.05 + i * 0.11);
        tube(P, [[56, 90], [56 + Math.cos(a) * 30, 96 + Math.sin(a) * 4], [56 + Math.cos(a) * 54, 118]], 6, 2);
    }
    P.paint('#3a2a1a', { tex: (x) => (x % 4 === 0 ? -1 : 0) });
    P.mell(56, 70, 38, 40).paint('#5a4a2a', { tex: (x, y) => ((x + (y >> 2)) % 5 === 0 ? -1 : 0) });
    for (let i = 0; i < 7; i++) { const x = 22 + i * 11; tube(P, [[x, 40], [x + (i % 2 ? 4 : -4), 22], [x, 8]], 3, 1.5); }
    P.paint('#4a6a2a');
    P.mell(56, 26, 16, 14).mell(42, 30, 10, 10).mell(70, 30, 10, 10).paint('#ff6a9a', { hi: 1.3 });
    P.mell(56, 28, 6, 6).paint('#ffd0e0', { soft: true });
    P.mell(40, 66, 7, 5).mell(72, 66, 7, 5).fill('#1a0a14');
    P.mell(40, 66, 3, 3).mell(72, 66, 3, 3).fill('#ff4a6a');
    P.mp(39, 65).mp(71, 65).fill('#ffffff');
    P.mpoly([[38, 84], [74, 84], [66, 92], [46, 92]]).fill('#1a0a14');
    for (let x = 42; x < 72; x += 6) P.mpoly([[x, 84], [x + 3, 84], [x + 1.5, 89]]).fill('#e8e0c8');
    return fin(P, 7.5);
}

const FLORA = { bloom, reed, mushroom, fern, lily, cactus, vine, heart };
const FAUNA = { skitter, beast, hound, blob, serpent, flyer, moth, crawler, stalker, rootling, warden };
const SIZE = { skitter: 0.9, beast: 1.5, hound: 1.25, blob: 1.15, serpent: 1.0, flyer: 1.3, moth: 1.1, crawler: 1.6, stalker: 2.4, rootling: 1.1, warden: 2.6,
    bloom: 1.1, reed: 1.6, mushroom: 1.4, fern: 1.3, lily: 0.6, cactus: 1.9, vine: 2.0, heart: 1.3 };
/** A plant or creature sprite from the species table. */
export function species(id) {
    const s = SPECIES_BY_ID[id];
    const P = (FLORA[s.shape] || FAUNA[s.shape])(s.pal);
    return fin(P, SIZE[s.shape] * (s.shape === 'mushroom' && s.zone === 4 ? 1.2 : 1));
}
export const FAUNA_SHAPE = Object.fromEntries(Object.values(SPECIES_BY_ID).filter((s) => s.kind === 'fauna').map((s) => [s.id, s.shape]));

// ---------------------------------------------------------------- nodes and scenery
export function node(kind, zone = 0) {
    if (kind === 'metal') {
        const P = new Px(36, 26);
        P.mpoly([[4, 25], [10, 10], [20, 6], [30, 12], [33, 25]]).paint(['#8a8a92', '#7a6a5a', '#7a8a8a', '#6a5a5a', '#5a5a6a', '#9a8a7a'][zone], { tex: plates });
        P.mrect(12, 12, 10, 3).paint('#c8d0d8', { hi: 1.4 });
        P.mrect(22, 16, 3, 7).paint('#d87a3a');
        P.mpoly([[6, 18], [2, 9], [9, 14]]).paint('#b0b8c0');
        return fin(P, 1.0);
    }
    const P = new Px(30, 34);
    const col = ['#8ae0ff', '#c8a8ff', '#8affe0', '#ff9a6a', '#d0a0ff', '#ff8ab0'][zone];
    P.mell(15, 31, 12, 3).paint('#4a4a5a');
    for (const [x, h, w] of [[8, 18, 4], [15, 30, 5], [22, 22, 4], [11, 12, 3]]) P.mpoly([[x - w, 31], [x - w * 0.6, 31 - h * 0.8], [x, 31 - h], [x + w * 0.6, 31 - h * 0.8], [x + w, 31]]);
    P.paint(col, { hi: 1.4 });
    P.mline(15, 28, 15, 6, 1).tint((c) => lt(c, 0.5));
    return fin(P, 1.2);
}
export function prop(kind, zone = 0) {
    const pal = { rock: ['#8a8a7a', '#8a6a5a', '#6a7a7a', '#7a4a3a', '#4a4a6a', '#5a4a4a'][zone] };
    let P, h;
    switch (kind) {
        case 'rock': P = new Px(40, 28); P.mell(20, 18, 18, 10).mell(13, 14, 9, 8).paint(pal.rock, { tex: speck(11, 0.14, 0.92) }); P.mell(26, 20, 7, 4).paint(dk(pal.rock, 0.12)); h = 1.4; break;
        case 'wreck': P = new Px(56, 40); P.mpoly([[4, 39], [10, 14], [30, 4], [50, 16], [54, 39]]).paint('#7a8088', { tex: plates }); P.mrect(16, 20, 12, 8).fill('#1a2030'); P.mrect(32, 10, 14, 4).paint('#d8a03a'); P.mline(44, 4, 52, 30, 2).paint('#5a5a62'); h = 2.2; break;
        case 'rusttree': P = new Px(48, 72); P.mrect(21, 30, 7, 42).paint('#5a3a2a', { tex: (x) => (x % 3 === 0 ? -1 : 0) }); P.mell(24, 22, 22, 15).mell(14, 30, 10, 8).mell(34, 30, 10, 8).paint('#c8682a', { tex: speck(4, 0.16, 0.86) }); h = 5.2; break;
        case 'deadtree': P = new Px(40, 64); tube(P, [[20, 63], [19, 34], [12, 16], [7, 6]], 3.4, 1); tube(P, [[19, 36], [28, 20], [34, 10]], 2.4, 1); P.paint('#5a5a4a'); h = 4; break;
        case 'glass': P = new Px(32, 64); P.mpoly([[8, 63], [12, 10], [16, 2], [20, 14], [24, 63]]).paint('#a8f0ff', { hi: 1.4 }); P.mpoly([[20, 63], [24, 30], [28, 63]]).paint('#7ad0e0'); h = 3.6; break;
        case 'spire': P = new Px(36, 64); P.mpoly([[4, 63], [12, 24], [18, 6], [24, 26], [32, 63]]).paint('#8a4a3a', { tex: (x, y) => (y % 7 === 0 ? -1 : 0) }); P.mrect(10, 40, 16, 2).paint('#2a1a1a'); h = 4.6; break;
        case 'crystal': P = new Px(36, 48); for (const [x, hh] of [[10, 30], [18, 44], [26, 34]]) P.mpoly([[x - 5, 47], [x - 3, 47 - hh * 0.8], [x, 47 - hh], [x + 3, 47 - hh * 0.8], [x + 5, 47]]); P.paint('#b07aff', { hi: 1.5 }); h = 2.8; break;
        case 'shroomtree': P = mushroom(['#6a4ad8', '#c8b8f0', '#e8ffd0'], 1); h = 4.2; break;
        case 'root': P = new Px(64, 36); tube(P, [[2, 34], [18, 14], [36, 8], [52, 18], [62, 34]], 4, 3).paint('#4a3a2a', { tex: (x) => (x % 4 === 0 ? -1 : 0) }); h = 2.4; break;
        case 'stump': P = new Px(28, 20); P.mrect(6, 6, 16, 14).paint('#6a4a2a'); P.mell(14, 6, 8, 3).paint('#c8a06a'); h = 0.8; break;
        case 'bones': P = new Px(36, 18); P.mline(4, 14, 32, 10, 2).mline(10, 6, 14, 16, 2).mline(20, 4, 24, 15, 2).paint('#e8e0c8'); h = 0.6; break;
        default: P = new Px(24, 16); for (let i = 0; i < 7; i++) P.mline(3 + i * 3, 15, 2 + i * 3 + (i % 3) - 1, 4 + (i % 3) * 2, 1); P.paint('#7ab84a'); h = 0.55;
    }
    return fin(P, h);
}
/** Grass tufts and flowers that appear as a zone heals; dead stalks while it is barren. */
export function tuft(kind, col) {
    const P = new Px(16, 16);
    if (kind === 'flower') { P.mline(8, 15, 8, 7, 1).paint('#4a8a3a'); P.mell(8, 5, 2.6, 2.4).paint(col, { hi: 1.3 }); P.mp(8, 5).fill('#fff6c0'); }
    else if (kind === 'dead') { for (let i = 0; i < 4; i++) P.mline(3 + i * 3, 15, 4 + i * 3, 8 + (i % 2) * 3, 1); P.paint(col); }
    else { for (let i = 0; i < 5; i++) P.mline(2 + i * 3, 15, 1 + i * 3 + (i % 2) * 2, 4 + (i % 3) * 3, 1); P.paint(col); }
    return { px: P, h: 0.5 };
}
export function beacon() {
    const P = new Px(32, 60);
    P.mrect(6, 52, 20, 8).paint('#5a6070');
    P.mrect(13, 10, 6, 44).paint('#c8d0d8', { tex: (x, y) => (y % 6 === 0 ? -1 : 0) });
    P.mell(16, 8, 6, 6).paint('#7affc8', { soft: true });
    P.mrect(8, 30, 16, 3).paint('#ffb84a');
    return fin(P, 3.2);
}
export function echoBox() {
    const P = new Px(24, 24);
    P.mrect(4, 8, 16, 14).paint('#ff8a3a', { tex: plates });
    P.mrect(7, 11, 10, 5).fill('#1a1a22');
    P.mrect(9, 12, 6, 1).fill('#c89aff');
    P.mrect(10, 2, 2, 6).paint('#c8d0d8'); P.mp(11, 1).fill('#c89aff');
    return fin(P, 0.8);
}
export function harvester(kind) {
    const P = new Px(32, 40);
    const col = { metal: '#c8d0d8', mineral: '#86e4ff', flora: '#86e08e', fauna: '#ffb47e' }[kind];
    P.mline(6, 39, 12, 22, 2).mline(26, 39, 20, 22, 2).paint('#5a5a6a');
    P.mrect(8, 12, 16, 14).paint('#8a8a96', { tex: plates });
    P.mrect(12, 16, 8, 4).fill(col);
    P.mrect(15, 2, 2, 10).paint('#c8d0d8'); P.mp(16, 1).fill(col);
    return fin(P, 1.8);
}
export function colony(stage) {
    const P = new Px(64, 48);
    P.mell(32, 44, 30, 4).paint('#5a6070');
    P.mell(32, 34, 16 + stage * 3, 12 + stage * 3).msub((Q) => Q.mrect(0, 40, 64, 8)).paint('#d8e8f0', { hi: 1.2 });
    P.mrect(28, 30, 8, 10).fill('#ffd76a');
    if (stage >= 2) { P.mell(10, 38, 7, 6).msub((Q) => Q.mrect(0, 40, 64, 8)).paint('#c8d8e0'); P.mell(54, 38, 7, 6).msub((Q) => Q.mrect(0, 40, 64, 8)).paint('#c8d8e0'); }
    if (stage >= 3) { P.mrect(30, 4, 4, 16).paint('#c8d0d8'); P.mell(32, 4, 3, 3).fill('#8aff9a'); }
    return fin(P, 2.4 + stage * 0.4);
}
/** A sleeper's face behind pod glass. */
export function sleeper(seed, child = false) {
    const P = new Px(24, 24);
    const skins = ['#f0c8a0', '#c89a70', '#8a5a3a', '#5a3a2a', '#f0d8c0', '#a87050'];
    const hairs = ['#2a1a14', '#5a3a1a', '#c89a4a', '#1a1a1a', '#8a3a1a', '#d8d0c0'];
    const s = skins[Math.floor(h2(seed, 1) * skins.length)], hr = hairs[Math.floor(h2(seed, 2) * hairs.length)];
    const r = child ? 7 : 8;
    P.mell(12, 14, r, r).paint(s);
    P.mell(12, 9, r + 1, r * 0.6).msub((Q) => Q.mrect(0, 11, 24, 13)).paint(hr, { tex: fur(seed) });
    P.mrect(7, 14, 3, 1).mrect(14, 14, 3, 1).fill(dk(s, 0.5));       // closed eyes
    P.mrect(10, 19, 4, 1).fill(dk(s, 0.35));
    if (child) { P.mp(7, 17).mp(16, 17).fill('#ff9a9a'); P.mrect(10, 19, 3, 2).fill(dk(s, 0.5)); }
    return fin(P, 0.5);
}
