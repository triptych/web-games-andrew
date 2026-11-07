// Painted buildings, trees, rocks and props: the scenery of the diorama. Each returns a canvas
// (and, for buildings, a second "glow" canvas of lit windows that is added at night).

import { canvas, ctx2, P, paint, ink, INK, mix, lighten, darken, alpha, lin, rad, softShadow, glow, dab, curve, line, stroke, rnd } from './paint.js';
import { hash3 } from '../rng.js';

export const BIOME = {
    meadow: { wall: '#f0e2c0', timber: '#7a5a3a', roof: '#c8603a', roof2: '#a8482e', ground: '#8cc060', ground2: '#6fa850', tree: 'oak', stone: '#b8b0a0', sky: ['#a8d0f0', '#e8f0e0'] },
    river: { wall: '#e8e0c8', timber: '#6a5a3a', roof: '#6a9a58', roof2: '#548048', ground: '#8cc068', ground2: '#68a85a', tree: 'oak', stone: '#b0b0a8', sky: ['#b0d8f0', '#e8f4e8'] },
    hills: { wall: '#d8c8a8', timber: '#6a4a30', roof: '#8a5a40', roof2: '#6a4430', ground: '#a8b068', ground2: '#8a9a58', tree: 'pine', stone: '#a8a098', sky: ['#a8c8e8', '#f0e8d8'] },
    hub: { wall: '#ece4d4', timber: '#6a5040', roof: '#4a6a9a', roof2: '#385680', ground: '#b8b098', ground2: '#a09a84', tree: 'oak', stone: '#c0b8a8', sky: ['#a8d0f0', '#f4ecd8'] },
    forest: { wall: '#d8c8a0', timber: '#5a4028', roof: '#4f8a50', roof2: '#3a6a40', ground: '#6a9a50', ground2: '#548a44', tree: 'pine', stone: '#9aa090', sky: ['#98c8c8', '#e0ecd0'] },
    port: { wall: '#dcd0b4', timber: '#5a4a3a', roof: '#3a6a8a', roof2: '#2e5472', ground: '#c8b890', ground2: '#b0a47c', tree: 'palm', stone: '#b0a898', sky: ['#a0d0f0', '#f4f0e0'] },
    forge: { wall: '#8a8078', timber: '#4a3a32', roof: '#5a4a48', roof2: '#403432', ground: '#7a6a62', ground2: '#665850', tree: 'dead', stone: '#6a625c', sky: ['#c89878', '#f0c8a0'] },
    desert: { wall: '#f4dca8', timber: '#a8743a', roof: '#d8883a', roof2: '#b8682a', ground: '#e8cc8a', ground2: '#d8b870', tree: 'palm', stone: '#e0c898', sky: ['#98d0f0', '#fce8b8'] },
    elven: { wall: '#f4f0e4', timber: '#8a7a5a', roof: '#6ab88a', roof2: '#4a9870', ground: '#7ab878', ground2: '#5aa068', tree: 'elf', stone: '#d8e0d4', sky: ['#b8d8e8', '#e8f4ec'] },
    snow: { wall: '#9a8878', timber: '#3a2c28', roof: '#e8f0f8', roof2: '#c8d8ec', ground: '#e8f0f8', ground2: '#d0e0f0', tree: 'snowpine', stone: '#8a94a4', sky: ['#c8d8f0', '#f4f8ff'] },
    ash: { wall: '#6a5a58', timber: '#3a2a2a', roof: '#8a3a2e', roof2: '#6a2c24', ground: '#6a5a58', ground2: '#584a48', tree: 'dead', stone: '#5a504e', sky: ['#c8887a', '#f0b890'] },
    royal: { wall: '#f4f0f4', timber: '#8a7a9a', roof: '#4a60b8', roof2: '#364a98', ground: '#c8d0b8', ground2: '#b0bc9c', tree: 'oak', stone: '#e8e4ec', sky: ['#a8d0f8', '#f8f4ec'] },
    star: { wall: '#4a4a70', timber: '#2a2a48', roof: '#6a4ab0', roof2: '#4e3490', ground: '#4a4a68', ground2: '#3c3c58', tree: 'crystal', stone: '#6a6a90', sky: ['#4a3a78', '#a888d8'] },
};

const W = 480, H = 440;
function win(c, x, y, w, h, g) {
    paint(c, P.rrect(x, y, w, h, Math.min(10, w / 3)), lin(c, 0, y, 0, y + h, [[0, '#ffe8a0'], [1, '#ffb860']]), { tex: 0.2, shade: 0.1, line: 3.5 });
    line(c, x + w / 2, y + 2, x + w / 2, y + h - 2, INK, 2.5);
    line(c, x + 2, y + h / 2, x + w - 2, y + h / 2, INK, 2.5);
    if (g) glow(g, x + w / 2, y + h / 2, Math.max(w, h) * 1.1, '#ffb050', 0.9);
}
function door(c, x, y, w, h, col = '#7a4a2a') {
    paint(c, P.custom([x, y, w, h], (k) => { k.beginPath(); k.moveTo(x, y + h); k.lineTo(x, y + w / 2); k.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); k.lineTo(x + w, y + h); k.closePath(); }), col, { tex: 0.9, line: 3.5 });
    c.fillStyle = '#f0d060'; c.beginPath(); c.arc(x + w * 0.75, y + h * 0.58, 3.5, 0, 7); c.fill();
}
function beams(c, x, y, w, h, col) {
    for (const bx of [x + 4, x + w / 2, x + w - 4]) line(c, bx, y, bx, y + h, col, 7);
    line(c, x, y + h * 0.45, x + w, y + h * 0.45, col, 6);
    line(c, x + 4, y + h * 0.45, x + w / 2, y + 6, col, 5);
    line(c, x + w - 4, y + h * 0.45, x + w / 2, y + 6, col, 5);
}
function gable(c, x, y, w, h, col, col2, seed, over = 26) {
    const rf = P.poly([[x - over, y + h], [x + w / 2, y - 6], [x + w + over, y + h]]);
    paint(c, rf, lin(c, 0, y, 0, y + h, [[0, lighten(col, 0.2)], [1, col]]), { base: col, seed, tex: 1.2 });
    // shingle rows
    c.save(); rf.draw(c); c.clip();
    for (let r = 1; r < 6; r++) { const yy = y + (h * r) / 6; c.beginPath(); c.moveTo(x - over, yy); c.quadraticCurveTo(x + w / 2, yy - 6, x + w + over, yy); c.strokeStyle = alpha(darken(col2, 0.3), 0.55); c.lineWidth = 3; c.stroke(); }
    c.restore();
    paint(c, P.rrect(x - over - 4, y + h - 8, w + over * 2 + 8, 14, 6), col2, { seed: seed + 1, line: 3.5, tex: 0.6 });
}
function chimney(c, x, y, col, g, smoke = true) {
    paint(c, P.rrect(x, y, 36, 64, 4), col, { tex: 1, line: 3.5, seed: x });
    paint(c, P.rrect(x - 5, y - 8, 46, 14, 4), darken(col, 0.15), { line: 3 });
    if (smoke) for (let i = 0; i < 3; i++) { c.fillStyle = `rgba(250,245,240,${0.5 - i * 0.13})`; c.beginPath(); c.arc(x + 20 + i * 8, y - 24 - i * 26, 14 + i * 7, 0, 7); c.fill(); }
}
function signboard(c, x, y, kind, label) {
    line(c, x, y - 40, x, y, '#4a3424', 5);
    paint(c, P.rrect(x - 4, y - 20, 66, 44, 8), '#c8a070', { line: 3.5, tex: 0.9 });
    drawSignIcon(c, x + 29, y + 2, kind);
}
export function drawSignIcon(c, x, y, kind) {
    c.save(); c.translate(x, y);
    const f = (col) => { c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 2.5; c.lineJoin = 'round'; };
    switch (kind) {
        case 'basket': f('#e8b04a'); c.beginPath(); c.moveTo(-14, -2); c.lineTo(14, -2); c.lineTo(10, 14); c.lineTo(-10, 14); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.arc(0, -2, 12, Math.PI, 0); c.stroke(); break;
        case 'anvil': f('#8a94a4'); c.beginPath(); c.moveTo(-16, -8); c.lineTo(16, -8); c.lineTo(10, 0); c.lineTo(6, 14); c.lineTo(-6, 14); c.lineTo(-4, 0); c.closePath(); c.fill(); c.stroke(); break;
        case 'flask': f('#78c8a0'); c.beginPath(); c.moveTo(-4, -14); c.lineTo(4, -14); c.lineTo(4, -4); c.lineTo(14, 12); c.lineTo(-14, 12); c.lineTo(-4, -4); c.closePath(); c.fill(); c.stroke(); break;
        case 'pack': f('#c8784a'); c.beginPath(); c.roundRect(-13, -12, 26, 26, 8); c.fill(); c.stroke(); f('#e8c880'); c.beginPath(); c.roundRect(-8, 0, 16, 9, 3); c.fill(); c.stroke(); break;
        case 'gem': f('#6ab0f0'); c.beginPath(); c.moveTo(-12, -4); c.lineTo(-6, -12); c.lineTo(6, -12); c.lineTo(12, -4); c.lineTo(0, 14); c.closePath(); c.fill(); c.stroke(); break;
        case 'coins': f('#f4d058'); c.beginPath(); c.arc(-4, 2, 11, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.arc(6, -3, 11, 0, 7); c.fill(); c.stroke(); break;
        case 'mug': f('#e8b84a'); c.beginPath(); c.roundRect(-10, -10, 20, 24, 4); c.fill(); c.stroke(); f('#fff4dc'); c.beginPath(); c.ellipse(0, -10, 10, 5, 0, 0, 7); c.fill(); c.stroke(); break;
        case 'scroll': f('#f4e6c0'); c.beginPath(); c.roundRect(-10, -13, 20, 28, 5); c.fill(); c.stroke(); break;
        case 'bed': f('#c8784a'); c.beginPath(); c.roundRect(-14, 0, 28, 10, 3); c.fill(); c.stroke(); f('#f4e6c0'); c.beginPath(); c.roundRect(-14, -8, 12, 9, 4); c.fill(); c.stroke(); break;
        case 'star': f('#ffd84a'); c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 14; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); break;
        case 'needle': f('#d8a0c8'); c.beginPath(); c.moveTo(-12, 12); c.lineTo(12, -12); c.stroke(); c.beginPath(); c.arc(11, -11, 4, 0, 7); c.stroke(); break;
        case 'pot': f('#8a8a98'); c.beginPath(); c.roundRect(-13, -4, 26, 18, 6); c.fill(); c.stroke(); f('#e0603a'); c.beginPath(); c.ellipse(0, -6, 10, 5, 0, 0, 7); c.fill(); c.stroke(); break;
        default: break;
    }
    c.restore();
}

/** A building sprite. kind: house | shop | smithy | inn | guild | alchemist | tent | board | tower | dome | elf | long | stall | stable. */
export function building(kind, biome = 'meadow', seed = 1, sign = null) {
    const B = BIOME[biome] || BIOME.meadow;
    const cv = canvas(W, H), c = ctx2(cv);
    const gl = canvas(W, H), g = ctx2(gl);
    const s = seed * 13;
    softShadow(c, W / 2, 418, 190, 22, 0.3);
    const wall = (x, y, w, h, col = B.wall, r = 6) => paint(c, P.rrect(x, y, w, h, r), lin(c, 0, y, 0, y + h, [[0, lighten(col, 0.12)], [1, darken(col, 0.08)]]), { base: col, seed: s, tex: 1.1 });
    switch (kind) {
        case 'house': {
            wall(100, 220, 280, 196); beams(c, 100, 220, 280, 196, B.timber);
            win(c, 128, 270, 56, 62, g); win(c, 296, 270, 56, 62, g);
            door(c, 210, 320, 60, 96);
            gable(c, 100, 92, 280, 140, B.roof, B.roof2, s);
            chimney(c, 300, 74, B.stone, g);
            win(c, 218, 150, 44, 44, g);
            break;
        }
        case 'shop': {
            wall(70, 200, 340, 216);
            beams(c, 70, 200, 340, 216, B.timber);
            gable(c, 70, 84, 340, 130, B.roof, B.roof2, s, 20);
            // striped awning
            const aw = P.custom([56, 252, 368, 70], (k) => { k.beginPath(); k.moveTo(56, 252); k.lineTo(424, 252); k.lineTo(436, 318); for (let i = 0; i < 8; i++) { const x0 = 436 - i * 46, x1 = x0 - 46; k.quadraticCurveTo((x0 + x1) / 2, 340, x1, 318); } k.lineTo(44, 318); k.closePath(); });
            paint(c, aw, '#f2ead8', { seed: s + 2, tex: 0.9 });
            c.save(); aw.draw(c); c.clip();
            for (let i = 0; i < 8; i += 2) { c.fillStyle = alpha(B.roof, 0.85); c.fillRect(44 + i * 48, 250, 48, 100); }
            c.restore(); aw.draw(c); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
            // counter with goods
            paint(c, P.rrect(96, 346, 288, 66, 8), '#a8784a', { seed: s + 3, tex: 1.2 });
            const goods = ['#d8503a', '#e8b84a', '#7ab84a', '#8a6ad0', '#d8884a'];
            for (let i = 0; i < 5; i++) paint(c, P.ellipse(124 + i * 58, 346, 22, 16), goods[(i + seed) % 5], { seed: s + 10 + i, line: 3, tex: 0.6 });
            win(c, 190, 150, 100, 46, g);
            if (sign) signboard(c, 396, 232, sign);
            break;
        }
        case 'smithy': {
            wall(80, 224, 320, 192, B.stone === '#c0b8a8' ? '#b8a898' : B.stone, 8);
            for (let r = 0; r < 5; r++) for (let q = 0; q < 6; q++) { c.strokeStyle = alpha(INK, 0.22); c.lineWidth = 2; c.strokeRect(84 + q * 52 + (r % 2) * 26, 230 + r * 36, 52, 36); }
            gable(c, 80, 110, 320, 126, B.roof2, darken(B.roof2, 0.2), s, 18);
            chimney(c, 332, 56, '#6a6460', g);
            glow(c, 350, 40, 60, '#ff8a3a', 0.4);
            // open forge front
            paint(c, P.custom([140, 290, 130, 126], (k) => { k.beginPath(); k.moveTo(140, 416); k.lineTo(140, 330); k.arc(205, 330, 65, Math.PI, 0); k.lineTo(270, 416); k.closePath(); }), '#2e1c18', { tex: 0.2, shade: 0, line: 4 });
            c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = rad(c, 205, 380, 4, 90, [[0, 'rgba(255,200,90,0.95)'], [0.5, 'rgba(255,100,30,0.6)'], [1, 'rgba(255,60,0,0)']]); c.fillRect(120, 290, 170, 130); c.restore();
            glow(g, 205, 380, 110, '#ff7a20', 0.9);
            // anvil
            paint(c, P.poly([[318, 388], [380, 388], [372, 398], [358, 402], [364, 416], [334, 416], [340, 402], [326, 398]]), '#8892a4', { line: 3.5, tex: 0.5 });
            win(c, 300, 262, 50, 44, g);
            break;
        }
        case 'inn': {
            wall(80, 190, 320, 226); beams(c, 80, 190, 320, 226, B.timber);
            line(c, 80, 300, 400, 300, B.timber, 8);
            win(c, 104, 226, 52, 56, g); win(c, 212, 226, 56, 56, g); win(c, 322, 226, 52, 56, g);
            win(c, 104, 330, 52, 56, g); win(c, 322, 330, 52, 56, g);
            door(c, 206, 320, 68, 96, '#8a4a2a');
            gable(c, 80, 70, 320, 130, B.roof, B.roof2, s, 24);
            chimney(c, 330, 50, B.stone, g);
            // hanging mug sign
            line(c, 400, 250, 450, 250, '#4a3424', 6); line(c, 440, 250, 440, 270, '#4a3424', 3);
            paint(c, P.rrect(414, 268, 54, 46, 8), '#c8a070', { line: 3.5, tex: 0.8 });
            drawSignIcon(c, 441, 292, 'mug');
            // lanterns
            for (const lx of [186, 294]) { glow(g, lx, 306, 36, '#ffc060', 1); paint(c, P.rrect(lx - 8, 296, 16, 22, 5), '#ffd878', { line: 3, tex: 0 }); }
            break;
        }
        case 'guild': {
            wall(90, 200, 300, 216, B.stone, 8);
            for (let q = 0; q < 4; q++) paint(c, P.rrect(110 + q * 72, 214, 22, 202, 6), lighten(B.stone, 0.12), { seed: s + q, line: 3, tex: 0.7 });
            paint(c, P.poly([[70, 206], [410, 206], [380, 120], [100, 120]]), lin(c, 0, 120, 0, 206, [[0, lighten(B.roof, 0.2)], [1, B.roof]]), { base: B.roof, seed: s, tex: 1.2, line: 4 });
            paint(c, P.rrect(190, 40, 100, 96, 8), B.wall, { seed: s + 1, tex: 0.9 });
            paint(c, P.poly([[180, 46], [300, 46], [240, -8]]), B.roof2, { seed: s + 2, line: 4 });
            c.fillStyle = '#fff4dc'; c.beginPath(); c.arc(240, 92, 26, 0, 7); c.fill(); c.strokeStyle = INK; c.lineWidth = 3.5; c.stroke();
            line(c, 240, 92, 240, 76, INK, 3.5); line(c, 240, 92, 252, 98, INK, 3.5);
            door(c, 200, 316, 80, 100, '#6a3a22');
            // banners
            for (const bx of [128, 330]) { paint(c, P.poly([[bx, 232], [bx + 46, 232], [bx + 46, 330], [bx + 23, 310], [bx, 330]]), '#b8302e', { line: 3.5, tex: 0.9 }); drawSignIcon(c, bx + 23, 270, 'coins'); }
            glow(g, 240, 92, 46, '#ffe0a0', 0.6);
            break;
        }
        case 'alchemist': {
            wall(120, 190, 240, 226, mix(B.wall, '#d8e8d0', 0.4), 40);
            paint(c, P.custom([100, 40, 280, 170], (k) => { k.beginPath(); k.moveTo(100, 200); k.quadraticCurveTo(110, 120, 240, 30); k.quadraticCurveTo(370, 120, 380, 200); k.closePath(); }), '#4f9a6a', { seed: s, tex: 1.3, line: 4.5 });
            win(c, 214, 130, 52, 52, g); win(c, 140, 250, 46, 56, g); win(c, 296, 250, 46, 56, g);
            door(c, 210, 326, 60, 90);
            // bottles on shelf
            for (let i = 0; i < 4; i++) { const col = ['#e86a8a', '#6ab0f0', '#8ad868', '#c8a0f0'][i]; paint(c, P.smooth([[400 + i * 14, 396], [408 + i * 14, 396], [412 + i * 14, 372], [404 + i * 14, 360], [396 + i * 14, 372]], 0.4), col, { line: 2.5, tex: 0.2 }); }
            for (let i = 0; i < 3; i++) { c.fillStyle = `rgba(150,230,170,${0.55 - i * 0.14})`; c.beginPath(); c.arc(240 + i * 10, 22 - i * 22, 10 + i * 5, 0, 7); c.fill(); }
            glow(g, 240, 156, 60, '#9affb0', 0.7);
            break;
        }
        case 'tent': {
            paint(c, P.poly([[40, 416], [240, 70], [440, 416]]), '#f4ecd8', { seed: s, tex: 1.2, line: 4.5 });
            c.save(); P.poly([[40, 416], [240, 70], [440, 416]]).draw(c); c.clip();
            for (let i = -4; i < 6; i += 2) { c.fillStyle = alpha('#c8402e', 0.9); c.beginPath(); c.moveTo(240, 70); c.lineTo(240 + i * 54, 416); c.lineTo(240 + (i + 1) * 54, 416); c.closePath(); c.fill(); }
            c.restore(); P.poly([[40, 416], [240, 70], [440, 416]]).draw(c); ink(c, 4.5);
            paint(c, P.poly([[200, 416], [240, 300], [280, 416]]), '#4a2a2a', { line: 3.5, tex: 0.5 });
            line(c, 240, 70, 240, 6, '#6a4a30', 6);
            paint(c, P.poly([[240, 8], [330, 24], [240, 52]]), '#f4d058', { line: 3.5, tex: 0.8 });
            glow(g, 240, 380, 50, '#ffd890', 0.8);
            break;
        }
        case 'board': {
            softShadow(c, 240, 418, 100, 14, 0.28);
            line(c, 140, 424, 140, 220, '#6a4a30', 14); line(c, 340, 424, 340, 220, '#6a4a30', 14);
            paint(c, P.rrect(110, 200, 260, 190, 10), '#b88a58', { seed: s, tex: 1.5, line: 5 });
            paint(c, P.rrect(124, 214, 232, 162, 6), '#d8b078', { seed: s + 1, tex: 1.2, line: 3 });
            const cols = ['#f4ecd0', '#f0e0b8', '#ece4d8'];
            for (let i = 0; i < 5; i++) { const px = 134 + (i % 3) * 74 + hash3(s, i, 1) * 8, py = 226 + Math.floor(i / 3) * 76 + hash3(s, i, 2) * 8; paint(c, P.rrect(px, py, 60, 64, 3), cols[i % 3], { seed: s + i, tex: 0.3, line: 2.8 }); for (let k = 0; k < 4; k++) line(c, px + 8, py + 16 + k * 11, px + 50 - hash3(s, i, k) * 12, py + 16 + k * 11, alpha(INK, 0.55), 2); c.fillStyle = '#c8402e'; c.beginPath(); c.arc(px + 30, py + 6, 4.5, 0, 7); c.fill(); }
            paint(c, P.poly([[96, 200], [384, 200], [352, 168], [128, 168]]), B.roof, { seed: s + 5, line: 4.5, tex: 1 });
            break;
        }
        case 'tower': {
            wall(160, 150, 160, 266, B.stone, 6);
            for (let r = 0; r < 7; r++) for (let q = 0; q < 3; q++) { c.strokeStyle = alpha(INK, 0.22); c.lineWidth = 2; c.strokeRect(160 + q * 54 + (r % 2) * 27 - 6, 156 + r * 36, 54, 36); }
            paint(c, P.poly([[140, 156], [340, 156], [320, 110], [160, 110]]), darken(B.stone, 0.12), { seed: s, line: 4 });
            for (let q = 0; q < 4; q++) paint(c, P.rrect(160 + q * 44, 90, 28, 28, 3), B.stone, { seed: s + q, line: 3.5 });
            win(c, 224, 200, 32, 54, g); door(c, 218, 340, 44, 76, '#5a3a24');
            break;
        }
        case 'dome': {
            wall(90, 230, 300, 186, B.wall, 14);
            win(c, 128, 280, 50, 62, g); win(c, 302, 280, 50, 62, g);
            door(c, 208, 322, 64, 94, '#8a4a2a');
            paint(c, P.custom([140, 90, 200, 160], (k) => { k.beginPath(); k.moveTo(140, 236); k.bezierCurveTo(120, 160, 200, 140, 240, 70); k.bezierCurveTo(280, 140, 360, 160, 340, 236); k.closePath(); }), B.roof, { seed: s, tex: 1.2, line: 4.5 });
            line(c, 240, 70, 240, 34, '#e8c860', 5); paint(c, P.ellipse(240, 28, 9, 9), '#f4d058', { line: 3 });
            for (const bx of [140, 340]) { paint(c, P.rrect(bx - 20, 196, 40, 40, 8), B.roof2, { seed: s + bx, line: 3.5 }); }
            break;
        }
        case 'elf': {
            wall(120, 220, 240, 196, B.wall, 60);
            paint(c, P.custom([80, 60, 320, 190], (k) => { k.beginPath(); k.moveTo(80, 230); k.bezierCurveTo(100, 150, 210, 120, 240, 50); k.bezierCurveTo(270, 120, 380, 150, 400, 230); k.quadraticCurveTo(240, 190, 80, 230); k.closePath(); }), lin(c, 0, 50, 0, 230, [[0, '#9adaaa'], [1, B.roof]]), { base: B.roof, seed: s, tex: 1.3, line: 4.5 });
            win(c, 214, 150, 52, 62, g); win(c, 150, 270, 44, 64, g); win(c, 286, 270, 44, 64, g);
            door(c, 214, 330, 52, 86, '#9a7a4a');
            for (let i = 0; i < 3; i++) { glow(g, 120 + i * 120, 232, 30, '#c8ffd8', 0.7); paint(c, P.ellipse(120 + i * 120, 236, 9, 12), '#e8ffe8', { line: 2.5, tex: 0 }); }
            break;
        }
        case 'long': {
            wall(60, 250, 360, 166, B.wall, 8);
            for (let q = 0; q < 12; q++) line(c, 70 + q * 30, 254, 70 + q * 30, 414, alpha(INK, 0.35), 3);
            paint(c, P.poly([[36, 262], [440, 262], [398, 160], [80, 160]]), B.roof, { seed: s, tex: 1.4, line: 4.5 });
            c.fillStyle = '#ffffff'; for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(120 + i * 38, 176 + (i % 2) * 5, 30, 12, 0, 0, 7); c.fill(); }
            win(c, 100, 300, 46, 50, g); win(c, 334, 300, 46, 50, g); door(c, 208, 316, 64, 100, '#4a2a1a');
            for (const dx of [58, 408]) { paint(c, P.poly([[dx - 10, 262], [dx + 10, 262], [dx, 120]]), B.timber, { line: 3 }); }
            break;
        }
        case 'stall': {
            line(c, 100, 420, 100, 200, '#7a5030', 10); line(c, 380, 420, 380, 200, '#7a5030', 10);
            const aw = P.poly([[70, 214], [410, 214], [440, 150], [40, 150]]);
            paint(c, aw, '#f2ead8', { seed: s, line: 4.5 });
            c.save(); aw.draw(c); c.clip(); for (let i = 0; i < 7; i += 2) { c.fillStyle = alpha(B.roof, 0.9); c.fillRect(40 + i * 58, 140, 58, 90); } c.restore(); aw.draw(c); ink(c, 4.5);
            paint(c, P.rrect(86, 320, 308, 96, 8), '#a8784a', { seed: s + 1, tex: 1.2 });
            for (let i = 0; i < 6; i++) paint(c, P.ellipse(120 + i * 48, 318, 20, 14), ['#d8503a', '#e8b84a', '#7ab84a', '#8a6ad0', '#f08a5a', '#58a8d8'][i], { seed: s + i, line: 3, tex: 0.6 });
            break;
        }
        case 'stable': {
            wall(80, 236, 320, 180, '#9a6a44', 6);
            for (let q = 0; q < 10; q++) line(c, 86 + q * 34, 240, 86 + q * 34, 414, alpha(INK, 0.3), 3);
            gable(c, 80, 130, 320, 120, B.roof2, darken(B.roof2, 0.2), s, 22);
            paint(c, P.rrect(190, 290, 100, 126, 6), '#3a2418', { line: 4 });
            line(c, 190, 290, 290, 416, '#7a5030', 7); line(c, 290, 290, 190, 416, '#7a5030', 7);
            break;
        }
        default: break;
    }
    return { cv, gl };
}

// ------------------------------------------------------------ nature
/** A tree on a 256x320 canvas, trunk base at the bottom centre. */
export function tree(type = 'oak', seed = 1) {
    const cv = canvas(256, 320), c = ctx2(cv), s = seed * 17;
    const r = rnd(s);
    softShadow(c, 128, 304, 80, 12, 0.3);
    const trunk = (w, h, col = '#7a5030') => paint(c, P.smooth([[128 - w / 2, 306], [128 - w / 3, 306 - h], [128 + w / 3, 306 - h], [128 + w / 2, 306]], 0.3), col, { seed: s, tex: 1.2, line: 4 });
    const blob = (x, y, rx, ry, col, i) => paint(c, P.ellipse(x, y, rx, ry), lin(c, x - rx, y - ry, x + rx, y + ry, [[0, lighten(col, 0.25)], [1, darken(col, 0.12)]]), { base: col, seed: s + i, tex: 1.5, line: 4 });
    switch (type) {
        case 'oak': case 'elf': {
            const leaf = type === 'elf' ? ['#e8f4e0', '#b8e8c8', '#98d8b8'] : ['#5aa048', '#6cb455', '#4a8a3e'];
            trunk(34, 100, type === 'elf' ? '#e8e0d0' : '#7a5030');
            blob(128, 160, 70, 56, leaf[2], 1); blob(84, 130, 50, 44, leaf[0], 2); blob(172, 130, 50, 44, leaf[0], 3); blob(128, 96, 62, 52, leaf[1], 4);
            for (let i = 0; i < 5; i++) { c.fillStyle = type === 'elf' ? '#ffd0e8' : '#f8d868'; c.beginPath(); c.arc(80 + r() * 100, 90 + r() * 90, 5, 0, 7); c.fill(); }
            break;
        }
        case 'pine': case 'snowpine': {
            trunk(22, 70, '#6a4a30');
            const col = type === 'snowpine' ? '#3a6a58' : '#3f8a52';
            for (let i = 0; i < 4; i++) {
                const y = 250 - i * 56, w = 92 - i * 16;
                paint(c, P.poly([[128 - w, y], [128, y - 76], [128 + w, y]]), lin(c, 0, y - 76, 0, y, [[0, lighten(col, 0.2)], [1, darken(col, 0.1)]]), { base: col, seed: s + i, tex: 1.4, line: 4 });
                if (type === 'snowpine') paint(c, P.poly([[128 - w * 0.62, y - 30], [128, y - 76], [128 + w * 0.62, y - 30], [128 + w * 0.3, y - 38], [128, y - 26], [128 - w * 0.3, y - 38]]), '#f6fbff', { seed: s + i, tex: 0.6, line: 3 });
            }
            break;
        }
        case 'palm': {
            curve(c, 128, 306, 150, 200, 132, 100, '#8a6038', 20); curve(c, 128, 306, 150, 200, 132, 100, INK, 3);
            for (let i = 0; i < 6; i++) { const a = -2.8 + i * 0.58; const ex = 132 + Math.cos(a) * 100, ey = 100 + Math.sin(a) * 54 + 20; paint(c, P.smooth([[132, 100], [(132 + ex) / 2, 60 + Math.sin(a) * 30], [ex, ey], [(132 + ex) / 2, 100 + 14]], 0.5), '#58a850', { seed: s + i, tex: 1.2, line: 3.5 }); }
            c.fillStyle = '#8a5a30'; c.beginPath(); c.arc(124, 110, 8, 0, 7); c.arc(140, 112, 8, 0, 7); c.fill();
            break;
        }
        case 'dead': {
            trunk(28, 150, '#4a3a34');
            for (const [x1, y1, x2, y2] of [[128, 200, 80, 140], [128, 170, 180, 110], [128, 140, 100, 90], [80, 140, 56, 120]]) { stroke(c, [[x1, y1], [x2, y2]], '#4a3a34', 10); stroke(c, [[x1, y1], [x2, y2]], INK, 2); }
            break;
        }
        case 'crystal': {
            for (const [x, h, w, col] of [[96, 150, 40, '#9a7af0'], [140, 220, 48, '#b89aff'], [180, 120, 34, '#8a6ae0']]) paint(c, P.poly([[x - w / 2, 306], [x - w / 3, 306 - h * 0.7], [x, 306 - h], [x + w / 3, 306 - h * 0.7], [x + w / 2, 306]]), lin(c, x - w / 2, 0, x + w / 2, 0, [[0, lighten(col, 0.4)], [1, col]]), { seed: s + x, tex: 0.5, line: 4 });
            glow(c, 140, 160, 80, '#c8a8ff', 0.4);
            break;
        }
        default: break;
    }
    return cv;
}
export function bush(seed = 1, col = '#5aa048', flower = null) {
    const cv = canvas(160, 120), c = ctx2(cv), s = seed * 5;
    softShadow(c, 80, 108, 56, 8, 0.28);
    for (const [x, y, rx, ry, i] of [[50, 76, 36, 28, 1], [112, 76, 36, 28, 2], [80, 58, 42, 34, 3]]) paint(c, P.ellipse(x, y, rx, ry), lin(c, x - rx, y - ry, x + rx, y + ry, [[0, lighten(col, 0.25)], [1, darken(col, 0.1)]]), { base: col, seed: s + i, tex: 1.4, line: 3.5 });
    if (flower) for (let i = 0; i < 7; i++) { c.fillStyle = flower; c.beginPath(); c.arc(36 + hash3(s, i, 1) * 90, 40 + hash3(s, i, 2) * 50, 5, 0, 7); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); }
    return cv;
}
export function rock(seed = 1, col = '#a8a49c') {
    const cv = canvas(160, 120), c = ctx2(cv), s = seed * 5;
    softShadow(c, 80, 106, 60, 9, 0.3);
    paint(c, P.smooth([[22, 104], [30, 60], [64, 30], [104, 36], [132, 70], [140, 104]], 0.4), lin(c, 22, 30, 140, 104, [[0, lighten(col, 0.3)], [1, darken(col, 0.15)]]), { base: col, seed: s, tex: 1.2, line: 4 });
    paint(c, P.smooth([[84, 104], [96, 74], [118, 62], [140, 104]], 0.4), darken(col, 0.12), { seed: s + 1, tex: 1, line: 3 });
    return cv;
}
export function mountain(seed = 1, snow = true, col = '#8a8a98') {
    const cv = canvas(512, 360), c = ctx2(cv), s = seed * 5;
    softShadow(c, 256, 346, 220, 16, 0.25);
    const base = P.smooth([[20, 346], [120, 190], [190, 120], [250, 44], [310, 110], [380, 180], [496, 346]], 0.28);
    paint(c, base, lin(c, 0, 40, 0, 346, [[0, lighten(col, 0.25)], [1, darken(col, 0.12)]]), { base: col, seed: s, tex: 1.6, line: 5 });
    c.save(); base.draw(c); c.clip();
    paint(c, P.poly([[250, 44], [310, 110], [380, 180], [496, 346], [330, 346], [300, 220], [276, 120]]), alpha(darken(col, 0.3), 0.35), { tex: 0, line: false, shade: 0 });
    c.restore();
    if (snow) paint(c, P.smooth([[190, 120], [214, 94], [250, 44], [286, 90], [310, 110], [292, 102], [270, 132], [250, 106], [226, 140], [208, 108]], 0.3), '#f8fcff', { seed: s + 1, tex: 0.7, line: 3.5 });
    return cv;
}
export function tuft(seed = 1, col = '#6fb058') {
    const cv = canvas(96, 72), c = ctx2(cv);
    for (let i = 0; i < 7; i++) { const x = 18 + i * 10 + hash3(seed, i, 1) * 6, h = 28 + hash3(seed, i, 2) * 28; c.beginPath(); c.moveTo(x - 4, 66); c.quadraticCurveTo(x + (i - 3) * 3, 66 - h * 0.6, x + (i - 3) * 5, 66 - h); c.quadraticCurveTo(x + 6, 66 - h * 0.5, x + 5, 66); c.fillStyle = i % 2 ? col : lighten(col, 0.2); c.fill(); c.strokeStyle = alpha(INK, 0.7); c.lineWidth = 2; c.stroke(); }
    return cv;
}

// ------------------------------------------------------------ town props
export function barrel(seed = 1) {
    const cv = canvas(120, 140), c = ctx2(cv);
    softShadow(c, 60, 128, 44, 8, 0.3);
    paint(c, P.smooth([[22, 122], [16, 60], [30, 22], [90, 22], [104, 60], [98, 122]], 0.45), '#a8784a', { seed, tex: 1.4, line: 4 });
    for (const y of [40, 100]) { c.beginPath(); c.ellipse(60, y, 40, 8, 0, 0, Math.PI); c.strokeStyle = '#5a3a24'; c.lineWidth = 7; c.stroke(); }
    return cv;
}
export function crate(seed = 1) {
    const cv = canvas(130, 130), c = ctx2(cv);
    softShadow(c, 65, 120, 50, 8, 0.3);
    paint(c, P.rrect(16, 28, 98, 92, 6), '#c8985a', { seed, tex: 1.3, line: 4 });
    line(c, 20, 32, 110, 116, '#7a5a34', 7); line(c, 110, 32, 20, 116, '#7a5a34', 7);
    return cv;
}
export function lamp(seed = 1) {
    const cv = canvas(100, 260), c = ctx2(cv), g = ctx2(canvas(100, 260));
    softShadow(c, 50, 248, 24, 6, 0.3);
    line(c, 50, 246, 50, 60, '#3a3036', 9);
    paint(c, P.rrect(32, 24, 36, 48, 8), '#ffe08a', { tex: 0.1, line: 4, shade: 0.1 });
    paint(c, P.poly([[26, 28], [74, 28], [50, 6]]), '#3a3036', { line: 3.5 });
    return cv;
}
export function well(seed = 1) {
    const cv = canvas(200, 200), c = ctx2(cv);
    softShadow(c, 100, 184, 70, 10, 0.3);
    paint(c, P.smooth([[34, 176], [28, 110], [60, 92], [140, 92], [172, 110], [166, 176]], 0.3), '#b8b0a0', { seed, tex: 1.2, line: 4.5 });
    paint(c, P.ellipse(100, 98, 56, 18), '#3a5a78', { line: 4, tex: 0.3 });
    line(c, 44, 100, 44, 30, '#7a5030', 9); line(c, 156, 100, 156, 30, '#7a5030', 9);
    paint(c, P.poly([[28, 40], [172, 40], [100, 2]]), '#a8482e', { line: 4, seed });
    return cv;
}
export function fountain(seed = 1) {
    const cv = canvas(240, 240), c = ctx2(cv);
    softShadow(c, 120, 224, 90, 12, 0.3);
    paint(c, P.ellipse(120, 190, 96, 32), '#c8c0b0', { seed, tex: 1, line: 4.5 });
    paint(c, P.ellipse(120, 186, 82, 24), '#6ab0d8', { tex: 0.3, line: 3 });
    paint(c, P.rrect(104, 90, 32, 96, 10), '#c8c0b0', { line: 4 });
    paint(c, P.ellipse(120, 92, 44, 14), '#c8c0b0', { line: 4 });
    c.strokeStyle = 'rgba(200,236,255,0.9)'; c.lineWidth = 4; c.lineCap = 'round';
    for (const d of [-1, 1]) { c.beginPath(); c.moveTo(120, 80); c.quadraticCurveTo(120 + d * 40, 20, 120 + d * 60, 100); c.stroke(); }
    return cv;
}
export function signpost(seed = 1) {
    const cv = canvas(160, 220), c = ctx2(cv);
    softShadow(c, 80, 208, 36, 7, 0.3);
    line(c, 80, 206, 80, 40, '#6a4a30', 11);
    paint(c, P.poly([[20, 54], [110, 54], [130, 70], [110, 86], [20, 86]]), '#c8a070', { seed, tex: 1, line: 3.5 });
    paint(c, P.poly([[140, 100], [50, 100], [30, 116], [50, 132], [140, 132]]), '#d8b280', { seed: seed + 1, tex: 1, line: 3.5 });
    return cv;
}

// ------------------------------------------------------------ the merchant's wagon (tier 0-4)
export function wagon(tier = 0) {
    const cv = canvas(420, 300), c = ctx2(cv), s = 5 + tier;
    softShadow(c, 210, 280, 170, 16, 0.32);
    const L = 150 + tier * 20;      // cart body half-length
    const x0 = 210 - L / 2, x1 = 210 + L / 2;
    // canopy (higher tiers)
    if (tier >= 1) {
        const can = P.custom([x0, 40, L, 130], (k) => { k.beginPath(); k.moveTo(x0 + 6, 172); k.bezierCurveTo(x0 + 6, 40, x1 - 6, 40, x1 - 6, 172); k.closePath(); });
        paint(c, can, lin(c, 0, 40, 0, 172, [[0, '#fff4dc'], [1, '#e8d4a8']]), { seed: s, tex: 1.2, line: 4.5 });
        c.save(); can.draw(c); c.clip();
        for (let i = 0; i < 6; i++) { c.fillStyle = alpha(['#3f8f78', '#c8602e', '#4a6aa8', '#8a4ab0', '#c8a030'][tier] || '#3f8f78', 0.65); c.fillRect(x0 + 6 + i * (L / 6) + (i % 2 ? 0 : L / 12), 40, L / 12, 140); }
        c.restore(); can.draw(c); ink(c, 4.5);
    }
    // bed
    paint(c, P.smooth([[x0 - 12, 170], [x1 + 14, 170], [x1 - 6, 232], [x0 + 6, 232]], 0.2), lin(c, 0, 170, 0, 232, [[0, '#b88a58'], [1, '#8a5e38']]), { seed: s + 1, tex: 1.4, line: 4.5 });
    for (let i = 1; i < 4; i++) line(c, x0 + (L * i) / 4, 176, x0 + (L * i) / 4 + 2, 228, alpha(INK, 0.35), 3);
    // goods peeking out
    if (tier === 0) for (const [x, col] of [[x0 + 24, '#e8c66a'], [x0 + 62, '#c8603a'], [x0 + 100, '#6a8ac8']]) paint(c, P.rrect(x, 128, 40, 48, 8), col, { seed: x, tex: 1, line: 3.5 });
    // tongue and handles
    stroke(c, [[x1 + 6, 196], [x1 + 76, 214]], '#6a4a30', 9);
    if (tier === 0) { stroke(c, [[x0 - 4, 196], [x0 - 48, 160]], '#6a4a30', 8); stroke(c, [[x0 - 48, 160], [x0 - 64, 168]], '#6a4a30', 9); }
    // wheels
    for (const wx of [x0 + 22, x1 - 22]) {
        paint(c, P.ellipse(wx, 246, 40, 40), '#8a5a34', { seed: wx, tex: 0.8, line: 5 });
        paint(c, P.ellipse(wx, 246, 28, 28), '#d8b078', { seed: wx + 1, tex: 0.6, line: 3 });
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(c, wx, 246, wx + Math.cos(a) * 28, 246 + Math.sin(a) * 28, '#6a4a30', 3.5); }
        paint(c, P.ellipse(wx, 246, 7, 7), '#4a3424', { line: 2.5, tex: 0 });
    }
    // lantern
    paint(c, P.rrect(x1 - 6, 150, 18, 24, 5), '#ffd878', { line: 3, tex: 0 });
    return cv;
}
