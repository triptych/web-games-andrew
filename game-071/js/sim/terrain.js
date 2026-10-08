/**
 * terrain.js — builds the Frostmarch height field from geography.js and answers
 * height / normal / water / mask queries for physics, AI, placement and the view.
 *
 * Grid: N × N samples, CELL metres apart, origin at (−HALF, −HALF). heightAt() interpolates
 * each grid quad as two triangles split along the (i,j)–(i+1,j+1) diagonal, exactly as the
 * terrain mesh is built, so feet sit on the drawn ground.
 */
import { WORLD, FEATURES, COAST, LAKES, RIVERS, LOCATIONS, ROADS, REGIONS, REGION_IDS, regionWeights } from './geography.js';
import { Simplex2, clamp, lerp, smoothstep } from './rng.js';

const { N, CELL, HALF } = WORLD;
export const MASK_RES = 1024;   // masks texture (grass, snow, road, forest)
export const TINT_RES = 256;    // regional colour tints

let segT = 0;   // parameter of the nearest point from the last segD() call
function segD(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz || 1;
    let t = ((px - ax) * dx + (pz - az) * dz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    segT = t;
    const qx = px - (ax + dx * t), qz = pz - (az + dz * t);
    return Math.sqrt(qx * qx + qz * qz);
}

/** Densify a polyline to points every `step` metres. */
export function densify(pts, step) {
    const out = [];
    for (let k = 0; k < pts.length - 1; k++) {
        const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.max(1, Math.ceil(len / step));
        for (let s = 0; s < n; s++) out.push([ax + (bx - ax) * s / n, az + (bz - az) * s / n]);
    }
    out.push(pts[pts.length - 1].slice());
    return out;
}

/** Chaikin smoothing for nicer road curves. */
function chaikin(pts, iters = 2) {
    let p = pts;
    for (let it = 0; it < iters; it++) {
        const q = [p[0]];
        for (let k = 0; k < p.length - 1; k++) {
            const [ax, az] = p[k], [bx, bz] = p[k + 1];
            q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
        }
        q.push(p[p.length - 1]);
        p = q;
    }
    return p;
}

export class Terrain {
    constructor() {
        this.N = N; this.CELL = CELL; this.HALF = HALF;
        this.h = new Float32Array(N * N);
        this.water = new Float32Array(N * N).fill(-1000);
        this.road = new Uint8Array(N * N);
        this.pad = new Uint8Array(N * N);      // 255 inside settlement pads (no trees, dirt)
        this.riverD = new Float32Array(N * N).fill(1e4);
        this._rw = new Float32Array(N * N);
        this.ao = new Uint8Array(N * N);
        this.masks = new Uint8Array(MASK_RES * MASK_RES * 4);
        this.tintGrass = new Uint8Array(TINT_RES * TINT_RES * 4);
        this.tintSoil = new Uint8Array(TINT_RES * TINT_RES * 4);
        this.roads = [];      // { id, w, pts: [[x,z,h]], name }
        this.rivers = [];     // { id, w, pts: [[x,z,wl]] }
        this.lakes = [];      // { ...lake, level }
        this.bridges = [];    // { x, z, ang, len, h }
        this.padLevels = {};  // location id → flattened height
        this.n1 = new Simplex2(WORLD.SEED);
        this.n2 = new Simplex2(WORLD.SEED + 11);
        this.n3 = new Simplex2(WORLD.SEED + 23);
        this.n4 = new Simplex2(WORLD.SEED + 37);
    }

    // ---------------------------------------------------------------- queries
    idx(i, j) { return j * N + i; }
    gx(x) { return (x + HALF) / CELL; }

    /** Height at world (x, z), triangle-interpolated like the mesh. */
    heightAt(x, z) {
        let fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
        if (fx < 0) fx = 0; else if (fx > N - 1.001) fx = N - 1.001;
        if (fz < 0) fz = 0; else if (fz > N - 1.001) fz = N - 1.001;
        const i = fx | 0, j = fz | 0;
        const u = fx - i, v = fz - j;
        const h = this.h, k = j * N + i;
        const h00 = h[k], h10 = h[k + 1], h01 = h[k + N], h11 = h[k + N + 1];
        if (u > v) return h00 + (h10 - h00) * u + (h11 - h10) * v;
        return h00 + (h11 - h01) * u + (h01 - h00) * v;
    }

    /** Bilinear sample of any N×N float grid. */
    sample(arr, x, z) {
        let fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
        fx = clamp(fx, 0, N - 1.001); fz = clamp(fz, 0, N - 1.001);
        const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * N + i;
        return (arr[k] * (1 - u) + arr[k + 1] * u) * (1 - v) + (arr[k + N] * (1 - u) + arr[k + N + 1] * u) * v;
    }

    normalAt(x, z, out = { x: 0, y: 1, z: 0 }) {
        const e = CELL;
        const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
        const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
        const l = Math.hypot(dx, 2 * e, dz);
        out.x = -dx / l; out.y = 2 * e / l; out.z = -dz / l;
        return out;
    }

    /** 0 = flat, 1 = vertical */
    slopeAt(x, z) { return 1 - this.normalAt(x, z).y; }

    /** Water surface height at (x, z), or −1000 where there is none (the sea is level 0). */
    waterAt(x, z) {
        const w = this.nearestGrid(this.water, x, z);
        return Math.max(w, this.seaMask(x, z) ? 0 : -1000);
    }
    seaMask(x, z) { return this.heightAt(x, z) < 0.5 && z < COAST.z + 260; }
    nearestGrid(arr, x, z) {
        const i = clamp(Math.round((x + HALF) / CELL), 0, N - 1), j = clamp(Math.round((z + HALF) / CELL), 0, N - 1);
        return arr[j * N + i];
    }
    roadAt(x, z) { return this.nearestGrid(this.road, x, z) / 255; }
    padAt(x, z) { return this.nearestGrid(this.pad, x, z) / 255; }
    /** masks: 0 grass, 1 snow, 2 road, 3 forest — each 0..1 */
    maskAt(x, z, ch) {
        const i = clamp(Math.floor((x + HALF) / WORLD.SIZE * MASK_RES), 0, MASK_RES - 1);
        const j = clamp(Math.floor((z + HALF) / WORLD.SIZE * MASK_RES), 0, MASK_RES - 1);
        return this.masks[(j * MASK_RES + i) * 4 + ch] / 255;
    }

    // ---------------------------------------------------------------- generation
    coastZ(x) {
        if (this._coast) {
            const i = Math.round((x + HALF) / CELL);
            if (i >= 0 && i < N && Math.abs(-HALF + i * CELL - x) < 1e-6) return this._coast[i];
        }
        const n = this.n2;
        let cz = COAST.z + COAST.amp * n.noise(x * 0.0035, 7.3) + 35 * n.noise(x * 0.012, 2.1);
        cz -= 85 * Math.exp(-(((x - 160) / 240) ** 2));   // Hrimvik headland
        cz += 60 * Math.exp(-(((x + 500) / 160) ** 2));   // the wreck's bay
        return cz;
    }

    baseHeight(x, z) {
        const n1 = this.n1, n3 = this.n3;
        let e = 78;
        e += 55 * smoothstep(250, 1300, z);       // the south rises into the pinewoods
        e -= 28 * smoothstep(-650, -1150, z);     // the north falls toward the sea
        e += 18 * smoothstep(400, 1200, x) * (1 - smoothstep(300, 1200, z)); // Emberfield uplands
        // rolling hills, calmer on the Brightwater plains
        const dPlains = Math.hypot(x - 0, z + 260);
        const hillAmp = lerp(12, 40, smoothstep(250, 850, dPlains));
        e += n1.fbm(x * 0.0024, z * 0.0024, 5) * hillAmp;
        // river valley: lower the land around the Brightrun's course
        for (const rv of RIVERS) {
            let best = 1e9;
            for (let k = 0; k < rv.pts.length - 1; k++) {
                const d = segD(x, z, rv.pts[k][0], rv.pts[k][1], rv.pts[k + 1][0], rv.pts[k + 1][1]);
                if (d < best) best = d;
            }
            e -= 20 * smoothstep(190, 10, best);
        }
        // mountains and hills
        for (const f of FEATURES) {
            if (f.kind === 'cone') {
                const ddx = x - f.x, ddz = z - f.z;
                if (ddx * ddx + ddz * ddz >= f.r * f.r) continue;
                const d = Math.sqrt(ddx * ddx + ddz * ddz);
                const t = 1 - d / f.r;
                // a bell rather than a spike: gentle foothills, steep shoulders, a rounded crown
                const sm = t * t * (3 - 2 * t);
                const prof = Math.pow(sm, f.p * 0.75);
                // radial spurs and gullies running down from the summit
                const ang = Math.atan2(ddz, ddx);
                const warp = this.n2.noise(x * 0.005, z * 0.005) * 1.1;
                const spur = 1 - Math.abs(this.n3.noise(Math.cos(ang + warp) * 2.2 + f.x * 0.003, Math.sin(ang + warp) * 2.2 + d * 0.0035));
                const ridge = n3.ridged(x * 0.0055 + f.x * 0.01, z * 0.0055, 4, 2.0, 0.42);
                const rough = f.rough * Math.min(1, t * 3) * (1 - smoothstep(0.85, 1, t) * 0.6);
                e += f.h * prof * (1 + rough * ((ridge * 2 - 1) * 0.8 + (spur * 2 - 1) * 0.5));
            } else if (f.kind === 'ridge') {
                const d = segD(x, z, f.ax, f.az, f.bx, f.bz), t = segT;
                if (d >= f.r) continue;
                const s = 1 - d / f.r;
                const ends = smoothstep(0, 0.12, t) * smoothstep(1, 0.88, t) * 0.5 + 0.5;
                const wx = x + 90 * this.n2.noise(x * 0.003, z * 0.003 + 2), wz = z + 90 * this.n2.noise(x * 0.003 + 7, z * 0.003);
                const ridge = n3.ridged(wx * 0.0042, wz * 0.0042 + 50, 4, 2.0, 0.45);
                e += f.h * Math.pow(smoothstep(0, 1, s), 1.25) * (0.6 + 0.55 * ridge) * ends;
            } else if (f.kind === 'bump') {
                e += f.h * smoothstep(f.r, 0, Math.hypot(x - f.x, z - f.z));
            } else if (f.kind === 'dip') {
                e -= f.h * smoothstep(f.r, 0, Math.hypot(x - f.x, z - f.z));
            }
        }
        // border mountains on the west, south and east edges
        const be = Math.min(HALF - z, x + HALF, HALF - x);
        if (be < 260) {
            const t = 1 - be / 260;
            const wx = x + 140 * this.n2.noise(x * 0.0021, z * 0.0021 + 5), wz = z + 140 * this.n2.noise(x * 0.0021 + 9, z * 0.0021);
            const ridge = n3.ridged(wx * 0.0028 + 9, wz * 0.0028 - 4, 4, 2.0, 0.45);
            e += Math.pow(t, 1.5) * 470 * (0.6 + 0.55 * ridge);
        }
        // the coast and the Hrimsea floor
        const cz = this.coastZ(x);
        if (z < cz + 120) {
            const cliff = 0.5 + 0.5 * this.n2.noise(x * 0.006, 3.3);   // some stretches are cliffs, some beaches
            const t = smoothstep(cz - lerp(110, 25, cliff), cz + lerp(120, 30, cliff), z);
            e = lerp(-26 + this.n1.noise(x * 0.01, z * 0.01) * 6, e, t);
        }
        return e;
    }

    generate(onProgress) {
        const h = this.h;
        this._coast = null;
        const coast = new Float32Array(N);
        for (let i = 0; i < N; i++) coast[i] = this.coastZ(-HALF + i * CELL);
        this._coast = coast;
        // ---- pass 1: base relief at half resolution, upsampled, plus fine detail at full resolution
        const M = (N >> 1) + 1, C2 = CELL * 2;
        const coarse = new Float32Array(M * M);
        for (let j = 0; j < M; j++) {
            const z = -HALF + j * C2;
            for (let i = 0; i < M; i++) coarse[j * M + i] = this.baseHeight(-HALF + i * C2, z);
            if (onProgress && (j & 31) === 0) onProgress(0.45 * j / M);
        }
        this.slopeLimit(coarse, M, C2, 1.15);
        this.erode(coarse, M, C2, 10, 0.9);
        if (onProgress) onProgress(0.5);
        const n1 = this.n1;
        for (let j = 0; j < N; j++) {
            const z = -HALF + j * CELL, cj = j >> 1, v = (j & 1) * 0.5, cj1 = Math.min(cj + 1, M - 1);
            for (let i = 0; i < N; i++) {
                const ci = i >> 1, u = (i & 1) * 0.5, ci1 = Math.min(ci + 1, M - 1);
                const b = (coarse[cj * M + ci] * (1 - u) + coarse[cj * M + ci1] * u) * (1 - v) + (coarse[cj1 * M + ci] * (1 - u) + coarse[cj1 * M + ci1] * u) * v;
                const x = -HALF + i * CELL;
                // steep ground gets gullies and buttresses back after the slope clamp
                const gx = (coarse[cj * M + ci1] - coarse[cj * M + ci]) / C2, gz = (coarse[cj1 * M + ci] - coarse[cj * M + ci]) / C2;
                const steep = smoothstep(0.45, 1.0, Math.sqrt(gx * gx + gz * gz));
                let det = n1.fbm(x * 0.011 + 31, z * 0.011 - 17, 3) * 3.5;
                if (steep > 0) det += (this.n4.ridged(x * 0.012, z * 0.012, 3, 2.1, 0.5) - 0.45) * 26 * steep;
                h[j * N + i] = b + det;
            }
        }
        if (onProgress) onProgress(0.55);
        // ---- lakes
        for (const lk of LAKES) {
            let ringMin = 1e9;
            for (let a = 0; a < 64; a++) {
                const ang = a / 64 * Math.PI * 2;
                ringMin = Math.min(ringMin, this.heightAt(lk.x + Math.cos(ang) * lk.r * 1.05, lk.z + Math.sin(ang) * lk.r * 1.05));
            }
            const level = ringMin - 1.6;
            this.lakes.push({ ...lk, level });
            this.raster(lk.x - lk.r - 40, lk.z - lk.r - 40, lk.x + lk.r + 40, lk.z + lk.r + 40, (k, x, z) => {
                const d = Math.hypot(x - lk.x, z - lk.z);
                const wob = 1 + 0.08 * this.n2.noise(x * 0.02, z * 0.02);
                const dn = d / (lk.r * wob);
                if (dn < 1) {
                    const bottom = level - 1 - 9 * (1 - dn * dn);
                    h[k] = Math.min(h[k], lerp(bottom, level + 0.8, smoothstep(0.7, 1.0, dn)));
                }
                if (dn < 1.15) this.water[k] = Math.max(this.water[k], level);
            });
        }
        if (onProgress) onProgress(0.6);
        // ---- rivers
        for (const rv of RIVERS) this.carveRiver(rv);
        if (onProgress) onProgress(0.66);
        // ---- settlement pads
        for (const loc of LOCATIONS) this.flattenLocation(loc);
        if (onProgress) onProgress(0.72);
        // ---- roads
        for (const rd of ROADS) this.carveRoad(rd);
        if (onProgress) onProgress(0.8);
        this.computeAO();
        if (onProgress) onProgress(0.88);
        this.computeMasks();
        if (onProgress) onProgress(1);
        return this;
    }

    /**
     * Cap the slope everywhere at `talus` by lowering whatever stands too far above a neighbour:
     * a forward and a backward chamfer pass over the 8-neighbourhood (exact for this metric).
     */
    slopeLimit(g, M, cell, talus) {
        const a = talus * cell, d = a * Math.SQRT2;
        for (let pass = 0; pass < 2; pass++) {
            for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
                const k = j * M + i;
                let v = g[k];
                if (i > 0) v = Math.min(v, g[k - 1] + a);
                if (j > 0) {
                    v = Math.min(v, g[k - M] + a);
                    if (i > 0) v = Math.min(v, g[k - M - 1] + d);
                    if (i < M - 1) v = Math.min(v, g[k - M + 1] + d);
                }
                g[k] = v;
            }
            for (let j = M - 1; j >= 0; j--) for (let i = M - 1; i >= 0; i--) {
                const k = j * M + i;
                let v = g[k];
                if (i < M - 1) v = Math.min(v, g[k + 1] + a);
                if (j < M - 1) {
                    v = Math.min(v, g[k + M] + a);
                    if (i < M - 1) v = Math.min(v, g[k + M + 1] + d);
                    if (i > 0) v = Math.min(v, g[k + M - 1] + d);
                }
                g[k] = v;
            }
        }
    }

    /**
     * Thermal erosion: wherever a sample stands above a neighbour by more than the talus slope,
     * part of the excess slides down. Knocks the needles off ridged-noise peaks and leaves scree.
     */
    erode(g, M, cell, iters = 34, talus = 0.95) {
        const lim = talus * cell, lim2 = lim * Math.SQRT2;
        const d = new Float32Array(M * M);
        const off = new Int32Array([1, -1, M, -M, M + 1, -M - 1, -M + 1, M - 1]);
        const lims = new Float32Array([lim, lim, lim, lim, lim2, lim2, lim2, lim2]);
        const diff = new Float32Array(8);
        for (let it = 0; it < iters; it++) {
            d.fill(0);
            for (let j = 1; j < M - 1; j++) {
                for (let i = 1; i < M - 1; i++) {
                    const k = j * M + i, h = g[k];
                    let total = 0, maxd = 0;
                    for (let n = 0; n < 8; n++) {
                        const v = h - g[k + off[n]] - lims[n];
                        diff[n] = v;
                        if (v > 0) { total += v; if (v > maxd) maxd = v; }
                    }
                    if (total <= 0) continue;
                    const move = maxd * 0.5, f = move / total;
                    for (let n = 0; n < 8; n++) if (diff[n] > 0) d[k + off[n]] += diff[n] * f;
                    d[k] -= move;
                }
            }
            for (let k = 0; k < M * M; k++) g[k] += d[k];
        }
    }

    /** Call fn(index, x, z) for each grid sample in the world-space box. */
    raster(x0, z0, x1, z1, fn) {
        const i0 = clamp(Math.floor((x0 + HALF) / CELL), 0, N - 1), i1 = clamp(Math.ceil((x1 + HALF) / CELL), 0, N - 1);
        const j0 = clamp(Math.floor((z0 + HALF) / CELL), 0, N - 1), j1 = clamp(Math.ceil((z1 + HALF) / CELL), 0, N - 1);
        for (let j = j0; j <= j1; j++) {
            const z = -HALF + j * CELL;
            for (let i = i0; i <= i1; i++) fn(j * N + i, -HALF + i * CELL, z);
        }
    }

    carveRiver(rv) {
        const h = this.h;
        const pts = densify(chaikin(rv.pts, 2), 3);
        const lake = this.lakes.find((l) => l.id === rv.from);
        let wl = lake ? lake.level : this.heightAt(pts[0][0], pts[0][1]) - 1.5;
        const out = [];
        for (let k = 0; k < pts.length; k++) {
            const [x, z] = pts[k];
            const ground = this.heightAt(x, z);
            const inLake = lake && Math.hypot(x - lake.x, z - lake.z) < lake.r;
            if (!inLake) wl = Math.min(wl - 0.012, ground - 1.4);
            wl = Math.max(wl, 0);
            out.push([x, z, wl]);
        }
        // light smoothing of the water line keeps it monotonic and calm
        for (let it = 0; it < 3; it++) for (let k = 1; k < out.length - 1; k++) out[k][2] = Math.min(out[k - 1][2], (out[k - 1][2] + out[k][2] + out[k + 1][2]) / 3);
        this.rivers.push({ id: rv.id, name: rv.name, w: rv.width, pts: out });
        const half = rv.width / 2;
        const reach = 150;
        for (let k = 0; k < out.length - 1; k++) {
            const [ax, az, aw] = out[k], [bx, bz, bw] = out[k + 1];
            this.raster(Math.min(ax, bx) - reach, Math.min(az, bz) - reach, Math.max(ax, bx) + reach, Math.max(az, bz) + reach, (idx, x, z) => {
                const d = segD(x, z, ax, az, bx, bz), t = segT;
                if (d >= this.riverD[idx]) return;
                this.riverD[idx] = d;
                const w = aw + (bw - aw) * t;
                // stash the water line; carving happens below once each sample knows its nearest segment
                this.water[idx] = d < half + 4 ? Math.max(this.water[idx], w) : this.water[idx];
                this._rw = this._rw || new Float32Array(N * N);
                this._rw[idx] = w;
            });
        }
        const rw = this._rw;
        for (let idx = 0; idx < N * N; idx++) {
            const d = this.riverD[idx];
            if (d >= reach) continue;
            const w = rw[idx];
            let v = Math.min(h[idx], w + 0.3 + Math.max(0, d - half) * 0.42);
            if (d < half + 6 && v < w + 0.25 && d >= half) v = w + 0.25;   // a low bank, not a lip of water
            if (d < half) v = Math.min(v, w - 0.6 - 2.4 * (1 - (d / half) ** 2));
            h[idx] = v;
        }
    }

    flattenLocation(loc) {
        const pads = loc.pads || (loc.flat ? [{ x: loc.x, z: loc.z, r: loc.flat, f: Math.max(18, loc.flat * 0.7), lvl: loc.lvl }] : []);
        let prev = null;
        for (const p of pads) {
            const level = p.lvl != null ? p.lvl : p.rel != null && prev != null ? prev + p.rel : this.heightAt(p.x, p.z);
            prev = level;
            const reach = p.r + p.f;
            this.raster(p.x - reach, p.z - reach, p.x + reach, p.z + reach, (k, x, z) => {
                const d = Math.hypot(x - p.x, z - p.z);
                if (d > reach) return;
                let t = smoothstep(reach, p.r, d);
                t *= smoothstep(8, 22, this.riverD[k]);    // leave the river channel and its banks alone
                this.h[k] = lerp(this.h[k], level, t);
                if (d < p.r * 0.95) this.pad[k] = 255;
            });
            if (this.padLevels[loc.id] == null) this.padLevels[loc.id] = level;
        }
    }

    spiralPoints(sp) {
        // walk round the peak; each step's radius is where the mountainside is at the target height
        const [fx, fz] = sp.from, [tx, tz] = sp.to;
        const a0 = Math.atan2(fz - sp.cz, fx - sp.cx);
        let a1 = Math.atan2(tz - sp.cz, tx - sp.cx);
        const dir = sp.dir || 1;
        while (dir > 0 ? a1 <= a0 : a1 >= a0) a1 += dir * Math.PI * 2;
        a1 += dir * Math.PI * 2 * (sp.turns || 0);
        const h0 = this.heightAt(fx, fz), h1 = this.heightAt(tx, tz);
        const r0 = Math.hypot(fx - sp.cx, fz - sp.cz), r1 = Math.hypot(tx - sp.cx, tz - sp.cz);
        const steps = Math.ceil(Math.abs(a1 - a0) * Math.max(r0, r1) / 4);
        const pts = [];
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const a = a0 + (a1 - a0) * t;
            const ht = lerp(h0, h1, t);
            const ca = Math.cos(a), sa = Math.sin(a);
            // search outward for the radius where the ground drops below the target height
            // march outward from near the summit and take the first place the ground drops below ht
            const rMin = Math.min(r0, r1) * 0.3, rMax = Math.max(r0, r1) * 1.3;
            let lo = rMin, hi = rMax;
            for (let m = rMin; m <= rMax; m += 4) {
                if (this.heightAt(sp.cx + ca * m, sp.cz + sa * m) <= ht) { hi = m; lo = Math.max(rMin, m - 4); break; }
            }
            for (let it = 0; it < 10; it++) {
                const m = (lo + hi) / 2;
                if (this.heightAt(sp.cx + ca * m, sp.cz + sa * m) > ht) lo = m; else hi = m;
            }
            let r = (lo + hi) / 2;
            const rr = lerp(r0, r1, t);
            r = lerp(r, rr, Math.max(smoothstep(0.12, 0, t), smoothstep(0.88, 1, t)));   // meet the endpoints exactly
            pts.push([sp.cx + ca * r, sp.cz + sa * r, ht]);
        }
        // smooth the radius wobble
        for (let it = 0; it < 6; it++) for (let k = 2; k < pts.length - 2; k++) {
            pts[k][0] = (pts[k - 1][0] + pts[k][0] * 2 + pts[k + 1][0]) / 4;
            pts[k][1] = (pts[k - 1][1] + pts[k][1] * 2 + pts[k + 1][1]) / 4;
        }
        return pts;
    }

    carveRoad(rd) {
        let pts;
        if (rd.spiral) {
            pts = densify(this.spiralPoints(rd.spiral).map((p) => [p[0], p[1]]), 3);
            const sp = this.spiralPoints(rd.spiral);
            // heights: linear along arclength
            let L = 0; const acc = [0];
            for (let k = 1; k < pts.length; k++) { L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); acc.push(L); }
            const h0 = sp[0][2], h1 = sp[sp.length - 1][2];
            pts = pts.map((p, k) => [p[0], p[1], lerp(h0, h1, acc[k] / L)]);
        } else {
            pts = densify(chaikin(rd.pts, 2), 3).map(([x, z]) => [x, z, this.heightAt(x, z)]);
            // smooth heights along the road; keep the endpoints
            const n = pts.length;
            for (let it = 0; it < 4; it++) {
                const src = pts.map((p) => p[2]);
                for (let k = 0; k < n; k++) {
                    let s = 0, c = 0;
                    for (let o = -8; o <= 8; o++) { const q = k + o; if (q >= 0 && q < n) { s += src[q]; c++; } }
                    pts[k][2] = s / c;
                }
            }
            // limit the grade: relax toward each neighbour until no step climbs more than 20%
            for (let it = 0; it < 6; it++) {
                for (let k = 1; k < n; k++) pts[k][2] = clamp(pts[k][2], pts[k - 1][2] - 0.6, pts[k - 1][2] + 0.6);
                for (let k = n - 2; k >= 0; k--) pts[k][2] = clamp(pts[k][2], pts[k + 1][2] - 0.6, pts[k + 1][2] + 0.6);
            }
            // never sink a road below the water: bridges carry it over the river
            for (const p of pts) {
                const w = this.nearestGrid(this.water, p[0], p[1]);
                if (w > -999) p[2] = Math.max(p[2], w + 2.2);
            }
        }
        // ease roads into settlement pads: within a pad's falloff the road ramps (≤30%) to the pad level
        for (const loc of LOCATIONS) {
            const level = this.padLevels[loc.id];
            if (level == null) continue;
            const pads = loc.pads || (loc.flat ? [{ x: loc.x, z: loc.z, r: loc.flat, f: Math.max(18, loc.flat * 0.7) }] : []);
            for (const pd of pads) {
                const lv = pd.rel != null ? level + pd.rel : level;
                const ends = [pts[0], pts[pts.length - 1]];
                if (!ends.some((e) => Math.hypot(e[0] - pd.x, e[1] - pd.z) < pd.r + pd.f)) continue;   // only the road's own ends
                for (const p of pts) {
                    const d = Math.hypot(p[0] - pd.x, p[1] - pd.z);
                    if (d > pd.r + pd.f) continue;
                    const slack = Math.max(0, d - pd.r * 0.95) * 0.3;
                    const c = clamp(p[2], lv - slack, lv + slack);
                    p[2] = lerp(c, p[2], smoothstep(pd.r, pd.r + pd.f, d));
                }
            }
        }
        this.roads.push({ id: rd.id, w: rd.w, name: rd.name, pts });
        // bridges where the road crosses a river
        let inRiver = false, start = 0;
        for (let k = 0; k < pts.length; k++) {
            const wet = this.sample(this.riverD, pts[k][0], pts[k][1]) < 9;
            if (wet && !inRiver) { inRiver = true; start = k; }
            if (!wet && inRiver) {
                inRiver = false;
                const a = pts[Math.max(0, start - 2)], b = pts[Math.min(pts.length - 1, k + 2)];
                this.bridges.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, ang: Math.atan2(b[0] - a[0], b[1] - a[1]), len: Math.hypot(b[0] - a[0], b[1] - a[1]) + 6, h: Math.max(a[2], b[2]) + 0.4 });
            }
        }
        const half = rd.w / 2, flat = Math.max(half + 0.5, 3.4), fall = 8;
        const reach = flat + fall;
        const best = new Map();   // idx → [d, h]
        for (let k = 0; k < pts.length - 1; k++) {
            const [ax, az, ah] = pts[k], [bx, bz, bh] = pts[k + 1];
            this.raster(Math.min(ax, bx) - reach, Math.min(az, bz) - reach, Math.max(ax, bx) + reach, Math.max(az, bz) + reach, (idx, x, z) => {
                const d = segD(x, z, ax, az, bx, bz), t = segT;
                if (d > reach) return;
                const cur = best.get(idx);
                if (!cur || d < cur[0]) best.set(idx, [d, ah + (bh - ah) * t, x, z]);
            });
        }
        for (const [idx, [d, rh, x, z]] of best) {
            if (this.riverD[idx] < 10) continue;     // the bridge spans the river
            const t = smoothstep(reach, flat, d);
            if (!this.pad[idx]) this.h[idx] = lerp(this.h[idx], rh - 0.08, t);   // pads are already level
            const edge = half + 0.8 * this.n2.noise(x * 0.15, z * 0.15);
            const m = Math.round(255 * (1 - smoothstep(edge - 1.2, edge + 0.6, d)));
            if (m > this.road[idx]) this.road[idx] = m;
        }
    }

    computeAO() {
        // separable box blurs of the height field at two radii; ground below its surroundings is occluded
        const blur = (src, r) => {
            const tmp = new Float32Array(N * N), out = new Float32Array(N * N);
            for (let j = 0; j < N; j++) {
                let s = 0; const row = j * N;
                for (let i = -r; i <= r; i++) s += src[row + clamp(i, 0, N - 1)];
                for (let i = 0; i < N; i++) {
                    tmp[row + i] = s / (2 * r + 1);
                    s += src[row + clamp(i + r + 1, 0, N - 1)] - src[row + clamp(i - r, 0, N - 1)];
                }
            }
            for (let i = 0; i < N; i++) {
                let s = 0;
                for (let j = -r; j <= r; j++) s += tmp[clamp(j, 0, N - 1) * N + i];
                for (let j = 0; j < N; j++) {
                    out[j * N + i] = s / (2 * r + 1);
                    s += tmp[clamp(j + r + 1, 0, N - 1) * N + i] - tmp[clamp(j - r, 0, N - 1) * N + i];
                }
            }
            return out;
        };
        const b1 = blur(this.h, 3), b2 = blur(this.h, 12);
        for (let k = 0; k < N * N; k++) {
            const occ = Math.max(0, b1[k] - this.h[k]) * 0.06 + Math.max(0, b2[k] - this.h[k]) * 0.012;
            const crest = Math.max(0, this.h[k] - b2[k]) * 0.004;   // ridges catch a little extra sky
            this.ao[k] = Math.round(255 * clamp(1 - occ + crest, 0.35, 1));
        }
    }

    computeMasks() {
        const w = {};
        const n1 = this.n1, n4 = this.n4, h = this.h;
        // regional fields at tint resolution, bilinearly sampled per mask texel
        const T = TINT_RES;
        const snowF = new Float32Array(T * T), forestF = new Float32Array(T * T);
        const lineN = new Float32Array(T * T), fpatchN = new Float32Array(T * T), treeN = new Float32Array(T * T);
        for (let j = 0; j < T; j++) {
            const z = -HALF + (j + 0.5) * WORLD.SIZE / T;
            for (let i = 0; i < T; i++) {
                const x = -HALF + (i + 0.5) * WORLD.SIZE / T;
                regionWeights(x, z, w);
                const cz = this.coastZ(x);
                const coastT = smoothstep(cz + 220, cz - 40, z);
                const g = [0, 0, 0], s = [0, 0, 0];
                let snowBias = 0, forest = 0;
                for (const id of REGION_IDS) {
                    const r = REGIONS[id];
                    snowBias += w[id] * r.snow; forest += w[id] * r.forest;
                    const k = id === 'coast' ? 0 : w[id];
                    for (let c = 0; c < 3; c++) { g[c] += r.grass[c] * k; s[c] += r.soil[c] * k; }
                }
                const tot = 1 - w.coast;
                for (let c = 0; c < 3; c++) {
                    g[c] = lerp(g[c] / tot, REGIONS.coast.grass[c], coastT);
                    s[c] = lerp(s[c] / tot, REGIONS.coast.soil[c], coastT);
                }
                snowF[j * T + i] = lerp(snowBias, 0.8, smoothstep(cz + 260, cz - 20, z));
                forestF[j * T + i] = forest;
                lineN[j * T + i] = n1.fbm(x * 0.006, z * 0.006, 3);
                fpatchN[j * T + i] = n1.fbm(x * 0.0045 + 77, z * 0.0045 - 31, 3);
                treeN[j * T + i] = n1.noise(x * 0.01, z * 0.01);
                // a little low-frequency variation so the plains aren't one flat colour
                const v = this.n2.fbm(x * 0.004, z * 0.004, 2) * 0.08;
                const o = (j * T + i) * 4;
                this.tintGrass[o] = clamp((g[0] + v) * 255, 0, 255); this.tintGrass[o + 1] = clamp((g[1] + v * 0.7) * 255, 0, 255); this.tintGrass[o + 2] = clamp(g[2] * 255, 0, 255); this.tintGrass[o + 3] = 255;
                this.tintSoil[o] = clamp(s[0] * 255, 0, 255); this.tintSoil[o + 1] = clamp(s[1] * 255, 0, 255); this.tintSoil[o + 2] = clamp(s[2] * 255, 0, 255); this.tintSoil[o + 3] = 255;
            }
        }
        const sampleT = (arr, x, z) => {
            let fx = (x + HALF) / WORLD.SIZE * T - 0.5, fz = (z + HALF) / WORLD.SIZE * T - 0.5;
            fx = clamp(fx, 0, T - 1.001); fz = clamp(fz, 0, T - 1.001);
            const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * T + i;
            return (arr[k] * (1 - u) + arr[k + 1] * u) * (1 - v) + (arr[k + T] * (1 - u) + arr[k + T + 1] * u) * v;
        };
        const R = MASK_RES;
        for (let j = 0; j < R; j++) {
            const z = -HALF + (j + 0.5) * WORLD.SIZE / R;
            const gj = clamp(Math.round((z + HALF) / CELL), 1, N - 2);
            for (let i = 0; i < R; i++) {
                const x = -HALF + (i + 0.5) * WORLD.SIZE / R;
                const gi = clamp(Math.round((x + HALF) / CELL), 1, N - 2);
                const k = gj * N + gi;
                const o = (j * R + i) * 4;
                const alt = h[k];
                const dx = h[k + 1] - h[k - 1], dz = h[k + N] - h[k - N];
                const ny = 2 * CELL / Math.sqrt(dx * dx + 4 * CELL * CELL + dz * dz);
                const slope = 1 - ny;
                const snowBias = sampleT(snowF, x, z), forest = sampleT(forestF, x, z);
                const snowLine = 430 - snowBias * 520 + sampleT(lineN, x, z) * 70;
                let snow = smoothstep(snowLine - 35, snowLine + 35, alt);
                snow *= 1 - smoothstep(0.42, 0.68, slope);
                if (alt < 1.5) snow *= 0.4;
                const patch = n4.fbm(x * 0.02, z * 0.02, 3);
                let grass = clamp(0.62 + patch * 0.9, 0, 1) * (1 - smoothstep(0.22, 0.42, slope));
                const water = this.water[k];
                if (water > -999 && alt < water + 1.2) grass *= 0.2;
                if (alt < 2.5 && z < COAST.z + 200) grass *= 0.15;   // beaches and shingle
                const road = this.road[k] / 255;
                const pad = this.pad[k] / 255;
                const roadM = Math.max(road, pad * clamp(0.35 + patch * 0.6, 0, 0.75));
                grass *= 1 - roadM * 0.9;
                const fpatch = sampleT(fpatchN, x, z);
                let fr = clamp(forest * 1.25 + fpatch * 0.9 - 0.15, 0, 1);
                const treeLine = 470 + sampleT(treeN, x, z) * 40;
                fr *= 1 - smoothstep(treeLine - 60, treeLine, alt);
                fr *= 1 - smoothstep(0.35, 0.55, slope);
                fr *= 1 - Math.max(road, pad);
                if (water > -999 && alt < water + 2) fr = 0;
                if (alt < 3) fr = 0;
                this.masks[o] = Math.round(grass * 255);
                this.masks[o + 1] = Math.round(snow * 255);
                this.masks[o + 2] = Math.round(roadM * 255);
                this.masks[o + 3] = Math.round(fr * 255);
            }
        }
    }
}

const BUFFERS = ['h', 'water', 'road', 'pad', 'riverD', 'ao', 'masks', 'tintGrass', 'tintSoil'];
const META = ['roads', 'rivers', 'lakes', 'bridges', 'padLevels'];

/** Plain data (typed arrays transferable) for moving a generated terrain between threads. */
export function serializeTerrain(t) {
    const data = {};
    for (const k of BUFFERS) data[k] = t[k];
    for (const k of META) data[k] = t[k];
    data.coast = t._coast;
    return data;
}
export function transferList(data) { return BUFFERS.map((k) => data[k].buffer); }

export function terrainFromData(data) {
    const t = new Terrain();
    for (const k of BUFFERS) t[k] = data[k];
    for (const k of META) t[k] = data[k];
    t._coast = data.coast;
    _terrain = t;
    return t;
}

let _terrain = null;
/** The world's single terrain, generated once. */
export function getTerrain(onProgress) {
    if (!_terrain) _terrain = new Terrain().generate(onProgress);
    return _terrain;
}
