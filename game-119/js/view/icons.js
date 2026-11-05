// Painted item icons for the inventory: every material and every piece of gear, drawn in code on a 112px
// canvas and cached as data URLs. Gear takes the colour of its metal grade; fine pieces sparkle, level 10 glows.

import { canvas, ctx2, P, paint, ink, INK, mix, lighten, darken, alpha, lin, rad, glow, dab, curve, line, stroke, cached } from './paint.js';
import { MATS, FAMS, gradeOf, LINE } from '../sim/data/items.js';

const S = 112;
export const GRADE_COL = ['#c9783f', '#a9b0ba', '#cdd8e8', '#8fe0f0', '#ffe28a'];
const HANDLE = '#8a5a34';
const o = { tex: 0.7, line: 3 };

function ore(c, col) {
    paint(c, P.smooth([[18, 84], [14, 52], [36, 28], [70, 24], [96, 50], [92, 86]], 0.45), col, { ...o, seed: 3 });
    for (const [x, y, r] of [[40, 52, 7], [64, 44, 6], [70, 68, 8], [46, 72, 5]]) paint(c, P.ellipse(x, y, r, r * 0.8), lighten(col, 0.45), { tex: 0, line: 2, shade: 0 });
}
function ingot(c, col) {
    for (const [x, y, k] of [[14, 64, 0], [48, 64, 0], [31, 40, 1]]) paint(c, P.poly([[x, y + 30], [x + 12, y], [x + 62, y], [x + 54, y + 30]]), lin(c, 0, y, 0, y + 30, [[0, lighten(col, 0.3)], [1, darken(col, 0.1)]]), { ...o, base: col, seed: x + k });
}
function cloth(c, col) {
    paint(c, P.rrect(14, 34, 84, 50, 14), col, { ...o, seed: 2 });
    paint(c, P.ellipse(98, 59, 12, 25), darken(col, 0.18), { ...o, seed: 4 });
    paint(c, P.ellipse(98, 59, 6, 14), lighten(col, 0.3), { tex: 0, line: 2.5 });
    for (let i = 0; i < 4; i++) curve(c, 24 + i * 16, 38, 30 + i * 16, 58, 24 + i * 16, 80, alpha(darken(col, 0.4), 0.4), 2.5);
}
function wood(c, col) {
    for (const [y, a] of [[70, 0], [46, 0], [22, 0]]) { paint(c, P.rrect(12, y, 88, 24, 8), lin(c, 0, y, 0, y + 24, [[0, lighten(col, 0.25)], [1, darken(col, 0.1)]]), { ...o, base: col, seed: y }); line(c, 20, y + 12, 92, y + 12, alpha(darken(col, 0.5), 0.4), 2); }
    paint(c, P.ellipse(100, 82, 8, 12), lighten(col, 0.4), { tex: 0, line: 2.5 });
}
function gem(c, col) {
    glow(c, 56, 60, 52, col, 0.35);
    paint(c, P.poly([[22, 44], [40, 20], [72, 20], [90, 44], [56, 94]]), lin(c, 22, 20, 90, 94, [[0, lighten(col, 0.5)], [0.5, col], [1, darken(col, 0.25)]]), { ...o, base: col, tex: 0.3, seed: 6 });
    stroke(c, [[22, 44], [90, 44]], alpha(INK, 0.5), 2); stroke(c, [[40, 20], [48, 44], [56, 94], [64, 44], [72, 20]], alpha(INK, 0.4), 2);
    dab(c, 42, 34, 8, 4, 0.8);
}
function herb(c, col) {
    stroke(c, [[56, 100], [56, 40]], '#4a8a3a', 5);
    for (const [x, y, a] of [[56, 30, 0], [36, 52, -0.9], [76, 52, 0.9], [38, 76, -0.7], [74, 76, 0.7]]) { c.save(); c.translate(x, y); c.rotate(a); paint(c, P.ellipse(0, 0, 11, 22), col, { ...o, seed: x + y }); line(c, 0, -16, 0, 16, alpha(darken(col, 0.4), 0.6), 2); c.restore(); }
}
function food(c, col, id) {
    if (id === 'grain') { stroke(c, [[56, 100], [56, 30]], '#b8944a', 5); for (let i = 0; i < 5; i++) { for (const d of [-1, 1]) { c.save(); c.translate(56 + d * 8, 30 + i * 13); c.rotate(d * 0.7); paint(c, P.ellipse(0, 0, 6, 12), col, { tex: 0.3, line: 2.2 }); c.restore(); } } }
    else if (id === 'jerky') { for (let i = 0; i < 3; i++) paint(c, P.smooth([[18, 30 + i * 24], [90, 26 + i * 24], [96, 42 + i * 24], [24, 50 + i * 24]], 0.4), mix(col, '#5a2a1a', i * 0.2), { ...o, seed: i }); }
    else if (id === 'honey') { paint(c, P.rrect(26, 36, 60, 58, 16), '#f6d070', { ...o, seed: 4 }); paint(c, P.rrect(32, 22, 48, 18, 6), '#8a5a34', { tex: 0.5, line: 3 }); paint(c, P.smooth([[44, 36], [68, 36], [66, 52], [56, 60], [46, 52]], 0.4), col, { tex: 0, line: 0 }); }
    else if (id === 'spice') { paint(c, P.smooth([[26, 96], [20, 56], [44, 36], [68, 36], [92, 56], [86, 96]], 0.4), '#c8883a', { ...o, seed: 6 }); paint(c, P.ellipse(56, 38, 20, 8), col, { tex: 0.2, line: 2.5 }); stroke(c, [[42, 30], [56, 12], [72, 30]], '#6a4a30', 4); }
    else { glow(c, 56, 58, 50, '#ffb050', 0.5); paint(c, P.ellipse(56, 62, 34, 32), rad(c, 46, 50, 4, 40, [[0, lighten(col, 0.45)], [1, col]]), { ...o, base: col, seed: 8 }); paint(c, P.ellipse(68, 28, 14, 8, -0.6), '#58a850', { tex: 0, line: 2.5 }); }
}
function trade(c, col, id) {
    if (id === 'wine') { paint(c, P.smooth([[44, 100], [40, 56], [50, 40], [50, 14], [62, 14], [62, 40], [72, 56], [68, 100]], 0.35), col, { ...o, seed: 5 }); paint(c, P.rrect(48, 8, 16, 14, 3), '#e8c860', { tex: 0, line: 2.5 }); dab(c, 48, 62, 4, 12, 0.6, 0); }
    else if (id === 'furs') { paint(c, P.smooth([[14, 40], [40, 24], [76, 24], [100, 44], [94, 80], [60, 92], [26, 82]], 0.45), col, { ...o, tex: 1.6, seed: 2 }); for (let i = 0; i < 8; i++) stroke(c, [[30 + i * 8, 40 + (i % 3) * 14], [28 + i * 8, 54 + (i % 3) * 14]], alpha(darken(col, 0.4), 0.5), 2); }
    else if (id === 'pearls') { for (const [x, y, r] of [[36, 66, 18], [72, 62, 20], [54, 36, 16]]) { paint(c, P.ellipse(x, y, r, r), rad(c, x - 5, y - 6, 2, r, [[0, '#ffffff'], [1, '#dcd6e8']]), { tex: 0, line: 2.5, shade: 0 }); } }
    else if (id === 'amber') { glow(c, 56, 60, 44, '#ffb030', 0.4); paint(c, P.smooth([[20, 74], [26, 40], [58, 24], [92, 44], [86, 80], [50, 90]], 0.45), lin(c, 20, 24, 92, 90, [[0, '#ffd070'], [1, '#c87010']]), { ...o, tex: 0.3, seed: 1 }); dab(c, 44, 44, 9, 5, 0.7); }
    else if (id === 'perfume') { paint(c, P.ellipse(56, 70, 32, 28), col, { ...o, tex: 0.3, seed: 3 }); paint(c, P.rrect(46, 22, 20, 24, 4), '#e8c860', { tex: 0, line: 2.5 }); paint(c, P.ellipse(56, 18, 14, 8), '#f4a0c0', { tex: 0, line: 2.5 }); dab(c, 42, 62, 6, 10, 0.6, 0.2); }
    else { paint(c, P.smooth([[40, 100], [34, 66], [44, 48], [40, 16], [74, 16], [70, 48], [80, 66], [74, 100]], 0.35), alpha(col, 0.85), { ...o, tex: 0.2, seed: 5 }); dab(c, 46, 64, 4, 14, 0.7, 0); }
}
function gearColors(fam, lv) {
    const g = gradeOf(lv), col = GRADE_COL[g - 1];
    return { g, col };
}
function drawGear(c, fam, lv) {
    const { g, col } = gearColors(fam, lv);
    const metal = lin(c, 0, 0, S, 0, [[0, lighten(col, 0.4)], [0.5, col], [1, darken(col, 0.18)]]);
    const herbCol = MATS[LINE.herb[g - 1]].color;
    if (lv >= 9) glow(c, 56, 56, 58, '#ffe070', 0.55);
    switch (fam) {
        case 'sword':
            paint(c, P.poly([[50, 70], [62, 70], [64, 14], [56, 4], [48, 14]]), metal, { tex: 0.2, line: 3, base: col, seed: lv });
            paint(c, P.rrect(36, 68, 40, 10, 4), '#d8a838', { tex: 0.3, line: 3 }); paint(c, P.rrect(51, 76, 10, 24, 4), HANDLE, { tex: 0.4, line: 3 }); paint(c, P.ellipse(56, 104, 7, 5), '#d8a838', { tex: 0, line: 2.5 });
            break;
        case 'armor':
            paint(c, P.smooth([[22, 28], [40, 18], [56, 26], [72, 18], [90, 28], [96, 52], [82, 58], [80, 96], [32, 96], [30, 58], [16, 52]], 0.35), metal, { tex: 0.5, line: 3, base: col, seed: lv });
            line(c, 56, 28, 56, 94, alpha(INK, 0.35), 3); paint(c, P.rrect(32, 72, 48, 9, 3), '#6a4630', { tex: 0, line: 2.5 }); dab(c, 40, 40, 8, 5, 0.6);
            break;
        case 'helm':
            paint(c, P.smooth([[18, 86], [18, 50], [32, 22], [56, 12], [80, 22], [94, 50], [94, 86], [76, 86], [72, 64], [40, 64], [36, 86]], 0.35), metal, { tex: 0.4, line: 3, base: col, seed: lv });
            paint(c, P.rrect(50, 20, 12, 52, 4), darken(col, 0.1), { tex: 0, line: 2.5 }); paint(c, P.smooth([[56, 14], [80, 2], [100, 6], [84, 22]], 0.4), '#d8503a', { tex: 0.5, line: 2.5 });
            break;
        case 'shield':
            paint(c, P.smooth([[18, 20], [94, 20], [92, 64], [56, 100], [20, 64]], 0.4), metal, { tex: 0.5, line: 3.5, base: col, seed: lv });
            paint(c, P.ellipse(56, 52, 14, 14), '#d8a838', { tex: 0.2, line: 2.5 }); stroke(c, [[56, 22], [56, 96]], alpha(INK, 0.3), 2.5); dab(c, 36, 34, 8, 5, 0.55);
            break;
        case 'boots':
            paint(c, P.smooth([[22, 16], [60, 16], [62, 56], [102, 66], [102, 94], [20, 94]], 0.3), lin(c, 0, 16, 0, 94, [[0, lighten(col, 0.1)], [1, darken(col, 0.2)]]), { tex: 0.9, line: 3, base: col, seed: lv });
            paint(c, P.rrect(18, 88, 86, 10, 4), '#4a3424', { tex: 0, line: 2.5 }); paint(c, P.rrect(22, 14, 40, 12, 4), lighten(col, 0.35), { tex: 0.3, line: 2.5 });
            break;
        case 'amulet':
            curve(c, 24, 12, 56, 52, 88, 12, '#d8b858', 4);
            paint(c, P.ellipse(56, 66, 24, 24), '#d8b858', { tex: 0.3, line: 3 });
            paint(c, P.poly([[56, 46], [72, 62], [56, 88], [40, 62]]), lin(c, 40, 46, 72, 88, [[0, lighten(MATS[LINE.gem[g - 1]].color, 0.5)], [1, MATS[LINE.gem[g - 1]].color]]), { tex: 0.2, line: 2.5 });
            glow(c, 56, 66, 34, MATS[LINE.gem[g - 1]].color, 0.5);
            break;
        case 'potion':
            paint(c, P.smooth([[36, 100], [24, 66], [44, 48], [44, 18], [68, 18], [68, 48], [88, 66], [76, 100]], 0.35), 'rgba(220,240,255,0.55)', { tex: 0, line: 3, shade: 0 });
            paint(c, P.smooth([[34, 98], [27, 72], [44, 56], [68, 56], [85, 72], [78, 98]], 0.35), lin(c, 0, 56, 0, 98, [[0, lighten(herbCol, 0.3)], [1, herbCol]]), { tex: 0.3, line: 0, base: herbCol });
            paint(c, P.rrect(44, 8, 24, 14, 4), '#8a5a34', { tex: 0.4, line: 2.5 }); dab(c, 42, 70, 4, 11, 0.6, 0.1);
            break;
        case 'elixir':
            paint(c, P.ellipse(56, 70, 32, 30), 'rgba(220,240,255,0.55)', { tex: 0, line: 3, shade: 0 });
            paint(c, P.ellipse(56, 74, 28, 24), lin(c, 0, 50, 0, 98, [[0, lighten(herbCol, 0.4)], [1, herbCol]]), { tex: 0.3, line: 0, base: herbCol });
            paint(c, P.rrect(48, 18, 16, 26, 4), 'rgba(220,240,255,0.55)', { tex: 0, line: 3, shade: 0 }); paint(c, P.rrect(44, 8, 24, 12, 4), '#8a5a34', { tex: 0.4, line: 2.5 });
            glow(c, 56, 74, 30, herbCol, 0.35); dab(c, 42, 62, 5, 9, 0.6, 0.3);
            break;
        case 'rations':
            paint(c, P.smooth([[18, 96], [16, 52], [38, 34], [76, 34], [98, 52], [96, 96]], 0.4), '#d8b078', { tex: 1, line: 3, seed: lv });
            stroke(c, [[20, 58], [94, 58]], '#8a5a34', 5); paint(c, P.ellipse(40, 30, 14, 10), MATS[LINE.food[g - 1]].color, { tex: 0.3, line: 2.5 }); paint(c, P.ellipse(70, 26, 14, 12), '#e8c860', { tex: 0.3, line: 2.5 });
            break;
        case 'kit':
            paint(c, P.rrect(24, 28, 64, 72, 18), '#b8783c', { tex: 1, line: 3, seed: lv });
            paint(c, P.rrect(30, 12, 52, 26, 12), '#e8d8a8', { tex: 0.6, line: 3 }); paint(c, P.rrect(36, 64, 40, 28, 8), darken('#b8783c', 0.18), { tex: 0.5, line: 2.5 });
            stroke(c, [[24, 54], [88, 54]], col, 6);
            break;
        default: break;
    }
    if (lv % 2 === 0 || lv >= 9) { // sparkle for fine pieces
        c.fillStyle = '#fffbe0'; c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath();
        for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 4, r = i % 2 ? 3 : (lv >= 9 ? 11 : 8); c.lineTo(94 + Math.cos(a) * r, 18 + Math.sin(a) * r); }
        c.closePath(); c.fill(); c.stroke();
    }
}

export function iconCanvas(t, lv = 0) {
    const cv = canvas(S, S), c = ctx2(cv);
    c.save(); c.translate(0, 0);
    const m = MATS[t];
    if (m) {
        const col = m.color;
        switch (m.cat) {
            case 'ore': if (t === 'coal') { ore(c, '#3a3a44'); } else ore(c, col); break;
            case 'ingot': ingot(c, col); break;
            case 'cloth': cloth(c, col); break;
            case 'wood': wood(c, col); break;
            case 'gem': gem(c, col); break;
            case 'herb': herb(c, col); break;
            case 'food': food(c, col, t); break;
            case 'misc': paint(c, P.smooth([[22, 96], [16, 52], [42, 30], [72, 30], [98, 52], [92, 96]], 0.4), '#f0f0f0', { ...o, seed: 5 }); stroke(c, [[30, 44], [84, 44]], '#8a8a98', 4); break;
            case 'trade': trade(c, col, t); break;
            case 'quest': paint(c, P.rrect(18, 28, 76, 62, 8), '#e8d8a8', { ...o, seed: 9 }); stroke(c, [[18, 59], [94, 59]], '#c8402e', 5); stroke(c, [[56, 28], [56, 90]], '#c8402e', 5); paint(c, P.ellipse(56, 59, 9, 9), '#c8402e', { tex: 0, line: 2.5 }); break;
            default: break;
        }
    } else drawGear(c, t, lv);
    c.restore();
    return cv;
}
export const iconUrl = (t, lv = 0) => cached(`icon:${t}:${lv}`, () => iconCanvas(t, lv).toDataURL('image/png'));

// ------------------------------------------------------------ small UI glyphs (inline SVG strings)
export const GLYPH = {
    coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#f4d058" stroke="#6a4a1a" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#c8962a" stroke-width="1.6"/></svg>',
    weight: '<svg viewBox="0 0 24 24"><path d="M6 21l2-11h8l2 11z" fill="#8a94a4" stroke="#3b2417" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="6" r="3" fill="none" stroke="#3b2417" stroke-width="2"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" fill="#c8924a" stroke="#3b2417" stroke-width="2"/><path d="M3 12h18M12 3v18" stroke="#3b2417" stroke-width="1.6"/></svg>',
    scroll: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="3" fill="#f4e6c0" stroke="#3b2417" stroke-width="2"/><path d="M8 9h8M8 13h8M8 17h5" stroke="#3b2417" stroke-width="1.6"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 4h7a2 2 0 012 2v14a2 2 0 00-2-2H4zM20 4h-7v16a2 2 0 012-2h5z" fill="#7a4a2a" stroke="#3b2417" stroke-width="2" stroke-linejoin="round"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="#e8d8a8" stroke="#3b2417" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="#3b2417" stroke-width="1.6"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="#3b2417" stroke-width="3" stroke-linecap="round"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#ffd84a" stroke="#6a4a1a" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="#6a4a1a" stroke-width="2" stroke-linecap="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="#8a94a4" stroke="#3b2417" stroke-width="2"/><path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="#3b2417" stroke-width="2"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 2l3 7 7 .6-5.3 4.7 1.7 7.2L12 17.8 5.6 21.5l1.7-7.2L2 9.6 9 9z" fill="#ffd84a" stroke="#6a4a1a" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    fav: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z" fill="#e8506a" stroke="#3b2417" stroke-width="2" stroke-linejoin="round"/></svg>',
    junk: '<svg viewBox="0 0 24 24"><path d="M5 7h14l-1.5 14h-11zM3 7h18M9 7V4h6v3" fill="#b8b8c4" stroke="#3b2417" stroke-width="2" stroke-linejoin="round"/></svg>',
    rotate: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 11-3-6.2M20 4v5h-5" fill="none" stroke="#3b2417" stroke-width="2.5" stroke-linecap="round"/></svg>',
    sort: '<svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h10M5 18h6" stroke="#3b2417" stroke-width="3" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#3b2417" stroke-width="3" stroke-linecap="round"/></svg>',
    hammer: '<svg viewBox="0 0 24 24"><path d="M5 20L14 11" stroke="#8a5a34" stroke-width="3" stroke-linecap="round"/><rect x="10" y="3" width="11" height="7" rx="2" transform="rotate(35 15 7)" fill="#9aa4b4" stroke="#3b2417" stroke-width="2"/></svg>',
};
