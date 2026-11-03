// A walkability grid for auto-walks, so a click never sends the player into a
// dead end: straight legs that would run into a statue, a hedge niche, a wall
// or the sea are re-routed with A* around it.
//
// Cells are worked out lazily, the first time a search or a sight line touches
// them, so the grid costs nothing at load and only ever covers the ground that
// walks actually explore. A cell is open when the player's circle fits there
// (colliders grown by the player's radius) and it is not open sea; a step from
// one cell to the next is refused when it climbs more than the controller can.

const CELL = 0.5;
const MARGIN = 0.36;      // the player's radius (0.32) and a hair more
const LINE_MARGIN = 0.34;  // clearance a straight leg keeps from colliders
const MAX_RISE = 0.9;     // a rise between cells that is surely walkable
const LEDGE = 0.4;        // a rise this sudden in 10 cm is a ledge (the controller refuses 1 m in a stride)
const MAX_EXPAND = 160000;

const UNKNOWN = 0, OPEN = 1, SHUT = 2;

export class NavGrid {
    /**
     * @param {object} world  needs walkHeight, onDeck, island.heightAt, collidersNear
     * @param {number} radius the grid covers the square [-radius, radius] in x and z
     */
    constructor(world, radius) {
        this.world = world;
        this.n = Math.ceil((radius * 2) / CELL);
        this.x0 = -radius;
        this.z0 = -radius;
        const size = this.n * this.n;
        this.state = new Uint8Array(size);
        this.h = new Float32Array(size);
        // A* scratch, stamped per search so nothing needs clearing
        this.g = new Float32Array(size);
        this.from = new Int32Array(size);
        this.seen = new Uint32Array(size);
        this.closed = new Uint32Array(size);
        this.stamp = 0;
        this.heap = new Heap();
    }

    /** Forget every cell (call after colliders or floors change). */
    reset() {
        this.state.fill(UNKNOWN);
    }

    cellOf(x, z) {
        const i = Math.floor((x - this.x0) / CELL), j = Math.floor((z - this.z0) / CELL);
        if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
        return j * this.n + i;
    }

    cx(c) {
        return this.x0 + ((c % this.n) + 0.5) * CELL;
    }

    cz(c) {
        return this.z0 + (Math.floor(c / this.n) + 0.5) * CELL;
    }

    /** Is the cell's centre somewhere the player can stand? Also fills its height. */
    open(c) {
        if (c < 0) return false;
        const s = this.state[c];
        if (s !== UNKNOWN) return s === OPEN;
        const w = this.world, x = this.cx(c), z = this.cz(c);
        // sea anywhere in the cell shuts it: rocky shores change height fast
        let ok = true;
        for (const [ox, oz] of SEA_PROBES) {
            const px = x + ox, pz = z + oz;
            if (w.island.heightAt(px, pz) < 0.35 && !w.onDeck(px, pz)) {
                ok = false;
                break;
            }
        }
        if (ok) {
            // the collider lookup is bucketed, so look from the edges of the player's circle too
            outer: for (const [ox, oz] of PROBES) {
                for (const k of w.collidersNear(x + ox, z + oz)) {
                    const r = k.r + MARGIN;
                    if ((x - k.x) ** 2 + (z - k.z) ** 2 < r * r) {
                        ok = false;
                        break outer;
                    }
                }
            }
        }
        this.h[c] = w.walkHeight(x, z);
        this.state[c] = ok ? OPEN : SHUT;
        return ok;
    }

    /**
     * Can the player get from cell a up to cell b? The controller refuses only a sudden step
     * (a metre within one frame's stride), so any slope can be climbed and only a ledge (the
     * rim of a raised floor, a cliff) stops it. A steep pair of cells is checked in fine steps.
     */
    climb(a, b) {
        const rise = this.h[b] - this.h[a];
        if (rise <= MAX_RISE) return true;
        const w = this.world, ax = this.cx(a), az = this.cz(a), bx = this.cx(b), bz = this.cz(b);
        const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1);
        let y = this.h[a];
        for (let k = 1; k <= steps; k++) {
            const t = k / steps;
            const ny = w.walkHeight(ax + (bx - ax) * t, az + (bz - az) * t);
            if (ny - y > LEDGE) return false;
            y = ny;
        }
        return true;
    }

    /** Can one walk in a straight line from (ax,az) to (bx,bz)? */
    clear(ax, az, bx, bz) {
        const len = Math.hypot(bx - ax, bz - az);
        const steps = Math.max(1, Math.ceil(len / (CELL * 0.5)));
        let prev = this.cellOf(ax, az);
        if (prev < 0) return false;
        this.open(prev);
        const w = this.world;
        for (let k = 1; k <= steps; k++) {
            const t = k / steps;
            const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
            // the line itself must clear every collider by the player's radius, not just pass
            // through open cells (a cell's corner can be nearer a post than its centre is)
            for (const k of w.collidersNear(x, z)) {
                const r = k.r + LINE_MARGIN;
                if ((x - k.x) ** 2 + (z - k.z) ** 2 < r * r) return false;
            }
            const c = this.cellOf(x, z);
            if (c === prev) continue;
            if (!this.open(c) || !this.climb(prev, c)) return false;
            prev = c;
        }
        return true;
    }

    /** The open cell nearest (x,z), searching outwards up to `reach` metres; -1 if none. */
    nearestOpen(x, z, reach = 4) {
        const c0 = this.cellOf(x, z);
        if (c0 >= 0 && this.open(c0)) return c0;
        const n = this.n, i0 = Math.floor((x - this.x0) / CELL), j0 = Math.floor((z - this.z0) / CELL);
        const rings = Math.ceil(reach / CELL);
        for (let r = 1; r <= rings; r++) {
            let best = -1, bd = Infinity;
            for (let dj = -r; dj <= r; dj++) {
                for (let di = -r; di <= r; di++) {
                    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
                    const i = i0 + di, j = j0 + dj;
                    if (i < 0 || j < 0 || i >= n || j >= n) continue;
                    const c = j * n + i;
                    if (!this.open(c)) continue;
                    const d = (this.cx(c) - x) ** 2 + (this.cz(c) - z) ** 2;
                    if (d < bd) bd = d, best = c;
                }
            }
            if (best >= 0) return best;
        }
        return -1;
    }

    /**
     * A* from (ax,az) towards (bx,bz). Returns a smoothed list of points ending at
     * the open cell nearest the goal that can be reached (the goal itself is not
     * added), or null when the start is boxed in.
     */
    find(ax, az, bx, bz) {
        const n = this.n;
        let start = this.cellOf(ax, az);
        if (start < 0) return null;
        // standing in a cell the grid calls shut (brushing a collider): start from the nearest open one
        if (!this.open(start)) start = this.nearestOpen(ax, az, 1.5);
        if (start < 0) return null;
        const goal = this.nearestOpen(bx, bz);
        const gx = goal >= 0 ? this.cx(goal) : bx, gz = goal >= 0 ? this.cz(goal) : bz;
        const stamp = ++this.stamp;
        const heap = this.heap;
        heap.clear();
        const hEst = (c) => {
            const dx = Math.abs(this.cx(c) - gx), dz = Math.abs(this.cz(c) - gz);
            return Math.max(dx, dz) + 0.41421356 * Math.min(dx, dz);
        };
        this.g[start] = 0;
        this.from[start] = -1;
        this.seen[start] = stamp;
        heap.push(start, hEst(start));
        let best = start, bestH = hEst(start), expanded = 0;
        while (heap.size) {
            const c = heap.pop();
            if (this.closed[c] === stamp) continue;
            this.closed[c] = stamp;
            if (c === goal) {
                best = c;
                break;
            }
            const hc = hEst(c);
            if (hc < bestH) bestH = hc, best = c;
            if (++expanded > MAX_EXPAND) break;
            const i = c % n, j = (c - i) / n;
            for (let k = 0; k < 8; k++) {
                const di = DI[k], dj = DJ[k];
                const ni = i + di, nj = j + dj;
                if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
                const nc = nj * n + ni;
                if (this.closed[nc] === stamp || !this.open(nc) || !this.climb(c, nc)) continue;
                // no cutting corners past a blocked cell
                if (di && dj && (!this.open(j * n + ni) || !this.open(nj * n + i))) continue;
                const ng = this.g[c] + (di && dj ? 1.41421356 : 1) * CELL;
                if (this.seen[nc] === stamp && ng >= this.g[nc]) continue;
                this.seen[nc] = stamp;
                this.g[nc] = ng;
                this.from[nc] = c;
                heap.push(nc, ng + hEst(nc));
            }
        }
        const cells = [];
        for (let c = best; c >= 0; c = this.from[c]) cells.push(c);
        cells.reverse();
        return this._smooth(ax, az, cells);
    }

    /** String-pull a cell chain into the fewest straight legs that stay clear. */
    _smooth(ax, az, cells) {
        const pts = [];
        let px = ax, pz = az, k = 0;
        while (k < cells.length - 1) {
            let far = k + 1;
            // the farthest cell still in sight (binary search would skip around wiggles, so scan)
            for (let m = cells.length - 1; m > far; m--) {
                if (this.clear(px, pz, this.cx(cells[m]), this.cz(cells[m]))) {
                    far = m;
                    break;
                }
            }
            px = this.cx(cells[far]);
            pz = this.cz(cells[far]);
            pts.push({ x: px, z: pz });
            k = far;
        }
        if (!pts.length && cells.length) pts.push({ x: this.cx(cells[0]), z: this.cz(cells[0]) });
        return pts;
    }

    /**
     * Make a list of waypoints walkable from (x,z). A leg with a clear line is kept
     * as it is and a blocked one gets an A* detour spliced in front of its end
     * point. Every original waypoint stays, so a walk that ends by pressing into a
     * door (inside its collider) still ends there: a leg is only detoured when it
     * is blocked short of the last couple of metres before its end.
     */
    repair(x, z, points) {
        const out = [];
        let px = x, pz = z;
        for (const p of points) {
            const len = Math.hypot(p.x - px, p.z - pz);
            if (len > TAIL) {
                const k = 1 - TAIL / len;
                if (!this.clear(px, pz, px + (p.x - px) * k, pz + (p.z - pz) * k)) {
                    const detour = this.find(px, pz, p.x, p.z);
                    if (detour) out.push(...detour);
                }
            }
            out.push(p);
            px = p.x;
            pz = p.z;
        }
        return out;
    }

    /** Length of a walk through the points from (x,z). */
    static length(x, z, points) {
        let l = 0;
        for (const p of points) {
            l += Math.hypot(p.x - x, p.z - z);
            x = p.x;
            z = p.z;
        }
        return l;
    }
}

const TAIL = 2.5;
const DI = [1, -1, 0, 0, 1, 1, -1, -1];
const DJ = [0, 0, 1, -1, 1, -1, 1, -1];
const PROBES = [[0, 0], [MARGIN, 0], [-MARGIN, 0], [0, MARGIN], [0, -MARGIN]];
const SEA_PROBES = [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3], [0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25]];

/** A binary min-heap of cell ids keyed by f-score. */
class Heap {
    constructor() {
        this.ids = new Int32Array(1024);
        this.keys = new Float32Array(1024);
        this.size = 0;
    }

    clear() {
        this.size = 0;
    }

    push(id, key) {
        if (this.size === this.ids.length) {
            const ids = new Int32Array(this.size * 2), keys = new Float32Array(this.size * 2);
            ids.set(this.ids);
            keys.set(this.keys);
            this.ids = ids;
            this.keys = keys;
        }
        let i = this.size++;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.keys[p] <= key) break;
            this.ids[i] = this.ids[p];
            this.keys[i] = this.keys[p];
            i = p;
        }
        this.ids[i] = id;
        this.keys[i] = key;
    }

    pop() {
        const top = this.ids[0];
        const n = --this.size;
        if (n > 0) {
            const id = this.ids[n], key = this.keys[n];
            let i = 0;
            for (;;) {
                let c = 2 * i + 1;
                if (c >= n) break;
                if (c + 1 < n && this.keys[c + 1] < this.keys[c]) c++;
                if (this.keys[c] >= key) break;
                this.ids[i] = this.ids[c];
                this.keys[i] = this.keys[c];
                i = c;
            }
            this.ids[i] = id;
            this.keys[i] = key;
        }
        return top;
    }
}
