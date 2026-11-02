// Pixel people: the four princesses, the knight, the princes, townsfolk, the Archivist and O.T.T.O. himself. Every figure
// is painted from a `look` ({ skin, hair, hairStyle, dress, trim, accent, crown, armor, beard, small, eyes }) by the
// auto-shading painter in pixel.js. Frames are 24×32 (Otto 40×34).
//
//   drawPerson(look, view, f, pose)   view: 'down' | 'up' | 'side' (faces right); f: walk frame 0..3
//                                     pose: null | 'idle' | 'play' | 'hurt' | 'ko' | 'down' | 'cheer'   (battle poses are side views)
//   drawOtto(view, f, { lit })        the brass walking carriage
//   drawRobot(look, view, f)          Archivist Nine

import { Px, mix, hex } from './pixel.js';

export const FW = 24, FH = 32;
const OUT = '#1c1424';

/** The six princesses still sealed in the Hollow: looks made from a palette, no stats. */
export const CHOIR = {
    choir1: { skin: '#f0d0b8', hair: '#3a2a5a', hairStyle: 'long', dress: '#8a5ad8', trim: '#e8d8ff', accent: '#ffd35c', crown: 'tiara', eyes: '#222' },
    choir2: { skin: '#b8805a', hair: '#1a1a1a', hairStyle: 'bun', dress: '#d84a4a', trim: '#ffe0d0', accent: '#ffd35c', crown: 'circlet', eyes: '#222' },
    choir3: { skin: '#f8e0d0', hair: '#e8c070', hairStyle: 'wave', dress: '#5ab8e8', trim: '#ffffff', accent: '#ff9ac8', crown: 'tiara', eyes: '#2a4a8a' },
    choir4: { skin: '#8a5a3a', hair: '#2a1a10', hairStyle: 'braid', dress: '#4ab86a', trim: '#e8ffd8', accent: '#ffd35c', crown: 'flower', eyes: '#222' },
    choir5: { skin: '#f0c8a8', hair: '#d85a2a', hairStyle: 'short', dress: '#e8a83a', trim: '#fff0c8', accent: '#8a3ad8', crown: 'circlet', eyes: '#222' },
    choir6: { skin: '#e0b898', hair: '#c8c8d8', hairStyle: 'long', dress: '#3a4a8a', trim: '#c8d8ff', accent: '#5ae8d8', crown: 'tiara', eyes: '#222' },
};

const dk = (c, t) => mix(hex(c), '#000000', t);
const lt = (c, t) => mix(hex(c), '#ffffff', t);

/**
 * One frame of a person. Walking: f 1 and 3 are the steps (the body bobs, a foot shows, the hem sways).
 */
export function drawPerson(look, view = 'down', f = 0, pose = null) {
    if (pose === 'ko' || pose === 'down') {
        // lying down: paint the side view and turn it on its back
        const s = drawPerson(look, 'side', 0, 'hurt');
        const P = new Px(FW, FH);
        for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
            const c = s.get(x, y); if (!c) continue;
            // rotate 90° clockwise into the bottom of the frame
            const nx = Math.floor((FH - 1 - y) * 0.75) + 0, ny = FH - 1 - Math.floor((FW - 1 - x) * 0.5);
            P.set(nx, ny, c); P.set(nx, ny - 1, c);
        }
        return P;
    }
    const P = new Px(FW, FH);
    const L = { skin: '#f0d0b8', hair: '#6a3a2a', hairStyle: 'short', dress: '#6a6a9a', trim: '#e8e8f8', accent: '#ffd35c', eyes: '#2a2a3a', ...look };
    const small = !!L.small;
    const walk = f === 1 || f === 3;
    const bob = walk ? 1 : 0;
    const sway = f === 1 ? -1 : f === 3 ? 1 : 0;
    const side = view === 'side', up = view === 'up';
    const hurt = pose === 'hurt';
    const playing = pose === 'play' || pose === 'cheer';
    const hy = (small ? 13 : 10) + bob + (hurt ? 1 : 0);            // head centre
    const hx = 12 + (side ? 1 : 0) - (hurt ? 1 : 0);
    const top = hy + 5;                                                 // neck
    const isSkirt = !L.armor && !L.pants;

    // ---- long hair falls behind everything
    if ((L.hairStyle === 'long' || L.hairStyle === 'wave') && !up) {
        if (side) P.mpoly([[hx - 6, hy - 3], [hx + 1, hy - 4], [hx - 1, hy + 11], [hx - 7, hy + 12]]);
        else P.mrect(hx - 6, hy - 2, 12, 13);
        P.paint(L.hair, { tex: L.hairStyle === 'wave' ? (x, y) => ((x + y) % 4 === 0 ? 1 : 0) : null });
    }

    // ---- legs / feet
    const footY = 30;
    if (isSkirt) {
        if (walk && !side) { P.mrect(sway < 0 ? 9 : 13, footY - 1, 3, 2); P.paint(dk(L.dress, 0.55)); }
        if (side && walk) { P.mrect(hx + 1 + sway, footY - 1, 3, 2); P.paint(dk(L.dress, 0.55)); }
    } else {
        const pc = L.armor ? '#4a4a5a' : dk(L.dress, 0.35);
        if (side) {
            P.mrect(hx - 2 + sway, top + 7, 3, footY - top - 6).paint(pc);
            P.mrect(hx - 1 - sway, top + 7, 3, footY - top - 6).paint(dk(pc, 0.15));
        } else {
            P.mrect(9, top + 7, 3, footY - top - 7 + (sway < 0 ? 0 : -1)).paint(pc);
            P.mrect(13, top + 7, 3, footY - top - 7 + (sway > 0 ? 0 : -1)).paint(pc);
        }
        P.mrect(side ? hx - 2 : 8, footY - 1, side ? 5 : 4, 2).paint('#3a2a20');
        if (!side) P.mrect(13, footY - 1, 4, 2).paint('#3a2a20');
    }

    // ---- skirt
    if (isSkirt) {
        const w0 = small ? 3 : 4, w1 = small ? 6 : 8;
        const y0 = top + 4, y1 = footY - (small ? 1 : 0);
        const cx = side ? hx - 1 : 12;
        P.mpoly([[cx - w0, y0], [cx + w0, y0], [cx + w1 + (side ? -1 : 0) + Math.max(0, sway), y1], [cx - w1 + Math.min(0, sway), y1]]);
        P.paint(L.dress, { tex: (x, y) => ((x * 3 + y) % 7 === 0 && y > y0 + 2 ? -1 : 0) });
        // a hem in the trim colour
        P.mpoly([[cx - w1 + Math.min(0, sway), y1 - 2], [cx + w1 + (side ? -1 : 0) + Math.max(0, sway), y1 - 2], [cx + w1 + (side ? -1 : 0) + Math.max(0, sway), y1], [cx - w1 + Math.min(0, sway), y1]]);
        P.paint(L.trim, { soft: true });
    }

    // ---- torso
    const tw = small ? 3 : 4;
    const tcx = side ? hx - 1 : 12;
    if (L.armor) {
        P.mrect(tcx - tw - 1, top, tw * 2 + 2, 8).paint('#8a94a8', { tex: (x, y) => (y === top + 3 ? -1 : 0) });
        P.mrect(tcx - tw - 1, top + 6, tw * 2 + 2, 2).paint(L.dress);
        if (!up && !side) P.mrect(tcx - 1, top + 1, 2, 5).paint(L.accent);         // a tabard stripe
    } else {
        P.mrect(tcx - tw, top, tw * 2, 6).paint(L.dress);
        if (!up) { P.mrect(tcx - tw, top + 4, tw * 2, 1).paint(L.accent, { flat: true }); }       // sash
        if (!up && !side && isSkirt) { P.mp(tcx - 1, top + 1).mp(tcx, top + 1).paint(L.trim, { flat: true }); }
    }

    // ---- arms
    const armC = L.armor ? '#7a8498' : L.dress;
    const hand = L.skin;
    if (side) {
        if (playing) { P.mline(tcx, top + 1, tcx + 5, top - 2 - (pose === 'cheer' ? 3 : 0), 2).paint(armC); P.mrect(tcx + 5, top - 4 - (pose === 'cheer' ? 3 : 0), 2, 2).paint(hand); }
        else if (hurt) { P.mline(tcx - 1, top + 1, tcx - 4, top + 5, 2).paint(armC); P.mrect(tcx - 5, top + 5, 2, 2).paint(hand); }
        else { P.mrect(tcx - 1 + Math.round(sway * 0.5), top + 1, 2, 6).paint(armC); P.mrect(tcx - 1 + Math.round(sway * 0.5), top + 7, 2, 1).paint(hand); }
    } else {
        const ay = top + 1;
        if (pose === 'cheer') {
            P.mline(tcx - tw, ay, tcx - tw - 3, ay - 6, 2).paint(armC); P.mline(tcx + tw - 1, ay, tcx + tw + 2, ay - 6, 2).paint(armC);
            P.mrect(tcx - tw - 4, ay - 8, 2, 2).paint(hand); P.mrect(tcx + tw + 2, ay - 8, 2, 2).paint(hand);
        } else {
            P.mrect(tcx - tw - 2, ay + (sway > 0 ? 1 : 0), 2, 6).paint(armC);
            P.mrect(tcx + tw, ay + (sway < 0 ? 1 : 0), 2, 6).paint(armC);
            if (!up) { P.mrect(tcx - tw - 2, ay + 6 + (sway > 0 ? 1 : 0), 2, 1).paint(hand, { flat: true }); P.mrect(tcx + tw, ay + 6 + (sway < 0 ? 1 : 0), 2, 1).paint(hand, { flat: true }); }
        }
        if (L.cape) { P.mrect(tcx - tw - 1, top, tw * 2 + 2, 10); P.paint(L.cape); }
    }

    // ---- neck and head
    P.mrect(hx - 1, top - 1, 2, 2).paint(L.skin, { soft: true });
    const hr = small ? 4.5 : 5;
    if (side) P.mell(hx + 1, hy, hr, hr); else P.mell(hx, hy, hr, hr);
    P.paint(L.skin, { soft: true });

    // ---- face
    if (!up) {
        const ec = L.eyes;
        if (side) {
            P.mrect(hx + 3, hy, 1, 2).fill(ec);
            P.mp(hx + 5, hy + 2).fill(dk(L.skin, 0.25));                       // a nose tip
            if (!L.beard) P.mp(hx + 3, hy + 3).fill(dk(L.skin, 0.35));
        } else {
            P.mrect(hx - 3, hy, 1, 2).fill(ec); P.mrect(hx + 2, hy, 1, 2).fill(ec);
            P.mp(hx - 3, hy).fill(lt(ec, 0.6));
            P.mp(hx + 2, hy).fill(lt(ec, 0.6));
            if (!L.beard) P.mrect(hx - 1, hy + 3, 2, 1).fill(hurt ? dk(L.skin, 0.5) : '#c86a6a');
            P.mp(hx - 4, hy + 2).mp(hx + 3, hy + 2).fill(mix(hex(L.skin), '#ff7a8a', 0.35));       // blush
        }
        if (L.beard) {
            if (side) P.mpoly([[hx - 1, hy + 2], [hx + 5, hy + 2], [hx + 3, hy + 6], [hx, hy + 5]]);
            else P.mpoly([[hx - 4, hy + 1], [hx + 4, hy + 1], [hx + 2, hy + 6], [hx - 2, hy + 6]]);
            P.paint(L.hair);
            if (!side) P.mrect(hx - 1, hy + 3, 2, 1).fill(dk(L.hair, 0.5));
        }
    }

    // ---- hair on top
    const H = L.hair;
    const st = L.hairStyle;
    if (st !== 'bald') {
        if (up) { P.mell(hx, hy - 0.5, hr + 0.6, hr + 0.4); P.paint(H, { tex: (x, y) => ((x + y * 2) % 5 === 0 ? -1 : 0) }); }
        else if (side) {
            P.mpoly([[hx - 4, hy + 2], [hx - 4, hy - 4], [hx + 1, hy - 6], [hx + 6, hy - 3], [hx + 5, hy - 1], [hx + 1, hy - 2], [hx, hy + 1]]);
            P.paint(H);
        } else {
            P.mpoly([[hx - 6, hy + 1], [hx - 6, hy - 3], [hx - 3, hy - 6], [hx + 3, hy - 6], [hx + 6, hy - 3], [hx + 6, hy + 1], [hx + 4, hy - 2], [hx + 1, hy - 3], [hx - 2, hy - 2], [hx - 4, hy - 1]]);
            P.paint(H);
        }
        if (st === 'bun') { P.mell(hx + (side ? -3 : 0), hy - 6, 2.6, 2.3).paint(H); }
        if (st === 'braid' && !up) {
            const bx = side ? hx - 4 : hx + 5;
            for (let i = 0; i < 4; i++) P.mell(bx + (side ? 0 : 0.5), hy + 2 + i * 2.4, 1.6, 1.4);
            P.paint(H, { tex: (x, y) => (y % 2 ? -1 : 0) });
            P.mrect(bx - 1, hy + 11, 2, 1).fill(L.accent);
        }
        if (st === 'braid' && up) { for (let i = 0; i < 4; i++) P.mell(hx, hy + 3 + i * 2.4, 1.6, 1.4); P.paint(H); }
        if ((st === 'long' || st === 'wave') && up) { P.mrect(hx - 6, hy, 12, 11); P.paint(H, { tex: st === 'wave' ? (x, y) => ((x + y) % 4 === 0 ? 1 : 0) : null }); }
    }

    // ---- crowns
    const cr = L.crown;
    if (cr) {
        const cy = hy - 6, cx = side ? hx : hx;
        if (cr === 'tiara') { P.mrect(cx - 3, cy + 1, 7, 1).mp(cx - 2, cy).mp(cx, cy - 1).mp(cx + 2, cy).paint(L.accent, { soft: true }); if (!up) P.mp(cx, cy).fill('#ff5a8a'); }
        else if (cr === 'circlet') { P.mrect(cx - 4, cy + 2, 9, 1).paint(L.accent, { soft: true }); if (!up && !side) P.mp(cx, cy + 2).fill('#ffffff'); }
        else if (cr === 'shell') { P.mpoly([[cx - 3, cy + 2], [cx, cy - 2], [cx + 3, cy + 2]]).paint(L.accent); P.mline(cx, cy - 1, cx, cy + 2).fill(lt(L.accent, 0.4)); }
        else if (cr === 'flower') { P.mell(cx + (side ? -2 : 3), cy + 2, 2, 2).paint(L.accent); P.mp(cx + (side ? -2 : 3), cy + 2).fill('#fff6a8'); }
    }

    // ---- held instruments (battle poses)
    if (side && (pose === 'idle' || pose === 'play') && L.inst) drawInstrument(P, L, tcx, top, pose === 'play');

    P.outline(OUT, 0.82);
    if (hurt) P.tint && null;
    return P;
}

function drawInstrument(P, L, x, top, play) {
    const k = L.inst;
    if (k === 'drum') {
        // the Heartdrum on a strap, at the hip, and a beater
        P.mell(x + 3, top + 7, 3.4, 2.6).paint('#c8443a');
        P.mrect(x, top + 6, 7, 1).paint('#ffd35c', { flat: true });
        P.mell(x + 3, top + 5.6, 3.2, 1).paint('#fff0d8', { soft: true });
        P.mline(x + 5, top - (play ? 3 : 0), x + 8, top + (play ? -6 : 3), 1).paint('#8a5a2a');
    } else if (k === 'harp') {
        P.mpoly([[x + 3, top - 2], [x + 8, top + 1], [x + 7, top + 8], [x + 3, top + 7]]).paint('#f8e8c8');
        P.mline(x + 4, top, x + 4, top + 6).mline(x + 5, top + 1, x + 5, top + 7).mline(x + 6, top + 1, x + 6, top + 7).fill('#a8fff1');
    } else if (k === 'voice') {
        // a little sun-brass bell of a mic, and music in the air
        if (play) { P.mp(x + 9, top - 6).mp(x + 10, top - 7).mp(x + 10, top - 6).mp(x + 10, top - 5).fill('#ffe27a'); }
    } else if (k === 'horn') {
        P.mpoly([[x + 1, top + 1], [x + 9, top - 3], [x + 11, top - 1], [x + 10, top + 3], [x + 2, top + 3]]).paint('#cfe6ff');
        P.mell(x + 10, top, 1.6, 2.6).paint('#8ab8ff');
    }
}

/** O.T.T.O.: a brass carriage on four spindly legs, one round glass eye, a lamp on the roof, shells stuck to the panels. */
export function drawOtto(view = 'down', f = 0, o = {}) {
    const W = 40, H = 36;
    const P = new Px(W, H);
    const lit = o.lit !== false;
    const side = view === 'side', up = view === 'up';
    const step = f % 2;
    const brass = '#c89a3a', dark = '#6a4a2a', glass = lit ? '#7ff6ff' : '#3a5a6a';
    const by = 9 + (f === 1 || f === 3 ? 1 : 0);
    // legs
    const legs = side ? [[9, 0], [14, 1], [26, 0], [31, 1]] : [[8, 0], [14, 1], [25, 1], [31, 0]];
    legs.forEach(([lx, ph], i) => {
        const lift = (ph + step) % 2 ? 2 : 0;
        P.mline(lx, by + 15, lx + (i < 2 ? -2 : 2), 33 - lift, 2).paint(dark);
        P.mrect(lx + (i < 2 ? -3 : 1), 33 - lift, 3, 2).paint('#3a2a20');
    });
    // body
    if (side) {
        P.mpoly([[4, by + 4], [10, by], [32, by], [36, by + 5], [36, by + 16], [4, by + 16]]).paint(brass, { tex: (x, y) => (x % 7 === 0 ? -1 : 0) });
        P.mrect(8, by + 4, 10, 7).paint('#3a2a2a'); P.mrect(9, by + 5, 8, 5).paint('#5a8aa8', { soft: true });   // a window
        P.mell(32, by + 8, 4, 4).paint('#5a3a1a'); P.mell(32, by + 8, 3, 3).paint(glass, { soft: true });          // the eye
        if (lit) P.mp(31, by + 7).fill('#ffffff');
    } else {
        P.mpoly([[5, by + 3], [10, by], [30, by], [35, by + 3], [35, by + 16], [5, by + 16]]).paint(brass, { tex: (x, y) => (y === by + 12 ? -1 : 0) });
        if (!up) {
            P.mell(20, by + 8, 6, 5.5).paint('#5a3a1a');
            P.mell(20, by + 8, 4.6, 4.2).paint(glass, { soft: true });
            if (lit) { P.mrect(18, by + 6, 2, 2).fill('#ffffff'); P.mell(20, by + 8, 1.5, 1.5).paint('#1a3a4a'); }
            P.mrect(8, by + 13, 24, 2).paint('#e8c060', { soft: true });
        } else {
            P.mrect(9, by + 4, 22, 9).paint('#8a6a2a');
            P.mrect(12, by + 6, 16, 2).paint('#5a3a1a');
        }
    }
    // roof and lamp
    P.mpoly([[8, by + 1], [12, by - 3], [28, by - 3], [32, by + 1]]).paint('#7a4a2a');
    P.mrect(18, by - 7, 4, 4).paint(lit ? '#ffe27a' : '#8a7a4a', { soft: true });
    P.mrect(17, by - 8, 6, 1).paint(dark);
    // shells and barnacles from a thousand years by the water
    for (const [sx, sy] of [[7, by + 13], [29, by + 3], [12, by + 15], [33, by + 11]]) P.mell(sx, sy, 1.6, 1.2).paint('#f0d8c8');
    P.outline(OUT, 0.85);
    return P;
}

/** Archivist Nine: a small brass automaton with a dome head and a single lens. */
export function drawRobot(view = 'down', f = 0) {
    const P = new Px(FW, FH);
    const bob = f === 1 || f === 3 ? 1 : 0;
    const brass = '#b8903a';
    P.mrect(9, 26, 2, 4).mrect(13, 26, 2, 4).paint('#5a4a3a');
    P.mpoly([[7, 15 + bob], [17, 15 + bob], [16, 27], [8, 27]]).paint(brass, { tex: (x, y) => (y % 4 === 0 ? -1 : 0) });
    P.mrect(5, 16 + bob, 2, 8).mrect(17, 16 + bob, 2, 8).paint('#8a6a2a');
    P.mell(12, 10 + bob, 5.5, 5).paint('#d8b050');
    if (view !== 'up') { P.mell(view === 'side' ? 14 : 12, 10 + bob, 2.4, 2.4).paint('#ffd38a', { soft: true }); P.mp(view === 'side' ? 13 : 11, 9 + bob).fill('#ffffff'); }
    P.mrect(11, 3 + bob, 2, 3).paint('#8a6a2a'); P.mp(12, 2 + bob).fill('#ff6a5a');
    P.mrect(9, 19 + bob, 6, 4).paint('#5a3a2a');                         // a book of records under its arm
    P.outline(OUT, 0.85);
    return P;
}
