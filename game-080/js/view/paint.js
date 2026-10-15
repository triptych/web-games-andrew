// Tiny pixel-painting helpers shared by the sprite, tile and building art. Everything is drawn in
// code into small canvases once and then blitted.

export function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c, g };
}

const HEX = {};
export function rgb(hex) {
    if (HEX[hex]) return HEX[hex];
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    return (HEX[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
export function hex([r, g, b]) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
}
/** Lighten (amt > 0) or darken (amt < 0) a colour. */
export function shade(h, amt) {
    const [r, g, b] = rgb(h);
    if (amt >= 0) return hex([r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt]);
    return hex([r * (1 + amt), g * (1 + amt), b * (1 + amt)]);
}
export function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return hex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** A painter bound to a context: px, rect, hline, vline, disc, ellipse. */
export function painter(g) {
    const R = (x, y, w, h, c) => { if (w > 0 && h > 0 && c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); } };
    return {
        g, R,
        px: (x, y, c) => R(x, y, 1, 1, c),
        disc(cx, cy, r, c) {
            for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) R(cx + x, cy + y, 1, 1, c);
        },
        ellipse(cx, cy, rx, ry, c) {
            for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) R(cx + x, cy + y, 1, 1, c);
        },
        line(x0, y0, x1, y1, c) {
            const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
            for (let i = 0; i <= n; i++) R(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1, c);
        },
    };
}

/** Add a one-pixel dark outline around everything opaque in the canvas. */
export function outline(c, col = '#1b1420', diag = false) {
    const g = c.getContext('2d');
    const { width: w, height: h } = c;
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40;
    const out = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1) ||
            (diag && (solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1)))) out.push([x, y]);
    }
    const [r, gg, b] = rgb(col);
    for (const [x, y] of out) { const i = (y * w + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
}

/** Integer hash → [0, 1) for pixel-level noise. */
export function nz(x, y, s = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Flip a canvas horizontally (for right-facing sprites). */
export function flipped(c) {
    const o = canvas(c.width, c.height);
    o.g.translate(c.width, 0);
    o.g.scale(-1, 1);
    o.g.drawImage(c, 0, 0);
    return o.c;
}
