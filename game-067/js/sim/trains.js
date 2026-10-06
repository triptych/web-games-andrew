/**
 * trains.js — trains running on the island's track.
 *
 * A train is a list of traversals (one per tile it covers, head first) and `h`, how far the head has
 * gone into the first one. Moving forward adds traversals at the front as the head crosses into new
 * tiles (asking each tile's switch which way to go) and drops them off the back. Reversing flips the
 * list, so a train can shunt back out of a dead end. Cars are placed by distance back from the head,
 * with two bogies each, so they bend naturally through curves.
 *
 * Trains never crash. Each looks a few tiles ahead and brakes for: the end of the line (then waits
 * and reverses), a tile another train is on (then waits; two trains nose to nose take turns backing
 * off), and stations (then stops with the head near the far end of the platform, lets people on and
 * off, and sets off again).
 */

import { N, SPEEDS, ACCEL, BRAKE, DWELL, MAX_TRAINS } from '../config.js';
import { DX, DZ, opp, SEGS, segIndex, travLen, travPoint, idx, inb, tileX, tileZ } from './grid.js';
import { ENGINES, CARS, GAP, trainLength, capacity, cleanDesign } from './trainsets.js';

const mk = (x, z, from, to) => ({ x, z, from, to, len: travLen(from, to) });
const flip = (t) => mk(t.x, t.z, t.to, t.from);

export class TrainSystem {
    constructor(world) {
        this.world = world;
        this.list = [];
        this.nextId = 1;
        this.occ = new Map();     // tile index → train id
        this._p = {};
    }

    get(id) { return this.list.find((t) => t.id === id) || null; }

    usesTile(i) { return this.occ.has(i); }

    /** Tiles under a train's body, head first. */
    bodyTiles(t, out = []) {
        out.length = 0;
        let cum = t.h;
        for (let k = 0; k < t.path.length; k++) {
            out.push(idx(t.path[k].x, t.path[k].z));
            if (cum >= t.len) break;
            if (k + 1 < t.path.length) cum += t.path[k + 1].len;
        }
        return out;
    }

    /** Tile → train map: every tile under a train, plus the one tile each train has reserved ahead. */
    rebuildOcc() {
        this.occ.clear();
        const tmp = [];
        for (const t of this.list) for (const i of this.bodyTiles(t, tmp)) this.occ.set(i, t.id);
        for (const t of this.list) if (t.resv >= 0 && !this.occ.has(t.resv)) this.occ.set(t.resv, t.id);
    }

    /**
     * Claim the tile ahead once the head is close enough that it would need to start braking for it.
     * Trains update one after another, so without this two trains could step into the same free
     * tile in the same tick from opposite sides.
     */
    reserve(t) {
        const nxt = this.next(t.path[0]);
        t.resv = -1;
        if (!nxt) return;
        const ni = idx(nxt.x, nxt.z);
        const owner = this.occ.get(ni);
        if (owner !== undefined && owner !== t.id) return;
        const left = t.path[0].len - t.h;
        if (left < (t.v * t.v) / (2 * BRAKE) + 0.6) { t.resv = ni; this.occ.set(ni, t.id); }
    }

    claim(t) {
        for (const i of this.bodyTiles(t, this._tmp || (this._tmp = []))) this.occ.set(i, t.id);
        this.reserve(t);
    }

    /** Next traversal after `cur` given the current switch settings, or null at the end of the line. */
    next(cur) {
        const nx = cur.x + DX[cur.to], nz = cur.z + DZ[cur.to];
        if (!inb(nx, nz)) return null;
        const entry = opp(cur.to);
        const ex = this.world.route(nx, nz, entry);
        return ex < 0 ? null : mk(nx, nz, entry, ex);
    }

    /** Put a train set on the track at tile (x,z). Returns the train, or a reason string. */
    place(designIn, x, z, prefer = -1) {
        const W = this.world;
        if (this.list.length >= MAX_TRAINS) return 'full';
        const design = cleanDesign(designIn);
        if (!design) return 'bad';
        if (!inb(x, z) || !W.track[idx(x, z)]) return 'notrack';
        const L = trainLength(design);
        const bits = W.track[idx(x, z)];
        const options = [];
        for (let s = 0; s < 6; s++) if (bits & (1 << s)) options.push([SEGS[s][0], SEGS[s][1]], [SEGS[s][1], SEGS[s][0]]);
        if (prefer >= 0) options.sort((a, b) => (b[1] === prefer) - (a[1] === prefer));
        let reason = 'short';
        for (const [a, b] of options) {
            const head = mk(x, z, a, b);
            const path = [head];
            let cum = head.len * 0.6, cur = head, ok = true;
            while (cum < L + 0.2) {
                const bx = cur.x + DX[cur.from], bz = cur.z + DZ[cur.from];
                if (!inb(bx, bz)) { ok = false; break; }
                const entry = opp(cur.from);
                const ex = W.route(bx, bz, entry);
                if (ex < 0) { ok = false; break; }
                const prev = mk(bx, bz, ex, entry);
                path.push(prev); cum += prev.len; cur = prev;
                if (path.length > 60) { ok = false; break; }
            }
            if (!ok) continue;
            const tiles = path.map((p) => idx(p.x, p.z));
            if (new Set(tiles).size !== tiles.length) continue;
            if (tiles.some((i) => this.occ.has(i))) { reason = 'busy'; continue; }
            const t = this._make(design, path, head.len * 0.6);
            this.list.push(t);
            this.rebuildOcc();
            W.emit('trainPlaced', { id: t.id, name: design.name });
            return t;
        }
        return reason;
    }

    _make(design, path, h) {
        return {
            id: this.nextId++, design, path, h, len: trainLength(design), cap: capacity(design),
            v: 0, level: 1, running: true, stopStations: true, flip: false,
            state: 'run', timer: 0, waitT: 0, blocker: 0, resv: -1, ignore: new Set(), riders: 0, odo: 0, dwellAt: -1,
        };
    }

    remove(id) {
        const k = this.list.findIndex((t) => t.id === id);
        if (k < 0) return null;
        const [t] = this.list.splice(k, 1);
        this.rebuildOcc();
        this.world.people.trainGone(t);
        this.world.emit('trainRemoved', { id, name: t.design.name });
        return t;
    }

    /** Drop trains whose track has gone (after undo or an erase). Returns their names. */
    validate() {
        const gone = [];
        const tmp = [];
        for (const t of [...this.list]) {
            this.bodyTiles(t, tmp);
            const bad = t.path.slice(0, tmp.length).some((p) => !(this.world.track[idx(p.x, p.z)] & (1 << segIndex(p.from, p.to))));
            if (bad) { gone.push(t.design.name); this.remove(t.id); }
        }
        this.rebuildOcc();
        return gone;
    }

    /** Turn a train round where it stands: the last car becomes the front. */
    reverse(t) {
        let rem = t.len, k = 0, offset = 0;
        if (rem <= t.h) offset = t.h - rem;
        else {
            rem -= t.h; k = 1;
            for (; k < t.path.length; k++) {
                if (rem <= t.path[k].len) { offset = t.path[k].len - rem; break; }
                rem -= t.path[k].len;
            }
            if (k >= t.path.length) { k = t.path.length - 1; offset = 0; }
        }
        const old = t.path[k];
        t.path = t.path.slice(0, k + 1).reverse().map(flip);
        t.h = old.len - offset;
        t.flip = !t.flip;
        t.v = 0; t.waitT = 0; t.resv = -1;
        t.state = 'run';
        this.rebuildOcc();
        this.world.emit('reverse', { id: t.id });
    }

    stationHere(t, p) {
        const i = idx(p.x, p.z);
        return t.stopStations && this.world.station[i] && (p.from ^ p.to) === 2 && !t.ignore.has(i);
    }

    /** Look ahead along the route: distance to where the train must stop, and why. */
    scan(t, maxD) {
        let cur = t.path[0];
        let dist = cur.len - t.h;
        let inSt = this.stationHere(t, cur);
        let stEnd = inSt ? dist - 0.2 : 0;
        for (let step = 0; step < 14; step++) {
            if (dist > maxD && !inSt) return null;
            const nxt = this.next(cur);
            if (!nxt) return inSt ? { dist: Math.min(stEnd, dist - 0.06), reason: 'station' } : { dist: dist - 0.06, reason: 'end' };
            const owner = this.occ.get(idx(nxt.x, nxt.z));
            if (owner && owner !== t.id) {
                const d = dist - 0.12;
                return inSt && stEnd <= d ? { dist: stEnd, reason: 'station' } : { dist: d, reason: 'block', blocker: owner };
            }
            if (this.stationHere(t, nxt)) { inSt = true; stEnd = dist + nxt.len - 0.2; }
            else if (inSt) return { dist: stEnd, reason: 'station' };
            dist += nxt.len;
            cur = nxt;
        }
        return inSt ? { dist: stEnd, reason: 'station' } : null;
    }

    advance(t, d) {
        t.h += d;
        t.odo += d;
        this.world.stats.distance += d;
        let guard = 0;
        while (t.h > t.path[0].len && guard++ < 8) {
            const cur = t.path[0];
            const nxt = this.next(cur);
            if (!nxt) { t.h = cur.len; break; }
            t.h -= cur.len;
            t.path.unshift(nxt);
            if (!this.world.station[idx(nxt.x, nxt.z)]) t.ignore.clear();
        }
        let cum = t.h, k = 1;
        while (k < t.path.length && cum < t.len + 0.3) { cum += t.path[k].len; k++; }
        t.path.length = k;
    }

    step(dt) {
        this.rebuildOcc();
        for (const t of this.list) { this.update(t, dt); this.claim(t); }
    }

    update(t, dt) {
        const W = this.world;
        if (t.state === 'dwell') {
            t.timer -= dt;
            if (t.timer <= 0 || !t.stopStations) {
                for (const i of W.stationBlock(t.dwellAt)) t.ignore.add(i);
                t.state = 'run';
                W.emit('depart', { id: t.id });
            }
            return;
        }
        if (t.state === 'turn') {
            t.timer -= dt;
            if (t.timer <= 0) this.reverse(t);
            return;
        }
        const target = t.running ? SPEEDS[t.level] : 0;
        const sc = this.scan(t, 7);
        let allowed = target;
        if (sc) allowed = Math.min(allowed, Math.sqrt(2 * BRAKE * Math.max(0, sc.dist)));
        if (t.v < allowed) t.v = Math.min(allowed, t.v + ACCEL * dt);
        else t.v = Math.max(allowed, t.v - BRAKE * 2.5 * dt);
        let move = t.v * dt;
        if (sc) move = Math.min(move, Math.max(0, sc.dist));
        if (move > 0) this.advance(t, move);

        const stopped = sc && sc.dist - move < 0.03 && t.v < 0.12;
        if (stopped && t.running) {
            t.v = 0;
            if (sc.reason === 'station') {
                t.state = 'dwell'; t.timer = DWELL;
                t.dwellAt = idx(t.path[0].x, t.path[0].z);
                W.people.trainArrived(t, W.stationBlock(t.dwellAt));
                W.emit('arrive', { id: t.id, station: W.stationNames.get(t.dwellAt) || '' });
            } else if (sc.reason === 'end') {
                t.state = 'turn'; t.timer = 1.1;
                W.emit('buffer', { id: t.id });
            } else {
                t.waitT += dt;
                t.blocker = sc.blocker;
                const other = this.get(sc.blocker);
                const mutual = other && other.blocker === t.id && other.waitT > 0;
                if ((mutual && t.id < other.id && t.waitT > 1.5) || t.waitT > 9) this.reverse(t);
            }
        } else {
            t.waitT = 0; t.blocker = 0;
        }
    }

    /**
     * World-space poses of every vehicle, front of the train first: { x, z, yaw, kind, type, index }.
     * yaw is the heading a vehicle model built facing +x needs (rotation.y).
     */
    poses(t, out = []) {
        out.length = 0;
        const d = t.design;
        const order = [{ kind: 'engine', type: d.engine, len: ENGINES[d.engine].len, index: -1 }, ...d.cars.map((c, i) => ({ kind: 'car', type: c.type, len: CARS[c.type].len, index: i }))];
        if (t.flip) order.reverse();
        let s = 0;
        const a = this._p, b = {};
        for (const v of order) {
            const c = s + v.len / 2;
            const bog = v.len * 0.3;
            this.pointAt(t, c - bog, a);
            const ax = a.x, az = a.z;
            this.pointAt(t, c + bog, b);
            let yaw = -Math.atan2(az - b.z, ax - b.x);
            if (t.flip) yaw += Math.PI;
            out.push({ x: (ax + b.x) / 2, z: (az + b.z) / 2, yaw, kind: v.kind, type: v.type, index: v.index });
            s += v.len + GAP;
        }
        return out;
    }

    /** World position at distance d behind the head. */
    pointAt(t, d, out = {}) {
        let k = 0, u;
        if (d <= t.h) u = (t.h - d) / t.path[0].len;
        else {
            d -= t.h; k = 1;
            for (; k < t.path.length; k++) {
                const L = t.path[k].len;
                if (d <= L) { u = (L - d) / L; break; }
                d -= L;
            }
            if (k >= t.path.length) { k = t.path.length - 1; u = 0; }
        }
        const p = t.path[k];
        travPoint(p.from, p.to, Math.max(0, Math.min(1, u)), out);
        out.x += tileX(p.x);
        out.z += tileZ(p.z);
        return out;
    }

    // ------------------------------------------------------------------ persistence
    serialize() {
        return this.list.map((t) => ({
            d: t.design, p: t.path.map((q) => [q.x, q.z, q.from, q.to]), h: t.h,
            lv: t.level, run: t.running, st: t.stopStations, fl: t.flip,
        }));
    }

    load(arr) {
        this.list = [];
        for (const s of arr) {
            const design = cleanDesign(s.d);
            if (!design || !Array.isArray(s.p) || !s.p.length) continue;
            const path = [];
            let ok = true;
            for (const q of s.p) {
                const [x, z, from, to] = q;
                if (!inb(x, z) || !(from >= 0 && from < 4 && to >= 0 && to < 4) || from === to) { ok = false; break; }
                path.push(mk(x, z, from, to));
            }
            if (!ok) continue;
            const t = this._make(design, path, Math.max(0, Math.min(path[0].len, Number(s.h) || 0)));
            t.level = [0, 1, 2].includes(s.lv) ? s.lv : 1;
            t.running = s.run !== false;
            t.stopStations = s.st !== false;
            t.flip = !!s.fl;
            this.list.push(t);
        }
        this.validate();
    }
}

export { N };
