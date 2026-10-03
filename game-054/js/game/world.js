/**
 * world.js — the live level: door state, collision, ray casts, line of sight,
 * monster flow fields and sound propagation. Pure JS over the gen.js grid;
 * no three.js, so it runs in the Node sim test too.
 *
 * Collision is DOOM's: every body is an axis-aligned square (side 2r) moving
 * through a grid of cells with their own floor and ceiling heights. A cell
 * blocks you if it's solid, if its floor is more than STEP above your feet,
 * or if there's not enough headroom between its floor and its (door-lowered)
 * ceiling. Moving x then z separately gives free wall sliding.
 */
import { CELL, STEP } from '../config.js';

const DIR8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

export class World {
    constructor(L) {
        this.L = L;
        this.W = L.W; this.H = L.H;
        this.N = L.W * L.H;
        // door runtime state
        for (const d of L.doors) {
            d.open = 0; d.state = 'closed'; d.timer = 0; d.h = L.ceil[d.cell] - L.floor[d.cell];
            d.found = false;
        }
        this.flowWalk = new Float32Array(this.N).fill(Infinity);
        this.flowFly = new Float32Array(this.N).fill(Infinity);
        this.flowTarget = -1;
        this._heapK = new Int32Array(this.N * 8);
        this._heapP = new Float32Array(this.N * 8);
        this.events = [];   // door sounds etc., drained by the game
    }

    cellAt(x, z) {
        const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
        if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.H) return -1;
        return cz * this.W + cx;
    }

    cellCenter(i) { return [((i % this.W) + 0.5) * CELL, (((i / this.W) | 0) + 0.5) * CELL]; }

    floorAt(i) { return this.L.floor[i]; }

    /** Ceiling as far as bodies are concerned (doors lower it). */
    ceilAt(i) {
        const L = this.L;
        const d = L.door[i];
        if (d >= 0) {
            const door = L.doors[d];
            return L.floor[i] + door.open * door.h;
        }
        return L.ceil[i];
    }

    /** Does cell i block a body with feet at feetY, height h, able to step `step`? */
    blocks(i, feetY, h, step, fly = false) {
        if (i < 0 || !this.L.open[i]) return true;
        const f = this.L.floor[i];
        if (!fly && f - feetY > step + 1e-4) return true;
        if (fly && f > feetY + 0.05) return true;
        const c = this.ceilAt(i);
        if (c - Math.max(feetY, f) < h) return true;
        return false;
    }

    /**
     * Move a body {x, z, y, r, h} by (dx, dz). Returns {hitX, hitZ, bumped: [cells]}.
     * fly bodies are blocked by floors above their feet instead of stepping.
     */
    move(e, dx, dz, step = STEP, fly = false) {
        const out = { hitX: false, hitZ: false, bumped: null };
        // sub-step so fast things never skip a cell
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (CELL * 0.4)));
        const sx = dx / n, sz = dz / n;
        for (let k = 0; k < n; k++) {
            if (sx) {
                const nx = e.x + sx;
                const b = this._boxBlocked(nx, e.z, e.r, e.y, e.h, step, fly);
                if (b < 0) e.x = nx;
                else {
                    out.hitX = true; out.bumped = b;
                    // slide flush against the blocking cell — but only along the way we
                    // were going; a body already overlapping a wall must never be
                    // snapped to its far side
                    const cx = b % this.W;
                    const flush = sx > 0 ? cx * CELL - e.r - 0.001 : (cx + 1) * CELL + e.r + 0.001;
                    if (sx > 0 ? flush > e.x && flush <= nx : flush < e.x && flush >= nx) e.x = flush;
                }
            }
            if (sz) {
                const nz = e.z + sz;
                const b = this._boxBlocked(e.x, nz, e.r, e.y, e.h, step, fly);
                if (b < 0) e.z = nz;
                else {
                    out.hitZ = true; out.bumped = b;
                    const cz = (b / this.W) | 0;
                    const flush = sz > 0 ? cz * CELL - e.r - 0.001 : (cz + 1) * CELL + e.r + 0.001;
                    if (sz > 0 ? flush > e.z && flush <= nz : flush < e.z && flush >= nz) e.z = flush;
                }
            }
        }
        return out;
    }

    _boxBlocked(x, z, r, feetY, h, step, fly) {
        const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
        const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
        for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
            if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.H) return 0;
            const i = cz * this.W + cx;
            if (this.blocks(i, feetY, h, step, fly)) return i;
        }
        return -1;
    }

    /** Highest floor under a box (the ground you stand on). */
    groundUnder(x, z, r) {
        const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
        const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
        let g = -Infinity;
        for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
            const i = cz * this.W + cx;
            if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.H || !this.L.open[i]) continue;
            if (this.L.floor[i] > g) g = this.L.floor[i];
        }
        return g === -Infinity ? 0 : g;
    }

    /** Lowest ceiling over a box. */
    ceilOver(x, z, r) {
        const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
        const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
        let c = Infinity;
        for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
            const i = cz * this.W + cx;
            if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.H || !this.L.open[i]) continue;
            const ci = this.ceilAt(i);
            if (ci < c) c = ci;
        }
        return c;
    }

    // ------------------------------------------------------------------ rays

    /**
     * Cast a ray through the grid. Returns {t, x, y, z, nx, ny, nz, cell, what}
     * where what ∈ 'wall' | 'floor' | 'ceil' | 'door' | 'sky' | 'none'.
     */
    raycast(ox, oy, oz, dx, dy, dz, maxT) {
        const L = this.L, W = this.W;
        let cx = Math.floor(ox / CELL), cz = Math.floor(oz / CELL);
        const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
        const tdx = Math.abs(CELL / (dx || 1e-9)), tdz = Math.abs(CELL / (dz || 1e-9));
        let tmx = dx > 0 ? ((cx + 1) * CELL - ox) / dx : dx < 0 ? (cx * CELL - ox) / dx : Infinity;
        let tmz = dz > 0 ? ((cz + 1) * CELL - oz) / dz : dz < 0 ? (cz * CELL - oz) / dz : Infinity;
        let t0 = 0;
        let axis = -1;
        for (let n = 0; n < 512; n++) {
            if (cx < 0 || cz < 0 || cx >= W || cz >= this.H) return this._hit(ox, oy, oz, dx, dy, dz, t0, -1, 'wall', axis, stepX, stepZ);
            const i = cz * W + cx;
            if (!L.open[i]) return this._hit(ox, oy, oz, dx, dy, dz, t0, i, 'wall', axis, stepX, stepZ);
            const t1 = Math.min(tmx, tmz, maxT);
            const f = L.floor[i];
            const isDoor = L.door[i] >= 0;
            const c = isDoor ? this.ceilAt(i) : L.ceil[i];
            const y0 = oy + dy * t0, y1 = oy + dy * t1;
            // entering below floor / above ceiling at the boundary = a step face or lintel
            if (y0 < f - 1e-4) return this._hit(ox, oy, oz, dx, dy, dz, t0, i, 'wall', axis, stepX, stepZ);
            if (y0 > c + 1e-4) {
                if (L.sky[i] && !isDoor) return this._hit(ox, oy, oz, dx, dy, dz, t0, i, 'sky', axis, stepX, stepZ);
                return this._hit(ox, oy, oz, dx, dy, dz, t0, i, isDoor ? 'door' : 'wall', axis, stepX, stepZ);
            }
            if (y1 < f && dy < 0) {
                const t = (f - oy) / dy;
                return { t, x: ox + dx * t, y: f, z: oz + dz * t, nx: 0, ny: 1, nz: 0, cell: i, what: 'floor' };
            }
            if (y1 > c && dy > 0) {
                const t = (c - oy) / dy;
                if (L.sky[i] && !isDoor) return { t, x: ox + dx * t, y: c, z: oz + dz * t, nx: 0, ny: -1, nz: 0, cell: i, what: 'sky' };
                return { t, x: ox + dx * t, y: c, z: oz + dz * t, nx: 0, ny: -1, nz: 0, cell: i, what: isDoor ? 'door' : 'ceil' };
            }
            if (t1 >= maxT) return { t: maxT, x: ox + dx * maxT, y: oy + dy * maxT, z: oz + dz * maxT, nx: 0, ny: 0, nz: 0, cell: i, what: 'none' };
            t0 = t1;
            if (tmx < tmz) { cx += stepX; tmx += tdx; axis = 0; }
            else { cz += stepZ; tmz += tdz; axis = 1; }
        }
        return { t: maxT, x: ox + dx * maxT, y: oy + dy * maxT, z: oz + dz * maxT, nx: 0, ny: 0, nz: 0, cell: -1, what: 'none' };
    }

    _hit(ox, oy, oz, dx, dy, dz, t, cell, what, axis, sx, sz) {
        const nx = axis === 0 ? -sx : 0, nz = axis === 1 ? -sz : 0;
        return { t, x: ox + dx * t, y: oy + dy * t, z: oz + dz * t, nx, ny: 0, nz, cell, what };
    }

    /** Clear line between two points? */
    los(ax, ay, az, bx, by, bz) {
        const dx = bx - ax, dy = by - ay, dz = bz - az;
        const d = Math.hypot(dx, dy, dz);
        if (d < 1e-3) return true;
        const h = this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d);
        return h.t >= d - 0.05;
    }

    // ------------------------------------------------------------------ doors

    /** Try to open the door in cell i on behalf of a body. who: 'player' | 'monster'. */
    openDoor(i, who, keys) {
        const L = this.L;
        const di = L.door[i];
        if (di < 0) return 'none';
        const d = L.doors[di];
        if (d.secret) {
            if (who !== 'player') return 'locked';
            if (d.state === 'closed') {
                d.state = 'opening'; d.timer = 0; d.stay = true;
                this.events.push({ type: 'secret', door: d });
            }
            return 'open';
        }
        if (d.key && !(keys && keys.has(d.key))) {
            return who === 'player' ? 'locked:' + d.key : 'locked';
        }
        if (d.state === 'closed' || d.state === 'closing') {
            if (d.state === 'closed') this.events.push({ type: 'door', door: d, open: true });
            d.state = 'opening';
        }
        d.timer = 0;
        return 'open';
    }

    updateDoors(dt, occupied) {
        for (const d of this.L.doors) {
            if (d.state === 'opening') {
                d.open = Math.min(1, d.open + dt * 2.4);
                if (d.open >= 1) { d.state = 'open'; d.timer = 0; }
            } else if (d.state === 'open') {
                if (d.stay) continue;
                d.timer += dt;
                if (d.timer > 4 && !occupied(d.cell)) { d.state = 'closing'; this.events.push({ type: 'door', door: d, open: false }); }
            } else if (d.state === 'closing') {
                if (occupied(d.cell)) { d.state = 'opening'; continue; }
                d.open = Math.max(0, d.open - dt * 2.0);
                if (d.open <= 0) d.state = 'closed';
            }
        }
    }

    // ------------------------------------------------------------------ AI fields

    /** Dijkstra flow fields from the target cell, for walkers and fliers. */
    computeFlow(target, keysForDoors) {
        this.flowTarget = target;
        this._dijkstra(target, this.flowWalk, false, keysForDoors);
        this._dijkstra(target, this.flowFly, true, keysForDoors);
    }

    _dijkstra(src, dist, fly, keys) {
        const L = this.L, W = this.W;
        dist.fill(Infinity);
        if (src < 0) return;
        const hk = this._heapK, hp = this._heapP;
        let n = 0;
        const push = (k, p) => {
            let i = n++;
            hk[i] = k; hp[i] = p;
            while (i > 0) { const par = (i - 1) >> 1; if (hp[par] <= hp[i]) break; const tk = hk[i], tp = hp[i]; hk[i] = hk[par]; hp[i] = hp[par]; hk[par] = tk; hp[par] = tp; i = par; }
        };
        const pop = () => {
            const top = hk[0];
            n--;
            if (n > 0) {
                hk[0] = hk[n]; hp[0] = hp[n];
                let i = 0;
                for (;;) {
                    const l = i * 2 + 1, r = l + 1; let m = i;
                    if (l < n && hp[l] < hp[m]) m = l;
                    if (r < n && hp[r] < hp[m]) m = r;
                    if (m === i) break;
                    const tk = hk[i], tp = hp[i]; hk[i] = hk[m]; hp[i] = hp[m]; hk[m] = tk; hp[m] = tp; i = m;
                }
            }
            return top;
        };
        dist[src] = 0; push(src, 0);
        while (n > 0) {
            const a = pop();
            const da = dist[a];
            const ax = a % W, ay = (a / W) | 0;
            for (const [dx, dy, c] of DIR8) {
                const bx = ax + dx, by = ay + dy;
                if (bx < 0 || by < 0 || bx >= W || by >= this.H) continue;
                const b = by * W + bx;
                if (!L.open[b]) continue;
                if (dx && dy && (!L.open[a + dx] || !L.open[a + dy * W])) continue;
                // the field is walked from b to a (towards the target)
                if (!fly) {
                    if (L.floor[a] - L.floor[b] > STEP + 1e-4) continue;
                    if (dx && dy && (Math.abs(L.floor[a + dx] - L.floor[b]) > STEP || Math.abs(L.floor[a + dy * W] - L.floor[b]) > STEP)) continue;
                }
                const di = L.door[b];
                if (di >= 0) {
                    const d = L.doors[di];
                    if (d.secret && d.state === 'closed') continue;
                    if (d.key && d.open < 0.9 && !(keys && keys.has(d.key))) continue;
                }
                let cost = c;
                if (L.liquid[b] && !fly) cost += 6;
                if (L.kind[b] === 1 && !fly) continue;   // crates
                const nd = da + cost;
                if (nd < dist[b]) { dist[b] = nd; push(b, nd); }
            }
        }
    }

    /** Best neighbouring cell to step towards the flow target from cell i. */
    flowStep(i, fly) {
        const dist = fly ? this.flowFly : this.flowWalk;
        const W = this.W;
        let best = -1, bd = dist[i];
        const ax = i % W, ay = (i / W) | 0;
        for (const [dx, dy] of DIR8) {
            const bx = ax + dx, by = ay + dy;
            if (bx < 0 || by < 0 || bx >= W || by >= this.H) continue;
            const b = by * W + bx;
            if (dist[b] < bd) { bd = dist[b]; best = b; }
        }
        return best;
    }

    /** Cells a noise at cell `src` reaches within `radius` cells (through open space and open doors). */
    soundReach(src, radius) {
        const L = this.L, W = this.W;
        const seen = new Map([[src, 0]]);
        const q = [src];
        while (q.length) {
            const a = q.shift();
            const d = seen.get(a);
            if (d >= radius) continue;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const b = a + dx + dy * W;
                if (seen.has(b) || !L.open[b]) continue;
                const di = L.door[b];
                if (di >= 0 && L.doors[di].open < 0.3) continue;
                seen.set(b, d + 1); q.push(b);
            }
        }
        return seen;
    }
}
