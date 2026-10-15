// Buildings and dungeon entrances, painted to fit their footprint (w × h tiles). The door is
// always the middle of the bottom row, where the sim put the door tile. Each returns its canvas,
// how far it rises above the footprint, and where its windows are (they glow at night).

import { canvas, painter, outline, shade, nz } from './paint.js';

const cache = new Map();
const OUT = '#2a2226';

export function building(b, t = 0) {
    const anim = b.style === 'mill' || b.style === 'lighthouse' || b.style === 'observatory';
    const fr = anim ? Math.floor(t * 4) % 8 : 0;
    const key = `${b.style}:${b.w}:${b.h}:${b.id || ''}:${fr}`;
    if (cache.has(key)) return cache.get(key);
    const W = b.w * 16, Hf = b.h * 16;
    const up = RISE[b.style] ?? 8;
    const cv = canvas(W + 4, Hf + up);
    const P = painter(cv.g);
    const win = [];
    const S = { P, W, H: Hf + up, top: up, foot: Hf, door: Math.floor(b.w / 2) * 16, win, fr, b };
    (DRAW[b.style] || DRAW.cottage)(S);
    outline(cv.c, OUT);
    const out = { c: cv.c, oy: -up, win };
    cache.set(key, out);
    return out;
}

const RISE = {
    cottage: 10, shop: 10, bakery: 14, inn: 12, library: 26, castle: 30, tower: 34, mill: 28, lodge: 12, hut: 8, cabin: 10,
    mousehouse: 6, burrow: 18, oak: 34, cavemouth: 10, kiln: 18, mine: 8, icetemple: 22, lighthouse: 40, glasshouse: 14,
    ruin: 10, abbey: 36, observatory: 26,
};

// ------------------------------------------------------------------ parts
function door(S, col = '#7a4a2a', wide = 10, arch = false) {
    const { P, H } = S;
    const x = S.door + 8 - wide / 2;
    P.R(x - 1, H - 14, wide + 2, 14, shade(col, -0.45));
    P.R(x, H - 13, wide, 13, col);
    P.R(x, H - 13, wide, 1, shade(col, 0.25));
    P.R(x + wide / 2, H - 12, 1, 12, shade(col, -0.25));
    P.px(x + wide - 3, H - 6, '#e8c040');
    if (arch) { P.R(x + 1, H - 15, wide - 2, 1, shade(col, -0.45)); P.R(x + 2, H - 16, wide - 4, 1, shade(col, -0.45)); }
    P.R(x - 2, H - 1, wide + 4, 1, '#8a7a6a');
}
function windowAt(S, x, y, w = 6, h = 6, frame = '#f2ead6', glass = '#7ab8e8') {
    const { P } = S;
    P.R(x - 1, y - 1, w + 2, h + 2, frame);
    P.R(x, y, w, h, glass);
    P.R(x, y, w, 1, '#cfe8ff');
    P.R(x + Math.floor(w / 2), y, 1, h, frame);
    P.R(x, y + Math.floor(h / 2), w, 1, frame);
    S.win.push([x + w / 2, y + h / 2]);
}
function walls(S, y0, col, pattern = 'plaster') {
    const { P, W, H } = S;
    P.R(0, y0, W, H - y0, col);
    P.R(0, y0, W, 1, shade(col, 0.2));
    P.R(0, H - 2, W, 2, shade(col, -0.3));
    if (pattern === 'timber') {
        for (let x = 0; x < W; x += 12) P.R(x, y0, 2, H - y0, '#6a4a2e');
        P.R(0, y0 + Math.floor((H - y0) / 2), W, 2, '#6a4a2e');
    } else if (pattern === 'stone') {
        for (let y = y0 + 2; y < H; y += 5) { P.R(0, y + 4, W, 1, shade(col, -0.18)); for (let x = (y % 2) * 4; x < W; x += 9) P.R(x, y, 1, 4, shade(col, -0.18)); }
    } else if (pattern === 'logs') {
        for (let y = y0 + 2; y < H; y += 4) { P.R(0, y + 3, W, 1, shade(col, -0.3)); P.px(1, y + 1, shade(col, 0.2)); P.px(W - 2, y + 1, shade(col, 0.2)); }
    } else if (pattern === 'brick') {
        for (let y = y0 + 2; y < H; y += 3) { P.R(0, y + 2, W, 1, shade(col, -0.2)); for (let x = (y % 2) * 3; x < W; x += 6) P.px(x, y, shade(col, -0.2)); }
    }
}
function roof(S, y0, y1, col, kind = 'tile', overhang = 2) {
    const { P, W } = S;
    const h = y1 - y0;
    for (let y = 0; y < h; y++) {
        const inset = Math.max(0, Math.round((h - y) * 0.15)) - overhang;
        P.R(Math.max(0, inset) - (overhang && y > h - 3 ? 1 : 0), y0 + y, W - Math.max(0, inset) * 2 + (overhang && y > h - 3 ? 2 : 0), 1, col);
    }
    if (kind === 'tile') for (let y = y0 + 2; y < y1; y += 3) { P.R(1, y, W - 2, 1, shade(col, -0.18)); for (let x = (y % 2) * 3; x < W; x += 6) P.px(x, y + 1, shade(col, -0.1)); }
    if (kind === 'thatch') for (let y = y0 + 1; y < y1; y += 2) for (let x = (y % 3); x < W; x += 3) P.px(x, y, shade(col, -0.2));
    if (kind === 'slate') for (let y = y0 + 1; y < y1; y += 3) P.R(1, y, W - 2, 1, shade(col, 0.15));
    P.R(0, y1 - 1, W, 1, shade(col, -0.4));
    P.R(2, y0, W - 4, 1, shade(col, 0.25));
}
function chimney(S, x, y, h = 8) {
    const { P } = S;
    P.R(x, y, 5, h, '#8a5a4a'); P.R(x - 1, y, 7, 2, '#6a4038');
    P.px(x + 2, y - 2, 'rgba(220,220,230,0.8)'); P.px(x + 3, y - 4, 'rgba(220,220,230,0.6)');
}
function signboard(S, x, y, col, iconFn) {
    const { P } = S;
    P.R(x, y, 10, 7, col); P.R(x, y, 10, 1, shade(col, 0.3)); P.R(x + 4, y - 2, 2, 2, '#4a4a54');
    if (iconFn) iconFn(P, x + 2, y + 1);
}

// ------------------------------------------------------------------ styles
const DRAW = {
    cottage(S) {
        const { b } = S;
        const roofCol = ['#b0503a', '#5a6a9a', '#7a5a8a', '#c0703a'][(b.id || '').length % 4];
        const wall = (b.id || '').length % 2 ? '#efe0c0' : '#e8d6b4';
        const wy = S.top + Math.round(S.foot * 0.48);
        walls(S, wy, wall, (b.id || '').length % 3 === 0 ? 'timber' : 'plaster');
        roof(S, 2, wy + 2, roofCol, b.style === 'cottage' && (b.id || '').length % 3 === 1 ? 'thatch' : 'tile');
        chimney(S, S.W - 14, 0);
        door(S);
        const wy2 = wy + 5;
        windowAt(S, 6, wy2); windowAt(S, S.W - 12, wy2);
        if (S.W > 70) windowAt(S, S.door - 8, wy2);
        flowers(S);
    },
    shop(S) {
        const { b } = S;
        const wy = S.top + Math.round(S.foot * 0.45);
        const awn = { pips: '#3f8a4a', mabels: '#b84a6a', stationers: '#2a3a6a', curio: '#6a3a8a', market: '#c0703a', fishshop: '#3a8a9a', driftwood: '#c8a060' }[b.id] || '#a04a3a';
        walls(S, wy, '#eadcc0', 'timber');
        roof(S, 2, wy + 2, '#8a4a3a', 'tile');
        // awning
        for (let x = 0; x < S.W; x += 4) S.P.R(x, wy + 2, 4, 5, (x / 4) % 2 ? awn : '#f2efe2');
        S.P.R(0, wy + 7, S.W, 1, shade(awn, -0.4));
        door(S, '#6a4a2a');
        windowAt(S, 5, wy + 11, 10, 7); windowAt(S, S.W - 15, wy + 11, 10, 7);
        signboard(S, S.door + 12, wy - 6, '#c8a060', (P, x, y) => P.R(x + 1, y + 1, 4, 4, awn));
    },
    bakery(S) {
        DRAW.cottage(S);
        signboard(S, S.door + 12, S.top + 8, '#e0c080', (P, x, y) => { P.ellipse(x + 3, y + 3, 3, 2, '#c08040'); });
    },
    inn(S) {
        const wy = S.top + Math.round(S.foot * 0.42);
        walls(S, wy, '#e0c8a0', 'timber');
        roof(S, 2, wy + 2, '#5a6a8a', 'slate');
        chimney(S, 8, 0);
        door(S, '#7a4a2a', 12);
        windowAt(S, 5, wy + 6); windowAt(S, S.W - 11, wy + 6); windowAt(S, 5, wy + 18); windowAt(S, S.W - 11, wy + 18);
        signboard(S, S.door - 14, wy - 4, '#6a4a2a', (P, x, y) => { P.ellipse(x + 3, y + 3, 2, 2, '#e0c060'); P.px(x + 2, y + 2, '#2a2a2a'); P.px(x + 4, y + 2, '#2a2a2a'); });
    },
    library(S) {
        const { P, W } = S;
        const wy = S.top + 20;
        // the great roof with a lantern cupola
        roof(S, 10, wy + 2, '#3e5a7a', 'slate', 3);
        P.R(W / 2 - 10, 0, 20, 12, '#4a6a8a'); P.R(W / 2 - 8, 2, 16, 8, '#ffe08a'); P.R(W / 2 - 8, 2, 16, 1, '#fff4c0');
        for (let x = W / 2 - 8; x < W / 2 + 8; x += 4) P.R(x, 2, 1, 8, '#3e5a7a');
        P.R(W / 2 - 12, 10, 24, 2, '#2e4a6a'); P.R(W / 2 - 2, -2 + 2, 4, 2, '#e8c040');
        S.win.push([W / 2, 6]);
        walls(S, wy, '#e8dcc4', 'stone');
        // columns
        for (const x of [8, 24, W - 32, W - 16]) { P.R(x, wy + 2, 6, S.H - wy - 4, '#f4ecdc'); P.R(x, wy + 2, 6, 2, '#ffffff'); P.R(x + 5, wy + 2, 1, S.H - wy - 4, '#c8bca8'); }
        // round windows
        for (const x of [40, W - 50]) { P.disc(x + 4, wy + 16, 6, '#c8bca8'); P.disc(x + 4, wy + 16, 5, '#7ab8e8'); P.R(x + 4, wy + 11, 1, 11, '#c8bca8'); P.R(x - 1, wy + 16, 11, 1, '#c8bca8'); S.win.push([x + 4, wy + 16]); }
        windowAt(S, 40, wy + 34, 8, 10); windowAt(S, W - 50, wy + 34, 8, 10);
        // pediment
        P.R(S.door - 10, wy - 2, 36, 4, '#d8ccb4'); P.R(S.door - 6, wy - 6, 28, 4, '#d8ccb4');
        door(S, '#6a3a22', 14, true);
        // lanterns by the door
        for (const x of [S.door - 6, S.door + 20]) { P.R(x, S.H - 22, 4, 6, '#3a3a44'); P.R(x + 1, S.H - 21, 2, 4, '#ffe08a'); S.win.push([x + 2, S.H - 19]); }
    },
    castle(S) {
        const { P, W } = S;
        const wy = S.top + 10;
        walls(S, wy, '#a8a2b0', 'stone');
        // battlements
        for (let x = 0; x < W; x += 8) P.R(x, wy - 4, 5, 5, '#a8a2b0');
        // towers
        for (const x of [0, W - 18]) {
            P.R(x, 4, 18, S.H - 4, '#b4aebc'); for (let y = 8; y < S.H; y += 5) P.R(x, y, 18, 1, '#8e8898');
            for (let xx = x; xx < x + 18; xx += 6) P.R(xx, 0, 4, 5, '#b4aebc');
            windowAt(S, x + 6, 16, 6, 9, '#8e8898', '#2a3a5a');
            P.R(x + 8, -6 + 6, 1, 0, '#000');
        }
        // banners
        for (const x of [24, W - 32]) { P.R(x, wy + 4, 8, 16, '#8a2a4a'); P.R(x, wy + 4, 8, 2, '#e0c060'); P.px(x + 3, wy + 10, '#e0c060'); P.px(x + 4, wy + 11, '#e0c060'); }
        windowAt(S, W / 2 - 14, wy + 10, 6, 10, '#8e8898', '#3a4a6a'); windowAt(S, W / 2 + 10, wy + 10, 6, 10, '#8e8898', '#3a4a6a');
        door(S, '#5a3a22', 16, true);
    },
    tower(S) {
        const { P, W } = S;
        walls(S, 10, '#a8a2b0', 'stone');
        for (let x = 0; x < W; x += 6) P.R(x, 4, 4, 6, '#a8a2b0');
        P.R(W / 2 - 4, 0, 8, 4, '#5a4a7a');
        windowAt(S, W / 2 - 3, 18, 6, 8, '#8e8898', '#2a3a5a');
        windowAt(S, W / 2 - 3, 36, 6, 8, '#8e8898', '#2a3a5a');
        door(S, '#4a3a2a', 10, true);
    },
    mill(S) {
        const { P, W } = S;
        const wy = S.top + 6;
        P.R(6, wy, W - 12, S.H - wy, '#e8dcc0'); P.R(6, wy, W - 12, 2, '#f8f0dc');
        for (let y = wy + 4; y < S.H; y += 6) P.R(6, y, W - 12, 1, '#c8b890');
        P.R(4, wy - 6, W - 8, 8, '#8a4a3a'); P.R(8, wy - 10, W - 16, 4, '#8a4a3a');
        windowAt(S, W / 2 - 3, wy + 10, 6, 6);
        door(S, '#7a4a2a');
        // sails
        const cx = W / 2, cy = wy - 2;
        for (let k = 0; k < 4; k++) {
            const a = k * Math.PI / 2 + S.fr * Math.PI / 16;
            for (let r = 3; r < 26; r++) {
                const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
                P.px(x, y, '#6a4a2e');
                if (r > 6) { const px = -Math.sin(a), py = Math.cos(a); for (let s = 1; s < 5; s++) P.px(x + px * s, y + py * s, s === 4 ? '#c8b890' : '#f2ead6'); }
            }
        }
        P.disc(cx, cy, 2, '#4a3a2a');
    },
    lodge(S) {
        const wy = S.top + Math.round(S.foot * 0.45);
        walls(S, wy, '#a8743e', 'logs');
        roof(S, 2, wy + 2, '#7a3a2e', 'slate');
        S.P.R(0, 2, S.W, 4, '#f4f8ff'); S.P.R(2, 6, S.W - 4, 2, '#e2eaf2');
        chimney(S, S.W - 14, 0);
        door(S, '#5a3a22', 12);
        windowAt(S, 6, wy + 8, 8, 6); windowAt(S, S.W - 14, wy + 8, 8, 6);
    },
    hut(S) {
        const wy = S.top + Math.round(S.foot * 0.45);
        walls(S, wy, '#8a7454', 'logs');
        roof(S, 2, wy + 2, '#6a7a4a', 'thatch');
        door(S, '#4a3a2a', 8);
        windowAt(S, 5, wy + 6, 5, 5, '#5a4a3a', '#e0c060');
        S.P.R(S.W - 10, wy - 6, 3, 5, '#5a4a3a');
    },
    cabin(S) {
        const wy = S.top + Math.round(S.foot * 0.45);
        walls(S, wy, '#9a6a3a', 'logs');
        roof(S, 2, wy + 2, '#4a6a3a', 'tile');
        chimney(S, 8, 0, 6);
        door(S, '#5a3a22');
        windowAt(S, S.W - 12, wy + 6);
    },
    mousehouse(S) {
        const { P, W, H } = S;
        P.R(2, 10, W - 4, H - 10, '#e8dcc4'); P.R(2, 10, W - 4, 1, '#ffffff');
        P.ellipse(W / 2, 8, W / 2, 7, ['#d04a3a', '#3a7ad0', '#e8a040'][(S.b.x + S.b.y) % 3]);
        P.px(W / 2 - 5, 5, '#ffffff'); P.px(W / 2 + 3, 7, '#ffffff'); P.px(W / 2, 3, '#ffffff');
        P.R(W / 2 - 2, H - 8, 4, 8, '#7a4a2a'); P.px(W / 2 + 1, H - 4, '#e8c040');
        P.R(5, H - 14, 4, 4, '#7ab8e8'); S.win.push([7, H - 12]);
    },
    burrow(S) {
        const { P, W, H } = S;
        // an enormous old stump, roots and all, with a round green door
        P.R(8, 8, W - 16, H - 8, '#7a5232');
        for (let x = 10; x < W - 10; x += 4) P.R(x, 10, 1, H - 12, '#6a4428');
        P.ellipse(W / 2, 9, W / 2 - 8, 6, '#a8784a'); P.ellipse(W / 2, 9, W / 2 - 12, 4, '#c89a6a');
        for (let r = 3; r < W / 2 - 12; r += 3) for (let a = 0; a < 20; a++) P.px(W / 2 + Math.cos(a * 0.31) * r, 9 + Math.sin(a * 0.31) * r * 0.45, '#b08454');
        for (let i = 0; i < 5; i++) { const x = 6 + i * (W - 12) / 4; P.ellipse(x, H - 3, 5, 3, '#6a4428'); }
        P.R(2, H - 6, 8, 6, '#6a4428'); P.R(W - 10, H - 6, 8, 6, '#6a4428');
        P.ellipse(W / 2 - 14, 6, 4, 3, '#4f9a40'); P.ellipse(W / 2 + 16, 7, 5, 3, '#5fae4a'); P.px(W / 2 + 15, 5, '#e05a5a');
        P.disc(W / 2, H - 9, 8, '#3a2618'); P.disc(W / 2, H - 9, 7, '#4f8a3a'); P.R(W / 2 - 7, H - 9, 15, 9, '#4f8a3a');
        P.R(W / 2, H - 15, 1, 15, '#3e6a2e'); P.disc(W / 2 + 3, H - 7, 1, '#e8c040');
        windowAt(S, 14, H - 14, 5, 5, '#5a3a22', '#ffd98a'); windowAt(S, W - 19, H - 14, 5, 5, '#5a3a22', '#ffd98a');
    },
    oak(S) {
        const { P, W, H } = S;
        P.R(10, 18, W - 20, H - 18, '#6a4a2e');
        for (let x = 12; x < W - 12; x += 5) P.R(x, 20, 1, H - 22, '#5a3a22');
        P.R(4, H - 6, W - 8, 6, '#5a3a22');
        P.ellipse(W / 2, 14, W / 2, 14, '#2f7a34'); P.ellipse(W / 2 - 6, 10, W / 3, 9, '#3e8a3e'); P.ellipse(W / 2 + 8, 8, 10, 6, '#4f9a44');
        for (let i = 0; i < 10; i++) P.px(nz(i, 1) * W, 4 + nz(i, 2) * 20, '#6aac52');
        P.ellipse(S.door + 8, H - 9, 6, 9, '#1e140e'); P.R(S.door + 2, H - 9, 12, 9, '#1e140e');
        P.px(S.door + 6, H - 12, '#ffe08a'); S.win.push([S.door + 8, H - 8]);
    },
    cavemouth(S) {
        const { P, W, H } = S;
        P.R(0, 4, W, H - 4, '#8a7e6c');
        for (let i = 0; i < 4; i++) P.R(2 + i * 15, 8 + (i % 2) * 4, 1, H - 12, '#6e6454');
        P.R(0, 4, W, 3, '#7ab058');
        P.ellipse(S.door + 8, H - 6, 11, 12, '#0e0a10'); P.R(S.door - 3, H - 6, 22, 6, '#0e0a10');
        P.R(S.door - 4, H - 14, 3, 14, '#6a4a2e'); P.R(S.door + 17, H - 14, 3, 14, '#6a4a2e');
    },
    kiln(S) {
        const { P, W, H } = S;
        walls(S, 14, '#a05a3a', 'brick');
        P.ellipse(W / 2, 16, W / 2 - 2, 12, '#a05a3a'); P.ellipse(W / 2, 14, W / 2 - 6, 8, '#b86a46');
        P.R(W - 18, 0, 8, 18, '#8a4a2a'); P.R(W - 19, 0, 10, 2, '#6a3a20');
        P.px(W - 14, -2 + 2, '#5a5a5a');
        door(S, '#2a1a12', 10, true);
        P.R(S.door + 4, S.H - 6, 8, 3, '#e8823a');
        S.win.push([S.door + 8, S.H - 6]);
    },
    mine(S) {
        const { P, W, H } = S;
        P.R(0, 2, W, H - 2, '#9a8a70'); P.R(0, 2, W, 3, '#a8a294');
        P.R(S.door - 2, H - 18, 20, 18, '#1a120c');
        P.R(S.door - 4, H - 20, 24, 3, '#7a5232'); P.R(S.door - 4, H - 20, 3, 20, '#7a5232'); P.R(S.door + 17, H - 20, 3, 20, '#7a5232');
        P.R(S.door + 2, H - 3, 12, 1, '#5a5a64'); P.R(S.door + 2, H - 1, 12, 1, '#5a5a64');
        void W;
    },
    icetemple(S) {
        const { P, W, H } = S;
        P.R(4, 16, W - 8, H - 16, '#bfe2f4');
        for (let x = 8; x < W - 8; x += 12) { P.R(x, 16, 5, H - 18, '#e6f6ff'); P.R(x + 4, 16, 1, H - 18, '#8ec4e0'); }
        P.R(0, 10, W, 7, '#8ec4e0'); P.R(4, 4, W - 8, 7, '#a8d4ec'); P.R(W / 2 - 6, 0, 12, 5, '#cfeaf8');
        door(S, '#4a7a9a', 12, true);
    },
    lighthouse(S) {
        const { P, W, H } = S;
        const x0 = 6, x1 = W - 6;
        for (let y = 14; y < H - 4; y++) {
            const inset = Math.round((y - 14) * -0.08);
            P.R(x0 - inset + 2, y, x1 - x0 - 4 + inset * 2, 1, Math.floor((y - 14) / 8) % 2 ? '#f2efe2' : '#c0392b');
        }
        P.R(2, H - 6, W - 4, 6, '#8a8494');
        P.R(x0, 6, x1 - x0, 8, '#3a3a44'); P.R(x0 + 2, 7, x1 - x0 - 4, 6, '#ffe08a'); P.R(x0 - 2, 4, x1 - x0 + 4, 2, '#3a3a44'); P.R(W / 2 - 3, 0, 6, 4, '#3a3a44');
        S.win.push([W / 2, 10]);
        if (S.fr % 4 < 2) { P.R(x1, 8, 4, 3, '#fff4c0'); } else P.R(x0 - 4, 8, 4, 3, '#fff4c0');
        door(S, '#3a3a44', 8, true);
    },
    glasshouse(S) {
        const { P, W, H } = S;
        P.R(2, 12, W - 4, H - 12, '#cfeee6');
        for (let x = 2; x < W; x += 8) P.R(x, 12, 1, H - 12, '#4a7a6a');
        for (let y = 12; y < H; y += 8) P.R(2, y, W - 4, 1, '#4a7a6a');
        for (let y = 0; y < 13; y++) P.R(2 + Math.round(y * 0.8), y + 0, W - 4 - Math.round(y * 0.8) * 2, 1, y % 4 ? '#bfe6dc' : '#4a7a6a');
        for (let i = 0; i < 18; i++) P.R(4 + nz(i, 3) * (W - 10), 14 + nz(i, 4) * (H - 20), 3, 2, '#3e8a3e');
        for (let i = 0; i < 8; i++) P.line(nz(i, 5) * W, H, nz(i, 6) * W, 10 + nz(i, 7) * 20, '#2f6a2e');
        door(S, '#4a7a6a', 10, true);
    },
    ruin(S) {
        const { P, W, H } = S;
        P.R(4, 10, W - 8, H - 10, '#8aa0a8');
        for (let y = 12; y < H; y += 5) P.R(4, y, W - 8, 1, '#6a8088');
        P.R(0, 6, 8, H - 6, '#9ab0b8'); P.R(W - 8, 2, 8, H - 2, '#9ab0b8');
        P.R(8, 4, W - 16, 6, '#9ab0b8');
        for (let i = 0; i < 6; i++) P.R(nz(i, 2) * W, 8 + nz(i, 3) * 20, 3, 2, '#5fae6a');
        door(S, '#1e2a30', 12, true);
    },
    abbey(S) {
        const { P, W, H } = S;
        walls(S, 18, '#8a8494', 'stone');
        roof(S, 8, 20, '#4a4458', 'slate');
        P.R(W / 2 - 6, 0, 12, 22, '#7a7484'); P.R(W / 2 - 1, 0, 2, 4, '#c9b6ff');
        for (let y = 2; y < 8; y++) P.R(W / 2 - 6 + (8 - y), y - 2, (y - 2) * 2 + 0, 1, '#4a4458');
        P.R(W / 2 - 3, 8, 6, 8, '#2a2438'); P.R(W / 2 - 1, 10, 2, 3, '#e0c060');
        for (const x of [8, W - 16]) { P.R(x, 28, 8, 14, '#2a2438'); P.R(x + 1, 29, 6, 12, '#5a4a8a'); P.R(x + 3, 29, 1, 12, '#2a2438'); S.win.push([x + 4, 34]); }
        door(S, '#3a2a3a', 12, true);
    },
    observatory(S) {
        const { P, W, H } = S;
        walls(S, 20, '#c8c4dc', 'stone');
        P.ellipse(W / 2, 20, W / 2 - 4, 18, '#8a86b4'); P.ellipse(W / 2, 18, W / 2 - 8, 14, '#a8a4d0');
        P.R(W / 2 - 3, 4, 6, 16, '#2e2a4a');
        P.line(W / 2, 12, W / 2 + 14, 0, '#b8a060'); P.line(W / 2 + 1, 12, W / 2 + 15, 0, '#b8a060');
        if (S.fr % 4 === 0) P.px(W / 2 + 16, 0, '#ffe08a');
        door(S, '#4a4468', 10, true);
        windowAt(S, 8, 28, 6, 6, '#8a86b4', '#2e2a4a'); windowAt(S, W - 14, 28, 6, 6, '#8a86b4', '#2e2a4a');
    },
};

function flowers(S) {
    const { P, W, H } = S;
    const fl = ['#ff9a6a', '#ffe066', '#f5a3c7', '#9fc8ff'];
    for (let x = 2; x < W - 2; x += 3) {
        if (Math.abs(x - S.door - 8) < 9) continue;
        P.R(x, H - 3, 2, 2, '#4f9a40'); P.px(x, H - 4, fl[(x / 3 | 0) % 4]);
    }
}
