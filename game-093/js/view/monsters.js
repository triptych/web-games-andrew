// Procedural pixel-art monsters and bosses, facing right. Each draws into a Px; palettes give every kind its variants.
// The painter shades each part as a volume and lines the parts it overlaps, so a monster is built back to front: far
// limbs and wings first (darker), then the body, then near limbs, then the face. Textures (fur, scales, stone, bark,
// bandages) nudge the shading ramp per pixel instead of drawing noise on top.

import { Px, mix } from './pixel.js';

const INK = '#1e1020';
const PAL = {
    slime: { base: ['#6fd45a', '#3a9a3a'], blue: ['#5ab4f0', '#3a6ac8'], red: ['#f0704a', '#c8382a'], ice: ['#a8e8ff', '#5aa8e0'] },
    bat: { base: ['#6a4a8a', '#3a2a5a'], ice: ['#8ac0e8', '#4a7aa8'] },
    wolf: { base: ['#7a7a88', '#4a4a58'], ice: ['#d8ecff', '#8ab0d0'], red: ['#a8503a', '#6a2a1a'] },
    goblin: { base: ['#7ac04a', '#4a8a2a'], red: ['#c85a3a', '#8a2a1a'], blue: ['#5a9ac0', '#2a5a8a'] },
    shroom: { base: ['#d8483a', '#8a2a2a'] },
    sapling: { base: ['#6a8a3a', '#3a5a1a'] },
    skeleton: { base: ['#e8e0c8', '#a8a088'] },
    golem: { base: ['#8a8a96', '#5a5a68'] },
    crab: { base: ['#e0683a', '#a8381a'] },
    jelly: { base: ['#e08ae8', '#a85ac8'] },
    naga: { base: ['#3aa88a', '#1a6a6a'] },
    wisp: { base: ['#7fc8ff', '#3a7ad8'], ice: ['#d8f4ff', '#7ab8e8'], void: ['#b070ff', '#5a2aa8'] },
    scorpion: { base: ['#c8a050', '#8a6a2a'] },
    cobra: { base: ['#6aa84a', '#3a6a2a'] },
    mummy: { base: ['#e0d4b0', '#a8986a'] },
    harpy: { base: ['#a86ad8', '#6a3aa8'] },
    yeti: { base: ['#f0f4fa', '#9ab0d0'] },
    knight: { base: ['#6a6a7a', '#3a3a4a'], void: ['#4a2a6a', '#201030'], gold: ['#c8a040', '#7a5a1a'] },
    imp: { base: ['#e04a3a', '#8a1a1a'] },
    drake: { base: ['#c85a3a', '#7a2a1a'], red: ['#e0382a', '#8a1a0a'], void: ['#3a2a4a', '#1a1028'] },
    shade: { base: ['#4a3a6a', '#1a1030'], void: ['#2a1a3a', '#0a0414'] },
    gargoyle: { base: ['#7a8a9a', '#4a5a6a'] },
    fiend: { base: ['#8a2a4a', '#4a1028'] },
    treant: { base: ['#6a5030', '#3a2a14'] },
    colossus: { base: ['#8a8a86', '#56565a'] },
    kraken: { base: ['#4a6ad8', '#2a3a9a'] },
    pharaoh: { base: ['#e8c848', '#2a6aa8'] },
    wyrm: { base: ['#aee0ff', '#4a8ac8'] },
    king: { base: ['#2a1a3a', '#b070ff'] },
};
const EYES = { void: '#c070ff', gold: '#40e0ff', ice: '#7fe8ff', red: '#ffd84a' };

const pal = (kind, p) => PAL[kind]?.[p] || PAL[kind]?.base || ['#888', '#444'];
const dk = (c, t = 0.3) => mix(c, '#140818', t);
const lt = (c, t = 0.3) => mix(c, '#fff6e0', t);

// ---------------------------------------------------------------- textures (ramp offsets per pixel)
const h2 = (x, y, s = 0) => { let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
// fur: short horizontal strokes, dark and light, so the coat reads as hair rather than grit
const fur = (s = 0) => (x, y) => { const v = h2((x + (y % 2)) >> 1, y, s); return v < 0.13 ? -1 : v > 0.94 ? 1 : 0; };
// scales: offset rows of little crescents, a dark lower lip and a lit top
const scales = (x, y) => { const r = Math.floor(y / 4), u = (x + (r % 2) * 3) % 6, v = y % 4; return (v === 3 && u >= 1 && u <= 4) || (v === 2 && (u === 0 || u === 5)) ? -1 : v === 0 && u === 2 && h2(x, y, 8) < 0.5 ? 1 : 0; };
const stone = (s = 0) => (x, y) => { const v = h2(x >> 1, y >> 1, s); return v < 0.1 ? -1 : v > 0.92 ? 1 : 0; };
const bark = (x, y) => (x % 3 === 0 && h2(x, y >> 2) > 0.25 ? -1 : 0);
const leaf = (s = 0) => (x, y) => { const v = h2(x, y, s); return v < 0.16 ? -1 : v > 0.86 ? 1 : 0; };
const bands = (step = 3) => (x, y) => ((y + (x >> 3)) % step === 0 ? -1 : 0);

// ---------------------------------------------------------------- parts
/** A glowing eye: bright iris, a dark pupil, a white glint. s = size; slit for beasts. */
function eye(P, x, y, col, s = 2, slit = false) {
    if (s === 1) { P.mp(x, y).fill(lt(col, 0.5)); return; }
    P.mrect(x, y, s, s).fill(col);
    P.mrect(x, y, s, 1).fill(lt(col, 0.45));
    if (slit) P.mrect(x + (s >> 1), y, 1, s).fill(INK);
    else if (s >= 3) P.mrect(x + 1, y + 1, s - 1, s - 1).fill(INK);
    else P.mp(x + 1, y + 1).fill(dk(col, 0.5));
    P.mp(x + (slit ? 0 : 1), y + (slit ? 0 : 1)).fill('#ffffff');
}
/** A big cute eye for slimes and spirits: dark, two glints. */
function cuteEye(P, x, y, w = 3, h = 4) {
    P.mrect(x, y, w, h).msub((Q) => Q.mp(x, y).mp(x + w - 1, y)).fill(INK);
    P.mp(x, y + 1).fill('#ffffff'); if (w > 2) P.mp(x + 1, y + 1).fill('#ffffff');
    P.mp(x + w - 1, y + h - 2).fill('#8a8aa8');
}
function fangs(P, xs, y, h = 2) { for (const x of xs) { P.mrect(x, y, 1, h).fill('#fff8e8'); } }
/** Mask circles along a polyline, radius easing from r0 to r1: tails, tentacles, necks. */
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
/** A membrane wing: arm from root to the wrist, fingers fan to the tips, scallops between them. */
function wing(P, root, wrist, tips, col, bone) {
    const pts = [root, wrist, ...tips];
    // the membrane: root, wrist, then each tip with a scallop pulled back toward the root
    const poly = [root, wrist];
    for (let i = 0; i < tips.length; i++) {
        poly.push(tips[i]);
        const nx = i + 1 < tips.length ? tips[i + 1] : root;
        const mx = (tips[i][0] + nx[0]) / 2, my = (tips[i][1] + nx[1]) / 2;
        poly.push([mx + (root[0] - mx) * 0.25, my + (root[1] - my) * 0.25]);
    }
    P.mpoly(poly).paint(col, { tex: (x, y) => (h2(x, y, 3) < 0.06 ? -1 : 0) });
    P.mline(root[0], root[1], wrist[0], wrist[1], 2);
    for (const t of tips) P.mline(wrist[0], wrist[1], t[0], t[1], 1);
    P.paint(bone, { noline: true, soft: true });
    P.mp(wrist[0], wrist[1] - 1).fill(lt(bone, 0.4));
    return pts;
}
/** Feathers: a fan of overlapping blades from a root. */
function feathers(P, root, tips, col) {
    tips.forEach((t, i) => {
        const [x, y] = root, a = Math.atan2(t[1] - y, t[0] - x), L = Math.hypot(t[0] - x, t[1] - y);
        const nx = -Math.sin(a), ny = Math.cos(a);
        P.mpoly([[x + nx * 2.6, y + ny * 2.6], [t[0] + nx * 2.2, t[1] + ny * 2.2], [t[0] + Math.cos(a) * 2, t[1] + Math.sin(a) * 2], [t[0] - nx * 1.6, t[1] - ny * 1.6], [x - nx * 2.6, y - ny * 2.6]])
            .paint(i % 2 ? dk(col, 0.12) : col, { soft: true });
        if (L > 6) P.mline(x, y, t[0], t[1], 1).fill(lt(col, 0.25));
    });
}
function claws(P, pts, col = '#f4ecd8') { for (const [x, y, dx] of pts) { P.mp(x, y).mp(x + dx, y + 1).fill(col); } }
/** Shine and dark pixels sprinkled inside the mask (crystals, sparks, gems). */
function sparkle(P, pts, col) { for (const [x, y] of pts) P.mp(x, y).fill(col); }

// ---------------------------------------------------------------- the bestiary
const DRAW = {
    slime(P, [a, b]) {
        P.mell(7, 27.5, 2.2, 2).paint(a);
        P.mell(18, 21, 15, 8.5).mell(18, 15, 9, 7.5).mpoly([[14, 9], [18, 4], [22, 9]]).msub((Q) => Q.mrect(0, 29, 40, 6)).paint(a, { hi: 1.3 });
        P.mell(17, 22, 8, 4.5).tint((c) => mix(c, b, 0.32));                       // the denser core
        P.mell(18, 27.5, 14, 1.6).tint((c) => mix(c, b, 0.5));
        P.mell(11, 13, 3.4, 2.2).fill(lt(a, 0.75)); P.mp(15, 9).mp(16, 8).fill('#ffffff'); P.mp(7, 20).fill(lt(a, 0.5));
        cuteEye(P, 19, 15); cuteEye(P, 26, 15);
        P.mrect(23, 21, 3, 2).fill('#5a1a2a'); P.mp(24, 22).fill('#ff8aa0');
        P.mrect(17, 20, 2, 1).mrect(30, 20, 1, 1).fill(mix(a, '#ff8aa0', 0.5));
    },
    bat(P, [a, b]) {
        const bone = dk(a, 0.25);
        wing(P, [19, 15], [9, 6], [[1, 5], [0, 15], [6, 22], [13, 24]], b, bone);
        wing(P, [25, 15], [35, 6], [[43, 5], [44, 15], [38, 22], [31, 24]], b, bone);
        P.mpoly([[16, 13], [14, 3], [20, 10]]).mpoly([[28, 13], [30, 3], [24, 10]]).paint(a);
        P.mp(16, 7).mp(16, 8).mp(28, 7).mp(28, 8).fill('#d88aa8');
        P.mell(22, 18, 7.2, 8).paint(a, { tex: fur(1) });
        P.mell(22, 21, 4, 4.5).tint((c) => lt(c, 0.18));
        eye(P, 18, 15, '#ff4a4a', 2); eye(P, 24, 15, '#ff4a4a', 2);
        P.mrect(21, 18, 2, 1).fill(dk(a, 0.6));
        P.mrect(19, 21, 6, 1).fill(INK); fangs(P, [19, 24], 22, 2);
        claws(P, [[19, 26, -1], [25, 26, 1]], '#d8c8b8');
    },
    wolf(P, [a, b], pn) {
        const belly = lt(a, 0.38), far = dk(a, 0.3), eyeC = pn === 'ice' ? '#7fe8ff' : '#ffd84a';
        // tail, far legs
        tube(P, [[15, 19], [9, 17], [5, 13], [3, 8], [4, 5]], 3, 1.4).paint(a, { tex: fur(2) });
        P.mp(4, 4).mp(3, 5).fill(lt(a, 0.5));
        P.mpoly([[18, 26], [22, 26], [21, 35], [18, 35]]).mpoly([[33, 26], [37, 26], [37, 35], [34, 35]]).paint(far);
        P.mrect(17, 35, 5, 2).mrect(33, 35, 5, 2).paint(dk(b, 0.2));
        // body and chest
        P.mell(25, 21, 13, 7.5).mell(36, 20, 7, 8.5).mell(15, 22, 6, 6.5).paint(a, { tex: fur(3) });
        P.mell(27, 26, 10, 2.6).tint((c) => mix(c, belly, 0.6));
        P.mell(23, 15, 10, 2.4).tint((c) => mix(c, b, 0.45));                     // the dark saddle
        // ruff, head, snout
        P.mpoly([[31, 12], [38, 8], [43, 12], [42, 25], [36, 28], [32, 22]]).paint(lt(a, 0.12), { tex: fur(4) });
        P.mpoly([[37, 11], [38, 2], [42, 8]]).mpoly([[41, 9], [45, 1], [46, 10]]).paint(b);
        P.mp(39, 6).mp(39, 7).mp(44, 5).mp(44, 6).fill('#c88a9a');
        P.mell(42, 14, 6.5, 5.6).mpoly([[44, 10], [49, 12], [52, 14.5], [51.5, 18], [44, 20]]).paint(a, { tex: fur(5) });
        P.mpoly([[43, 17], [51, 16.5], [50, 19], [44, 20]]).tint((c) => mix(c, belly, 0.55));
        P.mline(45, 12, 49, 13, 1).tint((c) => lt(c, 0.2));
        P.mrect(50, 13, 2, 2).fill(INK); P.mp(50, 13).fill('#6a6a7a');
        P.mline(45, 18, 50, 18, 1).fill(INK); fangs(P, [47, 49], 19, 1);
        eye(P, 44, 12, eyeC, 2, true);
        P.mline(42, 11, 46, 11, 1).fill(dk(b, 0.4));
        // near legs, paws
        P.mell(16, 25, 5.5, 5).mpoly([[12, 26], [19, 26], [18, 35], [14, 35]]).paint(a, { tex: fur(6) });
        P.mpoly([[36, 23], [43, 23], [41, 30], [41, 35], [37, 35], [37, 30]]).paint(a, { tex: fur(7) });
        P.mrect(13, 35, 6, 2).mrect(36, 35, 6, 2).paint(b);
        P.mp(18, 36).mp(41, 36).mp(16, 36).fill('#f4ecd8');
    },
    goblin(P, [a, b], pn) {
        const leather = '#8a5a3a';
        // back arm, legs and feet
        P.mline(12, 26, 9, 34, 3).paint(dk(a, 0.25)); P.mell(9, 35, 2, 2).paint(dk(a, 0.25));
        P.mpoly([[12, 34], [16, 34], [16, 41], [12, 41]]).mpoly([[20, 34], [24, 34], [25, 41], [21, 41]]).paint(b);
        P.mpoly([[11, 41], [17, 41], [19, 45], [11, 45]]).mpoly([[20, 41], [26, 41], [28, 45], [20, 45]]).paint(dk(a, 0.15));
        // tunic with a ragged hem, belt
        P.mpoly([[11, 24], [25, 24], [27, 36], [24, 34], [21, 37], [18, 34], [15, 37], [12, 34], [9, 36]]).paint(leather, { tex: (x, y) => (x % 4 === 0 && y > 28 ? -1 : 0) });
        P.mrect(11, 30, 15, 2).paint('#5a3a20'); P.mrect(17, 30, 2, 2).paint('#c8a040');
        P.mpoly([[15, 24], [21, 24], [18, 28]]).paint(a);
        // head, ears, nose
        P.mpoly([[10, 13], [0, 6], [2, 11], [9, 18]]).mpoly([[26, 13], [37, 6], [35, 11], [27, 18]]).paint(a);
        P.mline(3, 9, 8, 13, 1).mline(34, 9, 29, 13, 1).fill(mix(a, '#c86a6a', 0.45));
        P.mell(18, 15, 8.6, 8).paint(a, { tex: (x, y) => (h2(x, y, 9) < 0.06 ? -1 : 0) });
        P.mline(13, 11, 17, 12, 1).mline(23, 11, 19, 12, 1).fill(dk(a, 0.5));
        eye(P, 14, 13, '#ffe04a', 2); eye(P, 20, 13, '#ffe04a', 2);
        P.mpoly([[18, 14], [23, 17], [19, 19]]).paint(lt(a, 0.1), { soft: true });
        P.mrect(14, 20, 8, 2).fill(INK); fangs(P, [15, 18, 20], 20, 1); P.mp(21, 21).fill('#c84a4a');
        // the club and the arm that swings it
        P.mline(29, 34, 34, 15, 3).paint('#7a5230', { tex: bark });
        P.mell(34, 15, 3.4, 4).paint('#8a6038', { tex: bark });
        for (const [x, y] of [[31, 13], [37, 14], [34, 11], [36, 18]]) P.mp(x, y).fill('#d8d8e0');
        P.mline(24, 26, 29, 31, 3).paint(a); P.mell(30, 32, 2.2, 2.2).paint(a);
    },
    shroom(P, [a, b]) {
        const stem = '#f0e0c0';
        P.mell(14, 34, 3.6, 2).mell(22, 34, 3.6, 2).paint('#c8a888');
        P.mell(9.5, 26, 2, 2.2).paint(dk(stem, 0.15));
        P.mpoly([[12, 19], [24, 19], [25.5, 33], [10.5, 33]]).paint(stem, { soft: true });
        P.mell(26.5, 26, 2, 2.2).paint(stem);
        P.mell(18, 21, 14, 2.6).paint('#d8b890', { tex: (x) => (x % 2 ? -1 : 0) });
        P.mell(18, 15, 17, 10.5).msub((Q) => Q.mrect(0, 21, 40, 20)).paint(a, { hi: 1.3 });
        for (const [x, y, rx, ry] of [[9, 12, 3, 2.2], [19, 8, 3.6, 2.5], [28, 13, 2.6, 2], [14, 18, 2, 1.4], [24, 18, 2.2, 1.4], [3, 18, 1.4, 1.2]]) P.mell(x, y, rx, ry).paint('#fff4e0', { noline: true, soft: true });
        cuteEye(P, 14, 24, 2, 3); cuteEye(P, 20, 24, 2, 3);
        P.mp(12, 28).mp(23, 28).fill('#f0a0a0');
        P.mrect(17, 29, 2, 1).fill('#8a4a4a');
    },
    sapling(P, [a, b]) {
        const wood = '#7a5230';
        P.mpoly([[12, 42], [18, 40], [17, 47], [9, 47]]).mpoly([[22, 40], [28, 42], [31, 47], [23, 47]]).paint(dk(wood, 0.2), { tex: bark });
        P.mline(16, 30, 8, 23, 3).mline(8, 23, 4, 17, 2).mline(24, 30, 32, 25, 3).mline(32, 25, 36, 19, 2).paint(wood, { tex: bark });
        P.mpoly([[15, 21], [25, 21], [26.5, 43], [13.5, 43]]).paint(wood, { tex: bark });
        P.mell(20, 31, 5, 4).fill('#2a1808'); P.mell(20, 34, 2.4, 1.5).fill('#140804');
        eye(P, 17, 29, '#ffd84a', 2); eye(P, 22, 29, '#ffd84a', 2);
        P.mell(4, 16, 3.2, 3).mell(36, 18, 3.2, 3).paint(a, { tex: leaf(1) });
        P.mell(20, 13, 15.5, 10.5).mell(9, 16, 7, 5.5).mell(31, 12, 7, 6.5).mell(21, 5, 8, 5).paint(a, { tex: leaf(2) });
        for (const [x, y, r] of [[12, 13, 4], [26, 9, 4.5], [20, 17, 4], [31, 16, 3]]) P.mell(x, y, r, r * 0.75).tint((c) => mix(c, b, 0.4));
        for (const [x, y, r] of [[15, 6, 3], [9, 11, 2.4], [24, 4, 2.4]]) P.mell(x, y, r, r * 0.7).tint((c) => lt(c, 0.3));
        sparkle(P, [[10, 8], [27, 6], [33, 13], [16, 17], [6, 17]], '#ff9ab0');
    },
    skeleton(P, [a, b]) {
        const rot = dk(b, 0.2);
        // back arm, legs, pelvis
        P.mline(11, 20, 8, 27, 2).mline(8, 27, 9, 33, 2).paint(rot);
        P.mline(14, 34, 13, 40, 2).mline(13, 40, 13, 45, 2).mline(20, 34, 21, 40, 2).mline(21, 40, 22, 45, 2).paint(a);
        P.mell(13.5, 40.5, 1.6, 1.6).mell(21, 40.5, 1.6, 1.6).paint(a);
        P.mrect(11, 45, 4, 2).mrect(20, 45, 5, 2).paint(b);
        P.mpoly([[12, 31], [22, 31], [21, 35], [13, 35]]).paint(a); P.mp(15, 33).mp(18, 33).fill(INK);
        // spine and ribs
        P.mrect(16, 17, 2, 15).paint(b);
        P.mell(17, 23, 6.4, 5.4).msub((Q) => Q.mrect(16, 18, 2, 12)).paint(a);
        for (const y of [21, 24, 27]) P.mrect(11, y, 5, 1).mrect(18, y, 5, 1).fill(dk(b, 0.5));
        // skull
        P.mell(17, 9, 7, 7).paint(a, { hi: 1.2 }); P.mrect(13, 14, 9, 4).paint(a);
        P.mell(14.5, 9.5, 2.2, 2.2).mell(20.5, 9.5, 2.2, 2.2).fill(INK);
        eye(P, 14, 9, '#ff5a3a', 1); eye(P, 20, 9, '#ff5a3a', 1);
        P.mp(14, 10).mp(20, 10).fill('#a02a1a');
        P.mrect(17, 12, 1, 2).fill(INK);
        P.mrect(14, 15, 7, 1).fill(INK); for (const x of [14, 16, 18, 20]) P.mp(x, 16).fill(dk(b, 0.4));
        P.mline(12, 5, 15, 3, 1).fill(lt(a, 0.5));
        // the sword arm
        P.mline(23, 20, 27, 26, 2).mline(27, 26, 30, 24, 2).paint(a);
        P.mline(30, 23, 30, 4, 2).paint('#b8c0c8', { tex: (x, y) => (h2(x, y, 4) < 0.18 ? -1 : 0) });
        P.mline(31, 21, 31, 6, 1).fill('#e8eef4'); P.mrect(27, 24, 7, 1).paint('#8a6a3a', { flat: true }); P.mrect(30, 25, 1, 3).fill('#5a3a28');
    },
    golem(P, [a, b]) {
        const tex = stone(1), glow = '#ff8a3a';
        P.mpoly([[8, 16], [16, 16], [17, 36], [14, 40], [6, 40], [5, 28]]).paint(dk(b, 0.2), { tex });
        P.mell(10, 41, 6, 5).paint(dk(b, 0.2), { tex });
        P.mpoly([[17, 40], [26, 40], [26, 54], [16, 54]]).mpoly([[30, 40], [39, 40], [40, 54], [30, 54]]).paint(b, { tex });
        P.mpoly([[14, 16], [42, 16], [40, 42], [16, 42]]).paint(a, { tex });
        P.mrect(16, 29, 24, 1).mrect(27, 16, 1, 9).mrect(22, 34, 1, 8).fill(dk(a, 0.45));
        P.mpoly([[21, 4], [35, 4], [36, 17], [20, 17]]).paint(a, { tex: stone(2) });
        P.mrect(20, 7, 16, 2).paint(dk(a, 0.25));
        P.mrect(23, 10, 4, 2).mrect(30, 10, 4, 2).fill('#2a1a14'); eye(P, 24, 10, glow, 2); eye(P, 31, 10, glow, 2);
        P.mrect(25, 14, 6, 1).fill('#2a1a14');
        P.mell(28, 26, 5.5, 5.5).fill('#2a1a14'); P.mell(28, 26, 3.6, 3.6).paint(glow, { hi: 1.8, noline: true }); P.mp(27, 25).fill('#fff4c0');
        for (const [x0, y0, x1, y1] of [[28, 31, 26, 38], [23, 26, 18, 24], [33, 26, 38, 22], [28, 21, 30, 17]]) P.mline(x0, y0, x1, y1, 1).fill(lt(glow, 0.2));
        P.mpoly([[40, 16], [49, 16], [51, 30], [50, 40], [42, 40], [41, 28]]).paint(a, { tex: stone(3) });
        P.mrect(41, 28, 10, 1).fill(dk(a, 0.45));
        P.mell(46, 42, 6, 5).paint(a, { tex: stone(4) });
        sparkle(P, [[22, 4], [23, 4], [24, 3], [33, 4], [41, 16], [42, 16], [44, 15], [15, 16], [16, 15]], '#5a9a3a');
        sparkle(P, [[23, 3], [43, 15], [17, 15]], '#8ac85a');
    },
    crab(P, [a, b]) {
        for (const [x, dx] of [[13, -1], [17, -1], [33, 1], [37, 1]]) tube(P, [[x, 24], [x + dx * 5, 26], [x + dx * 7, 32]], 1.3, 0.8);
        P.paint(b, { tex: (x, y) => (y % 3 === 0 ? -1 : 0) });
        P.mline(15, 18, 9, 14, 3).paint(dk(a, 0.15));
        P.mell(6, 10, 6, 5).msub((Q) => Q.mpoly([[0, 7], [6, 10], [0, 12]])).paint(dk(a, 0.15));
        P.mline(18, 13, 17, 5, 1).mline(31, 13, 32, 5, 1).paint(b);
        P.mell(17, 4, 2, 2).mell(32, 4, 2, 2).paint('#f4f0e8', { noline: true }); P.mp(18, 4).mp(33, 4).fill(INK);
        P.mell(25, 19, 14, 9).paint(a, { hi: 1.2, tex: (x, y) => (h2(x >> 1, y >> 1, 7) < 0.12 ? -1 : 0) });
        P.mell(25, 25, 10, 2.6).tint((c) => lt(c, 0.25));
        for (const [x, y] of [[18, 14], [26, 12], [32, 15], [22, 17]]) P.mell(x, y, 1.6, 1.2).tint((c) => lt(c, 0.25));
        P.mrect(22, 22, 6, 1).fill(INK); P.mp(29, 21).mp(30, 19).fill('#e8f4ff');
        P.mline(35, 18, 41, 14, 3).paint(a);
        P.mell(44, 10, 6, 5.5).msub((Q) => Q.mpoly([[44, 10], [51, 6], [51, 12]])).paint(a, { hi: 1.2 });
        P.mp(46, 7).mp(47, 7).fill(lt(a, 0.5));
    },
    jelly(P, [a, b]) {
        for (let i = 0; i < 6; i++) {
            const x0 = 8 + i * 4.8, pts = [];
            for (let y = 20; y <= 42 - (i % 2) * 3; y += 2) pts.push([x0 + Math.sin(y * 0.35 + i * 1.7) * 2, y]);
            tube(P, pts, 1.2, 0.6);
        }
        P.paint(b, { tex: (x, y) => (y % 4 === 0 ? 1 : 0) });
        tube(P, [[17, 20], [16, 28], [18, 34], [16, 39]], 2.2, 1); tube(P, [[23, 20], [24, 27], [22, 33], [24, 37]], 2.2, 1);
        P.paint(lt(a, 0.15), { tex: (x, y) => ((x + y) % 3 === 0 ? -1 : 0) });
        for (let x = 6; x <= 34; x += 4) P.mell(x, 21, 2.4, 1.8);
        P.mell(20, 15, 15, 11.5).msub((Q) => Q.mrect(0, 22, 40, 30)).paint(lt(a, 0.2), { hi: 1.5 });
        P.mell(20, 14, 7, 5).tint((c) => mix(c, b, 0.35));
        P.mline(9, 11, 13, 6, 1).fill(lt(a, 0.7)); P.mp(16, 5).mp(17, 5).fill('#ffffff');
        cuteEye(P, 13, 14); cuteEye(P, 23, 14);
        P.mrect(19, 18, 2, 1).fill(INK);
        sparkle(P, [[11, 17], [29, 12], [26, 18], [8, 15]], '#ffffff');
    },
    naga(P, [a, b]) {
        const skin = '#e8b890', gold = '#e8c048';
        P.mpoly([[17, 4], [25, 3], [27, 8], [19, 26], [12, 22], [14, 10]]).paint(b, { tex: fur(1) });       // hair down the back
        tube(P, [[22, 30], [19, 40], [21, 50], [30, 55], [40, 54], [47, 48], [48, 42]], 6.5, 1.2).paint(a, { tex: scales });
        tube(P, [[25, 32], [23, 41], [25, 49], [31, 52], [39, 51]], 3, 1.2).tint((c) => mix(c, '#f0e0a0', 0.5));
        P.mline(16, 19, 10, 26, 3).paint(dk(skin, 0.2));
        P.mpoly([[16, 16], [28, 16], [26.5, 31], [17.5, 31]]).paint(skin, { soft: true });
        P.mell(19.5, 20, 3, 2.4).mell(25, 20, 3, 2.4).paint(a, { hi: 1.4 });
        P.mrect(16, 28, 12, 3).paint(gold, { hi: 1.4 }); P.mp(21, 29).fill('#40e0ff');
        P.mell(22, 10, 6, 6.5).paint(skin, { soft: true });
        P.mpoly([[16, 6], [28, 6], [27, 3], [22, 1], [16, 3]]).paint(b, { tex: fur(2) });
        P.mpoly([[17, 3], [19, -2], [21, 3]]).mpoly([[21, 2], [23, -3], [25, 2]]).mpoly([[25, 3], [28, 0], [28, 5]]).paint(gold, { hi: 1.3 });
        eye(P, 23, 9, '#40e0ff', 2, true); eye(P, 26, 9, '#40e0ff', 1);
        P.mp(25, 14).fill('#a84a4a'); P.mp(20, 12).fill(mix(skin, '#ff8a8a', 0.4));
        P.mline(37, 2, 37, 42, 2).paint('#c8d8e8', { hi: 1.3 });
        P.mpoly([[33, 6], [34, 0], [35, 6]]).mpoly([[36, 4], [37.5, -2], [39, 4]]).mpoly([[40, 6], [41, 0], [42, 6]]).paint('#e8f0f8');
        P.mrect(33, 6, 10, 2).paint(gold);
        P.mline(27, 19, 34, 15, 3).paint(skin); P.mell(36, 15, 2, 2).paint(skin, { soft: true });
    },
    wisp(P, [a, b]) {
        P.mpoly([[12, 35], [8, 44], [13, 40], [16, 47], [19, 40], [24, 44], [20, 35]]).paint(b, { tex: (x, y) => (y % 3 === 0 ? -1 : 0) });
        P.mpoly([[16, 0], [19, 7], [24, 10], [22, 13], [27, 20], [27, 29], [23, 36], [16, 38.5], [9, 36], [5, 29], [5, 20], [9, 13], [8, 8], [12, 10], [13, 4]]).paint(a, { hi: 1.6 });
        P.mell(16, 25, 7.5, 9).tint((c) => lt(c, 0.4)); P.mell(16, 27, 4.5, 5.5).tint((c) => lt(c, 0.7));
        cuteEye(P, 11, 21); cuteEye(P, 18, 21);
        P.mrect(15, 28, 2, 2).fill('#201030');
        sparkle(P, [[3, 10], [28, 6], [29, 16], [2, 26], [26, 41], [6, 40]], lt(a, 0.6));
    },
    scorpion(P, [a, b]) {
        for (let k = 0; k < 4; k++) tube(P, [[20 + k * 6, 27], [17 + k * 6, 31], [15 + k * 6, 36]], 1.3, 0.8);
        P.paint(b, { tex: (x, y) => (y % 3 === 0 ? -1 : 0) });
        P.mline(43, 26, 49, 29, 2).paint(dk(a, 0.15)); P.mell(53, 29, 4, 2.6).msub((Q) => Q.mpoly([[53, 29], [58, 27], [58, 31]])).paint(dk(a, 0.15));
        for (let i = 0; i < 5; i++) P.mell(14 + i * 5.5, 24, 4.6, 6 - Math.abs(i - 2) * 0.4);
        P.paint(a, { hi: 1.2 });
        for (let i = 1; i < 5; i++) P.mrect(11 + i * 5.5, 19, 1, 10).tint((c) => dk(c, 0.35));
        tube(P, [[13, 21], [8, 16], [6, 10], [9, 4], [15, 2], [19, 4]], 3.6, 2.2).paint(a, { tex: (x, y) => ((x + y) % 5 === 0 ? -1 : 0) });
        P.mpoly([[18, 2], [25, 5], [21, 9]]).paint('#e8483a', { hi: 1.3 }); P.mp(24, 5).fill(INK);
        P.mell(40, 23, 7, 6).paint(a, { hi: 1.2 });
        eye(P, 40, 19, '#201020', 2); eye(P, 43, 19, '#201020', 2);
        P.mline(44, 21, 48, 17, 2).paint(a); P.mell(51, 15, 4.2, 3).msub((Q) => Q.mpoly([[51, 15], [57, 13], [57, 17]])).paint(a, { hi: 1.2 });
    },
    cobra(P, [a, b]) {
        const belly = '#f0e0a0';
        P.mell(18, 44, 15, 5).mell(22, 37.5, 11, 4.5).paint(a, { tex: scales });
        P.mell(26, 45, 6, 2).tint((c) => mix(c, belly, 0.35));
        P.mpoly([[13, 9], [4, 16], [6, 26], [14, 31], [24, 31], [32, 26], [34, 16], [25, 9]]).paint(b, { tex: scales });
        P.mell(9, 19, 2.6, 3).mell(29, 19, 2.6, 3).paint('#f0e0a0', { noline: true }); P.mell(9, 19, 1.2, 1.6).mell(29, 19, 1.2, 1.6).fill(INK);
        P.mpoly([[14.5, 37], [23.5, 37], [23, 18], [15, 18]]).paint(a, { tex: scales });
        P.mpoly([[17, 37], [21, 37], [21, 21], [17, 21]]).paint(belly, { tex: (x, y) => (y % 3 === 0 ? -1 : 0), soft: true });
        P.mell(19, 11, 7, 5.5).paint(a, { hi: 1.3 });
        eye(P, 15, 9, '#ffe04a', 2, true); eye(P, 21, 9, '#ffe04a', 2, true);
        P.mp(17, 14).mp(20, 14).fill(INK);
        P.mline(18.5, 16, 18.5, 19, 1).fill('#e83a4a'); P.mp(17, 20).mp(20, 20).fill('#e83a4a');
        fangs(P, [16, 21], 15, 1);
    },
    mummy(P, [a, b]) {
        const wrap = bands(3);
        P.mline(21, 20, 31, 25, 3).paint(dk(a, 0.25), { tex: wrap });
        P.mpoly([[12, 32], [17, 32], [17, 46], [12, 46]]).mpoly([[19, 32], [24, 32], [25, 46], [20, 46]]).paint(b, { tex: wrap });
        P.mpoly([[11, 15], [25, 15], [24, 33], [12, 33]]).paint(a, { tex: wrap });
        for (const [x0, y0, x1, y1] of [[11, 19, 25, 24], [12, 27, 24, 30]]) P.mline(x0, y0, x1, y1, 1).fill(dk(a, 0.15));
        P.mline(12, 33, 9, 40, 1).mline(24, 32, 27, 38, 1).fill(dk(a, 0.2));
        P.mell(18, 9, 7, 7).paint(a, { tex: (x, y) => ((x + y) % 3 === 0 ? -1 : 0) });
        P.mrect(13, 8, 10, 2).fill('#1a0a10'); eye(P, 19, 8, '#ff4a4a', 2);
        P.mline(13, 4, 23, 7, 1).fill(lt(a, 0.3));
        P.mline(24, 18, 34, 22, 4).paint(a, { tex: wrap });
        P.mrect(34, 20, 3, 4).paint(dk(a, 0.1)); P.mline(33, 24, 31, 30, 1).fill(a);
    },
    harpy(P, [a, b]) {
        const skin = '#e8c0a0', scale = '#d8a840';
        feathers(P, [22, 20], [[2, 6], [1, 14], [4, 21], [8, 27], [14, 31]], b);
        feathers(P, [19, 30], [[8, 40], [11, 43], [15, 44]], dk(b, 0.1));
        P.mline(21, 33, 20, 41, 2).mline(27, 33, 28, 41, 2).paint(scale);
        for (const x of [17, 25]) P.mpoly([[x + 1, 41], [x + 6, 41], [x + 7, 44], [x, 44]]).paint(dk(scale, 0.25));
        claws(P, [[17, 44, 0], [24, 44, 0], [31, 43, 0]], '#2a1a14');
        P.mell(21, 32, 3.4, 3).mell(27, 32, 3.4, 3).paint(a, { tex: fur(2) });
        P.mpoly([[22, 4], [16, 6], [12, 14], [18, 18], [21, 10]]).paint(dk(a, 0.15), { tex: fur(3) });
        P.mell(24, 24, 6.5, 8.5).paint(a, { tex: fur(4) });
        P.mell(25, 23, 3.4, 4).tint((c) => lt(c, 0.25));
        P.mell(25, 11, 5.5, 6).paint(skin, { soft: true });
        P.mpoly([[19, 7], [24, 3], [31, 5], [29, 8], [21, 10]]).paint(a, { tex: fur(5) });
        eye(P, 27, 10, '#ffd84a', 2, true); P.mp(29, 14).fill('#a84a4a');
        feathers(P, [28, 20], [[38, 4], [43, 9], [44, 16], [41, 22]], a);
    },
    yeti(P, [a, b]) {
        const tex = fur(1), skin = '#6a8ac0';
        P.mline(13, 22, 6, 44, 8).paint(dk(a, 0.18), { tex });
        P.mell(6, 46, 4.5, 3.5).paint(dk(b, 0.15)); claws(P, [[3, 48, 0], [6, 49, 0], [9, 48, 0]], '#3a3a4a');
        P.mpoly([[17, 42], [26, 42], [26, 55], [17, 55]]).mpoly([[30, 42], [39, 42], [40, 55], [30, 55]]).paint(a, { tex });
        P.mrect(16, 54, 11, 3).mrect(29, 54, 12, 3).paint(b);
        P.mell(27, 30, 16.5, 16).paint(a, { tex });
        for (const [x, y] of [[11, 26], [11, 34], [43, 26], [43, 36], [20, 45], [34, 45]]) P.mpoly([[x, y], [x + (x < 27 ? -3 : 3), y + 2], [x, y + 4]]).paint(a, { tex });
        P.mell(27, 33, 9, 9).tint((c) => mix(c, b, 0.2));
        P.mpoly([[22, 8], [17, 4], [16, -1], [20, 3], [25, 5]]).mpoly([[38, 6], [42, 2], [43, -2], [44, 4], [40, 9]]).paint('#e8dcc0', { tex: (x, y) => (y % 2 ? -1 : 0) });
        P.mell(31, 11, 10, 9).paint(a, { tex: fur(2) });
        P.mell(33, 13, 6.4, 5.5).paint(skin, { soft: true });
        P.mline(29, 9, 33, 10, 1).mline(39, 9, 35, 10, 1).fill(dk(skin, 0.6));
        eye(P, 30, 10, '#40a0ff', 2); eye(P, 35, 10, '#40a0ff', 2);
        P.mrect(30, 15, 8, 3).fill(INK); fangs(P, [31, 36], 15, 2); P.mrect(32, 17, 4, 1).fill('#a84a5a');
        P.mline(42, 22, 48, 44, 8).paint(a, { tex: fur(3) });
        P.mell(48, 46, 4.5, 3.5).paint(b); claws(P, [[45, 49, 0], [48, 50, 0], [51, 49, 0]], '#3a3a4a');
    },
    knight(P, [a, b], pn) {
        const eyeC = EYES[pn] || '#ff6a3a', plume = pn === 'void' ? '#8a3ad8' : pn === 'gold' ? '#2a6ac8' : '#c8302a', steel = '#d8e0ea';
        P.mpoly([[14, 22], [30, 22], [32, 50], [12, 52]]).paint(dk(plume, 0.3), { tex: (x) => (x % 3 === 0 ? -1 : 0) });   // cape
        P.mpoly([[15, 40], [21, 40], [21, 54], [15, 54]]).mpoly([[23, 40], [29, 40], [30, 54], [24, 54]]).paint(b, { hi: 1.3 });
        P.mell(18, 46, 3, 2.2).mell(26.5, 46, 3, 2.2).paint(a, { hi: 1.4 });
        P.mrect(14, 54, 8, 3).mrect(23, 54, 9, 3).paint(dk(b, 0.1));
        P.mpoly([[13, 37], [31, 37], [33, 43], [11, 43]]).paint(b, { tex: (x) => (x % 4 === 0 ? -1 : 0) });
        P.mpoly([[13, 22], [31, 22], [29, 38], [15, 38]]).paint(a, { hi: 1.4 });
        P.mline(22, 23, 22, 36, 1).fill(lt(a, 0.45)); P.mrect(14, 36, 16, 2).paint('#5a3a28'); P.mrect(21, 36, 3, 2).paint('#c8a040');
        P.mpoly([[2, 24], [12, 24], [12, 35], [7, 41], [2, 35]]).paint(b, { hi: 1.3 });
        P.mpoly([[3.5, 25.5], [10.5, 25.5], [10.5, 34.5], [7, 38.5], [3.5, 34.5]]).paint(plume, { soft: true });
        P.mrect(6, 27, 2, 9).mrect(4, 30, 6, 2).fill('#e8c860');
        P.mell(12, 23, 6, 4.5).mell(32, 23, 6, 4.5).paint(a, { hi: 1.5 });
        P.mpoly([[21, 4], [16, 0], [8, 2], [4, 8], [10, 6], [15, 6]]).paint(plume, { tex: (x, y) => ((x + y) % 3 === 0 ? -1 : 0) });
        P.mell(22, 12, 8, 9).paint(a, { hi: 1.5 });
        P.mrect(16, 11, 12, 3).fill('#0c0610'); eye(P, 19, 12, eyeC, 1); eye(P, 25, 12, eyeC, 1); P.mp(19, 11).mp(25, 11).fill(mix(eyeC, '#0c0610', 0.5));
        P.mrect(22, 3, 1, 8).fill(lt(a, 0.5)); for (const [x, y] of [[24, 16], [26, 16], [25, 18]]) P.mp(x, y).fill(INK);
        P.mline(32, 26, 38, 35, 4).paint(a, { hi: 1.3 });
        P.mline(40, 36, 40, 10, 2).paint(steel, { hi: 1.4 }); P.mline(41, 34, 41, 12, 1).fill('#ffffff');
        P.mrect(36, 36, 9, 2).paint('#c8a040', { hi: 1.3 }); P.mrect(40, 38, 2, 3).fill('#5a3a28');
        P.mell(39, 36, 2.4, 2.2).paint(a, { hi: 1.3 });
    },
    imp(P, [a, b]) {
        wing(P, [15, 21], [7, 12], [[0, 8], [1, 18], [6, 26]], b, dk(a, 0.3));
        wing(P, [24, 21], [31, 12], [[37, 8], [37, 17], [33, 25]], b, dk(a, 0.3));
        tube(P, [[14, 34], [8, 38], [4, 35], [4, 31]], 1.2, 0.8).paint(a); P.mpoly([[1, 31], [4, 26], [7, 31], [4, 33]]).paint(a);
        P.mline(15, 34, 14, 40, 3).mline(22, 34, 24, 40, 3).paint(b);
        P.mrect(12, 40, 4, 2).mrect(23, 40, 4, 2).fill(INK);
        P.mell(19, 28, 7, 8).paint(a, { hi: 1.2 }); P.mell(19, 30, 3.6, 4).tint((c) => lt(c, 0.25));
        P.mpoly([[13, 11], [8, 4], [9, 0], [12, 5], [17, 8]]).mpoly([[24, 8], [28, 4], [30, 0], [30, 6], [27, 11]]).paint('#f0e0b0', { tex: (x, y) => (y % 2 ? -1 : 0) });
        P.mpoly([[12, 14], [7, 12], [12, 17]]).mpoly([[28, 14], [33, 12], [28, 17]]).paint(a);
        P.mell(20, 15, 8, 7).paint(a, { hi: 1.3 });
        P.mline(15, 11, 19, 13, 1).mline(26, 11, 22, 13, 1).fill(dk(a, 0.55));
        eye(P, 16, 13, '#ffe84a', 2, true); eye(P, 22, 13, '#ffe84a', 2, true);
        P.mrect(16, 18, 8, 2).fill(INK); fangs(P, [17, 22], 18, 1); P.mp(19, 19).mp(20, 19).fill('#ff6a6a');
        P.mline(28, 40, 34, 14, 2).paint('#8a6a3a');
        P.mpoly([[30, 12], [31, 7], [32, 12]]).mpoly([[33, 13], [35, 7], [36, 14]]).mpoly([[36, 15], [39, 10], [38, 16]]).paint('#d0d8e4');
        P.mline(30, 15, 37, 17, 1).fill('#b8c0cc');
        P.mline(24, 26, 31, 26, 3).paint(a); P.mell(31.5, 26, 2, 2).paint(a);
    },
    drake(P, [a, b], pn) {
        const horn = '#f0e0b0', belly = lt(a, 0.45), eyeC = EYES[pn] || '#ffe84a';
        wing(P, [24, 25], [16, 6], [[6, 1], [3, 11], [7, 20], [15, 25]], dk(b, 0.15), dk(a, 0.3));
        tube(P, [[14, 34], [6, 38], [2, 44], [6, 48]], 4, 1.2).paint(a, { tex: scales });
        P.mpoly([[4, 46], [9, 45], [8, 51], [3, 50]]).paint(b);
        P.mpoly([[22, 40], [26, 40], [25, 49], [21, 49]]).mpoly([[34, 40], [38, 40], [38, 49], [34, 49]]).paint(dk(a, 0.3));
        P.mell(29, 32, 16, 10).paint(a, { tex: scales });
        P.mell(30, 38.5, 12, 3.5).paint(belly, { tex: (x) => (x % 3 === 0 ? -1 : 0), noline: true });
        for (const x of [16, 22, 28, 34]) P.mpoly([[x, 24], [x + 3, 18], [x + 5, 23]]).paint(horn);
        P.mpoly([[37, 27], [44, 15], [51, 18], [46, 33]]).paint(a, { tex: scales });
        P.mpoly([[42, 26], [47, 18], [49, 21], [45, 31]]).tint((c) => mix(c, belly, 0.5));
        P.mpoly([[45, 13], [37, 7], [40, 4], [48, 11]]).paint(horn, { tex: (x, y) => ((x + y) % 2 ? -1 : 0) });
        P.mell(48, 18, 7, 6).mpoly([[50, 14], [61, 18], [61, 23], [50, 24]]).paint(a, { tex: scales, hi: 1.2 });
        P.mline(51, 22, 60, 22, 1).fill(INK); fangs(P, [53, 56, 59], 23, 1);
        P.mp(59, 19).mp(60, 19).fill(INK);
        eye(P, 49, 16, eyeC, 2, true); P.mline(47, 14, 52, 15, 1).fill(dk(b, 0.4));
        P.mell(20, 37, 6.5, 6).mpoly([[16, 38], [24, 38], [23, 49], [17, 49]]).paint(a, { tex: scales });
        P.mpoly([[38, 37], [43, 37], [42, 49], [38, 49]]).paint(a, { tex: scales });
        P.mrect(15, 49, 9, 2).mrect(37, 49, 7, 2).paint(b); claws(P, [[23, 50, 1], [43, 50, 1]]);
        wing(P, [28, 25], [30, 11], [[38, 4], [39, 13], [35, 22]], b, dk(a, 0.2));
    },
    shade(P, [a, b], pn) {
        const eyeC = pn === 'void' ? '#c070ff' : '#ff4a8a';
        P.mline(30, 22, 35, 33, 3).mline(6, 22, 1, 33, 3).paint(dk(a, 0.2));
        for (const [x, dx] of [[35, 1], [1, -1]]) { P.mline(x, 33, x + dx, 37, 1).mline(x - dx, 34, x - dx, 38, 1).mline(x + dx * 2, 32, x + dx * 3, 35, 1).fill('#c8a0ff'); }
        P.mpoly([[18, 2], [28, 9], [31, 20], [32, 40], [29, 50], [26, 44], [23, 52], [20, 45], [16, 53], [12, 45], [9, 51], [6, 43], [4, 40], [5, 20], [8, 9]]).paint(a, { tex: (x, y) => (x % 4 === 1 && y > 18 ? -1 : 0) });
        P.mell(18, 14, 8.5, 9.5).msub((Q) => Q.mell(18, 15, 7, 8.4)).tint((c) => lt(c, 0.18));
        P.mell(18, 15, 7, 8.4).fill('#06030c');
        eye(P, 13, 13, eyeC, 3); eye(P, 20, 13, eyeC, 3);
        P.mrect(13, 16, 3, 1).mrect(20, 16, 3, 1).fill(mix(eyeC, '#06030c', 0.6));
        sparkle(P, [[3, 46], [33, 47], [17, 55], [27, 54], [6, 54]], lt(b, 0.5));
    },
    gargoyle(P, [a, b]) {
        const tex = stone(5), eyeC = '#ff6a3a';
        wing(P, [22, 26], [12, 6], [[3, 3], [2, 14], [5, 26], [14, 34]], b, dk(a, 0.25));
        P.mpoly([[18, 42], [24, 42], [24, 50], [17, 50]]).paint(dk(a, 0.25), { tex });
        tube(P, [[18, 44], [10, 48], [4, 46], [2, 41]], 2.2, 1).paint(a, { tex }); P.mpoly([[0, 39], [3, 36], [5, 41], [2, 43]]).paint(a);
        P.mell(26, 35, 11, 11).paint(a, { tex });
        P.mline(21, 28, 26, 40, 1).mline(31, 30, 28, 36, 1).fill(dk(a, 0.45));
        P.mell(24, 42, 6, 5.5).mpoly([[20, 44], [28, 44], [28, 51], [20, 51]]).paint(a, { tex });
        P.mrect(19, 50, 10, 2).paint(b); claws(P, [[28, 51, 1]]);
        P.mpoly([[25, 13], [20, 3], [24, 1], [28, 10]]).mpoly([[34, 11], [38, 1], [41, 3], [37, 14]]).paint(b, { tex: (x, y) => (y % 2 ? -1 : 0) });
        P.mpoly([[23, 18], [18, 15], [23, 21]]).paint(a);
        P.mell(30, 18, 9, 7.5).paint(a, { tex: stone(6) });
        P.mrect(25, 14, 11, 2).paint(dk(a, 0.2));
        eye(P, 27, 16, eyeC, 2); eye(P, 33, 16, eyeC, 2);
        P.mrect(28, 22, 8, 2).fill(INK); fangs(P, [29, 34], 22, 2);
        P.mline(37, 30, 41, 40, 4).paint(a, { tex: stone(7) }); P.mell(42, 43, 3.4, 3).paint(b); claws(P, [[40, 46, 0], [43, 46, 0], [45, 45, 1]]);
        wing(P, [34, 26], [42, 10], [[51, 6], [52, 16], [48, 26], [40, 32]], b, dk(a, 0.15));
    },
    fiend(P, [a, b]) {
        const horn = '#f0e0b0', eyeC = '#ffe84a';
        wing(P, [26, 30], [12, 8], [[2, 4], [1, 18], [4, 32], [12, 42], [22, 40]], b, dk(a, 0.3));
        wing(P, [38, 30], [52, 8], [[61, 4], [62, 18], [59, 32], [52, 42], [42, 40]], dk(b, 0.1), dk(a, 0.3));
        tube(P, [[24, 52], [14, 58], [6, 56], [4, 50]], 2, 1).paint(a); P.mpoly([[1, 49], [4, 44], [7, 49], [4, 52]]).paint(a);
        P.mline(18, 34, 10, 52, 5).paint(dk(a, 0.25)); P.mell(10, 54, 3.4, 3).paint(dk(a, 0.25)); claws(P, [[7, 56, 0], [10, 57, 0], [13, 56, 0]]);
        P.mpoly([[22, 50], [29, 50], [29, 62], [21, 62]]).mpoly([[35, 50], [42, 50], [43, 62], [35, 62]]).paint(b);
        P.mrect(20, 62, 9, 3).mrect(34, 62, 10, 3).fill(INK);
        P.mell(32, 40, 14, 16).paint(a, { hi: 1.2 });
        P.mell(26, 33, 5, 4).mell(38, 33, 5, 4).tint((c) => lt(c, 0.12));
        for (const y of [41, 46, 51]) P.mrect(28, y, 9, 1).tint((c) => dk(c, 0.3));
        P.mrect(32, 40, 1, 13).tint((c) => dk(c, 0.3));
        P.mell(32, 36, 3, 3).fill('#2a0814'); P.mell(32, 36, 2, 2).paint('#ff6ab0', { hi: 1.8, noline: true });
        P.mpoly([[25, 15], [16, 6], [17, 0], [21, 6], [29, 11]]).mpoly([[39, 11], [47, 4], [48, -2], [50, 6], [41, 16]]).paint(horn, { tex: (x, y) => (y % 2 ? -1 : 0) });
        P.mell(32, 19, 10, 9).paint(a, { hi: 1.3 });
        P.mline(26, 14, 31, 16, 1).mline(39, 14, 34, 16, 1).fill(dk(a, 0.6));
        eye(P, 27, 16, eyeC, 3, true); eye(P, 34, 16, eyeC, 3, true);
        P.mrect(27, 23, 10, 3).fill(INK); fangs(P, [28, 31, 34, 36], 23, 2); P.mrect(30, 25, 4, 1).fill('#a8203a');
        P.mline(46, 34, 54, 50, 5).paint(a); P.mell(54, 52, 3.4, 3).paint(a); claws(P, [[51, 54, 0], [54, 55, 0], [57, 54, 1]]);
    },
    // ------------------------------------------------ bosses (96 × 96)
    treant(P, [a, b]) {
        const tex = bark, lv = '#4a8a3a', lv2 = '#3a7a2a';
        P.mpoly([[24, 76], [36, 74], [38, 92], [16, 94]]).mpoly([[60, 74], [72, 76], [82, 94], [58, 92]]).paint(b, { tex });
        tube(P, [[36, 50], [18, 42], [8, 42], [4, 54], [6, 62]], 5, 2.5).paint(dk(a, 0.15), { tex });
        P.mpoly([[33, 30], [63, 30], [66, 82], [30, 82]]).paint(a, { tex });
        P.mpoly([[30, 76], [22, 84], [36, 82]]).mpoly([[66, 76], [74, 84], [60, 82]]).paint(a, { tex });
        P.mell(48, 52, 12, 7).fill('#1a0c04');
        eye(P, 40, 49, '#ffd84a', 4); eye(P, 52, 49, '#ffd84a', 4);
        P.mline(37, 46, 45, 48, 2).mline(59, 46, 51, 48, 2).paint(dk(a, 0.3));
        P.mpoly([[40, 61], [56, 61], [53, 68], [43, 68]]).fill('#1a0c04'); fangs(P, [42, 46, 50, 54], 61, 2);
        P.mpoly([[34, 70], [48, 75], [64, 70], [62, 82], [36, 82]]).paint(dk(b, 0.1), { tex: (x, y) => (h2(x, y, 5) < 0.3 ? -1 : 0) });
        sparkle(P, [[33, 60], [34, 61], [63, 50], [62, 51], [64, 49], [45, 76], [46, 76]], '#6aaa4a');
        P.mell(48, 22, 44, 20).mell(26, 22, 18, 13).mell(72, 20, 18, 13).mell(48, 9, 20, 9).paint(lv, { tex: leaf(3) });
        for (const [x, y, r] of [[22, 26, 8], [48, 26, 10], [74, 26, 8], [36, 14, 7], [62, 12, 7]]) P.mell(x, y, r, r * 0.65).tint((c) => mix(c, lv2, 0.6));
        for (const [x, y, r] of [[30, 10, 5], [52, 4, 6], [16, 18, 4], [70, 10, 5]]) P.mell(x, y, r, r * 0.6).tint((c) => lt(c, 0.25));
        tube(P, [[62, 50], [80, 42], [90, 46], [93, 58], [90, 66]], 5, 2.5).paint(a, { tex });
        P.mell(90, 40, 6, 5).mell(4, 38, 6, 5).paint(lv, { tex: leaf(4) });
        for (const [x, y] of [[20, 14], [60, 10], [34, 26], [76, 26], [48, 18], [10, 24], [84, 18], [66, 30]]) { P.mell(x, y, 2.6, 2.2).paint('#ff8a9a', { soft: true, noline: true }); P.mp(x, y).fill('#ffe0a0'); }
    },
    colossus(P, [a, b]) {
        const tex = stone(11), glow = '#ff8a3a';
        P.mpoly([[4, 30], [26, 28], [28, 74], [8, 74]]).paint(dk(b, 0.15), { tex }); P.mpoly([[0, 70], [28, 70], [26, 88], [2, 88]]).paint(dk(a, 0.2), { tex });
        P.mpoly([[30, 70], [46, 70], [46, 94], [28, 94]]).mpoly([[50, 70], [66, 70], [68, 94], [50, 94]]).paint(b, { tex });
        P.mpoly([[24, 26], [72, 26], [68, 74], [28, 74]]).paint(a, { tex });
        P.mrect(28, 50, 40, 1).mrect(47, 26, 1, 12).mrect(36, 60, 1, 14).mrect(60, 58, 1, 16).fill(dk(a, 0.45));
        P.mpoly([[34, 6], [62, 6], [64, 30], [32, 30]]).paint(a, { tex: stone(12) });
        P.mrect(32, 12, 32, 3).paint(dk(a, 0.25));
        P.mrect(37, 16, 8, 5).mrect(51, 16, 8, 5).fill('#1a0e0a'); eye(P, 39, 17, glow, 4); eye(P, 53, 17, glow, 4);
        P.mrect(40, 25, 16, 2).fill('#1a0e0a');
        P.mell(48, 46, 10, 10).fill('#1a0e0a'); P.mell(48, 46, 7, 7).paint(glow, { hi: 1.8, noline: true }); P.mell(48, 46, 3, 3).fill('#ffe8b0');
        for (const [x0, y0, x1, y1] of [[48, 56, 44, 68], [40, 46, 30, 40], [56, 46, 66, 38], [48, 36, 50, 28], [42, 52, 34, 58], [54, 52, 62, 62]]) P.mline(x0, y0, x1, y1, 1).fill(lt(glow, 0.15));
        P.mpoly([[68, 30], [90, 28], [92, 74], [70, 74]]).paint(dk(b, 0.0), { tex: stone(13) });
        P.mpoly([[66, 70], [94, 70], [94, 88], [68, 88]]).paint(a, { tex: stone(14) });
        P.mrect(70, 50, 22, 1).mrect(69, 80, 25, 1).fill(dk(a, 0.45));
        P.mell(18, 28, 12, 7).mell(80, 28, 12, 7).paint(lt(a, 0.08), { tex: stone(15) });
        sparkle(P, [[10, 22], [11, 22], [12, 21], [20, 22], [76, 22], [77, 21], [84, 22], [85, 22], [36, 6], [37, 5], [58, 6], [59, 6]], '#5a9a3a');
        sparkle(P, [[11, 21], [77, 20], [37, 4], [58, 5]], '#8ac85a');
    },
    kraken(P, [a, b]) {
        const sucker = lt(a, 0.5);
        // tentacles hang in a gentle wave and curl at the tips; the far row first, darker
        for (const far of [true, false]) for (let i = far ? 0 : 1; i < 8; i += 2) {
            const x = 8 + i * 11.5, s = i < 4 ? -1 : 1, out = (x - 48) / 48 * 8, w = Math.sin(i * 1.9) * 2;
            const tip = [x + out + s * 2, 86];
            tube(P, [[x, 50], [x + out * 0.3 + w, 62], [x + out * 0.6 - w, 74], tip, [tip[0] + s * 4, 90], [tip[0] + s * 6, 86], [tip[0] + s * 4, 83]], far ? 4.2 : 5, 1.1);
            P.paint(far ? dk(b, 0.25) : b, { tex: (xx, yy) => (yy % 4 === 0 ? -1 : 0) });
            for (let k = 0; k < 4; k++) { const t = (k + 0.5) / 4.5; P.mp(x + out * t - s * (2.5 - t * 1.5), 56 + k * 7).fill(far ? dk(sucker, 0.25) : sucker); }
        }
        P.mell(48, 32, 34, 27).msub((Q) => Q.mrect(0, 56, 96, 40)).paint(a, { hi: 1.2, tex: (x, y) => (h2(x >> 1, y >> 1, 21) < 0.08 ? -1 : 0) });
        for (const [x, y, r] of [[30, 16, 3], [64, 14, 4], [48, 8, 3], [22, 30, 2.5], [74, 30, 2.5], [56, 20, 2]]) P.mell(x, y, r, r * 0.8).tint((c) => dk(c, 0.25));
        P.mell(38, 16, 10, 5).tint((c) => lt(c, 0.25));
        P.mell(34, 37, 8, 7).mell(62, 37, 8, 7).fill('#f4f0d8');
        eye(P, 30, 33, '#ffe84a', 8, true); eye(P, 58, 33, '#ffe84a', 8, true);
        P.mline(24, 28, 38, 32, 2).mline(72, 28, 58, 32, 2).paint(dk(a, 0.3));
        P.mpoly([[40, 48], [56, 48], [52, 56], [44, 56]]).fill('#201020');
        P.mpoly([[44, 48], [48, 54], [52, 48]]).paint('#e8d8a0');
    },
    pharaoh(P, [a, b]) {
        const wrap = '#e0d4b0', gold = a;
        P.mrect(34, 84, 10, 10).mrect(52, 84, 10, 10).paint('#a8986a', { tex: bands(3) });
        P.mline(32, 46, 20, 60, 6).paint(dk(wrap, 0.25), { tex: bands(3) });
        P.mpoly([[32, 38], [64, 38], [71, 88], [25, 88]]).paint(wrap, { tex: bands(4) });
        for (const [x0, y0, x1, y1] of [[30, 48, 66, 54], [27, 74, 69, 80]]) P.mline(x0, y0, x1, y1, 1).fill('#a8986a');
        P.mrect(30, 60, 36, 4).paint(gold, { hi: 1.4 }); P.mrect(46, 60, 4, 4).paint(b, { hi: 1.3 });
        P.mpoly([[40, 64], [56, 64], [60, 88], [36, 88]]).paint(gold, { hi: 1.2 });
        P.mpoly([[40, 64], [56, 64], [60, 88], [36, 88]]).tint((c, x) => (Math.floor((x - 36) / 3) % 2 ? mix(c, b, 0.8) : c));
        const nemes = (Q) => Q.mpoly([[34, 4], [62, 4], [66, 18], [74, 50], [62, 52], [60, 34], [36, 34], [34, 52], [22, 50], [30, 18]]);
        nemes(P).paint(b, { hi: 1.3 });
        nemes(P).tint((c, x, y) => (Math.floor(y / 3) % 2 ? mix(c, gold, 0.8) : c));
        P.mell(48, 26, 12, 14).paint(gold, { hi: 1.5 });
        P.mrect(38, 22, 20, 2).fill('#1a2a4a');
        P.mrect(40, 24, 5, 4).mrect(51, 24, 5, 4).fill('#0a0a14'); eye(P, 41, 24, '#40e0ff', 3); eye(P, 52, 24, '#40e0ff', 3);
        P.mrect(46, 30, 4, 4).paint(lt(gold, 0.2), { soft: true }); P.mrect(45, 36, 6, 1).fill('#7a5a1a');
        P.mpoly([[46, 40], [50, 40], [49, 48], [47, 48]]).paint(b);
        P.mrect(30, 2, 36, 5).paint(gold, { hi: 1.4 });
        P.mpoly([[44, 2], [48, -6], [52, 2]]).paint('#e8483a'); P.mp(48, -1).fill('#ffe8a0');
        P.mell(48, 46, 18, 6).msub((Q) => Q.mell(48, 40, 12, 5)).paint(gold, { tex: (x) => (x % 3 === 0 ? -1 : 0) });
        P.mell(48, 48, 16, 4).msub((Q) => Q.mell(48, 42, 12, 5)).tint((c, x) => (x % 4 === 0 ? mix(c, '#40a0e0', 0.7) : c));
        P.mline(20, 60, 30, 70, 5).paint(wrap, { tex: bands(3) }); P.mrect(27, 66, 5, 3).paint(gold, { hi: 1.4 });
        P.mline(64, 46, 74, 58, 6).mline(74, 58, 84, 48, 5).paint(wrap, { tex: bands(3) }); P.mrect(80, 48, 4, 4).paint(gold, { hi: 1.4 });
        P.mline(86, 92, 87, 8, 3).paint('#8a6a2a', { tex: bands(5) });
        P.mell(87, 7, 6.5, 6.5).paint('#ffd84a', { hi: 1.8 }); P.mell(87, 7, 3, 3).fill('#fff8d8');
        sparkle(P, [[79, 2], [95, 4], [80, 14], [94, 12]], '#ffe8a0');
    },
    wyrm(P, [a, b]) {
        const crystal = '#e8f4ff', belly = lt(a, 0.5), eyeC = '#40e0ff';
        wing(P, [44, 44], [30, 10], [[12, 4], [8, 18], [14, 32], [28, 42]], dk(b, 0.15), dk(a, 0.35));
        tube(P, [[20, 68], [8, 76], [2, 86], [10, 92]], 8, 2).paint(a, { tex: scales });
        P.mpoly([[30, 78], [38, 78], [38, 94], [30, 94]]).mpoly([[58, 78], [66, 78], [66, 94], [58, 94]]).paint(dk(a, 0.3));
        P.mell(48, 62, 34, 21).paint(a, { tex: scales });
        P.mell(50, 72, 24, 6).paint(belly, { tex: (x) => (x % 4 === 0 ? -1 : 0), noline: true });
        for (const [x, y] of [[22, 46], [34, 42], [48, 40], [62, 42]]) P.mpoly([[x, y + 4], [x + 4, y - 8], [x + 9, y + 4]]).paint(crystal, { hi: 1.6 });
        P.mpoly([[66, 52], [74, 32], [86, 36], [80, 58]]).paint(a, { tex: scales });
        P.mell(80, 38, 13, 11).mpoly([[84, 32], [97, 38], [97, 48], [84, 50]]).paint(a, { tex: scales, hi: 1.2 });
        P.mpoly([[72, 30], [64, 14], [69, 14], [78, 26]]).mpoly([[78, 28], [80, 12], [85, 15], [86, 28]]).paint(crystal, { hi: 1.6 });
        P.mline(85, 46, 96, 46, 2).fill(INK); fangs(P, [87, 90, 93], 48, 2);
        P.mp(95, 40).mp(96, 40).fill(INK);
        eye(P, 78, 35, eyeC, 4, true); P.mline(74, 32, 84, 34, 2).paint(dk(a, 0.3));
        P.mell(34, 68, 11, 10).mpoly([[26, 72], [40, 72], [40, 94], [26, 94]]).paint(a, { tex: scales });
        P.mpoly([[62, 74], [72, 74], [72, 94], [62, 94]]).paint(a, { tex: scales });
        P.mrect(24, 92, 17, 3).mrect(60, 92, 14, 3).paint(b); claws(P, [[40, 93, 1], [73, 93, 1]]);
        wing(P, [56, 46], [64, 22], [[80, 14], [78, 26], [70, 40]], b, dk(a, 0.2));
        sparkle(P, [[24, 40], [50, 34], [66, 12], [82, 10], [6, 20], [12, 60]], '#ffffff');
    },
    king(P, [a, b]) {
        const glow = b, silver = '#d8c8f0', robe = mix(a, '#3a2a5a', 0.25), voidC = '#06040e';
        const shard = (x, y, r) => { P.mpoly([[x, y - r * 1.6], [x + r, y], [x, y + r * 1.6], [x - r, y]]).paint('#e8d8ff', { hi: 1.8, noline: true }); P.mp(x, y - Math.round(r)).fill('#ffffff'); };
        // the cape behind, tattered at the hem
        P.mpoly([[26, 30], [2, 99], [94, 99], [70, 30]]).msub((Q) => { for (const x of [6, 20, 34, 62, 76, 88]) Q.mpoly([[x - 5, 100], [x, 90], [x + 5, 100]]); }).paint(dk(a, 0.2), { tex: (x, y) => (x % 6 === 3 && y > 40 ? -1 : 0) });
        // the robe, parted over a glowing inner layer
        P.mpoly([[34, 30], [20, 99], [76, 99], [62, 30]]).paint(robe, { tex: (x, y) => (x % 5 === 2 && y > 44 ? -1 : 0) });
        P.mpoly([[45, 58], [39, 99], [57, 99], [51, 58]]).paint(mix(glow, voidC, 0.7), { noline: true });
        for (let y = 62; y < 98; y += 6) P.mline(48, y, 48 + ((y / 6) % 2 ? 2 : -2), y + 3, 1).fill(mix(glow, voidC, 0.2));
        P.mline(45, 58, 39, 99, 1).mline(51, 58, 57, 99, 1).fill(mix(glow, robe, 0.45));
        for (let x = 22; x < 76; x += 4) if (x < 39 || x > 57) P.mrect(x, 95, 2, 1).fill(mix(glow, robe, 0.3));
        // sleeves and claws
        P.mpoly([[34, 34], [12, 62], [22, 68], [42, 46]]).paint(dk(robe, 0.15), { tex: (x, y) => ((x + y) % 5 === 0 ? -1 : 0) });
        P.mell(15, 66, 4, 3.5).paint('#2a1a3a'); claws(P, [[11, 69, 0], [14, 70, 0], [17, 70, 0]], '#c8a0ff');
        // chest and its void core
        P.mpoly([[38, 34], [58, 34], [56, 60], [40, 60]]).paint(mix(a, '#4a3a6a', 0.4));
        P.mell(48, 48, 7, 7).fill(voidC); P.mell(48, 48, 4.4, 4.4).paint(glow, { hi: 1.8, noline: true }); P.mp(47, 47).fill('#ffffff');
        P.mell(48, 48, 9, 9).msub((Q) => Q.mell(48, 48, 7, 7)).tint((c) => mix(c, glow, 0.3));
        // shoulder mantle with trim
        P.mell(48, 34, 22, 8).msub((Q) => Q.mrect(0, 0, 96, 30)).paint(mix(a, '#5a4a7a', 0.45), { hi: 1.3 });
        P.mell(48, 34, 22, 8).msub((Q) => Q.mell(48, 33, 21, 7)).msub((Q) => Q.mrect(0, 0, 96, 34)).fill(silver);
        // hood and the void inside it
        P.mell(48, 21, 16, 17.5).msub((Q) => Q.mrect(0, 36, 96, 20)).paint(lt(a, 0.12), { tex: (x, y) => (x % 4 === 0 && y > 24 ? -1 : 0) });
        P.mell(48, 23, 10.5, 12.5).fill(voidC);
        P.mell(48, 23, 11.5, 13.5).msub((Q) => Q.mell(48, 23, 10.5, 12.5)).tint((c) => lt(c, 0.25));
        P.mrect(40, 18, 6, 5).mrect(50, 18, 6, 5).tint((c) => mix(c, glow, 0.25));
        eye(P, 41, 19, glow, 4); eye(P, 51, 19, glow, 4);
        P.mrect(42, 24, 3, 1).mrect(52, 24, 3, 1).fill(mix(glow, voidC, 0.55));
        // the crown: a thin band and five spikes, gems burning on them
        P.mrect(35, 5, 26, 3).paint(silver, { hi: 1.4 });
        for (const [x, h] of [[37, 7], [42, 11], [48, 15], [54, 11], [59, 7]]) P.mpoly([[x - 2, 5], [x, 5 - h], [x + 2, 5]]);
        P.paint(silver, { hi: 1.4 });
        for (const x of [42, 48, 54]) { P.mrect(x - 1, 1, 2, 2).fill(glow); P.mp(x - 1, 1).fill('#ffffff'); }
        P.mp(48, -4).fill('#ffffff');
        // the staff arm and the staff
        P.mline(88, 99, 89, 22, 3).paint('#3a2a4a', { tex: bands(5) });
        P.mpoly([[62, 36], [78, 56], [86, 52], [68, 34]]).paint(robe, { tex: (x, y) => ((x + y) % 5 === 0 ? -1 : 0) });
        P.mell(85, 55, 4, 3.5).paint('#2a1a3a');
        P.mline(89, 22, 84, 16, 2).mline(89, 22, 94, 16, 2).paint(silver);
        shard(89, 12, 3.6);
        P.mell(89, 12, 7, 8).msub((Q) => Q.mell(89, 12, 4, 6)).tint((c) => mix(c, glow, 0.3));
        // shards of the Dawn Crystal, adrift
        for (const [x, y, r] of [[14, 22, 2], [78, 10, 1.6], [8, 46, 1.6], [28, 8, 1.4], [70, 76, 1.4], [24, 82, 1.6]]) shard(x, y, r);
        sparkle(P, [[20, 30], [76, 24], [92, 40], [16, 12], [30, 70], [66, 68]], lt(glow, 0.5));
    },
};

const SIZES = { slime: [36, 30], bat: [44, 36], wolf: [52, 38], goblin: [38, 46], shroom: [36, 38], sapling: [40, 48], skeleton: [38, 48], golem: [56, 56], crab: [50, 34], jelly: [40, 44], naga: [50, 58], wisp: [32, 48], scorpion: [58, 38], cobra: [42, 50], mummy: [38, 48], harpy: [48, 48], yeti: [56, 58], knight: [46, 58], imp: [40, 42], drake: [62, 52], shade: [36, 54], gargoyle: [54, 54], fiend: [62, 66], treant: [96, 96], colossus: [96, 96], kraken: [96, 96], pharaoh: [96, 98], wyrm: [98, 96], king: [96, 100] };

/** A monster sprite as a Px (facing right); unknown kinds fall back to a slime. */
export function drawMonster(sprite, palName = 'base') {
    const kind = DRAW[sprite] ? sprite : 'slime';
    const [w, h] = SIZES[kind];
    const P = new Px(w, h + 2);
    DRAW[kind](P, pal(kind, palName), palName);
    P.outline();
    return P;
}
export const MONSTER_SPRITES = Object.keys(DRAW);
