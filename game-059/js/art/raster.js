/**
 * raster.js — a tiny palette-index rasterizer for procedural pixel art.
 *
 * Every shape is filled per pixel centre with no antialiasing, so the output is
 * real pixel art: each pixel holds one palette index, never a blend. Shapes
 * know three things about a pixel inside them, all from one distance test:
 *
 *   ring   — the 1 px band just outside the shape: written as the outline
 *            colour, unless the pixel already belongs to the same group (so the
 *            upper arm and forearm don't get a line across the elbow, but a
 *            front limb does get one where it crosses the torso).
 *   body   — inside: dark tone,
 *   mid    — inside a copy shifted toward the light and shrunk: mid tone,
 *   light  — a smaller, further shifted copy: highlight.
 *
 * Index 0 is transparent and index 1 the outline; material m owns indices
 * 2+3m (dark), 3+3m (mid) and 4+3m (light).
 */

export const OUTLINE = 1;
export const matBase = (m) => 2 + m * 3;

// Light falls from the upper front (sprites face +x; buffer y points down).
const LX = 0.42, LY = -0.91;

export class IndexBuffer {
    constructor(w, h) {
        this.w = w; this.h = h;
        this.idx = new Uint8Array(w * h);
        this.grp = new Uint8Array(w * h);
    }
    clear() { this.idx.fill(0); this.grp.fill(0); }
}

function tone(mode, m, inMid, inLight, dither) {
    const b = matBase(m);
    switch (mode) {
        case 'flat': return b + 1;
        case 'dark': return b;
        case 'light': return b + 2;
        case 'back': return inMid ? b + 1 : b;
        case 'glow': return inMid ? b + 2 : b + 1;
        default:
            if (inLight) return b + 2;
            if (inMid || dither) return b + 1;
            return b;
    }
}

/**
 * Tapered capsule from (ax,ay) radius r1 to (bx,by) radius r2, buffer space.
 * opts: { mode, ring (default true), group }
 */
export function capsule(buf, ax, ay, bx, by, r1, r2, m, opts = {}) {
    const mode = opts.mode || 'cel';
    const ring = opts.ring !== false;
    const group = opts.group || 0;
    const rmax = Math.max(r1, r2);
    const pad = rmax + (ring ? 1.2 : 0.2);
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - pad));
    const x1 = Math.min(buf.w - 1, Math.ceil(Math.max(ax, bx) + pad));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - pad));
    const y1 = Math.min(buf.h - 1, Math.ceil(Math.max(ay, by) + pad));
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-6;
    const shade = rmax >= 1.7;
    const ditherOk = rmax >= 4;
    const { idx, grp, w } = buf;
    for (let py = y0; py <= y1; py++) {
        const cy = py + 0.5;
        for (let px = x0; px <= x1; px++) {
            const cx = px + 0.5;
            let t = ((cx - ax) * dx + (cy - ay) * dy) / len2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = ax + dx * t, qy = ay + dy * t;
            const r = r1 + (r2 - r1) * t;
            const ddx = cx - qx, ddy = cy - qy;
            const d = Math.sqrt(ddx * ddx + ddy * ddy);
            const i = py * w + px;
            if (d <= r) {
                let inMid = false, inLight = false, dither = false;
                if (shade) {
                    const mx = ddx - LX * r * 0.32, my = ddy - LY * r * 0.32;
                    const dm = Math.sqrt(mx * mx + my * my);
                    const rm = r * 0.74;
                    inMid = dm <= rm;
                    if (!inMid && ditherOk && dm <= rm + 0.9 && ((px + py) & 1) === 0) dither = true;
                    if (r >= 2.2) {
                        const lx = ddx - LX * r * 0.6, ly = ddy - LY * r * 0.6;
                        inLight = Math.sqrt(lx * lx + ly * ly) <= r * 0.3;
                    }
                } else inMid = true;
                idx[i] = tone(mode, m, inMid, inLight, dither);
                grp[i] = group;
            } else if (ring && d <= r + 1) {
                if (idx[i] === 0 || grp[i] !== group) { idx[i] = OUTLINE; grp[i] = group; }
            }
        }
    }
}

/** Rotated ellipse centred at (cx,cy), radii rx, ry, rotation rot (radians). */
export function ellipse(buf, ecx, ecy, rx, ry, rot, m, opts = {}) {
    const mode = opts.mode || 'cel';
    const ring = opts.ring !== false;
    const group = opts.group || 0;
    const rmax = Math.max(rx, ry), rmin = Math.max(0.5, Math.min(rx, ry));
    const pad = rmax + (ring ? 1.2 : 0.2);
    const x0 = Math.max(0, Math.floor(ecx - pad)), x1 = Math.min(buf.w - 1, Math.ceil(ecx + pad));
    const y0 = Math.max(0, Math.floor(ecy - pad)), y1 = Math.min(buf.h - 1, Math.ceil(ecy + pad));
    const c = Math.cos(rot), s = Math.sin(rot);
    const shade = rmin >= 1.7;
    const ditherOk = rmin >= 4;
    // light offset in the ellipse's local frame
    const llx = LX * c + LY * s, lly = -LX * s + LY * c;
    const { idx, grp, w } = buf;
    for (let py = y0; py <= y1; py++) {
        const cy = py + 0.5 - ecy;
        for (let px = x0; px <= x1; px++) {
            const cx = px + 0.5 - ecx;
            const lx = cx * c + cy * s, ly = -cx * s + cy * c;
            const e = Math.sqrt((lx / rx) ** 2 + (ly / ry) ** 2);
            const i = py * w + px;
            if (e <= 1) {
                let inMid = false, inLight = false, dither = false;
                if (shade) {
                    const mx = (lx - llx * rx * 0.3) / (rx * 0.76), my = (ly - lly * ry * 0.3) / (ry * 0.76);
                    const em = Math.sqrt(mx * mx + my * my);
                    inMid = em <= 1;
                    if (!inMid && ditherOk && em <= 1 + 0.9 / rmin && ((px + py) & 1) === 0) dither = true;
                    if (rmin >= 2.2) {
                        const hx = (lx - llx * rx * 0.58) / (rx * 0.3), hy = (ly - lly * ry * 0.58) / (ry * 0.3);
                        inLight = hx * hx + hy * hy <= 1;
                    }
                } else inMid = true;
                idx[i] = tone(mode, m, inMid, inLight, dither);
                grp[i] = group;
            } else if (ring && e <= 1 + 1 / rmin) {
                if (idx[i] === 0 || grp[i] !== group) { idx[i] = OUTLINE; grp[i] = group; }
            }
        }
    }
}

function insidePoly(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

function distToPoly(pts, x, y) {
    let best = 1e9;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const ax = pts[j][0], ay = pts[j][1], bx = pts[i][0], by = pts[i][1];
        const dx = bx - ax, dy = by - ay;
        const l2 = dx * dx + dy * dy || 1e-6;
        let t = ((x - ax) * dx + (y - ay) * dy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x - (ax + dx * t), ey = y - (ay + dy * t);
        const d = ex * ex + ey * ey;
        if (d < best) best = d;
    }
    return Math.sqrt(best);
}

/** Polygon in buffer space. Shaded by shrinking toward its centroid. */
export function polygon(buf, pts, m, opts = {}) {
    const mode = opts.mode || 'cel';
    const ring = opts.ring !== false;
    const group = opts.group || 0;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, gx = 0, gy = 0;
    for (const [x, y] of pts) {
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
        gx += x; gy += y;
    }
    gx /= pts.length; gy /= pts.length;
    const size = Math.min(maxx - minx, maxy - miny);
    const shade = size >= 3.4;
    const mk = (k, off) => pts.map(([x, y]) => [gx + (x - gx) * k + LX * off, gy + (y - gy) * k + LY * off]);
    const midP = shade ? mk(0.78, size * 0.12) : null;
    const lightP = shade && size >= 5 ? mk(0.36, size * 0.26) : null;
    const pad = ring ? 1.2 : 0.2;
    const x0 = Math.max(0, Math.floor(minx - pad)), x1 = Math.min(buf.w - 1, Math.ceil(maxx + pad));
    const y0 = Math.max(0, Math.floor(miny - pad)), y1 = Math.min(buf.h - 1, Math.ceil(maxy + pad));
    const { idx, grp, w } = buf;
    for (let py = y0; py <= y1; py++) {
        const cy = py + 0.5;
        for (let px = x0; px <= x1; px++) {
            const cx = px + 0.5;
            const i = py * w + px;
            if (insidePoly(pts, cx, cy)) {
                const inMid = shade ? insidePoly(midP, cx, cy) : true;
                const inLight = lightP ? insidePoly(lightP, cx, cy) : false;
                idx[i] = tone(mode, m, inMid, inLight, false);
                grp[i] = group;
            } else if (ring && distToPoly(pts, cx, cy) <= 1) {
                if (idx[i] === 0 || grp[i] !== group) { idx[i] = OUTLINE; grp[i] = group; }
            }
        }
    }
}

/** Single pixel / small rect of one exact palette index (eyes, rivets, sparks). */
export function dot(buf, x, y, index, size = 1) {
    const x0 = Math.floor(x - (size - 1) / 2), y0 = Math.floor(y - (size - 1) / 2);
    for (let yy = y0; yy < y0 + size; yy++) for (let xx = x0; xx < x0 + size; xx++) {
        if (xx < 0 || yy < 0 || xx >= buf.w || yy >= buf.h) continue;
        buf.idx[yy * buf.w + xx] = index;
    }
}

/** Close the silhouette: any empty pixel touching a filled one becomes outline. */
export function closeOutline(buf) {
    const { idx, w, h } = buf;
    const out = new Uint8Array(idx.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (idx[i] !== 0) continue;
        if ((x > 0 && idx[i - 1] > 1) || (x < w - 1 && idx[i + 1] > 1) ||
            (y > 0 && idx[i - w] > 1) || (y < h - 1 && idx[i + w] > 1)) out[i] = 1;
    }
    for (let i = 0; i < idx.length; i++) if (out[i]) idx[i] = OUTLINE;
}
