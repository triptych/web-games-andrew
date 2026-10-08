/**
 * colliders.js — static collision shapes in a 2D spatial hash.
 *
 * Shapes: { t: 'c', x, z, r, y0, y1 } circles (trees, rocks, pillars) and
 * { t: 'b', x, z, hw, hd, c, s, y0, y1, walk } boxes rotated by angle (c = cos, s = sin).
 * A box with `walk` is also a floor: anyone whose feet are within a step of its top stands on it.
 * `ramp: [y0, y1]` makes the top slope along the box's local z axis.
 */

const CELL = 16;

export class Colliders {
    constructor() {
        this.cells = new Map();
        this.all = [];
        this._seen = 0;
    }

    key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }

    add(s) {
        if (s.t === 'b') {
            s.c = Math.cos(s.rot || 0); s.s = Math.sin(s.rot || 0);
            s.br = Math.hypot(s.hw, s.hd);
        } else s.br = s.r;
        s.id = this.all.length;
        s.mark = 0;
        this.all.push(s);
        const x0 = Math.floor((s.x - s.br) / CELL), x1 = Math.floor((s.x + s.br) / CELL);
        const z0 = Math.floor((s.z - s.br) / CELL), z1 = Math.floor((s.z + s.br) / CELL);
        for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
            const k = this.key(ix, iz);
            let arr = this.cells.get(k);
            if (!arr) { arr = []; this.cells.set(k, arr); }
            arr.push(s);
        }
        return s;
    }

    remove(s) {
        s.dead = true;
    }

    /** Shapes whose bounds come within r of (x, z). */
    query(x, z, r, out = []) {
        out.length = 0;
        const mark = ++this._seen;
        const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
        const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
        for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
            const arr = this.cells.get(this.key(ix, iz));
            if (!arr) continue;
            for (const s of arr) {
                if (s.mark === mark || s.dead) continue;
                s.mark = mark;
                const dx = s.x - x, dz = s.z - z, rr = s.br + r;
                if (dx * dx + dz * dz <= rr * rr) out.push(s);
            }
        }
        return out;
    }

    /** Top height of a walkable box at (x, z), or -Infinity. */
    static topAt(s, x, z) {
        const dx = x - s.x, dz = z - s.z;
        const lx = dx * s.c + dz * s.s, lz = -dx * s.s + dz * s.c;
        if (Math.abs(lx) > s.hw || Math.abs(lz) > s.hd) return -Infinity;
        if (s.ramp) return s.ramp[0] + (s.ramp[1] - s.ramp[0]) * (lz + s.hd) / (2 * s.hd);
        return s.y1;
    }

    /**
     * Push a cylinder (x, z, r, feet..head) out of the shapes it overlaps. Returns the corrected
     * position and whether anything was hit. Shapes the feet are standing on are floors, not walls.
     */
    resolve(p, r, feet, head, step = 0.45, tmp = []) {
        let hit = false;
        const near = this.query(p.x, p.z, r + 0.5, tmp);
        for (let pass = 0; pass < 2; pass++) {
            for (const s of near) {
                if (head < s.y0 || feet > s.y1 - 0.01) continue;
                if (s.t === 'c') {
                    const dx = p.x - s.x, dz = p.z - s.z;
                    const d = Math.hypot(dx, dz), m = s.r + r;
                    if (d < m) {
                        if (d < 1e-4) { p.x += m; continue; }
                        p.x = s.x + dx / d * m; p.z = s.z + dz / d * m;
                        hit = true;
                    }
                } else {
                    const top = s.walk ? Colliders.topAt(s, p.x, p.z) : -Infinity;
                    if (s.walk && feet >= (top === -Infinity ? s.y1 : top) - step) continue;
                    const dx = p.x - s.x, dz = p.z - s.z;
                    let lx = dx * s.c + dz * s.s, lz = -dx * s.s + dz * s.c;
                    const ox = s.hw + r - Math.abs(lx), oz = s.hd + r - Math.abs(lz);
                    if (ox > 0 && oz > 0) {
                        // closest point on the box, for rounded corners
                        const cx = Math.max(-s.hw, Math.min(s.hw, lx)), cz = Math.max(-s.hd, Math.min(s.hd, lz));
                        const ex = lx - cx, ez = lz - cz, ed = Math.hypot(ex, ez);
                        if (ed > 1e-4) {
                            if (ed >= r) continue;
                            lx = cx + ex / ed * r; lz = cz + ez / ed * r;
                        } else if (ox < oz) lx += Math.sign(lx || 1) * ox;
                        else lz += Math.sign(lz || 1) * oz;
                        p.x = s.x + lx * s.c - lz * s.s;
                        p.z = s.z + lx * s.s + lz * s.c;
                        hit = true;
                    }
                }
            }
        }
        return hit;
    }

    /** Highest walkable top under (x, z) that the feet can reach. */
    floorAt(x, z, feet, step = 0.45, tmp = []) {
        let best = -Infinity;
        for (const s of this.query(x, z, 0.3, tmp)) {
            if (!s.walk || s.t !== 'b') continue;
            const top = Colliders.topAt(s, x, z);
            if (top > best && top <= feet + step) best = top;
        }
        return best;
    }

    /** Segment test for line of sight / projectiles: returns t of first hit in [0,1] or -1. */
    raycast(ax, ay, az, bx, by, bz, tmp = []) {
        const mx = (ax + bx) / 2, mz = (az + bz) / 2, len = Math.hypot(bx - ax, bz - az);
        let best = -1;
        for (const s of this.query(mx, mz, len / 2 + 1, tmp)) {
            const steps = Math.max(2, Math.ceil(len / 0.5));
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
                if (y < s.y0 || y > s.y1) continue;
                let inside = false;
                if (s.t === 'c') inside = (x - s.x) ** 2 + (z - s.z) ** 2 < s.r * s.r;
                else {
                    const dx = x - s.x, dz = z - s.z;
                    inside = Math.abs(dx * s.c + dz * s.s) < s.hw && Math.abs(-dx * s.s + dz * s.c) < s.hd;
                }
                if (inside) { if (best < 0 || t < best) best = t; break; }
            }
        }
        return best;
    }
}
