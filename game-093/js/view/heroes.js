// Procedural pixel-art people: the eight heroes and every villager, from a "look" (colours, hair, gear). 32 × 48 px frames.
// Field frames: down / up / side, three walk frames each. Battle frames (side view): idle, ready, windup, strike, cast,
// shoot, hurt, kneel, cheer, guard. Everything is drawn from shapes; there are no image files.
//
// The painter (pixel.js) shades every shape as a volume and draws contact lines where parts overlap, so these functions
// only lay the parts down back to front. Each part is its own colour so it reads apart from its neighbours.

import { Px, mix } from './pixel.js';

export const FW = 32, FH = 48;
const INK = '#24141e';
const FOOT = 44;           // the bottom row of the boots in every frame

const d2 = (a) => (a * Math.PI) / 180;
const pol = (x, y, L, a) => [x + L * Math.sin(d2(a)), y + L * Math.cos(d2(a))];
const gidOf = (c) => parseInt(mix(c, c, 0).map((v) => v.toString(16).padStart(2, '0')).join(''), 16) | 0;

function cols(look) {
    const cloth = look.cloth || '#4a6aa8', cloth2 = look.cloth2 || '#e8d8a8', trim = look.trim || '#ffd35c';
    const skin = look.skin || '#f0c8a0';
    return {
        skin, skinD: mix(mix(skin, '#6a2a3a', 0.28), '#000', 0.08), hair: look.hair || '#5a3220', cloth, cloth2, trim, cape: look.cape || null,
        sleeve: mix(cloth, '#000', 0.1), skirt: mix(cloth, '#1a1030', 0.12),
        pants: look.pants || mix(cloth, '#2a1c24', 0.5), boots: look.boots || '#4a3024', belt: '#5a3a24', steel: '#c8d0e0', wood: '#8a5a32',
        eye: look.eye || mix(look.hair || '#5a3220', '#2a3a7a', 0.35), blush: mix(skin, '#ff6a7a', 0.38), lip: mix(skin, '#8a2a3a', 0.5),
    };
}

/** Body proportions per build: head centre, shoulders, belt, hips, half-width of the torso. */
function build(look) {
    const B = baseBuild(look);
    // mages and clerics wear robes to the boot tops
    B.robe = look.hat === 'witch' || !!look.veil || look.weapon === 'tome' || (look.build === 'old' && look.weapon === 'staff');
    B.hem = B.robe ? FOOT - 5 : B.hip;
    return B;
}
function baseBuild(look) {
    const b = look.build;
    if (b === 'stout') return { hy: 16, sh: 24, belt: 31, hip: 35, tw: 7.5, leg: 4, side: 5.6 };
    if (b === 'child') return { hy: 17, sh: 26, belt: 32, hip: 35, tw: 5, leg: 3, side: 4 };
    if (b === 'old') return { hy: 14, sh: 22, belt: 29, hip: 34, tw: 6, leg: 4, side: 4.6 };
    return { hy: 13, sh: 21, belt: 28, hip: 33, tw: 6, leg: 4, side: 4.6 };
}

// ---------------------------------------------------------------- weapons
function weapon(P, look, x, y, ang, c) {
    const type = look.weapon;
    if (!type) return;
    const dir = (L, a = ang) => pol(x, y, L, a);
    const perp = (px, py, L) => [pol(px, py, L, ang + 90), pol(px, py, L, ang - 90)];
    if (type === 'sword') {
        const [tx, ty] = dir(15), [gx, gy] = dir(2.5), [px, py] = dir(-3);
        P.mline(px, py, x, y, 2).paint('#5a3a28', { tex: (i, j) => ((i + j) % 2 ? -1 : 0) });
        P.mp(...dir(-4)).fill(c.trim);
        P.mline(gx, gy, tx, ty, 2).paint('#cfd8e8');
        P.mline(...dir(4), ...dir(13), 1).fill('#ffffff');
        P.mp(tx, ty).fill('#f4f8ff');
        const [a, b] = perp(gx, gy, 3);
        P.mline(a[0], a[1], b[0], b[1], 1).paint(c.trim, { hi: 1.4 });
    } else if (type === 'staff') {
        const [tx, ty] = dir(21), [bx, by] = dir(-5);
        P.mline(bx, by, tx, ty, 2).paint(c.wood, { tex: (i, j) => ((i * 3 + j * 5) % 11 === 0 ? -1 : 0) });
        P.mline(...dir(17), ...dir(18), 2).paint(c.trim);
        const [ox, oy] = dir(23.5);
        const orb = look.orb || c.cloth2;
        P.mell(ox, oy, 2.8, 2.8).paint(orb, { hi: 1.6, lo: 0.7 });
        P.mp(ox - 1, oy - 1).fill('#ffffff');
        // a crook of wood curls round the orb
        const [k1x, k1y] = pol(ox, oy, 3.4, ang + 70), [k2x, k2y] = pol(ox, oy, 3.4, ang + 140);
        P.mline(tx, ty, k1x, k1y, 1).mline(k1x, k1y, k2x, k2y, 1).paint(c.wood, { noline: true });
    } else if (type === 'bow') {
        const pts = []; for (let i = -7; i <= 7; i++) { const a = i / 7; pts.push([x + 4.5 * (1 - a * a) - (Math.abs(a) > 0.8 ? (Math.abs(a) - 0.8) * 6 : 0), y + a * 9]); }
        P.mline(pts[0][0], pts[0][1], pts[14][0], pts[14][1], 1).fill('#ece4cc');
        for (let i = 0; i + 1 < pts.length; i++) P.mline(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2);
        P.paint(c.wood, { hi: 1.3 });
        P.mrect(pts[7][0] - 1, y - 1, 2, 3).paint(c.cloth2, { noline: true });
    } else if (type === 'axe') {
        const [tx, ty] = dir(17), [hx, hy] = dir(13);
        P.mline(...dir(-2), tx, ty, 2).paint(c.wood, { tex: (i, j) => ((i + j * 2) % 5 === 0 ? -1 : 0) });
        const [ax, ay] = pol(hx, hy, 6, ang + 90), [bx, by] = pol(tx, ty, 6, ang + 90);
        const [mx, my] = pol((ax + bx) / 2, (ay + by) / 2, 1.5, ang + 90);
        P.mpoly([[hx, hy], [ax, ay - 0.5], [mx, my], [bx, by + 0.5], [tx, ty]]).paint('#c4ccdc', { hi: 1.3 });
        P.mline(ax, ay, bx, by, 1).fill('#f4f8ff');
        const [cx2, cy2] = pol((hx + tx) / 2, (hy + ty) / 2, 3, ang - 90);
        P.mpoly([[hx, hy], [cx2, cy2], [tx, ty]]).paint('#9aa4b8');
    } else if (type === 'spear') {
        const [tx, ty] = dir(25), [bx, by] = dir(-7), [sx, sy] = dir(20);
        P.mline(bx, by, sx, sy, 2).paint(c.wood, { tex: (i, j) => ((i * 5 + j * 3) % 9 === 0 ? -1 : 0) });
        const [l, r] = perp(sx + (tx - sx) * 0.35, sy + (ty - sy) * 0.35, 2.4);
        P.mpoly([[sx, sy], l, [tx, ty], r]).paint('#dfe6f4', { hi: 1.3 });
        P.mline(sx, sy, tx, ty, 1).fill('#ffffff');
        const [qx, qy] = dir(18.5);
        P.mrect(qx - 1, qy, 3, 3).paint(c.trim); P.mline(qx, qy + 2, qx - 1, qy + 5, 1).fill(mix(c.trim, '#a02020', 0.5));
    } else if (type === 'dagger') {
        const [tx, ty] = dir(9);
        P.mline(...pol(x, y, -2.5, ang), x, y, 2).paint('#5a2a40');
        P.mline(...dir(1.5), tx, ty, 2).paint('#d4dcea');
        P.mline(...dir(2.5), ...dir(8), 1).fill('#ffffff');
        const [a, b] = perp(...dir(1.2), 2);
        P.mline(a[0], a[1], b[0], b[1], 1).fill(c.trim);
    } else if (type === 'tome') {
        P.mrect(x - 3, y - 4, 8, 9).paint(look.cloth || '#2a5a8a');
        P.mrect(x - 2, y - 3, 1, 7).fill('#f4ecd0'); P.mrect(x - 3, y + 4, 8, 1).fill('#e4dcc0');
        P.mrect(x + 1, y - 2, 3, 3).paint(c.trim, { hi: 1.5 }); P.mp(x + 2, y - 1).fill('#ffffff');
        P.mp(x + 4, y - 4).mp(x + 4, y + 4).fill(c.trim);
    }
}

// ---------------------------------------------------------------- the head
/** Set mask columns x0..x1 from row top(x) to row bot(x). */
function mcols(P, x0, x1, top, bot) { for (let x = x0; x <= x1; x++) for (let y = Math.floor(top(x)); y <= Math.floor(bot(x)); y++) P.mp(x, y); return P; }
/** Keep only mask rows <= bot(x) in each column. */
function mclip(P, bot) { for (let x = 0; x < P.w; x++) { const b = bot(x); for (let y = Math.max(0, Math.floor(b) + 1); y < P.h; y++) P.m[y * P.w + x] = 0; } return P; }

// Fringe offsets per column, left to right across the forehead (12 columns from cx-6). Rows below cy-2; never more than
// one row onto the eyes (columns 1, 2, 9, 10).
const FRINGE = {
    short: [1, 0, 1, 1, 2, 1, 0, 2, 1, 1, 0, 1],
    spiky: [2, 0, 1, 0, 2, 0, 1, 3, 0, 1, 0, 2],
    long: [2, 1, 1, 0, -1, -2, -2, -1, 0, 1, 1, 2],
    braid: [2, 1, 1, 0, 0, -1, -2, -2, -1, 0, 1, 2],
    ponytail: [1, 1, 1, 2, 1, 1, 0, 0, -1, -1, 0, 1],
    dwarf: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
};
// strands: short vertical dashes that follow the fall of the hair
const hairTex = (seed) => (x, y) => ((x * 3 + seed) % 7 === 0 && (y + x) % 5 > 1 ? -1 : 0);

function face(P, look, c, view, cx, cy, eyes) {
    const shut = eyes === 'closed' || eyes === 'hurt', happy = eyes === 'happy';
    if (view === 'down') {
        for (const ex of [cx - 5, cx + 3]) {
            if (shut) { P.mrect(ex, cy + 1, 2, 1).fill(INK); P.mp(ex + (ex < cx ? -1 : 2), cy + (eyes === 'hurt' ? 0 : 2)).fill(INK); }
            else if (happy) { P.mrect(ex, cy, 2, 1).fill(INK); P.mp(ex - 1, cy + 1).mp(ex + 2, cy + 1).fill(INK); }
            else {
                P.mrect(ex, cy, 2, 1).fill(INK);
                P.mrect(ex, cy + 1, 2, 2).fill(c.eye); P.mp(ex + (ex < cx ? 1 : 0), cy + 2).fill(mix(c.eye, INK, 0.55));
                P.mp(ex + (ex < cx ? 0 : 1), cy + 1).fill('#ffffff');
                P.mp(ex + (ex < cx ? -1 : 2), cy).fill(mix(INK, c.skin, 0.4));   // the lash flicks outward
            }
        }
        P.mp(cx - 6, cy + 3).mp(cx - 5, cy + 3).fill(c.blush); P.mp(cx + 4, cy + 3).mp(cx + 5, cy + 3).fill(c.blush);
        P.mp(cx - 1, cy + 3).fill(mix(c.skin, c.skinD, 0.6));
        if (eyes === 'hurt') P.mrect(cx - 1, cy + 5, 2, 1).fill(INK);
        else if (happy) { P.mrect(cx - 2, cy + 4, 4, 1).fill(c.lip); P.mrect(cx - 1, cy + 5, 2, 1).fill(INK); }
        else P.mrect(cx - 1, cy + 5, 2, 1).fill(c.lip);
        if (look.glasses) {
            for (const ex of [cx - 6, cx + 2]) { P.mrect(ex, cy - 1, 4, 1).mrect(ex, cy + 3, 4, 1).mrect(ex, cy - 1, 1, 5).mrect(ex + 3, cy - 1, 1, 5).fill('#3a3a5a'); P.mp(ex + 1, cy).fill('#cfefff'); }
            P.mrect(cx - 2, cy, 4, 1).fill('#3a3a5a');
        }
    } else if (view === 'side') {
        const ex = cx + 3;
        if (shut) { P.mrect(ex, cy + 1, 2, 1).fill(INK); if (eyes === 'hurt') P.mp(ex + 1, cy).fill(INK); }
        else if (happy) { P.mrect(ex, cy, 2, 1).fill(INK); P.mp(ex - 1, cy + 1).fill(INK); }
        else {
            P.mrect(ex, cy, 2, 1).fill(INK); P.mp(ex - 1, cy).fill(mix(INK, c.skin, 0.4));
            P.mp(ex, cy + 1).fill('#f4f0ec'); P.mp(ex + 1, cy + 1).fill(c.eye); P.mp(ex + 1, cy + 2).fill(mix(c.eye, INK, 0.5));
        }
        P.mp(cx + 1, cy + 3).mp(cx + 2, cy + 3).fill(c.blush);
        P.mp(cx + 5, cy + 4).fill(eyes === 'hurt' ? INK : c.lip);
        if (look.glasses) { P.mrect(ex - 1, cy - 1, 4, 1).mrect(ex - 1, cy + 3, 4, 1).mrect(ex + 2, cy - 1, 1, 5).fill('#3a3a5a'); P.mrect(cx - 1, cy, ex - cx, 1).fill('#3a3a5a'); }
    }
}

function skull(P, c, view, cx, cy) {
    if (view === 'side') {
        P.mell(cx, cy, 6.6, 6.9).mrect(cx + 3, cy - 3, 4, 6).mrect(cx + 2, cy + 3, 4, 2).mrect(cx + 1, cy + 5, 3, 1).paint(c.skin, { soft: true });
    } else {
        P.mell(cx, cy, 7.2, 6.9).msub((Q) => Q.mp(cx - 7, cy + 5).mp(cx + 6, cy + 5).mp(cx - 6, cy + 6).mp(cx + 5, cy + 6)).paint(c.skin, { soft: true });
        if (view === 'down') P.mrect(cx - 8, cy + 1, 1, 2).mrect(cx + 7, cy + 1, 1, 2).paint(c.skinD, { noline: true });
    }
}

/** Hair that hangs behind the head and body: drawn before everything else. */
function hairBack(P, look, c, view, cx, cy, B) {
    const st = look.style || 'short', col = c.hair;
    if (look.hood || look.veil || st === 'bald' || look.helm) return;
    const len = { long: 17, braid: 7, ponytail: 6 }[st];
    if (!len) return;
    if (view === 'down' || view === 'up') {
        if (st === 'long') P.mpoly([[cx - 8, cy - 1], [cx + 8, cy - 1], [cx + 8.5, cy + 10], [cx + 5, cy + 14], [cx, cy + 16], [cx - 5, cy + 14], [cx - 8.5, cy + 10]]).paint(mix(col, '#000', view === 'up' ? 0 : 0.18), { tex: hairTex(3) });
        if (view === 'up' && st === 'ponytail') { P.mrect(cx - 1, cy + 3, 3, 12).mell(cx + 0.5, cy + 15, 2, 2).paint(col, { tex: hairTex(5) }); }
        if (view === 'up' && st === 'braid') { for (let k = 0; k < 5; k++) P.mell(cx + 0.5, cy + 6 + k * 2.6, 2, 1.6); P.paint(col, { tex: (x, y) => (y % 3 === 0 ? -1 : 0) }); P.mrect(cx - 1, cy + 19, 3, 1).fill(look.band || c.trim); }
    } else if (view === 'side') {
        if (st === 'long') P.mpoly([[cx - 7, cy - 1], [cx - 2, cy], [cx - 3, cy + 8], [cx - 4, cy + 14], [cx - 7, cy + 15], [cx - 9, cy + 12], [cx - 9, cy + 4]]).paint(col, { tex: hairTex(3) });
        if (st === 'ponytail') { P.mpoly([[cx - 6, cy - 3], [cx - 3, cy - 1], [cx - 8, cy + 6], [cx - 12, cy + 10], [cx - 11, cy + 4]]).paint(col, { tex: hairTex(5) }); }
        if (st === 'braid') { for (let k = 0; k < 6; k++) P.mell(cx - 5 - k * 0.5, cy + 4 + k * 2.6, 2, 1.6); P.paint(col, { tex: (x, y) => (y % 3 === 0 ? -1 : 0) }); P.mrect(cx - 9, cy + 19, 3, 1).fill(look.band || c.trim); }
    }
}

/** Hair over the head: the crown, the band, then the fringe on top. */
function hairFront(P, look, c, view, cx, cy) {
    const st = look.style || 'short', col = c.hair;
    if (st === 'bald' && !look.beard) { if (view !== 'up' && look.build === 'old') P.mrect(cx - 8, cy - 1, 2, 4).mrect(cx + 6, cy - 1, 2, 4).paint(col); return; }
    if (st === 'bald') return;
    const tex = hairTex(st.length);
    const fr = FRINGE[st] || FRINGE.short;
    const shine = (rowOf) => {
        // the anime ring of light across the crown, only where hair was just painted
        const g = gidOf(col);
        for (let x = 0; x < P.w; x++) { const y = rowOf(x); if (y == null) continue; for (const yy of [y, y + (x % 3 === 0 ? 1 : 0)]) { const i = yy * P.w + x; if (P.g && P.g[i] === g) P.set(x, yy, mix(col, '#fff4e0', 0.42)); } }
    };
    if (view === 'up') {
        P.mell(cx, cy - 1, 8.4, 8);
        if (st !== 'long') { P.mrect(cx - 7, cy + 2, 14, 4); P.m[(cy + 5) * P.w + cx - 7] = P.m[(cy + 5) * P.w + cx + 6] = 0; }
        if (st === 'spiky') P.mpoly([[cx - 7, cy - 3], [cx - 11, cy - 7], [cx - 4, cy - 6]]).mpoly([[cx - 3, cy - 7], [cx - 1, cy - 12], [cx + 2, cy - 7]]).mpoly([[cx + 3, cy - 6], [cx + 10, cy - 8], [cx + 6, cy - 2]]).mpoly([[cx - 8, cy + 1], [cx - 11, cy + 2], [cx - 8, cy - 2]]).mpoly([[cx + 7, cy + 1], [cx + 11, cy + 2], [cx + 7, cy - 2]]);
        P.paint(col, { tex });
        shine((x) => (Math.abs(x - cx + 2) < 5 ? cy - 6 + Math.round(Math.abs(x - cx + 2) * 0.4) : null));
        if (look.band && !look.hat && !look.hood && !look.veil && !look.helm) P.mrect(cx - 8, cy - 2, 16, 1).paint(look.band, { flat: true });
        return;
    }
    if (view === 'down') {
        // crown and side locks
        const lock = st === 'long' ? cy + 12 : st === 'braid' ? cy + 4 : st === 'spiky' ? cy + 4 : cy + 3;
        P.mell(cx, cy - 2, 8.4, 7.2);
        mclip(P, (x) => {
            const i = x - (cx - 6);
            if (i >= 0 && i < 12) return cy - 2 + fr[i];
            if (i === -1 || i === 12) return cy + 1;
            return lock;
        });
        mcols(P, cx - 9, cx - 8, () => cy - 2, () => lock); mcols(P, cx + 7, cx + 8, () => cy - 2, () => lock);
        if (st === 'spiky') P.mpoly([[cx - 6, cy - 6], [cx - 11, cy - 10], [cx - 3, cy - 8]]).mpoly([[cx - 3, cy - 8], [cx, cy - 13], [cx + 2, cy - 8]]).mpoly([[cx + 2, cy - 8], [cx + 10, cy - 10], [cx + 6, cy - 5]]).mpoly([[cx - 8, cy - 1], [cx - 11, cy - 3], [cx - 8, cy - 4]]).mpoly([[cx + 7, cy - 1], [cx + 11, cy - 3], [cx + 7, cy - 4]]);
        if (st === 'long') { mcols(P, cx - 9, cx - 8, () => cy, () => cy + 11); mcols(P, cx + 7, cx + 8, () => cy, () => cy + 11); P.mp(cx - 8, cy + 12).mp(cx + 7, cy + 12); }
        if (st === 'braid') { mcols(P, cx + 6, cx + 8, () => cy, () => cy + 5); }
        P.paint(col, { tex });
        if (st === 'braid') { for (let k = 0; k < 5; k++) P.mell(cx + 7.5, cy + 6.5 + k * 2.5, 2, 1.6); P.paint(col, { tex: (x, y) => (y % 3 === 0 ? -1 : 0) }); P.mrect(cx + 6, cy + 18, 3, 1).fill(look.band || c.trim); }
        if (st === 'ponytail') { P.mpoly([[cx + 6, cy - 5], [cx + 10, cy - 3], [cx + 11, cy + 6], [cx + 9, cy + 10], [cx + 8, cy + 3]]).paint(mix(col, '#000', 0.12), { tex }); P.mrect(cx + 7, cy - 5, 2, 2).fill(look.band || c.trim); }
        shine((x) => (Math.abs(x - cx + 2) < 5 ? cy - 6 + Math.round(Math.abs(x - cx + 2) * 0.35) : null));
        if (look.band && !look.hat && !look.hood && !look.veil && !look.helm) {
            for (let x = cx - 8; x <= cx + 7; x++) { const y = cy - 4 + (Math.abs(x - cx + 0.5) > 6 ? 1 : 0); if (P.get(x, y)) P.set(x, y, mix(look.band, '#fff', 0.1)); if (P.get(x, y + 1)) P.set(x, y + 1, mix(look.band, '#000', 0.25)); }
            // a strand or two falls back over the band
            for (const x of [cx - 3, cx + 2]) { P.set(x, cy - 4, mix(col, '#000', 0.1)); P.set(x, cy - 3, col); }
        }
        return;
    }
    // side, facing right: crown, the back of the head, a short fringe over the brow
    const nape = st === 'long' ? cy + 4 : st === 'spiky' ? cy + 4 : cy + 3;
    P.mell(cx - 0.5, cy - 2, 7.6, 6.9).mrect(cx - 8, cy - 2, 4, nape - cy + 3);
    mclip(P, (x) => {
        const d = x - cx;
        if (d >= 2) return cy - 2 + [1, 0, 1, 0, 1, 0][Math.min(5, d - 2)];
        if (d >= -1) return cy;
        return nape;
    });
    P.mrect(cx + 1, cy - 6, 6, 3);
    if (st === 'spiky') P.mpoly([[cx - 5, cy - 6], [cx - 11, cy - 9], [cx - 3, cy - 8]]).mpoly([[cx - 2, cy - 8], [cx, cy - 13], [cx + 3, cy - 8]]).mpoly([[cx + 3, cy - 7], [cx + 9, cy - 8], [cx + 6, cy - 3]]).mpoly([[cx - 7, cy], [cx - 11, cy + 1], [cx - 7, cy - 3]]).mpoly([[cx + 6, cy - 3], [cx + 9, cy - 1], [cx + 6, cy - 1]]);
    P.paint(col, { tex });
    // the ear sits in front of the hair
    P.mrect(cx - 1, cy + 1, 2, 2).paint(c.skin, { noline: true }); P.mp(cx - 1, cy + 2).fill(c.skinD);
    shine((x) => (x > cx - 6 && x < cx + 3 ? cy - 7 + Math.round(Math.abs(x - cx + 2) * 0.35) : null));
    if (look.band && !look.hat && !look.hood && !look.veil && !look.helm) {
        for (let x = cx - 7; x <= cx + 6; x++) { const y = cy - 4; if (P.get(x, y)) P.set(x, y, mix(look.band, '#fff', 0.1)); if (P.get(x, y + 1)) P.set(x, y + 1, mix(look.band, '#000', 0.25)); }
        P.mrect(cx - 9, cy - 3, 2, 1).mrect(cx - 10, cy - 2, 2, 1).fill(look.band);    // the tails of the band
    }
}

function beard(P, look, view, cx, cy) {
    const col = look.beard, tex = (x, y) => (x % 3 === 1 && y % 4 !== 0 ? -1 : 0);
    if (view === 'down') {
        P.mpoly([[cx - 8, cy + 1], [cx + 8, cy + 1], [cx + 8, cy + 7], [cx + 4, cy + 13], [cx, cy + 15], [cx - 4, cy + 13], [cx - 8, cy + 7]]).msub((Q) => Q.mrect(cx - 1, cy + 4, 2, 1)).paint(col, { tex });
        // the moustache rides over the beard
        P.mpoly([[cx - 5, cy + 3], [cx, cy + 2.5], [cx + 5, cy + 3], [cx + 5, cy + 5], [cx, cy + 4], [cx - 5, cy + 5]]).paint(mix(col, '#fff', 0.1), { soft: true });
        if (look.build === 'stout') { P.mrect(cx - 4, cy + 12, 2, 1).mrect(cx + 2, cy + 12, 2, 1).fill(look.band || '#d8d8e0'); }
    } else if (view === 'side') {
        P.mpoly([[cx - 1, cy + 1], [cx + 6, cy + 3], [cx + 7, cy + 7], [cx + 4, cy + 12], [cx, cy + 12], [cx - 2, cy + 6]]).paint(col, { tex });
        P.mpoly([[cx + 3, cy + 3], [cx + 8, cy + 3], [cx + 7, cy + 5], [cx + 3, cy + 5]]).paint(mix(col, '#fff', 0.1), { soft: true });
    }
}

function headgear(P, look, c, view, cx, cy) {
    if (look.hat === 'witch') {
        const hc = '#4e2470', side = view === 'side';
        const s = side ? -1 : 1, X = (d) => cx + d * s;
        // the frame stops at the top, so the cone flops over to one side
        P.mpoly(side ? [[cx + 6, cy - 5], [cx - 7, cy - 5], [cx - 4, cy - 9], [cx - 6, cy - 11], [cx - 11, cy - 8], [cx - 9, cy - 12], [cx - 3, cy - 13], [cx + 3, cy - 11]]
            : [[X(-7), cy - 5], [X(7), cy - 5], [X(4), cy - 9], [X(7), cy - 10], [X(12), cy - 7], [X(10), cy - 11], [X(4), cy - 13], [X(-1), cy - 13], [X(-4), cy - 10]]).paint(hc, { tex: (x, y) => ((x * 2 + y) % 7 === 0 ? -1 : 0) });
        P.mell(cx + (side ? -1 : 0), cy - 4, 11.5, 2.6).paint(mix(hc, '#000', 0.1));
        P.mrect(cx - 7, cy - 7, 14, 2).paint(c.trim, { hi: 1.3 });
        P.mrect(cx + (side ? -6 : 3), cy - 7, 3, 2).paint(look.band || c.cloth2, { soft: true });
    }
    if (look.hat === 'cap') {
        P.mell(cx - (view === 'side' ? 1 : 0), cy - 4, 7.8, 4).paint(c.cloth2);
        if (view === 'down') P.mrect(cx - 7, cy - 2, 14, 2).paint(mix(c.cloth2, '#000', 0.25));
        else if (view === 'side') P.mrect(cx + 2, cy - 2, 7, 2).paint(mix(c.cloth2, '#000', 0.25));
        P.mp(cx, cy - 8).fill(c.trim);
    }
    if (look.hood) {
        const hc = look.hood;
        if (view === 'down') {
            P.mell(cx, cy - 1, 9.2, 8.6).mrect(cx - 10, cy + 3, 20, 4).msub((Q) => Q.mell(cx, cy + 2.5, 5.6, 6.2)).paint(hc, { tex: (x, y) => (y > cy + 1 && x % 4 === 0 ? -1 : 0) });
            P.mell(cx, cy + 2.5, 6.4, 7).msub((Q) => Q.mell(cx, cy + 2.5, 5.6, 6.2)).msub((Q) => Q.mrect(0, cy + 6, 32, 10)).paint(mix(hc, '#000', 0.4), { flat: true });
        } else if (view === 'up') P.mell(cx, cy, 9.2, 8.6).mpoly([[cx - 9, cy + 4], [cx + 9, cy + 4], [cx + 3, cy + 11], [cx - 3, cy + 11]]).paint(hc, { tex: (x, y) => (y > cy + 1 && x % 4 === 0 ? -1 : 0) });
        else { P.mell(cx - 1, cy - 1, 8.6, 8.4).mrect(cx - 9, cy + 2, 8, 6).msub((Q) => Q.mell(cx + 4, cy + 3, 4.6, 6.2)).paint(hc, { tex: (x, y) => (y > cy + 1 && x % 4 === 0 ? -1 : 0) }); }
    }
    if (look.helm === 'open') {
        const st = '#b8c4d8', band = mix(st, '#2a2a4a', 0.25);
        if (view === 'down') {
            // the brow band sits above the eyes; a nasal guard runs down between them
            P.mell(cx, cy - 3, 8.2, 6.2).msub((Q) => Q.mrect(0, cy - 1, 32, 12)).mrect(cx - 8, cy - 2, 2, 7).mrect(cx + 6, cy - 2, 2, 7).paint(st, { hi: 1.3 });
            P.mrect(cx - 8, cy - 3, 16, 2).paint(band);
            for (const x of [cx - 6, cx - 3, cx + 2, cx + 5]) P.mp(x, cy - 3).fill('#eef4ff');
            P.mrect(cx - 1, cy - 2, 2, 4).paint(st, { hi: 1.3, noline: true });
            P.mrect(cx - 1, cy - 10, 2, 7).paint(c.trim, { hi: 1.2 });
        } else if (view === 'up') {
            P.mell(cx, cy - 1, 8.2, 7.4).paint(st, { hi: 1.3 });
            P.mrect(cx - 8, cy + 2, 16, 2).paint(band); for (const x of [cx - 6, cx - 2, cx + 1, cx + 5]) P.mp(x, cy + 2).fill('#eef4ff');
            P.mrect(cx - 6, cy + 4, 12, 3).paint('#8a94a8', { tex: (x, y) => ((x + y) % 2 ? -1 : 0) });       // mail at the neck
            P.mrect(cx - 1, cy - 9, 2, 11).paint(c.trim);
        } else {
            P.mell(cx - 0.5, cy - 3, 7.4, 6.2).msub((Q) => Q.mrect(0, cy - 1, 32, 12)).mrect(cx - 8, cy - 2, 5, 8).paint(st, { hi: 1.3 });
            P.mrect(cx - 8, cy - 3, 15, 2).paint(band);
            P.mrect(cx + 5, cy - 2, 2, 3).paint(st, { hi: 1.3, noline: true });
            P.mpoly([[cx - 3, cy - 9], [cx + 3, cy - 10], [cx + 1, cy - 7], [cx - 4, cy - 7]]).paint(c.trim);
        }
    }
    if (look.helm === 'horned') {
        const st = '#9aa4b8', horn = '#f0e6cc', side = view === 'side';
        const hornTex = (x, y) => ((x + y) % 3 === 0 ? -1 : 0);
        if (side) { P.mpoly([[cx - 4, cy - 5], [cx - 9, cy - 10], [cx - 8, cy - 14], [cx - 6, cy - 10], [cx - 1, cy - 7]]).paint(horn, { tex: hornTex }); }
        else {
            P.mpoly([[cx - 6, cy - 4], [cx - 11, cy - 7], [cx - 12, cy - 13], [cx - 9, cy - 9], [cx - 4, cy - 7]]).paint(horn, { tex: hornTex });
            P.mpoly([[cx + 6, cy - 4], [cx + 11, cy - 7], [cx + 12, cy - 13], [cx + 9, cy - 9], [cx + 4, cy - 7]]).paint(horn, { tex: hornTex });
        }
        P.mell(cx - (side ? 0.5 : 0), cy - 3, side ? 7.4 : 8, 5.6).msub((Q) => Q.mrect(0, cy - 1, 32, 10)).paint(st, { hi: 1.3 });
        P.mrect(cx - 8, cy - 2, 16, 2).paint(look.band || c.trim);
        for (const x of side ? [cx - 5, cx - 1, cx + 3] : [cx - 6, cx - 2, cx + 1, cx + 5]) P.mp(x, cy - 2).fill('#fff8e0');
        if (view === 'down') P.mrect(cx - 1, cy - 1, 2, 3).paint(st);
    }
    if (look.veil) {
        const v = look.veil, vt = (x, y) => (y > cy + 1 && x % 3 === 0 ? -1 : 0);
        if (view === 'down') {
            P.mell(cx, cy - 1, 9, 8.2).msub((Q) => Q.mell(cx, cy + 3, 5.8, 6.4)).mrect(cx - 10, cy + 2, 3, 17).mrect(cx + 7, cy + 2, 3, 17).paint(v, { tex: vt });
            P.mrect(cx - 5, cy - 5, 10, 1).paint(c.trim, { flat: true }); P.mrect(cx - 1, cy - 6, 2, 2).fill(look.band ? c.cloth2 : '#7fe0ff'); P.mp(cx - 1, cy - 6).fill('#ffffff');
        } else if (view === 'up') {
            P.mell(cx, cy, 9.4, 8.4).mpoly([[cx - 9, cy + 3], [cx + 9, cy + 3], [cx + 10, cy + 20], [cx - 10, cy + 20]]).paint(v, { tex: vt });
            P.mrect(cx - 10, cy + 19, 20, 1).paint(c.trim, { flat: true }); P.mrect(cx - 4, cy - 5, 8, 1).paint(c.trim, { flat: true });
        }
        else {
            P.mell(cx - 1, cy - 1, 8.4, 7.8).msub((Q) => Q.mell(cx + 4, cy + 3, 4.8, 6.2)).mpoly([[cx - 9, cy + 1], [cx - 2, cy + 3], [cx - 3, cy + 20], [cx - 11, cy + 19]]).paint(v, { tex: vt });
            P.mrect(cx - 3, cy - 5, 8, 1).paint(c.trim, { flat: true }); P.mp(cx + 4, cy - 5).fill('#7fe0ff');
        }
    }
}

function drawHead(P, look, c, view, cx, cy, eyes) {
    if (view === 'up') { skull(P, c, view, cx, cy); hairFront(P, look, c, view, cx, cy); headgear(P, look, c, view, cx, cy); return; }
    skull(P, c, view, cx, cy);
    face(P, look, c, view, cx, cy, eyes);
    if (look.beard) beard(P, look, view, cx, cy);
    if (!look.hood && !look.veil) {
        if (look.helm) {
            const col = c.hair;
            if (view === 'down') P.mrect(cx - 7, cy, 2, 4).mrect(cx + 5, cy, 2, 4).paint(col, { tex: hairTex(2) });
            else P.mrect(cx - 7, cy - 1, 5, 6).paint(col, { tex: hairTex(2) });
        } else hairFront(P, look, c, view, cx, cy);
    } else if (view === 'down') {
        // a few strands of fringe show under the hood
        const fr = FRINGE[look.style] || FRINGE.short;
        mcols(P, cx - 5, cx + 4, () => cy - 4, (x) => cy - 2 + Math.min(0, fr[x - cx + 6] - 1)).paint(c.hair, { tex: hairTex(1) });
    }
    headgear(P, look, c, view, cx, cy);
}

// ---------------------------------------------------------------- bodies
function capeBack(P, c, B, cx) {
    // the inside of the cape, peeking out past the arms from the front
    P.mpoly([[cx - B.tw - 2, B.sh], [cx + B.tw + 2, B.sh], [cx + B.tw + 5, FOOT - 2], [cx + B.tw + 2, FOOT - 1], [cx - B.tw - 2, FOOT - 1], [cx - B.tw - 5, FOOT - 2]]).paint(mix(c.cape, '#1a0a1a', 0.35), { tex: (x) => (x % 3 === 0 ? -1 : 0) });
}

function legsFront(P, c, B, cx, f, back) {
    const lift = [[1, 0], [0, 0], [0, 1]][f];       // a walking leg rises a row, its boot with it
    const L = B.leg;
    const legs = [[cx - L, lift[0]], [cx, lift[1]]];
    for (const [x, up] of legs) {
        const bot = FOOT - 4 - up;
        P.mrect(x, B.hip - 1, L, bot - B.hip + 2).paint(x < cx ? c.pants : mix(c.pants, '#000', 0.1), { tex: (i, j) => (j === B.hip + 2 && (i + j) % 2 ? -1 : 0) });
    }
    for (const [x, up] of legs) {
        const by = FOOT - 3 - up, bx = x < cx ? x - 1 : x;
        P.mrect(bx, by, L + 1, 4).msub((Q) => Q.mp(x < cx ? bx : bx + L, by)).paint(c.boots, { hi: 1.2 });
        P.mrect(bx, by, L + 1, 1).msub((Q) => Q.mp(x < cx ? bx : bx + L, by)).paint(mix(c.boots, '#fff', 0.12), { flat: true });
        if (!back) P.mp(x < cx ? bx + 1 : bx + L - 1, by + 2).fill(mix(c.boots, '#fff4d8', 0.35));
    }
}

function bodyFront(P, look, c, back, f, B) {
    const cx = 16, tw = B.tw, sw = [1, 0, -1][f];
    if (c.cape && !back) capeBack(P, c, B, cx);
    legsFront(P, c, B, cx, f, back);
    // arms hang behind the torso edge
    for (const s of [-1, 1]) {
        const ax = s < 0 ? cx - tw - 3 : cx + tw, dy = s * sw;
        P.mrect(ax, B.sh + 1 + dy, 3, B.belt - B.sh + 1).paint(c.sleeve);
        P.mrect(ax, B.belt + 1 + dy, 3, 1).paint(mix(c.trim, c.sleeve, 0.35), { flat: true });
        P.mrect(ax, B.belt + 2 + dy, 3, 2).msub((Q) => Q.mp(s < 0 ? ax : ax + 2, B.belt + 3 + dy)).paint(c.skin, { soft: true });
    }
    // tunic: chest, skirt below the belt
    const fl = B.robe ? 2.5 : 1.5;
    P.mpoly([[cx - tw - 0.5, B.belt + 1], [cx + tw + 0.5, B.belt + 1], [cx + tw + fl, B.hem + 1], [cx - tw - fl, B.hem + 1]]).paint(c.skirt, { tex: (x, y) => (y > B.belt + 2 && (x + 1) % 3 === 0 ? -1 : 0) });
    P.mrect(cx - tw - Math.floor(fl), B.hem, tw * 2 + Math.floor(fl) * 2, 1).paint(mix(c.trim, c.skirt, 0.35), { flat: true });
    P.mpoly([[cx - tw, B.sh], [cx + tw, B.sh], [cx + tw - 0.5, B.belt + 1], [cx - tw + 0.5, B.belt + 1]]).mell(cx - tw + 0.5, B.sh + 1.5, 2.2, 1.8).mell(cx + tw - 0.5, B.sh + 1.5, 2.2, 1.8).paint(c.cloth);
    if (!back) {
        // the shirt in a V at the collar, a wrap line and trim down the front
        P.mpoly([[cx - 3, B.sh - 0.5], [cx + 3, B.sh - 0.5], [cx, B.sh + 4]]).paint(c.cloth2, { soft: true });
        P.mline(cx - 3, B.sh, cx - 0.5, B.sh + 3.5, 1).mline(cx + 2, B.sh, cx, B.sh + 3.5, 1).fill(c.trim);
        P.mrect(cx, B.sh + 4, 1, B.belt - B.sh - 4).fill(mix(c.cloth, INK, 0.45)); P.mrect(cx + 1, B.sh + 4, 1, B.belt - B.sh - 4).fill(mix(c.cloth, c.trim, 0.5));
        // shoulder seams catch the light
        P.mp(cx - tw + 1, B.sh).mp(cx + tw - 2, B.sh).fill(mix(c.cloth, '#fff4d8', 0.4));
    } else {
        P.mrect(cx - 3, B.sh, 6, 1).fill(mix(c.cloth, c.trim, 0.4));
    }
    // belt and buckle
    P.mrect(cx - tw, B.belt, tw * 2, 2).paint(c.belt, { hi: 1.3 });
    if (!back) { P.mrect(cx - 1, B.belt, 3, 2).paint(c.trim, { hi: 1.5 }); P.mp(cx, B.belt + 1).fill(mix(c.trim, INK, 0.6)); }
    else P.mrect(cx + 3, B.belt + 1, 3, 3).paint('#7a5232');     // a pouch at the back
    // scarf
    if (look.scarf) {
        P.mrect(cx - 5, B.sh - 1, 10, 2).paint(look.scarf, { hi: 1.2 });
        if (!back) P.mpoly([[cx + 1, B.sh], [cx + 4, B.sh], [cx + 5, B.sh + 7], [cx + 2, B.sh + 6]]).paint(mix(look.scarf, '#000', 0.08));
        else P.mpoly([[cx - 2, B.sh], [cx + 1, B.sh], [cx - 1, B.sh + 8], [cx - 4, B.sh + 7]]).paint(mix(look.scarf, '#000', 0.08));
    }
    // neck
    if (!back) P.mrect(cx - 2, B.hy + 6, 4, B.sh - B.hy - 6).paint(c.skinD, { flat: true });
    if (c.cape && back) {
        P.mpoly([[cx - tw - 1.5, B.sh - 1], [cx + tw + 1.5, B.sh - 1], [cx + tw + 4, FOOT - 2], [cx + 2, FOOT - 1], [cx - 2, FOOT - 2], [cx - tw - 4, FOOT - 1]]).paint(c.cape, { tex: (x, y) => (y > B.sh + 5 && x % 4 === 1 ? -1 : 0) });
        P.mrect(cx - tw - 1, B.sh - 1, tw * 2 + 2, 2).paint(mix(c.cape, '#000', 0.2), { flat: true });
    }
}

function bodySide(P, look, c, B, o) {
    const cx = 16, bob = o.dy || 0, lean = o.lean || 0, tw = B.side;
    const legs = o.legs ?? 1;  // 0, 1, 2 walk frames, or 'crouch' | 'kneel'
    const sh = B.sh + bob, belt = B.belt + bob, hip = B.hip + bob;
    const L = B.leg + 1;
    const foot = FOOT;
    // each leg: hip x, the boot x, and how far the knee bends (kneeling legs lie down)
    let back, front;
    if (legs === 'crouch') { back = { hx: cx - 2, fx: cx - 6, top: hip }; front = { hx: cx + 1, fx: cx + 3, top: hip }; }
    else if (legs === 'kneel') { back = { hx: cx - 2, fx: cx - 9, top: hip, kneel: true }; front = { hx: cx + 1, fx: cx + 3, top: hip }; }
    else { const s = [-3, 0, 3][legs] ?? 0; back = { hx: cx - 2, fx: cx - 2 - s, top: hip }; front = { hx: cx, fx: cx + s, top: hip }; }
    if (c.cape) P.mpoly([[cx - 3 + lean, sh], [cx + 1 + lean, sh], [cx - 5, foot - 2 + (o.capeDy || 0)], [cx - 9, foot - 1], [cx - 12, foot - 4]]).paint(mix(c.cape, '#000', 0.12), { tex: (x, y) => ((x + y) % 4 === 0 ? -1 : 0) });
    const drawLeg = (g, dark) => {
        const pc = dark ? mix(c.pants, '#000', 0.25) : c.pants, bc = dark ? mix(c.boots, '#000', 0.2) : c.boots;
        if (g.kneel) {
            P.mpoly([[g.hx, g.top - 1], [g.hx + L, g.top - 1], [g.hx + L - 1, foot - 3], [g.fx + 2, foot - 1], [g.fx, foot - 3]]).paint(pc);
            P.mrect(g.fx - 1, foot - 3, 4, 4).paint(bc); return;
        }
        P.mpoly([[g.hx, g.top - 1], [g.hx + L, g.top - 1], [g.fx + L, foot - 3], [g.fx, foot - 3]]).paint(pc);
        P.mrect(g.fx, foot - 3, L, 4).mrect(g.fx + L, foot - 1, 1, 2).paint(bc, { hi: 1.2 });
        P.mrect(g.fx, foot - 3, L, 1).fill(mix(bc, '#fff', 0.12));
    };
    drawLeg(back, true);
    // back arm, behind the torso
    const shp = [cx - 1 + lean, sh + 1];
    const aBack = o.armBack ?? -15;
    const [bhx, bhy] = pol(shp[0], shp[1], 7, aBack);
    P.mline(shp[0], shp[1], bhx, bhy, 3).paint(mix(c.sleeve, '#000', 0.25));
    P.mrect(bhx - 1, bhy - 1, 2, 2).paint(mix(c.skin, '#000', 0.2), { soft: true });
    drawLeg(front, false);
    // tunic
    const hem = B.robe ? Math.min(FOOT - 5, B.hem + bob) : hip, fl = B.robe ? 2 : 1;
    P.mpoly([[cx - tw + 0.5, belt + 1], [cx + tw - 0.5, belt + 1], [cx + tw + fl, hem + 1], [cx - tw - fl - (B.robe ? 1 : 0), hem + 1]]).paint(c.skirt, { tex: (x, y) => (y > belt + 2 && x % 3 === 0 ? -1 : 0) });
    P.mrect(cx - tw - fl - (B.robe ? 1 : 0), hem, tw * 2 + fl * 2 + (B.robe ? 1 : 0), 1).paint(mix(c.trim, c.skirt, 0.35), { flat: true });
    P.mpoly([[cx - tw + lean, sh], [cx + tw + lean, sh], [cx + tw, belt + 1], [cx - tw, belt + 1]]).mell(cx + lean, sh + 1, tw, 1.6).paint(c.cloth);
    P.mpoly([[cx + tw - 2.5 + lean, sh], [cx + tw + 0.5 + lean, sh], [cx + tw - 1, sh + 3]]).paint(c.cloth2, { soft: true });
    P.mrect(cx + tw - 2 + lean, sh + 3, 1, belt - sh - 3).fill(mix(c.cloth, c.trim, 0.5));
    P.mrect(cx - tw, belt, tw * 2, 2).paint(c.belt, { hi: 1.3 }); P.mrect(cx + tw - 2, belt, 2, 2).paint(c.trim, { hi: 1.5 });
    P.mrect(cx - tw - 1, belt + 1, 3, 3).paint('#7a5232');
    if (look.scarf) { P.mrect(cx - 3 + lean, sh - 1, 7, 2).paint(look.scarf, { hi: 1.2 }); P.mpoly([[cx - 3 + lean, sh], [cx - 1 + lean, sh], [cx - 7, sh + 5], [cx - 9, sh + 4]]).paint(mix(look.scarf, '#000', 0.08)); }
    P.mrect(cx + 1 + lean, B.hy + 6 + bob, 3, sh - B.hy - 6).paint(c.skinD, { flat: true });
    return { shoulder: [cx + lean, sh + 1], bob };
}

// ---------------------------------------------------------------- the frames
/**
 * Draw one frame. view: 'down' | 'up' | 'side'; f: walk frame 0-2; pose: battle pose for side view.
 * Returns a Px (32 × 48), outlined and ready to be turned into a texture.
 */
export function drawHero(look, view = 'down', f = 1, pose = null) {
    const P = new Px(FW, FH), c = cols(look), B = build(look);
    if (view === 'down' || view === 'up') {
        const back = view === 'up';
        if (!back) hairBack(P, look, c, view, 16, B.hy, B);
        if (back && look.weapon === 'bow') P.mline(24, B.sh - 3, 8, B.belt + 6, 2).paint(c.wood);
        if (back && (look.weapon === 'sword' || look.weapon === 'axe')) P.mline(23, B.sh - 2, 11, B.belt + 4, 2).paint('#5a3a28');
        bodyFront(P, look, c, back, f, B);
        if (back && (look.weapon === 'sword' || look.weapon === 'axe' || look.weapon === 'bow')) P.mline(23, B.sh - 2, 18, B.sh + 4, 2).paint('#6a4630');   // the strap
        if (back) hairBack(P, look, c, view, 16, B.hy, B);     // seen from behind, hair hangs over the back
        drawHead(P, look, c, view, 16, B.hy, 'open');
        if (!back && look.weapon === 'staff') { weapon(P, look, 25, B.belt + 2, 180, c); }
    } else {
        sideFrame(P, look, c, B, f, pose);
    }
    P.outline();
    return P;
}

const POSES = {
    idle: { legs: 1, arm: 20, w: 140, armBack: -15, eyes: 'open' },
    ready: { legs: 1, arm: 40, w: 125, armBack: -25, eyes: 'open', dy: 1 },
    windup: { legs: 'crouch', arm: -135, w: -150, armBack: 100, lean: -2, eyes: 'open', dy: 1 },
    strike: { legs: 0, arm: 100, w: 95, armBack: -40, lean: 2, eyes: 'open' },
    cast: { legs: 1, arm: 160, w: 178, armBack: 120, eyes: 'open', dy: -1 },
    shoot: { legs: 1, arm: 92, w: 0, armBack: 80, eyes: 'open', lean: 1 },
    hurt: { legs: 'crouch', arm: -60, w: -100, armBack: -80, lean: -3, eyes: 'hurt', dy: 2 },
    kneel: { legs: 'kneel', arm: 15, w: 172, armBack: -20, lean: 2, eyes: 'closed', dy: 7 },
    cheer: { legs: 1, arm: 172, w: 172, armBack: 20, eyes: 'happy', dy: -1 },
    guard: { legs: 'crouch', arm: 75, w: 40, armBack: 60, lean: 1, eyes: 'open', dy: 2 },
    step: { legs: 2, arm: 40, w: 125, armBack: -35, eyes: 'open' },
};

function sideFrame(P, look, c, B, f, poseName) {
    const pose = poseName ? (POSES[poseName] || POSES.idle) : { legs: f, arm: 24 - f * 24, w: 172, armBack: -24 + f * 24, eyes: 'open', noWeapon: true };
    const o = { legs: pose.legs, dy: pose.dy || 0, lean: pose.lean || 0, armBack: pose.armBack };
    const hx = 16 + (pose.lean || 0);
    hairBack(P, look, c, 'side', hx, B.hy + o.dy, B);
    if (!poseName && look.weapon === 'bow') P.mline(10, B.sh - 2 + o.dy, 12, B.belt + 6, 2).paint(c.wood);
    const { shoulder, bob } = bodySide(P, look, c, B, o);
    drawHead(P, look, c, 'side', hx, B.hy + bob, pose.eyes);
    // the front arm, over everything
    const [ex, ey] = pol(shoulder[0], shoulder[1], 7, pose.arm);
    P.mline(shoulder[0], shoulder[1], ex, ey, 3).paint(c.sleeve);
    const [cfx, cfy] = pol(shoulder[0], shoulder[1], 5.5, pose.arm);
    P.mp(cfx, cfy).fill(mix(c.trim, c.sleeve, 0.35));
    if (poseName && look.weapon && !pose.noWeapon) weapon(P, look, ex, ey, pose.w, c);
    if (!poseName && look.weapon === 'staff') weapon(P, look, ex, ey, 176, c);
    P.mrect(ex - 1, ey - 1, 2, 2).paint(c.skin, { soft: true, noline: true });
}

export const BATTLE_POSES = Object.keys(POSES);
