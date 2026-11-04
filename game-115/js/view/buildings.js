// Every building, painted in code. A building is a front elevation with a little roof showing: walls
// (planks, plaster, stone), a roof (thatch, shingles, slate, tile), windows and doors, and the props
// that say what it is for. Higher levels get better materials and more of everything. Each painter
// also fills an emissive layer, so windows, forges and lanterns glow at night.

import { BUILDINGS } from '../sim/data/buildings.js';
import {
    canvas, ctx2, PX, INK, rnd, mix, lighten, darken, lin, rad, rr, box, poly, circle, ellipse, line, softShadow, glow,
} from './paint.js';

const WOOD = '#b98a55', WOOD_L = '#d4a870', WOOD_D = '#8a6038';
const PLASTER = '#f2e4c4', STONE = '#b3ada4', BRICK = '#c7794f';
const ROOFS = { thatch: '#dcb85c', shingle: '#9a6a44', slate: '#6b7890', tile: '#c9623f', green: '#5e9a5b', blue: '#4f7fb0', red: '#b8453a' };

function newP(wTiles, hTiles) {
    const W = Math.ceil(wTiles * PX), H = Math.ceil(hTiles * PX);
    const c = canvas(W, H), e = canvas(W, H);
    return { c, e, g: ctx2(c), eg: ctx2(e), W, H, smoke: [], door: { x: W / 2, y: H }, extra: {} };
}

// ---------------------------------------------------------------- parts
function wallFill(P, x, y, w, h, kind, col, seed = 1) {
    const g = P.g, rng = rnd(seed);
    g.save();
    rr(g, x, y, w, h, 2); g.clip();
    g.fillStyle = lin(g, x, y, x + w, y, [[0, lighten(col, 0.1)], [0.5, col], [1, darken(col, 0.18)]]);
    g.fillRect(x, y, w, h);
    if (kind === 'plank') {
        g.strokeStyle = 'rgba(60,34,16,0.45)'; g.lineWidth = 1.4;
        for (let px = x + 7; px < x + w; px += 9 + rng() * 3) { g.beginPath(); g.moveTo(px, y); g.lineTo(px, y + h); g.stroke(); }
        g.strokeStyle = 'rgba(60,34,16,0.2)'; g.lineWidth = 1;
        for (let i = 0; i < w / 6; i++) { const px = x + rng() * w, py = y + rng() * h; g.beginPath(); g.moveTo(px, py); g.lineTo(px + 1, py + 6 + rng() * 6); g.stroke(); }
    } else if (kind === 'stone' || kind === 'brick') {
        const bh = kind === 'brick' ? 8 : 11, bw = kind === 'brick' ? 18 : 22;
        for (let r = 0, py = y; py < y + h; r++, py += bh) {
            for (let px = x - (r % 2) * bw / 2; px < x + w; px += bw) {
                const v = (rng() - 0.5) * 0.18;
                g.fillStyle = v > 0 ? lighten(col, v) : darken(col, -v);
                g.fillRect(px + 1, py + 1, bw - 2, bh - 2);
            }
        }
        g.strokeStyle = 'rgba(40,28,20,0.35)'; g.lineWidth = 1;
        for (let py = y; py < y + h; py += bh) { g.beginPath(); g.moveTo(x, py); g.lineTo(x + w, py); g.stroke(); }
    } else if (kind === 'plaster') {
        for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(120,90,50,${0.03 + rng() * 0.05})`; g.beginPath(); g.arc(x + rng() * w, y + rng() * h, 2 + rng() * 5, 0, 7); g.fill(); }
        // timber frame
        g.fillStyle = WOOD_D;
        g.fillRect(x, y, 4, h); g.fillRect(x + w - 4, y, 4, h); g.fillRect(x, y + h - 5, w, 5); g.fillRect(x, y, w, 4);
        for (let px = x + w / 3; px < x + w - 6; px += w / 3) g.fillRect(px - 1.5, y, 3, h);
    }
    g.restore();
    rr(g, x, y, w, h, 2); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
}

function roof(P, x, yBase, w, h, kind, col, ov = 10, seed = 2) {
    const g = P.g, rng = rnd(seed);
    const inset = w * 0.1;
    const pts = [[x - ov, yBase], [x + inset, yBase - h], [x + w - inset, yBase - h], [x + w + ov, yBase]];
    g.save();
    g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath();
    g.fillStyle = lin(g, 0, yBase - h, 0, yBase, [[0, lighten(col, 0.18)], [1, darken(col, 0.12)]]);
    g.fill();
    g.clip();
    const rowH = kind === 'thatch' ? 7 : 9;
    g.lineWidth = 1.2;
    for (let r = 0, y = yBase; y > yBase - h; r++, y -= rowH) {
        const t = (yBase - y) / h;
        const left = x - ov + (x + inset - (x - ov)) * t, right = x + w + ov - (x + w + ov - (x + w - inset)) * t;
        if (kind === 'thatch') {
            g.strokeStyle = 'rgba(110,80,20,0.5)';
            for (let px = left; px < right; px += 4) { g.beginPath(); g.moveTo(px + (rng() - 0.5) * 2, y); g.lineTo(px + (rng() - 0.5) * 3, y - rowH + 1); g.stroke(); }
            g.strokeStyle = 'rgba(120,90,30,0.35)'; g.beginPath(); g.moveTo(left, y); g.lineTo(right, y); g.stroke();
        } else {
            const sw = kind === 'slate' ? 11 : kind === 'tile' ? 12 : 10;
            for (let px = left - (r % 2) * sw / 2; px < right; px += sw) {
                const v = (rng() - 0.5) * 0.14;
                g.fillStyle = v > 0 ? lighten(col, v) : darken(col, -v);
                g.beginPath(); g.moveTo(px, y - rowH); g.lineTo(px + sw, y - rowH); g.lineTo(px + sw, y - 3); g.quadraticCurveTo(px + sw / 2, y + 2, px, y - 3); g.closePath(); g.fill();
                g.strokeStyle = 'rgba(30,18,10,0.4)'; g.stroke();
            }
        }
    }
    g.restore();
    poly(g, pts, null, INK, 2.2);
    g.fillStyle = darken(col, 0.3); g.fillRect(x - ov, yBase - 1, w + ov * 2, 5);
    g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(x - ov, yBase - 1, w + ov * 2, 5);
    // ridge highlight
    line(g, x + inset, yBase - h + 1, x + w - inset, yBase - h + 1, lighten(col, 0.4), 2.4);
}

function win(P, x, y, w, h, o = {}) {
    const g = P.g;
    box(g, x - 3, y - 3, w + 6, h + 6, o.frame || WOOD_D, 2, INK, 1.6);
    rr(g, x, y, w, h, o.round ? w / 2 : 2);
    g.fillStyle = lin(g, x, y, x, y + h, [[0, '#cfe9f2'], [1, '#78aac6']]); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
    if (!o.round) { line(g, x + w / 2, y, x + w / 2, y + h, WOOD_D, 1.8); line(g, x, y + h / 2, x + w, y + h / 2, WOOD_D, 1.8); }
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x + 2, y + 2, w * 0.28, h * 0.4);
    if (o.curtain) { g.fillStyle = o.curtain; g.fillRect(x, y, w * 0.22, h); g.fillRect(x + w * 0.78, y, w * 0.22, h); }
    if (o.box) { box(g, x - 4, y + h + 2, w + 8, 6, '#8a5a3a', 1, INK, 1.4); for (let i = 0; i < 4; i++) circle(g, x + 2 + i * (w - 2) / 3, y + h + 1, 3.4, ['#e85a7a', '#f2d046', '#fff', '#e07a3a'][i], null); }
    // lit at night
    const eg = P.eg;
    eg.fillStyle = rad(eg, x + w / 2, y + h / 2, 0, Math.max(w, h) * 1.1, [[0, 'rgba(255,200,110,1)'], [0.45, 'rgba(255,170,70,0.75)'], [1, 'rgba(255,150,50,0)']]);
    eg.fillRect(x - w, y - h, w * 3, h * 3);
    eg.fillStyle = 'rgba(255,214,130,1)'; eg.fillRect(x, y, w, h);
}

function door(P, x, y, w, h, col = '#7a4a2a', o = {}) {
    const g = P.g;
    g.beginPath();
    if (o.arch) { g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); }
    else { rr(g, x, y, w, h, 3); }
    g.closePath();
    g.fillStyle = lin(g, x, y, x + w, y, [[0, lighten(col, 0.1)], [1, darken(col, 0.2)]]); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(30,16,8,0.45)'; g.lineWidth = 1.2;
    for (let px = x + w / 3; px < x + w - 2; px += w / 3) { g.beginPath(); g.moveTo(px, y + 3); g.lineTo(px, y + h); g.stroke(); }
    circle(g, x + w * 0.78, y + h * 0.55, 2.2, '#f2d36b', INK, 1);
    P.door = { x: x + w / 2, y: y + h };
}

function chimney(P, x, yTop, w, h) {
    const g = P.g;
    box(g, x, yTop - h, w, h, '#a4604a', 2, INK, 2);
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 3; i++) g.fillRect(x + 2, yTop - h + 5 + i * 8, w - 4, 1.5);
    box(g, x - 3, yTop - h - 5, w + 6, 6, '#7d4a3a', 2, INK, 1.6);
    P.smoke.push({ x: x + w / 2, y: yTop - h - 6 });
}

function sign(P, x, y, kind, w = 26, h = 22) {
    const g = P.g;
    line(g, x - w / 2, y - 6, x - w / 2, y, INK, 2); line(g, x + w / 2, y - 6, x + w / 2, y, INK, 2);
    box(g, x - w / 2 - 3, y, w + 6, h, '#9a6a3a', 3, INK, 2);
    const cx = x, cy = y + h / 2;
    if (kind === 'mug') { box(g, cx - 6, cy - 6, 11, 13, '#f2d36b', 2, INK, 1.6); box(g, cx + 4, cy - 3, 5, 7, null, 2, INK, 1.6); g.fillStyle = '#fff'; g.fillRect(cx - 5, cy - 8, 9, 3); }
    else if (kind === 'sword') { line(g, cx - 7, cy + 7, cx + 7, cy - 7, '#dfe5ee', 3); line(g, cx + 7, cy + 7, cx - 7, cy - 7, '#dfe5ee', 3); line(g, cx - 9, cy + 5, cx - 5, cy + 9, INK, 2); }
    else if (kind === 'bed') { box(g, cx - 9, cy - 2, 18, 8, '#e85a7a', 2, INK, 1.4); box(g, cx - 9, cy - 6, 6, 5, '#fff', 2, INK, 1.2); }
    else if (kind === 'scales') { line(g, cx, cy - 7, cx, cy + 7, INK, 2); line(g, cx - 8, cy - 4, cx + 8, cy - 4, INK, 2); circle(g, cx - 8, cy + 1, 4, '#f2d36b', INK, 1.4); circle(g, cx + 8, cy + 1, 4, '#f2d36b', INK, 1.4); }
    else if (kind === 'flask') { poly(g, [[cx - 3, cy - 8], [cx + 3, cy - 8], [cx + 3, cy - 3], [cx + 8, cy + 7], [cx - 8, cy + 7], [cx - 3, cy - 3]], '#b58ad0', INK, 1.6); }
    else if (kind === 'anvil') { box(g, cx - 8, cy - 2, 16, 5, '#7c8494', 1, INK, 1.4); box(g, cx - 4, cy + 3, 8, 5, '#5c6474', 1, INK, 1.4); }
    else if (kind === 'book') { box(g, cx - 8, cy - 6, 16, 12, '#3f6aa0', 2, INK, 1.4); line(g, cx, cy - 6, cx, cy + 6, '#e6dcc0', 1.6); }
    else if (kind === 'saw') { poly(g, [[cx - 9, cy - 3], [cx + 9, cy - 3], [cx + 9, cy + 3], [cx - 9, cy + 3]], '#c6ccd6', INK, 1.4); for (let i = 0; i < 6; i++) poly(g, [[cx - 8 + i * 3, cy + 3], [cx - 6.5 + i * 3, cy + 6], [cx - 5 + i * 3, cy + 3]], '#c6ccd6', INK, 0.8); }
    else if (kind === 'thread') { circle(g, cx, cy, 6, '#e8607a', INK, 1.6); line(g, cx - 6, cy + 2, cx + 7, cy - 4, '#fff', 1.5); }
    else if (kind === 'horse') { poly(g, [[cx - 6, cy + 7], [cx - 6, cy - 2], [cx - 1, cy - 8], [cx + 5, cy - 6], [cx + 8, cy], [cx + 3, cy + 1], [cx + 1, cy + 7]], '#8a5a3a', INK, 1.4); }
    else if (kind === 'cross') { g.fillStyle = '#7bb661'; g.fillRect(cx - 2, cy - 8, 4, 16); g.fillRect(cx - 8, cy - 2, 16, 4); }
    else if (kind === 'gold') { circle(g, cx, cy, 7, '#f2d36b', INK, 1.6); }
    else { circle(g, cx, cy, 6, '#f2d36b', INK, 1.4); }
}

function lantern(P, x, y, s = 1) {
    const g = P.g, eg = P.eg;
    line(g, x, y - 6 * s, x, y, INK, 1.6);
    box(g, x - 4 * s, y, 8 * s, 10 * s, '#ffd36b', 2, INK, 1.6);
    line(g, x - 2 * s, y, x - 2 * s, y + 10 * s, INK, 1); line(g, x + 2 * s, y, x + 2 * s, y + 10 * s, INK, 1);
    glow(eg, x, y + 5 * s, 20 * s, 'rgb(255,190,90)', 0.95);
    eg.fillStyle = 'rgb(255,222,150)'; eg.fillRect(x - 3 * s, y + 1 * s, 6 * s, 8 * s);
}

function crate(P, x, y, s = 14, col = '#b98a55') {
    box(P.g, x, y - s, s, s, col, 1, INK, 1.6);
    line(P.g, x, y - s, x + s, y, 'rgba(60,34,16,0.5)', 1.2);
    line(P.g, x + s, y - s, x, y, 'rgba(60,34,16,0.5)', 1.2);
}
function barrel(P, x, y, s = 14) {
    const g = P.g;
    g.beginPath(); g.moveTo(x - s * 0.5, y); g.quadraticCurveTo(x - s * 0.72, y - s * 0.7, x - s * 0.5, y - s * 1.4); g.lineTo(x + s * 0.5, y - s * 1.4); g.quadraticCurveTo(x + s * 0.72, y - s * 0.7, x + s * 0.5, y); g.closePath();
    g.fillStyle = lin(g, x - s * 0.6, 0, x + s * 0.6, 0, [[0, WOOD_L], [1, WOOD_D]]); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
    line(g, x - s * 0.62, y - s * 0.35, x + s * 0.62, y - s * 0.35, '#5a3d28', 1.6); line(g, x - s * 0.62, y - s * 1.05, x + s * 0.62, y - s * 1.05, '#5a3d28', 1.6);
}
function sack(P, x, y, s = 14, col = '#e6d6a8') {
    const g = P.g;
    g.beginPath(); g.moveTo(x - s * 0.5, y); g.quadraticCurveTo(x - s * 0.8, y - s * 0.7, x - s * 0.2, y - s * 1.1); g.lineTo(x + s * 0.2, y - s * 1.1); g.quadraticCurveTo(x + s * 0.8, y - s * 0.7, x + s * 0.5, y); g.closePath();
    g.fillStyle = col; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
    line(g, x - s * 0.22, y - s * 1.0, x + s * 0.22, y - s * 1.0, '#7a5a30', 2);
}
function logs(P, x, y, n = 6, r = 6) {
    const g = P.g;
    for (let row = 0; row < 3; row++) for (let i = 0; i < n - row; i++) {
        const cx = x + i * r * 2 + row * r, cy = y - r - row * r * 1.7;
        ellipse(g, cx, cy, r, r, '#d9b27a', INK, 1.5); circle(g, cx, cy, r * 0.45, null, 'rgba(120,80,40,0.7)', 1);
    }
}
function planks(P, x, y, w = 40, n = 4) {
    const g = P.g;
    for (let i = 0; i < n; i++) box(g, x, y - (i + 1) * 5, w, 5, i % 2 ? WOOD_L : WOOD, 1, INK, 1.2);
}
function bush(P, x, y, r = 12, col = '#5fae4c') {
    const g = P.g;
    for (const [dx, dy, rr2] of [[-r * 0.7, 0, r * 0.7], [r * 0.7, 0, r * 0.7], [0, -r * 0.5, r * 0.85]]) {
        g.beginPath(); g.arc(x + dx, y + dy - rr2 * 0.3, rr2, 0, 7);
        g.fillStyle = rad(g, x + dx - 3, y + dy - rr2 * 0.8, 1, rr2 * 1.2, [[0, lighten(col, 0.25)], [1, darken(col, 0.2)]]); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
    }
}
function flowerPatch(P, x, y, w, seed = 4) {
    const rng = rnd(seed), cols = ['#e85a7a', '#f2d046', '#ffffff', '#e07a3a', '#b58ad0'];
    for (let i = 0; i < w / 5; i++) {
        const px = x + rng() * w, py = y - rng() * 8;
        line(P.g, px, py, px, py + 7, '#4f8f45', 1.5);
        circle(P.g, px, py, 2.6, cols[Math.floor(rng() * 5)], 'rgba(40,24,16,0.5)', 1);
    }
}
function fence(P, x0, x1, y) {
    const g = P.g;
    line(g, x0, y - 9, x1, y - 9, WOOD_D, 3); line(g, x0, y - 17, x1, y - 17, WOOD_D, 3);
    for (let x = x0; x <= x1; x += 18) box(g, x - 2.5, y - 24, 5, 24, WOOD, 1, INK, 1.4);
}

// ---------------------------------------------------------------- ladders of materials
const wallKind = (lv, ladder) => ladder[Math.min(ladder.length, lv) - 1];
function mats(lv, kind = 'cottage') {
    if (kind === 'barn') return { wall: lv >= 3 ? 'plaster' : 'plank', wc: lv >= 3 ? PLASTER : WOOD, roof: lv >= 4 ? 'tile' : lv >= 2 ? 'shingle' : 'thatch' };
    if (kind === 'stone') return { wall: 'stone', wc: lv >= 3 ? '#c4beb4' : STONE, roof: lv >= 3 ? 'tile' : 'slate' };
    return { wall: lv >= 4 ? 'stone' : lv >= 2 ? 'plaster' : 'plank', wc: lv >= 4 ? STONE : lv >= 2 ? PLASTER : WOOD, roof: lv >= 5 ? 'tile' : lv >= 4 ? 'slate' : lv >= 2 ? 'shingle' : 'thatch' };
}

/** The generic house: returns the painter context with wall geometry in P.geo for props to use. */
function build(wTiles, hTiles, o) {
    const floors = o.floors || 1;
    const bw = wTiles * PX * (o.fill || 0.86);
    const wh = (o.wallH || 0.62) * PX * floors;
    const rh = (o.roofH || 0.5) * PX;
    const margin = 0.5 * PX;
    const P = newP(wTiles + 0.5, (wh + rh + margin) / PX + (o.top || 0));
    const x = (P.W - bw) / 2, yb = P.H - 10, yt = yb - wh;
    P.geo = { x, bw, yb, yt, wh, rh, floors };
    softShadow(P.g, P.W / 2, yb + 2, bw * 0.62, 11, 0.3);
    if (o.before) o.before(P);
    wallFill(P, x, yt, bw, wh, o.wall, o.wc, o.seed || 3);
    roof(P, x, yt, bw, rh, o.roof, o.rc || ROOFS[o.roof] || ROOFS.shingle, o.ov ?? 12, (o.seed || 3) + 1);
    return P;
}
function windowsRow(P, n, floorIdx, y, w = 16, h = 19, o = {}) {
    const { x, bw } = P.geo;
    for (let i = 0; i < n; i++) win(P, x + bw * (i + 1) / (n + 1) - w / 2, y, w, h, o);
}
function finishP(P, tilesW) {
    return { c: P.c, e: P.e, w: P.W / PX, h: P.H / PX, smoke: P.smoke.map((s) => ({ x: s.x / PX, y: s.y / PX })), door: { x: P.door.x / PX, y: P.door.y / PX }, extra: P.extra };
}

// ---------------------------------------------------------------- the painters
const PAINT = {};

PAINT.hall = (lv) => {
    const m = mats(lv);
    const P = build(3, 3, { ...m, floors: lv >= 3 ? 2 : 1, wallH: 0.7, roofH: 0.46 + lv * 0.05, fill: 0.82 - (lv === 1 ? 0.18 : 0), seed: 5, ov: 14 });
    const { x, bw, yb, yt } = P.geo;
    door(P, x + bw / 2 - 11, yb - 38, 22, 38, '#7a4a2a', { arch: lv >= 3 });
    const nWin = lv >= 4 ? 3 : 2;
    if (lv === 1) win(P, x + 12, yb - 40, 14, 16, { curtain: '#e85a7a' });
    else { for (let i = 0; i < 2; i++) win(P, i ? x + bw - 34 : x + 16, yb - 42, 18, 22, { curtain: '#e85a7a', box: lv >= 2 }); }
    if (lv >= 3) { for (let i = 0; i < 3; i++) win(P, x + bw * (i + 1) / 4 - 9, yt + 10, 18, 22, { curtain: '#d9b45a', round: lv >= 5 }); }
    chimney(P, x + bw * 0.74, yt - P.geo.rh * 0.35, 16, 30 + lv * 3);
    if (lv >= 2) { bush(P, x + 4, yb + 3, 11); bush(P, x + bw - 6, yb + 3, 11); }
    if (lv >= 4) { lantern(P, x + bw / 2 - 26, yb - 52); lantern(P, x + bw / 2 + 26, yb - 52); }
    if (lv >= 5) { line(P.g, x + bw * 0.5, yt - P.geo.rh, x + bw * 0.5, yt - P.geo.rh - 34, INK, 3); poly(P.g, [[x + bw * 0.5, yt - P.geo.rh - 34], [x + bw * 0.5 + 26, yt - P.geo.rh - 26], [x + bw * 0.5, yt - P.geo.rh - 18]], '#d94a4a', INK, 1.6); }
    if (lv >= 6) { for (const s of [-1, 1]) { box(P.g, s < 0 ? x - 14 : x + bw - 6, yt - 20, 20, wh2(P) + 20, STONE, 2, INK, 2); poly(P.g, [[(s < 0 ? x - 18 : x + bw - 10), yt - 20], [(s < 0 ? x - 4 : x + bw + 4), yt - 52], [(s < 0 ? x + 10 : x + bw + 18), yt - 20]], ROOFS.blue, INK, 2); } }
    flowerPatch(P, x + 8, yb + 6, 40, 9);
    return finishP(P);
};
const wh2 = (P) => P.geo.wh;

PAINT.house = (lv) => {
    const m = mats(lv);
    const P = build(2, 2, { ...m, floors: lv >= 3 ? 2 : 1, wallH: 0.6, roofH: 0.42 + lv * 0.04, fill: 0.84 - (lv === 1 ? 0.12 : 0), seed: 11 + lv });
    const { x, bw, yb, yt } = P.geo;
    door(P, x + bw * 0.62, yb - 32, 18, 32, lv > 2 ? '#5a3d28' : '#7a4a2a', { arch: lv >= 3 });
    win(P, x + bw * 0.14, yb - 34, 16, 18, { curtain: '#e85a7a', box: lv >= 2 });
    if (lv >= 3) { win(P, x + bw * 0.2, yt + 8, 16, 18, { curtain: '#d9b45a' }); win(P, x + bw * 0.6, yt + 8, 16, 18, { curtain: '#d9b45a' }); }
    chimney(P, x + bw * 0.2, yt - P.geo.rh * 0.3, 13, 26);
    if (lv >= 4) { box(P.g, x - 8, yb - 8, bw + 16, 8, '#a89f92', 2, INK, 1.8); bush(P, x + 2, yb + 2, 9); bush(P, x + bw - 2, yb + 2, 9); lantern(P, x + bw * 0.62 - 8, yb - 40, 0.8); }
    else flowerPatch(P, x + 4, yb + 5, 34, 21 + lv);
    return finishP(P);
};

PAINT.storehouse = (lv) => {
    const m = mats(lv, 'barn');
    const P = build(2, 2, { ...m, floors: 1, wallH: 0.66, roofH: 0.46 + lv * 0.03, fill: 0.9, seed: 21, ov: 8 });
    const { x, bw, yb, yt } = P.geo;
    box(P.g, x + bw * 0.22, yb - 44, bw * 0.56, 44, '#8a5a3a', 2, INK, 2);
    line(P.g, x + bw * 0.5, yb - 44, x + bw * 0.5, yb, INK, 2); line(P.g, x + bw * 0.22, yb - 44, x + bw * 0.5, yb, 'rgba(40,24,16,.7)', 2); line(P.g, x + bw * 0.78, yb - 44, x + bw * 0.5, yb, 'rgba(40,24,16,.7)', 2);
    P.door = { x: x + bw / 2, y: yb };
    crate(P, x + 2, yb, 14); sack(P, x + bw - 10, yb + 1, 14); if (lv >= 2) barrel(P, x - 4, yb + 2, 14);
    if (lv >= 3) { crate(P, x + 2, yb - 14, 12); sack(P, x + bw - 24, yb + 1, 13, '#c9b78a'); }
    if (lv >= 4) { box(P.g, x + bw * 0.36, yt + 6, bw * 0.28, 14, '#5a3d28', 2, INK, 1.6); }
    return finishP(P);
};

PAINT.woodshed = (lv) => {
    const m = mats(lv, 'barn');
    const P = build(3, 2, { ...m, floors: 1, wallH: 0.6, roofH: 0.42 + lv * 0.03, fill: 0.62, seed: 31, ov: 10, before: (Q) => {} });
    const { x, bw, yb, yt } = P.geo;
    box(P.g, x + 10, yt + 8, bw - 20, P.geo.wh - 8, '#3b2a20', 2, null);       // open front, dark inside
    for (const px of [x + 6, x + bw - 10]) box(P.g, px, yt, 6, P.geo.wh, WOOD_L, 1, INK, 1.6);
    logs(P, x + bw + 6, yb, 3, 7); logs(P, x - 40, yb, 3, 7);
    if (lv >= 2) logs(P, x + bw + 4, yb - 28, 2, 7);
    // chopping block + axe
    ellipse(P.g, x + bw * 0.5, yb - 6, 11, 5, '#d9b27a', INK, 1.6); box(P.g, x + bw * 0.5 - 10, yb - 4, 20, 9, '#8a6038', 1, INK, 1.4);
    line(P.g, x + bw * 0.5 + 2, yb - 8, x + bw * 0.5 + 16, yb - 30, WOOD_D, 3); poly(P.g, [[x + bw * 0.5 + 12, yb - 31], [x + bw * 0.5 + 24, yb - 28], [x + bw * 0.5 + 16, yb - 22]], '#b8bec8', INK, 1.4);
    if (lv >= 3) { box(P.g, x + 16, yb - 26, bw - 32, 8, '#a8763a', 1, INK, 1.4); poly(P.g, [[x + bw - 24, yb - 18], [x + bw - 12, yb - 38], [x + bw - 4, yb - 18]], '#c6ccd6', INK, 1.4); }
    P.door = { x: x + bw / 2, y: yb };
    return finishP(P);
};

PAINT.quarry = (lv) => {
    const P = newP(3.4, 2.2);
    const g = P.g, rng = rnd(41);
    softShadow(g, P.W / 2, P.H - 14, 100, 12, 0.3);
    // cliff face
    const cx = P.W * 0.5, by = P.H - 12;
    poly(g, [[cx - 100, by], [cx - 94, by - 80], [cx - 40, by - 112], [cx + 30, by - 124], [cx + 90, by - 88], [cx + 100, by]], lin(g, 0, by - 120, 0, by, [[0, '#d2ccc0'], [1, '#8f897d']]), INK, 2.4);
    g.strokeStyle = 'rgba(40,30,20,0.4)'; g.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) { const y = by - 14 - i * 11; g.beginPath(); g.moveTo(cx - 90 + rng() * 20, y); g.lineTo(cx + 80 - rng() * 20, y + (rng() - 0.5) * 6); g.stroke(); }
    // cut steps and a heap
    for (let i = 0; i < 3 + lv; i++) { const w = 30 + rng() * 14; poly(g, [[cx - 80 + i * 36, by], [cx - 76 + i * 36, by - 18], [cx - 76 + w + i * 36, by - 18], [cx - 80 + w + i * 36, by]], lighten('#a8a296', 0.1 * (i % 2)), INK, 1.6); }
    // timber crane
    line(g, cx + 60, by, cx + 60, by - 90, WOOD_D, 6); line(g, cx + 60, by - 90, cx + 10, by - 78, WOOD_D, 5); line(g, cx + 22, by - 78, cx + 22, by - 52, '#5a3d28', 2);
    box(g, cx + 14, by - 54, 16, 14, '#9a9488', 2, INK, 1.8);
    // cart
    box(g, cx - 90, by - 22, 36, 18, '#8a5a3a', 2, INK, 2); circle(g, cx - 82, by - 3, 6, '#5a3d28', INK, 1.6); circle(g, cx - 62, by - 3, 6, '#5a3d28', INK, 1.6);
    for (let i = 0; i < 5; i++) circle(g, cx - 86 + i * 7, by - 25, 6, '#a8a296', INK, 1.2);
    // pickaxe
    line(g, cx - 14, by - 4, cx + 6, by - 36, WOOD_D, 3); poly(g, [[cx - 6, by - 38], [cx + 18, by - 34], [cx + 4, by - 28]], '#b8bec8', INK, 1.4);
    if (lv >= 3) lantern(P, cx - 30, by - 70, 0.9);
    P.door = { x: cx, y: by + 6 };
    return finishP(P);
};

PAINT.farm = (lv) => {
    const P = newP(4.6, 2.5);
    const g = P.g, rng = rnd(51);
    // the field: a perspective plot with rows
    const fx = P.W * 0.5, fy = P.H - 18;
    poly(g, [[fx - 150, fy], [fx - 112, fy - 70], [fx + 112, fy - 70], [fx + 150, fy]], lin(g, 0, fy - 70, 0, fy, [[0, '#8a6038'], [1, '#6e4a2a']]), INK, 2.2);
    for (let r = 0; r < 6; r++) {
        const t = r / 5, y = fy - 8 - t * 56, hw = 142 - t * 36;
        line(g, fx - hw, y, fx + hw, y, 'rgba(40,24,12,0.5)', 2);
        const col = lv >= 3 ? '#e0b83a' : '#7bbf4c';
        for (let i = 0; i < 16; i++) {
            const px = fx - hw + 8 + i * (hw * 2 - 16) / 15;
            line(g, px, y - 1, px, y - 8 - (lv + 1) * 1.5, col, 2.6);
            circle(g, px, y - 9 - (lv + 1) * 1.5, 2.4, lighten(col, 0.2), null);
        }
    }
    fence(P, fx - 150, fx - 70, fy + 8); fence(P, fx + 70, fx + 150, fy + 8);
    // scarecrow
    const sx = fx + 40, sy = fy - 40;
    line(g, sx, sy + 6, sx, sy - 36, WOOD_D, 3); line(g, sx - 16, sy - 24, sx + 16, sy - 24, WOOD_D, 3);
    circle(g, sx, sy - 40, 8, '#e6d6a8', INK, 1.6); poly(g, [[sx - 12, sy - 44], [sx + 12, sy - 44], [sx + 6, sy - 56], [sx - 6, sy - 56]], '#7a4a2a', INK, 1.4);
    // little barn
    const bx = fx - 110;
    box(g, bx, fy - 120, 56, 50, lv >= 2 ? PLASTER : WOOD, 2, INK, 2);
    poly(g, [[bx - 8, fy - 118], [bx + 28, fy - 156], [bx + 64, fy - 118]], lv >= 2 ? ROOFS.tile : ROOFS.shingle, INK, 2);
    door(P, bx + 18, fy - 100, 20, 30, '#8a4a3a');
    P.door = { x: fx, y: fy + 4 };
    return finishP(P);
};

PAINT.orchard = (lv) => {
    const P = newP(3.4, 2.6);
    const g = P.g, rng = rnd(61);
    const by = P.H - 12;
    softShadow(g, P.W / 2, by, 110, 12, 0.28);
    const spots = lv >= 3 ? [[-72, -4], [0, -18], [72, -4], [-36, 8], [36, 8]] : lv === 2 ? [[-60, -2], [0, -14], [60, -2]] : [[-34, 0], [34, 0]];
    for (const [dx, dy] of spots.sort((a, b) => a[1] - b[1])) {
        const cx = P.W / 2 + dx, y = by + dy;
        line(g, cx, y, cx, y - 36, '#7d5230', 9);
        for (const [ox, oy, r] of [[-16, -50, 20], [16, -50, 20], [0, -68, 22], [0, -44, 22]]) {
            g.beginPath(); g.arc(cx + ox, y + oy, r, 0, 7);
            g.fillStyle = rad(g, cx + ox - 6, y + oy - 8, 2, r * 1.1, [[0, '#8fd06a'], [0.6, '#5fae4c'], [1, '#3f8a3e']]); g.fill(); g.strokeStyle = 'rgba(40,24,16,0.55)'; g.lineWidth = 1.6; g.stroke();
        }
        for (let i = 0; i < 6; i++) circle(g, cx + (rng() - 0.5) * 50, y - 36 - rng() * 36, 3.3, '#e04a3a', 'rgba(60,10,10,.7)', 1);
    }
    // basket and ladder
    ellipse(g, P.W / 2 + 4, by + 14, 14, 6, '#a8763a', INK, 1.6); for (let i = 0; i < 4; i++) circle(g, P.W / 2 - 6 + i * 6, by + 10, 4, i % 2 ? '#e04a3a' : '#d63a4a', null);
    P.door = { x: P.W / 2, y: by + 20 };
    return finishP(P);
};

PAINT.dock = (lv) => {
    const P = newP(2.8, 2.4);
    const g = P.g;
    const by = P.H - 10;
    // a pier running toward the water at the right
    box(g, P.W * 0.22, by - 20, P.W * 0.76, 16, WOOD, 2, INK, 2);
    for (let i = 0; i < 12; i++) line(g, P.W * 0.22 + 8 + i * 16, by - 20, P.W * 0.22 + 8 + i * 16, by - 4, 'rgba(60,34,16,.5)', 1.2);
    for (const px of [P.W * 0.3, P.W * 0.6, P.W * 0.92]) box(g, px, by - 8, 7, 22, WOOD_D, 1, INK, 1.4);
    // a hut
    box(g, P.W * 0.05, by - 76, 66, 56, lv >= 2 ? PLASTER : WOOD_L, 2, INK, 2);
    poly(g, [[P.W * 0.05 - 8, by - 74], [P.W * 0.05 + 33, by - 108], [P.W * 0.05 + 74, by - 74]], lv >= 2 ? ROOFS.blue : ROOFS.shingle, INK, 2);
    door(P, P.W * 0.05 + 22, by - 52, 20, 32, '#5a3d28');
    // nets, barrels, rod, little boat
    line(g, P.W * 0.62, by - 22, P.W * 0.9, by - 70, WOOD_D, 3); line(g, P.W * 0.9, by - 70, P.W * 0.9, by - 40, '#e8e0cc', 1);
    barrel(P, P.W * 0.46, by - 20, 14); crate(P, P.W * 0.54, by - 20, 12);
    if (lv >= 2) { poly(g, [[P.W * 0.66, by + 4], [P.W * 0.98, by + 4], [P.W * 0.92, by + 16], [P.W * 0.72, by + 16]], '#8a5a3a', INK, 1.8); }
    if (lv >= 3) lantern(P, P.W * 0.3, by - 56, 0.9);
    P.door = { x: P.W * 0.3, y: by + 6 };
    return finishP(P);
};

PAINT.herbgarden = (lv) => {
    const P = newP(2.5, lv >= 2 ? 2 : 1.5);
    const g = P.g, rng = rnd(71);
    const by = P.H - 10;
    softShadow(g, P.W / 2, by, 70, 8, 0.25);
    for (let b = 0; b < 3; b++) {
        const bx = 10 + b * 56;
        box(g, bx, by - 26, 50, 26, '#8a5a3a', 2, INK, 1.8); g.fillStyle = '#5a3d28'; g.fillRect(bx + 3, by - 24, 44, 6);
        for (let i = 0; i < 6; i++) {
            const px = bx + 6 + i * 7.5, ph = 12 + rng() * 14;
            line(g, px, by - 22, px, by - 22 - ph, '#4f8f45', 2.2);
            ellipse(g, px, by - 22 - ph, 5, 3, ['#7bbf5c', '#9ad06a', '#b58ad0'][i % 3], INK, 1);
        }
    }
    if (lv >= 2) {
        const gx = P.W * 0.5 - 40, gy = by - 100;
        poly(g, [[gx, by - 28], [gx + 4, gy + 20], [gx + 40, gy], [gx + 76, gy + 20], [gx + 80, by - 28]], 'rgba(190,230,240,0.55)', INK, 2);
        line(g, gx + 40, gy, gx + 40, by - 28, 'rgba(40,24,16,.6)', 1.6);
        for (let i = 0; i < 5; i++) { line(g, gx + 12 + i * 14, by - 30, gx + 12 + i * 14, by - 56 - (i % 2) * 12, '#4f8f45', 2.4); circle(g, gx + 12 + i * 14, by - 56 - (i % 2) * 12, 4, '#9ad06a', null); }
    }
    P.door = { x: P.W / 2, y: by + 4 };
    return finishP(P);
};

PAINT.henhouse = (lv) => {
    const m = mats(lv, 'barn');
    const P = build(2, 1.7, { ...m, floors: 1, wallH: 0.5, roofH: 0.34 + lv * 0.03, fill: 0.62, seed: 81, ov: 8 });
    const { x, bw, yb, yt } = P.geo;
    box(P.g, x + bw * 0.42, yb - 22, 14, 22, '#3b2a20', 2, INK, 1.6);
    line(P.g, x + bw * 0.42 - 16, yb, x + bw * 0.42, yb - 12, WOOD_D, 3);
    fence(P, x - 22, x + bw + 22, yb + 12);
    const chicken = (cx, cy, c) => { ellipse(P.g, cx, cy, 7, 5, c, INK, 1.4); circle(P.g, cx + 6, cy - 5, 3.6, c, INK, 1.2); poly(P.g, [[cx + 9, cy - 5], [cx + 13, cy - 4], [cx + 9, cy - 3]], '#f2a83b', INK, 0.8); circle(P.g, cx + 6, cy - 9, 1.8, '#d63a3a', null); };
    chicken(x - 14, yb + 8, '#ffffff'); chicken(x + bw + 10, yb + 6, '#e0a860'); if (lv >= 2) chicken(x + bw * 0.5, yb + 14, '#ffffff');
    P.door = { x: x + bw / 2, y: yb + 14 };
    return finishP(P);
};

PAINT.apiary = (lv) => {
    const P = newP(2.4, 1.9);
    const g = P.g, rng = rnd(91);
    const by = P.H - 10;
    softShadow(g, P.W / 2, by, 70, 8, 0.25);
    const n = 2 + lv;
    for (let i = 0; i < n; i++) {
        const hx = 14 + i * (P.W - 40) / Math.max(1, n - 1), hy = by - (i % 2) * 10;
        for (let t = 0; t < 3; t++) box(g, hx - 13 + t * 0.6, hy - 10 - t * 11, 26, 11, t % 2 ? '#f2d36b' : '#e8bf4a', 2, INK, 1.6);
        box(g, hx - 15, hy - 36, 30, 5, '#8a5a3a', 1, INK, 1.4);
        g.fillStyle = INK; g.fillRect(hx - 3, hy - 8, 6, 3);
        for (let b = 0; b < 3; b++) circle(g, hx + (rng() - 0.5) * 36, hy - 20 - rng() * 28, 1.8, '#f2d046', INK, 0.7);
    }
    flowerPatch(P, 6, by + 4, P.W - 12, 3);
    P.door = { x: P.W / 2, y: by + 6 };
    return finishP(P);
};

PAINT.mine = (lv) => {
    const P = newP(3.4, 2.5);
    const g = P.g, rng = rnd(101);
    const cx = P.W / 2, by = P.H - 12;
    softShadow(g, cx, by, 110, 12, 0.3);
    poly(g, [[cx - 108, by], [cx - 100, by - 90], [cx - 40, by - 140], [cx + 36, by - 150], [cx + 96, by - 100], [cx + 108, by]], lin(g, 0, by - 150, 0, by, [[0, '#9a95a8'], [1, '#6a6678']]), INK, 2.4);
    g.strokeStyle = 'rgba(30,24,40,.4)'; g.lineWidth = 1.5; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(cx - 90 + rng() * 40, by - 20 - i * 15); g.lineTo(cx + 40 + rng() * 40, by - 24 - i * 15); g.stroke(); }
    // gem glints
    for (let i = 0; i < 3 + lv * 2; i++) { const gx = cx - 80 + rng() * 160, gy = by - 30 - rng() * 100; poly(g, [[gx, gy - 4], [gx + 3, gy], [gx, gy + 4], [gx - 3, gy]], ['#7fd4e8', '#e07ae8', '#8ae87f'][i % 3], INK, 0.8); }
    // the timbered entrance
    box(g, cx - 38, by - 66, 76, 66, '#1c1620', 6, null);
    g.fillStyle = lin(g, cx - 30, by - 64, cx + 30, by, [[0, '#2b2236'], [1, '#0e0a14']]); g.beginPath(); g.moveTo(cx - 30, by); g.lineTo(cx - 30, by - 50); g.arc(cx, by - 50, 30, Math.PI, 0); g.lineTo(cx + 30, by); g.fill();
    box(g, cx - 40, by - 72, 12, 72, WOOD, 2, INK, 2); box(g, cx + 28, by - 72, 12, 72, WOOD, 2, INK, 2); box(g, cx - 44, by - 78, 88, 12, WOOD_L, 2, INK, 2);
    // rails and cart
    line(g, cx - 20, by - 2, cx - 90, by + 4, '#5a4a3a', 3); line(g, cx + 20, by - 2, cx + 70, by + 4, '#5a4a3a', 3);
    box(g, cx + 40, by - 24, 38, 20, '#7a7a86', 2, INK, 2); circle(g, cx + 50, by - 2, 5, '#3a3a44', INK, 1.4); circle(g, cx + 70, by - 2, 5, '#3a3a44', INK, 1.4);
    for (let i = 0; i < 5; i++) circle(g, cx + 46 + i * 7, by - 27, 5, i % 2 ? '#c06a3a' : '#7fd4e8', INK, 1);
    lantern(P, cx - 52, by - 60, 1);
    if (lv >= 2) lantern(P, cx + 52, by - 60, 1);
    if (lv >= 3) { line(g, cx - 60, by - 96, cx - 60, by - 150, WOOD_D, 5); line(g, cx - 60, by - 148, cx - 20, by - 120, WOOD_D, 4); }
    P.door = { x: cx, y: by + 6 };
    return finishP(P);
};

PAINT.library = (lv) => {
    const m = mats(lv + 3, 'stone');
    const P = build(3, 2, { ...m, floors: 2, wallH: 0.52, roofH: 0.46, fill: 0.9, seed: 111, rc: ROOFS.slate, ov: 12 });
    const { x, bw, yb, yt } = P.geo;
    door(P, x + bw / 2 - 12, yb - 40, 24, 40, '#4a2f20', { arch: true });
    for (let i = 0; i < 4; i++) win(P, x + 16 + i * (bw - 48) / 3, yt + 12, 14, 26, { round: true });
    for (const s of [-1, 1]) win(P, x + bw / 2 + s * 42 - 7, yb - 42, 14, 24, { round: true });
    sign(P, x + bw / 2, yt - 4, 'book', 28, 22);
    if (lv >= 2) { poly(P.g, [[x + bw * 0.5 - 22, yt - P.geo.rh], [x + bw * 0.5, yt - P.geo.rh - 36], [x + bw * 0.5 + 22, yt - P.geo.rh]], ROOFS.slate, INK, 2); win(P, x + bw * 0.5 - 6, yt - P.geo.rh - 22, 12, 14, { round: true }); }
    chimney(P, x + bw * 0.12, yt - P.geo.rh * 0.3, 12, 22);
    return finishP(P);
};

// ---- crafters
function crafterHouse(lv, o) {
    const m = mats(lv, o.mat || 'cottage');
    const P = build(o.w || 2, o.h || 2, { ...m, floors: o.floors || 1, wallH: o.wallH || 0.62, roofH: 0.42 + lv * 0.04, fill: o.fill || 0.86, seed: o.seed, rc: o.rc, ov: 12 });
    return P;
}
PAINT.carpenter = (lv) => {
    const P = crafterHouse(lv, { w: 3, h: 2, seed: 121, mat: 'barn', fill: 0.7 });
    const { x, bw, yb, yt } = P.geo;
    door(P, x + bw * 0.2, yb - 36, 22, 36, '#6a4a2a');
    win(P, x + bw * 0.55, yb - 38, 18, 20, { curtain: '#d9b45a' });
    sign(P, x + bw * 0.62, yt - 4, 'saw', 24, 20);
    planks(P, x + bw + 6, yb, 46, 6); logs(P, x - 44, yb, 3, 6);
    // sawhorse
    line(P.g, x + bw * 0.44, yb, x + bw * 0.4, yb - 22, WOOD_D, 3); line(P.g, x + bw * 0.52, yb, x + bw * 0.56, yb - 22, WOOD_D, 3); line(P.g, x + bw * 0.4, yb - 22, x + bw * 0.56, yb - 22, WOOD_L, 4);
    chimney(P, x + bw * 0.78, yt - P.geo.rh * 0.3, 13, 24);
    return finishP(P);
};
PAINT.mill = (lv) => {
    const P = newP(2.4, 3.1);
    const g = P.g;
    const cx = P.W / 2, by = P.H - 10;
    softShadow(g, cx, by, 54, 9, 0.3);
    const bw = 62 + lv * 4, tw = 40;
    poly(g, [[cx - bw / 2, by], [cx - tw / 2, by - 110], [cx + tw / 2, by - 110], [cx + bw / 2, by]], lin(g, cx - bw / 2, 0, cx + bw / 2, 0, [[0, lighten(lv >= 2 ? PLASTER : STONE, 0.1)], [1, darken(lv >= 2 ? PLASTER : STONE, 0.2)]]), INK, 2.2);
    g.strokeStyle = 'rgba(60,40,24,.35)'; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const y = by - 12 - i * 17; g.beginPath(); g.moveTo(cx - bw / 2 + (110 - (by - y)) * 0.0 + 4, y); g.lineTo(cx + bw / 2 - 4, y); g.stroke(); }
    poly(g, [[cx - tw / 2 - 8, by - 108], [cx, by - 150], [cx + tw / 2 + 8, by - 108]], lv >= 3 ? ROOFS.tile : ROOFS.shingle, INK, 2.2);
    door(P, cx - 10, by - 34, 20, 34, '#6a4a2a', { arch: true });
    win(P, cx - 6, by - 82, 12, 16, { round: true });
    // the hub; the blades are a separate rotating sprite
    P.extra.hub = { x: cx / PX, y: (by - 100) / PX };
    circle(g, cx, by - 100, 6, '#5a3d28', INK, 1.8);
    sack(P, cx + bw / 2 + 4, by + 1, 13, '#f2ead0'); sack(P, cx - bw / 2 - 6, by + 1, 13, '#f2ead0');
    P.door = { x: cx, y: by + 4 };
    return finishP(P);
};
export function paintBlades(lv) {
    const S = 190, c = canvas(S, S), g = ctx2(c);
    g.translate(S / 2, S / 2);
    for (let i = 0; i < 4; i++) {
        g.save(); g.rotate(i * Math.PI / 2);
        line(g, 0, 0, 0, -84, WOOD_D, 5);
        poly(g, [[3, -20], [24, -22], [24, -82], [3, -82]], lv >= 2 ? '#f2ead0' : '#e0cf9a', INK, 2);
        g.strokeStyle = 'rgba(80,60,30,.5)'; g.lineWidth = 1.2; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(3, -20 - k * 12.5); g.lineTo(24, -22 - k * 12.5); g.stroke(); }
        g.restore();
    }
    circle(g, 0, 0, 8, '#5a3d28', INK, 2);
    return c;
}
PAINT.loom = (lv) => {
    const P = crafterHouse(lv, { seed: 131, fill: 0.84 });
    const { x, bw, yb, yt } = P.geo;
    door(P, x + bw * 0.58, yb - 32, 18, 32, '#8a4a5a');
    win(P, x + bw * 0.12, yb - 36, 16, 20, { curtain: '#c8605a', box: true });
    sign(P, x + bw * 0.5, yt - 2, 'thread', 22, 20);
    // cloth hung to dry
    line(P.g, x - 14, yb - 50, x - 14, yb, WOOD_D, 3); line(P.g, x + 6, yb - 50, x + 6, yb, WOOD_D, 3); line(P.g, x - 14, yb - 50, x + 6, yb - 50, WOOD_D, 3);
    ['#e85a7a', '#4f9ac8', '#f2d046'].forEach((c, i) => { P.g.fillStyle = c; P.g.fillRect(x - 12 + i * 6, yb - 48, 5, 28 + i * 3); P.g.strokeStyle = INK; P.g.lineWidth = 1; P.g.strokeRect(x - 12 + i * 6, yb - 48, 5, 28 + i * 3); });
    chimney(P, x + bw * 0.78, yt - P.geo.rh * 0.3, 12, 22);
    return finishP(P);
};
PAINT.smithy = (lv) => {
    const P = crafterHouse(lv, { w: 3, h: 2, seed: 141, mat: 'stone', fill: 0.7 });
    const { x, bw, yb, yt } = P.geo;
    // the forge opening, glowing
    box(P.g, x + bw * 0.12, yb - 44, 36, 44, '#2a1c16', 4, INK, 2);
    P.g.fillStyle = rad(P.g, x + bw * 0.12 + 18, yb - 14, 2, 26, [[0, '#ffd36b'], [0.5, '#e8702a'], [1, '#6a2410']]); P.g.fillRect(x + bw * 0.12 + 3, yb - 41, 30, 38);
    glow(P.eg, x + bw * 0.12 + 18, yb - 22, 54, 'rgb(255,130,40)', 1);
    P.eg.fillStyle = 'rgb(255,190,90)'; P.eg.fillRect(x + bw * 0.12 + 4, yb - 40, 28, 36);
    door(P, x + bw * 0.62, yb - 34, 20, 34, '#4a3a30');
    sign(P, x + bw * 0.5, yt - 2, 'anvil', 24, 18);
    // anvil + rack
    box(P.g, x + bw * 0.46, yb - 14, 20, 6, '#7c8494', 1, INK, 1.6); box(P.g, x + bw * 0.48, yb - 8, 16, 8, '#5c6474', 1, INK, 1.6);
    for (let i = 0; i < 3; i++) line(P.g, x + bw + 8 + i * 6, yb - 6, x + bw + 8 + i * 6, yb - 36, '#c6ccd6', 2.4);
    barrel(P, x - 10, yb + 2, 13);
    const ch = (P.geo.rh); chimney(P, x + bw * 0.2, yt - ch * 0.3, 16, 34 + lv * 4);
    return finishP(P);
};
PAINT.alchemist = (lv) => {
    const P = crafterHouse(lv, { seed: 151, fill: 0.78, rc: ROOFS.blue });
    const { x, bw, yb, yt } = P.geo;
    door(P, x + bw * 0.55, yb - 32, 18, 32, '#5a4a7a', { arch: true });
    win(P, x + bw * 0.12, yb - 36, 18, 18, { round: true });
    sign(P, x + bw * 0.5, yt - 2, 'flask', 22, 20);
    for (let i = 0; i < 3; i++) { const bx = x + bw + 6 + i * 11; poly(P.g, [[bx - 3, yb - 20], [bx + 3, yb - 20], [bx + 3, yb - 14], [bx + 7, yb], [bx - 7, yb], [bx - 3, yb - 14]], ['#b58ad0', '#7fd4e8', '#8ae87f'][i], INK, 1.4); }
    chimney(P, x + bw * 0.2, yt - P.geo.rh * 0.3, 12, 24);
    glow(P.eg, x + bw + 16, yb - 8, 26, 'rgb(190,120,255)', 0.9);
    return finishP(P);
};
PAINT.tavern = (lv) => {
    const m = mats(Math.min(4, lv + 1));
    const P = build(3, 3, { ...m, floors: 2, wallH: 0.5, roofH: 0.48 + lv * 0.03, fill: 0.92, seed: 161, ov: 14, rc: lv >= 3 ? ROOFS.red : ROOFS.shingle });
    const { x, bw, yb, yt } = P.geo;
    door(P, x + bw / 2 - 13, yb - 44, 26, 44, '#6a3a2a', { arch: true });
    win(P, x + bw * 0.14, yb - 40, 20, 22, { curtain: '#d9884a', box: true }); win(P, x + bw * 0.78, yb - 40, 20, 22, { curtain: '#d9884a', box: true });
    for (let i = 0; i < 3; i++) win(P, x + bw * (i + 1) / 4 - 9, yt + 10, 18, 22, { curtain: '#d9884a' });
    // hanging mug sign + lanterns
    line(P.g, x + bw + 4, yt + 38, x + bw + 30, yt + 38, INK, 3); sign(P, x + bw + 30, yt + 38, 'mug', 24, 22);
    lantern(P, x + bw / 2 - 30, yb - 52); lantern(P, x + bw / 2 + 30, yb - 52);
    barrel(P, x - 6, yb + 2, 15); barrel(P, x + 9, yb + 3, 14); crate(P, x + bw - 4, yb + 2, 14);
    // awning
    poly(P.g, [[x + bw / 2 - 30, yb - 54], [x + bw / 2 + 30, yb - 54], [x + bw / 2 + 36, yb - 44], [x + bw / 2 - 36, yb - 44]], '#c8453a', INK, 1.8);
    chimney(P, x + bw * 0.78, yt - P.geo.rh * 0.35, 16, 34);
    if (lv >= 3) { circle(P.g, x + bw * 0.5, yt - P.geo.rh - 6, 6, '#f2d36b', INK, 1.6); }
    return finishP(P);
};
PAINT.guild = (lv) => {
    const m = mats(Math.max(3, lv + 2), 'stone');
    const P = build(3, 3, { ...m, floors: lv >= 3 ? 2 : 1, wallH: 0.66, roofH: 0.46 + lv * 0.03, fill: 0.9, seed: 171, ov: 12, rc: lv >= 3 ? ROOFS.blue : ROOFS.slate });
    const { x, bw, yb, yt } = P.geo;
    door(P, x + bw / 2 - 15, yb - 46, 30, 46, '#5a3d28', { arch: true });
    for (const s of [-1, 1]) win(P, x + bw / 2 + s * 56 - 8, yb - 48, 16, 24, { round: true });
    // banners
    for (const s of [-1, 1]) { const bx = x + bw / 2 + s * 34 - 7; poly(P.g, [[bx, yb - 76], [bx + 14, yb - 76], [bx + 14, yb - 46], [bx + 7, yb - 52], [bx, yb - 46]], '#b8323a', INK, 1.6); line(P.g, bx + 3, yb - 68, bx + 11, yb - 56, '#f2d36b', 1.6); line(P.g, bx + 11, yb - 68, bx + 3, yb - 56, '#f2d36b', 1.6); }
    sign(P, x + bw / 2, yt + 6, 'sword', 28, 22);
    // flag
    line(P.g, x + bw * 0.86, yt - P.geo.rh * 0.6, x + bw * 0.86, yt - P.geo.rh * 0.6 - 44, INK, 3); poly(P.g, [[x + bw * 0.86, yt - P.geo.rh * 0.6 - 44], [x + bw * 0.86 + 28, yt - P.geo.rh * 0.6 - 36], [x + bw * 0.86, yt - P.geo.rh * 0.6 - 28]], '#b8323a', INK, 1.6);
    // notice board
    box(P.g, x - 24, yb - 40, 28, 28, '#9a6a3a', 2, INK, 1.8); line(P.g, x - 10, yb - 12, x - 10, yb, WOOD_D, 3);
    for (const [dx, dy] of [[4, 4], [14, 8], [6, 16]]) box(P.g, x - 24 + dx, yb - 40 + dy, 9, 10, '#f2ead0', 0, INK, 1);
    lantern(P, x + bw / 2 - 28, yb - 54, 0.9); lantern(P, x + bw / 2 + 28, yb - 54, 0.9);
    return finishP(P);
};
PAINT.inn = (lv) => {
    const m = mats(Math.min(4, lv + 1));
    const P = build(3, 3, { ...m, floors: 2, wallH: 0.5, roofH: 0.46 + lv * 0.03, fill: 0.9, seed: 181, ov: 14, rc: ROOFS.blue });
    const { x, bw, yb, yt } = P.geo;
    door(P, x + bw / 2 - 12, yb - 42, 24, 42, '#5a3d28', { arch: true });
    win(P, x + bw * 0.14, yb - 38, 18, 20, { curtain: '#6aa5c8' }); win(P, x + bw * 0.8, yb - 38, 18, 20, { curtain: '#6aa5c8' });
    for (let i = 0; i < 3; i++) win(P, x + bw * (i + 1) / 4 - 8, yt + 10, 16, 20, { curtain: '#f2d046', box: i !== 1 });
    // balcony
    box(P.g, x + bw / 2 - 28, yt + 36, 56, 5, WOOD, 1, INK, 1.6); for (let i = 0; i < 7; i++) line(P.g, x + bw / 2 - 26 + i * 8.5, yt + 30, x + bw / 2 - 26 + i * 8.5, yt + 36, INK, 1.4);
    sign(P, x + bw * 0.14, yt - 2, 'bed', 24, 20);
    lantern(P, x + bw / 2 - 28, yb - 50, 0.9); lantern(P, x + bw / 2 + 28, yb - 50, 0.9);
    chimney(P, x + bw * 0.8, yt - P.geo.rh * 0.35, 14, 30);
    bush(P, x + 2, yb + 3, 10); bush(P, x + bw - 2, yb + 3, 10);
    return finishP(P);
};
PAINT.itemshop = (lv) => {
    const P = crafterHouse(lv, { seed: 191, fill: 0.9, floors: lv >= 3 ? 2 : 1 });
    const { x, bw, yb, yt } = P.geo;
    // shopfront: big window, awning
    win(P, x + bw * 0.1, yb - 38, 30, 24, { frame: '#6a4a2a' });
    door(P, x + bw * 0.62, yb - 36, 20, 36, '#4a6a8a');
    const ay = yb - 46;
    for (let i = 0; i < 8; i++) { P.g.fillStyle = i % 2 ? '#fff' : '#d94a4a'; P.g.beginPath(); P.g.moveTo(x + 6 + i * (bw - 12) / 8, ay); P.g.lineTo(x + 6 + (i + 1) * (bw - 12) / 8, ay); P.g.lineTo(x + 10 + (i + 1) * (bw - 20) / 8, ay + 14); P.g.lineTo(x + 10 + i * (bw - 20) / 8, ay + 14); P.g.fill(); }
    P.g.strokeStyle = INK; P.g.lineWidth = 1.6; P.g.strokeRect(x + 6, ay, bw - 12, 14);
    line(P.g, x + bw + 2, yt + 18, x + bw + 24, yt + 18, INK, 3); sign(P, x + bw + 24, yt + 18, 'scales', 22, 20);
    crate(P, x - 4, yb + 2, 13, '#c9a05a'); sack(P, x + bw + 2, yb + 3, 13, '#e6d6a8');
    chimney(P, x + bw * 0.8, yt - P.geo.rh * 0.35, 12, 24);
    return finishP(P);
};
PAINT.market = (lv) => {
    const P = newP(2.6, 1.8 + lv * 0.05);
    const g = P.g;
    const by = P.H - 10;
    softShadow(g, P.W / 2, by, 80, 9, 0.28);
    const stalls = lv >= 2 ? 2 : 1;
    for (let s = 0; s < stalls; s++) {
        const sx = stalls === 1 ? P.W / 2 : P.W * (0.3 + s * 0.4);
        const w = stalls === 1 ? 100 : 76;
        line(g, sx - w / 2 + 2, by, sx - w / 2 + 2, by - 66, WOOD_D, 4); line(g, sx + w / 2 - 2, by, sx + w / 2 - 2, by - 66, WOOD_D, 4);
        box(g, sx - w / 2, by - 24, w, 24, WOOD, 2, INK, 2);
        for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : ['#d94a4a', '#4f9ac8', '#7bb661'][s % 3]; g.beginPath(); g.moveTo(sx - w / 2 - 4 + i * (w + 8) / 6, by - 70); g.lineTo(sx - w / 2 - 4 + (i + 1) * (w + 8) / 6, by - 70); g.lineTo(sx - w / 2 - 6 + (i + 1) * (w + 12) / 6, by - 54); g.lineTo(sx - w / 2 - 6 + i * (w + 12) / 6, by - 54); g.fill(); }
        g.strokeStyle = INK; g.lineWidth = 1.8; g.strokeRect(sx - w / 2 - 4, by - 70, w + 8, 16);
        const prod = [['#e04a3a', '#f2d046', '#7bbf4c'], ['#e07a3a', '#b58ad0', '#f2ead0']][s % 2];
        for (let i = 0; i < 6; i++) circle(g, sx - w / 2 + 12 + i * (w - 24) / 5, by - 28, 5, prod[i % 3], INK, 1.2);
    }
    sack(P, P.W - 14, by + 2, 14); crate(P, 4, by + 2, 14);
    if (lv >= 3) { lantern(P, P.W * 0.5, by - 78, 0.8); }
    P.door = { x: P.W / 2, y: by + 6 };
    return finishP(P);
};
PAINT.healer = (lv) => {
    const P = newP(2.6, lv >= 2 ? 2.8 : 1.9);
    const g = P.g;
    const cx = P.W / 2, by = P.H - 10;
    softShadow(g, cx, by, 70, 9, 0.28);
    if (lv === 1) {
        // a little healing garden with a gazebo
        for (const s of [-1, 1]) line(g, cx + s * 36, by, cx + s * 36, by - 54, WOOD_L, 5);
        poly(g, [[cx - 50, by - 52], [cx, by - 86], [cx + 50, by - 52]], ROOFS.green, INK, 2);
        flowerPatch(P, cx - 56, by + 2, 112, 7);
        circle(g, cx, by - 20, 9, '#e6ebf2', INK, 1.6); line(g, cx, by - 12, cx, by - 4, INK, 2);
    } else {
        box(g, cx - 40, by - 62, 80, 62, lv >= 3 ? '#e6e2da' : PLASTER, 2, INK, 2);
        poly(g, [[cx - 48, by - 60], [cx, by - 100], [cx + 48, by - 60]], lv >= 3 ? ROOFS.blue : ROOFS.slate, INK, 2.2);
        box(g, cx - 14, by - 150 + 2, 28, 54, '#e6e2da', 2, INK, 2);
        poly(g, [[cx - 20, by - 148], [cx, by - 178], [cx + 20, by - 148]], ROOFS.blue, INK, 2);
        circle(g, cx, by - 124, 5, '#f2d36b', INK, 1.4);
        door(P, cx - 11, by - 40, 22, 40, '#6a4a2a', { arch: true });
        win(P, cx - 32, by - 44, 11, 18, { round: true }); win(P, cx + 21, by - 44, 11, 18, { round: true });
        g.fillStyle = '#7bb661'; g.fillRect(cx - 2, by - 90, 4, 14); g.fillRect(cx - 7, by - 85, 14, 4);
        flowerPatch(P, cx - 56, by + 4, 112, 8);
    }
    P.door = { x: cx, y: by + 6 };
    return finishP(P);
};
PAINT.watchtower = (lv) => {
    const P = newP(2.2, 3.2 + lv * 0.15);
    const g = P.g;
    const cx = P.W / 2, by = P.H - 10;
    softShadow(g, cx, by, 50, 8, 0.3);
    const th = 120 + lv * 20, tw = 44;
    poly(g, [[cx - tw / 2 - 6, by], [cx - tw / 2, by - th], [cx + tw / 2, by - th], [cx + tw / 2 + 6, by]], lv >= 2 ? lin(g, cx - tw / 2, 0, cx + tw / 2, 0, [[0, '#c4beb4'], [1, '#8f897d']]) : lin(g, cx - tw / 2, 0, cx + tw / 2, 0, [[0, WOOD_L], [1, WOOD_D]]), INK, 2.2);
    g.strokeStyle = 'rgba(40,28,20,.4)'; g.lineWidth = 1.2; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(cx - tw / 2 - 5 + i * 0.5, by - i * th / 8); g.lineTo(cx + tw / 2 + 5 - i * 0.5, by - i * th / 8); g.stroke(); }
    box(g, cx - tw / 2 - 12, by - th - 4, tw + 24, 14, WOOD, 2, INK, 2);
    for (let i = 0; i < 5; i++) box(g, cx - tw / 2 - 10 + i * 12, by - th - 14, 8, 12, WOOD_L, 1, INK, 1.4);
    poly(g, [[cx - tw / 2 - 6, by - th - 14], [cx, by - th - 46], [cx + tw / 2 + 6, by - th - 14]], lv >= 3 ? ROOFS.blue : ROOFS.shingle, INK, 2);
    win(P, cx - 6, by - th + 22, 12, 18, { round: true });
    door(P, cx - 8, by - 28, 16, 28, '#5a3d28');
    line(g, cx, by - th - 46, cx, by - th - 72, INK, 2.4); poly(g, [[cx, by - th - 72], [cx + 22, by - th - 65], [cx, by - th - 57]], '#d94a4a', INK, 1.4);
    lantern(P, cx + tw / 2 + 12, by - th + 6, 0.8);
    P.door = { x: cx, y: by + 6 };
    return finishP(P);
};
PAINT.stables = (lv) => {
    const m = mats(lv + 1, 'barn');
    const P = build(3, 2, { ...m, floors: 1, wallH: 0.6, roofH: 0.42, fill: 0.9, seed: 201, ov: 10 });
    const { x, bw, yb, yt } = P.geo;
    for (let i = 0; i < 2; i++) {
        const dx = x + 14 + i * (bw / 2 - 4);
        box(P.g, dx, yb - 40, bw / 2 - 22, 40, '#3b2a20', 2, INK, 2);
        const hx = dx + (bw / 2 - 22) / 2;
        poly(P.g, [[hx - 10, yb], [hx - 10, yb - 20], [hx - 4, yb - 30], [hx + 6, yb - 26], [hx + 12, yb - 18], [hx + 4, yb - 14], [hx + 4, yb]], i ? '#e6d6b8' : '#8a5a3a', INK, 1.6);
        circle(P.g, hx + 1, yb - 24, 1.4, INK, null);
    }
    sign(P, x + bw / 2, yt - 2, 'horse', 24, 20);
    for (let i = 0; i < 3; i++) box(P.g, x + bw + 2 + i * 8, yb - 12 - i * 3, 20, 12, '#d9b45a', 2, INK, 1.4);
    fence(P, x - 24, x + 4, yb + 10);
    return finishP(P);
};

// ---- decorations
PAINT.flowerbed = () => {
    const P = newP(1, 0.7);
    softShadow(P.g, P.W / 2, P.H - 10, 26, 5, 0.25);
    box(P.g, 10, P.H - 28, P.W - 20, 20, '#8a5a3a', 3, INK, 1.8);
    P.g.fillStyle = '#5a3d28'; P.g.fillRect(13, P.H - 26, P.W - 26, 6);
    flowerPatch(P, 14, P.H - 26, P.W - 28, 1);
    flowerPatch(P, 14, P.H - 34, P.W - 28, 2);
    return finishP(P);
};
PAINT.lantern = () => {
    const P = newP(0.7, 1.4);
    const g = P.g, cx = P.W / 2, by = P.H - 8;
    softShadow(g, cx, by, 14, 4, 0.25);
    line(g, cx, by, cx, by - 62, '#3a3a44', 5);
    box(g, cx - 4, by - 8, 8, 8, '#3a3a44', 1, INK, 1.4);
    box(g, cx - 8, by - 82, 16, 20, '#ffd36b', 3, INK, 2);
    poly(g, [[cx - 11, by - 82], [cx, by - 94], [cx + 11, by - 82]], '#3a3a44', INK, 1.6);
    glow(P.eg, cx, by - 72, 34, 'rgb(255,190,90)', 1);
    P.eg.fillStyle = 'rgb(255,226,150)'; P.eg.fillRect(cx - 6, by - 80, 12, 16);
    return finishP(P);
};
PAINT.bench = () => {
    const P = newP(1, 0.7);
    const g = P.g, cx = P.W / 2, by = P.H - 10;
    softShadow(g, cx, by, 28, 5, 0.25);
    for (const s of [-1, 1]) box(g, cx + s * 22 - 3, by - 20, 6, 20, WOOD_D, 1, INK, 1.4);
    box(g, cx - 30, by - 24, 60, 8, WOOD_L, 2, INK, 1.8); box(g, cx - 30, by - 40, 60, 7, WOOD, 2, INK, 1.8);
    return finishP(P);
};
PAINT.well = () => {
    const P = newP(1, 1.3);
    const g = P.g, cx = P.W / 2, by = P.H - 8;
    softShadow(g, cx, by, 28, 6, 0.3);
    box(g, cx - 22, by - 24, 44, 24, '#a8a296', 4, INK, 2);
    g.strokeStyle = 'rgba(40,30,20,.4)'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - 22, by - 8 - i * 8); g.lineTo(cx + 22, by - 8 - i * 8); g.stroke(); }
    ellipse(g, cx, by - 24, 22, 7, '#2c5a78', INK, 1.8);
    for (const s of [-1, 1]) box(g, cx + s * 20 - 3, by - 62, 6, 40, WOOD, 1, INK, 1.6);
    poly(g, [[cx - 30, by - 62], [cx, by - 82], [cx + 30, by - 62]], ROOFS.shingle, INK, 2);
    line(g, cx, by - 62, cx, by - 38, '#e8e0cc', 1.4); box(g, cx - 4, by - 38, 8, 7, WOOD_D, 1, INK, 1.2);
    return finishP(P);
};
PAINT.fountain = () => {
    const P = newP(2, 1.9);
    const g = P.g, cx = P.W / 2, by = P.H - 14;
    softShadow(g, cx, by, 56, 10, 0.3);
    ellipse(g, cx, by - 8, 56, 16, '#b8b2a6', INK, 2.2); ellipse(g, cx, by - 12, 48, 12, '#4f9ac8', INK, 1.6);
    g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(cx - 12, by - 14, 16, 3, 0, 0, 7); g.fill();
    box(g, cx - 8, by - 56, 16, 46, '#c4beb4', 2, INK, 2);
    ellipse(g, cx, by - 54, 28, 8, '#b8b2a6', INK, 2); ellipse(g, cx, by - 56, 22, 5.5, '#6ab4d8', INK, 1.4);
    box(g, cx - 5, by - 86, 10, 32, '#c4beb4', 2, INK, 2);
    g.strokeStyle = 'rgba(190,230,250,.9)'; g.lineWidth = 2.2;
    for (const s of [-1, 0, 1]) { g.beginPath(); g.moveTo(cx, by - 88); g.quadraticCurveTo(cx + s * 18, by - 100, cx + s * 26, by - 58); g.stroke(); }
    return finishP(P);
};
PAINT.statue = () => {
    const P = newP(2, 2.6);
    const g = P.g, cx = P.W / 2, by = P.H - 12;
    softShadow(g, cx, by, 50, 9, 0.3);
    box(g, cx - 38, by - 28, 76, 28, '#a8a296', 3, INK, 2); box(g, cx - 28, by - 52, 56, 24, '#c4beb4', 3, INK, 2);
    g.fillStyle = lin(g, cx - 20, 0, cx + 20, 0, [[0, '#e0dcd2'], [1, '#9a958a']]);
    poly(g, [[cx - 14, by - 52], [cx - 16, by - 100], [cx - 8, by - 118], [cx + 8, by - 118], [cx + 16, by - 100], [cx + 14, by - 52]], g.fillStyle, INK, 2);
    circle(g, cx, by - 130, 11, '#e0dcd2', INK, 2);
    line(g, cx + 22, by - 60, cx + 22, by - 140, '#d8d4c8', 5); line(g, cx + 14, by - 110, cx + 30, by - 110, '#d8d4c8', 4);
    poly(g, [[cx - 14, by - 100], [cx - 36, by - 70], [cx - 20, by - 64], [cx - 14, by - 80]], '#b8b2a6', INK, 1.8);
    return finishP(P);
};

// ---------------------------------------------------------------- scaffolding and bunting
/** The wooden frame that stands around something being built. */
export function paintScaffold(wTiles, hTiles) {
    const P = newP(wTiles + 0.3, hTiles);
    const g = P.g, rng = rnd(7);
    const x = 8, w = P.W - 16, by = P.H - 6, h = P.H - 16;
    softShadow(g, P.W / 2, by, w * 0.55, 9, 0.3);
    for (const px of [x + 4, x + w * 0.5, x + w - 4]) { line(g, px, by, px, by - h, WOOD_D, 5); line(g, px - 1, by, px - 1, by - h, WOOD_L, 1.5); }
    for (let i = 1; i <= 3; i++) {
        const y = by - h * i / 4;
        box(g, x, y, w, 6, WOOD, 1, INK, 1.4);
        line(g, x + 4, y + 6, x + w * 0.5, y - h / 4 + 6, 'rgba(90,60,30,.8)', 3);
    }
    for (let k = 0; k < 4; k++) { const sx = x + 14 + rng() * (w - 28); box(g, sx, by - 12, 14, 12, '#9a9488', 2, INK, 1.4); }
    return { c: P.c, e: P.e, w: P.W / PX, h: P.H / PX };
}

const cache = new Map();
/** The sprite for a building type at a level: { c, e, w, h, smoke, door, extra }. */
export function paintBuilding(type, lv) {
    const key = `${type}:${lv}`;
    let v = cache.get(key);
    if (!v) { v = PAINT[type](Math.max(1, lv)); cache.set(key, v); }
    return v;
}
export const hasPainter = (type) => !!PAINT[type];
