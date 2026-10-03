/**
 * textures.js — every surface texture, painted per pixel in code.
 *
 * A painter is a function (u, v, o) that fills o.r/g/b (sRGB 0..1), o.h
 * (height 0..1, used for bump mapping in the world shader) and o.er/eg/eb
 * (emission). Painters are evaluated on a periodic lattice so every texture
 * tiles seamlessly. Output is a pair of DataTextures: RGBA = albedo + height,
 * and RGB emission (shared 1×1 black when a painter emits nothing).
 *
 * DataTexture rather than CanvasTexture: the height lives in alpha, and a
 * canvas would premultiply it into the colour.
 */
import * as THREE from 'three';
import { makeRng } from '../rng.js';

// ------------------------------------------------------------------ noise

function makeNoise(seed) {
    const rng = makeRng(seed);
    const P = 256;
    const tab = new Float32Array(P * P);
    for (let i = 0; i < tab.length; i++) tab[i] = rng();
    /** periodic value noise; period in lattice cells (integer ≤ 256) */
    const n = (x, y, period) => {
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const tx = x - x0, ty = y - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const xa = ((x0 % period) + period) % period, xb = (xa + 1) % period;
        const ya = ((y0 % period) + period) % period, yb = (ya + 1) % period;
        const a = tab[ya * P + xa], b = tab[ya * P + xb], c = tab[yb * P + xa], d = tab[yb * P + xb];
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    const fbm = (u, v, base = 4, oct = 4, gain = 0.5) => {
        let sum = 0, amp = 1, norm = 0, f = base;
        for (let o = 0; o < oct; o++) { sum += n(u * f, v * f, f) * amp; norm += amp; amp *= gain; f *= 2; }
        return sum / norm;
    };
    /** cellular-ish: distance to nearest jittered point, periodic */
    const cells = (u, v, f) => {
        const x = u * f, y = v * f;
        const xi = Math.floor(x), yi = Math.floor(y);
        let d1 = 9, d2 = 9, id = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const cx = xi + dx, cy = yi + dy;
            const wx = ((cx % f) + f) % f, wy = ((cy % f) + f) % f;
            const px = cx + tab[(wy * 7 + 3) % P * P + (wx * 13 + 5) % P];
            const py = cy + tab[(wy * 11 + 1) % P * P + (wx * 3 + 9) % P];
            const d = Math.hypot(px - x, py - y);
            if (d < d1) { d2 = d1; d1 = d; id = wy * f + wx; } else if (d < d2) d2 = d;
        }
        return { d1, d2, id };
    };
    const hash = (a, b = 0) => tab[((a * 31 + b * 17) % P + P) % P * P + ((a * 7 + b * 13) % P + P) % P];
    return { n, fbm, cells, hash };
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/** Distance to the nearest edge of a panel grid; returns {d, ix, iy} in uv units. */
function grid(u, v, cols, rows) {
    const fu = u * cols, fv = v * rows;
    const ix = Math.floor(fu), iy = Math.floor(fv);
    const lu = fu - ix, lv = fv - iy;
    const d = Math.min(lu / cols, (1 - lu) / cols, lv / rows, (1 - lv) / rows);
    return { d, ix, iy, lu, lv };
}

/** Brick bond: rows offset by half on alternating rows. */
function bricks(u, v, cols, rows) {
    const fv = v * rows;
    const iy = Math.floor(fv);
    const off = iy % 2 ? 0.5 : 0;
    const fu = u * cols + off;
    const ix = Math.floor(fu);
    const lu = fu - ix, lv = fv - iy;
    const d = Math.min(lu / cols, (1 - lu) / cols, lv / rows, (1 - lv) / rows);
    return { d, ix: ((ix % cols) + cols) % cols, iy, lu, lv };
}

function setRGB(o, r, g, b) { o.r = r; o.g = g; o.b = b; }

// ------------------------------------------------------------------ painters

const PAINTERS = {
    // ---------------- station ----------------
    techwall(u, v, o, N) {
        const g = grid(u, v, 2, 2);
        const grime = N.fbm(u, v, 4, 5);
        const seam = smooth(0.004, 0.014, g.d);
        const tone = 0.85 + 0.15 * N.hash(g.ix, g.iy);
        let c = 0.36 * tone * (0.8 + 0.4 * grime);
        setRGB(o, c * 0.92, c * 0.98, c * 1.1);
        o.h = 0.25 + 0.5 * seam + 0.1 * grime;
        // inset rectangle on each panel
        const inset = Math.min(g.lu, 1 - g.lu, g.lv, 1 - g.lv);
        if (inset > 0.12 && inset < 0.15) { o.h -= 0.15; o.r *= 0.8; o.g *= 0.8; o.b *= 0.8; }
        // rivets
        for (const [cu, cv] of [[0.07, 0.07], [0.93, 0.07], [0.07, 0.93], [0.93, 0.93]]) {
            const dd = Math.hypot(g.lu - cu, g.lv - cv);
            if (dd < 0.03) { o.h = 0.95 - dd * 8; o.r = o.g = o.b = 0.55 - dd * 4; }
        }
        // indicator strip
        if (v > 0.47 && v < 0.53) {
            setRGB(o, 0.12, 0.13, 0.15); o.h = 0.15;
            const k = Math.floor(u * 16);
            if (Math.abs(v - 0.5) < 0.012 && (u * 16 - k) > 0.3 && (u * 16 - k) < 0.7 && N.hash(k, 3) > 0.55) {
                const amber = N.hash(k, 9) > 0.6;
                o.er = amber ? 1.0 : 0.2; o.eg = amber ? 0.6 : 0.85; o.eb = amber ? 0.1 : 1.0;
                setRGB(o, o.er * 0.6, o.eg * 0.6, o.eb * 0.6);
            }
        }
        // streaks
        const streak = N.fbm(u * 8, v * 0.5, 4, 3);
        const k2 = 1 - 0.25 * smooth(0.55, 0.8, streak) * v;
        o.r *= k2; o.g *= k2; o.b *= k2;
        o.seam = seam;
    },
    techwall2(u, v, o, N) {
        // vertical ribs with a hazard band at the bottom
        const rib = Math.abs(((u * 8) % 1) - 0.5);
        const grime = N.fbm(u, v, 4, 5);
        let c = 0.3 + 0.12 * smooth(0.5, 0.15, rib);
        c *= 0.8 + 0.35 * grime;
        setRGB(o, c * 0.95, c, c * 1.05);
        o.h = 0.3 + 0.55 * smooth(0.5, 0.1, rib);
        if (v > 0.84) {
            const stripe = ((u + v) * 6) % 1 < 0.5;
            const wear = N.fbm(u * 3, v * 3, 8, 3);
            if (stripe) setRGB(o, 0.85 * wear + 0.1, 0.65 * wear + 0.05, 0.05);
            else setRGB(o, 0.06, 0.06, 0.06);
            o.h = 0.55;
        }
        if (v > 0.82 && v < 0.84) { setRGB(o, 0.2, 0.2, 0.22); o.h = 0.9; }
        if (v < 0.04) { setRGB(o, 0.2, 0.21, 0.24); o.h = 0.8; }
    },
    techpillar(u, v, o, N) {
        const g = grid(u, v, 1, 4);
        const c = 0.3 + 0.1 * N.fbm(u, v, 4, 4);
        setRGB(o, c, c * 1.02, c * 1.1);
        o.h = 0.3 + 0.6 * smooth(0.0, 0.03, g.d);
        if (Math.abs(u - 0.5) < 0.04) { setRGB(o, 0.1, 0.5, 0.7); o.er = 0.15; o.eg = 0.7; o.eb = 1.0; o.h = 0.2; }
    },
    grate(u, v, o, N) {
        // diamond tread plate
        const a = ((u + v) * 12) % 1, b = ((u - v + 4) * 12) % 1;
        const diamond = Math.abs(a - 0.5) < 0.12 && Math.abs(b - 0.5) < 0.38 ? 1 : 0;
        const g = grid(u, v, 2, 2);
        const grime = N.fbm(u, v, 4, 5);
        let c = (0.3 + 0.08 * diamond) * (0.75 + 0.45 * grime);
        setRGB(o, c * 0.95, c * 0.97, c);
        o.h = 0.4 + 0.3 * diamond;
        const seam = smooth(0.003, 0.01, g.d);
        o.r *= 0.5 + 0.5 * seam; o.g *= 0.5 + 0.5 * seam; o.b *= 0.5 + 0.5 * seam;
        o.h *= seam;
    },
    tile(u, v, o, N) {
        const g = grid(u, v, 4, 4);
        const grime = N.fbm(u, v, 4, 5);
        const tone = 0.85 + 0.2 * N.hash(g.ix + 7, g.iy + 3);
        const c = 0.42 * tone * (0.75 + 0.35 * grime);
        setRGB(o, c * 0.9, c * 0.95, c);
        const seam = smooth(0.002, 0.008, g.d);
        o.h = 0.2 + 0.6 * seam;
        if (seam < 1) { const k = 0.4 + 0.6 * seam; o.r *= k; o.g *= k; o.b *= k; }
    },
    ceilpanel(u, v, o, N) {
        const g = grid(u, v, 2, 2);
        const c = 0.22 + 0.06 * N.fbm(u, v, 4, 3);
        setRGB(o, c, c, c * 1.08);
        o.h = 0.3 + 0.5 * smooth(0.005, 0.02, g.d);
        // a light strip in alternate panels
        if (g.ix === 0 && g.iy === 0 && g.lu > 0.2 && g.lu < 0.8 && g.lv > 0.42 && g.lv < 0.58) {
            setRGB(o, 0.9, 0.95, 1.0); o.er = 0.9; o.eg = 0.95; o.eb = 1.0; o.h = 0.6;
        }
    },
    corridorwall(u, v, o, N) {
        // pipes running horizontally over dark panels
        const grime = N.fbm(u, v, 4, 5);
        let c = 0.2 * (0.8 + 0.4 * grime);
        setRGB(o, c, c * 1.02, c * 1.08);
        o.h = 0.25;
        const pipes = [[0.18, 0.05, [0.45, 0.32, 0.2]], [0.3, 0.035, [0.3, 0.33, 0.38]], [0.72, 0.06, [0.36, 0.38, 0.42]]];
        for (const [pv, pr, col] of pipes) {
            const d = Math.abs(v - pv);
            if (d < pr) {
                const t = Math.sqrt(1 - (d / pr) ** 2);
                setRGB(o, col[0] * (0.5 + 0.6 * t), col[1] * (0.5 + 0.6 * t), col[2] * (0.5 + 0.6 * t));
                o.h = 0.4 + 0.6 * t;
                if (Math.abs(((u * 4) % 1) - 0.5) < 0.03) { o.h = 1; o.r *= 1.2; o.g *= 1.2; o.b *= 1.2; }
            }
        }
        if (v > 0.9) { setRGB(o, 0.12, 0.12, 0.13); o.h = 0.6; }
    },
    crate(u, v, o, N) {
        const g = grid(u, v, 1, 1);
        const grime = N.fbm(u, v, 4, 4);
        const c = 0.35 * (0.8 + 0.3 * grime);
        setRGB(o, c * 0.75, c * 0.82, c * 0.6);
        o.h = 0.45;
        const frame = g.d < 0.08;
        const diag = Math.abs(u - v) < 0.05 || Math.abs(u + v - 1) < 0.05;
        if (frame || diag) { setRGB(o, c * 0.55, c * 0.6, c * 0.5); o.h = 0.8; }
        if (g.d < 0.01) o.h = 0.2;
        if (!frame && Math.abs(v - 0.5) < 0.06 && Math.abs(u - 0.5) < 0.25 && !diag) { setRGB(o, 0.75, 0.6, 0.1); o.h = 0.5; }
    },
    step(u, v, o, N) {
        // edge trim with hazard chevrons
        const stripe = ((u * 4 + v * 2) % 1) < 0.5;
        const wear = 0.6 + 0.4 * N.fbm(u, v, 8, 3);
        if (stripe) setRGB(o, 0.85 * wear, 0.62 * wear, 0.06); else setRGB(o, 0.07, 0.07, 0.07);
        o.h = 0.5;
        if (v < 0.06 || (v > 0.47 && v < 0.53)) { setRGB(o, 0.3, 0.3, 0.32); o.h = 0.85; }
    },
    door_station(u, v, o, N) {
        const g = grid(u, v, 1, 1);
        const c = 0.33 + 0.08 * N.fbm(u, v, 4, 4);
        setRGB(o, c * 0.9, c * 0.95, c * 1.05);
        o.h = 0.4 + 0.4 * smooth(0, 0.04, g.d);
        // central split and chevrons
        if (Math.abs(u - 0.5) < 0.01) { setRGB(o, 0.05, 0.05, 0.05); o.h = 0.05; }
        if (v > 0.3 && v < 0.42) {
            const chev = ((Math.abs(u - 0.5) * 6 + v * 6) % 1) < 0.5;
            if (chev) setRGB(o, 0.85, 0.6, 0.05); else setRGB(o, 0.08, 0.08, 0.08);
            o.h = 0.55;
        }
        if (v > 0.6 && v < 0.64) { o.er = 0.2; o.eg = 0.8; o.eb = 1.0; setRGB(o, 0.2, 0.6, 0.8); }
    },
    exit_station(u, v, o, N) {
        PAINTERS.techwall2(u, v, o, N);
        // big red EXIT sign at the top, a switch plate below
        if (u > 0.2 && u < 0.8 && v > 0.12 && v < 0.3) {
            setRGB(o, 0.15, 0.02, 0.02); o.h = 0.3;
            if (glyphs('EXIT', (u - 0.22) / 0.56, (v - 0.14) / 0.14)) { o.er = 1.0; o.eg = 0.15; o.eb = 0.1; setRGB(o, 1, 0.2, 0.15); }
        }
        if (u > 0.36 && u < 0.64 && v > 0.42 && v < 0.72) {
            setRGB(o, 0.25, 0.26, 0.28); o.h = 0.7;
            if (u > 0.44 && u < 0.56 && v > 0.48 && v < 0.66) { setRGB(o, 0.5, 0.1, 0.1); o.h = 0.95; o.er = 0.6; o.eg = 0.05; o.eb = 0.03; }
        }
    },
    terminal(u, v, o, N) {
        PAINTERS.techwall(u, v, o, N);
        if (u > 0.18 && u < 0.82 && v > 0.22 && v < 0.62) {
            setRGB(o, 0.05, 0.07, 0.08); o.h = 0.6;
            if (u > 0.22 && u < 0.78 && v > 0.26 && v < 0.58) {
                const line = Math.floor((v - 0.26) * 40);
                const lit = N.hash(line, Math.floor(u * 30)) > 0.35 && ((v - 0.26) * 40 % 1) < 0.55 && (u - 0.22) < 0.2 + 0.36 * N.hash(line, 2);
                const scan = 0.6 + 0.4 * Math.sin(v * 400);
                setRGB(o, 0.02, 0.12, 0.08);
                o.er = 0.05; o.eg = 0.35 * scan; o.eb = 0.2 * scan;
                if (lit) { o.er = 0.25; o.eg = 1.0; o.eb = 0.55; }
                o.h = 0.4;
            }
        }
        if (u > 0.3 && u < 0.7 && v > 0.66 && v < 0.74) { setRGB(o, 0.15, 0.15, 0.17); o.h = 0.8; }
    },
    acid(u, v, o, N) {
        const n1 = N.fbm(u, v, 4, 5);
        const c = N.cells(u, v, 8);
        const rim = smooth(0.0, 0.25, c.d2 - c.d1);
        setRGB(o, 0.15 + 0.3 * n1, 0.55 + 0.4 * n1, 0.1);
        o.h = n1;
        o.er = 0.2 * n1; o.eg = 0.75 * (0.5 + 0.5 * n1) * (0.6 + 0.4 * (1 - rim)); o.eb = 0.05;
    },

    // ---------------- foundry ----------------
    rustplate(u, v, o, N) {
        const g = grid(u, v, 2, 1);
        const rust = N.fbm(u, v, 4, 6);
        const spots = smooth(0.5, 0.75, N.fbm(u + 3.1, v + 1.7, 8, 4));
        let r = mix(0.35, 0.5, rust), gg = mix(0.28, 0.24, rust), b = mix(0.24, 0.12, rust);
        r = mix(r, 0.42, spots); gg = mix(gg, 0.18, spots); b = mix(b, 0.08, spots);
        setRGB(o, r, gg, b);
        o.h = 0.35 + 0.4 * smooth(0.004, 0.02, g.d) - 0.2 * spots;
        // rivet rows along the seams
        const rv = Math.abs(((u * 16) % 1) - 0.5) < 0.18;
        if (rv && (Math.abs(g.lv - 0.05) < 0.025 || Math.abs(g.lv - 0.95) < 0.025)) { o.h = 0.95; setRGB(o, r * 1.2, gg * 1.2, b * 1.1); }
        // horizontal weld band
        if (Math.abs(v - 0.5) < 0.015) { setRGB(o, 0.2, 0.16, 0.13); o.h = 0.7; }
    },
    rock(u, v, o, N) {
        const c = N.cells(u, v, 5);
        const n1 = N.fbm(u, v, 4, 6);
        const crack = smooth(0.05, 0.0, c.d2 - c.d1);
        const base = 0.22 + 0.2 * n1;
        setRGB(o, base * 1.15, base * 0.95, base * 0.8);
        o.h = 0.25 + 0.6 * smooth(0, 0.4, c.d2 - c.d1) + 0.15 * n1;
        if (crack > 0) { const k = 1 - crack * 0.8; o.r *= k; o.g *= k; o.b *= k; }
    },
    rockglow(u, v, o, N) {
        PAINTERS.rock(u, v, o, N);
        const c = N.cells(u, v, 5);
        const crack = smooth(0.035, 0.0, c.d2 - c.d1);
        const heat = smooth(0.4, 0.8, N.fbm(u + 0.3, v + 0.9, 3, 3));
        if (crack * heat > 0.05) { const k = crack * heat; o.er = 1.0 * k; o.eg = 0.35 * k; o.eb = 0.05 * k; o.r += k * 0.5; o.g += k * 0.15; }
    },
    girder(u, v, o, N) {
        const n1 = N.fbm(u, v, 4, 4);
        const flange = u < 0.12 || u > 0.88;
        let c = 0.3 + 0.15 * n1;
        setRGB(o, c * 1.2, c * 0.75, c * 0.5);
        o.h = flange ? 0.9 : 0.4;
        // X bracing in the web
        const lv = (v * 2) % 1;
        if (!flange && (Math.abs(u - (0.12 + lv * 0.76)) < 0.04 || Math.abs(u - (0.88 - lv * 0.76)) < 0.04)) { o.h = 0.75; setRGB(o, c * 1.3, c * 0.8, c * 0.5); }
        if (flange && Math.abs(((v * 8) % 1) - 0.5) < 0.12 && Math.abs(((u < 0.5 ? u / 0.12 : (1 - u) / 0.12)) - 0.5) < 0.25) { o.h = 1; }
    },
    brick(u, v, o, N) {
        const b = bricks(u, v, 4, 8);
        const n1 = N.fbm(u, v, 4, 5);
        const tone = 0.75 + 0.35 * N.hash(b.ix + 11, b.iy);
        const mortar = smooth(0.003, 0.009, b.d);
        setRGB(o, (0.42 * tone) * (0.8 + 0.3 * n1), (0.22 * tone) * (0.8 + 0.3 * n1), (0.15 * tone));
        if (mortar < 1) { o.r = mix(0.12, o.r, mortar); o.g = mix(0.1, o.g, mortar); o.b = mix(0.08, o.b, mortar); }
        o.h = 0.2 + 0.6 * mortar + 0.1 * n1;
        const soot = smooth(0.55, 0.85, N.fbm(u + 5, v + 2, 4, 4));
        o.r *= 1 - soot * 0.5; o.g *= 1 - soot * 0.5; o.b *= 1 - soot * 0.5;
    },
    metalcrate(u, v, o, N) {
        PAINTERS.crate(u, v, o, N);
        const k = 0.9 + 0.2 * N.fbm(u, v, 4, 4);
        o.r = o.r * 1.3 * k; o.g = o.g * 0.8 * k; o.b *= 0.6 * k;
    },
    step_rust(u, v, o, N) {
        PAINTERS.step(u, v, o, N);
        const rust = smooth(0.4, 0.8, N.fbm(u, v, 6, 4));
        o.r = mix(o.r, 0.4, rust * 0.6); o.g = mix(o.g, 0.18, rust * 0.6); o.b = mix(o.b, 0.08, rust * 0.6);
    },
    door_rust(u, v, o, N) {
        PAINTERS.rustplate(u, v, o, N);
        const g = grid(u, v, 1, 1);
        if (g.d < 0.05) { o.h = 0.9; o.r *= 0.7; o.g *= 0.7; o.b *= 0.7; }
        if (Math.abs(v - 0.5) < 0.06) {
            const chev = ((u * 5 + v * 5) % 1) < 0.5;
            if (chev) setRGB(o, 0.75, 0.5, 0.05); else setRGB(o, 0.08, 0.06, 0.05);
            o.h = 0.6;
        }
    },
    exit_foundry(u, v, o, N) {
        PAINTERS.rustplate(u, v, o, N);
        if (u > 0.2 && u < 0.8 && v > 0.12 && v < 0.3) {
            setRGB(o, 0.12, 0.04, 0.02); o.h = 0.3;
            if (glyphs('EXIT', (u - 0.22) / 0.56, (v - 0.14) / 0.14)) { o.er = 1.0; o.eg = 0.4; o.eb = 0.05; setRGB(o, 1, 0.5, 0.1); }
        }
        if (u > 0.36 && u < 0.64 && v > 0.42 && v < 0.72) {
            setRGB(o, 0.22, 0.2, 0.18); o.h = 0.7;
            if (u > 0.44 && u < 0.56 && v > 0.48 && v < 0.66) { setRGB(o, 0.6, 0.3, 0.05); o.h = 0.95; o.er = 0.8; o.eg = 0.35; o.eb = 0.02; }
        }
    },
    lava(u, v, o, N) {
        const c = N.cells(u, v, 6);
        const n1 = N.fbm(u, v, 4, 5);
        const crust = smooth(0.1, 0.35, c.d2 - c.d1) * smooth(0.35, 0.7, n1);
        const hot = 1 - crust;
        setRGB(o, mix(0.12, 1.0, hot), mix(0.06, 0.35 + 0.3 * n1, hot), mix(0.04, 0.05, hot));
        o.h = crust;
        o.er = 1.0 * hot; o.eg = (0.3 + 0.35 * n1) * hot; o.eb = 0.04 * hot;
    },

    // ---------------- hell ----------------
    flesh(u, v, o, N) {
        const n1 = N.fbm(u, v, 3, 6);
        const c = N.cells(u, v, 6);
        const vein = smooth(0.06, 0.0, c.d2 - c.d1);
        const pore = smooth(0.15, 0.05, c.d1);
        setRGB(o, 0.45 + 0.25 * n1, 0.12 + 0.08 * n1, 0.12 + 0.05 * n1);
        o.h = 0.3 + 0.5 * smooth(0.0, 0.5, c.d2 - c.d1) + 0.15 * n1 - 0.25 * pore;
        if (vein > 0) { o.r = mix(o.r, 0.25, vein); o.g = mix(o.g, 0.05, vein); o.b = mix(o.b, 0.18, vein); o.er = 0.5 * vein * smooth(0.5, 0.8, n1); o.eg = 0.02 * vein; o.eb = 0.08 * vein; }
        if (pore > 0) { o.r *= 1 - pore * 0.6; o.g *= 1 - pore * 0.6; o.b *= 1 - pore * 0.6; }
    },
    bonebrick(u, v, o, N) {
        const b = bricks(u, v, 3, 6);
        const n1 = N.fbm(u, v, 4, 5);
        const mortar = smooth(0.003, 0.012, b.d);
        const tone = 0.8 + 0.25 * N.hash(b.ix, b.iy + 4);
        setRGB(o, 0.6 * tone * (0.75 + 0.35 * n1), 0.52 * tone * (0.75 + 0.35 * n1), 0.4 * tone * (0.7 + 0.3 * n1));
        o.h = 0.25 + 0.6 * mortar + 0.1 * n1;
        if (mortar < 1) { o.r = mix(0.2, o.r, mortar); o.g = mix(0.05, o.g, mortar); o.b = mix(0.04, o.b, mortar); }
        // skull in some bricks
        if (N.hash(b.ix + 2, b.iy) > 0.75) {
            const su = b.lu - 0.5, sv = b.lv - 0.48;
            const skull = Math.hypot(su * 1.2, sv * 1.6) < 0.32;
            const eye = Math.hypot(Math.abs(su) - 0.13, sv + 0.02) < 0.08;
            const nose = Math.abs(su) < 0.04 && sv > 0.06 && sv < 0.14;
            if (skull) { o.h = 0.95; o.r *= 1.15; o.g *= 1.15; o.b *= 1.1; }
            if (skull && (eye || nose)) { o.h = 0.3; setRGB(o, 0.08, 0.02, 0.02); if (eye) { o.er = 0.5; o.eg = 0.05; o.eb = 0.02; } }
        }
    },
    bonepillar(u, v, o, N) {
        const n1 = N.fbm(u, v, 4, 5);
        const ring = Math.abs(((v * 6) % 1) - 0.5);
        setRGB(o, 0.62 * (0.75 + 0.35 * n1), 0.55 * (0.75 + 0.35 * n1), 0.42 * (0.75 + 0.3 * n1));
        o.h = 0.4 + 0.5 * smooth(0.5, 0.3, ring);
        if (ring > 0.45) { setRGB(o, 0.25, 0.06, 0.05); o.h = 0.1; }
    },
    hellstone(u, v, o, N) {
        const c = N.cells(u, v, 4);
        const n1 = N.fbm(u, v, 4, 5);
        const crack = smooth(0.04, 0.0, c.d2 - c.d1);
        const tone = 0.8 + 0.3 * N.hash(c.id, 1);
        setRGB(o, 0.24 * tone * (0.7 + 0.5 * n1), 0.12 * tone * (0.7 + 0.5 * n1), 0.1 * tone * (0.7 + 0.4 * n1));
        o.h = 0.3 + 0.5 * smooth(0.0, 0.3, c.d2 - c.d1);
        if (crack > 0) { o.er = 1.0 * crack; o.eg = 0.25 * crack; o.eb = 0.05 * crack; o.r = mix(o.r, 0.9, crack); o.g = mix(o.g, 0.25, crack); o.h = 0.05; }
    },
    altar(u, v, o, N) {
        const g = grid(u, v, 1, 1);
        const n1 = N.fbm(u, v, 4, 5);
        setRGB(o, 0.2 + 0.1 * n1, 0.08 + 0.04 * n1, 0.07);
        o.h = 0.4 + 0.4 * smooth(0, 0.06, g.d);
        // pentagram-ish rune circle
        const d = Math.hypot(u - 0.5, v - 0.5);
        if (Math.abs(d - 0.3) < 0.015) { o.er = 0.9; o.eg = 0.15; o.eb = 0.05; setRGB(o, 0.8, 0.15, 0.05); o.h = 0.2; }
        const a = Math.atan2(v - 0.5, u - 0.5);
        for (let k = 0; k < 5; k++) {
            const a1 = (k / 5) * Math.PI * 2 - Math.PI / 2, a2 = ((k + 2) / 5) * Math.PI * 2 - Math.PI / 2;
            const x1 = 0.5 + Math.cos(a1) * 0.3, y1 = 0.5 + Math.sin(a1) * 0.3, x2 = 0.5 + Math.cos(a2) * 0.3, y2 = 0.5 + Math.sin(a2) * 0.3;
            const t = clamp01(((u - x1) * (x2 - x1) + (v - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2));
            const dl = Math.hypot(u - (x1 + t * (x2 - x1)), v - (y1 + t * (y2 - y1)));
            if (dl < 0.01) { o.er = 0.9; o.eg = 0.15; o.eb = 0.05; setRGB(o, 0.8, 0.15, 0.05); o.h = 0.2; }
        }
        void a;
    },
    step_bone(u, v, o, N) {
        const n1 = N.fbm(u, v, 6, 4);
        const tooth = Math.abs(((u * 8) % 1) - 0.5);
        setRGB(o, 0.55 * (0.7 + 0.4 * n1), 0.48 * (0.7 + 0.4 * n1), 0.36);
        o.h = 0.3 + 0.6 * smooth(0.5, 0.1, tooth) * smooth(0.0, 0.5, v);
        if (v < 0.1) { setRGB(o, 0.3, 0.06, 0.05); o.h = 0.8; }
    },
    door_bone(u, v, o, N) {
        PAINTERS.bonebrick(u, v, o, N);
        const d = Math.hypot(u - 0.5, v - 0.45);
        if (d < 0.18) { o.h = 0.9 - d; o.r *= 0.7; o.g *= 0.5; o.b *= 0.5; }
        if (Math.abs(d - 0.14) < 0.012) { o.er = 0.9; o.eg = 0.12; o.eb = 0.04; }
    },
    exit_hell(u, v, o, N) {
        PAINTERS.altar(u, v, o, N);
        if (u > 0.2 && u < 0.8 && v > 0.08 && v < 0.24) {
            if (glyphs('EXIT', (u - 0.22) / 0.56, (v - 0.1) / 0.12)) { o.er = 1.0; o.eg = 0.2; o.eb = 0.05; setRGB(o, 1, 0.3, 0.1); }
        }
    },
    terminal_hell(u, v, o, N) {
        PAINTERS.flesh(u, v, o, N);
        const d = Math.hypot(u - 0.5, (v - 0.42) * 1.2);
        if (d < 0.24) {
            setRGB(o, 0.06, 0.02, 0.02); o.h = 0.4;
            const glyph = N.hash(Math.floor(u * 18), Math.floor(v * 18)) > 0.6 && d < 0.2;
            o.er = glyph ? 1.0 : 0.25; o.eg = glyph ? 0.35 : 0.04; o.eb = 0.05;
        }
    },
    blood(u, v, o, N) {
        const n1 = N.fbm(u, v, 4, 5);
        const c = N.cells(u, v, 7);
        const rim = smooth(0.25, 0.0, c.d2 - c.d1);
        setRGB(o, 0.35 + 0.25 * n1, 0.02, 0.03);
        o.h = n1;
        o.er = 0.35 * n1 + 0.2 * rim; o.eg = 0.01; o.eb = 0.02;
    },

    // ---------------- throne ----------------
    marble(u, v, o, N) {
        const n1 = N.fbm(u, v, 3, 6);
        const vein = Math.abs(Math.sin((u * 3 + v * 2 + n1 * 3.5) * Math.PI));
        const gold = smooth(0.04, 0.0, vein);
        const g = grid(u, v, 1, 2);
        const base = 0.6 + 0.14 * n1;
        setRGB(o, base, base * 0.96, base * 1.02);
        o.h = 0.5 + 0.35 * smooth(0, 0.02, g.d);
        const grey = smooth(0.25, 0.05, vein);
        o.r -= 0.25 * grey; o.g -= 0.25 * grey; o.b -= 0.2 * grey;
        if (gold > 0) { o.r = mix(o.r, 0.95, gold); o.g = mix(o.g, 0.72, gold); o.b = mix(o.b, 0.25, gold); o.er = 0.25 * gold; o.eg = 0.17 * gold; o.eb = 0.04 * gold; }
    },
    darkmarble(u, v, o, N) {
        PAINTERS.marble(u, v, o, N);
        o.r = o.r * 0.18 + 0.02; o.g = o.g * 0.16 + 0.02; o.b = o.b * 0.22 + 0.04;
    },
    marblefloor(u, v, o, N) {
        const g = grid(u, v, 2, 2);
        const check = (g.ix + g.iy) % 2;
        PAINTERS.marble((u * 2) % 1, (v * 2) % 1, o, N);
        if (check) { o.r = o.r * 0.2 + 0.02; o.g = o.g * 0.18 + 0.02; o.b = o.b * 0.25 + 0.05; }
        const seam = smooth(0.002, 0.006, g.d);
        o.h = 0.3 + 0.5 * seam;
        if (seam < 1) { o.r = mix(0.9, o.r, seam); o.g = mix(0.7, o.g, seam); o.b = mix(0.25, o.b, seam); }
    },
    step_gold(u, v, o, N) {
        const n1 = N.fbm(u, v, 6, 4);
        setRGB(o, 0.85 + 0.1 * n1, 0.62 + 0.1 * n1, 0.2);
        o.h = 0.5 + 0.4 * Math.abs(Math.sin(u * 40));
        o.er = 0.08; o.eg = 0.05; o.eb = 0.0;
    },
    exit_throne(u, v, o, N) {
        PAINTERS.darkmarble(u, v, o, N);
        const d = Math.hypot(u - 0.5, v - 0.5);
        if (Math.abs(d - 0.3) < 0.02 || Math.abs(d - 0.2) < 0.01) { o.er = 0.7; o.eg = 0.6; o.eb = 1.0; }
    },
    void(u, v, o, N) {
        const n1 = N.fbm(u, v, 3, 5);
        const c = N.cells(u, v, 5);
        const star = smooth(0.05, 0.0, c.d1) * (N.hash(c.id, 5) > 0.6 ? 1 : 0);
        setRGB(o, 0.05 + 0.1 * n1, 0.02, 0.1 + 0.15 * n1);
        o.h = n1;
        o.er = 0.25 * n1 + star; o.eg = 0.08 * n1 + star * 0.8; o.eb = 0.45 * n1 + star;
    },

    // ---------------- viewmodel / props ----------------
    gunmetal(u, v, o, N) {
        const brushed = N.fbm(u * 0.2, v * 8, 4, 4);
        const n1 = N.fbm(u, v, 8, 4);
        const c = 0.32 + 0.12 * brushed + 0.05 * n1;
        setRGB(o, c, c * 1.01, c * 1.04);
        o.h = 0.5 + 0.2 * brushed;
        const scratch = smooth(0.985, 1.0, N.fbm(u * 3, v * 0.3, 16, 2));
        if (scratch > 0) { o.r += scratch * 0.3; o.g += scratch * 0.3; o.b += scratch * 0.3; }
    },
};

// A tiny 5×5 block font for signs.
const FONT = {
    E: ['#####', '#....', '####.', '#....', '#####'],
    X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    I: ['#####', '..#..', '..#..', '..#..', '#####'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..'],
};
function glyphs(text, u, v) {
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
    const n = text.length;
    const ci = Math.floor(u * n);
    const lu = u * n - ci;
    const gx = Math.floor(lu * 6), gy = Math.floor(v * 5);
    if (gx >= 5) return false;
    const row = FONT[text[ci]]?.[gy];
    return !!row && row[gx] === '#';
}

// ------------------------------------------------------------------ themes

/**
 * Per theme: which painter each surface uses, plus fog, ambient and sky.
 * keys: wall, alt, pillar, corridor, floor, floorAlt, ceil, crate, step, door, exit, terminal, liquid
 */
export const THEMES = {
    station: {
        surfaces: { wall: 'techwall', alt: 'techwall2', pillar: 'techpillar', corridor: 'corridorwall', floor: 'grate', floorAlt: 'tile', corridorFloor: 'tile', ceil: 'ceilpanel', crate: 'crate', step: 'step', door: 'door_station', exit: 'exit_station', terminal: 'terminal', liquid: 'acid' },
        fog: 0x0a0e14, fogDensity: 0.022, ambient: [0.045, 0.05, 0.065], liquidLight: [0.25, 1.0, 0.2], liquidDamage: 5,
        sky: 'jupiter', grade: [1.0, 1.02, 1.08], music: { root: 40, mode: 'phrygian', tempo: 140 },
    },
    foundry: {
        surfaces: { wall: 'rustplate', alt: 'rock', pillar: 'girder', corridor: 'rustplate', floor: 'brick', floorAlt: 'rustplate', corridorFloor: 'rustplate', ceil: 'rock', crate: 'metalcrate', step: 'step_rust', door: 'door_rust', exit: 'exit_foundry', terminal: 'terminal', liquid: 'lava', rockglow: 'rockglow' },
        fog: 0x1a0a05, fogDensity: 0.024, ambient: [0.09, 0.055, 0.03], liquidLight: [1.0, 0.45, 0.1], liquidDamage: 10,
        sky: 'io', grade: [1.08, 1.0, 0.92], music: { root: 38, mode: 'harmonicMinor', tempo: 150 },
    },
    hell: {
        surfaces: { wall: 'flesh', alt: 'bonebrick', pillar: 'bonepillar', corridor: 'bonebrick', floor: 'hellstone', floorAlt: 'altar', corridorFloor: 'bonebrick', ceil: 'flesh', crate: 'altar', step: 'step_bone', door: 'door_bone', exit: 'exit_hell', terminal: 'terminal_hell', liquid: 'blood' },
        fog: 0x1c0404, fogDensity: 0.028, ambient: [0.06, 0.02, 0.02], liquidLight: [0.9, 0.08, 0.05], liquidDamage: 8,
        sky: 'hell', grade: [1.1, 0.95, 0.92], music: { root: 37, mode: 'locrian', tempo: 160 },
    },
    throne: {
        surfaces: { wall: 'marble', alt: 'darkmarble', pillar: 'marble', corridor: 'darkmarble', floor: 'marblefloor', floorAlt: 'marble', corridorFloor: 'darkmarble', ceil: 'darkmarble', crate: 'darkmarble', step: 'step_gold', door: 'darkmarble', exit: 'exit_throne', terminal: 'terminal', liquid: 'void' },
        fog: 0x0c0614, fogDensity: 0.016, ambient: [0.05, 0.04, 0.07], liquidLight: [0.5, 0.25, 1.0], liquidDamage: 12,
        sky: 'void', grade: [1.0, 0.98, 1.08], music: { root: 36, mode: 'phrygianDominant', tempo: 128 },
    },
};

// ------------------------------------------------------------------ baking

const cache = new Map();
let BLACK = null;

function black() {
    if (!BLACK) {
        BLACK = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
        BLACK.needsUpdate = true;
    }
    return BLACK;
}

/**
 * Paint `name` at `size`² and return { map, emit, emissive: bool }.
 * Cached by name+size; textures are shared across levels of the same theme.
 */
export function paintTexture(name, size = 256, anisotropy = 4) {
    const key = `${name}@${size}`;
    if (cache.has(key)) return cache.get(key);
    const painter = PAINTERS[name];
    if (!painter) throw new Error('no painter ' + name);
    const N = makeNoise(name.length * 977 + name.charCodeAt(0) * 31 + 7);
    const data = new Uint8Array(size * size * 4);
    const edata = new Uint8Array(size * size * 4);
    const o = {};
    let anyEmit = false;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            o.r = o.g = o.b = 0.5; o.h = 0.5; o.er = o.eg = o.eb = 0;
            painter((x + 0.5) / size, (y + 0.5) / size, o, N);
            const k = (y * size + x) * 4;
            data[k] = clamp01(o.r) * 255; data[k + 1] = clamp01(o.g) * 255; data[k + 2] = clamp01(o.b) * 255;
            data[k + 3] = clamp01(o.h) * 255;
            if (o.er || o.eg || o.eb) {
                anyEmit = true;
                edata[k] = clamp01(o.er) * 255; edata[k + 1] = clamp01(o.eg) * 255; edata[k + 2] = clamp01(o.eb) * 255;
            }
            edata[k + 3] = 255;
        }
    }
    // v = 0 is the top of the painted image; flip so v grows upwards in world space
    const flip = (arr) => {
        const row = size * 4, tmp = new Uint8Array(row);
        for (let y = 0; y < size / 2; y++) {
            const a = y * row, b = (size - 1 - y) * row;
            tmp.set(arr.subarray(a, a + row)); arr.copyWithin(a, b, b + row); arr.set(tmp, b);
        }
    };
    flip(data); flip(edata);
    const mk = (arr, srgb) => {
        const t = new THREE.DataTexture(arr, size, size, THREE.RGBAFormat);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.magFilter = THREE.LinearFilter;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.generateMipmaps = true;
        t.anisotropy = anisotropy;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        return t;
    };
    const out = { map: mk(data, true), emit: anyEmit ? mk(edata, true) : black(), emissive: anyEmit, data, size };
    cache.set(key, out);
    return out;
}

/** For tests: is there a painter for every surface of every theme? */
export function painterNames() { return Object.keys(PAINTERS); }
