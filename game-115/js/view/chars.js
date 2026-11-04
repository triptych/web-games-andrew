// People, painted pixel by pixel into a strip of frames: idle, four walking, two working, one sitting.
// Heroes show their class and the tier of the armor and weapon they wear; villagers show a trade-ish
// outfit. A one-pixel ink outline is added at the end, which is most of what makes them read as sprites.

import { canvas, ctx2, INK } from './paint.js';

export const FW = 20, FH = 30, FRAMES = 8;
export const FRAME = { idle: 0, walk: 1, work: 5, sit: 7 };

const SKIN = ['#f6d3b4', '#e8b88f', '#c68b5e', '#8d5a3b'];
const HAIR = ['#3b2a20', '#6b4423', '#c8892f', '#e8d27a', '#b5482a', '#2e2e3a', '#d9d9e0', '#7b4fa0'];
const VILLAGER = [['#d9b45a', '#6f4e37'], ['#6aa5c8', '#5a4a3a'], ['#c8605a', '#4a4a5a'], ['#7bb661', '#6b5a45'], ['#b58ad0', '#554a60'], ['#e8e0cc', '#6a5a48']];
const ARMOR_TIER = ['#8e6a4b', '#8e6a4b', '#8a5a3a', '#9aa1ab', '#c5ccd6', '#c24a2e'];
const WEAPON_TIER = ['#7a5230', '#9b6b3a', '#a3a9b3', '#d6dde6', '#7fd4e8', '#ff8a3a'];

const shade = (c, k) => {
    const n = parseInt(c.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(n >> 16 & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

function drawFrame(g, ox, f, o) {
    const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(ox + x, y, w, h); };
    const walk = f >= 1 && f <= 4;
    const step = walk ? [0, 1, 2, 3, 2][f] : 0;           // 0 contact-left 1 pass 2 contact-right 3 pass
    const bob = walk && (f === 2 || f === 4) ? 1 : 0;
    const working = f === 5 || f === 6;
    const sit = f === 7;
    const skin = SKIN[o.skin % 4], hair = HAIR[o.hair % 8];
    const body = o.body, legc = o.legs, trim = o.trim;
    const yb = sit ? 4 : 0;                                  // everything above the legs sits lower
    // ---- legs
    if (sit) {
        px(6, 24, 4, 3, legc); px(11, 24, 4, 3, legc); px(5, 27, 5, 2, '#4a3426'); px(11, 27, 5, 2, '#4a3426');
    } else if (!o.longRobe) {
        const l1 = walk && f === 1 ? -1 : 0, l2 = walk && f === 3 ? -1 : 0;
        const dx1 = walk ? (f === 1 ? 1 : f === 3 ? -1 : 0) : 0;
        px(7 + dx1, 22 + l1, 3, 6 - l1, legc); px(11 - dx1, 22 + l2, 3, 6 - l2, legc);
        px(6 + dx1, 28 + l1, 4, 2, '#4a3426'); px(11 - dx1, 28 + l2, 4, 2, '#4a3426');
    } else {
        // long robe: feet peek out
        const sw = walk ? (f === 1 || f === 3 ? 1 : 0) : 0;
        px(7 + sw, 28, 3, 2, '#4a3426'); px(11 - sw, 28, 3, 2, '#4a3426');
    }
    // ---- cape behind
    if (o.cape) { px(5, 14 + yb - bob, 10, o.longRobe ? 9 : 12, o.cape); px(4, 15 + yb - bob, 1, 9, shade(o.cape, 0.7)); }
    // ---- torso
    const ty = 14 + yb - bob;
    px(6, ty, 8, o.longRobe ? 14 - yb : 8, body);
    px(6, ty, 8, 2, shade(body, 1.18));
    px(6, ty + (o.longRobe ? 13 - yb : 7), 8, 1, shade(body, 0.78));
    if (!o.longRobe) px(6, ty + 6, 8, 1, o.belt || '#5a3d28');
    if (trim) { px(9, ty, 2, o.longRobe ? 13 - yb : 7, trim); }
    if (o.shoulders) { px(5, ty, 2, 2, o.shoulders); px(13, ty, 2, 2, o.shoulders); }
    if (o.quiver) { px(14, ty - 3, 2, 8, '#6b4423'); px(14, ty - 4, 1, 1, '#d6c7a0'); px(15, ty - 5, 1, 1, '#d6c7a0'); }
    if (o.scarf) px(6, ty - 1, 8, 2, o.scarf);
    // ---- arms
    const swing = walk ? (f === 1 ? 1 : f === 3 ? -1 : 0) : 0;
    const armC = o.sleeve || body;
    if (working) {
        const up = f === 5 ? 0 : 3;
        px(4, ty - 4 + up, 2, 8 - up, armC); px(14, ty - 4 + up, 2, 8 - up, armC);
        px(4, ty - 5 + up, 2, 2, skin); px(14, ty - 5 + up, 2, 2, skin);
        px(15, ty - 10 + up, 1, 7, o.weaponColor || '#9b6b3a'); px(14, ty - 11 + up, 3, 2, '#b8bec8');
    } else if (sit) {
        px(4, ty + 1, 2, 5, armC); px(14, ty + 1, 2, 5, armC); px(4, ty + 6, 2, 2, skin); px(14, ty + 6, 2, 2, skin);
    } else {
        px(4, ty + 1 + swing, 2, 6, armC); px(14, ty + 1 - swing, 2, 6, armC);
        px(4, ty + 7 + swing, 2, 2, skin); px(14, ty + 7 - swing, 2, 2, skin);
        // the weapon, held on the right
        if (o.weapon === 'sword') { px(16, ty + 1 - swing, 1, 8, o.weaponColor); px(15, ty + 8 - swing, 3, 1, '#7a5230'); }
        else if (o.weapon === 'bow') { px(16, ty - 3, 1, 12, '#8a5a3a'); px(17, ty - 2, 1, 1, '#8a5a3a'); px(17, ty + 8, 1, 1, '#8a5a3a'); px(17, ty - 1, 1, 10, '#e8e0cc'); }
        else if (o.weapon === 'staff') { px(16, ty - 8, 1, 17, '#8a5a3a'); px(15, ty - 10, 3, 3, o.weaponColor); px(16, ty - 11, 1, 1, '#ffffff'); }
        else if (o.weapon === 'dagger') { px(16, ty + 4 - swing, 1, 4, o.weaponColor); px(15, ty + 7 - swing, 3, 1, '#5a3d28'); }
        else if (o.weapon === 'mace') { px(16, ty + 1 - swing, 1, 8, '#8a5a3a'); px(15, ty - 1 - swing, 3, 3, o.weaponColor); }
        else if (o.weapon === 'basket') { px(15, ty + 6 - swing, 4, 3, '#a8763a'); px(15, ty + 5 - swing, 4, 1, '#d9b45a'); }
    }
    // ---- head
    const hy = 4 + yb - bob;
    px(5, hy, 10, 9, skin);
    px(5, hy + 8, 10, 1, shade(skin, 0.85));
    px(7, hy + 5, 1, 2, '#2a1a14'); px(12, hy + 5, 1, 2, '#2a1a14');
    px(6, hy + 7, 2, 1, '#e8908a'); px(12, hy + 7, 2, 1, '#e8908a');
    px(9, hy + 7, 2, 1, shade(skin, 0.7));
    // ---- hair
    const hs = o.style % 4;
    if (!o.hideHair) {
        px(5, hy - 1, 10, 3, hair); px(4, hy, 1, 4, hair); px(15, hy, 1, 4, hair);
        if (hs === 1) { px(4, hy + 3, 2, 9, hair); px(14, hy + 3, 2, 9, hair); }
        else if (hs === 2) { px(8, hy - 3, 4, 3, hair); px(7, hy - 2, 6, 1, hair); }
        else if (hs === 3) { px(15, hy + 2, 2, 8, hair); px(16, hy + 9, 2, 3, hair); }
        else { px(5, hy + 2, 3, 2, hair); px(12, hy + 2, 3, 2, hair); }
        px(5, hy + 2, 10, 1, shade(hair, 0.8));
    }
    // ---- hats
    const hat = o.hat;
    if (hat === 'helm') { px(4, hy - 2, 12, 5, '#b8bec8'); px(4, hy - 2, 12, 1, '#e6ebf2'); px(9, hy - 5, 2, 4, '#c24a3a'); px(4, hy + 3, 2, 3, '#a3a9b3'); px(14, hy + 3, 2, 3, '#a3a9b3'); }
    else if (hat === 'hood') { px(3, hy - 2, 14, 6, o.hoodColor); px(3, hy + 4, 2, 7, o.hoodColor); px(15, hy + 4, 2, 7, o.hoodColor); px(3, hy - 2, 14, 1, shade(o.hoodColor, 1.2)); px(6, hy + 2, 8, 1, shade(o.hoodColor, 0.7)); }
    else if (hat === 'wizard') { px(2, hy, 16, 2, o.hoodColor); px(5, hy - 3, 10, 3, o.hoodColor); px(7, hy - 7, 6, 4, o.hoodColor); px(9, hy - 10, 3, 3, o.hoodColor); px(9, hy - 3, 2, 1, '#f2d36b'); px(10, hy - 6, 1, 1, '#f2d36b'); px(5, hy, 10, 1, shade(o.hoodColor, 0.7)); }
    else if (hat === 'circlet') { px(5, hy - 1, 10, 1, '#f2d36b'); px(9, hy - 2, 2, 1, '#9fe0ff'); }
    else if (hat === 'straw') { px(2, hy, 16, 2, '#e3c36a'); px(5, hy - 3, 10, 3, '#f0d57e'); px(5, hy - 1, 10, 1, '#b8863a'); }
    else if (hat === 'cap') { px(4, hy - 2, 12, 4, o.capColor || '#7a4a3a'); px(13, hy + 1, 5, 2, shade(o.capColor || '#7a4a3a', 0.8)); }
    else if (hat === 'kerchief') { px(4, hy - 2, 12, 4, '#c8605a'); px(4, hy + 2, 3, 2, '#c8605a'); px(9, hy - 1, 2, 1, '#f6e0d0'); }
    else if (hat === 'crown') { px(5, hy - 2, 10, 3, '#f2d36b'); px(5, hy - 3, 2, 1, '#f2d36b'); px(9, hy - 3, 2, 1, '#f2d36b'); px(13, hy - 3, 2, 1, '#f2d36b'); }
}

function outline(c) {
    const g = ctx2(c);
    const W = c.width, H = c.height;
    const img = g.getImageData(0, 0, W, H);
    const d = img.data, out = new Uint8ClampedArray(d);
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 128;
    const ink = [58, 36, 24];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
            const i = (y * W + x) * 4;
            out[i] = ink[0]; out[i + 1] = ink[1]; out[i + 2] = ink[2]; out[i + 3] = 255;
        }
    }
    img.data.set(out);
    g.putImageData(img, 0, 0);
}

/** Options for a hero: class look plus gear tiers. */
export function heroLook(h, weaponTier, armorTier, charmTier) {
    const base = { skin: h.look.skin, hair: h.look.hair, style: h.look.style };
    const at = armorTier || 0, wt = weaponTier || 0;
    const ac = ARMOR_TIER[at];
    const wc = WEAPON_TIER[wt];
    const shoulders = at >= 3 ? shade(ac, 0.85) : null;
    switch (h.cls) {
        case 'warrior': return { ...base, body: at ? ac : '#8e6a4b', legs: '#5a4a3a', cape: '#b8323a', hat: 'helm', weapon: 'sword', weaponColor: wc, shoulders, trim: at >= 5 ? '#f2d36b' : at >= 4 ? '#e6ebf2' : null, hideHair: true };
        case 'archer': return { ...base, body: at >= 3 ? shade(ARMOR_TIER[at], 0.9) : '#4f8a4b', legs: '#6b5a45', hat: 'hood', hoodColor: '#3f7a3f', quiver: true, weapon: 'bow', weaponColor: wc, shoulders, trim: at >= 5 ? '#f2d36b' : null };
        case 'mage': return { ...base, body: '#6a4aa5', legs: '#4a3a70', longRobe: true, hat: 'wizard', hoodColor: '#5a3d95', weapon: 'staff', weaponColor: wt >= 4 ? wc : '#9fe0ff', trim: at >= 4 ? '#f2d36b' : '#c9b3ea', hideHair: false };
        case 'rogue': return { ...base, body: at >= 3 ? shade(ARMOR_TIER[at], 0.7) : '#46506b', legs: '#2f3446', hat: 'hood', hoodColor: '#38405a', scarf: '#c0392b', weapon: 'dagger', weaponColor: wc, shoulders };
        case 'cleric': return { ...base, body: '#f1ead8', legs: '#cbbf9f', longRobe: true, hat: 'circlet', weapon: 'mace', weaponColor: wc, trim: '#f2d36b', sleeve: '#e6dcc0' };
        default: return { ...base, body: '#8e6a4b', legs: '#5a4a3a', hat: null };
    }
}

export function villagerLook(v, special) {
    const o = v.look;
    const [shirt, pants] = VILLAGER[o.outfit % 6];
    const hats = [null, 'straw', 'cap', 'kerchief'];
    const base = { skin: o.skin, hair: o.hair, style: o.style, body: shirt, legs: pants, hat: hats[o.hat % 4], capColor: shirt, weapon: v.job != null && o.outfit % 3 === 0 ? 'basket' : null };
    if (special === 'brenna') return { ...base, body: '#5f9a6a', hat: 'kerchief', weapon: 'basket' };
    if (special === 'thorne') return { ...base, body: '#7a5a48', legs: '#3a3a42', hat: null, trim: '#5a3d28', shoulders: '#7a7a82' };
    if (special === 'pip') return { ...base, body: '#d9884a', hat: 'cap', capColor: '#4a7ab0', weapon: 'basket' };
    if (special === 'tuck') return { ...base, body: '#b84a6a', hat: 'cap', capColor: '#6a4aa5', trim: '#f2d36b' };
    if (special === 'orla') return { ...base, body: '#3f6aa0', longRobe: true, hat: null, trim: '#e6dcc0', hair: 6 };
    if (special === 'fenn') return { ...base, body: '#35506f', hat: 'cap', capColor: '#2a3f58', hair: 6 };
    return base;
}

const cache = new Map();
/** A strip of FRAMES frames, each FW×FH, outlined. */
export function charStrip(key, opts) {
    let c = cache.get(key);
    if (c) return c;
    c = canvas(FW * FRAMES, FH);
    const g = ctx2(c);
    g.imageSmoothingEnabled = false;
    for (let f = 0; f < FRAMES; f++) drawFrame(g, f * FW, f, opts);
    outline(c);
    cache.set(key, c);
    return c;
}

export function heroKey(h, wt, at, ct) {
    return `h:${h.cls}:${h.look.skin}:${h.look.hair}:${h.look.style}:${wt}:${at}:${ct}`;
}
export function villagerKey(v) {
    const o = v.look;
    return `v:${o.skin}:${o.hair}:${o.style}:${o.outfit}:${o.hat}:${v.special || ''}:${v.job != null && o.outfit % 3 === 0 ? 'b' : ''}`;
}
