// Painterly chibi people: big heads, little bodies, big shining eyes, smooth ink outlines and dry-brush colour.
// Everything is drawn on a 320x480 canvas from a handful of options; nothing here is a bitmap asset.

import { canvas, ctx2, P, paint, ink, INK, mix, lighten, darken, alpha, lin, rad, softShadow, glow, dab, curve, line, stroke, rnd } from './paint.js';
import { hash3 } from '../rng.js';

export const CW = 320, CH = 480;
const SKINS = ['#ffe0c4', '#f6cba2', '#e0a878', '#b97c52', '#8a5a3a', '#fbe8d8'];
const HAIRS = ['#3a2a22', '#6b4423', '#b9772e', '#e6c35a', '#c24a2a', '#2c2c3a', '#e8e4dc', '#8a5ac0', '#4a7a58', '#f08ab0'];

/** Default option set, then the caller's overrides. */
function opts(o) {
    return { skin: SKINS[0], hair: HAIRS[1], hairStyle: 'short', eye: '#4a6a9a', top: '#c8603a', bottom: '#5a4a6a', boots: '#6a4430', hat: 'none', hatColor: '#6a8a4a', cape: null, prop: 'none', apron: null, scarf: null, backpack: null, beard: null, armor: null, robe: false, blush: 0.5, smile: 1, seed: 1, trim: '#e8c860', glasses: false, tall: 0, ...o };
}

export function chibi(o) {
    o = opts(o);
    const cv = canvas(CW, CH), c = ctx2(cv);
    const s = o.seed;
    const cx = 160;
    const skin = o.skin, skinD = darken(skin, 0.25);
    softShadow(c, cx, 456, 78, 15, 0.34);

    // ---------------------------------------------------------------- behind the body
    if (o.cape) {
        paint(c, P.smooth([[112, 262], [208, 262], [250, 340], [262, 440], [160, 452], [58, 440], [70, 340]]), o.cape, { seed: s + 1, tex: 1.2 });
    }
    if (o.backpack) {
        paint(c, P.rrect(70, 246, 180, 170, 46), o.backpack, { seed: s + 2, tex: 1.2 });
        paint(c, P.rrect(86, 218, 148, 50, 25), mix(o.backpack, '#f0e0b0', 0.4), { seed: s + 3, line: 3 });   // bedroll
        paint(c, P.rrect(104, 312, 112, 80, 16), darken(o.backpack, 0.18), { seed: s + 4, line: 3 });          // pocket
        line(c, 90, 238, 230, 238, darken(o.backpack, 0.4), 4);
    }
    // back hair
    const hs = o.hairStyle;
    if (hs === 'long' || hs === 'bob' || hs === 'pony' || hs === 'curly') {
        const long = hs === 'long' ? 150 : hs === 'curly' ? 90 : hs === 'bob' ? 50 : 0;
        paint(c, P.smooth([[160, 66], [250, 96], [276, 170], [270, 230 + long], [220, 244 + long], [160, 250], [100, 244 + long], [50, 230 + long], [44, 170], [70, 96]], 0.45), o.hair, { seed: s + 5, tex: 1.4 });
        if (hs === 'pony') paint(c, P.smooth([[228, 120], [286, 150], [296, 250], [268, 300], [252, 230], [236, 170]]), o.hair, { seed: s + 6 });
    }
    if (hs === 'bun') paint(c, P.ellipse(160, 62, 42, 36), o.hair, { seed: s + 7 });

    // ---------------------------------------------------------------- legs and boots
    if (!o.robe) {
        for (const lx of [136, 184]) {
            paint(c, P.capsule(lx, 384, lx, 424, 17), o.bottom, { seed: s + lx, tex: 0.9 });
            paint(c, P.smooth([[lx - 26, 428], [lx - 8, 418], [lx + 12, 420], [lx + 28, 432], [lx + 24, 448], [lx - 22, 450]]), o.boots, { seed: s + lx + 1, tex: 0.8, line: 3.5 });
            dab(c, lx - 4, 428, 8, 3, 0.5);
        }
    }
    // ---------------------------------------------------------------- torso
    const topFill = lin(c, 0, 262, 0, 392, [[0, lighten(o.top, 0.12)], [1, darken(o.top, 0.12)]]);
    if (o.robe) {
        paint(c, P.poly([[114, 262], [206, 262], [246, 440], [74, 440]]), topFill, { base: o.top, seed: s + 10, tex: 1.2 });
        paint(c, P.ellipse(160, 442, 90, 12), darken(o.top, 0.2), { seed: s + 11, line: 3 });
        paint(c, P.rrect(112, 336, 96, 14, 6), o.trim, { seed: s + 12, line: 3 });
        line(c, 160, 270, 160, 436, alpha(darken(o.top, 0.4), 0.35), 3);
    } else {
        paint(c, P.rrect(108, 262, 104, 132, 36), topFill, { base: o.top, seed: s + 10, tex: 1.2 });
        paint(c, P.rrect(106, 346, 108, 17, 7), '#6a4630', { seed: s + 12, line: 3 });
        paint(c, P.rrect(148, 344, 24, 21, 4), o.trim, { seed: s + 13, line: 3 });
    }
    if (o.armor) {
        paint(c, P.smooth([[116, 270], [204, 270], [214, 340], [160, 362], [106, 340]]), lin(c, 110, 270, 214, 360, [[0, lighten(o.armor, 0.3)], [1, darken(o.armor, 0.15)]]), { base: o.armor, seed: s + 14, tex: 0.7, shade: 0.3 });
        line(c, 160, 276, 160, 350, alpha('#3a2a40', 0.4), 3);
        dab(c, 132, 292, 14, 6, 0.6);
        paint(c, P.ellipse(110, 282, 24, 20), o.armor, { seed: s + 15, tex: 0.6 });
        paint(c, P.ellipse(210, 282, 24, 20), o.armor, { seed: s + 16, tex: 0.6 });
    }
    if (o.apron) {
        paint(c, P.smooth([[124, 300], [196, 300], [204, 396], [116, 396]], 0.3), o.apron, { seed: s + 17, tex: 0.9, line: 3 });
        line(c, 128, 303, 192, 303, darken(o.apron, 0.3), 3);
    }
    if (o.scarf) {
        paint(c, P.rrect(104, 254, 112, 28, 14), o.scarf, { seed: s + 18, line: 3.5 });
        paint(c, P.rrect(176, 264, 30, 62, 12), darken(o.scarf, 0.08), { seed: s + 19, line: 3.5 });
    }
    // ---------------------------------------------------------------- arms (character's right arm is the one holding the prop)
    const armC = o.armor ? lighten(o.armor, 0.1) : o.top;
    const hand = (x, y) => paint(c, P.ellipse(x, y, 17, 16), skin, { seed: s + x, tex: 0.5, line: 3.5 });
    paint(c, P.capsule(112, 290, 82, 354, 16), armC, { seed: s + 20, tex: 0.9 });
    hand(78, 362);
    const hx = 244, hy = 366;
    paint(c, P.capsule(208, 290, hx - 4, hy - 12, 16), armC, { seed: s + 21, tex: 0.9 });
    drawProp(c, o, hx, hy, s);
    hand(hx, hy);

    // ---------------------------------------------------------------- head
    // hood back
    if (o.hat === 'hood' || o.hat === 'cleric') {
        paint(c, P.smooth([[160, 54], [262, 100], [280, 200], [250, 290], [160, 300], [70, 290], [40, 200], [58, 100]], 0.45), o.hatColor, { seed: s + 22, tex: 1.2 });
    }
    // ears
    paint(c, P.ellipse(64, 196, 14, 18), skin, { seed: s + 23, tex: 0.3, line: 3 });
    paint(c, P.ellipse(256, 196, 14, 18), skin, { seed: s + 24, tex: 0.3, line: 3 });
    const faceShape = P.smooth([[160, 94], [236, 112], [262, 184], [238, 240], [160, 266], [82, 240], [58, 184], [84, 112]], 0.5);
    paint(c, faceShape, rad(c, 140, 160, 10, 140, [[0, lighten(skin, 0.22)], [1, skin]]), { base: skin, seed: s + 25, tex: 0.35, shade: 0.22 });
    // beard
    if (o.beard) {
        paint(c, P.smooth([[96, 214], [160, 232], [224, 214], [236, 258], [200, 316], [160, 328], [120, 316], [84, 258]], 0.45), o.beard, { seed: s + 26, tex: 1.4 });
    }
    // face: eyes, brows, blush, mouth
    for (const [ex, sgn] of [[118, -1], [202, 1]]) {
        paint(c, P.ellipse(ex, 192, 20, 26), '#fffaf0', { seed: s + ex, tex: 0, shade: 0, line: 2.5 });
        paint(c, P.ellipse(ex + sgn * 1, 196, 15, 21), lin(c, 0, 172, 0, 218, [[0, darken(o.eye, 0.45)], [0.55, o.eye], [1, lighten(o.eye, 0.4)]]), { base: o.eye, tex: 0, shade: 0, line: 2 });
        paint(c, P.ellipse(ex + sgn * 1, 195, 7.5, 12), '#1c1420', { tex: 0, shade: 0, line: false });
        c.fillStyle = '#fff'; c.beginPath(); c.arc(ex - 6, 186, 6.5, 0, 7); c.fill();
        c.beginPath(); c.arc(ex + 6, 206, 3.4, 0, 7); c.fill();
        curve(c, ex - 22, 186, ex, 160, ex + 22, 186, '#2a1820', 6);
        line(c, ex + sgn * 20, 184, ex + sgn * 28, 178, '#2a1820', 4);
        curve(c, ex - 18, 148, ex, 140 + (sgn < 0 ? 0 : -2), ex + 18, 148, alpha(darken(o.hair, 0.3), 0.9), 5);
        c.fillStyle = alpha('#ff7a8a', 0.38 * o.blush * 1.6);
        c.beginPath(); c.ellipse(ex + sgn * -8, 224, 18, 10, 0, 0, 7); c.fill();
    }
    curve(c, 156, 214, 160, 218, 164, 214, alpha(skinD, 0.9), 3);
    if (!o.beard) {
        if (o.smile > 0.5) {
            c.fillStyle = '#7a2a30'; c.beginPath(); c.moveTo(144, 230); c.quadraticCurveTo(160, 254, 176, 230); c.quadraticCurveTo(160, 236, 144, 230); c.fill();
            curve(c, 144, 230, 160, 254, 176, 230, '#4a1c20', 3.5);
            c.fillStyle = '#ff9a9a'; c.beginPath(); c.ellipse(160, 243, 7, 4, 0, 0, 7); c.fill();
        } else curve(c, 148, 232, 160, 238, 172, 232, '#5a2a30', 4);
    } else curve(c, 148, 224, 160, 230, 172, 224, darken(o.beard, 0.5), 3.5);
    if (o.glasses) {
        for (const ex of [118, 202]) { c.beginPath(); c.arc(ex, 194, 27, 0, 7); c.strokeStyle = '#6a4a30'; c.lineWidth = 4; c.stroke(); c.fillStyle = 'rgba(200,230,255,0.18)'; c.fill(); }
        line(c, 145, 194, 175, 194, '#6a4a30', 4);
    }

    // ---------------------------------------------------------------- hair front, hats
    if (hs !== 'bald' && o.hat !== 'helm') {
        const fr = hs === 'spiky'
            ? P.poly([[60, 180], [70, 110], [96, 60], [120, 100], [150, 40], [180, 96], [214, 52], [232, 108], [262, 80], [262, 180], [240, 152], [214, 196], [188, 156], [160, 202], [130, 160], [106, 198], [84, 154]])
            : P.smooth([[58, 178], [72, 112], [160, 70], [248, 112], [262, 178], [240, 152], [216, 196], [190, 156], [160, 198], [130, 158], [104, 196], [82, 152]], 0.38);
        paint(c, fr, lin(c, 0, 70, 0, 200, [[0, lighten(o.hair, 0.22)], [1, o.hair]]), { base: o.hair, seed: s + 30, tex: 1.5, shade: 0.3 });
        c.save(); fr.draw(c); c.clip();
        c.strokeStyle = alpha(lighten(o.hair, 0.45), 0.55); c.lineWidth = 7; c.lineCap = 'round';
        c.beginPath(); c.moveTo(104, 110); c.quadraticCurveTo(160, 90, 216, 112); c.stroke();
        c.restore();
    }
    drawHat(c, o, s);
    return cv;
}

function drawProp(c, o, hx, hy, s) {
    switch (o.prop) {
        case 'sword':
            paint(c, P.poly([[hx - 8, hy - 20], [hx + 8, hy - 20], [hx + 9, hy - 170], [hx, hy - 196], [hx - 9, hy - 170]]), lin(c, hx - 9, 0, hx + 9, 0, [[0, '#dfe8f2'], [0.5, '#a8b6c8'], [1, '#d8e2ee']]), { tex: 0.2, shade: 0.2, line: 3.5, seed: s });
            line(c, hx, hy - 24, hx, hy - 170, 'rgba(255,255,255,0.7)', 3);
            paint(c, P.rrect(hx - 24, hy - 26, 48, 12, 5), '#e0b848', { line: 3.5, tex: 0.3 });
            break;
        case 'staff':
            paint(c, P.capsule(hx, hy + 70, hx, hy - 200, 7), '#8a5a34', { seed: s, tex: 0.8, line: 3.5 });
            glow(c, hx, hy - 214, 56, '#a8e8ff', 0.8);
            paint(c, P.ellipse(hx, hy - 214, 20, 20), rad(c, hx - 5, hy - 220, 2, 22, [[0, '#ffffff'], [0.5, '#9fe0ff'], [1, '#4a90d8']]), { tex: 0, line: 3.5, shade: 0 });
            break;
        case 'hammer':
            paint(c, P.capsule(hx, hy + 20, hx - 8, hy - 120, 8), '#8a5a34', { seed: s, tex: 0.8, line: 3.5 });
            paint(c, P.rrect(hx - 48, hy - 160, 80, 48, 10), lin(c, 0, hy - 160, 0, hy - 112, [[0, '#c8d0dc'], [1, '#7a8498']]), { seed: s, tex: 0.5, line: 4 });
            break;
        case 'basket':
            paint(c, P.smooth([[hx - 50, hy - 20], [hx + 50, hy - 20], [hx + 40, hy + 44], [hx - 40, hy + 44]], 0.3), '#c8924a', { seed: s, tex: 1.4, line: 3.5 });
            for (let i = 0; i < 3; i++) paint(c, P.ellipse(hx - 24 + i * 24, hy - 26, 15, 13), ['#e8b04a', '#d8503a', '#8ab84a'][i], { line: 3, tex: 0.4 });
            curve(c, hx - 48, hy - 20, hx, hy - 70, hx + 48, hy - 20, '#8a5a34', 5);
            break;
        case 'scroll':
            paint(c, P.rrect(hx - 14, hy - 70, 28, 96, 10), '#f4e6c0', { seed: s, tex: 0.6, line: 3.5 });
            line(c, hx - 14, hy - 56, hx + 14, hy - 56, '#c8a060', 3);
            break;
        case 'bow':
            curve(c, hx, hy - 150, hx + 60, hy - 20, hx, hy + 110, '#8a5a34', 9);
            line(c, hx, hy - 150, hx, hy + 110, '#f0e8d0', 2.5);
            break;
        case 'lantern':
            glow(c, hx, hy - 20, 70, '#ffc860', 0.9);
            paint(c, P.rrect(hx - 22, hy - 48, 44, 56, 10), '#ffd878', { tex: 0.2, line: 4, shade: 0.1 });
            paint(c, P.rrect(hx - 26, hy - 56, 52, 12, 5), '#5a4030', { line: 3 });
            curve(c, hx - 14, hy - 56, hx, hy - 90, hx + 14, hy - 56, '#4a3424', 4);
            break;
        case 'shield':
            paint(c, P.smooth([[hx - 52, hy - 70], [hx + 52, hy - 70], [hx + 46, hy + 10], [hx, hy + 56], [hx - 46, hy + 10]], 0.4), lin(c, hx - 50, 0, hx + 50, 0, [[0, o.hatColor], [1, darken(o.hatColor, 0.2)]]), { seed: s, tex: 0.8, line: 4.5 });
            paint(c, P.ellipse(hx, hy - 14, 14, 14), '#e8c860', { line: 3.5, tex: 0.3 });
            break;
        case 'sack':
            paint(c, P.smooth([[hx - 42, hy - 40], [hx + 42, hy - 40], [hx + 52, hy + 50], [hx - 52, hy + 50]], 0.5), '#c8a878', { seed: s, tex: 1.2, line: 3.5 });
            line(c, hx - 30, hy - 34, hx + 30, hy - 34, '#7a5a38', 5);
            break;
        case 'ladle':
            paint(c, P.capsule(hx, hy + 30, hx, hy - 100, 5), '#a87a4a', { seed: s, line: 3 });
            paint(c, P.ellipse(hx, hy - 112, 20, 16), '#b8b8c4', { line: 3.5 });
            break;
        case 'ledger':
            paint(c, P.rrect(hx - 34, hy - 64, 68, 84, 8), '#7a4a2a', { seed: s, tex: 0.8, line: 4 });
            paint(c, P.rrect(hx - 26, hy - 56, 52, 14, 4), '#e8c860', { line: 2.5, tex: 0.2 });
            break;
        default: break;
    }
}

function drawHat(c, o, s) {
    const hc = o.hatColor;
    switch (o.hat) {
        case 'traveler':
            paint(c, P.smooth([[150, 38], [196, 44], [214, 100], [160, 112], [104, 100], [112, 48]], 0.5), lin(c, 0, 38, 0, 110, [[0, lighten(hc, 0.2)], [1, hc]]), { base: hc, seed: s + 40, tex: 1.3 });
            paint(c, P.ellipse(160, 106, 134, 26), lin(c, 0, 82, 0, 130, [[0, lighten(hc, 0.15)], [1, darken(hc, 0.2)]]), { base: hc, seed: s + 41, tex: 1.3 });
            paint(c, P.rrect(106, 84, 108, 18, 8), '#c8522e', { line: 3 });
            // feather
            paint(c, P.smooth([[200, 78], [240, 30], [274, 4], [262, 54], [224, 90]], 0.5), '#f0e0a0', { seed: s + 42, line: 3, tex: 0.8 });
            line(c, 206, 80, 264, 12, alpha('#b88a3a', 0.8), 3);
            break;
        case 'straw':
            paint(c, P.smooth([[116, 62], [160, 40], [204, 62], [210, 108], [110, 108]], 0.5), lighten('#e0c068', 0.1), { seed: s + 40, tex: 1.5, line: 3.5 });
            paint(c, P.ellipse(160, 108, 150, 28), '#d8b458', { seed: s + 41, tex: 1.6, line: 4 });
            paint(c, P.rrect(112, 86, 96, 14, 6), '#b8423a', { line: 3 });
            break;
        case 'cap':
            paint(c, P.smooth([[96, 110], [112, 58], [160, 40], [208, 58], [226, 110], [160, 98]], 0.5), hc, { seed: s + 40, tex: 1.2 });
            paint(c, P.smooth([[196, 100], [262, 108], [252, 130], [180, 120]], 0.4), darken(hc, 0.15), { seed: s + 41, line: 3.5 });
            break;
        case 'bandana':
            paint(c, P.smooth([[62, 150], [160, 100], [258, 150], [250, 170], [160, 128], [70, 170]], 0.45), hc, { seed: s + 40, tex: 1 });
            paint(c, P.smooth([[250, 150], [292, 170], [300, 210], [270, 190], [244, 172]], 0.4), hc, { seed: s + 41, line: 3.5 });
            break;
        case 'hood':
            paint(c, P.smooth([[54, 190], [62, 108], [160, 62], [258, 108], [266, 190], [244, 160], [160, 112], [76, 160]], 0.4), lin(c, 0, 62, 0, 190, [[0, lighten(hc, 0.15)], [1, hc]]), { base: hc, seed: s + 40, tex: 1.3 });
            break;
        case 'cleric':
            paint(c, P.smooth([[54, 190], [62, 108], [160, 62], [258, 108], [266, 190], [240, 150], [160, 112], [80, 150]], 0.4), hc, { seed: s + 40, tex: 1 });
            glow(c, 160, 36, 70, '#fff0a0', 0.8);
            c.beginPath(); c.ellipse(160, 36, 54, 14, 0, 0, 7); c.strokeStyle = '#f8d860'; c.lineWidth = 7; c.stroke();
            c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
            break;
        case 'helm': {
            paint(c, P.smooth([[56, 190], [60, 110], [160, 56], [260, 110], [264, 190], [240, 170], [214, 150], [160, 136], [106, 150], [80, 170]], 0.4), lin(c, 56, 56, 264, 190, [[0, lighten(hc, 0.35)], [0.6, hc], [1, darken(hc, 0.25)]]), { base: hc, seed: s + 40, tex: 0.6, shade: 0.35 });
            paint(c, P.rrect(148, 96, 24, 74, 8), darken(hc, 0.08), { line: 3.5, tex: 0.3 });
            paint(c, P.smooth([[160, 54], [200, 6], [252, 4], [226, 38], [196, 66]], 0.5), o.trim || '#d8503a', { seed: s + 41, line: 3.5, tex: 1.2 });
            dab(c, 112, 100, 22, 7, 0.55, -0.7);
            break;
        }
        case 'pointy':
            paint(c, P.smooth([[160, -6], [212, 58], [232, 104], [160, 112], [88, 104], [112, 56]], 0.4), lin(c, 0, 0, 0, 110, [[0, lighten(hc, 0.2)], [1, hc]]), { base: hc, seed: s + 40, tex: 1.3 });
            paint(c, P.ellipse(160, 106, 126, 22), darken(hc, 0.1), { seed: s + 41, tex: 1.2, line: 4 });
            paint(c, P.rrect(106, 84, 108, 16, 7), '#e8c860', { line: 3 });
            c.fillStyle = '#ffe890'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 16; c.lineTo(160 + Math.cos(a) * r, 52 + Math.sin(a) * r); } c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
            break;
        case 'crown':
            paint(c, P.poly([[100, 100], [100, 52], [124, 76], [142, 40], [160, 74], [178, 40], [196, 76], [220, 52], [220, 100]]), '#f4d058', { seed: s + 40, tex: 0.5, line: 4 });
            for (const x of [124, 160, 196]) paint(c, P.ellipse(x, 88, 7, 7), ['#d8403a', '#40a8e0', '#58c860'][(x / 36) % 3 | 0], { line: 2.5, tex: 0 });
            break;
        default: break;
    }
}

// ------------------------------------------------------------ the people of the realm
const ROLE = [
    [/baker|cook|innkeeper/, { top: '#e8d8c0', apron: '#f8f0e0', hat: 'bandana', hatColor: '#ffffff', hairStyle: 'bun', prop: 'ladle' }],
    [/master smith|smith|foreman|miner|apprentice|ore boy/, { top: '#8a6a58', apron: '#4a3a34', hat: 'bandana', hatColor: '#b84a3a', hairStyle: 'short', prop: 'hammer', beard: null }],
    [/farm|ferry|fish|clerk|trapper/, { top: '#6a8aa8', hat: 'straw', hairStyle: 'short', prop: 'basket' }],
    [/herb|beekeeper|sage|weaver/, { top: '#7aa860', apron: '#f0e8d0', hat: 'none', hairStyle: 'long', prop: 'basket' }],
    [/guildmistress|steward/, { top: '#6a3a7a', trim: '#f0d060', hat: 'none', hairStyle: 'bun', prop: 'ledger', glasses: true }],
    [/wainwright|tanner|prospector|scale|spice|glass|bowyer/, { top: '#b87a3a', hat: 'cap', hatColor: '#8a5a30', hairStyle: 'short', prop: 'sack' }],
    [/noble|queen|lady/, { top: '#a83a6a', trim: '#f4d058', hat: 'crown', hairStyle: 'long', robe: true }],
    [/captain|hunter|ranger|shield|guard|jarl/, { top: '#5a6a8a', armor: '#b8c2d0', hat: 'helm', hatColor: '#aab4c4', prop: 'sword', cape: '#7a2a2a', hairStyle: 'short' }],
    [/seer|keeper|lantern/, { top: '#3a4a8a', robe: true, hat: 'pointy', hatColor: '#4a3a8a', hairStyle: 'long', prop: 'lantern' }],
    [/page|boy|joss|pip/, { top: '#c85a4a', hat: 'cap', hatColor: '#4a6a9a', hairStyle: 'spiky', prop: 'scroll' }],
];
export function npcLook(role, name = '') {
    const h = (n) => hash3(name.length * 31 + name.charCodeAt(0), n, 5);
    const base = { skin: SKINS[Math.floor(h(1) * 6)], hair: HAIRS[Math.floor(h(2) * HAIRS.length)], eye: ['#4a6a9a', '#6a4a2a', '#3a7a5a', '#7a4a8a', '#2a2a3a'][Math.floor(h(3) * 5)], seed: Math.floor(h(4) * 1000), hairStyle: ['short', 'bob', 'long', 'pony', 'curly', 'spiky'][Math.floor(h(5) * 6)], hat: 'none', top: '#c8782a' };
    if (/old|jarl|thorgrim|bjorn|garrick|tam|ironbeard/i.test(name)) { base.hair = '#e6e2da'; base.beard = '#d8d4cc'; base.hairStyle = 'short'; }
    if (/thorgrim|jarl|dwarf|bofur/i.test(name)) base.beard = /bofur/i.test(name) ? '#9a5a32' : '#c8c4bc';
    const r = ROLE.find(([re]) => re.test(role));
    return { ...base, ...(r ? r[1] : { top: '#c8782a', prop: 'none' }), ...(/jarl/.test(role) ? { hat: 'helm' } : {}) };
}
export const MERCHANT = { skin: SKINS[1], hair: '#7a4a2a', hairStyle: 'bob', eye: '#3a8a6a', top: '#3f8f78', bottom: '#6a4a3a', boots: '#6a3a2a', hat: 'traveler', hatColor: '#4f9a6a', scarf: '#e8883a', backpack: '#a86a3a', prop: 'ledger', seed: 7, blush: 0.7 };
export const KAELEN = { skin: SKINS[5], hair: '#f0cc62', hairStyle: 'spiky', eye: '#3a7ac8', top: '#e8e2d4', armor: '#e8edf5', trim: '#f4d058', bottom: '#8a7a9a', boots: '#7a5a40', cape: '#c8402e', prop: 'sword', hat: 'none', seed: 99, blush: 0.4 };
export const HEROES = {
    knight: { top: '#5a6a8a', armor: '#b8c2d0', hat: 'helm', hatColor: '#aab4c4', prop: 'sword', cape: '#3a5aa8' },
    ranger: { top: '#4a7a4a', hat: 'hood', hatColor: '#5a8a4a', prop: 'bow', cape: '#6a5a3a', boots: '#5a4030' },
    mage: { top: '#5a3a9a', robe: true, hat: 'pointy', hatColor: '#6a4ab0', prop: 'staff' },
    cleric: { top: '#f0e8d8', robe: true, trim: '#e8c860', hat: 'cleric', hatColor: '#f8f4e8', prop: 'staff' },
    rogue: { top: '#3a3a4a', hat: 'hood', hatColor: '#2e2e3e', prop: 'none', cape: '#4a3a5a', scarf: '#8a2a3a' },
};
export function heroLook(cls, look = 0) {
    const h = (n) => hash3(look, n, 11);
    return { skin: SKINS[Math.floor(h(1) * 6)], hair: HAIRS[Math.floor(h(2) * HAIRS.length)], eye: ['#4a6a9a', '#6a4a2a', '#3a7a5a', '#7a4a8a'][look % 4], hairStyle: ['short', 'bob', 'long', 'pony', 'spiky'][look % 5], seed: look * 13 + 5, ...HEROES[cls] };
}
