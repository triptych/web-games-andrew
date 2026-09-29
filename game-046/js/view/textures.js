/**
 * textures.js — every texture in the game, painted at runtime on canvases.
 *
 *   floorTexture(biome, seed)  4×4 tiles of floor in one 512² canvas (+ bump map)
 *   wallTexture(biome)         block masonry for the room walls
 *   rockTexture(color, seed)   mottled stone for obstacles
 *   glowTexture()              soft radial sprite for particles and glows
 *
 * The floor painter is one routine driven by a recipe (biomes.js): a
 * two-tone checker so the grid reads, grout lines with bevels (flagstones),
 * cracks (optionally glowing), grass blades, specks, splotches, moss and
 * runes, all over a value-noise grain. Results are cached per biome+seed.
 */

import * as THREE from 'three';
import { makeRng } from '../sim/rng.js';

const cache = new Map();

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
function mix(a, b, t) {
    const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255;
    const br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
const shade = (c, k) => (k >= 0 ? mix(c, 0xffffff, k) : mix(c, 0x000000, -k));

/** Tileable value noise on a 2D lattice of `period` cells. */
function makeNoise(rng, period) {
    const g = new Float32Array(period * period);
    for (let i = 0; i < g.length; i++) g[i] = rng.next();
    const at = (x, y) => g[((y % period + period) % period) * period + ((x % period + period) % period)];
    return (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = x - xi, yf = y - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
}

function grain(ctx, S, rng, amount, scale = 16) {
    const n1 = makeNoise(rng, scale), n2 = makeNoise(rng, scale * 4);
    const img = ctx.getImageData(0, 0, S, S);
    const d = img.data;
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const v = (n1(x / S * scale, y / S * scale) * 0.65 + n2(x / S * scale * 4, y / S * scale * 4) * 0.35 - 0.5) * amount;
            const i = (y * S + x) * 4;
            d[i] = Math.max(0, Math.min(255, d[i] * (1 + v)));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * (1 + v)));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * (1 + v)));
        }
    }
    ctx.putImageData(img, 0, 0);
}

function canvas(S) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return c;
}

function crack(ctx, rng, x, y, len, w) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    let a = rng.range(0, Math.PI * 2);
    for (let i = 0; i < len; i++) {
        a += rng.range(-0.7, 0.7);
        x += Math.cos(a) * rng.range(4, 10);
        y += Math.sin(a) * rng.range(4, 10);
        ctx.lineTo(x, y);
        if (rng.chance(0.15)) crack(ctx, rng, x, y, Math.floor(len / 3), w * 0.6);
    }
    ctx.stroke();
}

function toTexture(c, repeat = true) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
}

/** Luminance copy of a canvas, for bump maps. */
function lumaTexture(src, invertGrout = false) {
    const S = src.width;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        let l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
        if (invertGrout) l = 255 - l;
        d[i] = d[i + 1] = d[i + 2] = l;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

// ------------------------------------------------------------------ Floor

export function floorTexture(biomeId, b, seed) {
    const key = `floor:${biomeId}:${seed}`;
    if (cache.has(key)) return cache.get(key);
    const f = b.floor;
    const S = 512, CELL = S / 4;
    const rng = makeRng(seed * 31 + 7);
    const c = canvas(S), ctx = c.getContext('2d');

    // Checker base, each tile a touch different.
    for (let ty = 0; ty < 4; ty++) {
        for (let tx = 0; tx < 4; tx++) {
            const alt = (tx + ty) % 2 === 1;
            let col = alt ? f.alt : f.base;
            col = shade(col, rng.range(-f.checker, f.checker));
            ctx.fillStyle = hex(col);
            ctx.fillRect(tx * CELL, ty * CELL, CELL, CELL);
        }
    }
    // Soft splotches (dirt, moss patches, scorch).
    if (f.splotch) {
        for (let i = 0; i < 10; i++) {
            const x = rng.range(0, S), y = rng.range(0, S), r = rng.range(20, 60);
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, hex(f.splotch) + '66');
            g.addColorStop(1, hex(f.splotch) + '00');
            ctx.fillStyle = g;
            for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
                ctx.save(); ctx.translate(ox, oy); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
            }
        }
    }
    // Flagstones: split each tile into 1–3 stones with grout and a bevel.
    if (f.grout !== undefined) {
        for (let ty = 0; ty < 4; ty++) {
            for (let tx = 0; tx < 4; tx++) {
                const x0 = tx * CELL, y0 = ty * CELL;
                const stones = [];
                const split = rng.next();
                if (split < 0.45) stones.push([x0, y0, CELL, CELL]);
                else if (split < 0.75) { const s = CELL * rng.range(0.35, 0.65); stones.push([x0, y0, s, CELL], [x0 + s, y0, CELL - s, CELL]); }
                else { const s = CELL * rng.range(0.35, 0.65); stones.push([x0, y0, CELL, s], [x0, y0 + s, CELL, CELL - s]); }
                for (const [x, y, w, h] of stones) {
                    const gw = f.groutW;
                    ctx.strokeStyle = hex(f.grout);
                    ctx.lineWidth = gw;
                    ctx.strokeRect(x + gw / 2, y + gw / 2, w - gw, h - gw);
                    if (f.bevel) {
                        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
                        ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.moveTo(x + gw, y + h - gw); ctx.lineTo(x + gw, y + gw); ctx.lineTo(x + w - gw, y + gw); ctx.stroke();
                        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
                        ctx.beginPath(); ctx.moveTo(x + w - gw, y + gw); ctx.lineTo(x + w - gw, y + h - gw); ctx.lineTo(x + gw, y + h - gw); ctx.stroke();
                    }
                }
            }
        }
    }
    // Cracks, optionally glowing (forge lava seams, crystal light).
    if (f.cracks) {
        ctx.strokeStyle = hex(f.glowCracks ?? f.crackColor ?? shade(f.base, -0.35));
        ctx.lineCap = 'round';
        if (f.glowCracks) { ctx.shadowColor = hex(f.glowCracks); ctx.shadowBlur = 8; }
        for (let i = 0; i < f.cracks; i++) crack(ctx, rng, rng.range(0, S), rng.range(0, S), rng.int(4, 10), f.glowCracks ? 2.2 : 1.6);
        ctx.shadowBlur = 0;
    }
    // Moss creeping along grout.
    if (f.moss) {
        ctx.fillStyle = hex(f.moss) + '88';
        for (let i = 0; i < 260; i++) {
            const onX = rng.chance(0.5);
            const x = onX ? Math.round(rng.range(0, 4)) * CELL + rng.range(-5, 5) : rng.range(0, S);
            const y = onX ? rng.range(0, S) : Math.round(rng.range(0, 4)) * CELL + rng.range(-5, 5);
            ctx.beginPath(); ctx.arc(x, y, rng.range(1.5, 4), 0, Math.PI * 2); ctx.fill();
        }
    }
    // Grass blades.
    if (f.blades) {
        for (let i = 0; i < 2600; i++) {
            const x = rng.range(0, S), y = rng.range(0, S), h = rng.range(4, 10);
            ctx.strokeStyle = hex(shade(f.blades, rng.range(-0.3, 0.25)));
            ctx.lineWidth = rng.range(1, 2);
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng.range(-3, 3), y - h); ctx.stroke();
        }
    }
    // Specks (pebbles, flowers, sparkles).
    if (f.specks) {
        for (let i = 0; i < (f.speckN ?? 800); i++) {
            ctx.fillStyle = hex(rng.pick(f.specks));
            const r = rng.range(0.8, 2.4);
            ctx.beginPath(); ctx.arc(rng.range(0, S), rng.range(0, S), r, 0, Math.PI * 2); ctx.fill();
        }
    }
    // Runes: faint glyph circles (void).
    if (f.runes) {
        ctx.strokeStyle = hex(f.runes) + '55';
        ctx.shadowColor = hex(f.runes); ctx.shadowBlur = 6;
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const tx = rng.int(0, 3), ty = rng.int(0, 3);
            const cx = tx * CELL + CELL / 2, cy = ty * CELL + CELL / 2, r = CELL * 0.3;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
            for (let k = 0; k < 5; k++) {
                const a = k / 5 * Math.PI * 2 + rng.range(0, 1);
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
            }
        }
        ctx.shadowBlur = 0;
    }
    grain(ctx, S, rng, 0.22);
    // A soft shadow line at every tile edge sells the grid even without grout.
    if (f.grout === undefined) {
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        for (let i = 0; i <= 4; i++) { ctx.fillRect(i * CELL - 1, 0, 2, S); ctx.fillRect(0, i * CELL - 1, S, 2); }
    }
    const out = { map: toTexture(c), bump: lumaTexture(c) };
    cache.set(key, out);
    return out;
}

// ------------------------------------------------------------------ Walls & rocks

export function wallTexture(biomeId, b) {
    const key = `wall:${biomeId}`;
    if (cache.has(key)) return cache.get(key);
    const S = 256;
    const rng = makeRng(biomeId.length * 977);
    const c = canvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = hex(b.wall.mortar);
    ctx.fillRect(0, 0, S, S);
    const rowsN = 4, bh = S / rowsN;
    for (let r = 0; r < rowsN; r++) {
        const off = (r % 2) * 0.5;
        const bw = S / 2;
        for (let k = -1; k < 3; k++) {
            const x = (k + off) * bw + 3, y = r * bh + 3;
            ctx.fillStyle = hex(shade(b.wall.base, rng.range(-0.12, 0.12)));
            ctx.fillRect(x, y, bw - 6, bh - 6);
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(x, y, bw - 6, 4);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(x, y + bh - 10, bw - 6, 4);
        }
    }
    grain(ctx, S, rng, 0.3, 8);
    const out = { map: toTexture(c), bump: lumaTexture(c) };
    cache.set(key, out);
    return out;
}

export function rockTexture(color, seed) {
    const key = `rock:${color}:${seed}`;
    if (cache.has(key)) return cache.get(key);
    const S = 128;
    const rng = makeRng(seed);
    const c = canvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = hex(color);
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
        ctx.fillStyle = hex(shade(color, rng.range(-0.25, 0.2))) + '80';
        ctx.beginPath(); ctx.arc(rng.range(0, S), rng.range(0, S), rng.range(2, 9), 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = hex(shade(color, -0.4)) + 'aa';
    for (let i = 0; i < 4; i++) crack(ctx, rng, rng.range(0, S), rng.range(0, S), 5, 1.2);
    grain(ctx, S, rng, 0.35, 8);
    const out = toTexture(c);
    cache.set(key, out);
    return out;
}

let glow = null;
/** Soft white radial dot for additive sprites. */
export function glowTexture() {
    if (glow) return glow;
    const S = 64;
    const c = canvas(S), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    glow = new THREE.CanvasTexture(c);
    glow.colorSpace = THREE.SRGBColorSpace;
    return glow;
}

let ringTex = null;
/** A crisp ring with a soft inner fill: telegraph circles. */
export function ringTexture() {
    if (ringTex) return ringTex;
    const S = 256;
    const c = canvas(S), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(0.85, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.93, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();
    ringTex = new THREE.CanvasTexture(c);
    ringTex.colorSpace = THREE.SRGBColorSpace;
    return ringTex;
}

export { mix, shade, hex };
