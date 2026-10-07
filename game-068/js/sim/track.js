/**
 * track.js — a race track as the simulation sees it: a closed centreline resampled every ~2 m, with
 * height, banking, curvature, a racing line, surface patches, coins and the starting grid.
 *
 * Coordinates: y is up. A heading h points along (sin h, cos h) in (x, z); the car's right-hand side
 * is (-cos h, sin h). A positive lateral offset d is to the right of the centreline.
 *
 * Shapes (def.shape):
 *   { type: 'polar', R, sx, sz, harm: [[k, amp, phase], ...], rot }   a wobbly loop, always simple
 *   { type: 'pts', pts: [[x, z], ...] }                                 closed Catmull-Rom through points
 *   { type: 'eight', a, b, H }                                         a figure eight; one lobe rises H
 *                                                                      and the other dips H, so the
 *                                                                      crossing is a bridge
 * Elevation: def.hills [[k, amp, phase]] (whole-lap waves) plus def.features, each
 *   { u, type: 'table' | 'crest' | 'whoops' | 'kicker' | 'dip', len, h, n }
 * Surfaces: def.surface everywhere on the road, def.shoulderSurf on the run-off, and def.patches
 *   { u, len, lat, w, type } override a stretch of road.
 *
 * Everything here is plain numbers: no three.js, no DOM, no Math.random.
 */

import { DS } from '../config.js';
import { SURF } from './surfaces.js';

const TAU = Math.PI * 2;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => t * t * (3 - 2 * t);

// ------------------------------------------------------------------ shapes → dense polyline
function densePolar(sh) {
    const M = 2400, out = [];
    const rot = sh.rot || 0;
    for (let k = 0; k < M; k++) {
        const th = (k / M) * TAU;
        let r = 1;
        for (const [n, a, p] of sh.harm || []) r += a * Math.cos(n * th + p);
        r *= sh.R;
        const x0 = Math.cos(th) * r * (sh.sx || 1), z0 = Math.sin(th) * r * (sh.sz || 1);
        out.push([x0 * Math.cos(rot) - z0 * Math.sin(rot), x0 * Math.sin(rot) + z0 * Math.cos(rot), 0]);
    }
    return out;
}

function densePts(sh) {
    // Centripetal Catmull-Rom: no cusps or loops between close control points.
    const P = sh.pts, n = P.length, out = [];
    const sc = sh.scale || 1;
    const get = (i) => { const p = P[((i % n) + n) % n]; return [p[0] * sc, p[1] * sc]; };
    for (let i = 0; i < n; i++) {
        const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
        const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-4;
        const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
        const seg = Math.max(8, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.8));
        for (let s = 0; s < seg; s++) {
            const t = t1 + (t2 - t1) * (s / seg);
            const L = (a, b, ta, tb) => [((tb - t) * a[0] + (t - ta) * b[0]) / (tb - ta), ((tb - t) * a[1] + (t - ta) * b[1]) / (tb - ta)];
            const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
            const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
            const C = L(B1, B2, t1, t2);
            out.push([C[0], C[1], 0]);
        }
    }
    return out;
}

function denseEight(sh) {
    // Lemniscate of Gerono: crosses itself at the origin at t = 0 and t = π.
    const M = 3000, out = [];
    for (let k = 0; k < M; k++) {
        const t = (k / M) * TAU;
        out.push([Math.sin(t) * sh.a, Math.sin(t) * Math.cos(t) * sh.b * 2, Math.cos(t + (sh.phase || 0)) * (sh.H || 4)]);
    }
    return out;
}

// ------------------------------------------------------------------ feature profiles
function featureY(f, sf) {
    const { len, h } = f;
    if (sf < 0 || sf >= len) return 0;
    switch (f.type) {
        case 'table': {
            const r = Math.min(13, len * 0.32);
            if (sf < r) return h * (sf / r);
            if (sf > len - r) return h * ((len - sf) / r);
            return h;
        }
        case 'kicker': {
            const a = len * 0.42;
            if (sf < a) return h * (sf / a);
            return h * (1 - smooth((sf - a) / (len - a)));
        }
        case 'crest': return h * Math.pow(Math.sin(Math.PI * sf / len), 2);
        case 'dip': return -h * Math.pow(Math.sin(Math.PI * sf / len), 2);
        case 'whoops': return h * Math.pow(Math.sin(Math.PI * (f.n || 5) * sf / len), 2);
        default: return 0;
    }
}

function smoothArr(a, rad, passes = 1) {
    const n = a.length;
    let src = a;
    for (let p = 0; p < passes; p++) {
        const out = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            let s = 0;
            for (let k = -rad; k <= rad; k++) s += src[(i + k + n) % n];
            out[i] = s / (2 * rad + 1);
        }
        src = out;
    }
    return src;
}

/** Resample a closed polyline [[x, z, y], ...] at even spacing of about DS metres. */
function resample(dense) {
    const M = dense.length, cum = new Float64Array(M + 1);
    for (let k = 0; k < M; k++) {
        const a = dense[k], b = dense[(k + 1) % M];
        cum[k + 1] = cum[k] + Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    const L = cum[M];
    const N = Math.max(60, Math.round(L / DS));
    const ds = L / N;
    const x = new Float64Array(N), z = new Float64Array(N), y = new Float64Array(N);
    let k = 0;
    for (let i = 0; i < N; i++) {
        const s = i * ds;
        while (cum[k + 1] < s) k++;
        const t = (s - cum[k]) / Math.max(1e-9, cum[k + 1] - cum[k]);
        const a = dense[k], b = dense[(k + 1) % M];
        x[i] = a[0] + (b[0] - a[0]) * t;
        z[i] = a[1] + (b[1] - a[1]) * t;
        y[i] = a[2] + (b[2] - a[2]) * t;
    }
    return { x, z, y, N, ds, L };
}

// ------------------------------------------------------------------ the track
export class Track {
    constructor(def) {
        this.def = def;
        this.id = def.id;
        this.hw = def.hw ?? 7;                 // half width of the road
        this.sh = def.shoulder ?? 5;           // run-off beyond the road, before the barrier
        this.wall = this.hw + this.sh;         // barrier distance from the centreline
        this.surface = def.surface || 'dirt';
        this.shoulderSurf = def.shoulderSurf || 'grass';

        let dense;
        const sh = def.shape;
        if (sh.type === 'polar') dense = densePolar(sh);
        else if (sh.type === 'eight') dense = denseEight(sh);
        else dense = densePts(sh);
        if (def.reverse) dense.reverse();
        if (sh.start) {
            // Rotate the loop so the start line sits at a chosen fraction of the shape.
            const k = Math.floor(((sh.start % 1) + 1) % 1 * dense.length);
            dense = dense.slice(k).concat(dense.slice(0, k));
        }

        // Resample to even spacing, relax kinks the control points left behind (a few passes of
        // neighbour averaging), then resample again so samples are exactly ds apart.
        let rs = resample(dense);
        const relax = def.smooth ?? 5;
        if (relax > 0) {
            const sx = smoothArr(rs.x, relax, 3), sz = smoothArr(rs.z, relax, 3);
            const d2 = [];
            for (let i = 0; i < rs.N; i++) d2.push([sx[i], sz[i], rs.y[i]]);
            rs = resample(d2);
        }
        const N = rs.N, ds = rs.ds, L = rs.L;
        this.N = N; this.ds = ds; this.L = L;
        const px = rs.x, pz = rs.z, py = rs.y;
        // Whole-lap hills, then features.
        for (let i = 0; i < N; i++) {
            const u = i / N;
            for (const [n, a, p] of def.hills || []) py[i] += a * Math.sin(n * TAU * u + p);
        }
        if ((def.hills && def.hills.length) || sh.type === 'eight') {
            const sm = smoothArr(py, 2, 2);
            py.set(sm);
        }
        for (const f of def.features || []) {
            const s0 = f.u * L;
            for (let i = 0; i < N; i++) {
                let sf = i * ds - s0;
                sf = ((sf % L) + L) % L;
                py[i] += featureY(f, sf);
            }
        }
        this.px = px; this.py = py; this.pz = pz;

        // Tangents, headings, curvature.
        const tx = new Float64Array(N), tz = new Float64Array(N), head = new Float64Array(N);
        for (let i = 0; i < N; i++) {
            const a = (i - 1 + N) % N, b = (i + 1) % N;
            const dx = px[b] - px[a], dz = pz[b] - pz[a];
            const l = Math.hypot(dx, dz) || 1;
            tx[i] = dx / l; tz[i] = dz / l;
            head[i] = Math.atan2(tx[i], tz[i]);
        }
        const kap = new Float64Array(N);
        for (let i = 0; i < N; i++) kap[i] = wrapA(head[(i + 1) % N] - head[(i - 1 + N) % N]) / (2 * ds);
        this.kRaw = kap;
        this.kap = smoothArr(kap, 3, 2);
        this.tx = tx; this.tz = tz; this.head = head;

        // Banking: raise the outside of corners. Positive curvature is a left turn, whose outside is
        // the right (d > 0), so bankTan follows the curvature's sign.
        const bank = new Float64Array(N);
        const bf = def.bank || 0;
        for (let i = 0; i < N; i++) bank[i] = clamp(bf * this.kap[i] * 40, -0.3, 0.3);
        const bs = smoothArr(bank, 6, 2);
        this.bankTan = new Float64Array(N);
        for (let i = 0; i < N; i++) this.bankTan[i] = Math.tan(bs[i]);

        // Racing line: towards the inside of each corner, smoothed so it sets up early.
        const k2 = smoothArr(this.kap, 10, 2);
        const line = new Float64Array(N);
        const lw = Math.max(0, this.hw - 2.2);
        for (let i = 0; i < N; i++) line[i] = -clamp(k2[i] * 55, -1, 1) * lw;
        this.line = smoothArr(line, 8, 2);

        // Surface patches, indexed by sample.
        this.patches = (def.patches || []).map((p) => ({ ...p, i0: Math.round(p.u * N) % N, n: Math.max(1, Math.round(p.len / ds)) }));
        this.patchAt = Array.from({ length: N }, () => null);
        this.patches.forEach((p, pi) => {
            for (let j = 0; j < p.n; j++) {
                const i = (p.i0 + j) % N;
                (this.patchAt[i] ||= []).push(pi);
            }
        });

        // Grip along the racing line, for drivers planning their speed (ice and mud patches included).
        this.gripLine = new Float64Array(N);
        for (let i = 0; i < N; i++) this.gripLine[i] = Math.min(this.surf(i, this.line[i]).grip, this.surf(i, 0).grip);

        // Coins: short lines along the road.
        this.coins = [];
        for (const c of def.coins || []) {
            const i0 = Math.round(c.u * N) % N;
            for (let j = 0; j < (c.n || 5); j++) {
                const i = (i0 + j * 2) % N;
                const d = (c.lat || 0) + (c.wave ? Math.sin(j * 0.9) * c.wave : 0);
                const p = this.pointAt(i, 0, d);
                this.coins.push({ i, d, x: p.x, y: p.y + 0.9, z: p.z, v: c.v || 5 });
            }
        }

        this.startI = 0;
        this.grid = [];
        for (let slot = 0; slot < 8; slot++) {
            const row = slot >> 1, col = slot & 1;
            const back = 7 + row * 8 + col * 3.5;
            const i = (((this.startI - Math.round(back / ds)) % N) + N) % N;
            const d = (col ? 1 : -1) * Math.min(3.2, this.hw * 0.42);
            this.grid.push({ i, d });
        }

        // Bounding box, for the view and the minimap.
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let i = 0; i < N; i++) {
            x0 = Math.min(x0, px[i]); x1 = Math.max(x1, px[i]);
            z0 = Math.min(z0, pz[i]); z1 = Math.max(z1, pz[i]);
            y0 = Math.min(y0, py[i]); y1 = Math.max(y1, py[i]);
        }
        this.bounds = { x0, x1, z0, z1, y0, y1 };
    }

    wrap(i) { const N = this.N; return ((i % N) + N) % N; }

    /** World position of a point on the track frame (sample i, fraction f to the next, lateral d). */
    pointAt(i, f, d) {
        const N = this.N, j = (i + 1) % N;
        const x = this.px[i] + (this.px[j] - this.px[i]) * f;
        const z = this.pz[i] + (this.pz[j] - this.pz[i]) * f;
        const tx = this.tx[i] + (this.tx[j] - this.tx[i]) * f, tz = this.tz[i] + (this.tz[j] - this.tz[i]) * f;
        const l = Math.hypot(tx, tz) || 1;
        const rx = -tz / l, rz = tx / l;
        return { x: x + rx * d, z: z + rz * d, y: this.heightAt(i, f, d) };
    }

    heightAt(i, f, d) {
        const j = (i + 1) % this.N;
        const y = this.py[i] + (this.py[j] - this.py[i]) * f;
        const b = this.bankTan[i] + (this.bankTan[j] - this.bankTan[i]) * f;
        return y + d * b;
    }

    /** Slope along the track (dy/ds) at sample i. */
    slopeAt(i) {
        const j = (i + 1) % this.N;
        return (this.py[j] - this.py[i]) / this.ds;
    }

    /**
     * Find where (x, z) is on the track, searching near the sample `hint` (or everywhere if hint < 0).
     * Searching locally is what keeps a car on its own deck at a figure-eight crossing.
     * Writes { i, f, d } into `out` and returns it.
     */
    locate(x, z, hint, out, win = 8) {
        const N = this.N, px = this.px, pz = this.pz;
        let best = Infinity, bi = 0, bf = 0;
        const lo = hint < 0 ? 0 : hint - win, hi = hint < 0 ? N - 1 : hint + win;
        for (let a = lo; a <= hi; a++) {
            const i = ((a % N) + N) % N, j = (i + 1) % N;
            const ex = px[j] - px[i], ez = pz[j] - pz[i];
            const qx = x - px[i], qz = z - pz[i];
            let t = (qx * ex + qz * ez) / (ex * ex + ez * ez);
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const dx = qx - ex * t, dz = qz - ez * t;
            const d2 = dx * dx + dz * dz;
            if (d2 < best) { best = d2; bi = i; bf = t; }
        }
        // The frame at the projected point: interpolate the tangent, then the lateral offset.
        const j = (bi + 1) % N;
        const tx = this.tx[bi] + (this.tx[j] - this.tx[bi]) * bf, tz = this.tz[bi] + (this.tz[j] - this.tz[bi]) * bf;
        const l = Math.hypot(tx, tz) || 1;
        const cx = px[bi] + (px[j] - px[bi]) * bf, cz = pz[bi] + (pz[j] - pz[bi]) * bf;
        out.i = bi; out.f = bf;
        out.d = (x - cx) * (-tz / l) + (z - cz) * (tx / l);
        out.tx = tx / l; out.tz = tz / l;
        return out;
    }

    /** Name of the surface at sample i, lateral offset d. */
    surfaceAt(i, d) {
        const ad = Math.abs(d);
        if (ad > this.hw + 0.4) return this.shoulderSurf;
        const pl = this.patchAt[i];
        if (pl) {
            for (let k = pl.length - 1; k >= 0; k--) {
                const p = this.patches[pl[k]];
                if (Math.abs(d - (p.lat || 0)) <= p.w) return p.type;
            }
        }
        return this.surface;
    }

    surf(i, d) { return SURF[this.surfaceAt(i, d)] || SURF.dirt; }

    /** Index distance from a to b going forward, in (-N/2, N/2]. */
    delta(a, b) {
        const N = this.N;
        let d = (b - a) % N;
        if (d > N / 2) d -= N;
        if (d <= -N / 2) d += N;
        return d;
    }
}
