/**
 * objects.js — pixel sprites for everything that isn't a fighter: pickups,
 * weapons, breakable props, projectiles, hit sparks, explosions and hazard
 * markers. Drawn pixel by pixel into RGBA buffers (pure JS, runs in Node),
 * outlined automatically, and shelf-packed into one atlas.
 */

function hex(c) {
    if (Array.isArray(c)) return c;
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

export class Pix {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
    set(x, y, c, a = 255) {
        x |= 0; y |= 0;
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
        const k = hex(c), i = (y * this.w + x) * 4;
        this.d[i] = k[0]; this.d[i + 1] = k[1]; this.d[i + 2] = k[2]; this.d[i + 3] = k[3] !== undefined && k.length > 3 ? Math.min(a, k[3]) : a;
        return this;
    }
    get(x, y) { const i = (y * this.w + x) * 4; return this.d[i + 3]; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
    hline(x0, x1, y, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); return this; }
    vline(x, y0, y1, c) { for (let y = y0; y <= y1; y++) this.set(x, y, c); return this; }
    disc(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c); return this; }
    ellipse(cx, cy, rx, ry, c) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.set(x, y, c); return this; }
    ring(cx, cy, rx, ry, c, th = 1) { for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) { const e = Math.sqrt(((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2); if (e <= 1 && e >= 1 - th / Math.min(rx, ry)) this.set(x, y, c); } return this; }
    line(x0, y0, x1, y1, c) {
        x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
        return this;
    }
    poly(pts, c) {
        let minY = 1e9, maxY = -1e9;
        for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
        for (let y = Math.floor(minY); y <= maxY; y++) {
            const xs = [];
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                const [xi, yi] = pts[i], [xj, yj] = pts[j];
                if ((yi > y + 0.5) !== (yj > y + 0.5)) xs.push(xi + (y + 0.5 - yi) * (xj - xi) / (yj - yi));
            }
            xs.sort((a, b) => a - b);
            for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.set(x, y, c);
        }
        return this;
    }
    outline(c = '#0c0810') {
        const add = [];
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
            if (this.get(x, y) > 0) continue;
            if ((x > 0 && this.get(x - 1, y) > 200) || (x < this.w - 1 && this.get(x + 1, y) > 200) || (y > 0 && this.get(x, y - 1) > 200) || (y < this.h - 1 && this.get(x, y + 1) > 200)) add.push([x, y]);
        }
        for (const [x, y] of add) this.set(x, y, c);
        return this;
    }
}

const R = (n) => Math.random() * n;
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// ---------------------------------------------------------------- items
function noodles() { const p = new Pix(16, 14); p.ellipse(8, 9, 7, 4.5, '#d8d4c8').rect(1, 9, 15, 2, '#d8d4c8'); p.ellipse(8, 7, 6, 2, '#f0c060'); p.hline(4, 12, 7, '#ffd890'); p.rect(3, 10, 10, 1, '#c03040'); p.line(10, 1, 13, 7, '#a07040').line(12, 1, 14, 7, '#a07040'); p.set(6, 6, '#7ac050'); p.set(9, 6, '#f08060'); return p.outline(); }
function bento() { const p = new Pix(18, 12); p.rect(1, 2, 16, 9, '#c02838').rect(2, 3, 14, 7, '#2a1a1a').rect(2, 3, 6, 7, '#f4f0e8').rect(9, 3, 3, 3, '#f08060').rect(13, 3, 3, 3, '#80d060').rect(9, 7, 7, 3, '#f0c040'); p.rect(1, 1, 16, 1, '#e04050'); return p.outline(); }
function medkit() { const p = new Pix(16, 14); p.rect(1, 3, 14, 10, '#f0f0f4').rect(1, 3, 14, 2, '#d0d4e0').rect(6, 1, 4, 2, '#9098a8'); p.rect(7, 5, 2, 7, '#e02838').rect(4, 7, 8, 2, '#e02838'); return p.outline(); }
function cell() { const p = new Pix(10, 16); p.rect(1, 2, 8, 13, '#30384a').rect(3, 0, 4, 2, '#8890a0'); p.rect(2, 4, 6, 9, '#3af4ff').rect(2, 4, 2, 9, '#a8ffff'); p.rect(4, 6, 2, 2, '#ffffff'); p.rect(3, 9, 4, 1, '#30384a'); return p.outline(); }
function chip() { const p = new Pix(12, 8); p.rect(1, 1, 10, 6, '#f0c030').rect(1, 1, 10, 1, '#fff090').rect(3, 3, 3, 2, '#806010').rect(8, 2, 2, 4, '#c08a10'); return p.outline(); }
function stack() { const p = new Pix(14, 12); for (let k = 0; k < 3; k++) { p.rect(1 + k, 7 - k * 3, 11, 4, '#f0c030').hline(1 + k, 11 + k, 7 - k * 3, '#fff090'); p.rect(4 + k, 8 - k * 3, 3, 2, '#806010'); } return p.outline(); }
function shard() { const p = new Pix(12, 16); p.poly([[6, 0], [11, 6], [6, 15], [1, 6]], '#c070ff'); p.poly([[6, 1], [8, 6], [6, 13], [3, 6]], '#f0c8ff'); p.line(6, 1, 6, 13, '#ffffff'); return p.outline(); }
function core() { const p = new Pix(16, 16); p.disc(8, 8, 6.5, '#2a3048'); p.disc(8, 8, 4.5, '#3af4ff'); p.disc(7, 7, 2, '#ffffff'); p.ring(8, 8, 7.5, 7.5, '#ff3fa4'); return p.outline(); }

// ---------------------------------------------------------------- weapons
function pipe() { const p = new Pix(30, 6); p.rect(1, 1, 28, 4, '#7a8494').hline(1, 28, 1, '#c4ccd8').hline(1, 28, 4, '#4a5260'); p.rect(0, 0, 3, 6, '#5a6270').rect(27, 0, 3, 6, '#5a6270'); return p.outline(); }
function katana() { const p = new Pix(36, 6); p.rect(0, 2, 9, 3, '#3a2028').hline(1, 8, 2, '#6a3040'); for (let x = 1; x < 9; x += 2) p.set(x, 3, '#d8c070'); p.rect(9, 1, 2, 5, '#d8a83a'); p.poly([[11, 2], [32, 2], [35, 3], [32, 4], [11, 4]], '#dfe6f2'); p.hline(12, 33, 2, '#ffffff'); p.hline(12, 31, 4, '#8a96b0'); return p.outline(); }
function baton() { const p = new Pix(24, 6); p.rect(0, 1, 8, 4, '#2a2a34').rect(8, 2, 13, 2, '#4a5060').rect(20, 1, 4, 4, '#ffd23a').set(22, 2, '#ffffff'); p.hline(9, 20, 2, '#8a92a6'); return p.outline(); }
function knives() { const p = new Pix(14, 6); p.rect(0, 2, 4, 2, '#3a2a22'); p.poly([[4, 1], [11, 2], [13, 3], [11, 4], [4, 4]], '#dfe6f2'); p.hline(5, 11, 2, '#ffffff'); return p.outline(); }

// ---------------------------------------------------------------- props
function can(broken) {
    const p = new Pix(18, 28);
    if (broken) { p.poly([[2, 27], [3, 18], [8, 16], [14, 19], [16, 27]], '#5a6a5a'); p.hline(2, 16, 22, '#3a463a'); p.rect(5, 24, 3, 3, '#202620'); p.ellipse(15, 26, 3, 1.5, '#7a8a6a'); return p.outline(); }
    p.rect(2, 5, 14, 22, '#5a6a5a'); for (let y = 8; y < 26; y += 5) p.hline(2, 15, y, '#3a463a'); p.vline(4, 5, 26, '#8a9a8a'); p.vline(14, 5, 26, '#3a463a');
    p.ellipse(9, 4, 8, 2.5, '#7a8a7a'); p.rect(7, 1, 4, 2, '#4a5a4a'); return p.outline();
}
function crate(broken) {
    const p = new Pix(28, 28);
    if (broken) { p.poly([[1, 27], [3, 21], [12, 23], [10, 27]], '#a06a34'); p.poly([[14, 27], [18, 17], [26, 22], [26, 27]], '#8a5a2a'); p.line(4, 24, 9, 25, '#5a3618'); p.rect(11, 25, 6, 2, '#6a4422'); return p.outline(); }
    p.rect(1, 2, 26, 25, '#a06a34'); p.rect(1, 2, 26, 3, '#c88a48'); p.rect(1, 24, 26, 3, '#6a4422');
    p.rect(1, 2, 3, 25, '#7a4e26').rect(24, 2, 3, 25, '#7a4e26'); p.line(4, 5, 23, 23, '#7a4e26').line(4, 6, 23, 24, '#7a4e26');
    p.hline(5, 22, 13, '#8a5a2a'); p.set(3, 4, '#d8d8d8'); p.set(24, 4, '#d8d8d8'); p.set(3, 25, '#d8d8d8'); p.set(24, 25, '#d8d8d8'); return p.outline();
}
function barrel(broken) {
    const p = new Pix(22, 32);
    if (broken) { p.poly([[2, 31], [4, 22], [18, 22], [20, 31]], '#3a2c2c'); p.ellipse(11, 22, 8, 2, '#1a1414'); return p.outline(); }
    p.rect(2, 3, 18, 28, '#c02a2a'); p.vline(4, 3, 30, '#e05050'); p.vline(18, 3, 30, '#801a1a');
    p.rect(2, 8, 18, 3, '#ffd23a'); p.rect(2, 22, 18, 3, '#ffd23a'); for (let x = 2; x < 20; x += 4) { p.rect(x, 8, 2, 3, '#1a1a1a'); p.rect(x + 2, 22, 2, 3, '#1a1a1a'); }
    p.ellipse(11, 3, 9, 2.5, '#e05050'); p.disc(11, 16, 3, '#3af4ff'); p.set(10, 15, '#ffffff'); return p.outline();
}
function vend(broken) {
    const p = new Pix(40, 62);
    p.rect(2, 2, 36, 59, '#2a3c6a'); p.rect(2, 2, 36, 3, '#4a6aaa'); p.rect(36, 2, 2, 59, '#1a2648');
    if (!broken) {
        p.rect(5, 7, 22, 34, '#bfe8ff'); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const col = ['#ff4a6a', '#ffd23a', '#4aff8a', '#4ac8ff', '#ff8a2a'][(r * 4 + c) % 5]; p.rect(7 + c * 5, 9 + r * 8, 3, 5, col); p.set(7 + c * 5, 9 + r * 8, '#ffffff'); }
        p.rect(29, 9, 6, 8, '#101828'); p.rect(30, 10, 4, 3, '#3aff8a'); p.rect(30, 19, 4, 12, '#5a6a8a'); p.rect(6, 45, 20, 8, '#101828');
        p.rect(5, 55, 30, 3, '#ff3fa4');
    } else {
        p.rect(5, 7, 22, 34, '#101828'); p.line(6, 9, 20, 38, '#bfe8ff').line(25, 8, 10, 30, '#bfe8ff'); p.rect(6, 45, 20, 8, '#101828'); p.rect(29, 9, 6, 8, '#101828');
    }
    return p.outline();
}
function cart(broken) {
    const p = new Pix(40, 38);
    if (broken) { p.poly([[2, 37], [4, 26], [20, 30], [36, 24], [38, 37]], '#7a3a22'); p.disc(9, 33, 4, '#2a2a2a'); return p.outline(); }
    p.poly([[0, 8], [40, 8], [36, 0], [4, 0]], '#e03030'); for (let x = 4; x < 36; x += 8) p.poly([[x, 0], [x + 4, 0], [x + 5, 8], [x + 1, 8]], '#f4f0e0');
    p.vline(4, 8, 22, '#5a3a22').vline(35, 8, 22, '#5a3a22'); p.rect(2, 22, 36, 10, '#8a4a28'); p.rect(2, 22, 36, 2, '#b06a38');
    p.rect(6, 17, 6, 5, '#f0c060').rect(14, 18, 5, 4, '#e07040').rect(22, 17, 6, 5, '#80c050').rect(30, 18, 4, 4, '#f0e0a0');
    p.disc(9, 33, 4, '#2a2a2a').disc(31, 33, 4, '#2a2a2a'); p.disc(9, 33, 1.5, '#8a8a8a').disc(31, 33, 1.5, '#8a8a8a'); return p.outline();
}
function jar(broken) {
    const p = new Pix(30, 56);
    p.rect(2, 48, 26, 8, '#5a6070').rect(2, 48, 26, 2, '#8a92a6'); p.rect(4, 0, 22, 5, '#5a6070');
    if (broken) { p.poly([[4, 48], [6, 38], [10, 44], [14, 34], [18, 42], [22, 36], [26, 48]], '#9affd8'); p.ellipse(15, 47, 12, 2, '#4aff9a'); return p.outline(); }
    p.rect(4, 5, 22, 43, '#2aa86a'); p.rect(5, 5, 3, 43, '#9affd8'); p.rect(22, 5, 3, 43, '#1a7a4a');
    p.ellipse(15, 26, 5, 9, '#c08a8a'); p.disc(15, 16, 3.5, '#c08a8a'); p.line(11, 22, 7, 30, '#c08a8a').line(19, 22, 23, 30, '#c08a8a'); p.set(14, 15, '#ffff60'); p.set(16, 15, '#ffff60');
    for (let k = 0; k < 6; k++) p.set(8 + (k * 5) % 14, 40 - k * 6, '#d8fff0');
    return p.outline();
}
function terminal(broken) {
    const p = new Pix(24, 42);
    p.rect(3, 20, 18, 22, '#3a4050').rect(3, 20, 18, 2, '#6a7488'); p.rect(1, 2, 22, 18, '#2a3040');
    if (!broken) { p.rect(3, 4, 18, 13, '#0a1a2a'); for (let k = 0; k < 5; k++) p.hline(4, 6 + ((k * 7) % 14), 5 + k * 2, '#3aff8a'); p.rect(5, 26, 14, 4, '#1a1e28'); for (let x = 6; x < 18; x += 2) p.set(x, 27, '#9aa4bc'); }
    else { p.rect(3, 4, 18, 13, '#0a0a10'); p.line(4, 5, 18, 15, '#5a6a7a'); }
    return p.outline();
}
function lantern(broken) {
    const p = new Pix(16, 38);
    p.vline(7, 10, 37, '#3a2a22').vline(8, 10, 37, '#5a4232'); p.rect(4, 35, 8, 3, '#3a2a22');
    if (!broken) { p.ellipse(8, 7, 6, 6.5, '#ff4a2a'); p.ellipse(7, 6, 3, 4, '#ffb05a'); p.rect(5, 0, 6, 1, '#1a1a1a').rect(5, 13, 6, 1, '#1a1a1a'); p.vline(8, 1, 12, '#c02a1a'); }
    else { p.poly([[3, 12], [6, 6], [10, 9], [13, 12]], '#a02a1a'); }
    return p.outline();
}

// ---------------------------------------------------------------- projectiles
function knife() { const p = new Pix(14, 5); p.rect(0, 1, 4, 3, '#3a2a22'); p.poly([[4, 0], [11, 1], [13, 2], [11, 3], [4, 4]], '#dfe6f2'); p.hline(5, 11, 1, '#ffffff'); return p.outline(); }
function shuriken(f) { const p = new Pix(11, 11); const c = '#cfd6e6'; if (f) { p.poly([[5, 0], [6, 4], [10, 5], [6, 6], [5, 10], [4, 6], [0, 5], [4, 4]], c); } else { p.poly([[1, 1], [5, 4], [9, 1], [6, 5], [9, 9], [5, 6], [1, 9], [4, 5]], c); } p.set(5, 5, '#3a3a4a'); return p.outline(); }
function bullet() { const p = new Pix(10, 3); p.hline(0, 9, 1, '#ffe8a0'); p.hline(5, 9, 0, '#ffd23a'); p.hline(5, 9, 2, '#ffd23a'); p.set(9, 1, '#ffffff'); return p; }
function laser(c = '#ff3a3a') { const p = new Pix(16, 3); p.hline(0, 15, 1, '#ffffff'); p.hline(0, 15, 0, c); p.hline(0, 15, 2, c); return p; }
function orbSprite(c1, c2, r = 7) { const s = Math.ceil(r * 2 + 2); const p = new Pix(s, s); p.disc(s / 2, s / 2, r, c2); p.disc(s / 2, s / 2, r * 0.65, c1); p.disc(s / 2 - 1, s / 2 - 1, r * 0.3, '#ffffff'); return p; }
function acid() { const p = new Pix(9, 9); p.disc(4.5, 5, 4, '#7aff3a'); p.disc(3.5, 4, 1.6, '#e0ffb0'); return p.outline('#1a3a0a'); }
function wave(gold) { const p = new Pix(26, 20); const c = gold ? '#ffd23a' : '#c8b8a0', c2 = gold ? '#fff0a0' : '#f0e8d8'; p.poly([[0, 19], [4, 6], [9, 12], [13, 0], [17, 10], [21, 5], [25, 19]], c); p.poly([[6, 19], [9, 13], [13, 4], [16, 13], [19, 19]], c2); return p; }
function swordwave(gold) { const p = new Pix(18, 46); const c = gold ? '#ffd23a' : '#ff3a5a', c2 = '#ffffff'; for (let y = 0; y < 46; y++) { const t = Math.abs(y - 23) / 23; const w = Math.round((1 - t * t) * 8); for (let x = 0; x < w; x++) p.set(10 + x - Math.round(t * t * 8), y, x > w - 3 ? c2 : c); } return p; }
function flame(f) { const p = new Pix(12, 12); const cs = ['#ffffff', '#ffe060', '#ff9a2a', '#e03a1a']; const r = 5 - f; p.disc(6, 6, r + 0.5, cs[3]); p.disc(6 + (f % 2), 6, r - 0.5, cs[2]); p.disc(6, 6, Math.max(0.8, r - 2), cs[1]); if (f < 2) p.set(6, 6, cs[0]); return p; }

// ---------------------------------------------------------------- fx
function sparkL(f) { const p = new Pix(16, 16); const r = [3, 6, 7, 5][f]; const c = f < 2 ? '#ffffff' : '#fff2a0'; p.line(8 - r, 8, 8 + r, 8, c).line(8, 8 - r, 8, 8 + r, c); if (f > 0) { const k = Math.round(r * 0.6); p.line(8 - k, 8 - k, 8 + k, 8 + k, '#ffd23a').line(8 - k, 8 + k, 8 + k, 8 - k, '#ffd23a'); } if (f < 3) p.disc(8, 8, f === 0 ? 2.5 : 1.5, '#ffffff'); return p; }
function sparkH(f) {
    const p = new Pix(28, 28); const r = [5, 10, 12, 11, 8][f];
    if (f < 4) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + (k % 2) * 0.2; const rr = k % 2 ? r * 0.6 : r; p.line(14, 14, 14 + Math.cos(a) * rr, 14 + Math.sin(a) * rr, k % 2 ? '#ff9a2a' : '#ffe060'); }
    if (f < 3) p.disc(14, 14, [5, 4, 2][f], '#ffffff');
    if (f >= 2) p.ring(14, 14, r, r, '#ffffff');
    return p;
}
function sparkSlash(f) { const p = new Pix(32, 32); const a0 = -1.2 + f * 0.25; for (let k = 0; k < 18; k++) { const a = a0 + k * 0.11; const rr = 13 - Math.abs(k - 9) * 0.25; const x = 16 + Math.cos(a) * rr, y = 16 + Math.sin(a) * rr; p.set(x, y, '#ffffff'); p.set(x - Math.cos(a), y - Math.sin(a), f < 2 ? '#ffd8e0' : '#ff3a6a'); if (k > 4 && k < 14) p.set(x - 2 * Math.cos(a), y - 2 * Math.sin(a), '#ff3a6a'); } return p; }
function sparkElec(f) { const p = new Pix(28, 28); seed = 99 + f * 13; for (let b = 0; b < 4; b++) { let x = 14, y = 14; const a = b * Math.PI / 2 + rnd(); for (let s = 0; s < 5; s++) { const nx = x + Math.cos(a + (rnd() - 0.5) * 1.6) * 3, ny = y + Math.sin(a + (rnd() - 0.5) * 1.6) * 3; p.line(x, y, nx, ny, s < 2 ? '#ffffff' : '#5ff6ff'); x = nx; y = ny; } } p.disc(14, 14, 3 - f * 0.5, '#ffffff'); return p; }
function sparkBlock(f) { const p = new Pix(20, 20); p.ring(10, 10, 4 + f * 2, 6 + f * 2, f < 2 ? '#a8f0ff' : '#4a8aff', 2); p.disc(10, 10, Math.max(0, 3 - f), '#ffffff'); return p; }
function dust(f) { const p = new Pix(18, 12); const cs = ['#e8e0d0', '#c8beb0', '#a89e94', '#8a8480']; const r = 2.5 + f * 1.3; p.disc(9 - f * 1.5, 7, r, cs[f]); p.disc(9 + f * 1.5, 7, r * 0.9, cs[f]); p.disc(9, 6 - f * 0.5, r * 0.8, cs[Math.max(0, f - 1)]); return p; }
function smoke(f) { const p = new Pix(16, 16); const c = ['#9a96a8', '#7a7688', '#5a5668', '#3a3848'][f]; p.disc(8, 8, 3 + f * 1.4, c); p.disc(6, 6, 1.5 + f * 0.8, '#b8b4c4'); return p; }
function explosion(f) {
    const p = new Pix(40, 40); const r = [6, 12, 16, 18, 17, 14][f];
    const cs = [['#ffffff', '#fff2a0'], ['#ffe060', '#ffffff'], ['#ff9a2a', '#ffe060'], ['#e03a1a', '#ff9a2a'], ['#5a3a3a', '#a03a1a'], ['#3a3038', '#5a4448']][f];
    p.disc(20, 20, r, cs[0]); p.disc(18, 18, r * 0.65, cs[1]);
    seed = 7 + f; for (let k = 0; k < 6; k++) { const a = rnd() * 6.28, d = r * 0.8; p.disc(20 + Math.cos(a) * d, 20 + Math.sin(a) * d, r * 0.35, cs[0]); }
    if (f >= 4) { for (let k = 0; k < 10; k++) { const a = rnd() * 6.28, d = r * rnd(); p.set(20 + Math.cos(a) * d, 20 + Math.sin(a) * d, '#ff6a2a'); } }
    return p;
}
function debris(c) { const p = new Pix(5, 4); p.rect(0, 0, 4, 3, c); p.set(0, 0, '#ffffff'); return p; }
function splash() { const p = new Pix(7, 4); p.set(0, 1, '#a8c8ff').set(1, 0, '#a8c8ff').set(5, 0, '#a8c8ff').set(6, 1, '#a8c8ff').hline(2, 4, 3, '#a8c8ff'); return p; }
function star() { const p = new Pix(7, 7); p.line(3, 0, 3, 6, '#ffffff').line(0, 3, 6, 3, '#ffffff'); p.set(2, 2, '#ffd23a').set(4, 4, '#ffd23a').set(2, 4, '#ffd23a').set(4, 2, '#ffd23a'); return p; }
function bird() { const p = new Pix(7, 4); p.set(0, 0, '#1a1a2a').set(1, 1, '#1a1a2a').set(2, 1, '#1a1a2a').set(3, 2, '#1a1a2a').set(4, 1, '#1a1a2a').set(5, 1, '#1a1a2a').set(6, 0, '#1a1a2a'); return p; }

// ---------------------------------------------------------------- hazards / markers
function reticle() { const p = new Pix(40, 16); p.ring(20, 8, 18, 7, '#ff3a3a', 1.6); p.ring(20, 8, 9, 3.5, '#ff6a6a'); p.hline(0, 7, 8, '#ff3a3a').hline(32, 39, 8, '#ff3a3a'); p.vline(20, 0, 2, '#ff3a3a').vline(20, 13, 15, '#ff3a3a'); return p; }
function shadowBlob(gold) { const p = new Pix(48, 16); p.ellipse(24, 8, 23, 7.5, gold ? '#5a4a10' : '#000000'); return p; }
function forklift() {
    const p = new Pix(72, 56);
    p.rect(14, 22, 40, 22, '#e0a820'); p.rect(14, 22, 40, 3, '#ffd050'); p.rect(20, 4, 3, 20, '#3a3a3a').rect(44, 4, 3, 20, '#3a3a3a'); p.rect(20, 3, 27, 3, '#3a3a3a');
    p.rect(24, 8, 18, 14, '#a8d8ff'); p.rect(25, 9, 4, 12, '#e0f4ff'); p.rect(30, 12, 8, 10, '#3a3048');
    p.rect(4, 6, 4, 40, '#5a5a5a').rect(0, 40, 14, 3, '#7a7a7a'); for (let x = 16; x < 54; x += 6) p.rect(x, 34, 3, 3, '#1a1a1a');
    p.disc(22, 46, 8, '#1a1a1a').disc(48, 46, 8, '#1a1a1a'); p.disc(22, 46, 3, '#8a8a8a').disc(48, 46, 3, '#8a8a8a'); p.rect(50, 26, 4, 4, '#ff3a1a');
    return p.outline();
}
function gantry() { const p = new Pix(18, 30); p.rect(2, 0, 14, 30, '#4a4e5a'); p.rect(2, 0, 3, 30, '#7a8090'); for (let y = 2; y < 30; y += 6) { p.line(5, y, 15, y + 5, '#2a2e38'); } p.rect(2, 24, 14, 6, '#e8c020'); for (let x = 2; x < 16; x += 4) p.rect(x, 24, 2, 6, '#1a1a1a'); return p.outline(); }
function emitter() { const p = new Pix(10, 64); p.rect(2, 0, 6, 8, '#3a4050').rect(2, 56, 6, 8, '#3a4050'); p.rect(3, 6, 4, 2, '#ff3a3a').rect(3, 56, 4, 2, '#ff3a3a'); return p.outline(); }
function vent() { const p = new Pix(32, 12); p.ellipse(16, 6, 15, 5, '#3a3e48'); for (let x = 4; x < 30; x += 4) p.vline(x, 3, 9, '#1a1c22'); p.ring(16, 6, 15, 5, '#6a7080'); return p; }
function glint() { const p = new Pix(15, 15); p.line(7, 0, 7, 14, '#ffffff').line(0, 7, 14, 7, '#ffffff'); p.line(4, 4, 10, 10, '#fff0a0').line(4, 10, 10, 4, '#fff0a0'); p.disc(7, 7, 1.6, '#ffffff'); return p; }
function bang() { const p = new Pix(9, 15); p.rect(3, 0, 3, 9, '#ff3a3a').rect(3, 11, 3, 3, '#ff3a3a'); p.vline(3, 0, 8, '#ff9a9a'); return p.outline('#2a0a0a'); }

// ---------------------------------------------------------------- atlas
export function buildObjectAtlas() {
    const list = [];
    const add = (name, pix, ax, ay) => list.push({ name, pix, ax: ax ?? pix.w / 2, ay: ay ?? pix.h });
    add('noodles', noodles()); add('bento', bento()); add('medkit', medkit()); add('cell', cell()); add('chip', chip()); add('stack', stack()); add('shard', shard()); add('core', core());
    add('pipe', pipe(), 4, 3); add('katana', katana(), 5, 3); add('baton', baton(), 3, 3); add('knives', knives(), 2, 3);
    for (const [n, f] of [['can', can], ['crate', crate], ['barrel', barrel], ['vend', vend], ['cart', cart], ['jar', jar], ['terminal', terminal], ['lantern', lantern]]) { add(n, f(false)); add(n + '_x', f(true)); }
    add('knife', knife(), 7, 2.5); add('shuriken0', shuriken(0), 5.5, 5.5); add('shuriken1', shuriken(1), 5.5, 5.5); add('bullet', bullet(), 5, 1.5);
    add('laser', laser(), 8, 1.5); add('pulse', orbSprite('#a8ffff', '#3af4ff', 7), 8, 8); add('pulseR', orbSprite('#ffc0c8', '#ff2d55', 7), 8, 8); add('acid', acid(), 4.5, 4.5);
    add('wave', wave(false), 13, 20); add('waveG', wave(true), 13, 20); add('swordwave', swordwave(false), 9, 46); add('swordwaveG', swordwave(true), 9, 46);
    for (let f = 0; f < 4; f++) add('flame' + f, flame(f), 6, 6);
    add('orb', orbSprite('#fff0a0', '#ffb02a', 6), 7, 7);
    for (let f = 0; f < 4; f++) add('sparkL' + f, sparkL(f), 8, 8);
    for (let f = 0; f < 5; f++) add('sparkH' + f, sparkH(f), 14, 14);
    for (let f = 0; f < 4; f++) add('sparkS' + f, sparkSlash(f), 16, 16);
    for (let f = 0; f < 4; f++) add('sparkE' + f, sparkElec(f), 14, 14);
    for (let f = 0; f < 4; f++) add('sparkB' + f, sparkBlock(f), 10, 10);
    for (let f = 0; f < 4; f++) add('dust' + f, dust(f), 9, 12);
    for (let f = 0; f < 4; f++) add('smoke' + f, smoke(f), 8, 8);
    for (let f = 0; f < 6; f++) add('boom' + f, explosion(f), 20, 20);
    ['#8a5a2a', '#7a8494', '#c02a2a', '#3a4050', '#bfe8ff', '#2aa86a', '#e03030', '#5a6a5a'].forEach((c, i) => add('deb' + i, debris(c), 2.5, 2));
    add('splash', splash(), 3.5, 4); add('star', star(), 3.5, 3.5); add('bird', bird(), 3.5, 2);
    add('reticle', reticle(), 20, 8); add('shadow', shadowBlob(false), 24, 8); add('shadowG', shadowBlob(true), 24, 8);
    add('forklift', forklift(), 36, 56); add('gantry', gantry(), 9, 30); add('emitter', emitter(), 5, 64); add('vent', vent(), 16, 6);
    add('glint', glint(), 7.5, 7.5); add('bang', bang(), 4.5, 15);

    // shelf pack into 512 wide
    const W = 512; let x = 0, y = 0, rowH = 0;
    list.sort((a, b) => b.pix.h - a.pix.h);
    for (const it of list) {
        if (x + it.pix.w + 1 > W) { x = 0; y += rowH + 1; rowH = 0; }
        it.x = x; it.y = y; x += it.pix.w + 1; rowH = Math.max(rowH, it.pix.h);
    }
    const H = Math.pow(2, Math.ceil(Math.log2(y + rowH + 1)));
    const data = new Uint8ClampedArray(W * H * 4);
    const frames = {};
    for (const it of list) {
        for (let j = 0; j < it.pix.h; j++) data.set(it.pix.d.subarray(j * it.pix.w * 4, (j + 1) * it.pix.w * 4), ((it.y + j) * W + it.x) * 4);
        frames[it.name] = { x: it.x, y: it.y, w: it.pix.w, h: it.pix.h, ax: it.ax, ay: it.ay };
    }
    return { W, H, data, frames };
}
