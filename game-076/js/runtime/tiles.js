/* TALEWRIGHT runtime — tiles: procedural tile painters, the tilesets, map baking
 * and passability. A tile is a recipe { n: name, p: [painter, ...colours],
 * s: solid, c: counter, a: animation frames, g: edge group, e: edge colour,
 * k: 'g' ground | 'd' decor | 'o' over (a hint for the palette), ol: outline }. */
(window.TW_MODULES = window.TW_MODULES || []).push(['tiles', function (TW) {
    'use strict';
    const U = TW.util;
    const T = 16;

    // ── drawing kit ──────────────────────────────────────────────────────────
    function kit(g, seed) {
        const d = {
            g, seed,
            R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); },
            P(x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); },
            n(x, y, k) { return U.hash(x, y, seed + (k || 0) * 7919); },
            disc(cx, cy, r, c) {
                g.fillStyle = c;
                for (let y = -r; y <= r; y++) {
                    const w = Math.floor(Math.sqrt(r * r + r * 0.8 - y * y));
                    if (w >= 0) g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
                }
            },
            ell(cx, cy, rx, ry, c) {
                g.fillStyle = c;
                for (let y = -ry; y <= ry; y++) {
                    const t = 1 - (y * y) / (ry * ry + 0.6);
                    if (t < 0) continue;
                    const w = Math.floor(rx * Math.sqrt(t));
                    g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
                }
            },
            line(x0, y0, x1, y1, c) {
                g.fillStyle = c;
                let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
                for (let i = 0; i < 64; i++) {
                    g.fillRect(x0, y0, 1, 1);
                    if (x0 === x1 && y0 === y1) break;
                    const e2 = 2 * e;
                    if (e2 >= dy) { e += dy; x0 += sx; }
                    if (e2 <= dx) { e += dx; y0 += sy; }
                }
            },
            speck(base, dark, light, dd, dl) {
                d.R(0, 0, T, T, base);
                for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
                    const h = d.n(x, y);
                    if (h < (dd || 0.08)) d.P(x, y, dark);
                    else if (h > 1 - (dl || 0.05)) d.P(x, y, light);
                }
            },
        };
        return d;
    }

    /** A one-pixel dark outline around everything drawn (for decor objects). */
    function outline(c, col) {
        const g = c.getContext('2d');
        if (!g.getImageData) return;
        const w = c.width, h = c.height;
        const img = g.getImageData(0, 0, w, h), a = img.data;
        if (!a || !a.length) return;
        const [r, gg, b] = U.hex2rgb(col);
        const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 100;
        const out = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (a[(y * w + x) * 4 + 3] > 100) continue;
            if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) out.push(y * w + x);
        }
        for (const i of out) { a[i * 4] = r; a[i * 4 + 1] = gg; a[i * 4 + 2] = b; a[i * 4 + 3] = 255; }
        g.putImageData(img, 0, 0);
    }
    TW.outline = outline;

    // ── painters ─────────────────────────────────────────────────────────────
    // Each is (d, frame, colours, variant). Ground painters fill the tile;
    // decor and over painters draw on transparency.
    const PT = {};

    PT.solid = (d, f, c) => d.R(0, 0, T, T, c[0]);
    PT.speck = (d, f, c) => d.speck(c[0], c[1], c[2], 0.1, 0.06);
    PT.grass = (d, f, c) => {
        d.speck(c[0], c[1], c[2], 0.06, 0.04);
        for (let i = 0; i < 6; i++) {
            const x = (d.n(i, 1) * 15) | 0, y = 2 + ((d.n(i, 2) * 13) | 0);
            d.P(x, y, c[1]); d.P(x + 1, y - 1, c[1]); d.P(x + 1, y - 2, c[2]);
        }
    };
    PT.tallgrass = (d, f, c) => {
        d.speck(c[0], c[1], c[2], 0.05, 0.02);
        for (let i = 0; i < 7; i++) {
            const x = 1 + ((d.n(i, 3) * 13) | 0), y = 5 + ((d.n(i, 4) * 10) | 0);
            d.line(x, y, x - 1, y - 4, c[1]); d.line(x + 1, y, x + 2, y - 4, c[1]); d.P(x, y - 4, c[2]); d.P(x + 2, y - 5, c[2]);
        }
    };
    PT.meadow = (d, f, c) => {
        PT.grass(d, f, c);
        const cols = [c[3] || '#ff7aa8', c[4] || '#ffe066', '#ffffff'];
        for (let i = 0; i < 5; i++) {
            const x = 1 + ((d.n(i, 5) * 13) | 0), y = 1 + ((d.n(i, 6) * 13) | 0), k = cols[i % 3];
            d.P(x, y, k); d.P(x + 1, y, k); d.P(x, y + 1, k); d.P(x + 1, y + 1, '#fff6c0');
        }
    };
    PT.dirt = (d, f, c) => {
        d.speck(c[0], c[1], c[2], 0.12, 0.06);
        for (let i = 0; i < 3; i++) {
            const x = 1 + ((d.n(i, 7) * 13) | 0), y = 1 + ((d.n(i, 8) * 13) | 0);
            d.R(x, y, 2, 1, c[2]); d.R(x, y + 1, 2, 1, c[1]);
        }
    };
    PT.sand = (d, f, c) => {
        d.speck(c[0], c[1], c[2], 0.07, 0.07);
        for (let i = 0; i < 2; i++) {
            const y = 3 + i * 7 + ((d.n(i, 9) * 3) | 0), x = (d.n(i, 10) * 6) | 0;
            d.R(x, y, 6, 1, c[1]); d.R(x + 6, y - 1, 4, 1, c[1]);
        }
    };
    PT.water = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        for (let i = 0; i < 5; i++) {
            const y = (i * 3 + ((d.n(i, 11) * 3) | 0)) % T;
            const x = (((d.n(i, 12) * 16) | 0) + f * 2 + (i % 2 ? 0 : 5)) % T;
            d.R(x, y, 4, 1, c[1]);
            if (x > 12) d.R(x - 16, y, 4, 1, c[1]);
        }
        if (c[2]) for (let i = 0; i < 4; i++) d.P((d.n(i, 13) * 16) | 0, (d.n(i, 14) * 16) | 0, c[2]);
    };
    PT.lava = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        for (let i = 0; i < 6; i++) {
            const x = ((d.n(i, 15) * 16) | 0), y = (((d.n(i, 16) * 16) | 0) + f) % 16;
            d.disc(x, y, 1 + (i % 2), c[1]);
        }
        for (let i = 0; i < 5; i++) d.P((d.n(i, 17) * 16) | 0, (((d.n(i, 18) * 16) | 0) + f * 2) % 16, c[2]);
    };
    PT.bridge = (d, f, c) => {
        PT.water(d, f, [c[2] || '#2e6fc2', U.shade(c[2] || '#2e6fc2', 0.3)]);
        d.R(2, 0, 12, T, c[0]);
        for (let y = 0; y < T; y += 4) { d.R(2, y + 3, 12, 1, c[1]); d.P(3 + (y % 8 ? 6 : 2), y + 1, c[1]); }
        d.R(1, 0, 1, T, c[1]); d.R(14, 0, 1, T, c[1]);
    };
    PT.bridgeH = (d, f, c) => {
        PT.water(d, f, [c[2] || '#2e6fc2', U.shade(c[2] || '#2e6fc2', 0.3)]);
        d.R(0, 2, T, 12, c[0]);
        for (let x = 0; x < T; x += 4) { d.R(x + 3, 2, 1, 12, c[1]); d.P(x + 1, 3 + (x % 8 ? 6 : 2), c[1]); }
        d.R(0, 1, T, 1, c[1]); d.R(0, 14, T, 1, c[1]);
    };
    PT.cliff = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        for (let x = 0; x < T; x += 4) {
            const off = (d.n(x, 19) * 4) | 0;
            d.R(x, 0, 1, T, c[1]);
            d.R(x + 1, off, 2, 3, c[2]);
            d.R(x + 2, off + 7, 1, 4, c[1]);
        }
        d.R(0, 0, T, 2, c[3] || U.shade(c[0], 0.3));
    };
    PT.cobble = (d, f, c) => {
        d.R(0, 0, T, T, c[1]);
        for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
            const x = col * 4 - (row % 2) * 2, y = row * 4;
            const k = d.n(col, row + 20) > 0.5 ? c[0] : U.shade(c[0], -0.08);
            d.R(x, y, 3, 3, k); d.P(x, y, c[2]);
        }
    };
    PT.plaza = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        d.R(0, 7, T, 1, c[1]); d.R(7, 0, 1, T, c[1]); d.R(0, 15, T, 1, c[1]); d.R(15, 0, 1, T, c[1]);
        d.P(1, 1, c[2]); d.P(9, 1, c[2]); d.P(1, 9, c[2]); d.P(9, 9, c[2]);
        if (d.n(1, 21) > 0.6) d.P(4, 4, c[1]);
    };
    PT.bricks = (d, f, c) => {
        d.R(0, 0, T, T, c[1]);
        for (let row = 0; row < 4; row++) for (let col = -1; col < 2; col++) {
            const x = col * 8 + (row % 2) * 4, y = row * 4;
            const k = d.n(col + 3, row + 22) > 0.55 ? c[0] : U.shade(c[0], -0.1);
            d.R(x, y, 7, 3, k); d.R(x, y, 7, 1, c[2]);
        }
    };
    PT.blocks = (d, f, c) => {
        d.R(0, 0, T, T, c[1]);
        for (let row = 0; row < 2; row++) for (let col = -1; col < 2; col++) {
            const x = col * 8 + (row % 2) * 4, y = row * 8;
            d.R(x, y, 7, 7, c[0]); d.R(x, y, 7, 1, c[2]); d.R(x, y, 1, 7, c[2]);
            if (d.n(col + 4, row + 23) > 0.6) d.P(x + 3, y + 4, c[1]);
        }
    };
    PT.wallTop = (d, f, c) => {
        // a wall seen from the front with its top face, as interior walls are drawn
        PT.bricks(d, f, [c[0], c[1], c[2]]);
        d.R(0, 0, T, 4, c[3] || U.shade(c[0], 0.25));
        d.R(0, 4, T, 1, U.shade(c[0], -0.4));
    };
    PT.plaster = (d, f, c) => {
        d.speck(c[0], U.shade(c[0], -0.06), U.shade(c[0], 0.06), 0.1, 0.1);
        d.R(0, 0, T, 3, c[2]); d.R(0, 3, T, 1, U.shade(c[2], -0.3));
        d.R(0, 12, T, 4, c[1]); d.R(0, 12, T, 1, U.shade(c[1], 0.25));
    };
    PT.woodwall = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        for (let x = 0; x < T; x += 4) { d.R(x, 0, 1, T, c[1]); d.P(x + 2, (d.n(x, 24) * 14) | 0, c[1]); }
        d.R(0, 0, T, 1, c[2]); d.R(0, 15, T, 1, c[1]);
    };
    PT.window = (d, f, c) => {
        const base = c[3] || 'bricks';
        (PT[base] || PT.bricks)(d, f, [c[0], c[1], c[2]]);
        d.R(3, 3, 10, 9, c[4] || '#3a2a1a');
        d.R(4, 4, 8, 7, c[5] || '#8fd0ff');
        d.R(4, 4, 3, 2, '#d8f2ff');
        d.R(7, 4, 1, 7, c[4] || '#3a2a1a'); d.R(4, 7, 8, 1, c[4] || '#3a2a1a');
        d.R(2, 12, 12, 1, U.shade(c[4] || '#3a2a1a', 0.3));
    };
    PT.door = (d, f, c) => {
        const base = c[3] || 'bricks';
        (PT[base] || PT.bricks)(d, f, [c[4] || '#a05a3a', U.shade(c[4] || '#a05a3a', -0.35), U.shade(c[4] || '#a05a3a', 0.2)]);
        d.R(3, 2, 10, 14, U.shade(c[0], -0.45));
        d.R(4, 3, 8, 13, c[0]);
        d.R(4, 3, 8, 1, c[2]);
        d.R(7, 3, 1, 13, c[1]); d.R(4, 8, 8, 1, c[1]);
        d.P(10, 10, '#ffd75a');
    };
    PT.arch = (d, f, c) => {
        (PT[c[3]] || PT.bricks)(d, f, [c[4] || '#9a9aa8', U.shade(c[4] || '#9a9aa8', -0.35), U.shade(c[4] || '#9a9aa8', 0.2)]);
        d.ell(8, 8, 5, 7, U.shade(c[0], -0.5));
        d.R(3, 8, 11, 8, U.shade(c[0], -0.5));
        d.ell(8, 9, 4, 6, c[0]);
        d.R(4, 9, 9, 7, c[0]);
        d.R(8, 4, 1, 12, c[1]);
        d.P(11, 11, '#ffd75a');
    };
    PT.roof = (d, f, c) => {
        d.R(0, 0, T, T, c[1]);
        for (let row = 0; row < 4; row++) for (let col = -1; col < 4; col++) {
            const x = col * 4 + (row % 2) * 2, y = row * 4;
            d.R(x, y, 4, 3, c[0]); d.R(x, y + 2, 4, 1, U.shade(c[0], -0.15)); d.P(x + 1, y, c[2]);
        }
    };
    PT.thatch = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        for (let i = 0; i < 40; i++) {
            const x = (d.n(i, 25) * 16) | 0, y = (d.n(i, 26) * 16) | 0;
            d.R(x, y, 1, 3, d.n(i, 27) > 0.5 ? c[1] : c[2]);
        }
        d.R(0, 7, T, 1, c[1]); d.R(0, 15, T, 1, c[1]);
    };
    PT.stairs = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        for (let i = 0; i < 4; i++) {
            d.R(1, i * 4, 14, 3, U.shade(c[0], c[3] ? -0.08 * i : 0.08 * i - 0.2));
            d.R(1, i * 4 + 3, 14, 1, c[1]);
        }
        d.R(0, 0, 1, T, c[1]); d.R(15, 0, 1, T, c[1]);
    };
    PT.planks = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        for (let y = 0; y < T; y += 4) {
            d.R(0, y + 3, T, 1, c[1]);
            const s = (d.n(y, 28) * 12) | 0;
            d.R(s, y, 1, 3, c[1]);
            d.R((s + 6) % 14, y + 1, 3, 1, c[2]);
        }
    };
    PT.checker = (d, f, c) => {
        d.R(0, 0, T, T, c[0]); d.R(0, 0, 8, 8, c[1]); d.R(8, 8, 8, 8, c[1]);
        d.P(1, 1, c[2] || U.shade(c[1], 0.3)); d.P(9, 9, c[2] || U.shade(c[1], 0.3));
    };
    PT.carpet = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        for (let y = 1; y < T; y += 4) for (let x = (y % 8 === 1 ? 1 : 3); x < T; x += 4) d.P(x, y, c[2]);
        d.R(0, 0, 1, T, c[1]); d.R(15, 0, 1, T, c[1]);
    };
    PT.marble = (d, f, c) => {
        d.speck(c[0], U.shade(c[0], -0.05), c[2], 0.05, 0.05);
        d.line(0, (d.n(1, 29) * 10) | 0, 15, 4 + ((d.n(2, 29) * 10) | 0), c[1]);
        d.R(0, 15, T, 1, U.shade(c[0], -0.15)); d.R(15, 0, 1, T, U.shade(c[0], -0.15));
    };
    PT.fireplace = (d, f, c) => {
        PT.bricks(d, f, [c[0], c[1], c[2]]);
        d.R(2, 5, 12, 11, '#1a0e08');
        d.R(1, 4, 14, 2, U.shade(c[0], 0.2));
        const h = [5, 7, 6][f % 3];
        d.ell(8, 15 - h / 2, 4, h / 2 + 1, '#ff7a1a');
        d.ell(8, 15 - h / 3, 2, h / 3 + 1, '#ffe066');
        d.R(4, 14, 8, 2, '#5a3018');
    };
    PT.gravel = (d, f, c) => {
        d.speck(c[0], c[1], c[2], 0.2, 0.12);
        for (let i = 0; i < 4; i++) { const x = (d.n(i, 30) * 14) | 0, y = (d.n(i, 31) * 14) | 0; d.R(x, y, 2, 2, c[2]); d.P(x + 1, y + 1, c[1]); }
    };
    PT.void = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        if (c[1]) for (let i = 0; i < 3; i++) d.P((d.n(i, 32) * 16) | 0, (d.n(i, 33) * 16) | 0, c[1]);
    };
    PT.chasm = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        d.R(0, 0, T, 3, c[1]); d.R(0, 3, T, 1, U.shade(c[1], -0.3));
    };
    PT.snow = (d, f, c) => {
        d.speck(c[0], c[1], c[2], 0.06, 0.03);
        for (let i = 0; i < 2; i++) { const x = (d.n(i, 34) * 12) | 0, y = 3 + ((d.n(i, 35) * 10) | 0); d.R(x, y, 4, 1, c[1]); }
    };
    PT.ice = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        d.line(2, 3, 6, 7, c[1]); d.line(6, 7, 5, 12, c[1]); d.line(6, 7, 12, 9, c[1]);
        d.R(10, 2, 3, 1, c[2]); d.R(11, 3, 1, 1, c[2]); d.P(3, 12, c[2]);
    };
    PT.cracked = (d, f, c) => {
        d.speck(c[0], c[1], c[2], 0.05, 0.05);
        d.line(0, (d.n(1, 36) * 16) | 0, 8, 8, c[1]); d.line(8, 8, 15, (d.n(2, 36) * 16) | 0, c[1]); d.line(8, 8, (d.n(3, 36) * 16) | 0, 15, c[1]);
    };
    PT.metal = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        d.R(0, 0, T, 1, c[2]); d.R(0, 0, 1, T, c[2]); d.R(0, 15, T, 1, c[1]); d.R(15, 0, 1, T, c[1]);
        d.P(2, 2, c[1]); d.P(13, 2, c[1]); d.P(2, 13, c[1]); d.P(13, 13, c[1]);
    };
    PT.grate = (d, f, c) => {
        d.R(0, 0, T, T, c[1]);
        for (let i = 1; i < T; i += 3) { d.R(i, 0, 2, T, c[0]); d.R(i, 0, 1, T, c[2]); }
    };
    PT.panel = (d, f, c) => {
        PT.metal(d, f, c);
        d.R(4, 4, 8, 8, c[3] || U.shade(c[0], -0.2)); d.R(5, 5, 6, 1, c[2]);
    };
    PT.hazard = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        for (let i = -16; i < 16; i += 6) d.line(i, 15, i + 15, 0, c[1]), d.line(i + 1, 15, i + 16, 0, c[1]), d.line(i + 2, 15, i + 17, 0, c[1]);
    };
    PT.energy = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        for (let y = 0; y < T; y += 4) d.R(0, (y + f) % T, T, 1, c[1]);
        d.R(0, 0, 1, T, c[2]); d.R(15, 0, 1, T, c[2]);
    };
    PT.space = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        for (let i = 0; i < 5; i++) d.P((d.n(i, 37) * 16) | 0, (d.n(i, 38) * 16) | 0, (i + f) % 3 === 0 ? '#ffffff' : c[1]);
    };
    PT.starwin = (d, f, c) => {
        PT.metal(d, f, c);
        d.R(2, 3, 12, 9, '#05061a');
        for (let i = 0; i < 6; i++) d.P(3 + ((d.n(i, 39) * 10) | 0), 4 + (((d.n(i, 40) * 7) | 0)), (i + f) % 3 ? '#9ab0ff' : '#ffffff');
        d.R(2, 3, 12, 1, c[2]);
    };
    PT.cloud = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        for (let i = 0; i < 4; i++) d.disc((d.n(i, 41) * 16) | 0, (d.n(i, 42) * 16) | 0, 2, c[2]);
        for (let i = 0; i < 3; i++) d.R((d.n(i, 43) * 12) | 0, (d.n(i, 44) * 16) | 0, 4, 1, c[1]);
    };
    PT.rainbow = (d, f, c) => {
        const cols = ['#ff5a5a', '#ffa54a', '#ffe95a', '#6ee06e', '#5ab8ff', '#9a7aff'];
        for (let i = 0; i < 6; i++) d.R(0, 2 + i * 2, T, 2, cols[(i + f) % 6]);
        d.R(0, 0, T, 2, '#ffffff'); d.R(0, 14, T, 2, '#ffffff');
    };
    PT.crystalfloor = (d, f, c) => {
        d.R(0, 0, T, T, c[0]);
        d.line(0, 8, 8, 0, c[1]); d.line(8, 0, 15, 8, c[1]); d.line(15, 8, 8, 15, c[1]); d.line(8, 15, 0, 8, c[1]);
        d.P(8, 8, (f % 3 === 0) ? '#ffffff' : c[2]);
    };

    // ── decor painters (transparent background) ──────────────────────────────
    PT.tree = (d, f, c) => {
        d.R(7, 11, 3, 5, c[2]); d.R(7, 11, 1, 5, U.shade(c[2], 0.2));
        d.disc(8, 7, 6, c[1]); d.disc(7, 6, 5, c[0]); d.disc(6, 4, 2, c[3] || U.shade(c[0], 0.25));
        if (c[4]) for (let i = 0; i < 3; i++) d.P(4 + i * 3, 6 + (i % 2) * 2, c[4]);
    };
    PT.pine = (d, f, c) => {
        d.R(7, 13, 2, 3, c[2]);
        for (let i = 0; i < 3; i++) {
            const y = 1 + i * 4, w = 2 + i * 2;
            for (let k = 0; k < 5; k++) d.R(8 - w * k / 4, y + k, Math.max(1, w * k / 2), 1, k < 2 ? c[0] : c[1]);
        }
        if (c[3]) { d.R(7, 1, 2, 1, c[3]); d.R(5, 5, 3, 1, c[3]); d.R(4, 9, 3, 1, c[3]); }
    };
    PT.deadtree = (d, f, c) => {
        d.R(7, 6, 2, 10, c[0]);
        d.line(8, 8, 3, 3, c[0]); d.line(8, 7, 13, 2, c[0]); d.line(4, 4, 2, 4, c[0]); d.line(12, 3, 14, 5, c[0]); d.line(8, 10, 11, 8, c[1]);
        d.R(5, 15, 6, 1, c[1]);
    };
    PT.palm = (d, f, c) => {
        d.line(8, 15, 9, 6, c[2]); d.line(9, 15, 10, 6, U.shade(c[2], -0.2));
        d.line(9, 5, 2, 7, c[0]); d.line(9, 5, 15, 7, c[0]); d.line(9, 5, 4, 2, c[1]); d.line(9, 5, 14, 2, c[1]); d.line(9, 5, 9, 1, c[0]);
        d.disc(9, 6, 1, '#6a4a1a');
    };
    PT.cactus = (d, f, c) => {
        d.R(6, 3, 4, 13, c[0]); d.R(7, 3, 1, 13, c[2] || U.shade(c[0], 0.25));
        d.R(2, 6, 3, 2, c[0]); d.R(2, 3, 2, 4, c[0]); d.R(11, 8, 3, 2, c[0]); d.R(12, 5, 2, 4, c[0]);
        d.R(9, 3, 1, 13, c[1]);
        if (c[3]) d.disc(8, 2, 1, c[3]);
    };
    PT.bush = (d, f, c) => {
        d.ell(8, 11, 7, 4, c[1]); d.ell(8, 10, 6, 4, c[0]); d.disc(5, 8, 2, c[2]); d.disc(10, 8, 2, c[0]);
        if (c[3]) for (let i = 0; i < 4; i++) d.R(3 + i * 3, 9 + (i % 2), 2, 2, c[3]);
    };
    PT.hedge = (d, f, c) => {
        d.R(0, 4, T, 11, c[1]); d.R(0, 3, T, 9, c[0]);
        for (let i = 0; i < 8; i++) d.P((d.n(i, 45) * 16) | 0, 3 + ((d.n(i, 46) * 8) | 0), c[2]);
    };
    PT.rock = (d, f, c) => {
        d.ell(8, 11, 6, 4, c[1]); d.ell(7, 10, 5, 3, c[0]); d.R(5, 8, 3, 1, c[2]);
    };
    PT.boulder = (d, f, c) => {
        d.ell(8, 9, 7, 6, c[1]); d.ell(7, 8, 6, 5, c[0]); d.R(4, 5, 4, 2, c[2]); d.line(9, 8, 12, 11, c[1]);
    };
    PT.stump = (d, f, c) => {
        d.R(4, 8, 8, 7, c[0]); d.ell(8, 8, 4, 2, c[1]); d.ell(8, 8, 2, 1, c[2]); d.R(5, 9, 1, 6, c[2]);
    };
    PT.log = (d, f, c) => {
        d.R(2, 8, 12, 6, c[0]); d.R(2, 8, 12, 1, c[2]); d.ell(13, 11, 2, 3, c[1]); d.ell(13, 11, 1, 1, c[2]);
    };
    PT.flowers = (d, f, c) => {
        const pts = [[3, 4], [10, 3], [6, 9], [12, 11], [2, 12]];
        for (let i = 0; i < pts.length; i++) {
            const [x, y] = pts[i], k = c[i % 2];
            d.P(x, y + 2, '#3f8130'); d.P(x, y + 3, '#3f8130');
            d.P(x - 1, y, k); d.P(x + 1, y, k); d.P(x, y - 1, k); d.P(x, y + 1, k); d.P(x, y, c[2] || '#ffe066');
        }
    };
    PT.weeds = (d, f, c) => {
        for (let i = 0; i < 6; i++) {
            const x = 2 + ((d.n(i, 47) * 12) | 0), y = 10 + ((d.n(i, 48) * 5) | 0);
            d.line(x, y, x - 1, y - 5, c[0]); d.line(x + 1, y, x + 2, y - 4, c[1]);
        }
    };
    PT.fenceH = (d, f, c) => {
        d.R(0, 6, T, 2, c[0]); d.R(0, 10, T, 2, c[0]); d.R(0, 8, T, 1, c[1]); d.R(0, 12, T, 1, c[1]);
        d.R(2, 4, 2, 11, c[0]); d.R(12, 4, 2, 11, c[0]); d.P(2, 4, c[2] || U.shade(c[0], 0.3)); d.P(12, 4, c[2] || U.shade(c[0], 0.3));
    };
    PT.fenceV = (d, f, c) => {
        d.R(7, 0, 2, T, c[0]); d.R(9, 0, 1, T, c[1]);
        d.R(6, 3, 4, 2, c[0]); d.R(6, 11, 4, 2, c[0]);
    };
    PT.post = (d, f, c) => { d.R(6, 4, 4, 11, c[0]); d.R(9, 4, 1, 11, c[1]); d.R(6, 3, 4, 1, c[2] || U.shade(c[0], 0.3)); };
    PT.sign = (d, f, c) => {
        d.R(7, 9, 2, 7, c[1]);
        d.R(2, 3, 12, 7, c[0]); d.R(2, 3, 12, 1, U.shade(c[0], 0.25));
        d.R(4, 5, 8, 1, c[1]); d.R(4, 7, 6, 1, c[1]);
    };
    PT.shopsign = (d, f, c) => {
        d.R(7, 9, 2, 7, '#5a3a1a');
        d.R(2, 2, 12, 8, c[0]); d.R(2, 2, 12, 1, U.shade(c[0], 0.3)); d.R(2, 9, 12, 1, U.shade(c[0], -0.3));
        const k = c[1];
        if (c[2] === 'potion') { d.R(7, 3, 2, 2, '#ddd'); d.disc(8, 7, 2, k); }
        else if (c[2] === 'sword') { d.line(5, 8, 10, 3, '#e8eef8'); d.R(5, 6, 3, 1, '#c8a040'); }
        else if (c[2] === 'bed') { d.R(4, 5, 8, 3, k); d.R(4, 4, 3, 2, '#ffffff'); }
        else d.disc(8, 6, 2, k);
    };
    PT.mushrooms = (d, f, c) => {
        const pts = [[4, 9, 2], [10, 7, 3], [8, 12, 2]];
        for (const [x, y, r] of pts) { d.R(x - 1, y, 2, r + 1, '#f2e6c8'); d.ell(x, y, r, r - 1 || 1, c[0]); d.P(x - 1, y - 1, c[1]); }
    };
    PT.pebbles = (d, f, c) => {
        for (let i = 0; i < 5; i++) { const x = 2 + ((d.n(i, 49) * 12) | 0), y = 2 + ((d.n(i, 50) * 12) | 0); d.R(x, y, 2, 2, c[0]); d.P(x, y, c[1]); }
    };
    PT.hay = (d, f, c) => {
        d.R(2, 5, 12, 10, c[0]);
        for (let i = 0; i < 12; i++) d.R(2 + i, 5 + ((d.n(i, 51) * 4) | 0), 1, 4, c[1]);
        d.R(2, 8, 12, 1, c[2]); d.R(2, 12, 12, 1, c[2]);
    };
    PT.wheat = (d, f, c) => {
        for (let x = 2; x < T; x += 3) { d.R(x, 6, 1, 10, c[1]); d.R(x - 1, 3 + (x % 2), 2, 4, c[0]); }
    };
    PT.well = (d, f, c) => {
        d.R(2, 2, 1, 8, '#6b4423'); d.R(13, 2, 1, 8, '#6b4423'); d.R(1, 1, 14, 2, c[2] || '#a04a2a');
        d.ell(8, 11, 6, 4, c[0]); d.ell(8, 10, 4, 2, c[1] || '#1e3a5a'); d.R(2, 11, 12, 4, c[0]);
        for (let x = 3; x < 14; x += 3) d.R(x, 12, 1, 3, U.shade(c[0], -0.3));
    };
    PT.scarecrow = (d, f, c) => {
        d.R(7, 4, 2, 12, '#6b4423'); d.R(2, 7, 12, 2, '#6b4423');
        d.R(5, 7, 6, 5, c[0]); d.disc(8, 4, 2, '#e8c890'); d.R(4, 1, 8, 2, c[1]); d.R(6, 0, 4, 1, c[1]);
    };
    PT.lamp = (d, f, c) => {
        d.R(7, 5, 2, 11, c[0]); d.R(5, 14, 6, 2, c[0]);
        d.R(5, 1, 6, 5, c[0]); d.R(6, 2, 4, 3, f % 2 ? c[1] : U.shade(c[1], 0.2));
        d.R(4, 0, 8, 1, c[0]);
    };
    PT.barrel = (d, f, c) => {
        d.R(3, 3, 10, 12, c[0]); d.ell(8, 3, 5, 1, U.shade(c[0], 0.2)); d.R(2, 5, 12, 8, c[0]);
        d.R(2, 5, 12, 1, c[1]); d.R(2, 11, 12, 1, c[1]); d.R(4, 4, 1, 10, U.shade(c[0], 0.2));
    };
    PT.crate = (d, f, c) => {
        d.R(2, 3, 12, 12, c[0]); d.R(2, 3, 12, 1, U.shade(c[0], 0.25));
        d.line(3, 4, 12, 13, c[1]); d.line(12, 4, 3, 13, c[1]); d.R(2, 3, 1, 12, c[1]); d.R(13, 3, 1, 12, c[1]); d.R(2, 14, 12, 1, c[1]);
    };
    PT.stall = (d, f, c) => {
        d.R(1, 7, 14, 8, '#8a5a2a'); d.R(1, 7, 14, 1, '#b07a3a');
        for (let i = 0; i < 4; i++) d.R(1 + i * 4, 1, 4, 5, i % 2 ? c[1] : c[0]);
        d.R(1, 6, 14, 1, U.shade(c[0], -0.3));
        d.disc(4, 9, 1, '#ff5a3a'); d.disc(8, 9, 1, '#ffd23a'); d.disc(12, 9, 1, '#6ad04a');
    };
    PT.bench = (d, f, c) => {
        d.R(1, 7, 14, 3, c[0]); d.R(1, 7, 14, 1, U.shade(c[0], 0.25)); d.R(2, 10, 2, 4, c[1]); d.R(12, 10, 2, 4, c[1]); d.R(1, 4, 14, 2, c[0]);
    };
    PT.fountain = (d, f, c) => {
        d.ell(8, 11, 7, 4, c[0]); d.ell(8, 10, 6, 3, c[1]);
        d.R(7, 3, 2, 8, c[0]);
        const s = f % 3;
        d.P(6 - s, 4 + s, '#d8f2ff'); d.P(10 + s, 4 + s, '#d8f2ff'); d.P(8, 2, '#ffffff'); d.R(5, 9 + (s % 2), 6, 1, '#a8e0ff');
    };
    PT.statue = (d, f, c) => {
        d.R(3, 12, 10, 4, U.shade(c[0], -0.2)); d.R(3, 12, 10, 1, c[2]);
        d.R(6, 5, 4, 7, c[0]); d.disc(8, 3, 2, c[0]); d.R(4, 6, 2, 4, c[0]); d.R(10, 6, 2, 4, c[0]);
        d.R(6, 5, 1, 7, c[2]); d.R(9, 5, 1, 7, c[1]);
    };
    PT.cart = (d, f, c) => {
        d.R(2, 5, 12, 6, c[0]); d.R(2, 5, 12, 1, U.shade(c[0], 0.3)); d.disc(4, 12, 2, c[1]); d.disc(12, 12, 2, c[1]); d.P(4, 12, '#ccc'); d.P(12, 12, '#ccc');
        d.R(3, 3, 10, 2, '#e8c050');
    };
    PT.table = (d, f, c) => {
        d.R(1, 5, 14, 6, c[0]); d.R(1, 5, 14, 1, U.shade(c[0], 0.25)); d.R(1, 10, 14, 1, c[1]);
        d.R(2, 11, 2, 4, c[1]); d.R(12, 11, 2, 4, c[1]);
        if (c[2]) { d.R(5, 6, 6, 3, c[2]); d.P(7, 6, '#ffffff'); }
    };
    PT.chair = (d, f, c) => {
        d.R(4, 2, 8, 7, c[0]); d.R(5, 3, 6, 5, U.shade(c[0], 0.15)); d.R(3, 9, 10, 3, c[0]); d.R(3, 9, 10, 1, U.shade(c[0], 0.25));
        d.R(4, 12, 2, 3, c[1]); d.R(10, 12, 2, 3, c[1]);
    };
    PT.bed = (d, f, c) => {
        d.R(2, 1, 12, 15, c[0]); d.R(2, 1, 12, 2, U.shade(c[0], 0.25));
        d.R(3, 3, 10, 12, c[1]); d.R(4, 4, 8, 3, c[2] || '#ffffff');
        d.R(3, 8, 10, 1, U.shade(c[1], -0.25)); d.R(3, 14, 10, 1, U.shade(c[1], -0.3));
    };
    PT.shelf = (d, f, c) => {
        d.R(1, 0, 14, 16, c[0]); d.R(2, 1, 12, 14, U.shade(c[0], -0.35));
        const books = c.slice(1).length ? c.slice(1) : ['#c84040', '#4060c8', '#40a050', '#d0a030'];
        for (let row = 0; row < 3; row++) {
            for (let x = 2; x < 14; x += 2) {
                const h = 3 + ((d.n(x, row + 52) * 2) | 0);
                d.R(x, 1 + row * 5 + (4 - h), 2, h, books[((x + row) / 2 | 0) % books.length]);
            }
            d.R(1, 5 + row * 5, 14, 1, c[0]);
        }
    };
    PT.cupboard = (d, f, c) => {
        d.R(2, 1, 12, 15, c[0]); d.R(2, 1, 12, 1, U.shade(c[0], 0.25)); d.R(8, 2, 1, 13, c[1]);
        d.R(3, 3, 4, 5, U.shade(c[0], 0.1)); d.R(9, 3, 4, 5, U.shade(c[0], 0.1)); d.P(7, 9, '#ffd75a'); d.P(9, 9, '#ffd75a'); d.R(2, 15, 12, 1, c[1]);
    };
    PT.counter = (d, f, c) => {
        d.R(0, 4, T, 12, c[1]); d.R(0, 3, T, 4, c[0]); d.R(0, 3, T, 1, U.shade(c[0], 0.3));
        for (let x = 2; x < T; x += 5) d.R(x, 9, 3, 5, U.shade(c[1], -0.2));
    };
    PT.pot = (d, f, c) => {
        d.ell(8, 10, 5, 5, c[0]); d.R(5, 3, 6, 3, c[0]); d.R(4, 3, 8, 1, U.shade(c[0], 0.25)); d.R(5, 8, 2, 4, U.shade(c[0], 0.2)); d.R(3, 11, 10, 1, c[1]);
    };
    PT.plant = (d, f, c) => {
        d.R(5, 10, 6, 5, c[2] || '#b0603a'); d.R(4, 10, 8, 1, U.shade(c[2] || '#b0603a', 0.25));
        d.disc(8, 6, 4, c[1]); d.disc(6, 5, 2, c[0]); d.disc(10, 6, 2, c[0]); d.disc(8, 3, 2, c[0]);
    };
    PT.candle = (d, f, c) => {
        d.R(5, 12, 6, 3, c[1] || '#c8a040'); d.R(7, 7, 2, 5, c[0]);
        const h = 2 + (f % 2);
        d.R(7, 7 - h, 2, h, '#ffb030'); d.P(7, 7 - h - 1, '#fff2a0');
    };
    PT.painting = (d, f, c) => {
        d.R(2, 3, 12, 9, c[0]); d.R(3, 4, 10, 7, c[1]); d.R(3, 8, 10, 3, c[2]); d.disc(10, 6, 1, '#fff2a0');
    };
    PT.clock = (d, f, c) => {
        d.R(5, 1, 6, 15, c[0]); d.disc(8, 5, 2, '#f8f0d8'); d.P(8, 4, '#222'); d.P(8, 5, '#222'); d.P(9, 5, '#222');
        d.R(7, 9, 2, 5, c[1]); d.disc(8, 12 + (f % 2), 1, '#e8c050');
    };
    PT.anvil = (d, f, c) => { d.R(2, 6, 12, 3, c[0]); d.R(1, 6, 3, 2, c[0]); d.R(6, 9, 4, 3, c[0]); d.R(4, 12, 8, 3, c[0]); d.R(2, 6, 12, 1, c[1]); };
    PT.cauldron = (d, f, c) => {
        d.ell(8, 11, 6, 4, c[0]); d.ell(8, 8, 6, 1, c[1]);
        for (let i = 0; i < 3; i++) d.disc(5 + i * 3, 7 - ((f + i) % 3), 1, U.shade(c[1], 0.3));
        d.R(3, 14, 2, 2, c[0]); d.R(11, 14, 2, 2, c[0]);
    };
    PT.books = (d, f, c) => { d.R(3, 11, 10, 3, c[0]); d.R(4, 8, 8, 3, c[1]); d.R(5, 6, 6, 2, c[2]); d.R(3, 11, 10, 1, '#ffffff'); };
    PT.rug = (d, f, c) => {
        d.R(1, 3, 14, 10, c[0]); d.R(2, 4, 12, 8, c[1]); d.R(4, 6, 8, 4, c[0]); d.R(6, 7, 4, 2, c[2]);
        for (let x = 1; x < 15; x += 2) { d.P(x, 2, c[2]); d.P(x, 13, c[2]); }
    };
    PT.torch = (d, f, c) => {
        d.R(7, 7, 2, 7, c[0] || '#6b4423'); d.R(6, 6, 4, 2, '#888');
        const h = 3 + (f % 3);
        d.ell(8, 6 - h / 2, 2, h / 2 + 0.5, '#ff8a1a'); d.R(8, 5 - h / 2, 1, 2, '#fff0a0');
    };
    PT.brazier = (d, f, c) => {
        d.R(4, 9, 8, 3, c[0]); d.R(3, 8, 10, 1, U.shade(c[0], 0.3)); d.R(7, 12, 2, 3, c[0]); d.R(5, 15, 6, 1, c[0]);
        const h = 4 + (f % 3);
        d.ell(8, 8 - h / 2, 3, h / 2, c[1] || '#ff7a1a'); d.ell(8, 8 - h / 3, 1, h / 3, '#ffe066');
    };
    PT.pillar = (d, f, c) => {
        d.R(4, 0, 8, 16, c[0]); d.R(4, 0, 2, 16, c[2]); d.R(10, 0, 2, 16, c[1]);
        d.R(3, 0, 10, 2, c[2]); d.R(3, 14, 10, 2, c[1]);
    };
    PT.brokenpillar = (d, f, c) => {
        d.R(4, 7, 8, 9, c[0]); d.R(4, 7, 2, 9, c[2]); d.R(10, 7, 2, 9, c[1]); d.line(4, 7, 8, 5, c[0]); d.line(8, 5, 12, 8, c[0]); d.R(3, 14, 10, 2, c[1]);
        d.R(12, 13, 3, 2, c[0]);
    };
    PT.stalagmite = (d, f, c) => {
        for (let y = 2; y < 15; y++) { const w = Math.floor((y - 1) / 2.4); d.R(8 - w, y, w * 2 + 1, 1, y < 6 ? c[2] : c[0]); }
        d.R(8, 4, 1, 11, c[1]);
    };
    PT.skull = (d, f, c) => {
        d.disc(8, 8, 3, c[0]); d.R(6, 10, 5, 3, c[0]); d.P(7, 8, c[1]); d.P(9, 8, c[1]); d.P(7, 12, c[1]); d.P(9, 12, c[1]);
    };
    PT.bones = (d, f, c) => {
        d.line(3, 11, 12, 6, c[0]); d.line(4, 5, 12, 12, c[0]); d.R(2, 10, 2, 2, c[0]); d.R(11, 5, 2, 2, c[0]); d.R(3, 4, 2, 2, c[0]); d.R(11, 11, 2, 2, c[0]);
    };
    PT.cobweb = (d, f, c) => {
        d.line(0, 0, 10, 10, c[0]); d.line(0, 0, 15, 4, c[0]); d.line(0, 0, 4, 15, c[0]);
        d.line(6, 1, 1, 6, c[0]); d.line(11, 3, 3, 11, c[0]);
    };
    PT.crystal = (d, f, c) => {
        const sh = f % 3;
        d.R(6, 4, 4, 11, c[0]); d.R(7, 2, 2, 2, c[0]); d.R(3, 8, 3, 7, c[1]); d.R(10, 7, 3, 8, c[1]); d.R(4, 6, 1, 2, c[1]); d.R(11, 5, 1, 2, c[1]);
        d.R(7, 4, 1, 9, c[2]); if (sh === 0) d.P(7, 3, '#ffffff'); if (sh === 1) d.P(11, 7, '#ffffff'); if (sh === 2) d.P(4, 9, '#ffffff');
    };
    PT.coffin = (d, f, c) => {
        d.R(4, 1, 8, 14, c[0]); d.R(3, 3, 10, 6, c[0]); d.R(4, 1, 8, 1, U.shade(c[0], 0.25));
        d.R(7, 4, 2, 7, c[1]); d.R(5, 6, 6, 2, c[1]);
    };
    PT.altar = (d, f, c) => {
        d.R(2, 7, 12, 8, c[0]); d.R(1, 6, 14, 2, U.shade(c[0], 0.25)); d.R(4, 9, 8, 4, c[1]);
        d.disc(8, 4, 2, f % 2 ? c[2] : U.shade(c[2], 0.3));
    };
    PT.spikes = (d, f, c) => {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
            const x = 2 + i * 4, y = 5 + j * 6;
            d.R(x, y + 2, 3, 1, c[1]); d.R(x + 1, y, 1, 2, c[0]);
        }
    };
    PT.throne = (d, f, c) => {
        d.R(3, 1, 10, 13, c[0]); d.R(4, 2, 8, 7, c[1]); d.R(2, 8, 12, 3, c[0]); d.R(3, 11, 10, 3, c[1]);
        d.R(3, 14, 2, 2, c[0]); d.R(11, 14, 2, 2, c[0]); d.disc(8, 2, 1, '#ff3a5a');
    };
    PT.armor = (d, f, c) => {
        d.R(7, 12, 2, 4, '#6b4423'); d.R(4, 14, 8, 2, '#6b4423');
        d.R(5, 5, 6, 7, c[0]); d.R(3, 5, 2, 4, c[0]); d.R(11, 5, 2, 4, c[0]); d.disc(8, 3, 2, c[0]); d.R(7, 3, 2, 1, '#222');
        d.R(5, 5, 1, 7, c[1]); d.R(6, 8, 4, 1, c[1]);
    };
    PT.banner = (d, f, c) => {
        d.R(2, 1, 12, 1, '#c8a040'); d.R(3, 2, 10, 11, c[0]); d.R(3, 13, 3, 2, c[0]); d.R(10, 13, 3, 2, c[0]); d.R(6, 13, 4, 1, c[0]);
        d.disc(8, 7, 2, c[1]); d.R(3, 2, 1, 11, U.shade(c[0], 0.2));
    };
    PT.snowman = (d, f, c) => {
        d.disc(8, 11, 4, c[0]); d.disc(8, 5, 3, c[0]); d.P(7, 4, '#222'); d.P(9, 4, '#222'); d.R(8, 5, 2, 1, '#ff8a2a');
        d.R(5, 1, 6, 2, c[1]); d.R(6, 0, 4, 1, c[1]); d.P(8, 10, '#222'); d.P(8, 12, '#222'); d.R(5, 8, 6, 1, '#d03a3a');
    };
    PT.campfire = (d, f, c) => {
        d.line(3, 14, 13, 11, '#6b4423'); d.line(3, 11, 13, 14, '#5a3818');
        for (let i = 0; i < 6; i++) d.P(2 + i * 2 + (i % 2), 15, '#888');
        const h = 4 + (f % 3);
        d.ell(8, 12 - h / 2, 3, h / 2, '#ff6a1a'); d.ell(8, 12 - h / 3, 1, h / 3, '#ffe066');
    };
    PT.grave = (d, f, c) => {
        d.R(4, 4, 8, 11, c[0]); d.ell(8, 4, 4, 3, c[0]); d.R(4, 4, 1, 11, c[2] || U.shade(c[0], 0.2));
        d.R(6, 6, 4, 1, c[1]); d.R(7, 5, 2, 4, c[1]); d.R(3, 15, 10, 1, '#3a5a2a');
    };
    PT.cross = (d, f, c) => { d.R(7, 2, 2, 14, c[0]); d.R(4, 5, 8, 2, c[0]); d.R(7, 2, 1, 14, c[1]); };
    PT.pumpkin = (d, f, c) => {
        d.ell(8, 10, 6, 5, c[0]); d.R(7, 4, 2, 2, '#4a7a2a'); d.R(6, 6, 1, 8, U.shade(c[0], -0.2)); d.R(10, 6, 1, 8, U.shade(c[0], -0.2));
        const glow = f % 2 ? '#fff06a' : '#ffc23a';
        d.R(5, 8, 2, 2, glow); d.R(10, 8, 2, 2, glow); d.R(5, 12, 7, 1, glow);
    };
    PT.ironfence = (d, f, c) => {
        d.R(0, 5, T, 1, c[0]); d.R(0, 13, T, 1, c[0]);
        for (let x = 1; x < T; x += 3) { d.R(x, 3, 1, 12, c[0]); d.P(x, 2, c[1]); }
    };
    PT.computer = (d, f, c) => {
        d.R(1, 3, 14, 12, c[0]); d.R(1, 3, 14, 1, U.shade(c[0], 0.3));
        d.R(3, 5, 10, 5, '#061a14');
        for (let i = 0; i < 3; i++) d.R(4, 6 + i * 1.5, 2 + ((d.n(i, f + 53) * 7) | 0), 1, c[1]);
        d.P(3 + f * 3, 12, '#ff5a5a'); d.P(12, 12, '#5aff8a');
    };
    PT.pipe = (d, f, c) => { d.R(0, 6, T, 5, c[0]); d.R(0, 6, T, 1, c[1]); d.R(0, 10, T, 1, U.shade(c[0], -0.3)); d.R(5, 5, 2, 7, c[1]); d.R(11, 5, 2, 7, c[1]); };
    PT.pod = (d, f, c) => { d.ell(8, 9, 6, 6, c[0]); d.ell(8, 8, 4, 4, c[1]); d.R(6, 6, 2, 2, '#ffffff'); d.R(5, 15, 6, 1, c[0]); };
    PT.tube = (d, f, c) => {
        d.R(4, 1, 8, 2, c[0]); d.R(4, 13, 8, 3, c[0]); d.R(5, 3, 6, 10, c[1]);
        for (let i = 0; i < 3; i++) d.P(6 + i * 2, 12 - ((f * 3 + i * 4) % 9), '#ffffff');
        d.disc(8, 8, 1, '#4ae070');
    };
    PT.reactor = (d, f, c) => {
        d.disc(8, 8, 7, c[0]); d.disc(8, 8, 5, U.shade(c[0], -0.3)); d.disc(8, 8, 3, f % 2 ? c[1] : U.shade(c[1], 0.4)); d.P(8, 8, '#ffffff');
    };
    PT.locker = (d, f, c) => { d.R(3, 1, 10, 15, c[0]); d.R(8, 1, 1, 15, c[1]); for (let y = 3; y < 8; y += 2) { d.R(4, y, 3, 1, c[1]); d.R(10, y, 2, 1, c[1]); } };
    PT.hologram = (d, f, c) => {
        d.R(4, 13, 8, 3, '#445'); d.R(5, 13, 6, 1, c[0]);
        d.g.globalAlpha = 0.75;
        for (let y = 2; y < 12; y += 2) d.R(5 + (y + f) % 2, y, 6, 1, c[0]);
        d.g.globalAlpha = 1;
        d.disc(8, 5, 2, c[1]);
    };
    PT.cloudpuff = (d, f, c) => { d.disc(5, 10, 4, c[0]); d.disc(11, 10, 4, c[0]); d.disc(8, 7, 4, c[0]); d.R(2, 12, 12, 2, c[1]); };
    PT.starflower = (d, f, c) => {
        for (const [x, y] of [[4, 5], [11, 4], [8, 11]]) {
            d.P(x, y, '#ffffff'); d.P(x - 1, y, c[0]); d.P(x + 1, y, c[0]); d.P(x, y - 1, c[0]); d.P(x, y + 1, c[0]);
            if ((f + x) % 3 === 0) { d.P(x - 2, y, c[1]); d.P(x + 2, y, c[1]); }
            d.R(x, y + 2, 1, 3, '#6ad07a');
        }
    };
    PT.obelisk = (d, f, c) => { d.R(5, 3, 6, 13, c[0]); d.R(6, 1, 4, 2, c[0]); d.R(7, 0, 2, 1, c[0]); d.R(5, 3, 2, 13, c[2]); d.R(8, 5, 1, 2, c[1]); d.R(8, 9, 1, 3, c[1]); };
    PT.tent = (d, f, c) => {
        for (let y = 2; y < 15; y++) { const w = y - 1; d.R(8 - w / 2, y, w, 1, y % 3 ? c[0] : c[1]); }
        d.R(7, 9, 3, 6, '#2a1a0a'); d.R(1, 15, 14, 1, c[1]);
    };
    PT.rubble = (d, f, c) => {
        for (let i = 0; i < 6; i++) { const x = 1 + ((d.n(i, 54) * 12) | 0), y = 6 + ((d.n(i, 55) * 8) | 0); d.R(x, y, 3, 2, c[0]); d.P(x, y, c[2]); d.R(x, y + 2, 3, 1, c[1]); }
    };
    PT.chest = (d, f, c) => {
        d.R(2, 6, 12, 9, c[0]); d.R(2, 4, 12, 4, U.shade(c[0], 0.15)); d.R(2, 8, 12, 1, c[1]);
        d.R(7, 7, 2, 3, '#ffd75a'); d.R(2, 6, 1, 9, c[1]); d.R(13, 6, 1, 9, c[1]);
    };

    // ── over painters (drawn above characters) ───────────────────────────────
    PT.canopy = (d, f, c) => {
        d.disc(4, 5, 5, c[1]); d.disc(12, 6, 5, c[1]); d.disc(8, 10, 6, c[1]);
        d.disc(5, 4, 4, c[0]); d.disc(11, 5, 4, c[0]); d.disc(8, 9, 5, c[0]);
        d.disc(6, 3, 1, c[2]); d.disc(11, 4, 1, c[2]);
    };
    PT.treetop = (d, f, c) => { d.disc(8, 10, 7, c[1]); d.disc(7, 9, 6, c[0]); d.disc(5, 6, 2, c[2]); };
    PT.vines = (d, f, c) => {
        for (let x = 1; x < T; x += 4) { const l = 5 + ((d.n(x, 56) * 9) | 0); d.R(x, 0, 1, l, c[0]); d.P(x + 1, l - 2, c[1]); d.P(x - 1, l - 5, c[1]); }
    };
    PT.shadow = (d, f, c) => { d.g.globalAlpha = 0.28; d.ell(8, 8, 7, 5, c[0]); d.g.globalAlpha = 1; };
    PT.awning = (d, f, c) => {
        for (let i = 0; i < 4; i++) d.R(i * 4, 0, 4, 9, i % 2 ? c[1] : c[0]);
        for (let i = 0; i < 4; i++) d.ell(i * 4 + 2, 9, 2, 1, i % 2 ? c[1] : c[0]);
        d.R(0, 0, T, 1, U.shade(c[0], -0.3));
    };
    PT.overhang = (d, f, c) => { PT.roof(d, f, c); d.g.clearRect(0, 10, T, 6); d.R(0, 10, T, 1, U.shade(c[1], -0.3)); };
    PT.hanglamp = (d, f, c) => {
        d.R(8, 0, 1, 6, '#444'); d.R(5, 6, 7, 3, c[0]); d.R(6, 9, 5, 2, f % 2 ? c[1] : U.shade(c[1], 0.3));
        d.g.globalAlpha = 0.18; d.disc(8, 11, 5, c[1]); d.g.globalAlpha = 1;
    };
    PT.stalactite = (d, f, c) => {
        for (const [x, l] of [[3, 9], [8, 13], [12, 7]]) for (let y = 0; y < l; y++) { const w = Math.floor((l - y) / 4); d.R(x - w, y, w * 2 + 1, 1, y < 2 ? c[1] : c[0]); }
    };
    PT.chains = (d, f, c) => {
        for (const x of [4, 11]) for (let y = 0; y < 14; y += 3) { d.R(x, y, 2, 2, c[0]); d.P(x, y, c[1]); }
    };
    PT.fog = (d, f, c) => {
        d.g.globalAlpha = 0.22;
        d.ell(5 + f, 6, 6, 3, c[0]); d.ell(11 - f, 11, 6, 3, c[0]);
        d.g.globalAlpha = 1;
    };
    PT.chandelier = (d, f, c) => {
        d.R(8, 0, 1, 4, '#555'); d.R(3, 5, 11, 2, c[0]); d.R(5, 4, 7, 1, c[0]);
        for (const x of [3, 8, 13]) { d.R(x, 3, 1, 2, '#f8f0d8'); d.P(x, 2 - (f % 2), '#ffcf40'); }
        d.g.globalAlpha = 0.15; d.disc(8, 9, 6, '#ffe8a0'); d.g.globalAlpha = 1;
    };
    PT.archtop = (d, f, c) => {
        d.R(0, 0, T, 5, c[0]); d.R(0, 0, 3, 14, c[0]); d.R(13, 0, 3, 14, c[0]);
        d.ell(8, 6, 6, 3, c[0]); d.g.clearRect(3, 6, 10, 10); d.R(0, 4, T, 1, c[1]); d.R(3, 0, 1, 14, c[2]);
    };
    PT.icicles = (d, f, c) => {
        d.R(0, 0, T, 2, c[1]);
        for (let x = 1; x < T; x += 3) { const l = 3 + ((d.n(x, 57) * 6) | 0); for (let y = 2; y < l; y++) d.P(x, y, c[0]); d.P(x + 1, 2, c[0]); }
    };
    PT.fronds = (d, f, c) => {
        d.line(8, 8, 0, 12, c[0]); d.line(8, 8, 15, 12, c[0]); d.line(8, 8, 2, 2, c[1]); d.line(8, 8, 14, 2, c[1]); d.line(8, 8, 8, 0, c[0]);
        d.line(8, 9, 1, 13, c[1]); d.line(8, 9, 14, 13, c[1]);
    };
    PT.ceilinglight = (d, f, c) => {
        d.R(2, 0, 12, 3, '#556'); d.R(3, 3, 10, 1, c[0]);
        d.g.globalAlpha = 0.14; d.R(1, 4, 14, 12, c[0]); d.g.globalAlpha = 1;
    };
    PT.wisps = (d, f, c) => {
        d.g.globalAlpha = 0.5; d.ell(4 + f, 4, 4, 1, c[0]); d.ell(11 - f, 10, 4, 1, c[0]); d.g.globalAlpha = 1;
    };
    PT.flag = (d, f, c) => {
        d.R(3, 0, 1, 16, '#6b4423');
        const w = [0, 1, 0][f % 3];
        d.R(4, 1 + w, 9, 5, c[0]); d.R(4, 3 + w, 9, 1, c[1]);
    };

    // ── tilesets ─────────────────────────────────────────────────────────────
    // Shared colours
    const G = ['#5aa03c', '#3f8130', '#7cc35a'];
    const WOOD = ['#a0703a', '#6e4826', '#c89058'];
    const STONE = ['#9a9aa8', '#6a6a7a', '#c4c4d0'];
    const WATER = ['#2e6fc2', '#5fa0ea', '#8fc8ff'];

    const TILESETS = {
        meadow: { name: 'Meadow', bg: 'grass', tiles: [
            { n: 'Grass', p: ['grass', ...G], g: 'grass' },
            { n: 'Dark Grass', p: ['grass', '#468a33', '#356f27', '#62aa48'], g: 'grass' },
            { n: 'Tall Grass', p: ['tallgrass', ...G], g: 'grass' },
            { n: 'Flower Meadow', p: ['meadow', ...G], g: 'grass' },
            { n: 'Dirt Path', p: ['dirt', '#b88a52', '#94693a', '#d0a46a'], g: 'path', e: '#7a5530' },
            { n: 'Sand', p: ['sand', '#e8d290', '#c8b070', '#f8e8b0'], g: 'sand', e: '#c0a060' },
            { n: 'Water', p: ['water', ...WATER], s: 1, a: 3, g: 'water', e: '#c8ecff' },
            { n: 'Deep Water', p: ['water', '#1e4f9a', '#3a74c8'], s: 1, a: 3, g: 'water', e: '#5a94e0' },
            { n: 'Bridge (N–S)', p: ['bridge', ...WOOD.slice(0, 2), WATER[0]], a: 3 },
            { n: 'Bridge (E–W)', p: ['bridgeH', ...WOOD.slice(0, 2), WATER[0]], a: 3 },
            { n: 'Cliff', p: ['cliff', '#8a7058', '#6a5240', '#a88a6a', '#6fb54e'], s: 1 },
            { n: 'Stone Path', p: ['cobble', '#b0aca0', '#7a766a', '#d4d0c4'], g: 'stone' },
            { n: 'Oak Tree', p: ['tree', '#3f9a35', '#2a6e25', '#6b4423'], s: 1, k: 'd', ol: '#1e3a14' },
            { n: 'Apple Tree', p: ['tree', '#3f9a35', '#2a6e25', '#6b4423', '#62c050', '#e83a3a'], s: 1, k: 'd', ol: '#1e3a14' },
            { n: 'Pine Tree', p: ['pine', '#2f7a3a', '#1f5a2a', '#5a3a1a'], s: 1, k: 'd', ol: '#0e2a14' },
            { n: 'Bush', p: ['bush', '#4aa040', '#2f7a2a', '#6ac05a'], s: 1, k: 'd', ol: '#1e3a14' },
            { n: 'Berry Bush', p: ['bush', '#4aa040', '#2f7a2a', '#6ac05a', '#5a6aff'], s: 1, k: 'd', ol: '#1e3a14' },
            { n: 'Rock', p: ['rock', ...STONE], s: 1, k: 'd', ol: '#3a3a44' },
            { n: 'Boulder', p: ['boulder', ...STONE], s: 1, k: 'd', ol: '#3a3a44' },
            { n: 'Stump', p: ['stump', '#7a5030', '#b08050', '#d8b080'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Log', p: ['log', '#7a5030', '#b08050', '#a07040'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Red Flowers', p: ['flowers', '#ff5a6a', '#ff8aa0', '#ffe066'], k: 'd' },
            { n: 'Blue Flowers', p: ['flowers', '#6a8aff', '#b0c0ff', '#ffffff'], k: 'd' },
            { n: 'Weeds', p: ['weeds', '#3f8130', '#5aa03c'], k: 'd' },
            { n: 'Mushrooms', p: ['mushrooms', '#e04a3a', '#ffffff'], k: 'd' },
            { n: 'Pebbles', p: ['pebbles', '#9a9aa8', '#c4c4d0'], k: 'd' },
            { n: 'Fence (E–W)', p: ['fenceH', '#c8a070', '#8a6a40'], s: 1, k: 'd', ol: '#4a3018' },
            { n: 'Fence (N–S)', p: ['fenceV', '#c8a070', '#8a6a40'], s: 1, k: 'd', ol: '#4a3018' },
            { n: 'Fence Post', p: ['post', '#c8a070', '#8a6a40'], s: 1, k: 'd', ol: '#4a3018' },
            { n: 'Signpost', p: ['sign', '#c8a070', '#6e4826'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Hay Bale', p: ['hay', '#e0c060', '#b89838', '#c8a848'], s: 1, k: 'd', ol: '#5a4818' },
            { n: 'Wheat', p: ['wheat', '#e8c860', '#a89040'], k: 'd' },
            { n: 'Well', p: ['well', '#a0a0aa', '#1e3a5a', '#a04a2a'], s: 1, k: 'd', ol: '#2a2a33' },
            { n: 'Scarecrow', p: ['scarecrow', '#5a7ac8', '#8a6a30'], s: 1, k: 'd', ol: '#2a2a2a' },
            { n: 'Campfire', p: ['campfire'], s: 1, a: 3, k: 'd' },
            { n: 'Canopy', p: ['canopy', '#3f9a35', '#2a6e25', '#6ac05a'], k: 'o' },
            { n: 'Treetop', p: ['treetop', '#3f9a35', '#2a6e25', '#6ac05a'], k: 'o' },
            { n: 'Hanging Vines', p: ['vines', '#3f8130', '#7cc35a'], k: 'o' },
            { n: 'Cloud Shadow', p: ['shadow', '#000000'], k: 'o' },
        ] },

        village: { name: 'Village', bg: 'town', tiles: [
            { n: 'Grass', p: ['grass', ...G], g: 'grass' },
            { n: 'Cobblestone', p: ['cobble', '#a8a49a', '#76726a', '#ccc8bc'], g: 'stone' },
            { n: 'Dirt Path', p: ['dirt', '#b88a52', '#94693a', '#d0a46a'], g: 'path', e: '#7a5530' },
            { n: 'Plaza Tiles', p: ['plaza', '#d8c8a8', '#a89878', '#f0e4c8'] },
            { n: 'Water', p: ['water', ...WATER], s: 1, a: 3, g: 'water', e: '#c8ecff' },
            { n: 'Brick Wall', p: ['bricks', '#b0583a', '#7a3a26', '#d07a5a'], s: 1 },
            { n: 'Timber Wall', p: ['woodwall', '#e8dcc0', '#7a5430', '#fff4dc'], s: 1 },
            { n: 'Stone Wall', p: ['blocks', '#a8a8b4', '#6a6a78', '#c8c8d4'], s: 1 },
            { n: 'Brick Window', p: ['window', '#b0583a', '#7a3a26', '#d07a5a', 'bricks', '#4a2a1a', '#8fd0ff'], s: 1 },
            { n: 'Timber Window', p: ['window', '#e8dcc0', '#7a5430', '#fff4dc', 'woodwall', '#6e4826', '#a8e0ff'], s: 1 },
            { n: 'Wooden Door', p: ['door', '#8a5a30', '#5a3818', '#b07a48', 'bricks', '#b0583a'] },
            { n: 'Timber Door', p: ['door', '#6e4826', '#4a2e14', '#8a5a30', 'woodwall', '#e8dcc0'] },
            { n: 'Stone Arch', p: ['arch', '#3a2818', '#241810', '#000', 'blocks', '#a8a8b4'] },
            { n: 'Red Roof', p: ['roof', '#c8443a', '#8a2a24', '#e86a5a'], s: 1 },
            { n: 'Blue Roof', p: ['roof', '#3a6ac8', '#24458a', '#5a8ae8'], s: 1 },
            { n: 'Green Roof', p: ['roof', '#3a9a5a', '#246a3a', '#5aba7a'], s: 1 },
            { n: 'Thatch Roof', p: ['thatch', '#c8a050', '#9a7830', '#e0c070'], s: 1 },
            { n: 'Stone Steps', p: ['stairs', '#b0b0bc', '#6a6a78'] },
            { n: 'Bridge (N–S)', p: ['bridge', ...WOOD.slice(0, 2), WATER[0]], a: 3 },
            { n: 'Bridge (E–W)', p: ['bridgeH', ...WOOD.slice(0, 2), WATER[0]], a: 3 },
            { n: 'Fence (E–W)', p: ['fenceH', '#f0f0f0', '#a8a8b0'], s: 1, k: 'd', ol: '#5a5a66' },
            { n: 'Fence (N–S)', p: ['fenceV', '#f0f0f0', '#a8a8b0'], s: 1, k: 'd', ol: '#5a5a66' },
            { n: 'Lamp Post', p: ['lamp', '#3a3a48', '#ffe07a'], s: 1, a: 2, k: 'd', ol: '#14141c' },
            { n: 'Well', p: ['well', '#a0a0aa', '#1e3a5a', '#a04a2a'], s: 1, k: 'd', ol: '#2a2a33' },
            { n: 'Barrel', p: ['barrel', '#a06a3a', '#5a5a64'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Crate', p: ['crate', '#c89858', '#8a6230'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Fruit Stall', p: ['stall', '#e84a4a', '#ffffff'], s: 1, k: 'd', ol: '#3a1a10' },
            { n: 'Cloth Stall', p: ['stall', '#3a6ae8', '#ffe066'], s: 1, k: 'd', ol: '#101a3a' },
            { n: 'Bench', p: ['bench', '#a06a3a', '#5a3818'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Oak Tree', p: ['tree', '#3f9a35', '#2a6e25', '#6b4423'], s: 1, k: 'd', ol: '#1e3a14' },
            { n: 'Hedge', p: ['hedge', '#3f8a35', '#2a6625', '#5aaa4a'], s: 1, k: 'd', ol: '#1e3a14' },
            { n: 'Flower Bed', p: ['flowers', '#ff5a8a', '#ffb03a', '#ffffff'], k: 'd' },
            { n: 'Inn Sign', p: ['shopsign', '#d0a060', '#4a70d0', 'bed'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Item Sign', p: ['shopsign', '#d0a060', '#40c070', 'potion'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Weapon Sign', p: ['shopsign', '#d0a060', '#c0c0c0', 'sword'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Fountain', p: ['fountain', '#b8b8c4', '#5aa8ff'], s: 1, a: 3, k: 'd', ol: '#3a3a44' },
            { n: 'Statue', p: ['statue', '#a8a8b4', '#6a6a78', '#d4d4e0'], s: 1, k: 'd', ol: '#2a2a33' },
            { n: 'Hay Cart', p: ['cart', '#a06a3a', '#4a3018'], s: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Red Awning', p: ['awning', '#e84a4a', '#ffffff'], k: 'o' },
            { n: 'Roof Overhang', p: ['overhang', '#c8443a', '#8a2a24', '#e86a5a'], k: 'o' },
            { n: 'Canopy', p: ['canopy', '#3f9a35', '#2a6e25', '#6ac05a'], k: 'o' },
            { n: 'Pennant', p: ['flag', '#e84a4a', '#ffe066'], a: 3, k: 'o' },
        ] },

        interior: { name: 'Interior', bg: 'indoor', tiles: [
            { n: 'Wood Floor', p: ['planks', '#b07a48', '#7a5028', '#c89060'] },
            { n: 'Dark Floor', p: ['planks', '#7a5030', '#4e3018', '#966440'] },
            { n: 'Stone Floor', p: ['blocks', '#9a9aa4', '#72727c', '#b4b4be'] },
            { n: 'Checker Tiles', p: ['checker', '#e8e0d0', '#6a5a4a'] },
            { n: 'Red Carpet', p: ['carpet', '#a83a3a', '#e0b040', '#c85050'] },
            { n: 'Blue Carpet', p: ['carpet', '#3a5aa8', '#e0b040', '#5070c8'] },
            { n: 'Plaster Wall', p: ['plaster', '#f0e4c8', '#8a6a48', '#c8b490'], s: 1 },
            { n: 'Wood Wall', p: ['woodwall', '#a07040', '#6e4826', '#c09060'], s: 1 },
            { n: 'Stone Wall', p: ['wallTop', '#9a9aa8', '#6a6a7a', '#b8b8c4'], s: 1 },
            { n: 'Window Wall', p: ['window', '#f0e4c8', '#c8b490', '#ffffff', 'plaster', '#6e4826', '#a8e0ff'], s: 1 },
            { n: 'Fireplace', p: ['fireplace', '#a85a3a', '#6a3020', '#c87a5a'], s: 1, a: 3 },
            { n: 'Stairs Up', p: ['stairs', '#b07a48', '#5a3818', 0, 1] },
            { n: 'Stairs Down', p: ['stairs', '#6a5a4a', '#2a2018'] },
            { n: 'Doormat', p: ['carpet', '#8a6a3a', '#5a4020', '#a8884a'] },
            { n: 'Darkness', p: ['void', '#0a0810'], s: 1 },
            { n: 'Table', p: ['table', '#a0703a', '#6e4826'], s: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Laid Table', p: ['table', '#a0703a', '#6e4826', '#f0f0f0'], s: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Chair', p: ['chair', '#a0703a', '#6e4826'], s: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Bed', p: ['bed', '#8a5a30', '#4a7ad0', '#ffffff'], s: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Red Bed', p: ['bed', '#8a5a30', '#c84a4a', '#ffffff'], s: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Bookshelf', p: ['shelf', '#8a5a30'], s: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Cupboard', p: ['cupboard', '#a0703a', '#6e4826'], s: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Counter', p: ['counter', '#c89058', '#8a5a30'], s: 1, c: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Barrel', p: ['barrel', '#a06a3a', '#5a5a64'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Crate', p: ['crate', '#c89858', '#8a6230'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Pot', p: ['pot', '#c8784a', '#8a4a2a'], s: 1, k: 'd', ol: '#3a1a0a' },
            { n: 'House Plant', p: ['plant', '#5ab04a', '#3a8a35'], s: 1, k: 'd', ol: '#1e3a14' },
            { n: 'Candle', p: ['candle', '#f8f0d8', '#c8a040'], s: 1, a: 2, k: 'd' },
            { n: 'Painting', p: ['painting', '#c8a040', '#8fc8ff', '#5aa03c'], k: 'd', ol: '#3a2a10' },
            { n: 'Clock', p: ['clock', '#8a5a30', '#5a3818'], s: 1, a: 2, k: 'd', ol: '#2a1a0a' },
            { n: 'Anvil', p: ['anvil', '#5a5a68', '#8a8a98'], s: 1, k: 'd', ol: '#1a1a22' },
            { n: 'Cauldron', p: ['cauldron', '#3a3a44', '#5ad06a'], s: 1, a: 3, k: 'd', ol: '#101014' },
            { n: 'Book Pile', p: ['books', '#c84040', '#4060c8', '#40a050'], k: 'd', ol: '#2a1a1a' },
            { n: 'Rug', p: ['rug', '#a83a3a', '#e0b040', '#ffffff'], k: 'd' },
            { n: 'Hanging Lamp', p: ['hanglamp', '#8a6a3a', '#ffe07a'], a: 2, k: 'o' },
            { n: 'Chandelier', p: ['chandelier', '#c8a040'], a: 2, k: 'o' },
        ] },

        dungeon: { name: 'Dungeon', bg: 'cave', tiles: [
            { n: 'Cave Floor', p: ['speck', '#5a4e44', '#463c34', '#6e6256'], g: 'floor' },
            { n: 'Stone Floor', p: ['blocks', '#6a6a74', '#4a4a54', '#7e7e88'] },
            { n: 'Gravel', p: ['gravel', '#6e645a', '#4e463e', '#8a8074'] },
            { n: 'Cave Wall', p: ['cliff', '#4a3e36', '#2e2620', '#5e5046', '#6a5e52'], s: 1 },
            { n: 'Brick Wall', p: ['wallTop', '#6a6a78', '#44444e', '#82828e'], s: 1 },
            { n: 'Mossy Wall', p: ['wallTop', '#5a6a58', '#3a4a3a', '#6e8a5a', '#7aa060'], s: 1 },
            { n: 'Water', p: ['water', '#1e4a7a', '#3a6aa0', '#5a8ac0'], s: 1, a: 3, g: 'water', e: '#5a8ac0' },
            { n: 'Lava', p: ['lava', '#d8401a', '#ffa030', '#fff07a'], s: 1, a: 3, g: 'lava', e: '#3a1a10' },
            { n: 'Chasm', p: ['chasm', '#05040a', '#3a3030'], s: 1 },
            { n: 'Stairs Down', p: ['stairs', '#5a5a64', '#1a1a20'] },
            { n: 'Stairs Up', p: ['stairs', '#7a7a84', '#3a3a44', 0, 1] },
            { n: 'Bridge (N–S)', p: ['bridge', '#7a5030', '#4a3018', '#05040a'], a: 3 },
            { n: 'Glowing Floor', p: ['crystalfloor', '#3a3a6a', '#5a5aa0', '#9a9aff'], a: 3 },
            { n: 'Darkness', p: ['void', '#030205'], s: 1 },
            { n: 'Wall Torch', p: ['torch', '#6b4423'], s: 1, a: 3, k: 'd' },
            { n: 'Pillar', p: ['pillar', '#7a7a84', '#4a4a54', '#9a9aa4'], s: 1, k: 'd', ol: '#1a1a22' },
            { n: 'Broken Pillar', p: ['brokenpillar', '#7a7a84', '#4a4a54', '#9a9aa4'], s: 1, k: 'd', ol: '#1a1a22' },
            { n: 'Stalagmite', p: ['stalagmite', '#6e6256', '#4a3e36', '#8a7e70'], s: 1, k: 'd', ol: '#1a1410' },
            { n: 'Rock', p: ['rock', '#6e6256', '#4a3e36', '#8a7e70'], s: 1, k: 'd', ol: '#1a1410' },
            { n: 'Rubble', p: ['rubble', '#7a7a84', '#4a4a54', '#9a9aa4'], k: 'd' },
            { n: 'Skull', p: ['skull', '#e8e0c8', '#2a2018'], k: 'd', ol: '#1a1410' },
            { n: 'Bones', p: ['bones', '#e8e0c8'], k: 'd' },
            { n: 'Cobweb', p: ['cobweb', 'rgba(230,230,240,0.8)'], k: 'd' },
            { n: 'Blue Crystal', p: ['crystal', '#5a9aff', '#3a6ad0', '#bfe0ff'], s: 1, a: 3, k: 'd', ol: '#101a3a' },
            { n: 'Red Crystal', p: ['crystal', '#ff5a7a', '#c83a5a', '#ffc0d0'], s: 1, a: 3, k: 'd', ol: '#3a0a1a' },
            { n: 'Glowcaps', p: ['mushrooms', '#5ae0c0', '#ffffff'], k: 'd' },
            { n: 'Barrel', p: ['barrel', '#7a5030', '#4a4a54'], s: 1, k: 'd', ol: '#1a1008' },
            { n: 'Crate', p: ['crate', '#8a6a40', '#5a4020'], s: 1, k: 'd', ol: '#1a1008' },
            { n: 'Brazier', p: ['brazier', '#5a5a68', '#ff7a1a'], s: 1, a: 3, k: 'd', ol: '#14141c' },
            { n: 'Statue', p: ['statue', '#7a7a84', '#4a4a54', '#9a9aa4'], s: 1, k: 'd', ol: '#14141c' },
            { n: 'Coffin', p: ['coffin', '#5a3a28', '#c8a040'], s: 1, k: 'd', ol: '#1a1008' },
            { n: 'Altar', p: ['altar', '#7a7a84', '#4a4a54', '#c05aff'], s: 1, a: 2, k: 'd', ol: '#14141c' },
            { n: 'Spikes', p: ['spikes', '#c8c8d4', '#6a6a78'], s: 1, k: 'd' },
            { n: 'Stalactites', p: ['stalactite', '#5e5046', '#7a6a5e'], k: 'o' },
            { n: 'Hanging Chains', p: ['chains', '#6a6a74', '#9a9aa4'], k: 'o' },
            { n: 'Web Curtain', p: ['cobweb', 'rgba(230,230,240,0.6)'], k: 'o' },
        ] },

        castle: { name: 'Castle', bg: 'castle', tiles: [
            { n: 'Marble Floor', p: ['marble', '#e8e4ec', '#c0bcc8', '#ffffff'] },
            { n: 'Checker Marble', p: ['checker', '#e8e4ec', '#3a3448', '#ffffff'] },
            { n: 'Royal Carpet', p: ['carpet', '#b0283a', '#f0c040', '#d04050'] },
            { n: 'Gold Tiles', p: ['plaza', '#e0b848', '#a8862a', '#fff0a0'] },
            { n: 'Castle Wall', p: ['wallTop', '#a8a4b8', '#6a6678', '#c8c4d8'], s: 1 },
            { n: 'Stained Window', p: ['window', '#a8a4b8', '#6a6678', '#c8c4d8', 'blocks', '#3a3448', '#c070ff'], s: 1 },
            { n: 'Great Door', p: ['arch', '#7a4a28', '#4a2a14', '#000', 'blocks', '#a8a4b8'] },
            { n: 'Grand Stairs', p: ['stairs', '#d8d4e0', '#8a86a0', 0, 1] },
            { n: 'Moat', p: ['water', '#2a5a9a', '#4a80c0', '#7ab0e8'], s: 1, a: 3, g: 'water', e: '#9ac8f0' },
            { n: 'Battlement', p: ['blocks', '#a8a4b8', '#6a6678', '#c8c4d8'], s: 1 },
            { n: 'Garden Grass', p: ['grass', ...G], g: 'grass' },
            { n: 'Garden Path', p: ['cobble', '#d8d0c0', '#a8a090', '#f0e8d8'], g: 'stone' },
            { n: 'Marble Pillar', p: ['pillar', '#e8e4ec', '#a8a4b8', '#ffffff'], s: 1, k: 'd', ol: '#3a3448' },
            { n: 'Throne', p: ['throne', '#e0b040', '#b0283a'], s: 1, k: 'd', ol: '#3a1a10' },
            { n: 'Knight Statue', p: ['statue', '#b8b8c8', '#7a7a8a', '#e0e0f0'], s: 1, k: 'd', ol: '#24242e' },
            { n: 'Armour Stand', p: ['armor', '#c8c8d8', '#7a7a8a'], s: 1, k: 'd', ol: '#24242e' },
            { n: 'Brazier', p: ['brazier', '#c8a040', '#ff7a1a'], s: 1, a: 3, k: 'd', ol: '#3a2a10' },
            { n: 'Red Banner', p: ['banner', '#b0283a', '#f0c040'], s: 1, k: 'd', ol: '#3a0a10' },
            { n: 'Blue Banner', p: ['banner', '#2838b0', '#f0c040'], s: 1, k: 'd', ol: '#0a103a' },
            { n: 'Long Table', p: ['table', '#8a5a30', '#5a3818', '#f0f0f0'], s: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Chair', p: ['chair', '#b0283a', '#5a3818'], s: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Bookshelf', p: ['shelf', '#6e4826'], s: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Plant Urn', p: ['plant', '#4aa04a', '#2a7a35', '#d8d4e0'], s: 1, k: 'd', ol: '#1e3a14' },
            { n: 'Fountain', p: ['fountain', '#e8e4ec', '#5aa8ff'], s: 1, a: 3, k: 'd', ol: '#3a3448' },
            { n: 'Rose Bush', p: ['bush', '#3a8a3a', '#2a6a2a', '#5aaa5a', '#ff3a5a'], s: 1, k: 'd', ol: '#1e3a14' },
            { n: 'Chandelier', p: ['chandelier', '#e0b040'], a: 2, k: 'o' },
            { n: 'Archway', p: ['archtop', '#a8a4b8', '#6a6678', '#c8c4d8'], k: 'o' },
            { n: 'Pennant', p: ['flag', '#b0283a', '#f0c040'], a: 3, k: 'o' },
        ] },

        snow: { name: 'Snowfield', bg: 'snow', tiles: [
            { n: 'Snow', p: ['snow', '#eef4fb', '#c8d8ea', '#ffffff'], g: 'snow' },
            { n: 'Packed Snow', p: ['snow', '#d8e2ee', '#b0c0d4', '#f0f4fa'], g: 'trail', e: '#a8b8cc' },
            { n: 'Ice', p: ['ice', '#a8d8f0', '#e8f8ff', '#ffffff'], g: 'ice' },
            { n: 'Frozen Lake', p: ['water', '#5a8ac0', '#a8d0f0', '#e0f0ff'], s: 1, a: 3, g: 'water', e: '#ffffff' },
            { n: 'Snowy Cliff', p: ['cliff', '#8a9ab0', '#5a6a80', '#aab8cc', '#ffffff'], s: 1 },
            { n: 'Ice Brick Wall', p: ['bricks', '#b8d0e8', '#7890b0', '#e0f0ff'], s: 1 },
            { n: 'Cabin Wall', p: ['woodwall', '#8a5a30', '#5a3818', '#a87848'], s: 1 },
            { n: 'Cabin Door', p: ['door', '#6e4826', '#4a2e14', '#8a5a30', 'woodwall', '#8a5a30'] },
            { n: 'Snowy Roof', p: ['roof', '#f0f6ff', '#b8c8dc', '#ffffff'], s: 1 },
            { n: 'Frozen Stairs', p: ['stairs', '#d8e2ee', '#8a9ab0'] },
            { n: 'Snowy Pine', p: ['pine', '#2f6a4a', '#1f4a34', '#5a3a1a', '#ffffff'], s: 1, k: 'd', ol: '#0e2a1e' },
            { n: 'Bare Tree', p: ['deadtree', '#6a5040', '#4a3828'], s: 1, k: 'd' },
            { n: 'Snowman', p: ['snowman', '#ffffff', '#2a2a3a'], s: 1, k: 'd', ol: '#5a6a80' },
            { n: 'Ice Crystal', p: ['crystal', '#a8e0ff', '#6ab0e8', '#ffffff'], s: 1, a: 3, k: 'd', ol: '#2a4a6a' },
            { n: 'Snowy Rock', p: ['rock', '#8a9ab0', '#5a6a80', '#ffffff'], s: 1, k: 'd', ol: '#2a3444' },
            { n: 'Snowy Bush', p: ['bush', '#4a8a6a', '#2a6a4a', '#ffffff'], s: 1, k: 'd', ol: '#14301e' },
            { n: 'Fence', p: ['fenceH', '#8a6a4a', '#5a4030', '#ffffff'], s: 1, k: 'd', ol: '#2a1a0a' },
            { n: 'Campfire', p: ['campfire'], s: 1, a: 3, k: 'd' },
            { n: 'Log Pile', p: ['log', '#7a5030', '#b08050', '#a07040'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Icicles', p: ['icicles', '#d8f0ff', '#ffffff'], k: 'o' },
            { n: 'Snow Drift', p: ['wisps', '#ffffff'], a: 3, k: 'o' },
        ] },

        desert: { name: 'Desert', bg: 'desert', tiles: [
            { n: 'Sand', p: ['sand', '#e8c878', '#c8a858', '#f8e0a0'], g: 'sand' },
            { n: 'Dunes', p: ['sand', '#e0b860', '#b89040', '#f0d088'], g: 'sand' },
            { n: 'Cracked Earth', p: ['cracked', '#c8945a', '#8a6038', '#e0b07a'] },
            { n: 'Sandstone Floor', p: ['plaza', '#e0c088', '#a88a58', '#f8e0b0'] },
            { n: 'Sandstone Wall', p: ['wallTop', '#d8b070', '#9a7a48', '#f0d098'], s: 1 },
            { n: 'Ruined Wall', p: ['blocks', '#c8a068', '#8a6a40', '#e0c088'], s: 1 },
            { n: 'Oasis', p: ['water', '#2a9ab0', '#5ac8d8', '#a8f0f8'], s: 1, a: 3, g: 'water', e: '#f8e8b0' },
            { n: 'Temple Door', p: ['arch', '#2a1a10', '#1a100a', '#000', 'blocks', '#d8b070'] },
            { n: 'Stone Path', p: ['cobble', '#d8c0a0', '#a8906a', '#f0dcc0'], g: 'stone' },
            { n: 'Sand Stairs', p: ['stairs', '#e0c088', '#9a7a48'] },
            { n: 'Cactus', p: ['cactus', '#4a9a4a', '#2a6a35', '#7ac06a'], s: 1, k: 'd', ol: '#14301a' },
            { n: 'Flowering Cactus', p: ['cactus', '#4a9a4a', '#2a6a35', '#7ac06a', '#ff6aa0'], s: 1, k: 'd', ol: '#14301a' },
            { n: 'Palm Tree', p: ['palm', '#4aa040', '#2f7a2a', '#9a6a3a'], s: 1, k: 'd', ol: '#1e3a14' },
            { n: 'Dry Bush', p: ['weeds', '#a08a4a', '#c8a860'], k: 'd' },
            { n: 'Skull', p: ['skull', '#f0e8d0', '#3a2a18'], k: 'd', ol: '#3a2a18' },
            { n: 'Bones', p: ['bones', '#f0e8d0'], k: 'd' },
            { n: 'Desert Rock', p: ['rock', '#b88a5a', '#8a603a', '#d8aa7a'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Clay Pot', p: ['pot', '#c8784a', '#8a4a2a'], s: 1, k: 'd', ol: '#3a1a0a' },
            { n: 'Obelisk', p: ['obelisk', '#d8b070', '#5a3a1a', '#f0d098'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Tent', p: ['tent', '#e8e0c8', '#c84a3a'], s: 1, k: 'd', ol: '#3a2a1a' },
            { n: 'Broken Column', p: ['brokenpillar', '#d8b070', '#9a7a48', '#f0d098'], s: 1, k: 'd', ol: '#3a2410' },
            { n: 'Palm Fronds', p: ['fronds', '#4aa040', '#2f7a2a'], k: 'o' },
            { n: 'Awning', p: ['awning', '#e8e0c8', '#c84a3a'], k: 'o' },
        ] },

        spooky: { name: 'Spooky Hollow', bg: 'spooky', tiles: [
            { n: 'Dead Grass', p: ['grass', '#5a6a3a', '#3e4a28', '#76864a'], g: 'grass' },
            { n: 'Witch Grass', p: ['grass', '#4a3a6a', '#34284a', '#6a5a8a'], g: 'grass' },
            { n: 'Mud', p: ['dirt', '#4a3a2a', '#342818', '#5e4a36'], g: 'path', e: '#241a10' },
            { n: 'Grave Path', p: ['cobble', '#6a6a74', '#44444e', '#8a8a94'], g: 'stone' },
            { n: 'Murky Water', p: ['water', '#2a3a3a', '#4a5e5a', '#6a8a7a'], s: 1, a: 3, g: 'water', e: '#5a7a6a' },
            { n: 'Crypt Floor', p: ['blocks', '#4a4a54', '#34343c', '#5e5e68'] },
            { n: 'Crypt Wall', p: ['wallTop', '#5a5a64', '#3a3a44', '#74747e'], s: 1 },
            { n: 'Haunted Wall', p: ['woodwall', '#5a4a3a', '#342a20', '#6e5e4a'], s: 1 },
            { n: 'Broken Window', p: ['window', '#5a4a3a', '#342a20', '#6e5e4a', 'woodwall', '#1a1410', '#ffd060'], s: 1 },
            { n: 'Crypt Door', p: ['arch', '#1a1418', '#0a080a', '#000', 'blocks', '#5a5a64'] },
            { n: 'Dead Tree', p: ['deadtree', '#4a3a30', '#2a2018'], s: 1, k: 'd' },
            { n: 'Gravestone', p: ['grave', '#8a8a94', '#5a5a64', '#a8a8b0'], s: 1, k: 'd', ol: '#1a1a22' },
            { n: 'Cross', p: ['cross', '#7a7a84', '#a8a8b0'], s: 1, k: 'd', ol: '#1a1a22' },
            { n: 'Jack-o\'-lantern', p: ['pumpkin', '#e8781a'], s: 1, a: 2, k: 'd', ol: '#3a1a0a' },
            { n: 'Bones', p: ['bones', '#e0d8c0'], k: 'd' },
            { n: 'Skull', p: ['skull', '#e0d8c0', '#1a1410'], k: 'd', ol: '#1a1410' },
            { n: 'Cauldron', p: ['cauldron', '#2a2a30', '#9a5aff'], s: 1, a: 3, k: 'd', ol: '#0a0a0e' },
            { n: 'Iron Fence', p: ['ironfence', '#2a2a34', '#6a6a7a'], s: 1, k: 'd' },
            { n: 'Coffin', p: ['coffin', '#4a2e20', '#9a9aa8'], s: 1, k: 'd', ol: '#1a1008' },
            { n: 'Candles', p: ['candle', '#e8e0d0', '#5a5a64'], s: 1, a: 2, k: 'd' },
            { n: 'Glowshrooms', p: ['mushrooms', '#9a5aff', '#e0c0ff'], k: 'd' },
            { n: 'Fog', p: ['fog', '#c8d0e0'], a: 3, k: 'o' },
            { n: 'Cobwebs', p: ['cobweb', 'rgba(220,220,230,0.7)'], k: 'o' },
            { n: 'Bare Branches', p: ['vines', '#2a2018', '#4a3a30'], k: 'o' },
        ] },

        starship: { name: 'Starship', bg: 'space', tiles: [
            { n: 'Deck Plate', p: ['metal', '#6a7488', '#4a5264', '#8a94a8'] },
            { n: 'Grate', p: ['grate', '#5a6274', '#2a303c', '#7a8496'] },
            { n: 'Blue Panel', p: ['panel', '#4a6aa0', '#2a4a7a', '#6a8ac0', '#3a5a90'] },
            { n: 'Hull Wall', p: ['wallTop', '#7a8496', '#4a5264', '#9aa4b8', '#5a6a8a'], s: 1 },
            { n: 'Viewport', p: ['starwin', '#7a8496', '#4a5264', '#9aa4b8'], s: 1, a: 3 },
            { n: 'Sliding Door', p: ['panel', '#5a9ab0', '#3a6a7a', '#8ad0e0', '#2a4a5a'] },
            { n: 'Hazard Stripes', p: ['hazard', '#e8c030', '#2a2a2a'] },
            { n: 'Energy Floor', p: ['energy', '#1a3a5a', '#4ad0ff', '#2a6a9a'], a: 3 },
            { n: 'Open Space', p: ['space', '#03030c', '#7a8aff'], s: 1, a: 3 },
            { n: 'Light Strip', p: ['energy', '#3a3a4a', '#ff5ad0', '#6a6a7a'], a: 3 },
            { n: 'Console', p: ['computer', '#5a6274', '#4ae070'], s: 1, a: 3, k: 'd', ol: '#14181f' },
            { n: 'Cargo Crate', p: ['crate', '#7a8496', '#4a5264'], s: 1, k: 'd', ol: '#14181f' },
            { n: 'Pipe', p: ['pipe', '#8a94a8', '#b8c0d0'], s: 1, k: 'd', ol: '#14181f' },
            { n: 'Command Chair', p: ['chair', '#3a4a6a', '#2a2a3a'], s: 1, k: 'd', ol: '#0a0a14' },
            { n: 'Escape Pod', p: ['pod', '#c8ccd8', '#5ab8ff'], s: 1, k: 'd', ol: '#14181f' },
            { n: 'Specimen Tube', p: ['tube', '#7a8496', '#3a8a6a'], s: 1, a: 3, k: 'd', ol: '#14181f' },
            { n: 'Reactor', p: ['reactor', '#5a6274', '#4ad0ff'], s: 1, a: 2, k: 'd', ol: '#14181f' },
            { n: 'Locker', p: ['locker', '#6a7a9a', '#3a4a6a'], s: 1, k: 'd', ol: '#14181f' },
            { n: 'Hologram', p: ['hologram', '#5ae0ff', '#ffffff'], s: 1, a: 2, k: 'd' },
            { n: 'Ceiling Light', p: ['ceilinglight', '#bfe8ff'], k: 'o' },
            { n: 'Overhead Pipes', p: ['pipe', '#6a7488', '#9aa4b8'], k: 'o' },
        ] },

        sky: { name: 'Sky Isles', bg: 'sky', tiles: [
            { n: 'Cloud', p: ['cloud', '#f4f6ff', '#d4daf0', '#ffffff'], g: 'cloud' },
            { n: 'Storm Cloud', p: ['cloud', '#b8bcd8', '#9094b8', '#d4d8f0'], g: 'cloud' },
            { n: 'Open Sky', p: ['space', '#6aa8f0', '#ffffff'], s: 1, a: 3 },
            { n: 'Marble Floor', p: ['marble', '#f0eef8', '#c8c4dc', '#ffffff'] },
            { n: 'Gold Tiles', p: ['plaza', '#f0c850', '#b8902a', '#fff4b0'] },
            { n: 'Rainbow Bridge', p: ['rainbow'], a: 3 },
            { n: 'Crystal Floor', p: ['crystalfloor', '#c8b8ff', '#9a88e8', '#ffffff'], a: 3 },
            { n: 'Temple Wall', p: ['wallTop', '#f0eef8', '#b8b4d0', '#ffffff', '#f0c850'], s: 1 },
            { n: 'Sky Grass', p: ['meadow', '#6ad07a', '#4ab05a', '#9af0a0', '#ffffff', '#ffe066'], g: 'grass' },
            { n: 'Temple Arch', p: ['arch', '#fff8d8', '#e8d8a0', '#000', 'blocks', '#f0eef8'] },
            { n: 'Sky Crystal', p: ['crystal', '#c8a8ff', '#9a78e8', '#ffffff'], s: 1, a: 3, k: 'd', ol: '#3a2a6a' },
            { n: 'Golden Pillar', p: ['pillar', '#f0c850', '#b8902a', '#fff4b0'], s: 1, k: 'd', ol: '#5a400a' },
            { n: 'Angel Statue', p: ['statue', '#f0eef8', '#b8b4d0', '#ffffff'], s: 1, k: 'd', ol: '#5a5a7a' },
            { n: 'Cloud Puff', p: ['cloudpuff', '#ffffff', '#d4daf0'], s: 1, k: 'd', ol: '#a8b0d0' },
            { n: 'Star Flowers', p: ['starflower', '#ffe066', '#fff8c0'], a: 3, k: 'd' },
            { n: 'Fountain', p: ['fountain', '#f0eef8', '#a8d0ff'], s: 1, a: 3, k: 'd', ol: '#5a5a7a' },
            { n: 'Harp Altar', p: ['altar', '#f0eef8', '#c8c4dc', '#ffe066'], s: 1, a: 2, k: 'd', ol: '#5a5a7a' },
            { n: 'Cloud Wisps', p: ['wisps', '#ffffff'], a: 3, k: 'o' },
            { n: 'Golden Arch', p: ['archtop', '#f0c850', '#b8902a', '#fff4b0'], k: 'o' },
        ] },
    };

    // Background for battles, keyed by battleBg.
    const BACKDROPS = {
        grass: ['#7ac0ff', '#d8f0ff', '#5aa03c', '#3f8130'],
        town: ['#8ab8f0', '#e0f0ff', '#b8a888', '#8a7a60'],
        indoor: ['#3a2a20', '#6a4a30', '#a07048', '#7a5030'],
        cave: ['#0a0810', '#2a2230', '#4a3e36', '#2e2620'],
        castle: ['#2a1a3a', '#5a3a6a', '#b0283a', '#7a1a2a'],
        snow: ['#9ab8e0', '#f0f6ff', '#eef4fb', '#c8d8ea'],
        desert: ['#f0a860', '#ffe0a0', '#e8c878', '#c8a858'],
        spooky: ['#140a24', '#3a2a5a', '#3e4a28', '#2a3018'],
        space: ['#03030c', '#1a1a4a', '#4a5264', '#2a303c'],
        sky: ['#6aa8f0', '#ffffff', '#f4f6ff', '#d4daf0'],
    };

    // ── tile canvases and map baking ─────────────────────────────────────────
    const cache = new Map();

    function tileDef(set, n) {
        const ts = TILESETS[set] || TILESETS.meadow;
        return n > 0 ? ts.tiles[n - 1] || null : null;
    }

    /** A 16×16 canvas for tile n (1-based) of a tileset, at an animation frame and variant. */
    function tileCanvas(set, n, frame, variant) {
        const def = tileDef(set, n);
        if (!def) return null;
        const f = def.a ? (frame || 0) % def.a : 0;
        const v = def.k === 'd' || def.k === 'o' ? 0 : (variant || 0) % 3;
        const key = set + ':' + n + ':' + f + ':' + v;
        let c = cache.get(key);
        if (c) return c;
        c = U.canvas(T, T);
        const g = U.ctx(c);
        const painter = PT[def.p[0]] || PT.solid;
        painter(kit(g, U.strSeed(set + n) + v * 101), f, def.p.slice(1), v);
        if (def.ol) outline(c, def.ol);
        cache.set(key, c);
        return c;
    }

    function frames(set, map) {
        let max = 1;
        for (const layer of map.layers) for (let i = 0; i < layer.length; i++) {
            const d = layer[i] && tileDef(set, layer[i]);
            if (d && d.a > max) max = d.a;
        }
        return max === 1 ? 1 : 6; // lcm(2, 3)
    }

    /**
     * Bake a map into canvases: `low` (ground + decor) and `high` (over), one per
     * animation frame. opts.layers limits which layers are drawn (the editor);
     * opts.dim greys the layers that are not current.
     */
    function bakeMap(map, opts) {
        opts = opts || {};
        const set = map.tileset, W = map.w, H = map.h;
        const n = opts.frames || frames(set, map);
        const out = { low: [], high: [], frames: n };
        for (let f = 0; f < n; f++) {
            const low = U.canvas(W * T, H * T), high = U.canvas(W * T, H * T);
            const gl = U.ctx(low), gh = U.ctx(high);
            drawLayers(gl, map, f, [0, 1]);
            drawLayers(gh, map, f, [2]);
            out.low.push(low); out.high.push(high);
        }
        return out;
    }

    /** Draw some layers of a map region into a context (tile coordinates). */
    function drawLayers(g, map, frame, layers, x0, y0, x1, y1) {
        const set = map.tileset, W = map.w, H = map.h;
        x0 = x0 || 0; y0 = y0 || 0; x1 = x1 === undefined ? W : x1; y1 = y1 === undefined ? H : y1;
        for (const li of layers) {
            const layer = map.layers[li];
            if (!layer) continue;
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
                const t = layer[y * W + x];
                if (!t) continue;
                const v = (U.hash(x, y, 77) * 3) | 0;
                const c = tileCanvas(set, t, frame, v);
                if (!c) continue;
                g.drawImage(c, x * T, y * T);
                if (li === 0) drawEdges(g, map, x, y, t);
            }
        }
    }

    function drawEdges(g, map, x, y, t) {
        const def = tileDef(map.tileset, t);
        if (!def || !def.e) return;
        const W = map.w, H = map.h, L = map.layers[0];
        const other = (xx, yy) => {
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) return false;
            const od = tileDef(map.tileset, L[yy * W + xx]);
            return !od || od.g !== def.g;
        };
        g.fillStyle = def.e;
        const px = x * T, py = y * T;
        if (other(x, y - 1)) g.fillRect(px, py, T, 1);
        if (other(x, y + 1)) g.fillRect(px, py + T - 1, T, 1);
        if (other(x - 1, y)) g.fillRect(px, py, 1, T);
        if (other(x + 1, y)) g.fillRect(px + T - 1, py, 1, T);
    }

    /** True when the hero can't stand on (x, y) because of tiles. */
    function isSolid(map, x, y) {
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
        const i = y * map.w + x;
        for (let li = 0; li < 2; li++) {
            const t = map.layers[li] && map.layers[li][i];
            if (!t) continue;
            const d = tileDef(map.tileset, t);
            if (d && d.s) return true;
        }
        return false;
    }

    function isCounter(map, x, y) {
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
        const i = y * map.w + x;
        for (let li = 0; li < 2; li++) {
            const d = tileDef(map.tileset, map.layers[li] && map.layers[li][i]);
            if (d && d.c) return true;
        }
        return false;
    }

    TW.tiles = {
        T, PT, TILESETS, BACKDROPS, kit,
        list: () => Object.keys(TILESETS).map((id) => ({ id, name: TILESETS[id].name, bg: TILESETS[id].bg, count: TILESETS[id].tiles.length })),
        def: tileDef, tileCanvas, bakeMap, drawLayers, isSolid, isCounter,
        clearCache: () => cache.clear(),
    };
}]);
