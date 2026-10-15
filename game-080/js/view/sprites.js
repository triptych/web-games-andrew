// Characters, foes, Wick and item icons, all painted in code and cached.
//
// People are 16 × 24 frames: four facings × three walk frames (stand, step, step). A look is a
// small recipe (body kind, skin, hair, clothes, hat, extras) from js/sim/data/npcs.js; the
// librarian and Wick have their own.

import { canvas, painter, outline, shade, flipped, nz, mix } from './paint.js';

export const CW = 16, CH = 24;
const OUT = '#231a26';
const cache = new Map();

export const PLAYER_LOOK = { k: 'human', skin: '#e9bf98', hair: 'short', hc: '#6b4026', top: '#3f7a5a', bottom: '#5a4636', acc: 'glasses', satchel: true, scarf: '#c2563c' };

// ------------------------------------------------------------------ people
function drawHuman(P, L, dir, fr, kid) {
    const { R, px } = P;
    const sk = L.skin || '#e9bf98', skD = shade(sk, -0.16);
    const hc = L.hc || '#5a3a1e', hcD = shade(hc, -0.3), hcL = shade(hc, 0.22);
    const top = L.top || '#5a7aaa', topD = shade(top, -0.28), topL = shade(top, 0.18);
    const bot = L.bottom || '#4a3a2a', botD = shade(bot, -0.25);
    const step = fr === 1 ? -1 : fr === 2 ? 1 : 0;
    const side = dir === 'left' || dir === 'right';
    const back = dir === 'up';
    const y0 = kid ? 9 : 6;                 // top of the head
    const hy = y0, by = y0 + 8, ly = kid ? 21 : 20;
    const long = L.hair === 'long', dress = L.dress;
    const bob = fr ? 1 : 0;

    // long hair / pony behind
    if ((long || L.hair === 'pony') && back) R(4, hy + 2, 8, long ? 9 : 6, hc);
    if (L.hair === 'pony' && side) R(3, hy + 3, 2, 6, hcD);
    if (L.acc === 'cape') R(3, by, 10, (kid ? 8 : 11), shade(top, -0.4));

    // legs
    if (side) {
        R(6 + step, ly, 2, 3, botD); R(8 - step, ly, 2, 3, bot);
        R(6 + step, ly + 3, 3, 1, '#3a2a22'); R(8 - step, ly + 3, 3, 1, '#2e2018');
    } else {
        const l = step < 0 ? 1 : 0, r = step > 0 ? 1 : 0;
        R(5, ly, 2, 3 - l, bot); R(9, ly, 2, 3 - r, bot);
        R(5, ly + 3 - l, 2, 1, '#3a2a22'); R(9, ly + 3 - r, 2, 1, '#3a2a22');
    }
    // body
    const bh = ly - by;
    if (side) {
        R(5, by + bob, 6, bh, top); R(5, by + bob, 1, bh, topL); R(10, by + bob, 1, bh, topD);
        R(7 - step, by + 1 + bob, 2, bh - 2, topD);   // arm
        R(7 - step, by + bh - 1 + bob, 2, 1, sk);
    } else {
        R(4, by + bob, 8, bh, top); R(4, by + bob, 1, bh, topL); R(11, by + bob, 1, bh, topD);
        R(3, by + 1 + bob, 1, bh - 2, topD); R(12, by + 1 + bob, 1, bh - 2, topD);
        R(3, by + bh - 1 + bob, 1, 1, sk); R(12, by + bh - 1 + bob, 1, 1, sk);
        if (!back) { R(7, by + bob, 2, 1, skD); }
    }
    if (dress) R(side ? 5 : 4, ly - 2, side ? 6 : 8, 3, bot);
    if (L.acc === 'apron' && !back) R(side ? 6 : 5, by + 2 + bob, side ? 4 : 6, bh - 1, '#f2efe2');
    if (L.satchel) {
        if (back) R(5, by + 3 + bob, 6, 4, '#8a5a32');
        else if (side) R(dir === 'left' ? 9 : 4, by + 3 + bob, 3, 4, '#8a5a32');
        else { R(10, by + 3 + bob, 3, 4, '#8a5a32'); px(10, by + 1 + bob, '#8a5a32'); px(9, by + bob, '#8a5a32'); }
    }
    if (L.scarf) R(side ? 5 : 4, by + bob, side ? 6 : 8, 2, L.scarf);
    if (L.acc === 'scarf') R(side ? 5 : 4, by + bob, side ? 6 : 8, 2, '#c0392b');

    // head
    const hb = bob;
    if (side) {
        R(5, hy + hb, 7, 8, sk); R(5, hy + 7 + hb, 7, 1, skD);
        px(11, hy + 4 + hb, sk); px(12, hy + 5 + hb, sk);           // nose
        px(10, hy + 4 + hb, '#2a1e1e');                              // eye
        px(9, hy + 6 + hb, '#e09a8a');
    } else {
        R(4, hy + hb, 8, 8, sk); R(4, hy + 7 + hb, 8, 1, skD);
        if (!back) {
            px(6, hy + 4 + hb, '#2a1e1e'); px(9, hy + 4 + hb, '#2a1e1e');
            px(5, hy + 6 + hb, '#eaa090'); px(10, hy + 6 + hb, '#eaa090');
            px(7, hy + 6 + hb, skD); px(8, hy + 6 + hb, skD);
        }
    }
    // hair
    const hs = L.hair || 'short';
    if (hs !== 'bald') {
        if (back) { R(4, hy + hb, 8, 6, hc); R(4, hy + hb, 8, 1, hcL); }
        else if (side) { R(5, hy + hb, 7, 3, hc); R(5, hy + 3 + hb, 3, 3, hc); R(5, hy + hb, 7, 1, hcL); }
        else {
            R(4, hy + hb, 8, 3, hc); R(4, hy + 3 + hb, 1, 3, hc); R(11, hy + 3 + hb, 1, 3, hc); R(5, hy + hb, 6, 1, hcL);
            if (hs === 'curly') { px(6, hy + 3 + hb, hc); px(9, hy + 3 + hb, hc); }
            else px(7, hy + 3 + hb, hc);
        }
        if (hs === 'curly') { R(3, hy + 1 + hb, 1, 4, hcD); R(12, hy + 1 + hb, 1, 4, hcD); R(5, hy - 1 + hb, 6, 1, hc); }
        if (hs === 'bun') R(6, hy - 2 + hb, 4, 3, hc);
        if (long && !back) { R(side ? 5 : 3, hy + 3 + hb, side ? 2 : 2, 7, hc); if (!side) R(11, hy + 3 + hb, 2, 7, hc); }
    } else {
        if (!side) { R(4, hy + 3 + hb, 1, 2, hc); R(11, hy + 3 + hb, 1, 2, hc); } else R(5, hy + 3 + hb, 2, 2, hc);
    }
    if (L.acc === 'beard' && !back) R(side ? 8 : 5, hy + 5 + hb, side ? 4 : 6, 4, L.hc === '#cfc6b8' || L.hair === 'bald' ? '#e8e4dc' : hc);
    if (L.acc === 'glasses' && !back) {
        if (side) { px(9, hy + 4 + hb, '#cfd8e8'); px(10, hy + 3 + hb, '#3a3a4a'); px(11, hy + 4 + hb, '#3a3a4a'); }
        else { R(5, hy + 3 + hb, 3, 3, '#3a3a4a'); R(8, hy + 3 + hb, 3, 3, '#3a3a4a'); px(6, hy + 4 + hb, '#d8e4f4'); px(9, hy + 4 + hb, '#d8e4f4'); }
    }
    // hats
    hat(P, L.hat, side, back, hy + hb, hc);
    if (L.acc === 'staff') { R(side ? 12 : 13, hy + 2, 1, 16, '#8a6a3a'); px(side ? 12 : 13, hy + 1, '#6a4a2a'); }
}

function hat(P, h, side, back, hy, hc) {
    const { R, px } = P;
    switch (h) {
        case 'top': R(4, hy - 1, 8, 1, '#1e1e26'); R(5, hy - 6, 6, 5, '#2a2a34'); R(5, hy - 2, 6, 1, '#8a2a2a'); break;
        case 'witch': R(3, hy, 10, 1, '#2a2a34'); R(5, hy - 3, 6, 3, '#2a2a34'); R(6, hy - 5, 4, 2, '#2a2a34'); R(7, hy - 6, 2, 1, '#2a2a34'); R(5, hy - 1, 6, 1, '#6a3a8a'); break;
        case 'crown': R(4, hy - 2, 8, 2, '#e8c040'); px(4, hy - 3, '#e8c040'); px(7, hy - 3, '#e8c040'); px(11, hy - 3, '#e8c040'); px(7, hy - 2, '#c0392b'); break;
        case 'tiara': R(5, hy - 1, 6, 1, '#e8c040'); px(7, hy - 2, '#8de0ff'); break;
        case 'cap': R(4, hy - 1, 8, 2, '#3a5a8a'); if (!back) R(side ? 10 : 4, hy + 1, side ? 3 : 8, 1, '#2a4a7a'); break;
        case 'straw': R(2, hy, 12, 1, '#e0c070'); R(4, hy - 2, 8, 2, '#e8cc80'); R(4, hy - 1, 8, 1, '#c0392b'); break;
        case 'hood': R(3, hy - 1, 10, 4, '#3a6a3a'); R(3, hy + 3, 1, 5, '#3a6a3a'); R(12, hy + 3, 1, 5, '#3a6a3a'); if (back) R(4, hy, 8, 8, '#3a6a3a'); break;
        case 'bonnet': R(3, hy - 1, 10, 3, '#f2c0d0'); R(3, hy + 2, 1, 3, '#f2c0d0'); R(12, hy + 2, 1, 3, '#f2c0d0'); break;
        case 'beret': R(4, hy - 2, 9, 2, '#8a2a4a'); px(8, hy - 3, '#8a2a4a'); break;
        case 'chef': R(4, hy - 1, 8, 1, '#f2efe2'); R(4, hy - 5, 8, 4, '#ffffff'); R(3, hy - 4, 10, 2, '#ffffff'); break;
        case 'plume': R(4, hy - 2, 8, 2, '#3a3a5a'); R(10, hy - 6, 2, 4, '#e05a5a'); px(9, hy - 6, '#e05a5a'); break;
        case 'captain': R(3, hy - 1, 10, 2, '#1e2a4a'); R(4, hy - 3, 8, 2, '#1e2a4a'); px(7, hy - 2, '#e8c040'); break;
        case 'beanie': R(4, hy - 2, 8, 3, '#c0392b'); px(7, hy - 3, '#f2efe2'); px(8, hy - 3, '#f2efe2'); R(4, hy, 8, 1, '#f2efe2'); break;
        case 'helm': R(4, hy - 1, 8, 4, '#9aa3b5'); if (!back) R(4, hy + 3, 8, 1, '#6a7385'); break;
        default: break;
    }
    void hc; void side;
}

function drawKnight(P, L, dir, fr) {
    drawHuman(P, { skin: '#d8b090', hair: 'short', hc: '#3a2a1a', top: L.top || '#9aa3b5', bottom: L.bottom || '#3a5a9a', hat: 'helm', dress: false }, dir, fr, false);
    const { R } = P;
    const back = dir === 'up', side = dir === 'left' || dir === 'right';
    if (!back && !side) { R(4, 13, 8, 1, '#3a3a4a'); R(4, 15, 8, 1, shade(L.bottom || '#3a5a9a', 0.1)); R(6, 15, 4, 4, L.bottom || '#3a5a9a'); }
    if (!back) R(side ? 11 : 13, 9, 1, 12, '#c8ccd8');
}

function drawMouse(P, L, dir, fr) {
    const { R, px } = P;
    const fur = '#a89a90', furD = '#7a6e66', pink = '#f0a0a8';
    const side = dir === 'left' || dir === 'right', back = dir === 'up';
    const bob = fr ? 1 : 0;
    // tail
    if (!back) { R(side ? 3 : 12, 21, 3, 1, pink); px(side ? 2 : 14, 20, pink); }
    else R(7, 22, 2, 2, pink);
    // body
    R(5, 15 + bob, 6, 7, L.top || '#5a7aaa'); R(5, 15 + bob, 1, 7, shade(L.top || '#5a7aaa', 0.2));
    R(5, 22, 2, 2, furD); R(9, 22, 2, 2, furD);
    // head
    R(4, 9 + bob, 8, 7, fur); R(4, 15 + bob, 8, 1, furD);
    // ears
    R(2, 6 + bob, 4, 4, fur); R(10, 6 + bob, 4, 4, fur); R(3, 7 + bob, 2, 2, pink); R(11, 7 + bob, 2, 2, pink);
    if (!back) {
        px(side ? 9 : 6, 12 + bob, '#1a1a1a'); if (!side) px(9, 12 + bob, '#1a1a1a');
        px(side ? 12 : 7, 14 + bob, pink); if (!side) px(8, 14 + bob, pink);
        if (side) R(11, 13 + bob, 2, 2, fur);
    }
    if (L.acc === 'glasses' && !back) { R(5, 11 + bob, 3, 3, '#3a3a4a'); R(8, 11 + bob, 3, 3, '#3a3a4a'); px(6, 12 + bob, '#d8e4f4'); px(9, 12 + bob, '#d8e4f4'); }
    hat(P, L.hat, side, back, 9 + bob, fur);
}

function drawCat(P, L, dir, fr) {
    const { R, px } = P;
    const c = L.top || '#e8913a', cD = shade(c, -0.25), cL = shade(c, 0.25);
    const bob = fr ? 1 : 0;
    // sitting cat
    R(4, 15, 8, 8, c); R(4, 15, 1, 8, cL); R(11, 15, 1, 8, cD);
    R(5, 9 + bob, 7, 6, c);
    px(5, 8 + bob, c); px(6, 7 + bob, c); px(10, 8 + bob, c); px(11, 7 + bob, c);
    R(6, 17, 1, 4, cD); R(8, 17, 1, 4, cD);
    R(12, 19, 3, 2, c); px(14, 18, c);
    if (dir !== 'up') { px(7, 11 + bob, '#2a3a1a'); px(10, 11 + bob, '#2a3a1a'); px(8, 13 + bob, '#f0a0a8'); }
    R(5, 22, 7, 1, cD);
}

function drawGhost(P, L, dir, fr) {
    const { R, px } = P;
    const c = L.top || '#dcd8ff', cD = shade(c, -0.2);
    const bob = fr === 1 ? -1 : fr === 2 ? 1 : 0;
    R(4, 7 + bob, 8, 12, c); R(5, 6 + bob, 6, 1, c); R(3, 9 + bob, 1, 9, cD); R(12, 9 + bob, 1, 9, cD);
    for (let x = 4; x < 12; x += 2) R(x, 19 + bob, 1, 2, c);
    if (dir !== 'up') { px(6, 10 + bob, '#3a3060'); px(9, 10 + bob, '#3a3060'); R(7, 13 + bob, 2, 1, '#8a84c8'); }
    R(4, 7 + bob, 1, 2, '#ffffff');
}

function drawSnowman(P) {
    const { disc, R, px } = P;
    disc(8, 18, 5, '#f4f8ff'); disc(8, 10, 4, '#eef4fc'); disc(8, 4, 3, '#ffffff');
    px(7, 3, '#1a1a1a'); px(9, 3, '#1a1a1a'); R(9, 5, 3, 1, '#e8823a');
    px(8, 9, '#1a1a1a'); px(8, 12, '#1a1a1a'); R(2, 9, 3, 1, '#6a4a2a'); R(12, 9, 3, 1, '#6a4a2a');
}

function drawHeron(P, L, dir, fr) {
    const { R, px } = P;
    R(7, 15, 1, 8, '#8a7a5a'); R(9, 15, 1, 8, '#8a7a5a');
    R(5, 9, 7, 6, '#b8c4cc'); R(5, 13, 7, 2, '#8a9aa4');
    R(9, 3, 2, 7, '#c8d4dc'); R(9, 2, 3, 2, '#d8e4ec'); R(12, 3, 3, 1, '#e0b040'); px(10, 2, '#1a1a1a');
    R(8, 1, 3, 1, '#3a4a5a');
}

function drawScarecrow(P) {
    const { R, px } = P;
    R(7, 8, 2, 16, '#7a5a32'); R(2, 11, 12, 2, '#7a5a32');
    R(4, 11, 8, 7, '#8a5a3a'); R(4, 17, 8, 1, '#e0c070');
    R(5, 4, 6, 6, '#e8d8a8'); px(6, 6, '#2a1e1e'); px(9, 6, '#2a1e1e'); R(7, 8, 2, 1, '#2a1e1e');
    R(3, 3, 10, 1, '#c0a050'); R(5, 1, 6, 2, '#d0b060');
    R(5, 12, 2, 2, '#e8d8a8');
}

export function wickFrame(t, size = 1) {
    // a little flame with a face; t in [0, 1)
    const key = 'wick:' + Math.floor(t * 6) + ':' + size;
    if (cache.has(key)) return cache.get(key);
    const { c, g } = canvas(14, 16);
    const P = painter(g);
    const f = Math.floor(t * 6);
    const sway = [0, 1, 1, 0, -1, -1][f];
    const outer = '#ff7a2a', mid = '#ffb03a', inner = '#ffe58a';
    P.ellipse(7, 10, 5, 5, outer);
    for (let y = 1; y < 7; y++) { const w = Math.max(0, Math.round((y - 1) * 0.7)); P.R(7 - w + Math.round(sway * (7 - y) / 6), y, w * 2 + 1, 1, outer); }
    P.ellipse(7, 11, 3, 3, mid);
    P.R(6 + Math.round(sway * 0.5), 5, 2, 3, mid);
    P.ellipse(7, 12, 2, 2, inner);
    // face
    P.px(5, 10, '#5a2a1a'); P.px(9, 10, '#5a2a1a');
    P.px(5, 9, '#fff4d0'); P.px(9, 9, '#fff4d0');
    P.R(6, 12, 3, 1, '#c0502a');
    outline(c, '#7a2a10');
    cache.set(key, c);
    return c;
}

/** A person's frame: look, facing, walk frame 0..2. Cached. */
export function personFrame(look, dir, fr, id = '') {
    const key = 'p:' + (id || JSON.stringify(look)) + ':' + dir + ':' + fr;
    if (cache.has(key)) return cache.get(key);
    const mirror = dir === 'right';
    const d = mirror ? 'left' : dir;
    const { c, g } = canvas(CW, CH);
    const P = painter(g);
    const k = look.k || 'human';
    if (k === 'human') drawHuman(P, look, d, fr, false);
    else if (k === 'kid') drawHuman(P, look, d, fr, true);
    else if (k === 'knight') drawKnight(P, look, d, fr);
    else if (k === 'mouse') drawMouse(P, look, d, fr);
    else if (k === 'cat') drawCat(P, look, d, fr);
    else if (k === 'ghost') drawGhost(P, look, d, fr);
    else if (k === 'snowman') drawSnowman(P, look, d, fr);
    else if (k === 'heron') drawHeron(P, look, d, fr);
    else if (k === 'scarecrow') drawScarecrow(P, look, d, fr);
    outline(c, OUT);
    const out = mirror ? flipped(c) : c;
    cache.set(key, out);
    return out;
}

// ------------------------------------------------------------------ foes
// A foe's frame: f is 0 or 1 (an idle bob or a flap). size: base pixel size.

const EMB = {
    sun(P, cx, cy, c) { P.disc(cx, cy, 3, c); for (let a = 0; a < 8; a++) P.px(cx + Math.round(Math.cos(a * 0.785) * 5), cy + Math.round(Math.sin(a * 0.785) * 5), c); },
    swirl(P, cx, cy, c) { for (let a = 0; a < 14; a++) { const r = 1 + a * 0.35; P.px(cx + Math.round(Math.cos(a * 0.8) * r), cy + Math.round(Math.sin(a * 0.8) * r), c); } },
    flame(P, cx, cy, c) { P.ellipse(cx, cy + 1, 3, 3, c); P.R(cx - 1, cy - 4, 2, 3, c); P.px(cx, cy - 5, c); },
    stone(P, cx, cy, c) { P.ellipse(cx, cy, 4, 3, c); P.px(cx - 1, cy - 1, shade(c, 0.3)); },
    flake(P, cx, cy, c) { for (let i = -4; i <= 4; i++) { P.px(cx + i, cy, c); P.px(cx, cy + i, c); P.px(cx + i, cy + i, c); P.px(cx + i, cy - i, c); } },
    wave(P, cx, cy, c) { for (let x = -5; x <= 5; x++) { P.px(cx + x, cy + Math.round(Math.sin(x * 0.9) * 2), c); P.px(cx + x, cy + 2 + Math.round(Math.sin(x * 0.9) * 2), c); } },
    mouse(P, cx, cy, c) { P.disc(cx, cy + 1, 3, c); P.disc(cx - 3, cy - 2, 1, c); P.disc(cx + 3, cy - 2, 1, c); },
    leaf(P, cx, cy, c) { P.ellipse(cx, cy, 2, 4, c); P.line(cx, cy - 4, cx, cy + 4, shade(c, -0.3)); },
    ripple(P, cx, cy, c) { for (let r = 1; r <= 4; r += 2) for (let a = 0; a < 12; a++) P.px(cx + Math.round(Math.cos(a * 0.52) * r), cy + Math.round(Math.sin(a * 0.52) * r), c); },
    key(P, cx, cy, c) { P.disc(cx - 2, cy, 2, c); P.R(cx, cy, 5, 1, c); P.px(cx + 3, cy + 1, c); P.px(cx + 4, cy + 1, c); },
    feather(P, cx, cy, c) { P.line(cx - 3, cy + 4, cx + 3, cy - 4, c); for (let i = -2; i <= 2; i++) { P.px(cx + i - 1, cy - i - 1, c); P.px(cx + i + 1, cy - i + 1, c); } },
    star(P, cx, cy, c) { P.R(cx - 1, cy - 4, 2, 8, c); P.R(cx - 4, cy - 1, 8, 2, c); P.R(cx - 2, cy - 2, 4, 4, c); },
};

function eyesAt(P, list, close = false) {
    for (const [x, y] of list) {
        if (close) { P.R(x - 1, y, 3, 1, '#1a1420'); continue; }
        P.R(x - 1, y - 1, 3, 3, '#ffffff'); P.px(x, y, '#1a1420'); P.px(x - 1, y - 1, '#ffffff');
    }
}

function drawFoe(P, look, f, S) {
    const c = look.c, cD = shade(c, -0.3), cL = shade(c, 0.25), c2 = look.c2 || shade(c, 0.4);
    const b = f ? 1 : 0;
    const mid = S / 2;
    switch (look.body) {
        case 'book': case 'bigbook': {
            const big = look.body === 'bigbook';
            const w = Math.round(S * 0.62), h = Math.round(S * 0.7);
            const x0 = Math.round(mid - w / 2), y0 = Math.round(S * 0.18) + b;
            // flapping covers
            const flap = f ? 2 : 0;
            P.R(x0 - 3 - flap, y0 + 2, 4, h - 4, cD);
            P.R(x0 + w - 1 + flap, y0 + 2, 4, h - 4, cD);
            P.R(x0, y0, w, h, c); P.R(x0, y0, w, 2, cL); P.R(x0, y0 + h - 2, w, 2, cD);
            P.R(x0 + 2, y0 + 2, 2, h - 4, shade(c, -0.15));   // spine
            P.R(x0 + w - 2, y0 + 2, 2, h - 4, '#f2ead6');        // page edges
            for (let y = y0 + 3; y < y0 + h - 2; y += 2) P.px(x0 + w - 1, y, '#d8ccb0');
            if (look.emblem && EMB[look.emblem]) EMB[look.emblem](P, Math.round(mid + 1), y0 + Math.round(h * 0.62), big ? '#fff4c0' : c2);
            if (look.thorns) for (let i = 0; i < 6; i++) { const tx = x0 + 2 + Math.round(nz(i, 1) * (w - 4)); P.px(tx, y0 - 1, '#2f5a22'); P.px(tx, y0 + h, '#2f5a22'); P.px(x0 - 1, y0 + 3 + i * 2, '#3a6a2a'); }
            const ey = y0 + Math.round(h * (big ? 0.3 : 0.32));
            const n = look.eyes || 2;
            const es = [];
            for (let i = 0; i < n; i++) es.push([Math.round(x0 + w * (n === 1 ? 0.55 : 0.3 + 0.45 * i / (n - 1))) + 1, ey]);
            eyesAt(P, es);
            if (big) { P.R(Math.round(mid) - 2, ey + 4, 6, 1, '#1a1420'); }
            break;
        }
        case 'fluff': {
            P.ellipse(mid, S * 0.62 + b, S * 0.36, S * 0.3, c);
            for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; P.px(mid + Math.cos(a) * S * 0.38, S * 0.62 + b + Math.sin(a) * S * 0.32, cL); }
            P.ellipse(mid - 4, S * 0.24 + b, 2, 4, c); P.ellipse(mid + 4, S * 0.24 + b, 2, 4, c);
            P.px(mid - 4, S * 0.24 + b, '#f0a0a8'); P.px(mid + 4, S * 0.24 + b, '#f0a0a8');
            eyesAt(P, [[mid - 3, S * 0.56 + b], [mid + 3, S * 0.56 + b]]);
            P.px(mid, S * 0.68 + b, '#f0a0a8');
            break;
        }
        case 'moth': case 'bat': case 'crane': case 'bird': {
            const wy = f ? -3 : 2;
            const wc = look.body === 'bat' ? c : c;
            // wings
            for (let i = 0; i < 7; i++) {
                const yy = Math.round(S * 0.42 + wy * (i / 7) + i * 0.4);
                P.R(mid - 3 - i, yy, 1, Math.max(2, 8 - i), i % 2 ? wc : shade(wc, -0.1));
                P.R(mid + 3 + i, yy, 1, Math.max(2, 8 - i), i % 2 ? wc : shade(wc, -0.1));
            }
            if (look.body === 'moth') { P.px(mid - 6, S * 0.5, c2); P.px(mid + 6, S * 0.5, c2); }
            if (look.body === 'bat') for (let i = 0; i < 6; i++) { P.px(mid - 4 - i, S * 0.42 + wy * 0.5 + 6, c2); P.px(mid + 4 + i, S * 0.42 + wy * 0.5 + 6, c2); }
            // body
            P.ellipse(mid, S * 0.55, 3, look.body === 'crane' ? 3 : 5, look.body === 'bat' ? shade(c, -0.15) : c2);
            if (look.body === 'crane' || look.body === 'bird') { P.R(mid + 2, S * 0.3, 2, 6, c); P.R(mid + 3, S * 0.26, 4, 3, c); P.R(mid + 7, S * 0.28, 3, 1, c2); }
            if (look.body === 'bird') { P.R(mid - 1, S * 0.82, 1, 3, '#e0a040'); P.R(mid + 1, S * 0.82, 1, 3, '#e0a040'); }
            const ey = look.body === 'crane' || look.body === 'bird' ? S * 0.28 : S * 0.48;
            eyesAt(P, look.eyes === 1 ? [[mid + 5, ey]] : [[mid - 1, ey], [mid + 2, ey]]);
            if (look.body === 'moth') { P.line(mid - 1, S * 0.4, mid - 3, S * 0.25, cD); P.line(mid + 1, S * 0.4, mid + 3, S * 0.25, cD); }
            if (look.body === 'bat') { P.px(mid - 2, S * 0.38, c); P.px(mid + 2, S * 0.38, c); }
            break;
        }
        case 'blob': case 'theblot': {
            const big = look.body === 'theblot';
            const ry = S * (big ? 0.34 : 0.3) - (f ? 1 : 0), rx = S * (big ? 0.44 : 0.36) + (f ? 1 : 0);
            P.ellipse(mid, S * 0.62, rx, ry, c);
            for (let i = 0; i < (big ? 9 : 4); i++) P.ellipse(mid - rx + 3 + nz(i, 7) * rx * 1.8, S * 0.62 + ry - 1, 2, 3, c);
            if (big) for (let i = 0; i < 7; i++) P.R(mid - rx + 2 + nz(i, 9) * rx * 1.8, S * 0.25 + nz(i, 3) * 8, 2, 8 + nz(i, 4) * 6, c);
            P.ellipse(mid - rx * 0.4, S * 0.5, 3, 2, c2);
            const n = look.eyes || 2;
            const es = [];
            for (let i = 0; i < n; i++) es.push([Math.round(mid - rx * 0.5 + rx * (n === 1 ? 0.5 : i / (n - 1))), Math.round(S * 0.56 + (i % 2) * (big ? 5 : 0))]);
            eyesAt(P, es);
            break;
        }
        case 'worm': case 'serpent': {
            const seg = look.body === 'serpent' ? 7 : 5;
            for (let i = seg - 1; i >= 0; i--) {
                const x = mid - 8 + i * 3, y = S * 0.66 + Math.round(Math.sin(i * 1.1 + f * 1.5) * 2);
                P.disc(x, y, 3, i % 2 ? c : shade(c, -0.1));
                if (look.body === 'serpent') P.px(x, y - 2, c2);
            }
            const hx = mid - 8 + (seg - 1) * 3 + 1, hy = S * 0.66 + Math.round(Math.sin((seg - 1) * 1.1 + f * 1.5) * 2) - 2;
            P.disc(hx, hy, 4, c);
            eyesAt(P, [[hx - 1, hy - 1], [hx + 2, hy - 1]]);
            if (look.specs) { P.R(hx - 3, hy - 2, 3, 3, '#3a3a4a'); P.R(hx + 1, hy - 2, 3, 3, '#3a3a4a'); P.px(hx - 2, hy - 1, '#e0eaff'); P.px(hx + 2, hy - 1, '#e0eaff'); }
            if (look.body === 'serpent') { P.R(mid - 9, S * 0.5, 4, 3, c2); P.disc(mid - 7, S * 0.62, 2, '#c0392b'); }
            break;
        }
        case 'cloud': {
            const o = f ? 1 : 0;
            P.ellipse(mid - 4, S * 0.58 + o, 5, 4, c); P.ellipse(mid + 4, S * 0.58 - o, 5, 4, c); P.ellipse(mid, S * 0.46, 6, 5, cL);
            for (let i = 0; i < 3; i++) P.R(mid - 5 + i * 4, S * 0.72, 2, 4 + i % 2 * 2, shade(c, -0.1));
            eyesAt(P, [[mid - 2, S * 0.5], [mid + 3, S * 0.5]]);
            break;
        }
        case 'tortoise': {
            P.ellipse(mid, S * 0.56 + b, 8, 6, c);
            P.R(mid - 7, S * 0.5 + b, 14, 2, c2);
            for (let x = -6; x <= 6; x += 3) P.px(mid + x, S * 0.44 + b, cL);
            P.R(mid - 7, S * 0.72, 3, 3, '#8a9a5a'); P.R(mid + 5, S * 0.72, 3, 3, '#8a9a5a');
            P.disc(mid + 9, S * 0.58 + b, 3, '#9aaa6a');
            eyesAt(P, [[mid + 10, S * 0.55 + b]]);
            break;
        }
        case 'flame': {
            const sw = f ? 1 : -1;
            P.ellipse(mid, S * 0.62, 6, 6, c);
            for (let y = 0; y < 8; y++) { const w = Math.round(y * 0.7); P.R(mid - w + Math.round(sw * (8 - y) / 4), S * 0.22 + y, w * 2 + 1, 1, c); }
            P.ellipse(mid, S * 0.66, 4, 4, c2);
            eyesAt(P, [[mid - 2, S * 0.58], [mid + 2, S * 0.58]]);
            P.R(mid - 1, S * 0.72, 3, 1, '#7a2a10');
            break;
        }
        case 'flake': {
            const r = 7 + (f ? 1 : 0);
            for (let a = 0; a < 6; a++) { const ang = a * Math.PI / 3 + (f ? 0.2 : 0); P.line(mid, S * 0.5, mid + Math.cos(ang) * r, S * 0.5 + Math.sin(ang) * r, a % 2 ? c : c2); }
            P.disc(mid, S * 0.5, 3, c);
            eyesAt(P, [[mid - 1, S * 0.5], [mid + 2, S * 0.5]]);
            break;
        }
        case 'crab': {
            P.ellipse(mid, S * 0.6 + b, 7, 5, c);
            P.R(mid - 5, S * 0.5 + b, 10, 3, c2);   // the chart
            P.line(mid - 6, S * 0.55 + b, mid - 10, S * 0.45, c); P.disc(mid - 10, S * 0.4 - (f ? 1 : 0), 2, c);
            P.line(mid + 6, S * 0.55 + b, mid + 10, S * 0.45, c); P.disc(mid + 10, S * 0.4 + (f ? 1 : 0), 2, c);
            for (let i = 0; i < 3; i++) { P.px(mid - 5 + i * 2, S * 0.75, cD); P.px(mid + 1 + i * 2, S * 0.75, cD); }
            P.R(mid - 3, S * 0.38 + b, 1, 3, cD); P.R(mid + 2, S * 0.38 + b, 1, 3, cD);
            eyesAt(P, [[mid - 3, S * 0.37 + b], [mid + 2, S * 0.37 + b]]);
            break;
        }
        case 'frog': {
            P.ellipse(mid, S * 0.64 + b, 8, 6, c);
            P.R(mid - 6, S * 0.58 + b, 12, 4, c2);      // lily-pad pages
            P.disc(mid - 4, S * 0.42 + b, 3, c); P.disc(mid + 4, S * 0.42 + b, 3, c);
            eyesAt(P, [[mid - 4, S * 0.42 + b], [mid + 4, S * 0.42 + b]]);
            P.R(mid - 3, S * 0.56 + b, 6, 1, cD);
            break;
        }
        case 'tiny': {
            P.disc(mid, S * 0.62 + b * 2, 5, c);
            P.R(mid - 4, S * 0.5 + b * 2, 8, 1, '#f2ead6');
            P.px(mid, S * 0.36 + b * 2, c); P.px(mid, S * 0.33 + b * 2, '#ffd86b');
            eyesAt(P, [[mid - 2, S * 0.6 + b * 2], [mid + 2, S * 0.6 + b * 2]]);
            break;
        }
        case 'ghost': {
            P.ellipse(mid, S * 0.45 + b, 7, 7, c);
            P.R(mid - 7, S * 0.45 + b, 15, 7, c);
            for (let x = -7; x <= 7; x += 3) P.R(mid + x, S * 0.45 + 7 + b, 2, 2 + ((x + 8) % 2), c);
            for (let i = 0; i < 4; i++) P.R(mid - 5, S * 0.38 + i * 3 + b, 6 + (i % 2) * 3, 1, c2);
            eyesAt(P, [[mid - 3, S * 0.42 + b], [mid + 3, S * 0.42 + b]]);
            break;
        }
        case 'knight': {
            P.R(mid - 6, S * 0.3 + b, 12, 18, c); P.R(mid - 6, S * 0.3 + b, 12, 2, cL); P.R(mid - 6, S * 0.3 + 16 + b, 12, 2, cD);
            P.R(mid - 2, S * 0.18 + b, 4, 4, c2); P.R(mid - 1, S * 0.12 + b, 2, 3, c2);
            P.R(mid - 5, S * 0.38 + b, 10, 2, '#3a3a4a');
            eyesAt(P, [[mid, S * 0.39 + b]], true);
            P.R(mid + 7, S * 0.2, 1, 18, '#c8ccd8'); P.R(mid + 6, S * 0.56, 3, 1, '#8a6a3a');
            break;
        }
        case 'cat': {
            P.ellipse(mid, S * 0.62 + b, 8, 6, c);
            P.disc(mid + 5, S * 0.42 + b, 4, c); P.px(mid + 3, S * 0.3 + b, c); P.px(mid + 8, S * 0.3 + b, c);
            for (let i = 0; i < 6; i++) P.px(mid - 6 + nz(i, 2) * 12, S * 0.55 + nz(i, 5) * 8, c2);
            P.line(mid - 8, S * 0.62, mid - 11, S * 0.42 + (f ? -2 : 0), c);
            eyesAt(P, [[mid + 4, S * 0.42 + b], [mid + 7, S * 0.42 + b]]);
            break;
        }
        default: P.disc(mid, mid, S * 0.3, c); eyesAt(P, [[mid - 2, mid], [mid + 2, mid]]);
    }
}

/** A foe, size S × S. f: 0 or 1. */
export function foeFrame(look, f, S = 24) {
    const key = 'f:' + JSON.stringify(look) + ':' + f + ':' + S;
    if (cache.has(key)) return cache.get(key);
    const { c, g } = canvas(S, S);
    const P = painter(g);
    drawFoe(P, look, f, S);
    outline(c, OUT);
    cache.set(key, c);
    return c;
}

// ------------------------------------------------------------------ icons (12 × 12)
const ICON = {
    cup(P) { P.R(2, 4, 7, 5, '#f2efe2'); P.R(9, 5, 2, 3, '#f2efe2'); P.R(3, 5, 5, 2, '#c08a4a'); P.R(1, 9, 9, 1, '#d8d0c0'); P.px(4, 2, '#ffffff'); P.px(6, 1, '#ffffff'); },
    mug(P) { P.R(2, 3, 7, 7, '#c0503a'); P.R(9, 5, 2, 3, '#c0503a'); P.R(3, 4, 5, 2, '#6a3a1a'); P.px(4, 3, '#ffffff'); P.px(6, 3, '#ffffff'); },
    biscuit(P) { P.disc(6, 6, 4, '#d8a050'); P.px(4, 5, '#8a5a2a'); P.px(7, 4, '#8a5a2a'); P.px(6, 7, '#8a5a2a'); },
    tart(P) { P.ellipse(6, 7, 5, 3, '#d8a050'); P.ellipse(6, 6, 4, 2, '#e04a5a'); P.px(5, 5, '#ff9aa0'); },
    ink(P) { P.R(3, 4, 6, 6, '#2a2a4a'); P.R(4, 2, 4, 2, '#4a4a6a'); P.R(4, 5, 4, 2, '#4a5ab0'); },
    ink2(P) { P.R(4, 2, 4, 2, '#3a3a5a'); P.R(3, 4, 6, 7, '#14142a'); P.R(4, 6, 4, 3, '#6a5ae0'); P.px(5, 6, '#c0b0ff'); },
    sachet(P) { P.ellipse(6, 7, 4, 4, '#a08ac8'); P.R(5, 2, 2, 2, '#7a5aa0'); P.px(4, 7, '#d0c0f0'); },
    candle(P) { P.R(4, 4, 4, 7, '#f2e8c8'); P.px(6, 3, '#4a3a2a'); P.R(5, 1, 2, 2, '#ffb03a'); P.px(5, 1, '#ffe58a'); },
    mark(P, c) { P.R(4, 1, 4, 9, c || '#c0392b'); P.px(4, 10, c || '#c0392b'); P.px(7, 10, c || '#c0392b'); P.R(5, 2, 1, 6, shade(c || '#c0392b', 0.3)); },
    quill(P) { P.line(2, 10, 9, 2, '#f2efe2'); P.line(3, 9, 9, 3, '#ffb03a'); P.px(2, 10, '#3a3a4a'); },
    knit(P, c) { P.R(2, 3, 8, 7, c || '#3f7a5a'); P.R(1, 4, 1, 5, c || '#3f7a5a'); P.R(10, 4, 1, 5, c || '#3f7a5a'); P.R(5, 3, 2, 7, shade(c || '#3f7a5a', -0.3)); P.px(4, 6, '#e0c060'); P.px(7, 6, '#e0c060'); },
    glasses(P) { P.R(1, 5, 4, 3, '#3a3a4a'); P.R(7, 5, 4, 3, '#3a3a4a'); P.R(2, 6, 2, 1, '#cfe0f4'); P.R(8, 6, 2, 1, '#cfe0f4'); P.R(5, 5, 2, 1, '#3a3a4a'); },
    acorn(P) { P.ellipse(6, 7, 3, 4, '#a8743a'); P.R(3, 3, 7, 2, '#6a4a2a'); P.px(6, 1, '#6a4a2a'); },
    locket(P) { P.disc(6, 7, 3, '#e8c040'); P.px(6, 7, '#c0392b'); P.line(3, 1, 6, 4, '#c8b080'); P.line(9, 1, 6, 4, '#c8b080'); },
    feather(P) { P.line(3, 10, 9, 2, '#f2efe2'); for (let i = 0; i < 5; i++) { P.px(4 + i, 7 - i, '#c8c0b0'); P.px(6 + i, 9 - i, '#c8c0b0'); } },
    compass(P) { P.disc(6, 6, 4, '#c8a050'); P.disc(6, 6, 3, '#f2efe2'); P.px(6, 4, '#c0392b'); P.px(6, 5, '#c0392b'); P.px(6, 7, '#3a3a4a'); },
    box(P) { P.R(2, 5, 8, 6, '#a0603a'); P.R(2, 3, 8, 2, '#c08050'); P.px(6, 7, '#e8c040'); P.px(9, 1, '#3a3a4a'); P.px(10, 2, '#3a3a4a'); },
    patch(P) { P.R(2, 2, 8, 8, '#e0905a'); P.R(2, 2, 4, 4, '#5a9ad0'); P.R(6, 6, 4, 4, '#d0605a'); for (let i = 2; i < 10; i += 2) { P.px(i, 1, '#3a2a2a'); P.px(i, 10, '#3a2a2a'); } },
    inkwell(P) { P.R(2, 6, 8, 4, '#c8ccd8'); P.R(4, 3, 4, 3, '#a8acb8'); P.R(4, 6, 4, 1, '#2a2a4a'); P.line(8, 1, 10, 5, '#f2efe2'); },
    key(P) { P.disc(3, 6, 2, '#e8c040'); P.R(5, 6, 6, 1, '#e8c040'); P.px(9, 7, '#e8c040'); P.px(10, 7, '#e8c040'); },
    sack(P) { P.ellipse(6, 7, 4, 4, '#e8dcc0'); P.R(5, 2, 2, 2, '#c8b890'); P.R(4, 6, 4, 2, '#c8b890'); },
    letter(P) { P.R(1, 3, 10, 7, '#f2efe2'); P.line(1, 3, 6, 7, '#c8c0b0'); P.line(10, 3, 6, 7, '#c8c0b0'); P.px(6, 7, '#c0392b'); },
    cheese(P) { P.R(2, 5, 8, 5, '#f4e08a'); P.R(2, 4, 4, 1, '#f4e08a'); P.px(4, 7, '#d8c060'); P.px(7, 6, '#d8c060'); P.px(8, 9, '#ffffff'); },
    scroll(P) { P.R(2, 3, 8, 6, '#f2e8c8'); P.R(1, 2, 2, 8, '#d8c8a0'); P.R(9, 2, 2, 8, '#d8c8a0'); P.R(4, 5, 4, 1, '#8a7a5a'); },
    scarf(P) { P.R(1, 3, 10, 3, '#c0392b'); P.R(7, 6, 3, 5, '#c0392b'); P.px(2, 4, '#f2efe2'); P.px(8, 9, '#f2efe2'); },
    pearl(P) { P.disc(6, 6, 3, '#f0eef8'); P.px(5, 5, '#ffffff'); P.px(7, 8, '#c8c0e0'); },
    seeds(P) { P.R(3, 3, 6, 7, '#d8c8a0'); for (let i = 0; i < 4; i++) P.px(4 + (i % 2) * 3, 5 + Math.floor(i / 2) * 2, '#8de0ff'); },
    lens(P) { P.disc(6, 6, 4, '#8a8aa0'); P.disc(6, 6, 3, '#bfe6ff'); P.px(5, 5, '#ffffff'); },
    rope(P) { for (let i = 0; i < 10; i++) P.px(2 + Math.round(Math.sin(i) * 2) + (i > 5 ? 3 : 0), 1 + i, '#c8a060'); },
    pot(P) { P.ellipse(6, 7, 4, 3, '#f2efe2'); P.R(4, 3, 4, 1, '#f2efe2'); P.line(10, 6, 11, 4, '#f2efe2'); P.px(5, 7, '#e8913a'); P.px(7, 6, '#e8913a'); },
    book(P, c) { P.R(2, 1, 8, 10, c || '#8a5a3a'); P.R(3, 1, 1, 10, shade(c || '#8a5a3a', -0.3)); P.R(9, 2, 1, 8, '#f2ead6'); P.R(5, 4, 3, 1, shade(c || '#8a5a3a', 0.4)); },
    coin(P) { P.disc(6, 6, 4, '#e8c040'); P.disc(6, 6, 2, '#f4dc80'); P.px(6, 6, '#c8a030'); },
};

export function icon(name, colour = null, scale = 1) {
    const key = 'i:' + name + ':' + colour + ':' + scale;
    if (cache.has(key)) return cache.get(key);
    const { c, g } = canvas(12, 12);
    const P = painter(g);
    (ICON[name] || ICON.book)(P, colour);
    outline(c, OUT);
    let out = c;
    if (scale > 1) {
        const s = canvas(12 * scale, 12 * scale);
        s.g.imageSmoothingEnabled = false;
        s.g.drawImage(c, 0, 0, 12 * scale, 12 * scale);
        out = s.c;
    }
    cache.set(key, out);
    return out;
}

/** A book standing on a shelf, seen from the spine. */
export function spine(colour, h = 11, seed = 0) {
    const key = 'sp:' + colour + h + seed;
    if (cache.has(key)) return cache.get(key);
    const { c, g } = canvas(3, h);
    const P = painter(g);
    P.R(0, 0, 3, h, colour);
    P.R(0, 0, 1, h, shade(colour, 0.25));
    P.px(1, 2 + (seed % 3), mix(colour, '#ffe08a', 0.6));
    cache.set(key, c);
    return c;
}
