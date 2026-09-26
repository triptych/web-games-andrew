// ============================================================
// People (16x20) and monsters (16x16, bosses 32x32).
// dir: 0 down, 1 up, 2 left, 3 right. frame: 0 stand, 1/2 walk, 3 act.
// ============================================================

import { Pix, hex, shade, hsl, ramp, OUTLINE, h2 } from './core.js';
import { SKIN, HAIR_COLORS, EYES, CLOTH, HAIR_STYLES, ACCESSORIES } from '../../data/look.js';

export function paintPerson(look, dir, frame, opt = {}) {
    if (dir === 3) return paintPerson(look, 2, frame, opt).flipped();
    const p = new Pix(16, 20);
    const skin = hex(SKIN[look.skin] ?? SKIN[1]), skinD = shade(skin, -0.18);
    const hair = hex(HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[1]), hairD = shade(hair, -0.25), hairL = shade(hair, 0.2);
    const top = hex(opt.top ?? CLOTH[look.top] ?? CLOTH[0]), topD = shade(top, -0.22), topL = shade(top, 0.18);
    const bot = hex(opt.bottom ?? CLOTH[look.bottom] ?? CLOTH[9]), botD = shade(bot, -0.25);
    const eye = hex(EYES[look.eyes] ?? EYES[0]);
    const style = HAIR_STYLES[look.hair] ?? 'short';
    const acc = ACCESSORIES[look.acc] ?? 'none';
    const bob = frame === 1 || frame === 2 ? 1 : 0;
    const y0 = 1 - bob;           // head top

    // legs
    const legY = 15;
    const lOff = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    if (dir === 2) {
        p.rect(6, legY, 2, 4 + (frame === 1 ? 0 : 0), bot); p.rect(8, legY, 2, 4, botD);
        if (frame === 1) { p.rect(5, legY + 1, 2, 3, bot); } else if (frame === 2) { p.rect(9, legY + 1, 2, 3, botD); }
        p.rect(5 + (frame === 1 ? -1 : 0), 19, 3, 1, [60, 40, 30, 255]); p.rect(8 + (frame === 2 ? 1 : 0), 19, 3, 1, [50, 34, 26, 255]);
    } else {
        p.rect(5, legY, 3, 4 + (lOff < 0 ? -1 : 0), bot); p.rect(8, legY, 3, 4 + (lOff > 0 ? -1 : 0), botD);
        p.rect(5, 19 + (lOff < 0 ? -1 : 0), 3, 1, [60, 40, 30, 255]); p.rect(8, 19 + (lOff > 0 ? -1 : 0), 3, 1, [60, 40, 30, 255]);
    }
    // body
    const by = 10 - bob;
    p.rect(4, by, 8, 5, top); p.rect(4, by, 8, 1, topL); p.rect(4, by + 4, 8, 1, topD);
    if (dir === 0) { p.set(7, by, skinD); p.set(8, by, skinD); }
    // arms
    const act = frame === 3;
    if (dir === 2) {
        const sw = frame === 1 ? -1 : frame === 2 ? 1 : 0;
        if (act) { p.rect(1, by + 1, 4, 2, top); p.rect(0, by + 1, 1, 2, skin); }
        else { p.rect(6 + sw, by + 1, 3, 3, topD); p.rect(6 + sw, by + 4, 3, 1, skin); }
    } else {
        const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
        p.rect(3, by + 1 + (sw > 0 ? 0 : 0), 1, 3 + sw * 0, topD); p.rect(12, by + 1, 1, 3, topD);
        p.set(3, by + 4 + (sw > 0 ? -1 : 0), skin); p.set(12, by + 4 + (sw < 0 ? -1 : 0), skin);
        if (act && dir === 0) { p.rect(12, by + 3, 2, 3, topD); p.set(13, by + 6, skin); }
    }
    // head
    p.rect(4, y0 + 1, 8, 8, skin); p.rect(5, y0, 6, 1, skin); p.rect(4, y0 + 8, 8, 1, skinD);
    if (dir === 0) {
        p.rect(5, y0 + 5, 1, 2, eye); p.rect(10, y0 + 5, 1, 2, eye);
        p.set(5, y0 + 7, [240, 140, 140, 150]); p.set(10, y0 + 7, [240, 140, 140, 150]);
        p.set(7, y0 + 7, skinD); p.set(8, y0 + 7, skinD);
    } else if (dir === 2) {
        p.rect(5, y0 + 5, 1, 2, eye); p.set(4, y0 + 7, [240, 140, 140, 150]);
    }
    // hair
    paintHair(p, style, dir, y0, hair, hairD, hairL);
    // accessories
    if (acc === 'hat') { const s = ramp(45, 0.55, 0.62); p.rect(2, y0 + 1, 12, 1, s[1]); p.rect(4, y0 - 1, 8, 2, s[2]); p.hline(4, 11, y0, [200, 70, 60, 255]); }
    else if (acc === 'beanie') { const s = hex(CLOTH[(look.top + 3) % CLOTH.length]); p.rect(4, y0 - 1, 8, 3, s); p.hline(4, 11, y0 + 1, shade(s, -0.2)); p.set(8, y0 - 2, shade(s, 0.3)); }
    else if (acc === 'flower' && dir !== 1) { p.set(dir === 2 ? 9 : 11, y0 + 1, [255, 140, 180, 255]); p.set(dir === 2 ? 10 : 12, y0 + 2, [255, 140, 180, 255]); p.set(dir === 2 ? 8 : 10, y0 + 2, [255, 140, 180, 255]); p.set(dir === 2 ? 9 : 11, y0 + 3, [255, 140, 180, 255]); p.set(dir === 2 ? 9 : 11, y0 + 2, [255, 230, 90, 255]); }
    else if (acc === 'glasses' && dir !== 1) { const g = [40, 40, 50, 255]; if (dir === 0) { p.rect(4, y0 + 4, 3, 1, g); p.rect(9, y0 + 4, 3, 1, g); p.set(7, y0 + 5, g); p.set(8, y0 + 5, g); p.set(4, y0 + 6, g); p.set(6, y0 + 6, g); p.set(9, y0 + 6, g); p.set(11, y0 + 6, g); } else { p.rect(3, y0 + 4, 4, 1, g); p.set(3, y0 + 6, g); p.set(6, y0 + 6, g); } }
    else if (acc === 'scarf') { const s = hex(CLOTH[(look.bottom + 5) % CLOTH.length]); p.rect(4, by - 1, 8, 2, s); if (dir !== 1) p.rect(dir === 2 ? 9 : 9, by + 1, 2, 3, shade(s, -0.2)); }
    if (opt.crown) { const g = [240, 200, 60, 255]; p.hline(5, 10, y0 - 1, g); p.set(5, y0 - 2, g); p.set(8, y0 - 2, g); p.set(10, y0 - 2, g); }
    p.outline(OUTLINE);
    return p;
}

function paintHair(p, style, dir, y, c, d, l) {
    if (style === 'shaved') { if (dir !== 0) p.rect(4, y + 1, 8, 2, d); else p.hline(5, 10, y, d); return; }
    // cap of hair on top of the head in every style
    p.rect(4, y, 8, 3, c); p.rect(5, y - 1, 6, 1, c); p.hline(5, 9, y, l);
    if (dir === 1) { p.rect(4, y, 8, 8, c); p.rect(4, y + 7, 8, 1, d); }
    if (dir === 2) { p.rect(8, y, 4, 6, c); p.rect(11, y + 1, 1, 6, d); }
    switch (style) {
        case 'short': if (dir === 0) { p.set(4, y + 3, c); p.set(11, y + 3, c); } break;
        case 'bob': if (dir !== 1) { p.rect(3, y + 1, 2, 7, c); p.rect(11, y + 1, 2, 7, c); p.hline(3, 4, y + 7, d); p.hline(11, 12, y + 7, d); } else p.rect(3, y + 1, 10, 8, c); break;
        case 'long': p.rect(3, y + 1, 2, 11, c); p.rect(11, y + 1, 2, 11, c); if (dir === 1) p.rect(4, y + 7, 8, 5, c); p.hline(3, 4, y + 11, d); p.hline(11, 12, y + 11, d); break;
        case 'spiky': for (let x = 4; x <= 11; x += 2) { p.set(x, y - 2, c); p.set(x + 1, y - 1, c); } p.set(3, y + 1, c); p.set(12, y + 1, c); break;
        case 'bun': p.circle(8, y - 2, 2.5, c); p.set(7, y - 3, l); if (dir === 0) { p.set(4, y + 3, c); p.set(11, y + 3, c); } break;
        case 'curly': for (let k = 0; k < 10; k++) p.circle(3.5 + (k % 5) * 2.2, y + (k < 5 ? 0 : 1.5) + (k % 2), 1.4, k % 3 ? c : l); if (dir !== 1) { p.circle(3.5, y + 4, 1.4, c); p.circle(12.5, y + 4, 1.4, c); } break;
        case 'ponytail': if (dir === 2) { p.rect(12, y + 2, 2, 6, c); p.set(13, y + 8, d); } else if (dir === 1) { p.rect(7, y + 7, 2, 5, c); } else { p.set(4, y + 3, c); p.set(11, y + 3, c); p.rect(12, y + 3, 1, 4, d); } break;
    }
}

// ---------------------------------------------------------------- monsters
const TEMPLATE = {
    dome: (x, y) => { const dx = (x - 7.5) / 6.5, dy = (y - 11) / 5.5; return y >= 5 && dx * dx + (dy < 0 ? dy * dy : dy * dy * 4) < 1; },
    quad: (x, y) => ((x - 8) ** 2 / 36 + (y - 9) ** 2 / 9 < 1) || (y >= 11 && y <= 14 && (Math.abs(x - 4) < 1.2 || Math.abs(x - 11) < 1.2 || Math.abs(x - 6.5) < 0.8 || Math.abs(x - 9) < 0.8)) || ((x - 3) ** 2 + (y - 6) ** 2 < 7),
    wings: (x, y) => ((x - 7.5) ** 2 / 5 + (y - 8) ** 2 / 12 < 1) || (y > 3 && y < 11 && Math.abs(x - 7.5) < 7.5 - Math.abs(y - 6.5) * 0.9 && Math.abs(x - 7.5) > 1),
    plant: (x, y) => ((x - 7.5) ** 2 + (y - 5.5) ** 2 < 14) || (Math.abs(x - 7.5) < 1.2 && y > 5) || (y > 10 && y < 13 && Math.abs(x - 7.5) < 5 - (y - 10)),
    bug: (x, y) => ((x - 7.5) ** 2 / 25 + (y - 9) ** 2 / 16 < 1) || (y >= 12 && y <= 14 && (x + y) % 3 === 0) || (y < 5 && y > 1 && Math.abs(Math.abs(x - 7.5) - (5 - y)) < 0.8),
    ghost: (x, y) => ((x - 7.5) ** 2 / 30 + (y - 7) ** 2 / 30 < 1 && y < 8) || (y >= 7 && y <= 13 + ((x >> 1) % 2) && Math.abs(x - 7.5) < 5.5),
    block: (x, y) => (x >= 3 && x <= 12 && y >= 3 && y <= 13) || (y >= 6 && y <= 10 && (x <= 2 || x >= 13)) || (y >= 13 && (x === 4 || x === 5 || x === 10 || x === 11)),
    cap: (x, y) => ((x - 7.5) ** 2 / 42 + (y - 6) ** 2 / 16 < 1 && y <= 7) || (Math.abs(x - 7.5) < 3 && y > 7 && y < 15),
    snake: (x, y) => { const cx = 7.5 + Math.sin(y / 2.2) * 4; return Math.abs(x - cx) < 2.4 && y > 1 && y < 15 || ((x - 9) ** 2 + (y - 3) ** 2 < 6); },
    humanoid: (x, y) => ((x - 7.5) ** 2 + (y - 3.5) ** 2 < 7) || (Math.abs(x - 7.5) < 2.5 && y >= 5 && y <= 10) || (y >= 6 && y <= 9 && Math.abs(x - 7.5) < 5 && Math.abs(x - 7.5) > 3) || (y > 10 && y < 15 && (Math.abs(x - 6) < 1 || Math.abs(x - 9) < 1)),
};
const ARCH_TEMPLATE = { slime: 'dome', beast: 'quad', bird: 'wings', plant: 'plant', bug: 'bug', spirit: 'ghost', golem: 'block', fungus: 'cap', serpent: 'snake', construct: 'block', skeleton: 'humanoid' };

/** size 16 (normal) or 32 (boss). frame 0/1 (idle bob / flap). */
export function paintMonster(sp, frame = 0, size = 16) {
    const p = new Pix(size, size);
    const s = size / 16;
    const tpl = TEMPLATE[ARCH_TEMPLATE[sp.arche] ?? 'dome'];
    const body = ramp(sp.hue, 0.55, 0.5), acc = ramp(sp.hue2, 0.6, 0.55);
    const seed = sp.sprite | 0;
    const mask = (x, y) => {
        // template in 16-space with a seeded wobble on the edge, mirrored
        const mx = x < 8 ? x : 15 - x;
        const fy = y + (frame && sp.arche !== 'golem' ? (y > 8 ? 0 : 1) : 0);
        let on = tpl(mx, fy);
        const e = h2(seed, mx, fy);
        if (on && e < 0.07) on = false;
        if (!on && e > 0.95 && (tpl(mx + 1, fy) || tpl(mx, fy + 1))) on = true;
        if (sp.arche === 'bird' && frame) on = on || (tpl(mx, fy + 2) && fy < 8);
        return on;
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const X = Math.floor(x / s), Y = Math.floor(y / s);
        if (!mask(X, Y)) continue;
        const lx = (x / size - 0.5), ly = (y / size - 0.5);
        let c = ly < -0.2 ? body[2] : ly > 0.25 ? body[0] : body[1];
        if (lx < -0.2 && ly < -0.1) c = body[3];
        const mx = X < 8 ? X : 15 - X;
        if (h2(seed + 7, mx, Y) < 0.13) c = acc[1];
        if (sp.arche === 'spirit') c = [...c.slice(0, 3), 210];
        p.set(x, y, c);
    }
    // eyes: find the upper body row and place two eyes symmetric
    let ey = -1;
    for (let y = 2; y < 16 && ey < 0; y++) if (mask(5, y) && mask(6, y) && mask(5, y + 1)) ey = y + 1;
    if (ey < 0) ey = 6;
    const eyeC = sp.boss ? [255, 70, 60, 255] : [30, 20, 30, 255];
    for (const ex of [5, 10]) {
        p.rect(ex * s, ey * s, s, 2 * s, [250, 250, 250, 255]);
        p.rect(ex * s + (ex === 5 ? s - 1 : 0) * 0, ey * s + s, s, s, eyeC);
    }
    if (sp.boss) { // horns / crown
        const g = [245, 210, 80, 255];
        for (let k = 0; k < 3; k++) { p.rect((5 + k * 2.5) * s, 0, s, 2 * s, g); }
    }
    p.outline(OUTLINE);
    return p;
}

export function paintGlim(frame) {
    const p = new Pix(12, 12);
    const r = 3 + (frame % 2) * 0.6;
    p.circle(6, 6, r + 2, [200, 255, 240, 70]);
    p.circle(6, 6, r, [220, 255, 245, 255], (x, y) => (x < -0.2 && y < -0.2 ? [255, 255, 255, 255] : [170, 250, 220, 255]));
    p.set(5, 5, [40, 60, 70, 255]); p.set(7, 5, [40, 60, 70, 255]);
    return p;
}

// ---------------------------------------------------------------- farm animals (16x16)
export function paintAnimal(kind, frame) {
    const p = new Pix(16, 16);
    const leg = frame ? 1 : 0;
    if (kind === 'chicken' || kind === 'duck') {
        const body = kind === 'duck' ? [250, 250, 245, 255] : [250, 244, 230, 255], sh = shade(body, -0.15);
        p.ellipse(8, 10, 4.5, 3.5, body, (x, y) => (y > 0.4 ? sh : body));
        p.circle(11, 6, 2.5, body);
        p.rect(13, 6, 2, 1, kind === 'duck' ? [240, 170, 40, 255] : [240, 160, 40, 255]);
        if (kind === 'chicken') { p.set(11, 3, [220, 40, 40, 255]); p.set(12, 3, [220, 40, 40, 255]); }
        p.set(11, 5, [20, 20, 20, 255]);
        p.vline(7, 13, 14 + leg, [240, 160, 40, 255]); p.vline(9, 13, 15 - leg, [240, 160, 40, 255]);
        p.ellipse(6, 9, 2, 1.4, sh);
    } else {
        const col = kind === 'cow' ? [245, 240, 235, 255] : kind === 'goat' ? [210, 190, 160, 255] : [240, 238, 230, 255];
        const sh = shade(col, -0.18);
        if (kind === 'sheep') for (let k = 0; k < 8; k++) p.circle(4 + (k % 4) * 2.5, 8 + Math.floor(k / 4) * 2.5, 2.3, k % 2 ? col : sh);
        else p.ellipse(7, 9, 5.5, 3.5, col, (x, y) => (y > 0.4 ? sh : col));
        if (kind === 'cow') { p.ellipse(6, 8, 1.8, 1.4, [60, 50, 50, 255]); p.ellipse(9, 10, 1.4, 1, [60, 50, 50, 255]); }
        const head = kind === 'sheep' ? [60, 55, 60, 255] : col;
        p.ellipse(13, 7, 2.3, 2.6, head);
        p.set(13, 6, [20, 20, 20, 255]);
        if (kind === 'goat') { p.line(12, 4, 11, 2, [120, 100, 80, 255]); p.line(14, 4, 15, 2, [120, 100, 80, 255]); }
        if (kind === 'cow') { p.set(12, 4, [220, 210, 190, 255]); p.set(15, 4, [220, 210, 190, 255]); p.rect(12, 9, 3, 1, [240, 170, 170, 255]); }
        for (const [x, l] of [[3, leg], [6, 1 - leg], [9, leg], [11, 1 - leg]]) p.vline(x, 12, 14 + l, [80, 64, 56, 255]);
    }
    p.outline(OUTLINE);
    return p;
}
