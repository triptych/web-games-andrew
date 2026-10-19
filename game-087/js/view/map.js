// The Cartographer's map: an old parchment chart of an island realm, drawn from the novel's map seed.
// Value-noise heightmap with a coastline from marching squares, inked mountains, hills and forests,
// a compass rose, a cartouche with the book's title, and the apprentice's pins with their names.
//
//   drawMap(ctx, w, h, { seed, title, pins: [{ x, y, label, kind, on }] })   x, y in 0..1

import { hash3 } from '../rng.js';

const GW = 180, GH = 120;

function noise2(seed, x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const s = (t) => t * t * (3 - 2 * t);
    const a = hash3(xi, yi, seed), b = hash3(xi + 1, yi, seed), c = hash3(xi, yi + 1, seed), d = hash3(xi + 1, yi + 1, seed);
    const u = s(fx), v = s(fy);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(seed, x, y, oct = 5) {
    let sum = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { sum += noise2(seed + i * 101, x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
}

/** Elevation and moisture fields for a seed (cached: the map redraws often while pinning). */
const cache = new Map();
export function terrain(seed) {
    if (cache.has(seed)) return cache.get(seed);
    const elev = new Float32Array(GW * GH), wet = new Float32Array(GW * GH);
    const s = seed % 100000;
    // a few land masses: a main continent and isles placed by the seed
    const blobs = [{ x: 0.5 + (hash3(1, 2, s) - 0.5) * 0.2, y: 0.52 + (hash3(3, 4, s) - 0.5) * 0.15, r: 0.42, k: 1 }];
    const isles = 2 + Math.floor(hash3(5, 6, s) * 3);
    for (let i = 0; i < isles; i++) blobs.push({ x: 0.12 + hash3(i, 7, s) * 0.76, y: 0.15 + hash3(i, 8, s) * 0.7, r: 0.1 + hash3(i, 9, s) * 0.12, k: 0.8 });
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        const u = i / GW, v = j / GH;
        let mask = 0;
        for (const b of blobs) {
            const dx = (u - b.x) / 1.15, dy = (v - b.y) * 1.25;
            mask = Math.max(mask, b.k * (1 - Math.hypot(dx, dy) / b.r));
        }
        const n = fbm(s, u * 5.2, v * 3.6);
        const ridge = 1 - Math.abs(fbm(s + 7, u * 3.1, v * 2.4) * 2 - 1);
        let e = mask * 0.9 + (n - 0.5) * 0.85 - 0.08;
        if (e > 0.16) e += ridge ** 3 * 0.3 * Math.min(1, (e - 0.16) * 3);
        // keep a margin of sea at the frame
        const edge = Math.min(u, 1 - u, v, 1 - v);
        if (edge < 0.08) e -= (0.08 - edge) * 6;
        elev[j * GW + i] = e;
        wet[j * GW + i] = fbm(s + 31, u * 6, v * 4.5, 4);
    }
    const t = { elev, wet };
    if (cache.size > 6) cache.delete(cache.keys().next().value);
    cache.set(seed, t);
    return t;
}

const at = (f, i, j) => f[Math.max(0, Math.min(GH - 1, j)) * GW + Math.max(0, Math.min(GW - 1, i))];

/** Contour lines of a field at level lv, as segments in grid units. */
function contour(f, lv) {
    const segs = [];
    for (let j = 0; j < GH - 1; j++) for (let i = 0; i < GW - 1; i++) {
        const a = f[j * GW + i] - lv, b = f[j * GW + i + 1] - lv, c = f[(j + 1) * GW + i + 1] - lv, d = f[(j + 1) * GW + i] - lv;
        const code = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const lerp = (p, q) => p / (p - q);
        const T = [i + lerp(a, b), j], R = [i + 1, j + lerp(b, c)], B = [i + lerp(d, c), j + 1], L = [i, j + lerp(a, d)];
        const add = (p, q) => segs.push(p[0], p[1], q[0], q[1]);
        switch (code) {
            case 1: case 14: add(L, B); break;
            case 2: case 13: add(B, R); break;
            case 3: case 12: add(L, R); break;
            case 4: case 11: add(T, R); break;
            case 5: add(L, T); add(B, R); break;
            case 6: case 9: add(T, B); break;
            case 7: case 8: add(L, T); break;
            case 10: add(T, R); add(L, B); break;
        }
    }
    return segs;
}

const INK = '#4a3622', PAPER = '#efe2bf';

export function drawMap(ctx, w, h, { seed = 1, title = '', pins = [], frame = true } = {}) {
    const { elev, wet } = terrain(seed);
    const sx = w / GW, sy = h / GH;
    // ground colours, at grid resolution, scaled up smooth
    const img = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(GW, GH) : Object.assign(document.createElement('canvas'), { width: GW, height: GH });
    const ic = img.getContext('2d');
    const data = ic.createImageData(GW, GH);
    for (let k = 0; k < GW * GH; k++) {
        const e = elev[k], m = wet[k];
        let r, g, b;
        if (e < 0) { const d = Math.min(1, -e * 3); r = 196 - d * 34; g = 211 - d * 30; b = 202 - d * 22; }
        else if (e < 0.04) { r = 236; g = 222; b = 182; }
        else if (e < 0.3) { const t = e / 0.3; r = 226 - t * 10 - (m > 0.56 ? 18 : 0); g = 214 - t * 14 - (m > 0.56 ? 6 : 0); b = 168 - t * 22 - (m > 0.56 ? 20 : 0); }
        else { const t = Math.min(1, (e - 0.3) / 0.4); r = 208 - t * 26; g = 190 - t * 30; b = 146 - t * 36; }
        const n = (hash3(k, 3, 9) - 0.5) * 8;
        data.data[k * 4] = r + n; data.data[k * 4 + 1] = g + n; data.data[k * 4 + 2] = b + n; data.data[k * 4 + 3] = 255;
    }
    ic.putImageData(data, 0, 0);
    ctx.save();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    const line = (segs, style, width, dash = null) => {
        ctx.beginPath();
        for (let k = 0; k < segs.length; k += 4) { ctx.moveTo(segs[k] * sx, segs[k + 1] * sy); ctx.lineTo(segs[k + 2] * sx, segs[k + 3] * sy); }
        ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.stroke();
    };
    // sea ripples, then the coast
    const u = Math.max(0.6, w / 900);
    line(contour(elev, -0.035), 'rgba(74,54,34,0.28)', 0.9 * u);
    line(contour(elev, -0.08), 'rgba(74,54,34,0.16)', 0.8 * u, [3 * u, 4 * u]);
    line(contour(elev, 0), INK, 1.7 * u);
    ctx.setLineDash([]);

    // mountains, hills and forests, on a jittered lattice so they never stack
    const step = Math.max(9, Math.round(13 * u));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let y = step; y < h - step; y += step * 0.86) {
        for (let x = step; x < w - step; x += step) {
            const jx = x + (hash3(x | 0, y | 0, seed) - 0.5) * step * 0.7, jy = y + (hash3(y | 0, x | 0, seed) - 0.5) * step * 0.6;
            const e = at(elev, Math.round(jx / sx), Math.round(jy / sy)), m = at(wet, Math.round(jx / sx), Math.round(jy / sy));
            if (e > 0.42 && hash3(y | 0, x | 0, seed + 5) < 0.8) {
                const s = step * (0.55 + Math.min(0.5, (e - 0.42) * 1.4));
                ctx.fillStyle = 'rgba(120,96,64,0.35)';
                ctx.beginPath(); ctx.moveTo(jx, jy - s); ctx.lineTo(jx + s * 0.75, jy + s * 0.25); ctx.lineTo(jx, jy + s * 0.25); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = INK; ctx.lineWidth = 1.2 * u;
                ctx.beginPath(); ctx.moveTo(jx - s * 0.8, jy + s * 0.25); ctx.lineTo(jx, jy - s); ctx.lineTo(jx + s * 0.8, jy + s * 0.25); ctx.stroke();
                if (e > 0.55) { ctx.fillStyle = '#f8f1dc'; ctx.beginPath(); ctx.moveTo(jx - s * 0.2, jy - s * 0.62); ctx.lineTo(jx, jy - s); ctx.lineTo(jx + s * 0.22, jy - s * 0.6); ctx.closePath(); ctx.fill(); }
            } else if (e > 0.3 && hash3(x | 0, y | 0, seed + 3) < 0.6) {
                ctx.strokeStyle = 'rgba(74,54,34,0.7)'; ctx.lineWidth = 1 * u;
                ctx.beginPath(); ctx.arc(jx, jy + step * 0.25, step * 0.42, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
            } else if (e > 0.05 && m > 0.55) {
                const r = step * 0.26;
                ctx.fillStyle = 'rgba(96,110,62,0.55)'; ctx.strokeStyle = 'rgba(54,60,30,0.8)'; ctx.lineWidth = 0.9 * u;
                ctx.beginPath(); ctx.arc(jx, jy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(jx, jy + r); ctx.lineTo(jx, jy + r * 1.8); ctx.stroke();
            }
        }
    }

    if (frame) {
        ctx.strokeStyle = INK; ctx.lineWidth = 3 * u; ctx.strokeRect(6 * u, 6 * u, w - 12 * u, h - 12 * u);
        ctx.lineWidth = 1 * u; ctx.strokeRect(12 * u, 12 * u, w - 24 * u, h - 24 * u);
        compass(ctx, w - 70 * u, h - 74 * u, 40 * u);
        if (title) cartouche(ctx, 30 * u, 28 * u, title, u);
    }

    for (const p of pins) {
        const x = p.x * w, y = p.y * h;
        ctx.fillStyle = p.on ? '#b8322c' : '#7a1f1a';
        ctx.strokeStyle = PAPER; ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.arc(x, y, (p.on ? 6.5 : 5) * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(x, y, 1.6 * u, 0, Math.PI * 2); ctx.fill();
        if (p.label) {
            ctx.font = `italic ${Math.round(15 * u)}px 'EB Garamond', Georgia, serif`;
            ctx.textAlign = x > w * 0.75 ? 'right' : 'left';
            ctx.textBaseline = 'middle';
            const tx = x + (x > w * 0.75 ? -10 : 10) * u;
            ctx.lineWidth = 4 * u; ctx.strokeStyle = 'rgba(239,226,191,0.9)'; ctx.strokeText(p.label, tx, y);
            ctx.fillStyle = INK; ctx.fillText(p.label, tx, y);
        }
    }
    ctx.restore();
}

function compass(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4, long = k % 2 === 0, L = long ? r : r * 0.55;
        ctx.fillStyle = k % 2 ? '#8a6a40' : INK;
        ctx.beginPath();
        ctx.moveTo(Math.sin(a) * L, -Math.cos(a) * L);
        ctx.lineTo(Math.sin(a + 0.3) * r * 0.16, -Math.cos(a + 0.3) * r * 0.16);
        ctx.lineTo(Math.sin(a - 0.3) * r * 0.16, -Math.cos(a - 0.3) * r * 0.16);
        ctx.closePath(); ctx.fill();
    }
    ctx.font = `bold ${Math.round(r * 0.36)}px Georgia, serif`;
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('N', 0, -r - 2);
    ctx.restore();
}

function cartouche(ctx, x, y, title, u) {
    ctx.save();
    ctx.font = `italic ${Math.round(22 * u)}px 'EB Garamond', Georgia, serif`;
    const t = title.length > 34 ? title.slice(0, 33) + '…' : title;
    const tw = ctx.measureText(t).width;
    const w = tw + 36 * u, hh = 42 * u;
    ctx.fillStyle = 'rgba(244,234,206,0.94)';
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.moveTo(x + 10 * u, y); ctx.lineTo(x + w - 10 * u, y); ctx.quadraticCurveTo(x + w, y + hh / 2, x + w - 10 * u, y + hh);
    ctx.lineTo(x + 10 * u, y + hh); ctx.quadraticCurveTo(x, y + hh / 2, x + 10 * u, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, x + w / 2, y + hh / 2 + 1);
    ctx.restore();
}

/** Is a map point (0..1) on land? Used to place a new pin somewhere sensible. */
export function onLand(seed, x, y) {
    const { elev } = terrain(seed);
    return at(elev, Math.round(x * GW), Math.round(y * GH)) > 0.02;
}
