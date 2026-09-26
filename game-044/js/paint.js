/**
 * paint.js — brushes for painting scenes in code.
 *
 * Everything draws into a plain 2D context at the game's native 320×200.
 * Scenes are painted once on entry (and again only when a flag that changes
 * the picture flips), then run through palette.quantize(), so these helpers
 * favour expressiveness over speed.
 */

export const W = 320, H = 200;

export function makeCanvas(w = W, h = H) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

/** mulberry32 — every scene seeds its own, so a repaint is identical. */
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function rect(g, x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
}

export function poly(g, pts, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fill();
}

export function line(g, x1, y1, x2, y2, color, w = 1) {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
}

export function ellipse(g, cx, cy, rx, ry, color) {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    g.fill();
}

export function circle(g, cx, cy, r, color) { ellipse(g, cx, cy, r, r, color); }

/** Linear gradient. stops: [[t, color], ...]. */
export function grad(g, x, y, w, h, stops, horizontal = false) {
    const gr = horizontal
        ? g.createLinearGradient(x, 0, x + w, 0)
        : g.createLinearGradient(0, y, 0, y + h);
    for (const [t, c] of stops) gr.addColorStop(t, c);
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
}

/** Radial light. Dithered by quantize(), this is where the warmth comes from. */
export function glow(g, x, y, r, color, alpha = 0.6) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, hexA(color, alpha));
    gr.addColorStop(1, hexA(color, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
}

export function hexA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${gg},${b},${a})`;
}

export function stars(g, R, n, x, y, w, h, colors = ['#ffffff', '#a8c8e8', '#fbe7a1']) {
    for (let i = 0; i < n; i++) {
        const sx = x + R() * w, sy = y + R() * h;
        g.fillStyle = colors[(R() * colors.length) | 0];
        g.fillRect(sx | 0, sy | 0, 1, 1);
        if (R() < 0.08) {
            g.fillRect((sx | 0) - 1, sy | 0, 3, 1);
            g.fillRect(sx | 0, (sy | 0) - 1, 1, 3);
        }
    }
}

/**
 * Mountain / hill silhouette by midpoint displacement, filled down to `bottom`.
 * Returns the ridge heights so callers can place things on it.
 */
export function ridge(g, R, y0, amp, color, rough = 0.55, x0 = 0, x1 = W, bottom = H, peaks = null) {
    const n = 64;
    const ys = new Array(n + 1).fill(0);
    ys[0] = (R() - 0.5) * amp; ys[n] = (R() - 0.5) * amp;
    (function sub(a, b, s) {
        if (b - a < 2) return;
        const m = (a + b) >> 1;
        ys[m] = (ys[a] + ys[b]) / 2 + (R() - 0.5) * s;
        sub(a, m, s * rough); sub(m, b, s * rough);
    })(0, n, amp);
    if (peaks) {
        for (const [px, ph, pw] of peaks) {
            for (let i = 0; i <= n; i++) {
                const x = x0 + (x1 - x0) * i / n;
                const d = Math.abs(x - px) / pw;
                if (d < 1) ys[i] -= ph * Math.pow(1 - d, 1.35);
            }
        }
    }
    const pts = [[x0, bottom]];
    for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + ys[i]]);
    pts.push([x1, bottom]);
    poly(g, pts, color);
    return (x) => {
        const t = Math.max(0, Math.min(n, (x - x0) / (x1 - x0) * n));
        const i = Math.floor(t), f = t - i;
        return y0 + ys[i] * (1 - f) + ys[Math.min(n, i + 1)] * f;
    };
}

export function pine(g, x, base, h, w, color, dark = null, snow = null) {
    const tiers = Math.max(3, Math.round(h / 9));
    rect(g, x - 1, base - 4, 2, 5, '#3a2418');
    for (let i = 0; i < tiers; i++) {
        const t = i / tiers;
        const ty = base - 3 - h * t;
        const tw = w * (1 - t * 0.75);
        const th = h / tiers * 1.7;
        poly(g, [[x - tw / 2, ty], [x + tw / 2, ty], [x, ty - th]], color);
        if (dark) poly(g, [[x + 1, ty], [x + tw / 2, ty], [x, ty - th]], dark);
        if (snow) poly(g, [[x - tw / 5, ty - th * 0.62], [x + tw / 5, ty - th * 0.62], [x, ty - th]], snow);
    }
}

export function roundTree(g, R, x, base, h, trunk, leaves) {
    rect(g, x - 2, base - h * 0.45, 4, h * 0.45, trunk);
    const cy = base - h * 0.62;
    const rr = h * 0.33;
    for (let i = 0; i < 9; i++) {
        const a = R() * Math.PI * 2, d = R() * rr * 0.6;
        circle(g, x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, rr * (0.45 + R() * 0.3), leaves[i % leaves.length]);
    }
}

/** Random pixels/dabs for texture: grass, gravel, rot, lichen. */
export function speckle(g, R, x, y, w, h, colors, n, size = 1) {
    for (let i = 0; i < n; i++) {
        g.fillStyle = colors[(R() * colors.length) | 0];
        g.fillRect((x + R() * w) | 0, (y + R() * h) | 0, size, size);
    }
}

export function tufts(g, R, x, y, w, h, colors, n) {
    for (let i = 0; i < n; i++) {
        const tx = (x + R() * w) | 0, ty = (y + R() * h) | 0;
        g.fillStyle = colors[(R() * colors.length) | 0];
        g.fillRect(tx, ty - 2, 1, 2);
        g.fillRect(tx - 1, ty - 1, 1, 1);
        g.fillRect(tx + 1, ty - 1, 1, 1);
    }
}

/** Stone blocks with jittered tone per block. */
export function stones(g, R, x, y, w, h, bw, bh, tones, mortar) {
    rect(g, x, y, w, h, mortar);
    for (let row = 0, yy = y; yy < y + h; row++, yy += bh) {
        const off = (row % 2) * (bw / 2);
        for (let xx = x - off; xx < x + w; xx += bw) {
            const x0 = Math.max(x, xx + 1), x1 = Math.min(x + w, xx + bw);
            const y1 = Math.min(y + h, yy + bh);
            if (x1 - x0 < 1) continue;
            rect(g, x0, yy + 1, x1 - x0, y1 - yy - 1, tones[(R() * tones.length) | 0]);
        }
    }
}

export function planks(g, R, x, y, w, h, pw, tones, gap, horizontal = false) {
    rect(g, x, y, w, h, gap);
    if (horizontal) {
        for (let yy = y; yy < y + h; yy += pw) rect(g, x, yy, w, Math.min(pw - 1, y + h - yy), tones[(R() * tones.length) | 0]);
    } else {
        for (let xx = x; xx < x + w; xx += pw) rect(g, xx, y, Math.min(pw - 1, x + w - xx), h, tones[(R() * tones.length) | 0]);
    }
}

/** Horizontal ripple streaks for water. */
export function ripples(g, R, x, y, w, h, colors, n) {
    for (let i = 0; i < n; i++) {
        const rx = x + R() * w, ry = y + R() * h;
        g.fillStyle = colors[(R() * colors.length) | 0];
        g.fillRect(rx | 0, ry | 0, 2 + (R() * 8) | 0, 1);
    }
}

/** Soft vertical shadow falloff, e.g. under an overhang. */
export function shade(g, x, y, w, h, color = '#0d0b14', a0 = 0.6, a1 = 0) {
    grad(g, x, y, w, h, [[0, hexA(color, a0)], [1, hexA(color, a1)]]);
}

/** Paint in a different composite mode, then restore. */
export function withAlpha(g, a, fn) {
    const prev = g.globalAlpha;
    g.globalAlpha = a;
    fn();
    g.globalAlpha = prev;
}

/**
 * A single craggy peak: jagged flanks, a shadowed side and a snowcap with a
 * ragged lower edge. Returns the peak's [x, y] so a tower can sit on it.
 */
export function mountain(g, R, cx, peakY, halfW, baseY, color, shadeColor, snow, snowShade) {
    const jag = (x0, y0, x1, y1, n, amp) => {
        const pts = [];
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            const e = i === 0 || i === n ? 0 : (R() - 0.5) * amp;
            pts.push([x0 + (x1 - x0) * t + e * 0.4, y0 + (y1 - y0) * t + e]);
        }
        return pts;
    };
    const left = jag(cx - halfW, baseY, cx, peakY, 14, 7);
    const right = jag(cx, peakY, cx + halfW, baseY, 14, 7);
    poly(g, [...left, ...right.slice(1)], color);
    // shadow side: from the peak down a ragged ridge line to the right base
    const spine = jag(cx, peakY, cx + halfW * 0.18, baseY, 10, 5);
    poly(g, [...spine, ...right.slice(1).reverse()].concat([[cx, peakY]]), shadeColor);
    // snowcap
    const capH = (baseY - peakY) * 0.3;
    // Contiguous runs from the peak outward (the flanks are jagged, so a plain
    // filter would pick up stray points further down and grow snow "wings").
    const lim = peakY + capH;
    const lEdge = [];
    for (let i = left.length - 1; i >= 0 && left[i][1] <= lim; i--) lEdge.unshift(left[i]);
    const rEdge = [];
    for (let i = 0; i < right.length && right[i][1] <= lim; i++) rEdge.push(right[i]);
    const lx = lEdge.length ? lEdge[0] : [cx - 6, peakY + capH];
    const rx = rEdge.length ? rEdge[rEdge.length - 1] : [cx + 6, peakY + capH];
    // Ragged lower edge; the raggedness tapers to nothing at the flanks so the
    // cap meets the mountainside cleanly.
    const bottom = [];
    const n = 9;
    for (let i = n; i >= 0; i--) {
        const t = i / n;
        const up = Math.sin(Math.PI * t) * capH * (0.15 + R() * 0.4) * (i % 2 ? 1 : 0.4);
        bottom.push([lx[0] + (rx[0] - lx[0]) * t, lx[1] + (rx[1] - lx[1]) * t - up]);
    }
    poly(g, [...lEdge, ...rEdge, ...bottom], snow);
    const sSpine = [];
    for (let i = 0; i < spine.length && spine[i][1] <= lim; i++) sSpine.push(spine[i]);
    if (sSpine.length > 1) poly(g, [...sSpine, ...rEdge.slice().reverse()], snowShade);
    return [cx, peakY];
}
