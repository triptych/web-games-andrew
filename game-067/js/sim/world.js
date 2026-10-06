/**
 * world.js — one island: terrain, track, stations, placed objects, plus the trains and people on it.
 *
 * Pure simulation: no three.js, no DOM, no Math.random. The view watches the version counters
 * (terrainV, trackV, objV) to know what to rebuild, and the main loop drains `events` for sounds,
 * toasts and stickers.
 */

import { N, T } from '../config.js';
import { RNG } from '../rng.js';
import { DX, DZ, opp, SEGS, segIndex, segHas, edgeMask, idx, inb, edgeToward } from './grid.js';
import { ITEM, footprint } from './catalog.js';
import { stationName } from './trainsets.js';
import { TrainSystem } from './trains.js';
import { PeopleSystem } from './people.js';

export const isLand = (t) => t !== T.WATER && t !== T.ROCK;

export class World {
    constructor() {
        this.name = 'My Island';
        this.preset = 'sunny';
        this.season = 'summer';
        this.seed = 1;
        this.created = 0;
        this.tiles = new Uint8Array(N * N);
        this.track = new Uint8Array(N * N);
        this.sw = new Uint8Array(N * N);
        this.station = new Uint8Array(N * N);
        this.stationNames = new Map();
        this.objs = new Map();
        this.objAt = new Int32Array(N * N).fill(-1);
        this.nextId = 1;
        this.rngState = { s: 12345 };
        this.rng = new RNG(this.rngState);
        this.stats = { riders: 0, whistles: 0, switches: 0, distance: 0, trackLaid: 0, homesBuilt: 0, treesPlanted: 0 };
        this.terrainV = 1; this.trackV = 1; this.objV = 1;
        this.events = [];
        this.trains = new TrainSystem(this);
        this.people = new PeopleSystem(this);
    }

    emit(type, data = {}) { this.events.push({ type, ...data }); if (this.events.length > 400) this.events.splice(0, 100); }

    // ------------------------------------------------------------------ terrain
    tile(x, z) { return inb(x, z) ? this.tiles[idx(x, z)] : T.WATER; }

    /** Paint one tile. Little props in the way are cleared; buildings block. Returns true if it changed. */
    paintTerrain(x, z, t) {
        if (!inb(x, z)) return false;
        const i = idx(x, z);
        if (this.tiles[i] === t) return false;
        const oid = this.objAt[i];
        if (oid >= 0) {
            const o = this.objs.get(oid), it = ITEM[o.type];
            const fits = it.on === 'any' || (it.on === 'water' ? t === T.WATER : isLand(t));
            if (!fits) {
                if (!it.small) return false;
                this.removeObject(oid);
            }
        }
        if (t === T.ROCK && this.station[i]) this.setStation(x, z, false);
        this.tiles[i] = t;
        this.terrainV++;
        return true;
    }

    // ------------------------------------------------------------------ track
    /** Exits from tile (x,z) for a train entering through edge `entry`; straight ahead first. */
    exits(x, z, entry) {
        if (!inb(x, z)) return [];
        const bits = this.track[idx(x, z)];
        if (!bits) return [];
        const out = [];
        const straight = opp(entry);
        const sIdx = segIndex(entry, straight);
        if (bits & (1 << sIdx)) out.push(straight);
        for (let e = 0; e < 4; e++) {
            if (e === entry || e === straight) continue;
            const s = segIndex(entry, e);
            if (bits & (1 << s)) out.push(e);
        }
        return out;
    }

    /** The exit a train entering through `entry` takes now, given the tile's switch setting. */
    route(x, z, entry) {
        const ex = this.exits(x, z, entry);
        if (!ex.length) return -1;
        return ex[this.sw[idx(x, z)] % ex.length];
    }

    /** True if some entry into this tile has more than one way out: tapping it changes the points. */
    isSwitch(x, z) {
        if (!inb(x, z)) return false;
        for (let e = 0; e < 4; e++) if (this.exits(x, z, e).length > 1) return true;
        return false;
    }

    /** The entry edge whose route the switch decides (for drawing its lever), or −1. */
    switchEntry(x, z) {
        for (let e = 0; e < 4; e++) if (this.exits(x, z, e).length > 1) return e;
        return -1;
    }

    toggleSwitch(x, z) {
        if (!this.isSwitch(x, z)) return false;
        const i = idx(x, z);
        this.sw[i] = (this.sw[i] + 1) & 255;
        this.stats.switches++;
        this.trackV++;
        this.emit('switch', { x, z });
        return true;
    }

    canHoldTrack(x, z) {
        if (!inb(x, z)) return false;
        const oid = this.objAt[idx(x, z)];
        return oid < 0 || ITEM[this.objs.get(oid).type].small;
    }

    /** True if adjacent tile n has track reaching back through the edge facing tile (x,z). */
    connectsBack(x, z, e) {
        const nx = x + DX[e], nz = z + DZ[e];
        if (!inb(nx, nz)) return false;
        return !!(edgeMask(this.track[idx(nx, nz)]) & (1 << opp(e)));
    }

    _addSeg(x, z, s) {
        const i = idx(x, z);
        if (s < 0 || (this.track[i] & (1 << s))) return;
        const oid = this.objAt[i];
        if (oid >= 0) {
            if (this._stroke) { const o = this.objs.get(oid); this._stroke.removed.push([o.type, o.x, o.z, o.rot]); }
            this.removeObject(oid);
        }
        this.track[i] |= 1 << s;
    }

    /**
     * A drag of the track tool is one stroke: every pointer move rewinds to the start of the stroke
     * and lays the whole path again, so an end tile that becomes a middle tile gets the right piece.
     */
    beginStroke() {
        this._stroke = { track: this.track.slice(), sw: this.sw.slice(), station: this.station.slice(), names: new Map(this.stationNames), removed: [] };
    }
    rewindStroke() {
        const s = this._stroke;
        if (!s) return;
        this.track.set(s.track); this.sw.set(s.sw); this.station.set(s.station);
        this.stationNames = new Map(s.names);
        for (let k = s.removed.length - 1; k >= 0; k--) { const o = s.removed[k]; this.place(o[0], o[1], o[2], o[3]); }
        s.removed.length = 0;
        this.trackV++;
    }
    endStroke() { this._stroke = null; }

    /**
     * Join the end of a line at tile (x,z) toward edge e. `hint` (an edge, or −1) says which way to
     * turn when the line starts or ends beside an existing straight: a branch (a switch) curving
     * toward the hinted end, instead of a crossing.
     */
    _endpoint(x, z, e, hint = -1) {
        const i = idx(x, z);
        const bits = this.track[i];
        if (edgeMask(bits) & (1 << e)) return;
        if (!bits) { this._addSeg(x, z, segIndex(e, opp(e))); return; }
        let single = -1, count = 0;
        for (let s = 0; s < 6; s++) if (bits & (1 << s)) { single = s; count++; }
        if (count === 1) {
            const [a, b] = SEGS[single];
            // A single piece with a loose end turns to meet the new line (a straight end becomes a curve).
            const aLoose = !this.connectsBack(x, z, a), bLoose = !this.connectsBack(x, z, b);
            const keep = aLoose && !bLoose ? b : bLoose && !aLoose ? a : -1;
            if (keep >= 0 && keep !== e && !this.trains.usesTile(i)) {
                this.track[i] = 1 << segIndex(keep, e);
                return;
            }
            // Starting beside a straight that runs across: branch off it toward the hinted end.
            if (single < 2 && (hint === a || hint === b)) { this._addSeg(x, z, segIndex(hint, e)); return; }
        }
        this._addSeg(x, z, segIndex(e, opp(e)));
    }

    /**
     * Lay track along a 4-connected path of tiles. Interior tiles get the piece joining their
     * neighbours on the path; the two ends join on to whatever is already there. The path is cut
     * short at anything that can't hold track. Returns the number of tiles used.
     */
    layTrack(path, startHint = -1, endHint = -1) {
        const p = [];
        for (const [x, z] of path) {
            if (!this.canHoldTrack(x, z)) break;
            if (p.length && edgeToward(p[p.length - 1][0], p[p.length - 1][1], x, z) < 0) break;
            p.push([x, z]);
        }
        if (p.length < 2) return p.length;
        // A path that comes back to where it started closes a loop: its ends are middles, not ends.
        const middles = new Set();
        for (let k = 1; k < p.length - 1; k++) middles.add(idx(p[k][0], p[k][1]));
        for (let k = 0; k < p.length; k++) {
            const [x, z] = p[k];
            const ePrev = k > 0 ? edgeToward(x, z, p[k - 1][0], p[k - 1][1]) : -1;
            const eNext = k < p.length - 1 ? edgeToward(x, z, p[k + 1][0], p[k + 1][1]) : -1;
            if (ePrev >= 0 && eNext >= 0) this._addSeg(x, z, segIndex(ePrev, eNext));
            else if (middles.has(idx(x, z))) continue;
            else if (eNext >= 0) this._endpoint(x, z, eNext, startHint);
            else this._endpoint(x, z, ePrev, endHint);
        }
        for (const [x, z] of p) {
            const i = idx(x, z);
            if (this.station[i] && !this.straightOnly(i)) this.setStation(x, z, false);
        }
        this.trackV++;
        return p.length;
    }

    straightOnly(i) { const b = this.track[i]; return b === 1 || b === 2; }

    /** Remove all track on a tile. Refused while a train stands on it. */
    eraseTrack(x, z) {
        if (!inb(x, z)) return false;
        const i = idx(x, z);
        if (!this.track[i]) return false;
        if (this.trains.usesTile(i)) return 'train';
        this.track[i] = 0; this.sw[i] = 0;
        if (this.station[i]) this.setStation(x, z, false);
        this.trackV++;
        return true;
    }

    setStation(x, z, on) {
        const i = idx(x, z);
        if (on) {
            if (!this.straightOnly(i) || this.tiles[i] === T.ROCK) return false;
            if (this.station[i]) return false;
            this.station[i] = 1;
            this.stationNames.set(i, this.blockName(x, z) || stationName(() => this.rng.next()));
        } else {
            if (!this.station[i]) return false;
            this.station[i] = 0;
            this.stationNames.delete(i);
        }
        this.trackV++;
        return true;
    }

    /** A new platform tile next to an existing one joins its station and takes its name. */
    blockName(x, z) {
        for (let e = 0; e < 4; e++) {
            const nx = x + DX[e], nz = z + DZ[e];
            if (inb(nx, nz) && this.station[idx(nx, nz)]) return this.stationNames.get(idx(nx, nz));
        }
        return null;
    }

    /** All tiles of the platform (contiguous straight station tiles in a line) containing tile i. */
    stationBlock(i) {
        const x = i % N, z = (i / N) | 0;
        const axis = this.track[i] === 1 ? [0, 2] : [1, 3];
        const out = [i];
        for (const e of axis) {
            let cx = x + DX[e], cz = z + DZ[e];
            while (inb(cx, cz) && this.station[idx(cx, cz)] && this.track[idx(cx, cz)] === this.track[i]) {
                out.push(idx(cx, cz)); cx += DX[e]; cz += DZ[e];
            }
        }
        return out;
    }

    // ------------------------------------------------------------------ objects
    /** Can `type` go at (x,z) with rotation rot? Returns '' if so, or a short reason. */
    canPlace(type, x, z, rot = 0) {
        const it = ITEM[type];
        if (!it) return 'unknown';
        const [w, d] = footprint(it, rot);
        for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) {
            const tx = x + dx, tz = z + dz;
            if (!inb(tx, tz)) return 'edge';
            const i = idx(tx, tz), t = this.tiles[i];
            if (it.on === 'water' && t !== T.WATER) return 'needs water';
            if (it.on === 'land' && !isLand(t)) return t === T.ROCK ? 'hill' : 'needs land';
            if (it.on === 'any' && t === T.ROCK) return 'hill';
            if (this.track[i]) return 'track';
            if (this.objAt[i] >= 0) return 'taken';
        }
        return '';
    }

    place(type, x, z, rot = 0) {
        if (this.canPlace(type, x, z, rot)) return -1;
        const it = ITEM[type];
        const id = this.nextId++;
        const o = { id, type, x, z, rot: rot & 3 };
        this.objs.set(id, o);
        const [w, d] = footprint(it, rot);
        for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) this.objAt[idx(x + dx, z + dz)] = id;
        this.objV++;
        if (it.res) this.people.residentsChanged();
        return id;
    }

    removeObject(id) {
        const o = this.objs.get(id);
        if (!o) return false;
        const it = ITEM[o.type];
        const [w, d] = footprint(it, o.rot);
        for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) {
            const i = idx(o.x + dx, o.z + dz);
            if (this.objAt[i] === id) this.objAt[i] = -1;
        }
        this.objs.delete(id);
        this.objV++;
        if (it.res) this.people.residentsChanged();
        return true;
    }

    objectAt(x, z) { return inb(x, z) ? this.objs.get(this.objAt[idx(x, z)]) || null : null; }

    /** Clear a tile of everything built on it. Returns what went: 'obj', 'track', 'train' (refused) or ''. */
    bulldoze(x, z) {
        if (!inb(x, z)) return '';
        const i = idx(x, z);
        if (this.objAt[i] >= 0) { this.removeObject(this.objAt[i]); return 'obj'; }
        if (this.track[i]) { const r = this.eraseTrack(x, z); return r === 'train' ? 'train' : r ? 'track' : ''; }
        return '';
    }

    // ------------------------------------------------------------------ simulation
    step(dt) {
        this.trains.step(dt);
        this.people.step(dt);
    }

    counts() {
        let track = 0, stations = 0, bridges = 0, tunnels = 0, homes = 0, trees = 0, buildings = 0;
        for (let i = 0; i < N * N; i++) {
            if (this.track[i]) {
                track++;
                if (this.tiles[i] === T.WATER) bridges++;
                if (this.tiles[i] === T.ROCK) tunnels++;
            }
            if (this.station[i]) stations++;
        }
        for (const o of this.objs.values()) {
            const it = ITEM[o.type];
            if (it.cat === 'homes') homes++;
            if (o.type.startsWith('tree_')) trees++;
            if (!it.small) buildings++;
        }
        return { track, stations, bridges, tunnels, homes, trees, buildings, trains: this.trains.list.length, objects: this.objs.size };
    }

    // ------------------------------------------------------------------ persistence
    /** The parts of the island that undo restores (everything except trains and people). */
    snapshot() {
        const trk = [];
        for (let i = 0; i < N * N; i++) if (this.track[i]) trk.push(i, this.track[i], this.sw[i], this.station[i]);
        return {
            tiles: rle(this.tiles),
            track: trk,
            names: [...this.stationNames.entries()],
            objs: [...this.objs.values()].map((o) => [o.type, o.x, o.z, o.rot]),
        };
    }

    restore(snap) {
        this.tiles.set(unrle(snap.tiles, N * N));
        this.track.fill(0); this.sw.fill(0); this.station.fill(0);
        const t = snap.track || [];
        for (let k = 0; k + 3 < t.length; k += 4) {
            const i = t[k];
            if (i < 0 || i >= N * N) continue;
            this.track[i] = t[k + 1] & 63; this.sw[i] = t[k + 2] & 255; this.station[i] = t[k + 3] ? 1 : 0;
        }
        this.stationNames = new Map((snap.names || []).filter((e) => this.station[e[0]]));
        for (let i = 0; i < N * N; i++) if (this.station[i] && !this.stationNames.has(i)) this.stationNames.set(i, stationName(() => this.rng.next()));
        this.objs.clear(); this.objAt.fill(-1); this.nextId = 1;
        for (const o of snap.objs || []) if (ITEM[o[0]]) this.place(o[0], o[1], o[2], o[3] || 0);
        this.terrainV++; this.trackV++; this.objV++;
        const gone = this.trains.validate();
        this.people.residentsChanged();
        return gone;
    }

    serialize() {
        return {
            v: 1,
            name: this.name, preset: this.preset, season: this.season, seed: this.seed, created: this.created,
            ...this.snapshot(),
            trains: this.trains.serialize(),
            stats: { ...this.stats },
            rng: this.rngState.s,
        };
    }

    static deserialize(data) {
        const w = new World();
        if (!data || data.v !== 1 || typeof data.tiles !== 'string') return null;
        w.name = String(data.name || 'My Island').slice(0, 32);
        w.preset = String(data.preset || 'sunny');
        w.season = String(data.season || 'summer');
        w.seed = data.seed >>> 0;
        w.created = Number(data.created) || 0;
        w.rngState.s = (data.rng >>> 0) || 777;
        w.restore(data);
        Object.assign(w.stats, data.stats || {});
        w.trains.load(data.trains || []);
        w.people.residentsChanged();
        return w;
    }
}

// Run-length encode the terrain bytes as "<value><count>," pairs — islands are big blobs, so it's tiny.
function rle(arr) {
    let out = '', prev = arr[0], n = 0;
    for (let i = 0; i <= arr.length; i++) {
        if (i < arr.length && arr[i] === prev) { n++; continue; }
        out += prev.toString(36) + n.toString(36) + ',';
        prev = arr[i]; n = 1;
    }
    return out;
}
function unrle(s, len) {
    const out = new Uint8Array(len);
    let p = 0;
    for (const part of s.split(',')) {
        if (!part) continue;
        const v = parseInt(part[0], 36), n = parseInt(part.slice(1), 36);
        if (!(v >= 0 && v <= 6) || !(n > 0)) continue;
        out.fill(v, p, Math.min(len, p + n));
        p += n;
    }
    return out;
}

export { segHas };
