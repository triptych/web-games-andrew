// Procedural pixel-art people: the eight heroes and every villager, from a "look" (colours, hair, gear). 32 × 48 px frames.
// Field frames: down / up / side, three walk frames each. Battle frames (side view): idle, ready, windup, strike, cast,
// shoot, hurt, kneel, cheer, guard. Everything is drawn from shapes; there are no image files.

import { Px, mix } from './pixel.js';

export const FW = 32, FH = 48;
const DARK = '#2a1a22';

const d2 = (a) => (a * Math.PI) / 180;
const pol = (x, y, L, a) => [x + L * Math.sin(d2(a)), y + L * Math.cos(d2(a))];

function cols(look) {
    const cloth = look.cloth || '#4a6aa8', cloth2 = look.cloth2 || '#e8d8a8', trim = look.trim || '#ffd35c';
    return {
        skin: look.skin || '#f0c8a0', hair: look.hair || '#5a3220', cloth, cloth2, trim, cape: look.cape || null,
        pants: look.pants || mix(cloth, '#2a1c24', 0.42), boots: look.boots || '#3a2a22', belt: '#4a3020', steel: '#c8d0e0', wood: '#7a5230',
    };
}

// ---------------------------------------------------------------- weapons
function weapon(P, look, x, y, ang, c, spin = 0) {
    const type = look.weapon;
    if (!type) return;
    const dir = (L, a = ang) => pol(x, y, L, a);
    if (type === 'sword') {
        const [tx, ty] = dir(15); const [gx, gy] = dir(2.5); const [px, py] = dir(-3);
        P.mline(x, y, tx, ty, 2).paint('#dfe6f4'); P.mline(gx - 2, gy, gx + 2, gy, 1).paint(c.trim, { flat: true }); P.mline(px, py, x, y, 2).paint('#6a4a30', { flat: true });
        P.mline(...dir(3), ...dir(13), 1).paint('#ffffff', { flat: true });
    } else if (type === 'staff') {
        const [tx, ty] = dir(22), [bx, by] = dir(-4);
        P.mline(bx, by, tx, ty, 2).paint(c.wood, { hi: 0.2 });
        P.mell(tx, ty - 1, 2.4, 2.4).paint(look.orb || c.cloth2, { hi: 0.5, lo: 0.2 }); P.mp(tx - 1, ty - 2).fill('#ffffff');
    } else if (type === 'bow') {
        const pts = []; for (let i = -6; i <= 6; i++) { const a = i / 6; const [qx, qy] = [x + 4 * (1 - a * a), y + a * 8]; pts.push([qx, qy]); }
        for (let i = 0; i + 1 < pts.length; i++) P.mline(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2);
        P.paint(c.wood, { hi: 0.25 });
        P.mline(x, y - 8, x, y + 8, 1).paint('#e8e0c8', { flat: true });
    } else if (type === 'axe') {
        const [tx, ty] = dir(17), [hx, hy] = dir(14);
        P.mline(x, y, tx, ty, 2).paint(c.wood, { hi: 0.2 });
        const [ax, ay] = pol(hx, hy, 4, ang + 90), [bx, by] = pol(hx, hy, 4, ang - 90), [cx, cy] = pol(tx, ty, 1, ang);
        P.mpoly([[hx, hy], [ax, ay], [cx + (ax - hx) * 0.6, cy + (ay - hy) * 0.6], [cx, cy]]).paint('#cfd6e4');
        P.mpoly([[hx, hy], [bx, by], [cx + (bx - hx) * 0.2, cy + (by - hy) * 0.2], [cx, cy]]).paint('#b8c0d0');
    } else if (type === 'spear') {
        const [tx, ty] = dir(26), [bx, by] = dir(-6), [sx, sy] = dir(22);
        P.mline(bx, by, tx, ty, 2).paint(c.wood, { hi: 0.2 });
        P.mpoly([[tx, ty], pol(sx, sy, 2.2, ang + 90), pol(sx, sy, 2.2, ang - 90), pol(tx, ty, 4, ang)]).paint('#e0e6f4');
    } else if (type === 'dagger') {
        const [tx, ty] = dir(8);
        P.mline(x, y, tx, ty, 2).paint('#dfe6f4'); P.mline(...pol(x, y, -2, ang), x, y, 2).paint('#5a2a40', { flat: true });
    } else if (type === 'tome') {
        P.mrect(x - 3, y - 4, 7, 8).paint(look.cloth || '#2a5a8a'); P.mrect(x - 2, y - 3, 1, 6).fill('#f4ecd0'); P.mp(x + 1, y - 1).fill(c.trim);
    }
}

// ---------------------------------------------------------------- head, hair and headgear
function head(P, look, c, view, cx, cy, o = {}) {
    const side = view === 'side';
    const face = o.eyes || 'open';
    const rx = side ? 6.2 : 7, ry = 6.4;
    // face and ears
    P.mell(cx, cy, rx, ry).paint(c.skin);
    if (look.beard && !look.bald) { /* drawn after the face */ }
    if (view === 'down') {
        if (face === 'closed' || face === 'hurt') { P.mrect(cx - 4, cy + 1, 3, 1).fill(DARK); P.mrect(cx + 2, cy + 1, 3, 1).fill(DARK); }
        else if (face === 'happy') { P.mrect(cx - 4, cy + 1, 3, 1).fill(DARK); P.mrect(cx + 2, cy + 1, 3, 1).fill(DARK); P.mp(cx - 4, cy).fill(DARK); P.mp(cx + 4, cy).fill(DARK); }
        else {
            P.mrect(cx - 4, cy, 2, 3).fill(DARK); P.mrect(cx + 2, cy, 2, 3).fill(DARK);
            P.mp(cx - 4, cy).fill('#ffffff'); P.mp(cx + 2, cy).fill('#ffffff');
        }
        P.mp(cx - 5, cy + 3).fill(mix(c.skin, '#ff8a8a', 0.4)); P.mp(cx + 5, cy + 3).fill(mix(c.skin, '#ff8a8a', 0.4));
        P.mrect(cx - 1, cy + 4, 2, 1).fill(face === 'hurt' ? DARK : mix(c.skin, '#7a2a2a', 0.55));
        if (look.glasses) { P.mrect(cx - 5, cy - 1, 4, 4).paint('#6fc8ff', { flat: true }); P.msub(() => {}); }
    } else if (side) {
        const ex = cx + 3;
        if (face === 'closed' || face === 'hurt') P.mrect(ex - 1, cy + 1, 3, 1).fill(DARK);
        else if (face === 'happy') { P.mrect(ex - 1, cy + 1, 3, 1).fill(DARK); P.mp(ex - 1, cy).fill(DARK); P.mp(ex + 1, cy).fill(DARK); }
        else { P.mrect(ex, cy, 2, 3).fill(DARK); P.mp(ex, cy).fill('#ffffff'); }
        P.mp(cx + 6, cy + 2).fill(mix(c.skin, '#000000', 0.18));
        P.mp(cx + 4, cy + 4).fill(face === 'hurt' ? DARK : mix(c.skin, '#7a2a2a', 0.55));
        P.mp(cx + 1, cy + 3).fill(mix(c.skin, '#ff8a8a', 0.4));
        if (look.glasses) { P.mrect(ex - 1, cy - 1, 4, 4).fill('#6fc8ff'); P.mrect(ex, cy, 2, 2).fill(DARK); }
    }
    if (look.glasses && view === 'down') { P.mrect(cx - 5, cy - 1, 4, 4).fill('#7fd0ff'); P.mrect(cx + 1, cy - 1, 4, 4).fill('#7fd0ff'); P.mrect(cx - 4, cy, 2, 2).fill(DARK); P.mrect(cx + 2, cy, 2, 2).fill(DARK); P.mrect(cx - 1, cy, 2, 1).fill('#dfe6f4'); }
    if (look.beard) beard(P, look, c, view, cx, cy);
    hair(P, look, c, view, cx, cy, o);
    headgear(P, look, c, view, cx, cy, o);
}

function beard(P, look, c, view, cx, cy) {
    const col = look.beard;
    if (view === 'down') {
        P.mpoly([[cx - 7, cy + 2], [cx + 7, cy + 2], [cx + 6, cy + 8], [cx, cy + 12], [cx - 6, cy + 8]]).msub((Q) => Q.mrect(cx - 1, cy + 3, 2, 1)).paint(col);
        P.mrect(cx - 2, cy + 3, 4, 1).paint(mix(col, '#000000', 0.2), { flat: true });
    } else if (view === 'side') {
        P.mpoly([[cx - 2, cy + 2], [cx + 6, cy + 3], [cx + 5, cy + 9], [cx + 1, cy + 11], [cx - 3, cy + 6]]).paint(col);
    }
}

function hair(P, look, c, view, cx, cy, o) {
    const col = c.hair, st = look.style || 'short';
    if (look.helm === 'open' || look.helm === 'horned') return hairUnderHelm(P, look, c, view, cx, cy);
    if (look.hood) return;
    if (st === 'bald') return;
    if (view === 'up') {
        P.mell(cx, cy, 7.6, 7).paint(col);
        if (st === 'long' || st === 'braid') P.mrect(cx - 7, cy + 2, 14, 12).msub((Q) => Q.mell(cx, cy + 14, 5, 3)).paint(col);
        if (st === 'ponytail') P.mrect(cx - 1, cy + 5, 3, 11).paint(col);
        if (st === 'spiky') { P.mpoly([[cx - 6, cy - 4], [cx - 8, cy - 9], [cx - 3, cy - 6]]).mpoly([[cx - 2, cy - 6], [cx, cy - 11], [cx + 3, cy - 6]]).mpoly([[cx + 3, cy - 5], [cx + 8, cy - 8], [cx + 6, cy - 2]]).paint(col); }
        return;
    }
    if (view === 'down') {
        P.mell(cx, cy - 1.5, 7.8, 6.2).msub((Q) => Q.mell(cx, cy + 6, 5.8, 5.6)).paint(col);
        P.mrect(cx - 7, cy - 1, 2, 6).paint(col); P.mrect(cx + 6, cy - 1, 2, 6).paint(col);
        if (st === 'spiky') { P.mpoly([[cx - 6, cy - 4], [cx - 9, cy - 9], [cx - 3, cy - 6]]).mpoly([[cx - 2, cy - 6], [cx, cy - 12], [cx + 3, cy - 6]]).mpoly([[cx + 3, cy - 5], [cx + 9, cy - 8], [cx + 6, cy - 2]]).mpoly([[cx - 7, cy - 1], [cx - 10, cy - 3], [cx - 7, cy - 4]]).paint(col); }
        if (st === 'long') P.mrect(cx - 8, cy + 1, 3, 16).mrect(cx + 6, cy + 1, 3, 16).paint(col);
        if (st === 'braid') { P.mrect(cx - 8, cy + 1, 2, 9).paint(col); P.mrect(cx + 5, cy + 5, 3, 13).paint(col); P.mp(cx + 6, cy + 18).fill(look.band || c.trim); }
        if (st === 'ponytail') { P.mrect(cx + 7, cy - 1, 3, 12).paint(col); P.mp(cx + 8, cy - 2).fill(look.band || c.trim); }
        if (st === 'short') { P.mrect(cx - 7, cy + 2, 2, 3).mrect(cx + 6, cy + 2, 2, 3).paint(col); }
    } else {
        // side: hair over the crown and down the back of the head
        P.mell(cx - 0.5, cy - 1.5, 7, 6.4).msub((Q) => Q.mell(cx + 3, cy + 5, 5, 5.4)).paint(col);
        P.mrect(cx - 7, cy, 4, 7).paint(col);
        if (st === 'spiky') P.mpoly([[cx - 5, cy - 4], [cx - 9, cy - 8], [cx - 2, cy - 6]]).mpoly([[cx - 1, cy - 6], [cx + 1, cy - 12], [cx + 4, cy - 6]]).mpoly([[cx + 3, cy - 5], [cx + 8, cy - 8], [cx + 6, cy - 2]]).paint(col);
        if (st === 'long') P.mrect(cx - 8, cy + 1, 5, 17).paint(col);
        if (st === 'braid') { P.mrect(cx - 8, cy + 1, 4, 8).paint(col); P.mline(cx - 7, cy + 9, cx - 8, cy + 20, 2).paint(col); P.mp(cx - 8, cy + 20).fill(look.band || c.trim); }
        if (st === 'ponytail') { P.mline(cx - 6, cy - 1, cx - 11, cy + 8, 3).paint(col); P.mp(cx - 6, cy - 2).fill(look.band || c.trim); }
        P.mrect(cx + 1, cy - 2, 5, 2).paint(col);
    }
}

function hairUnderHelm(P, look, c, view, cx, cy) {
    const col = c.hair;
    if (view === 'down') { P.mrect(cx - 6, cy + 1, 2, 4).mrect(cx + 5, cy + 1, 2, 4).paint(col); }
    else if (view === 'side') { P.mrect(cx - 6, cy + 1, 4, 6).paint(col); }
}

function headgear(P, look, c, view, cx, cy, o) {
    if (look.hat === 'witch') {
        P.mell(cx, cy - 3, 11, 2.6).paint('#4a1a6a');
        P.mpoly([[cx - 7, cy - 4], [cx + 7, cy - 4], [cx + 2, cy - 11], [cx + 6, cy - 18], [cx - 2, cy - 12]]).paint('#5a2a7a');
        P.mrect(cx - 7, cy - 5, 14, 2).paint(c.trim, { flat: true });
    }
    if (look.hat === 'cap') { P.mell(cx, cy - 4, 7.4, 3.4).paint(c.cloth); P.mrect(cx + (view === 'side' ? 2 : -7), cy - 2, view === 'side' ? 6 : 14, 2).paint(mix(c.cloth, '#000', 0.25), { flat: true }); }
    if (look.hood) {
        const hc = look.hood;
        if (view === 'down') { P.mell(cx, cy - 1, 9, 8.4).msub((Q) => Q.mell(cx, cy + 3, 5.4, 6)).paint(hc); P.mrect(cx - 9, cy + 4, 18, 3).msub((Q) => Q.mell(cx, cy + 3, 5.4, 6)).paint(hc); }
        else if (view === 'up') P.mell(cx, cy, 9, 8.4).paint(hc);
        else P.mell(cx - 1, cy - 1, 8.4, 8.2).msub((Q) => Q.mell(cx + 4, cy + 3, 5, 6)).paint(hc);
    }
    if (look.helm === 'open') {
        const steel = '#b8c4d8';
        if (view === 'down') { P.mell(cx, cy - 2, 7.8, 5.6).msub((Q) => Q.mrect(cx - 5, cy + 1, 10, 6)).paint(steel); P.mrect(cx - 1, cy - 7, 2, 7).paint('#e0e8f4', { flat: true }); P.mrect(cx - 7, cy, 2, 6).mrect(cx + 6, cy, 2, 6).paint(steel); P.mrect(cx - 1, cy - 8, 2, 2).fill(c.trim); }
        else if (view === 'up') P.mell(cx, cy - 1, 7.8, 6.8).paint(steel);
        else { P.mell(cx - 0.5, cy - 2, 7, 5.6).msub((Q) => Q.mrect(cx + 1, cy + 1, 8, 6)).paint(steel); P.mrect(cx - 7, cy, 4, 7).paint(steel); P.mrect(cx - 1, cy - 8, 3, 3).fill(c.trim); }
    }
    if (look.helm === 'horned') {
        const steel = '#9aa4b8';
        const cap = (Q) => Q.mell(cx, cy - 2, 7.8, 5.4);
        if (view === 'side') { P.mell(cx - 0.5, cy - 2, 7, 5.4).paint(steel); P.mpoly([[cx - 3, cy - 6], [cx - 7, cy - 13], [cx - 2, cy - 8]]).paint('#f0e8d0'); }
        else { cap(P); P.paint(steel); P.mpoly([[cx - 6, cy - 4], [cx - 11, cy - 12], [cx - 4, cy - 6]]).mpoly([[cx + 6, cy - 4], [cx + 11, cy - 12], [cx + 4, cy - 6]]).paint('#f0e8d0'); P.mrect(cx - 7, cy - 1, 14, 2).paint(c.trim, { flat: true }); }
    }
    if (look.veil) {
        const v = look.veil;
        if (view === 'down') { P.mell(cx, cy - 1, 8.6, 7.8).msub((Q) => Q.mell(cx, cy + 3.2, 5.6, 6)).paint(v); P.mrect(cx - 9, cy + 2, 3, 15).mrect(cx + 7, cy + 2, 3, 15).paint(v); P.mrect(cx - 4, cy - 6, 8, 1).paint(c.trim, { flat: true }); }
        else if (view === 'up') P.mell(cx, cy, 9, 8).mrect(cx - 8, cy + 3, 16, 14).paint(v);
        else { P.mell(cx - 1, cy - 1, 8, 7.4).msub((Q) => Q.mell(cx + 4, cy + 3, 5, 6)).paint(v); P.mrect(cx - 9, cy + 2, 6, 16).paint(v); }
    }
    if (look.band && !look.helm && !look.hat && !look.hood && !look.veil && view !== 'up') {
        if (view === 'down') P.mrect(cx - 7, cy - 3, 14, 1).paint(look.band, { flat: true }); else P.mrect(cx - 6, cy - 3, 12, 1).paint(look.band, { flat: true });
    }
}

// ---------------------------------------------------------------- bodies
function bodyFront(P, look, c, back, f, o = {}) {
    const stout = look.build === 'stout';
    const tw = stout ? 6.6 : 5.4, cx = 16;
    const bob = o.dy || 0;
    // cape behind
    if (c.cape && !back) P.mpoly([[cx - tw - 1, 21 + bob], [cx + tw + 1, 21 + bob], [cx + tw + 4, 42 + bob], [cx - tw - 4, 42 + bob]]).paint(mix(c.cape, '#000', 0.3));
    // legs
    const lo = [[-1, 1], [0, 0], [1, -1]][f];
    const ly0 = 31 + bob;
    const legL = 12 - (stout ? 1 : 0), legR = 17;
    const lh = stout ? 10 : 12;
    P.mrect(legL, ly0, 4, lh + lo[0] * -1).paint(c.pants); P.mrect(legR, ly0, 4, lh + lo[1] * -1 + (f === 1 ? 0 : 0)).paint(c.pants);
    P.mrect(legL, ly0 + lh - 3 + lo[0] * -1, 4, 3 + (f === 1 ? 1 : 1)).paint(c.boots); P.mrect(legR, ly0 + lh - 3 + lo[1] * -1, 4, 3 + 1).paint(c.boots);
    // arms
    const sw = [1, 0, -1][f];
    P.mrect(cx - tw - 3, 22 + bob + sw, 3, 9).paint(c.cloth); P.mrect(cx + tw, 22 + bob - sw, 3, 9).paint(c.cloth);
    P.mrect(cx - tw - 3, 30 + bob + sw, 3, 2).paint(c.skin); P.mrect(cx + tw, 30 + bob - sw, 3, 2).paint(c.skin);
    // torso
    P.mpoly([[cx - tw, 20 + bob], [cx + tw, 20 + bob], [cx + tw - 0.5, 32 + bob], [cx - tw + 0.5, 32 + bob]]).paint(c.cloth);
    if (!back) {
        P.mpoly([[cx - 2, 20 + bob], [cx + 2, 20 + bob], [cx, 25 + bob]]).paint(c.cloth2, { flat: true });
        P.mrect(cx - tw, 20 + bob, 2, 7).paint(mix(c.cloth, c.trim, 0.25), { flat: true });
        P.mrect(cx + tw - 2, 20 + bob, 2, 7).paint(mix(c.cloth, c.trim, 0.25), { flat: true });
    }
    P.mrect(cx - tw, 29 + bob, tw * 2, 2).paint(c.belt, { flat: true }); P.mrect(cx - 1, 29 + bob, 2, 2).paint(c.trim, { flat: true });
    if (look.scarf) { P.mrect(cx - 5, 19 + bob, 10, 2).paint(look.scarf, { flat: true }); if (!back) P.mrect(cx + 2, 20 + bob, 2, 6).paint(look.scarf, { flat: true }); }
    if (c.cape && back) P.mpoly([[cx - tw - 2, 20 + bob], [cx + tw + 2, 20 + bob], [cx + tw + 4, 42 + bob], [cx - tw - 4, 42 + bob]]).paint(c.cape);
    if (look.build === 'old' && !back) { /* a little stoop is drawn by the view */ }
}

function bodySide(P, look, c, o) {
    const cx = 16, bob = o.dy || 0, lean = o.lean || 0;
    const stout = look.build === 'stout';
    const tw = stout ? 5.2 : 4.4;
    const legs = o.legs ?? 1;  // 0, 1, 2 walk frames, or 'crouch' | 'kneel'
    const ly0 = 31 + bob;
    const lh = stout ? 10 : 12;
    let backLeg, frontLeg;
    if (legs === 'crouch') { backLeg = [cx - 4, ly0, 5, lh - 2, -2]; frontLeg = [cx + 1, ly0, 5, lh - 2, 3]; }
    else if (legs === 'kneel') { backLeg = [cx - 7, ly0 + 6, 9, 5, 0]; frontLeg = [cx - 1, ly0 + 2, 5, 9, 4]; }
    else { const s = [-3, 0, 3][legs] ?? 0; backLeg = [cx - 3 - s, ly0, 5, lh, 0]; frontLeg = [cx - 1 + s, ly0, 5, lh, 0]; }
    // cape trails behind
    if (c.cape) P.mpoly([[cx - 3 + lean, 21 + bob], [cx + 1 + lean, 21 + bob], [cx - 6, 42 + bob + (o.capeDy || 0)], [cx - 12, 40 + bob]]).paint(mix(c.cape, '#000', 0.2));
    const drawLeg = (L, shadeMul) => {
        P.mrect(L[0], L[1], L[2], L[3]).paint(shadeMul ? mix(c.pants, '#000', 0.25) : c.pants);
        P.mrect(L[0] + (L[4] > 0 ? 1 : 0), L[1] + L[3] - 3, L[2] + (L[4] > 0 ? 1 : 0), 3).paint(c.boots);
    };
    drawLeg(backLeg, true);
    // back arm (behind the torso)
    const sh = [cx - 1 + lean, 22 + bob];
    const aBack = o.armBack ?? -15;
    const [bhx, bhy] = pol(sh[0], sh[1], 8, aBack);
    P.mline(sh[0], sh[1], bhx, bhy, 3).paint(mix(c.cloth, '#000', 0.25));
    P.mp(bhx, bhy).fill(mix(c.skin, '#000', 0.2));
    drawLeg(frontLeg, false);
    // torso
    P.mpoly([[cx - tw + lean, 20 + bob], [cx + tw + lean, 20 + bob], [cx + tw - 0.5, 32 + bob], [cx - tw + 0.5, 32 + bob]]).paint(c.cloth);
    P.mrect(cx - tw + 1 + lean, 20 + bob, 2, 8).paint(mix(c.cloth, c.trim, 0.25), { flat: true });
    P.mrect(cx - tw, 29 + bob, tw * 2, 2).paint(c.belt, { flat: true }); P.mp(cx + 2, 29 + bob).fill(c.trim);
    if (look.scarf) P.mrect(cx - 3 + lean, 19 + bob, 7, 2).paint(look.scarf, { flat: true });
    return { shoulder: sh, bob };
}

// ---------------------------------------------------------------- the frames
/**
 * Draw one frame. view: 'down' | 'up' | 'side'; f: walk frame 0-2; pose: battle pose for side view.
 * Returns a Px (32 × 48), outlined and ready to be turned into a texture.
 */
export function drawHero(look, view = 'down', f = 1, pose = null) {
    const P = new Px(FW, FH), c = cols(look);
    if (view === 'down' || view === 'up') {
        const back = view === 'up';
        const bob = f === 1 ? 0 : 0;
        bodyFront(P, look, c, back, f, { dy: bob });
        head(P, look, c, view, 16, 14 + bob);
        // weapon sheath on the back, visible from behind
        if (back && (look.weapon === 'sword' || look.weapon === 'axe')) { P.mline(23, 20, 13, 31, 2).paint(c.wood, { flat: true }); }
        if (back && look.weapon === 'bow') P.mline(23, 18, 23, 34, 1).paint(c.wood, { flat: true });
    } else {
        sideFrame(P, look, c, f, pose);
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

function sideFrame(P, look, c, f, poseName) {
    const pose = poseName ? (POSES[poseName] || POSES.idle) : { legs: f, arm: 28 - f * 28, w: 172, armBack: -28 + f * 28, eyes: 'open', noWeapon: true };
    const o = { legs: pose.legs, dy: pose.dy || 0, lean: pose.lean || 0, armBack: pose.armBack, capeDy: poseName ? 0 : 0 };
    const { shoulder, bob } = bodySide(P, look, c, o);
    head(P, look, c, 'side', 16 + (pose.lean || 0), 14 + bob, { eyes: pose.eyes });
    // front arm over the torso
    const [hx, hy] = pol(shoulder[0], shoulder[1], 8, pose.arm);
    P.mline(shoulder[0], shoulder[1], hx, hy, 3).paint(c.cloth);
    P.mp(hx, hy).mp(hx + 1, hy).mp(hx, hy + 1).fill(c.skin);
    if (poseName && look.weapon && !pose.noWeapon) weapon(P, look, hx, hy, pose.w, c);
    if (!poseName && look.weapon === 'staff') { weapon(P, look, hx, hy, 175, c); }
}

export const BATTLE_POSES = Object.keys(POSES);
