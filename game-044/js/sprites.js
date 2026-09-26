/**
 * sprites.js — Rowan, drawn a pixel at a time from a paper-doll recipe.
 *
 * Rather than hand-authoring every frame, each frame is built from a few
 * parts (head, cloak, tunic, arms, legs) whose offsets come from the walk
 * phase. Frames are cached as tiny canvases and scaled with nearest-neighbour
 * when drawn, so perspective scaling keeps hard pixel edges.
 */

import { makeCanvas } from './paint.js';

export const SPR_W = 20, SPR_H = 38;

const C = {
    hair: '#6b4226', hairHi: '#a0703c',
    skin: '#e8b89a', skinSh: '#b07a5a',
    eye: '#1b1f3b',
    cloak: '#2f8a8a', cloakSh: '#1e4a50',
    tunic: '#cfa168', tunicSh: '#a0703c',
    belt: '#3a2418',
    scarf: '#b8332f', scarfSh: '#6e1f24',
    legs: '#2b3a67', legsSh: '#1b1f3b',
    boot: '#3a2418',
    bag: '#6b4226',
};

const cache = new Map();

/**
 * @param dir   'left' | 'right' | 'up' | 'down'
 * @param phase walk phase 0..1, or -1 when standing
 * @param pose  'stand' | 'reach'
 */
export function rowanFrame(dir, phase, pose = 'stand') {
    // Quantise phase to 8 steps so the cache stays small.
    const f = phase < 0 ? -1 : Math.floor(phase * 8) % 8;
    const key = `${dir}|${f}|${pose}`;
    let c = cache.get(key);
    if (c) return c;
    c = makeCanvas(SPR_W, SPR_H);
    const g = c.getContext('2d');
    const p = f < 0 ? -1 : f / 8;
    if (dir === 'left' || dir === 'right') drawSide(g, p, pose);
    else if (dir === 'down') drawFront(g, p, pose);
    else drawBack(g, p, pose);
    if (dir === 'left') {
        const m = makeCanvas(SPR_W, SPR_H);
        const mg = m.getContext('2d');
        mg.translate(SPR_W, 0);
        mg.scale(-1, 1);
        mg.drawImage(c, 0, 0);
        c = m;
    }
    cache.set(key, c);
    return c;
}

function px(g, x, y, w, h, col) {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
}

/** A 2px-wide leg from hip to foot, shifted by `off` at the foot. */
function leg(g, hipX, hipY, footY, off, col, sh) {
    const len = footY - hipY;
    for (let i = 0; i <= len; i++) {
        const x = Math.round(hipX + off * (i / len));
        px(g, x, hipY + i, 2, 1, i < 2 ? sh : col);
    }
    const fx = Math.round(hipX + off);
    px(g, fx, footY - 1, 3, 2, C.boot);
}

function drawSide(g, p, pose) {
    const s = p < 0 ? 0 : Math.sin(p * Math.PI * 2);
    const bob = p < 0 ? 0 : -Math.round(Math.abs(Math.sin(p * Math.PI * 2)));
    const y0 = 1 + bob;

    // back leg, then cloak, then body, then front leg + arm
    leg(g, 8, 24 + y0, 36, -s * 3, C.legsSh, C.legsSh);

    // cloak streaming behind
    const sway = p < 0 ? 0 : Math.round(Math.sin(p * Math.PI * 2 + 1) * 1);
    for (let y = 10; y < 27; y++) {
        const t = (y - 10) / 17;
        const back = Math.round(4 - t * 3 - (p < 0 ? 0 : t * 1.5) + sway * t);
        px(g, back, y + y0, 8 - back, 1, y > 22 ? C.cloakSh : C.cloak);
    }

    // tunic
    px(g, 7, 12 + y0, 6, 11, C.tunic);
    px(g, 7, 12 + y0, 2, 11, C.tunicSh);
    px(g, 7, 20 + y0, 6, 1, C.belt);
    // satchel on hip
    px(g, 6, 19 + y0, 3, 4, C.bag);

    leg(g, 10, 24 + y0, 36, s * 3, C.legs, C.legsSh);

    // tunic skirt over the top of the legs
    px(g, 7, 21 + y0, 6, 3, C.tunic);

    // head
    px(g, 8, 3 + y0, 6, 7, C.skin);
    px(g, 13, 6 + y0, 1, 2, C.skin);          // nose
    px(g, 8, 8 + y0, 2, 2, C.skinSh);
    px(g, 7, 2 + y0, 6, 3, C.hair);
    px(g, 7, 4 + y0, 2, 6, C.hair);            // back of head
    px(g, 9, 2 + y0, 3, 1, C.hairHi);
    px(g, 12, 3 + y0, 1, 1, C.hair);
    px(g, 12, 5 + y0, 1, 2, C.eye);
    // scarf
    px(g, 7, 10 + y0, 7, 2, C.scarf);
    px(g, 5, 11 + y0 + (sway > 0 ? 1 : 0), 3, 2, C.scarfSh);

    // arm
    if (pose === 'reach') {
        px(g, 10, 12 + y0, 6, 2, C.tunicSh);
        px(g, 16, 12 + y0, 2, 2, C.skin);
    } else {
        const a = -s * 2;
        for (let i = 0; i < 7; i++) px(g, Math.round(9 + a * i / 7), 12 + y0 + i, 2, 1, C.tunicSh);
        px(g, Math.round(9 + a), 19 + y0, 2, 2, C.skin);
    }
}

function drawFront(g, p, pose) {
    const s = p < 0 ? 0 : Math.sin(p * Math.PI * 2);
    const bob = p < 0 ? 0 : -Math.round(Math.abs(s));
    const y0 = 1 + bob;
    const lift = (v) => Math.max(0, Math.round(v * 2));

    // cloak behind, visible at the sides
    px(g, 4, 11 + y0, 12, 15, C.cloakSh);
    px(g, 4, 11 + y0, 2, 14, C.cloak);
    px(g, 14, 11 + y0, 2, 14, C.cloak);

    // legs
    const la = lift(s), lb = lift(-s);
    px(g, 7, 24 + y0, 3, 12 - la, C.legs);
    px(g, 10, 24 + y0, 3, 12 - lb, C.legs);
    px(g, 7, 34 + y0 - la, 3, 2, C.boot);
    px(g, 10, 34 + y0 - lb, 3, 2, C.boot);

    // tunic
    px(g, 6, 12 + y0, 8, 13, C.tunic);
    px(g, 6, 12 + y0, 1, 13, C.tunicSh);
    px(g, 6, 20 + y0, 8, 1, C.belt);
    px(g, 9, 20 + y0, 2, 1, C.hairHi);           // buckle
    px(g, 12, 13 + y0, 1, 7, C.bag);             // strap

    // arms
    if (pose === 'reach') {
        px(g, 14, 12 + y0, 2, 5, C.tunicSh);
        px(g, 14, 17 + y0, 2, 2, C.skin);
        px(g, 4, 12 + y0, 2, 7, C.tunicSh);
        px(g, 4, 19 + y0, 2, 2, C.skin);
    } else {
        const aa = Math.round(s), ab = Math.round(-s);
        px(g, 4, 12 + y0, 2, 7 + aa, C.tunicSh);
        px(g, 4, 19 + y0 + aa, 2, 2, C.skin);
        px(g, 14, 12 + y0, 2, 7 + ab, C.tunicSh);
        px(g, 14, 19 + y0 + ab, 2, 2, C.skin);
    }

    // head
    px(g, 7, 3 + y0, 6, 7, C.skin);
    px(g, 7, 8 + y0, 6, 2, C.skinSh);
    px(g, 6, 2 + y0, 8, 3, C.hair);
    px(g, 6, 4 + y0, 1, 5, C.hair);
    px(g, 13, 4 + y0, 1, 5, C.hair);
    px(g, 8, 2 + y0, 3, 1, C.hairHi);
    px(g, 8, 6 + y0, 1, 1, C.eye);
    px(g, 11, 6 + y0, 1, 1, C.eye);
    // scarf
    px(g, 6, 10 + y0, 8, 2, C.scarf);
    px(g, 11, 12 + y0, 2, 3, C.scarfSh);
}

function drawBack(g, p, pose) {
    const s = p < 0 ? 0 : Math.sin(p * Math.PI * 2);
    const bob = p < 0 ? 0 : -Math.round(Math.abs(s));
    const y0 = 1 + bob;
    const lift = (v) => Math.max(0, Math.round(v * 2));
    const la = lift(s), lb = lift(-s);
    px(g, 7, 24 + y0, 3, 12 - la, C.legsSh);
    px(g, 10, 24 + y0, 3, 12 - lb, C.legsSh);
    px(g, 7, 34 + y0 - la, 3, 2, C.boot);
    px(g, 10, 34 + y0 - lb, 3, 2, C.boot);

    const aa = Math.round(s), ab = Math.round(-s);
    px(g, 4, 12 + y0, 2, 7 + aa, C.tunicSh);
    px(g, 14, 12 + y0, 2, 7 + ab, C.tunicSh);
    if (pose === 'reach') px(g, 14, 9 + y0, 2, 4, C.tunicSh);

    // cloak covers the back
    px(g, 5, 10 + y0, 10, 16, C.cloak);
    px(g, 5, 22 + y0, 10, 4, C.cloakSh);
    px(g, 9, 11 + y0, 1, 13, C.cloakSh);
    // head
    px(g, 6, 2 + y0, 8, 8, C.hair);
    px(g, 8, 3 + y0, 3, 2, C.hairHi);
    px(g, 6, 10 + y0, 8, 2, C.scarf);
}

/** Dithered ground shadow — stays on-palette, unlike an alpha ellipse. */
export function drawShadow(g, x, y, s) {
    const rx = Math.round(7 * s), ry = Math.max(1, Math.round(2 * s));
    g.fillStyle = '#0d0b14';
    for (let yy = -ry; yy <= ry; yy++) {
        const half = Math.round(rx * Math.sqrt(1 - (yy * yy) / (ry * ry + 0.01)));
        for (let xx = -half; xx <= half; xx++) {
            if (((xx + yy + 1000) & 1) === 0) g.fillRect(Math.round(x) + xx, Math.round(y) + yy, 1, 1);
        }
    }
}
