// Every sprite in the game, drawn pixel by pixel in code into one atlas, plus an emissive atlas
// (what glows) and a normal map made from the shapes (so the point lights shade flat sprites as
// if they had volume). 16 pixels = 1 world unit. Frames are anchored at the bottom centre.

import * as THREE from 'three';

export const PPU = 16;
const SIZE = 1024;
const OUT = '#100a16';

// ---------------------------------------------------------------- palette
const P = {
    suit: '#dfe4ec', suit2: '#9aa6bb', suit3: '#5f6a80', orange: '#ff8a2a', orange2: '#b9561a',
    visor: '#62f4ff', boot: '#323849', pack: '#4f596e', skin: '#e8b48f',
    chit: '#3d2152', chit2: '#6c3d8a', chit3: '#241233', eyeG: '#a6ff3a',
    plant: '#2f5d2c', plant2: '#5f9a33', acid: '#b8ff3c',
    metal: '#6b7486', metal2: '#a8b0bf', metal3: '#3a404d', red: '#ff3b30',
    brute: '#5e2b2b', brute2: '#93463a', brute3: '#351717', eyeO: '#ffb02e',
    flesh: '#4c2440', flesh2: '#7d3a64', pink: '#ff5cc0',
    pod: '#b3a27f', pod2: '#7d6f54', pod3: '#e2d4ae', amber: '#ffb347',
    cryo: '#7fb6ff', cryo2: '#3f6fb4',
    wisp: '#7af0ff', wisp2: '#2bb8e0',
    bone: '#e9dfc4', bone2: '#b7a98a', bone3: '#7c6f58',
    queen: '#2a1636', queen2: '#57306e', queen3: '#8d55a8', gold: '#ffd25a',
};

class Atlas {
    constructor() {
        this.c = document.createElement('canvas');
        this.c.width = this.c.height = SIZE;
        this.g = this.c.getContext('2d');
        this.ec = document.createElement('canvas');
        this.ec.width = this.ec.height = SIZE;
        this.eg = this.ec.getContext('2d');
        this.eg.fillStyle = '#000';
        this.eg.fillRect(0, 0, SIZE, SIZE);
        this.frames = {};
        this.cx = 1; this.cy = 1; this.rowH = 0;
    }

    /** Reserve a w×h cell (with a 2 px gutter) and draw into it. */
    def(name, w, h, draw) {
        if (this.cx + w + 2 > SIZE) { this.cx = 1; this.cy += this.rowH + 2; this.rowH = 0; }
        const x0 = this.cx, y0 = this.cy;
        this.cx += w + 2;
        this.rowH = Math.max(this.rowH, h);
        const g = this.g, eg = this.eg;
        const P2 = {
            w, h,
            r(x, y, ww, hh, col) { g.fillStyle = col; g.fillRect(x0 + x, y0 + y, ww, hh); },
            px(x, y, col) { g.fillStyle = col; g.fillRect(x0 + x, y0 + y, 1, 1); },
            /** glowing: drawn in colour and in the emissive layer */
            e(x, y, ww, hh, col, k = col) { g.fillStyle = col; g.fillRect(x0 + x, y0 + y, ww, hh); eg.fillStyle = k; eg.fillRect(x0 + x, y0 + y, ww, hh); },
            ell(cx, cy, rx, ry, col, glow = null) {
                for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) {
                    for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
                        const dx = (xx + 0.5 - cx) / rx, dy = (yy + 0.5 - cy) / ry;
                        if (dx * dx + dy * dy <= 1) {
                            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
                            g.fillStyle = col; g.fillRect(x0 + xx, y0 + yy, 1, 1);
                            if (glow) { eg.fillStyle = glow; eg.fillRect(x0 + xx, y0 + yy, 1, 1); }
                        }
                    }
                }
            },
            line(xa, ya, xb, yb, col, glow = null) {
                const n = Math.max(Math.abs(xb - xa), Math.abs(yb - ya), 1);
                for (let i = 0; i <= n; i++) {
                    const xx = Math.round(xa + (xb - xa) * i / n), yy = Math.round(ya + (yb - ya) * i / n);
                    g.fillStyle = col; g.fillRect(x0 + xx, y0 + yy, 1, 1);
                    if (glow) { eg.fillStyle = glow; eg.fillRect(x0 + xx, y0 + yy, 1, 1); }
                }
            },
            /** a darker rim on the lower right of everything drawn so far, for a hint of form */
            shade(k = 0.72) {
                const im = g.getImageData(x0, y0, w, h), d = im.data;
                const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
                const out = new Uint8ClampedArray(d);
                for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                    const i = (y * w + x) * 4;
                    if (!d[i + 3]) continue;
                    if (!a(x + 1, y) || !a(x, y + 1)) { out[i] *= k; out[i + 1] *= k; out[i + 2] *= k; }
                    else if (!a(x - 1, y) || !a(x, y - 1)) { out[i] = Math.min(255, out[i] * 1.18 + 10); out[i + 1] = Math.min(255, out[i + 1] * 1.18 + 10); out[i + 2] = Math.min(255, out[i + 2] * 1.18 + 10); }
                }
                im.data.set(out);
                g.putImageData(im, x0, y0);
            },
        };
        draw(P2);
        this.outline(x0, y0, w, h);
        this.frames[name] = { x: x0, y: y0, w, h };
    }

    /** A one-pixel dark outline around every shape, so sprites read on any background. */
    outline(x0, y0, w, h) {
        const im = this.g.getImageData(x0 - 1, y0 - 1, w + 2, h + 2), d = im.data, W = w + 2, H = h + 2;
        const add = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (d[(y * W + x) * 4 + 3]) continue;
            let near = false;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const xx = x + dx, yy = y + dy;
                if (xx >= 0 && yy >= 0 && xx < W && yy < H && d[(yy * W + xx) * 4 + 3] > 200) near = true;
            }
            if (near && x > 0 && y > 0 && x < W - 1 && y < H - 1) add.push(x, y);
        }
        this.g.fillStyle = OUT;
        for (let i = 0; i < add.length; i += 2) this.g.fillRect(x0 - 1 + add[i], y0 - 1 + add[i + 1], 1, 1);
    }

    /** Normal map: height from the distance to the shape's edge plus a little of the brightness. */
    normals() {
        const im = this.g.getImageData(0, 0, SIZE, SIZE), d = im.data;
        const N = SIZE * SIZE;
        const dist = new Float32Array(N);
        const INF = 1e9;
        for (let i = 0; i < N; i++) dist[i] = d[i * 4 + 3] > 0 ? INF : 0;
        // two-pass chamfer distance transform
        for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
            const i = y * SIZE + x;
            if (!dist[i]) continue;
            let v = dist[i];
            if (x > 0) v = Math.min(v, dist[i - 1] + 1);
            if (y > 0) v = Math.min(v, dist[i - SIZE] + 1);
            if (x > 0 && y > 0) v = Math.min(v, dist[i - SIZE - 1] + 1.41);
            if (x < SIZE - 1 && y > 0) v = Math.min(v, dist[i - SIZE + 1] + 1.41);
            dist[i] = v;
        }
        for (let y = SIZE - 1; y >= 0; y--) for (let x = SIZE - 1; x >= 0; x--) {
            const i = y * SIZE + x;
            if (!dist[i]) continue;
            let v = dist[i];
            if (x < SIZE - 1) v = Math.min(v, dist[i + 1] + 1);
            if (y < SIZE - 1) v = Math.min(v, dist[i + SIZE] + 1);
            if (x < SIZE - 1 && y < SIZE - 1) v = Math.min(v, dist[i + SIZE + 1] + 1.41);
            if (x > 0 && y < SIZE - 1) v = Math.min(v, dist[i + SIZE - 1] + 1.41);
            dist[i] = v;
        }
        const hgt = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            if (!dist[i]) continue;
            const t = Math.min(1, dist[i] / 4);
            const lum = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.55 + d[i * 4 + 2] * 0.15) / 255;
            hgt[i] = Math.sqrt(t) * 3 + lum * 0.9;
        }
        const nc = document.createElement('canvas');
        nc.width = nc.height = SIZE;
        const ng = nc.getContext('2d');
        const out = ng.createImageData(SIZE, SIZE), o = out.data;
        const H = (x, y) => hgt[Math.max(0, Math.min(SIZE - 1, y)) * SIZE + Math.max(0, Math.min(SIZE - 1, x))];
        for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
            const i = y * SIZE + x;
            const dx = (H(x + 1, y) - H(x - 1, y)) * 0.5, dy = (H(x, y + 1) - H(x, y - 1)) * 0.5;
            // image y runs down; tangent-space y runs up
            let nx = -dx, ny = dy, nz = 1;
            const l = Math.hypot(nx, ny, nz);
            nx /= l; ny /= l; nz /= l;
            o[i * 4] = (nx * 0.5 + 0.5) * 255; o[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; o[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; o[i * 4 + 3] = 255;
        }
        ng.putImageData(out, 0, 0);
        return nc;
    }
}

// ================================================================ the cast
function drawPlayer(A) {
    // 24×32, facing right, feet on the bottom row. pose: { legs, body offset, crouch, ... }
    const body = (g, o) => {
        const by = o.by || 0;
        // backpack with a status lamp
        g.r(4, 12 + by, 4, 9, P.pack); g.e(5, 13 + by, 2, 2, P.orange);
        // torso
        g.r(8, 12 + by, 9, 10, P.suit); g.r(8, 18 + by, 9, 2, P.orange); g.r(14, 13 + by, 3, 4, P.suit2);
        g.r(8, 21 + by, 9, 2, P.suit3);
        // helmet and visor
        g.ell(12.5, 7.5 + by, 5.5, 5.5, P.suit);
        g.r(10, 2 + by, 4, 2, '#ffffff');
        g.e(13, 5 + by, 5, 4, P.visor, '#3fd8ff');
        g.r(13, 8 + by, 5, 1, '#1b8fb0');
        g.r(7, 11 + by, 11, 1, P.suit3);
    };
    const leg = (g, x, y0, len, bend, col = P.suit2) => {
        g.r(x, y0, 3, Math.ceil(len / 2), col);
        g.r(x + bend, y0 + Math.ceil(len / 2), 3, Math.floor(len / 2), col);
        g.r(x + bend - (bend < 0 ? 1 : 0), y0 + len, 4, 2, P.boot);
    };
    A.def('p_idle0', 24, 32, (g) => { leg(g, 9, 22, 8, 0); leg(g, 13, 22, 8, 1); body(g, {}); g.shade(); });
    A.def('p_idle1', 24, 32, (g) => { leg(g, 9, 22, 8, 0); leg(g, 13, 22, 8, 1); body(g, { by: 1 }); g.shade(); });
    const run = [[-3, 3], [-1, 2], [2, -2], [3, -3], [1, -1], [-2, 2]];
    run.forEach(([a, b], i) => A.def('p_run' + i, 24, 32, (g) => {
        leg(g, 10 + a, 22, 7, a > 0 ? 1 : -1, P.suit3);
        leg(g, 11 + b, 22, 7, b > 0 ? 1 : -1);
        body(g, { by: i % 3 === 0 ? 1 : 0 });
        g.shade();
    }));
    A.def('p_jump', 24, 32, (g) => { leg(g, 8, 20, 6, -1, P.suit3); leg(g, 14, 21, 5, 2); body(g, { by: -2 }); g.shade(); });
    A.def('p_fall', 24, 32, (g) => { leg(g, 9, 22, 7, -2, P.suit3); leg(g, 13, 22, 7, 2); body(g, { by: -1 }); g.shade(); });
    A.def('p_crouch', 24, 32, (g) => {
        g.r(7, 26, 4, 4, P.suit3); g.r(6, 30, 5, 2, P.boot);
        g.r(13, 25, 6, 3, P.suit2); g.r(17, 28, 3, 2, P.suit2); g.r(16, 30, 5, 2, P.boot);
        body(g, { by: 9 });
        g.shade();
    });
    A.def('p_hurt', 24, 32, (g) => { leg(g, 7, 22, 8, -1); leg(g, 13, 22, 8, 1); body(g, { by: 0 }); g.r(10, 5, 2, 2, '#ff4040'); g.shade(); });
    A.def('p_dead', 32, 16, (g) => {
        g.r(4, 9, 10, 5, P.suit); g.r(6, 9, 3, 5, P.orange); g.ell(19, 10, 5, 5, P.suit); g.r(19, 8, 4, 4, '#145a6e');
        g.r(0, 11, 5, 3, P.suit2); g.r(24, 12, 7, 3, P.suit2); g.shade();
    });
    // guns: 16×8, pivot on the left-middle (the hand)
    A.def('gun_blaster', 16, 8, (g) => { g.r(0, 3, 4, 3, P.suit); g.r(3, 2, 9, 4, P.metal); g.r(4, 2, 7, 1, P.metal2); g.r(5, 6, 2, 2, P.metal3); g.e(12, 3, 3, 2, P.visor); g.shade(); });
    A.def('gun_spread', 16, 8, (g) => { g.r(0, 3, 4, 3, P.suit); g.r(3, 1, 8, 6, P.orange2); g.r(4, 1, 6, 1, P.orange); g.r(11, 1, 3, 2, P.metal); g.r(11, 5, 3, 2, P.metal); g.e(14, 1, 2, 2, P.gold); g.e(14, 5, 2, 2, P.gold); g.e(12, 3, 3, 2, P.gold); g.shade(); });
    A.def('gun_laser', 16, 8, (g) => { g.r(0, 3, 4, 3, P.suit); g.r(3, 2, 12, 4, P.metal3); g.r(4, 2, 10, 1, P.metal); g.e(6, 4, 8, 1, '#c77dff'); g.e(14, 3, 2, 2, '#e8b8ff'); g.shade(); });
    A.def('gun_rocket', 16, 8, (g) => { g.r(0, 3, 4, 3, P.suit); g.r(2, 1, 13, 6, '#4a5a3a'); g.r(3, 1, 11, 1, '#6f8a52'); g.r(13, 0, 3, 8, P.metal3); g.r(6, 7, 2, 1, P.metal3); g.e(4, 3, 2, 2, P.red); g.shade(); });
}

function drawEnemies(A) {
    // skitter 24×16, three leg frames
    for (let f = 0; f < 3; f++) A.def('skitter' + f, 24, 16, (g) => {
        const L = [[3, 6], [8, 11], [13, 16]];
        L.forEach(([a, b], i) => {
            const s = (f + i) % 3 - 1;
            g.line(a + 2, 9, a + s * 2, 15, P.chit3); g.line(b + 2, 9, b + 3 - s * 2, 15, P.chit3);
        });
        g.ell(11, 8, 9, 5, P.chit); g.ell(10, 6.5, 7, 3, P.chit2);
        g.r(4, 4, 2, 2, P.chit2); g.r(8, 3, 2, 2, P.chit2); g.r(12, 3, 2, 2, P.chit2);
        g.ell(19, 9, 4, 3.5, P.chit3);
        g.e(20, 7, 2, 2, P.eyeG); g.e(22, 9, 1, 1, P.eyeG);
        g.r(21, 12, 3, 1, '#d8c9e6'); g.r(23, 11, 1, 2, '#d8c9e6');
        g.shade();
    });
    for (let f = 0; f < 2; f++) A.def('hiveling' + f, 14, 12, (g) => {
        g.line(3, 7, 1 + f, 11, P.chit3); g.line(7, 7, 6 - f, 11, P.chit3); g.line(9, 7, 10 + f, 11, P.chit3);
        g.ell(6.5, 6, 5, 4, '#5a2a6e'); g.ell(6, 5, 3.5, 2, '#8a4aa4');
        g.ell(11, 7, 2.5, 2.5, P.chit3); g.e(11, 6, 2, 1, P.pink);
        g.shade();
    });
    for (let f = 0; f < 3; f++) A.def('wisp' + f, 20, 22, (g) => {
        for (let i = 0; i < 4; i++) {
            const x = 5 + i * 3.3, sw = Math.round(Math.sin(f * 2.1 + i * 1.7) * 1.6);
            g.line(x, 12, x + sw, 21, P.wisp2, '#1f7fa8');
        }
        g.ell(10, 8, 8, 7, '#1e6f96', '#103a52');
        g.ell(10, 7, 6, 5, P.wisp2, '#2a90c0');
        g.ell(10, 7, 3.5, 3, '#c6ffff', '#c6ffff');
        g.e(6, 5, 1, 1, '#ffffff');
    });
    for (let f = 0; f < 2; f++) A.def('spitter' + f, 20, 24, (g) => {
        g.r(9, 14, 3, 10, P.plant); g.line(10, 20, 4, 16, P.plant); g.line(11, 19, 17, 15, P.plant);
        g.ell(4, 15, 3, 1.6, P.plant2); g.ell(17, 14.5, 3, 1.6, P.plant2);
        g.ell(10, 8, 7, 7, '#4f7f27');
        g.ell(9, 6.5, 5, 4.5, P.plant2);
        g.r(5, 4, 1, 1, '#c7f080'); g.r(13, 10, 1, 1, '#c7f080'); g.r(7, 11, 1, 1, '#c7f080');
        if (f) { g.ell(10, 3, 4.5, 3, '#1a2a0e'); g.e(8, 2, 5, 2, P.acid); }
        else { g.r(7, 2, 6, 1, '#1a2a0e'); g.e(9, 2, 2, 1, P.acid); }
        g.shade();
    });
    A.def('turret', 20, 16, (g) => {
        g.r(2, 11, 16, 5, P.metal3); g.r(3, 11, 14, 1, P.metal);
        g.ell(10, 9, 6, 5, P.metal); g.ell(9, 8, 4, 3, P.metal2);
        g.e(9, 8, 3, 2, P.red);
        g.r(4, 14, 2, 1, '#ffd25a'); g.r(14, 14, 2, 1, '#ffd25a');
        g.shade();
    });
    A.def('turretGun', 14, 6, (g) => { g.r(0, 1, 12, 4, P.metal3); g.r(0, 1, 11, 1, P.metal); g.e(11, 2, 3, 2, '#ff7a5a'); g.shade(); });
    for (let f = 0; f < 4; f++) A.def('brute' + f, 34, 40, (g) => {
        const s = f === 3 ? 0 : Math.round(Math.sin(f * 2.09) * 2);
        // legs
        g.r(9 + s, 30, 6, 8, P.brute3); g.r(8 + s, 37, 8, 3, '#241010');
        g.r(19 - s, 30, 6, 8, P.brute3); g.r(18 - s, 37, 8, 3, '#241010');
        // hunched body
        g.ell(16, 21, 13, 11, P.brute);
        g.ell(14, 16, 10, 7, P.brute2);
        for (let i = 0; i < 4; i++) g.r(6 + i * 5, 8 + Math.abs(i - 1.5) * 2, 3, 3, '#c9b28a');
        // head low and forward
        g.ell(27, 23, 6, 5, P.brute3);
        g.e(28, 21, 2, 2, P.eyeO); g.e(31, 22, 1, 1, P.eyeO);
        g.r(29, 26, 5, 1, '#e8dcc0'); g.r(30, 27, 1, 2, '#e8dcc0'); g.r(32, 27, 1, 2, '#e8dcc0');
        // claw arm
        const arm = f === 3 ? -6 : 0;
        g.r(22, 25 + arm, 4, 8, P.brute2); g.r(24, 32 + arm, 6, 3, P.brute3);
        g.r(29, 31 + arm, 2, 4, '#e8dcc0');
        g.shade();
    });
    for (let f = 0; f < 2; f++) A.def('nest' + f, 28, 22, (g) => {
        g.ell(14, 14 - f, 13, 9 + f, P.flesh);
        g.ell(13, 11 - f, 9, 6, P.flesh2);
        g.line(4, 16, 12, 6, '#2e1228'); g.line(22, 17, 16, 5, '#2e1228');
        [[8, 12], [18, 10], [13, 16], [21, 15], [6, 17]].forEach(([x, y], i) => g.ell(x, y - f, 1.8 + (i % 2) * 0.6, 1.6, '#ff9ad8', P.pink));
        g.ell(14, 4 - f, 3, 2, '#1c0a18');
        g.r(0, 20, 28, 2, '#2e1228');
        g.shade();
    });
    A.def('missile', 14, 8, (g) => { g.r(2, 2, 9, 4, P.metal2); g.r(10, 3, 3, 2, P.red); g.r(1, 1, 3, 1, P.metal3); g.r(1, 6, 3, 1, P.metal3); g.e(0, 3, 2, 2, P.gold); g.shade(); });
}

function drawWorldBits(A) {
    for (let f = 0; f < 3; f++) A.def('pod' + f, 22, 34, (g) => {
        if (f < 2) {
            g.ell(11, 18, 9, 15, P.pod2);
            g.ell(10, 17, 7.5, 13.5, P.pod);
            // the colonist inside, a dark shape with a beating amber glow
            g.ell(11, 13, 3, 3, f ? '#5a3a1f' : '#4a321c', f ? P.amber : '#8a5a20');
            g.r(9, 16, 5, 9, f ? '#5a3a1f' : '#4a321c');
            for (let i = 0; i < 6; i++) g.line(2 + i, 6 + i * 4, 20 - i, 9 + i * 4, P.pod3);
            g.r(4, 31, 14, 3, P.pod2);
        } else {
            g.ell(4, 22, 3, 10, P.pod2); g.ell(18, 23, 3, 9, P.pod2);
            g.r(3, 31, 16, 3, P.pod2); g.line(5, 14, 8, 10, P.pod3); g.line(17, 15, 14, 11, P.pod3);
            g.ell(11, 30, 5, 2, '#d7ff8a', '#7aa830');
        }
        g.shade();
    });
    for (let f = 0; f < 2; f++) A.def('colonist' + f, 16, 28, (g) => {
        g.r(5, 18, 2, 9, P.cryo2); g.r(9, 18, 2, 9, P.cryo2);
        g.r(4, 9, 8, 10, P.cryo); g.r(4, 13, 8, 1, '#ffffff');
        g.ell(8, 5.5, 3.5, 4, P.skin); g.r(5, 1, 6, 3, '#4a2a1a');
        if (f) { g.r(12, 4, 2, 7, P.cryo); g.r(12, 2, 2, 2, P.skin); } else { g.r(12, 9, 2, 7, P.cryo); }
        g.r(2, 9, 2, 7, P.cryo);
        g.shade();
    });
    for (let f = 0; f < 2; f++) A.def('door' + f, 48, 48, (g) => {
        g.r(0, 0, 48, 48, P.metal3); g.r(3, 3, 42, 45, '#1a1e28');
        if (!f) { g.r(5, 5, 19, 43, P.metal); g.r(24, 5, 19, 43, P.metal); g.r(23, 5, 2, 43, '#1a1e28'); for (let i = 0; i < 4; i++) { g.r(8, 10 + i * 9, 13, 2, P.metal2); g.r(27, 10 + i * 9, 13, 2, P.metal2); } }
        else { g.r(5, 5, 4, 43, P.metal); g.r(39, 5, 4, 43, P.metal); g.e(10, 8, 28, 40, '#86ffb0', '#3a9a62'); }
        g.e(18, 0, 12, 2, f ? '#6cff9a' : P.red);
        g.r(0, 0, 48, 1, P.metal2);
    });
    for (let f = 0; f < 2; f++) A.def('beacon' + f, 12, 34, (g) => {
        g.r(5, 8, 2, 24, P.metal); g.r(2, 31, 8, 3, P.metal3);
        g.ell(6, 5, 4, 4, P.metal3);
        g.ell(6, 5, 2.6, 2.6, f ? '#7dffb6' : '#5a2020', f ? '#4dff9a' : null);
        g.shade();
    });
    const cap = (name, col, letter) => A.def(name, 20, 14, (g) => {
        g.ell(10, 7, 9, 6, P.metal3); g.ell(10, 7, 8, 5, P.metal); g.ell(9, 5.5, 6, 2.5, P.metal2);
        g.r(1, 6, 3, 2, P.metal3); g.r(16, 6, 3, 2, P.metal3);
        letter.forEach(([x, y, w, h]) => g.e(7 + x, 3 + y, w, h, col));
    });
    cap('cap_spread', P.gold, [[0, 0, 5, 1], [0, 1, 1, 2], [0, 3, 5, 1], [4, 4, 1, 3], [0, 7, 5, 1]]);
    cap('cap_laser', '#d59bff', [[0, 0, 1, 8], [0, 7, 5, 1]]);
    cap('cap_rocket', '#ff6a4a', [[0, 0, 1, 8], [0, 0, 4, 1], [4, 1, 1, 3], [0, 3, 4, 1], [2, 4, 1, 1], [3, 5, 1, 1], [4, 6, 1, 2]]);
    A.def('med', 14, 12, (g) => { g.r(1, 2, 12, 10, '#e9edf2'); g.r(1, 2, 12, 2, '#b7bfcc'); g.e(6, 4, 2, 7, '#ff3a3a'); g.e(3, 6, 8, 2, '#ff3a3a'); g.r(5, 0, 4, 2, P.metal3); g.shade(); });
    A.def('flarepack', 14, 12, (g) => { g.r(1, 3, 12, 9, '#3d4a2c'); g.r(1, 3, 12, 2, '#5a6d40'); for (let i = 0; i < 3; i++) { g.r(2 + i * 4, 0, 2, 4, '#c9452a'); g.e(2 + i * 4, 0, 2, 1, '#ffd25a'); } g.shade(); });
    A.def('vent', 16, 6, (g) => { g.r(0, 1, 16, 5, P.metal3); for (let i = 0; i < 5; i++) g.r(1 + i * 3, 2, 2, 3, '#0d0f14'); g.r(0, 1, 16, 1, P.metal); });
    A.def('lamp', 12, 8, (g) => { g.r(0, 0, 12, 3, P.metal3); g.e(1, 3, 10, 3, '#fff2c8'); g.r(2, 6, 8, 2, P.metal3); });
    A.def('lampAlien', 10, 14, (g) => { g.line(5, 6, 5, 13, '#2f4a3a'); g.line(5, 10, 2, 13, '#2f4a3a'); g.ell(5, 4, 4, 4, '#3c7a6c'); g.ell(5, 4, 2.6, 2.6, '#a8fff0', '#7affe0'); });
    A.def('flare', 6, 6, (g) => { g.r(1, 1, 4, 4, '#c9452a'); g.e(2, 0, 2, 2, '#fff0b0'); });
    A.def('egg', 10, 12, (g) => { g.ell(5, 6, 4.5, 5.5, '#c9a6c0'); g.ell(4, 5, 2.5, 3, '#ead0e2'); g.e(5, 8, 1, 1, P.pink); g.shade(); });
    A.def('cryoPod', 26, 40, (g) => {
        g.r(2, 34, 22, 6, P.metal3); g.r(4, 2, 18, 33, P.metal); g.r(6, 4, 14, 29, '#0d2a3e');
        g.e(7, 5, 12, 27, '#1b5a7a', '#0e3550'); g.r(4, 2, 18, 2, P.metal2); g.e(10, 36, 6, 2, '#62f4ff');
    });
}

function drawBosses(A) {
    for (let f = 0; f < 3; f++) A.def('brood' + f, 76, 50, (g) => {
        const s = f === 2 ? 0 : (f ? 2 : -2);
        // legs
        for (let i = 0; i < 4; i++) {
            const x = 18 + i * 12;
            g.line(x, 32, x - 6 + (i % 2 ? s : -s) * 1.5, 49, P.chit3);
            g.line(x + 1, 32, x - 5 + (i % 2 ? s : -s) * 1.5, 49, P.chit3);
        }
        // swollen egg sac
        g.ell(24, 26, 22, 17, '#6a3a5a');
        g.ell(22, 22, 17, 12, '#8a4a76');
        [[12, 20], [20, 28], [28, 18], [18, 13], [32, 27], [9, 29], [26, 33]].forEach(([x, y]) => g.ell(x, y, 3, 2.6, '#ffc0e8', '#ff6ac8'));
        // thorax and head
        g.ell(50, 26, 13, 11, P.chit);
        g.ell(49, 22, 10, 6, P.chit2);
        g.ell(64, 26, 9, 9, P.chit3);
        g.e(65, 21, 3, 2, P.eyeG); g.e(69, 23, 2, 2, P.eyeG); g.e(63, 24, 2, 2, P.eyeG);
        // mandibles
        const m = f === 2 ? 4 : 0;
        g.line(70, 30, 75, 34 + m, '#d8c9e6'); g.line(70, 31, 74, 36 + m, '#d8c9e6');
        g.line(66, 33, 70, 39 + m, '#d8c9e6');
        if (f === 2) g.ell(71, 31, 3, 2, '#2a0a20', P.acid);
        for (let i = 0; i < 5; i++) g.r(40 + i * 5, 14 - (i % 2) * 2, 2, 4, '#9a6ab8');
        g.shade();
    });
    for (let f = 0; f < 2; f++) A.def('warden' + f, 56, 46, (g) => {
        // thrusters
        g.r(12, 34, 8, 6, P.metal3); g.r(36, 34, 8, 6, P.metal3);
        g.e(13, 40, 6, 3, '#9adfff', '#6ab8ff'); g.e(37, 40, 6, 3, '#9adfff', '#6ab8ff');
        // chassis
        g.r(6, 12, 44, 24, P.metal3);
        g.r(8, 10, 40, 22, P.metal);
        g.r(10, 10, 36, 4, P.metal2);
        for (let i = 0; i < 6; i++) g.r(10 + i * 6, 26, 4, 2, '#ffd25a');
        g.r(10, 29, 36, 1, '#2a2e38');
        // eye
        g.r(18, 15, 20, 9, '#1a1e28');
        g.e(20 + f * 8, 16, 8, 7, f ? '#ff2a2a' : '#ff6a3a');
        g.e(23 + f * 8, 18, 2, 3, '#ffd0c0');
        // shoulder guns
        g.r(0, 18, 7, 10, P.metal3); g.r(49, 18, 7, 10, P.metal3); g.e(1, 27, 4, 2, P.red); g.e(51, 27, 4, 2, P.red);
        g.r(24, 2, 8, 8, P.metal3); g.e(27, 0, 2, 3, '#ff3b30');
        g.shade();
    });
    for (let f = 0; f < 2; f++) A.def('worm_head' + f, 42, 38, (g) => {
        g.ell(21, 22, 19, 16, P.bone2);
        g.ell(21, 19, 15, 11, P.bone);
        for (let i = 0; i < 7; i++) g.r(4 + i * 5, 6 + Math.abs(i - 3) * 2, 3, 6, P.bone3);
        g.ell(21, 25, f ? 10 : 6, f ? 9 : 3, '#1a0606', f ? '#ff4a1a' : null);
        if (f) for (let i = 0; i < 6; i++) { g.r(13 + i * 3, 17, 1, 3, '#fff6dc'); g.r(13 + i * 3, 32, 1, 2, '#fff6dc'); }
        g.e(8, 16, 3, 3, '#ff6a1a'); g.e(31, 16, 3, 3, '#ff6a1a');
        g.shade();
    });
    A.def('worm_seg', 38, 16, (g) => {
        g.ell(19, 8, 18, 8, P.bone3); g.ell(19, 7, 16, 6, P.bone2); g.r(3, 7, 32, 2, P.bone3);
        g.r(4, 1, 2, 3, P.bone); g.r(32, 1, 2, 3, P.bone);
        g.shade();
    });
    for (let f = 0; f < 2; f++) A.def('queen' + f, 96, 148, (g) => {
        // the throne of fused hull plates behind her
        g.r(4, 100, 88, 48, '#2a2230'); for (let i = 0; i < 6; i++) g.r(6 + i * 15, 104 + (i % 2) * 6, 12, 40, '#3a3242');
        // abdomen coiled at the base
        g.ell(54, 118, 40, 26, P.queen);
        g.ell(52, 112, 32, 18, P.queen2);
        [[34, 110], [48, 120], [62, 108], [72, 122], [40, 126]].forEach(([x, y]) => g.ell(x, y, 3.5, 3, '#ffb6e8', P.pink));
        // torso rising
        g.r(36, 52, 30, 60, P.queen);
        g.ell(50, 74, 18, 26, P.queen2);
        g.ell(48, 68, 11, 16, P.queen3);
        for (let i = 0; i < 5; i++) g.r(40, 60 + i * 8, 20, 2, P.queen);
        // arms / scythes
        g.line(36, 60, 14, 84, P.queen); g.line(37, 61, 15, 85, P.queen); g.line(14, 84, 22, 104, '#d8c9e6'); g.line(15, 84, 23, 104, '#d8c9e6');
        g.line(64, 60, 84, 82, P.queen); g.line(65, 61, 85, 83, P.queen); g.line(84, 82, 78, 100, '#d8c9e6');
        // head with a crown crest
        g.ell(42, 36, 16, 14, P.queen);
        g.ell(40, 33, 12, 9, P.queen2);
        for (let i = 0; i < 5; i++) g.line(30 + i * 7, 22, 26 + i * 8, 2 + Math.abs(i - 2) * 4, P.gold);
        g.ell(42, 22, 13, 3, P.gold);
        // eyes
        [[32, 34], [38, 31], [45, 31], [51, 34]].forEach(([x, y]) => g.e(x, y, 3, 2, '#ff4ad8', '#ff4ad8'));
        // the maw
        if (f) { g.ell(40, 45, 9, 7, '#14040e', '#5a0a3a'); for (let i = 0; i < 5; i++) g.r(33 + i * 3, 39, 1, 3, '#fff0f6'); g.ell(40, 46, 4, 3, '#ff4ad8', '#ff4ad8'); }
        else { g.r(32, 44, 16, 2, '#14040e'); }
        g.shade();
    });
}

/** Build the atlas once. Returns { frames, textures, aspect helpers }. */
export function buildSprites() {
    const A = new Atlas();
    drawPlayer(A);
    drawEnemies(A);
    drawWorldBits(A);
    drawBosses(A);
    const tex = (c, srgb = true) => {
        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
    };
    const normalCanvas = A.normals();
    return {
        frames: A.frames,
        map: tex(A.c),
        emissive: tex(A.ec),
        normal: tex(normalCanvas, false),
        canvases: { color: A.c, emissive: A.ec, normal: normalCanvas },
        size: SIZE,
    };
}
