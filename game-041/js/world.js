// ============================================================
// The dig site: grid, pre-dug maze, dots and flow fields.
// ============================================================
// Enemies never "see" the player's plans. They read distance fields that are
// rebuilt whenever the dirt changes:
//
//   core   — tunnels only. What grubs, skitters, drakes and the king follow,
//            so the tunnels you dig ARE the maze they walk.
//   dig    — tunnels cost 1, dirt costs 3. The borer's field: it drills a
//            straight shortcut when your maze is long enough to be worth it.
//   ghost  — anything costs 4 except tunnels. Stalkers phase through dirt
//            (as a pair of eyes) when that's shorter than walking.

import { COLS, ROWS, CORE, CORRIDOR_ROWS, PLAYER_START } from './config.js';

export const DIRT = 0, TUNNEL = 1;
export const OCC_NONE = 0, OCC_ROCK = 1, OCC_TOWER = 2, OCC_CORE = 3;
export const DOT_NONE = 0, DOT_PELLET = 1, DOT_ORE = 2, DOT_GEM = 3;
export const N = COLS * ROWS;
export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

export function mulberry32(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class World {
    constructor() {
        this.tile = new Uint8Array(N);
        this.dot = new Uint8Array(N);
        this.occ = new Uint8Array(N);
        this.fields = { core: null, dig: null, ghost: null };
        this.dirty = true;
        this.version = 0;          // bumps on every terrain change (for caches)
        this.rocks = [];           // initial rock cells from generate()
    }

    idx(c, r) { return r * COLS + c; }
    inb(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS; }
    isTunnel(c, r) { return this.inb(c, r) && this.tile[this.idx(c, r)] === TUNNEL; }

    /** Build a fresh board for a round. Deterministic for a given seed. */
    generate(seed) {
        const rnd = mulberry32(seed);
        const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
        this.tile.fill(DIRT); this.dot.fill(DOT_NONE); this.occ.fill(OCC_NONE);
        const dig = (c, r) => { this.tile[this.idx(c, r)] = TUNNEL; };
        const hline = (r, a, b) => { for (let c = Math.min(a, b); c <= Math.max(a, b); c++) dig(c, r); };
        const vline = (c, a, b) => { for (let r = Math.min(a, b); r <= Math.max(a, b); r++) dig(c, r); };

        // Surface lane.
        hline(0, 0, COLS - 1);

        // Two entry shafts from the surface into the first corridor.
        const left = () => ri(1, 3), right = () => ri(COLS - 4, COLS - 2);
        const sL = left(), sR = right();
        const R0 = CORRIDOR_ROWS[0];
        vline(sL, 0, R0); vline(sR, 0, R0);
        const ends = [];
        let a = Math.max(0, sL - ri(0, 1)), b = Math.min(COLS - 1, sR + ri(0, 1));
        hline(R0, a, b); ends.push([a, R0], [b, R0]);

        // Zig-zag down: each corridor is joined to the next by one shaft on
        // alternating sides, so the natural path sweeps the full width.
        // Each shaft drops from where the corridor above it ENDS, so the
        // route sweeps side to side across the full width.
        let side = rnd() < 0.5 ? 0 : 1;
        let x = side === 0 ? sL : sR;
        for (let i = 1; i < CORRIDOR_ROWS.length; i++) {
            const rPrev = CORRIDOR_ROWS[i - 1], r = CORRIDOR_ROWS[i];
            vline(x, rPrev, r);
            const last = i === CORRIDOR_ROWS.length - 1;
            const to = last ? CORE.c : (side === 0 ? right() : left());
            a = Math.max(0, Math.min(x, to) - ri(0, 2));
            b = Math.min(COLS - 1, Math.max(x, to) + ri(0, 2));
            hline(r, a, b); ends.push([a, r], [b, r]);
            x = to;
            side ^= 1;
        }
        // Final drop into the core.
        vline(CORE.c, CORRIDOR_ROWS[CORRIDOR_ROWS.length - 1], CORE.r);
        this.occ[this.idx(CORE.c, CORE.r)] = OCC_CORE;

        // Dots: pellets fill every tunnel below the surface; ore seeds the dirt.
        for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            const i = this.idx(c, r);
            if (this.occ[i] === OCC_CORE) continue;
            this.dot[i] = this.tile[i] === TUNNEL ? DOT_PELLET : DOT_ORE;
        }

        // Four power gems at corridor ends, like the corners of a Pac-Man maze.
        const shuffled = ends.filter(([c, r]) => r > 0).sort(() => rnd() - 0.5);
        let gems = 0;
        const used = new Set();
        for (const [c, r] of shuffled) {
            const k = c + ',' + r;
            if (used.has(k)) continue;
            used.add(k);
            this.dot[this.idx(c, r)] = DOT_GEM;
            if (++gems === 4) break;
        }

        // Rocks: in dirt, with dirt under them so none drop on round start.
        this.rocks = [];
        const want = 5 + Math.min(4, Math.floor(seed % 97 / 24));
        for (let tries = 0; tries < 400 && this.rocks.length < want; tries++) {
            const c = ri(0, COLS - 1), r = ri(1, ROWS - 3);
            const i = this.idx(c, r);
            if (this.tile[i] !== DIRT || this.occ[i] !== OCC_NONE) continue;
            if (this.tile[this.idx(c, r + 1)] !== DIRT) continue;
            if (Math.abs(c - CORE.c) <= 1 && r >= CORE.r - 2) continue;
            if (c === PLAYER_START.c && r <= 2) continue;
            if (this.rocks.some(k => Math.abs(k.c - c) + Math.abs(k.r - r) < 3)) continue;
            this.occ[i] = OCC_ROCK;
            this.dot[i] = DOT_NONE;
            this.rocks.push({ c, r });
        }

        this.dirty = true;
        this.version++;
        this.updateFields();
    }

    dig(c, r) {
        const i = this.idx(c, r);
        if (this.tile[i] === TUNNEL) return false;
        this.tile[i] = TUNNEL;
        this.dirty = true;
        this.version++;
        return true;
    }

    setOcc(c, r, v) {
        this.occ[this.idx(c, r)] = v;
        this.dirty = true;
        this.version++;
    }

    /** Dijkstra over the grid. costOf(i) = cost of ENTERING cell i (Infinity = wall). */
    dijkstra(targets, costOf) {
        const dist = new Float32Array(N).fill(Infinity);
        const done = new Uint8Array(N);
        for (const t of targets) dist[t] = 0;
        for (;;) {
            let best = -1, bd = Infinity;
            for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; best = i; }
            if (best < 0) break;
            done[best] = 1;
            const c = best % COLS, r = (best / COLS) | 0;
            for (let d = 0; d < 4; d++) {
                const nc = c + DX[d], nr = r + DY[d];
                if (!this.inb(nc, nr)) continue;
                const j = nr * COLS + nc;
                if (done[j]) continue;
                const cost = costOf(j);
                if (cost === Infinity) continue;
                const nd = bd + cost;
                if (nd < dist[j]) dist[j] = nd;
            }
        }
        return dist;
    }

    walkCost(i) { return this.tile[i] === TUNNEL && this.occ[i] !== OCC_ROCK ? 1 : Infinity; }
    digCost(i) {
        const o = this.occ[i];
        if (o === OCC_ROCK || o === OCC_TOWER) return Infinity;
        return this.tile[i] === TUNNEL ? 1 : 3;
    }
    ghostCost(i) { return this.tile[i] === TUNNEL && this.occ[i] !== OCC_ROCK ? 1 : 4; }

    updateFields() {
        if (!this.dirty) return false;
        const core = [this.idx(CORE.c, CORE.r)];
        this.fields.core = this.dijkstra(core, i => this.walkCost(i));
        this.fields.dig = this.dijkstra(core, i => this.digCost(i));
        this.fields.ghost = this.dijkstra(core, i => this.ghostCost(i));
        this.dirty = false;
        return true;
    }

    /** Ghost-cost field towards an arbitrary cell (the stalker's hunt). */
    fieldTo(c, r) {
        return this.dijkstra([this.idx(c, r)], i => this.ghostCost(i));
    }

    /** Can a tower be built here? */
    buildable(c, r) {
        if (!this.inb(c, r) || r === 0) return false;
        const i = this.idx(c, r);
        return this.tile[i] === DIRT && this.occ[i] === OCC_NONE;
    }

    countDots() {
        let n = 0;
        for (let i = 0; i < N; i++) if (this.dot[i]) n++;
        return n;
    }
}
