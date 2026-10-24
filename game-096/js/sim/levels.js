// Level builder. Levels are written as short scripts (see scripts.js) that lay slabs end to end
// along a path that may turn in quarter turns. Every jump between slabs is checked here against
// what the player's body can really do, so a level that builds is a level that can be crossed.
// Pure: no DOM, no renderer, no Math.random.

import { PHYS } from '../config.js';
import { levelMeta, LEVELS } from './data.js';
import { hashStr } from '../rng.js';

// heading h: 0 runs toward -z (what the camera looks at by default), then quarter turns to the left
export const FWD = [[0, -1], [-1, 0], [0, 1], [1, 0]];
export const RGT = [[1, 0], [0, -1], [-1, 0], [0, 1]];
export const SLAB = 4;                     // slab thickness
const WATER_BELOW = 3.2;                   // water surface under the lowest slab top

// ---------------------------------------------------------------- what the body can reach
/** The widest gap (edge to edge) a mode can clear when the target is dy higher. -1: it cannot. */
export function reach(mode, dy) {
    const g = PHYS.gravity;
    const flight = (v0, speed, room) => {
        const apex = (v0 * v0) / (2 * g);
        if (dy > apex - room) return -1;
        const d = v0 * v0 - 2 * g * dy;
        return (speed * (v0 + Math.sqrt(d))) / g;
    };
    switch (mode) {
        case 'jump': return Math.max(-1, flight(PHYS.jumpV, PHYS.run, 0.5) * 0.78);
        case 'roll': return Math.max(-1, flight(PHYS.jumpV, PHYS.rollAirSpeed, 0.5) * 0.78);
        case 'glide': {
            const v0 = PHYS.jumpV, apex = (v0 * v0) / (2 * g);
            if (dy > apex - 0.5) return -1;
            const x1 = PHYS.run * (v0 / g);
            const x2 = PHYS.glideSpeed * ((apex - dy) / PHYS.glideFall);
            return (x1 + x2) * 0.84;
        }
        case 'hop': return Math.max(-1, flight(PHYS.hopMax, PHYS.run, 0.7) * 0.76);
        case 'bounce': return Math.max(-1, flight(PHYS.springV, PHYS.run, 0.8) * 0.7);
        default: return -1;
    }
}
const MODE_SHELL = { walk: 0, jump: 0, roll: 0, glide: 3, hop: 4, launch: 0, bounce: 0 };
export const shellCount = (world) => Math.min(5, world);        // shells owned on arrival in a world

const rectDist = (A, B) => {
    const dx = Math.max(A.x0 - B.x1, B.x0 - A.x1, 0), dz = Math.max(A.z0 - B.z1, B.z0 - A.z1, 0);
    return Math.hypot(dx, dz);
};

// ---------------------------------------------------------------- the builder
class Slab {
    constructor(B, box, o) {
        this.B = B; Object.assign(this, o);
        this.box = box;
    }
    /** World x, z of a point a to the right and b ahead of where this slab began. */
    xz(a, b) { return [this.ox + this.r[0] * a + this.f[0] * b, this.oz + this.r[1] * a + this.f[1] * b]; }
    top() { return this.y; }
    pearl(a, b, dy = 0.9) { const [x, z] = this.xz(a, b); this.B.pearls.push({ x, y: this.y + dy, z }); return this; }
    pearls(n, a0, b0, a1, b1, dy = 0.9) {
        for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); this.pearl(a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, dy); }
        return this;
    }
    /** A line of pearls bowing up over a gap. */
    arc(n, a, b0, b1, height = 1.6, dy = 0.9) {
        for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); this.pearl(a, b0 + (b1 - b0) * t, dy + Math.sin(t * Math.PI) * height); }
        return this;
    }
    /** A vertical line of pearls, for a vent to carry you up. */
    column(n, a, b, dy0 = 1.2, dy1 = 8) {
        for (let i = 0; i < n; i++) this.pearl(a, b, dy0 + ((dy1 - dy0) * i) / Math.max(1, n - 1));
        return this;
    }
    ring(n, a, b, r = 1.3, dy = 0.9) {
        for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; this.pearl(a + Math.cos(t) * r, b + Math.sin(t) * r, dy); }
        return this;
    }
    crate(kind, a, b, dy = 0) { const [x, z] = this.xz(a, b); this.B.crates.push({ kind, x, y: this.y + dy, z }); return this; }
    check(a, b) { return this.crate('check', a, b); }
    enemy(kind, a, b, o = {}) {
        const [x, z] = this.xz(a, b);
        const e = { kind, x, y: this.y + (o.dy || 0), z, ...o };
        if (o.to) { const [tx, tz] = this.xz(o.to[0], o.to[1]); e.tx = tx; e.tz = tz; delete e.to; }
        if (o.face != null) e.fx = FWD[(this.h + o.face) & 3][0], e.fz = FWD[(this.h + o.face) & 3][1];
        this.B.enemies.push(e); return this;
    }
    hazard(kind, a, b, o = {}) { const [x, z] = this.xz(a, b); const hz = { kind, x, y: this.y + (o.dy || 0), z, ...o }; this.B.hazards.push(hz); return this; }
    spring(a, b) { const [x, z] = this.xz(a, b); this.B.springs.push({ x, y: this.y, z }); return this; }
    vent(a, b, height = 9, r = 1.7) { const [x, z] = this.xz(a, b); this.B.vents.push({ x, y: this.y, z, r, height }); return this; }
    sign(key, a, b) { const [x, z] = this.xz(a, b); this.B.signs.push({ x, y: this.y, z, key, yaw: this.h * Math.PI / 2 }); return this; }
    curio(a, b, dy = 0.9) {
        const [x, z] = this.xz(a, b);
        const i = this.B.curios.length;
        this.B.curios.push({ x, y: this.y + dy, z, kind: this.B.meta.curios[i], i });
        return this;
    }
    /** A big red switch that opens gate `id`. Needs a ground pound. */
    switch(id, a, b) {
        const [x, z] = this.xz(a, b);
        const sw = { x, y: this.y, z, gate: id }; this.B.switches.push(sw);
        this.B.nav.push({ t: 'sw', x, y: this.y, z, gate: id });
        return this;
    }
    /** A wall across the path, opened by a switch. */
    gate(id, a, b, wide = 4, high = 3) {
        const [x, z] = this.xz(a, b);
        const hw = wide / 2, f = this.f, r = this.r;
        const halfA = Math.abs(r[0]) * hw + Math.abs(f[0]) * 0.4, halfB = Math.abs(r[1]) * hw + Math.abs(f[1]) * 0.4;
        this.B.gates.push({ id, x0: x - halfA, x1: x + halfA, z0: z - halfB, z1: z + halfB, y0: this.y, y1: this.y + high });
        return this;
    }
    /** A barrel that fires the player somewhere. Link it with L.link(barrel, slab, a, b). */
    barrel(a, b, o = {}) {
        const [x, z] = this.xz(a, b);
        const br = { x, y: this.y, z, T: o.T || 1.4, tx: x, ty: this.y, tz: z, aim: this.h };
        this.B.launchers.push(br);
        this.B.nav.push({ t: 'bar', i: this.B.launchers.length - 1 });
        return br;
    }
    goal(a, b) { const [x, z] = this.xz(a, b); this.B.goal = { x, y: this.y, z, r: 1.9 }; return this; }
}

export class Builder {
    constructor(meta) {
        this.meta = meta;
        this.solids = []; this.movers = []; this.crumbles = []; this.gates = []; this.switches = [];
        this.pearls = []; this.curios = []; this.crates = []; this.enemies = []; this.springs = [];
        this.vents = []; this.launchers = []; this.hazards = []; this.signs = [];
        this.sections = []; this.nav = [];
        this.goal = null; this.start_ = null; this.boss = null; this.chase = null; this.arena = null;
        this.x = 0; this.y = 0; this.z = 0; this.h = 0;      // the cursor: the front edge, centred
        this.prev = null;
        this.minY = 0;
        this.shells = shellCount(meta.world);
    }
    get f() { return FWD[this.h & 3]; }
    get r() { return RGT[this.h & 3]; }

    up(dy) { this.y += dy; return this; }
    rot(d) { this.h = (this.h + d + 4) & 3; return this; }
    setBoss(kind, hp) { this.boss = { kind, hp }; return this; }
    gap(len) { this.x += this.f[0] * len; this.z += this.f[1] * len; this.gapLen = (this.gapLen || 0) + len; return this; }
    shift(a) { this.x += this.r[0] * a; this.z += this.r[1] * a; return this; }

    _box(len, w, y, thick = SLAB) {
        const f = this.f, r = this.r, hw = w / 2;
        const ax = [this.x + r[0] * -hw, this.x + r[0] * hw + f[0] * len];
        const az = [this.z + r[1] * -hw, this.z + r[1] * hw + f[1] * len];
        return { x0: Math.min(ax[0], ax[1]), x1: Math.max(ax[0], ax[1]), z0: Math.min(az[0], az[1]), z1: Math.max(az[0], az[1]), y0: y - thick, y1: y };
    }

    /** Check the hop from the previous piece onto `box`. Returns { via, need }. */
    _link(box, o, moving) {
        const prev = this.prev;
        if (!prev || o.via === 'launch') return { via: o.via || 'walk', need: 0 };
        if (o.via === 'vent') {                        // a bubble vent lifts you high; then it is a glide across
            const d = Math.min(...(prev.swing || [prev.box]).map((A) => rectDist(A, box)));
            if (d > 10) throw new Error(`${this.meta.id}: vent glide of ${d.toFixed(1)} m is too far`);
            if (3 >= this.shells) throw new Error(`${this.meta.id}: vent needs the sail shell`);
            return { via: 'vent', need: 3 };
        }
        const from = prev.swing || [prev.box], to = moving || [box];
        const feasible = (m) => from.some((A) => to.some((Bx) => {
            const dist = rectDist(A, Bx), dy = Bx.y1 - A.y1;
            return m === 'walk' ? dist < 0.06 && dy <= PHYS.stepUp + 0.001 : reach(m, dy) >= dist;
        }));
        let via = o.via;
        if (!via) for (const m of ['walk', 'jump', 'roll', 'glide', 'hop']) if (feasible(m)) { via = m; break; }
        if (via === 'launch') return { via, need: 0 };
        if (!via || !feasible(via)) {
            throw new Error(`${this.meta.id}: cannot cross onto slab ${this.solids.length} (${box.x0.toFixed(1)}, ${box.z0.toFixed(1)}) by ${via || 'any mode'}`);
        }
        const need = MODE_SHELL[via];
        if (need >= this.shells) throw new Error(`${this.meta.id}: slab ${this.solids.length} needs shell ${need} but world ${this.meta.world} has ${this.shells}`);
        return { via, need };
    }

    _slab(box, o, nodeType, ref) {
        const link = this._link(box, o);
        const slab = new Slab(this, box, { y: box.y1, h: this.h, f: this.f, r: this.r, ox: this.x, oz: this.z, len: o.len, w: o.w, idx: ref, type: nodeType });
        this.minY = Math.min(this.minY, box.y1);
        this.sections.push({ type: 'run', h: this.h, x0: box.x0 - 1.5, x1: box.x1 + 1.5, z0: box.z0 - 1.5, z1: box.z1 + 1.5, y: box.y1 });
        if (!this.noNav) this.nav.push({ t: nodeType, i: ref, via: link.via, need: link.need, y: box.y1 });
        this.prev = slab;
        this.x += this.f[0] * o.len; this.z += this.f[1] * o.len;
        this.gapLen = 0;
        return slab;
    }

    /** A slab of ground len long and w wide, laid at the cursor and running forward. */
    ground(len, w = 6, o = {}) {
        if (o.rise) this.y += o.rise;
        const box = this._box(len, w, this.y, o.thick);
        box.look = o.look || 'ground'; box.safe = !o.unsafe;
        this.solids.push(box);
        return this._slab(box, { ...o, len, w }, 's', this.solids.length - 1);
    }

    /** A moving platform. amp = [right, up, forward] swing, period in seconds. */
    mover(len, w, o = {}) {
        if (o.rise) this.y += o.rise;
        const base = this._box(len, w, this.y, 1.4);
        const a = o.amp || [0, 0, 6], f = this.f, r = this.r;
        const amp = [r[0] * a[0] + f[0] * a[2], a[1], r[1] * a[0] + f[1] * a[2]];
        const m = { ...base, amp, period: o.period || 5, phase: o.phase || 0, look: o.look || 'raft', w, len, h: this.h };
        this.movers.push(m);
        // sample the swing to check both ends of the ride
        const samples = [];
        for (let k = 0; k < 24; k++) samples.push(moverBox(m, (k / 24) * m.period));
        const link = this._link(base, o, samples);
        const slab = new Slab(this, base, { y: base.y1, h: this.h, f, r, ox: this.x, oz: this.z, len, w, idx: this.movers.length - 1, type: 'm' });
        if (!this.noNav) this.nav.push({ t: 'm', i: this.movers.length - 1, via: link.via, need: link.need, y: base.y1 });
        this.sections.push({ type: 'run', h: this.h, x0: base.x0 - 1.5 - Math.abs(amp[0]), x1: base.x1 + 1.5 + Math.abs(amp[0]), z0: base.z0 - 1.5 - Math.abs(amp[2]), z1: base.z1 + 1.5 + Math.abs(amp[2]), y: base.y1 });
        this.minY = Math.min(this.minY, base.y1);
        // what follows is judged against the whole swing
        this.prev = { box: base, swing: samples };
        this.prevMover = m;
        this.x += f[0] * len; this.z += f[1] * len;
        return slab;
    }

    /** A slab that gives way a moment after it is stood on. */
    crumble(len, w = 3, o = {}) {
        if (o.rise) this.y += o.rise;
        const box = this._box(len, w, this.y, 1.2);
        box.look = o.look || 'crumble';
        this.crumbles.push(box);
        return this._slab(box, { ...o, len, w }, 'c', this.crumbles.length - 1);
    }

    /** A square pad and a quarter turn: dir +1 left, -1 right. The path continues from its far side. */
    corner(dir, w = 8, o = {}) {
        const pad = this.ground(w, w, o);
        const h0 = this.h;
        this.sections.pop();
        this.sections.push({
            type: 'corner', h0, dir, w, ox: pad.ox, oz: pad.oz, f: pad.f, r: pad.r,
            x0: pad.box.x0 - 1, x1: pad.box.x1 + 1, z0: pad.box.z0 - 1, z1: pad.box.z1 + 1, y: pad.y,
        });
        // the path leaves from the middle of the side we turn toward
        const side = dir > 0 ? -w / 2 : w / 2;
        this.x = pad.ox + pad.f[0] * (w / 2) + pad.r[0] * side;
        this.z = pad.oz + pad.f[1] * (w / 2) + pad.r[1] * side;
        this.h = (h0 + dir + 4) & 3;
        return pad;
    }

    /** A flat, wide, round-ish arena for a boss. */
    arenaSlab(size = 20, o = {}) {
        const s = this.ground(size, size, { ...o, look: o.look || 'ground' });
        const cx = s.ox + s.f[0] * size / 2, cz = s.oz + s.f[1] * size / 2;
        this.sections.pop();
        this.sections.push({ type: 'arena', cx, cz, r: size / 2, x0: s.box.x0 - 4, x1: s.box.x1 + 4, z0: s.box.z0 - 4, z1: s.box.z1 + 4, y: s.y, h: this.h });
        this.arena = { cx, cz, y: s.y, half: size / 2 - 0.2, h: this.h };
        return s;
    }

    /** Build a side nook off `slab`; the main path carries on from where it was. Not part of the bot's route. */
    branch(slab, a, b, fn) {
        const save = { x: this.x, y: this.y, z: this.z, h: this.h, prev: this.prev, noNav: this.noNav };
        const [x, z] = slab.xz(a, b);
        this.x = x; this.z = z; this.y = slab.y; this.h = slab.h; this.prev = slab; this.noNav = true;
        try { fn(this); } finally { Object.assign(this, save); }
        return this;
    }

    /** Where the player begins, on the first slab. Also checkpoint zero. */
    start(len = 9, w = 8) {
        const s = this.ground(len, w, { via: 'walk' });
        const [x, z] = s.xz(0, 2.6);
        this.start_ = { x, y: s.y, z, yaw: this.h * Math.PI / 2 };
        return s;
    }

    /** Connect a barrel to where it lands. */
    link(barrel, slab, a, b, T) {
        const [x, z] = slab.xz(a, b);
        barrel.tx = x; barrel.ty = slab.y; barrel.tz = z;
        if (T) barrel.T = T;
        const dist = Math.hypot(x - barrel.x, z - barrel.z);
        if (dist > 26) throw new Error(`${this.meta.id}: barrel shot of ${dist.toFixed(1)} m is too far`);
        return this;
    }

    /** A bounce or a vent that a hop leans on has to be on the slab it leaves from, near the edge. */
    _checkAids() {
        let prevBox = null;
        for (const n of this.nav) {
            const box = n.t === 's' ? this.solids[n.i] : n.t === 'm' ? this.movers[n.i] : n.t === 'c' ? this.crumbles[n.i] : null;
            if (!box) continue;
            if (prevBox && (n.via === 'bounce' || n.via === 'vent')) {
                const list = n.via === 'bounce' ? this.springs : this.vents, lim = n.via === 'bounce' ? 3.6 : 10;
                const ok = list.some((q) => q.y === prevBox.y1 && q.x >= prevBox.x0 - 0.1 && q.x <= prevBox.x1 + 0.1 && q.z >= prevBox.z0 - 0.1 && q.z <= prevBox.z1 + 0.1 && rectDist({ x0: q.x, x1: q.x, z0: q.z, z1: q.z }, box) <= lim);
                if (!ok) throw new Error(`${this.meta.id}: ${n.via} onto slab ${n.i} has no ${n.via === 'bounce' ? 'sponge' : 'vent'} close enough on the slab before it`);
            }
            prevBox = box;
        }
    }

    finish() {
        if (!this.start_) throw new Error(`${this.meta.id}: no start`);
        if (!this.goal && !this.boss) throw new Error(`${this.meta.id}: no goal`);
        const n = this.curios.length;
        if (n !== 3) throw new Error(`${this.meta.id}: ${n} curios, need 3`);
        this._checkAids();
        this.solids.forEach((b, i) => { b.ref = i; });
        const theme = this.meta.final ? 'reef' : themeOf(this.meta.world);
        const level = {
            id: this.meta.id, meta: this.meta, theme,
            solids: this.solids, movers: this.movers, crumbles: this.crumbles, gates: this.gates, switches: this.switches,
            pearls: this.pearls, curios: this.curios, crates: this.crates, enemies: this.enemies, springs: this.springs,
            vents: this.vents, launchers: this.launchers, hazards: this.hazards, signs: this.signs,
            sections: this.sections, nav: this.nav, goal: this.goal, start: this.start_, boss: this.boss, chase: this.chase, arena: this.arena,
            waterY: this.minY - WATER_BELOW, killY: this.minY - WATER_BELOW - 6,
            seed: hashStr(this.meta.id),
        };
        let top = -Infinity, bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
        for (const s of this.solids) { top = Math.max(top, s.y1); bx0 = Math.min(bx0, s.x0); bx1 = Math.max(bx1, s.x1); bz0 = Math.min(bz0, s.z0); bz1 = Math.max(bz1, s.z1); }
        level.bounds = { x0: bx0, x1: bx1, z0: bz0, z1: bz1, top };
        level.pearlTotal = this.pearls.length + this.crates.reduce((n, c) => n + (c.kind === 'pearl' ? 8 : c.kind === 'wood' ? 2 : 0), 0);   // what a thorough player can collect
        level.grid = buildGrid(level);
        return level;
    }
}

const themeOf = (w) => ['beach', 'jungle', 'pier', 'castle', 'storm'][w - 1];

// ---------------------------------------------------------------- shared geometry helpers
/** The box of a moving platform at time t (pure in t, so the sim can replay any moment). */
export function moverBox(m, t, out = {}) {
    const k = Math.sin(((t / m.period) + m.phase) * Math.PI * 2);
    out.x0 = m.x0 + m.amp[0] * k; out.x1 = m.x1 + m.amp[0] * k;
    out.y0 = m.y0 + m.amp[1] * k; out.y1 = m.y1 + m.amp[1] * k;
    out.z0 = m.z0 + m.amp[2] * k; out.z1 = m.z1 + m.amp[2] * k;
    return out;
}

const CELL = 8;
function buildGrid(level) {
    const map = new Map();
    level.solids.forEach((b, i) => {
        for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++)
            for (let cz = Math.floor(b.z0 / CELL); cz <= Math.floor(b.z1 / CELL); cz++) {
                const k = cx * 4096 + cz;
                if (!map.has(k)) map.set(k, []);
                map.get(k).push(i);
            }
    });
    return map;
}
export const gridCell = (x, z) => Math.floor(x / CELL) * 4096 + Math.floor(z / CELL);
export { CELL };

// ---------------------------------------------------------------- the registry
const cache = new Map();
let SCRIPTS = null;
/** scripts.js registers itself here (it imports this file, not the other way round). */
export function registerScripts(map) { SCRIPTS = map; cache.clear(); }

export function getLevel(id) {
    if (!cache.has(id)) {
        const meta = levelMeta(id);
        if (!meta) throw new Error('no such level ' + id);
        if (!SCRIPTS || !SCRIPTS[id]) throw new Error('no script for ' + id);
        const B = new Builder(meta);
        SCRIPTS[id](B);
        cache.set(id, B.finish());
    }
    return cache.get(id);
}
export const allLevelIds = () => LEVELS.map((l) => l.id);
