/**
 * people.js — the little brick people who live on the island.
 *
 * Every home has residents. They stroll to nearby tiles (breadth-first paths over walkable land),
 * stop for a moment, and sometimes walk to a station and wait on the platform. When a train stops
 * there, waiting people climb aboard if it has seats, and riders already on board may get off.
 * People never step onto a tile a train is on, so nobody is ever in danger.
 */

import { N, T, MAX_PEOPLE } from '../config.js';
import { DX, DZ, idx, inb } from './grid.js';
import { ITEM, footprint } from './catalog.js';

const SPEED = 0.62;   // tiles per second

export class PeopleSystem {
    constructor(world) {
        this.world = world;
        this.list = [];
        this.nextId = 1;
        this.dirty = true;
        this.spawnT = 0;
        this.target = 0;
        this.homesList = [];
        this._q = new Int32Array(N * N);
        this._par = new Int32Array(N * N);
    }

    residentsChanged() { this.dirty = true; }

    walkable(x, z) {
        if (!inb(x, z)) return false;
        const i = idx(x, z), t = this.world.tiles[i];
        if (t === T.WATER || t === T.ROCK) return false;
        const oid = this.world.objAt[i];
        return oid < 0 || ITEM[this.world.objs.get(oid).type].small;
    }

    homes() {
        const out = [];
        for (const o of this.world.objs.values()) if (ITEM[o.type].res) out.push(o);
        return out;
    }

    /** A walkable tile beside an object's footprint, or null. */
    doorstep(o) {
        const it = ITEM[o.type];
        const [w, d] = footprint(it, o.rot);
        const R = this.world.rng;
        const cands = [];
        for (let x = o.x - 1; x <= o.x + w; x++) for (let z = o.z - 1; z <= o.z + d; z++) {
            const inside = x >= o.x && x < o.x + w && z >= o.z && z < o.z + d;
            const corner = (x === o.x - 1 || x === o.x + w) && (z === o.z - 1 || z === o.z + d);
            if (!inside && !corner && this.walkable(x, z) && !this.world.trains.usesTile(idx(x, z))) cands.push([x, z]);
        }
        return cands.length ? cands[Math.floor(R.next() * cands.length)] : null;
    }

    spawn(home) {
        const at = this.doorstep(home);
        if (!at) return null;
        const R = this.world.rng;
        const p = {
            id: this.nextId++, home: home.id,
            x: at[0] + 0.5, z: at[1] + 0.5, ox: R.range(-0.18, 0.18), oz: R.range(-0.18, 0.18),
            path: [], state: 'idle', timer: R.range(0.3, 2), yaw: R.range(0, Math.PI * 2),
            phase: R.range(0, 6), hop: 0.6, train: 0, station: -1,
            look: { shirt: R.int(0, 15), pants: R.int(0, 15), hat: R.int(0, 6), hair: R.int(0, 4) },
        };
        this.list.push(p);
        this.world.emit('personSpawn', { id: p.id });
        return p;
    }

    step(dt) {
        const W = this.world;
        this.spawnT -= dt;
        this.checkT = (this.checkT || 0) - dt;
        if (this.dirty || this.checkT <= 0) {
            this.dirty = false;
            this.checkT = 3;
            const homes = this.homes();
            const homeIds = new Set(homes.map((h) => h.id));
            // People whose home has gone move away (riders go when they get off: sendHome finds no home).
            this.list = this.list.filter((p) => p.state === 'ride' || homeIds.has(p.home));
            let target = 0;
            for (const h of homes) target += ITEM[h.type].res;
            this.target = Math.min(MAX_PEOPLE, target);
            this.homesList = homes;
        }
        if (this.list.length < this.target && this.spawnT <= 0 && this.homesList.length) {
            const count = new Map();
            for (const p of this.list) count.set(p.home, (count.get(p.home) || 0) + 1);
            const short = this.homesList.filter((h) => (count.get(h.id) || 0) < ITEM[h.type].res);
            if (short.length) this.spawn(short[Math.floor(W.rng.next() * short.length)]);
            this.spawnT = 0.35;
        } else if (this.list.length > this.target) {
            const k = this.list.findIndex((p) => p.state !== 'ride');
            if (k >= 0) this.list.splice(k, 1);
        }
        for (const p of this.list) this.update(p, dt);
    }

    update(p, dt) {
        const W = this.world;
        p.phase += dt * (p.state === 'walk' ? 9 : 2);
        if (p.hop > 0) p.hop = Math.max(0, p.hop - dt);
        if (p.state === 'ride') return;
        if (p.state === 'wave') { p.timer -= dt; if (p.timer <= 0) { p.state = 'idle'; p.timer = 0.5; } return; }
        if (p.state === 'wait') {
            p.timer -= dt;
            if (!W.station[p.station] || p.timer <= 0) { p.state = 'idle'; p.timer = 0.2; p.station = -1; }
            return;
        }
        if (p.state === 'idle') {
            p.timer -= dt;
            if (p.timer <= 0) this.decide(p);
            return;
        }
        // walking
        if (!p.path.length) { this.arrive(p); return; }
        const [tx, tz] = p.path[0];
        if (!this.walkable(tx, tz)) { p.path.length = 0; p.state = 'idle'; p.timer = 0.4; return; }
        const ti = idx(tx, tz);
        if (W.trains.usesTile(ti) && idx(Math.floor(p.x), Math.floor(p.z)) !== ti) {
            p.timer = 0;   // wait for the train to pass
            return;
        }
        const last = p.path.length === 1;
        const gx = tx + 0.5 + (last ? p.ox : p.ox * 0.4), gz = tz + 0.5 + (last ? p.oz : p.oz * 0.4);
        const dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz);
        const step = SPEED * dt;
        if (d <= step) { p.x = gx; p.z = gz; p.path.shift(); }
        else { p.x += (dx / d) * step; p.z += (dz / d) * step; }
        if (d > 0.001) p.yaw = Math.atan2(dx, dz);
    }

    arrive(p) {
        const W = this.world;
        const i = idx(Math.floor(p.x), Math.floor(p.z));
        if (p.station >= 0 && W.station[i] && i === p.station) {
            p.state = 'wait';
            p.timer = 45 + W.rng.range(0, 30);
            // Stand on the platform beside the track, facing it.
            const along = W.track[i] === 1;   // N–S track: platforms east and west
            const side = W.rng.chance(0.5) ? 1 : -1;
            const x0 = i % N, z0 = (i / N) | 0;
            if (along) { p.x = x0 + 0.5 + side * 0.36; p.z = z0 + 0.5 + W.rng.range(-0.3, 0.3); p.yaw = side > 0 ? -Math.PI / 2 : Math.PI / 2; }
            else { p.z = z0 + 0.5 + side * 0.36; p.x = x0 + 0.5 + W.rng.range(-0.3, 0.3); p.yaw = side > 0 ? Math.PI : 0; }
            return;
        }
        p.station = -1;
        p.state = 'idle';
        p.timer = W.rng.range(1.2, 5);
    }

    /** Pick somewhere to go: usually a nearby spot, sometimes a station platform. */
    decide(p) {
        const W = this.world;
        const sx = Math.floor(p.x), sz = Math.floor(p.z);
        if (!inb(sx, sz)) return;
        const wantStation = W.rng.chance(0.35);
        const res = this.bfs(sx, sz, wantStation ? 22 : 7, wantStation);
        if (!res) { p.state = 'idle'; p.timer = W.rng.range(1, 3); return; }
        p.path = res.path;
        p.station = res.station;
        p.state = 'walk';
    }

    /** Breadth-first search from (sx,sz). Returns a path to a random reachable tile, or to a station. */
    bfs(sx, sz, maxDepth, wantStation) {
        const W = this.world;
        const q = this._q, par = this._par;
        par.fill(-2);
        const s = idx(sx, sz);
        let head = 0, tail = 0;
        q[tail++] = s; par[s] = -1;
        const depth = new Map([[s, 0]]);
        const found = [], stations = [];
        while (head < tail && tail < 500) {
            const i = q[head++];
            const x = i % N, z = (i / N) | 0, d = depth.get(i);
            if (d > 1) found.push(i);
            if (W.station[i] && d > 0) stations.push(i);
            if (d >= maxDepth) continue;
            for (let e = 0; e < 4; e++) {
                const nx = x + DX[e], nz = z + DZ[e];
                if (!this.walkable(nx, nz)) continue;
                const j = idx(nx, nz);
                if (par[j] !== -2) continue;
                par[j] = i; depth.set(j, d + 1); q[tail++] = j;
            }
        }
        let goal = -1, station = -1;
        if (wantStation && stations.length) { goal = stations[Math.floor(W.rng.next() * stations.length)]; station = goal; }
        else {
            const near = found.filter((i) => depth.get(i) <= 7);
            if (!near.length) return null;
            goal = near[Math.floor(W.rng.next() * near.length)];
        }
        const path = [];
        for (let i = goal; i !== s && i >= 0; i = par[i]) path.push([i % N, (i / N) | 0]);
        path.reverse();
        return path.length ? { path, station } : null;
    }

    /** A train has stopped at a platform: riders may get off, people waiting get on. */
    trainArrived(t, block) {
        const W = this.world;
        const set = new Set(block);
        let off = 0, on = 0;
        for (const p of this.list) {
            if (p.state === 'ride' && p.train === t.id && W.rng.chance(0.55)) {
                const i = block[Math.floor(W.rng.next() * block.length)];
                p.state = 'walk'; p.path = []; p.station = -1; p.train = 0;
                const along = W.track[i] === 1, side = W.rng.chance(0.5) ? 1 : -1;
                const x0 = i % N, z0 = (i / N) | 0;
                p.x = x0 + 0.5 + (along ? side * 0.36 : W.rng.range(-0.3, 0.3));
                p.z = z0 + 0.5 + (along ? W.rng.range(-0.3, 0.3) : side * 0.36);
                p.hop = 0.6;
                t.riders--; off++;
                if (!this.walkable(x0, z0)) this.sendHome(p);
            }
        }
        for (const p of this.list) {
            if (p.state === 'wait' && set.has(p.station) && t.riders < t.cap) {
                p.state = 'ride'; p.train = t.id; p.hop = 0.6;
                t.riders++; on++;
                W.stats.riders++;
            }
        }
        if (off || on) W.emit('board', { id: t.id, on, off });
    }

    trainGone(t) {
        for (const p of this.list) if (p.state === 'ride' && p.train === t.id) this.sendHome(p);
    }

    sendHome(p) {
        const home = this.world.objs.get(p.home);
        const at = home && this.doorstep(home);
        if (!at) { this.list = this.list.filter((q) => q !== p); return; }
        p.x = at[0] + 0.5; p.z = at[1] + 0.5; p.state = 'idle'; p.timer = 1; p.train = 0; p.path = []; p.station = -1; p.hop = 0.6;
    }

    /** Someone was tapped: they wave. */
    wave(id) {
        const p = this.list.find((q) => q.id === id);
        if (!p || p.state === 'ride') return null;
        if (p.state === 'walk') p.path.length = 0;
        p.state = p.state === 'wait' ? 'wait' : 'wave';
        if (p.state === 'wave') p.timer = 2.2;
        p.hop = 0.6;
        return p;
    }
}
