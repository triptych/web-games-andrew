/**
 * interiors.js — every place behind a load door: building interiors and generated dungeons.
 *
 * A cell is a grid of square tiles (1 m inside buildings, 4 m in dungeons). Each tile is solid
 * or floor with a floor height. Rooms and corridors are carved deterministically from the cell
 * id, then furnished by theme. The cell is also a physics space (ground / blocked / usables /
 * lightAt) and runs its own traps, gates and star-dial puzzles. Pure: no three, no DOM.
 */
import { Rng, hashStr, clamp } from './rng.js';
import { Colliders } from './colliders.js';
import { LOC } from './geography.js';
import { PHYS } from './physics.js';
import { applyDamage } from './actor.js';

// ------------------------------------------------------------------ themes
export const THEMES = {
    barrow:     { ts: 4, wallH: 4.6, layer: 'carved', floor: 'flag', foes: [['wight_husk', 3], ['wight', 3], ['wight_archer', 2], ['giantrat', 1], ['spider', 0.6]], sleepers: true, light: 0x6f9cff, ambient: 0.12, fog: 0x0b0d12, surface: 'stone' },
    cave:       { ts: 4, wallH: 6.5, layer: 'rock', floor: 'rock', foes: [['wolf', 2], ['bear', 1], ['spider', 2], ['giantrat', 1.5], ['troll', 0.4]], light: 0x8ff0c8, ambient: 0.1, fog: 0x0c100e, surface: 'stone', organic: true },
    mine:       { ts: 4, wallH: 4.2, layer: 'rock', floor: 'dirt', foes: [['bandit', 3], ['bandit_archer', 2], ['bandit_mage', 0.8]], light: 0xffb060, ambient: 0.14, fog: 0x100c0a, surface: 'dirt', organic: true },
    fort:       { ts: 4, wallH: 5.0, layer: 'masonry', floor: 'flag', foes: [['bandit', 3], ['bandit_archer', 2], ['reaver', 1.5]], light: 0xffa050, ambient: 0.16, fog: 0x0e0c0a, surface: 'stone' },
    deepforge:  { ts: 4, wallH: 7.0, layer: 'brass', floor: 'flag', foes: [['clockwork_spider', 3], ['sentinel', 0.8], ['gloomkin', 2], ['gloomkin_archer', 1]], light: 0x9cffa0, ambient: 0.14, fog: 0x0a0d0a, surface: 'stone' },
    temple:     { ts: 4, wallH: 7.5, layer: 'carved', floor: 'flag', foes: [['wight', 3], ['wight_warden', 1], ['wight_archer', 2]], sleepers: true, light: 0xff7a3a, ambient: 0.12, fog: 0x0e0a0a, surface: 'stone' },
    undercroft: { ts: 4, wallH: 4.4, layer: 'masonry', floor: 'flag', foes: [['skeleton', 2], ['giantrat', 2]], light: 0xffa050, ambient: 0.13, fog: 0x0c0b0a, surface: 'stone' },
};
export const SYMBOLS = ['Wolf', 'Hawk', 'Serpent', 'Bear', 'Moth', 'Stag'];

const BUILD_KIND = { house: 'house', inn: 'inn', shop: 'shop', hall: 'hall', guild: 'guild', temple: 'temple', barracks: 'barracks', academy: 'academy', college: 'academy', monastery: 'monastery', keep: 'keep' };

// ------------------------------------------------------------------ the cell (also a physics space)
export class Cell {
    constructor(id, kind, ts, W, H) {
        this.id = id; this.kind = kind; this.ts = ts; this.W = W; this.H = H;
        this.tiles = new Uint8Array(W * H);
        this.fh = new Float32Array(W * H);
        this.rooms = []; this.props = []; this.usables = []; this.lights = []; this.spawns = []; this.traps = []; this.spots = []; this.loose = [];
        this.gates = [];
        this.colliders = new Colliders();
        this._tmp = [];
        this._n = { x: 0, y: 1, z: 0 };
        this.surface = 'stone';
        this.wallH = 4;
        this.state = null;   // persistent bits, attached by Interiors
        this.space = this;   // physics talks to the cell directly
    }
    get kindTag() { return 'int'; }
    idx(tx, tz) { return tz * this.W + tx; }
    tileAt(x, z) { return [Math.floor(x / this.ts), Math.floor(z / this.ts)]; }
    isFloor(tx, tz) { return tx >= 0 && tz >= 0 && tx < this.W && tz < this.H && this.tiles[tz * this.W + tx] > 0 && !this.gateClosedAt(tx, tz); }
    gateClosedAt(tx, tz) {
        for (const g of this.gates) if (g.tx === tx && g.tz === tz && !(this.state?.gates[g.id])) return true;
        return false;
    }
    center(tx, tz) { return { x: (tx + 0.5) * this.ts, z: (tz + 0.5) * this.ts, y: this.fh[this.idx(tx, tz)] }; }

    // --- physics space interface
    floorAt(x, z) {
        // bilinear across neighbouring floor tiles so ramps between levels are smooth
        const ts = this.ts;
        const fx = x / ts - 0.5, fz = z / ts - 0.5;
        const x0 = Math.floor(fx), z0 = Math.floor(fz);
        const ax = fx - x0, az = fz - z0;
        let s = 0, w = 0;
        for (let k = 0; k < 4; k++) {
            const tx = x0 + (k & 1), tz = z0 + (k >> 1);
            if (tx < 0 || tz < 0 || tx >= this.W || tz >= this.H || !this.tiles[tz * this.W + tx]) continue;
            const ww = ((k & 1) ? ax : 1 - ax) * ((k >> 1) ? az : 1 - az) + 1e-4;
            s += this.fh[tz * this.W + tx] * ww; w += ww;
        }
        if (w === 0) { const [tx, tz] = this.tileAt(x, z); return this.fh[this.idx(clamp(tx, 0, this.W - 1), clamp(tz, 0, this.H - 1))]; }
        return s / w;
    }
    ground(x, z, feet) {
        const t = this.floorAt(x, z);
        const f = this.colliders.floorAt(x, z, feet, PHYS.step, this._tmp);
        return f > t ? f : t;
    }
    onPlatform() { return false; }
    normal() { return this._n; }
    water() { return -1000; }
    clamp(p) {
        p.x = clamp(p.x, 0.3, this.W * this.ts - 0.3);
        p.z = clamp(p.z, 0.3, this.H * this.ts - 0.3);
    }
    /** Push a circle out of solid tiles (and closed gates, and ledges too tall to step onto). */
    blocked(q, r, y) {
        const ts = this.ts;
        let hit = false;
        for (let pass = 0; pass < 2; pass++) {
            const tx0 = Math.floor((q.x - r) / ts), tx1 = Math.floor((q.x + r) / ts);
            const tz0 = Math.floor((q.z - r) / ts), tz1 = Math.floor((q.z + r) / ts);
            for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
                const solid = !this.isFloor(tx, tz) || (this.fh[this.idx(clamp(tx, 0, this.W - 1), clamp(tz, 0, this.H - 1))] > y + 1.2);
                if (!solid) continue;
                const nx = clamp(q.x, tx * ts, (tx + 1) * ts), nz = clamp(q.z, tz * ts, (tz + 1) * ts);
                const dx = q.x - nx, dz = q.z - nz, d2 = dx * dx + dz * dz;
                if (d2 >= r * r) continue;
                const d = Math.sqrt(d2);
                if (d > 1e-5) { q.x = nx + dx / d * r; q.z = nz + dz / d * r; }
                else {   // centre inside the tile: leave by the nearest edge
                    const ex = [q.x - tx * ts, (tx + 1) * ts - q.x], ez = [q.z - tz * ts, (tz + 1) * ts - q.z];
                    const m = Math.min(...ex, ...ez);
                    if (m === ex[0]) q.x = tx * ts - r; else if (m === ex[1]) q.x = (tx + 1) * ts + r; else if (m === ez[0]) q.z = tz * ts - r; else q.z = (tz + 1) * ts + r;
                }
                hit = true;
            }
        }
        return hit;
    }
    lightAt(pos) {
        let l = this.ambient || 0.15;
        for (const L of this.lights) {
            const dx = L.x - pos.x, dz = L.z - pos.z, d = Math.hypot(dx, dz);
            if (d < L.r) l = Math.max(l, (1 - d / L.r) * L.i);
        }
        return l;
    }
    /** Line of sight across the tile grid (walls and closed gates block it). */
    blockedRay(ex, ey, ez, tx, ty, tz) {
        // sample finely enough to catch a wall corner, and include the end point itself
        const d = Math.hypot(tx - ex, tz - ez), n = Math.max(1, Math.ceil(d / Math.min(this.ts * 0.25, 0.5)));
        for (let i = 1; i <= n; i++) {
            const t = i / n, x = ex + (tx - ex) * t, z = ez + (tz - ez) * t, y = ey + (ty - ey) * t;
            const [cx, cz] = this.tileAt(x, z);
            if (!this.isFloor(cx, cz)) { if (this.open) continue; return true; }
            if (this.fh[this.idx(cx, cz)] > y + 0.2) return true;
        }
        return false;
    }
    /** Breadth-first path across floor tiles; returns tile centres from the next tile to the goal. */
    path(from, to) {
        const [sx, sz] = this.tileAt(from.x, from.z), [gx, gz] = this.tileAt(to.x, to.z);
        if (sx === gx && sz === gz) return [{ x: to.x, z: to.z }];
        if (!this.isFloor(gx, gz)) return null;
        const W = this.W, prev = new Int32Array(W * this.H).fill(-1);
        const start = sz * W + sx, goal = gz * W + gx;
        const q = [start]; prev[start] = start;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (let h = 0; h < q.length && prev[goal] < 0; h++) {
            const cur = q[h], cx = cur % W, cz = (cur / W) | 0;
            for (const [dx, dz] of dirs) {
                const nx = cx + dx, nz = cz + dz;
                if (!this.isFloor(nx, nz)) continue;
                if (dx && dz && (!this.isFloor(cx + dx, cz) || !this.isFloor(cx, cz + dz))) continue;   // no corner cutting
                if (Math.abs(this.fh[nz * W + nx] - this.fh[cur]) > 1.6) continue;
                const ni = nz * W + nx;
                if (prev[ni] >= 0) continue;
                prev[ni] = cur; q.push(ni);
            }
            if (q.length > 4000) break;
        }
        if (prev[goal] < 0) return null;
        const out = [];
        for (let i = goal; i !== start; i = prev[i]) out.push(this.center(i % W, (i / W) | 0));
        out.reverse();
        out[out.length - 1] = { x: to.x, z: to.z };
        return out;
    }
    usablesFor(pos, r) { return this.usables.filter((u) => !u.hidden && Math.abs(u.x - pos.x) < r + 2 && Math.abs(u.z - pos.z) < r + 2); }
}

// ------------------------------------------------------------------ building interiors
function buildInterior(id, b, door) {
    const kind = BUILD_KIND[door?.interior] || (b?.type?.includes('inn') ? 'inn' : 'house');
    const big = { hall: [28, 16], guild: [22, 13], temple: [15, 12], inn: [17, 12], barracks: [14, 9], academy: [16, 16], monastery: [20, 14], keep: [18, 14] }[kind];
    const W = Math.max(7, Math.round(big ? big[0] : (b?.w || 9) - 0.5)), H = Math.max(6, Math.round(big ? big[1] : (b?.d || 7) - 0.5));
    const c = new Cell(id, 'building', 1, W + 2, H + 2);
    c.theme = kind; c.loc = door?.loc || b?.loc; c.owner = door?.owner || c.loc;
    c.wallH = { hall: 7, guild: 5.5, temple: 6.5, academy: 7, monastery: 5.5, keep: 6 }[kind] || 3.4;
    c.wallLayer = (b?.wall === 'stone' || kind === 'temple' || kind === 'keep' || kind === 'academy') ? 'masonry' : 'log';
    c.floorLayer = kind === 'temple' || kind === 'keep' || kind === 'academy' ? 'flag' : 'plank';
    c.surface = c.floorLayer === 'flag' ? 'stone' : 'wood';
    c.ambient = 0.32; c.fog = 0x120e0a; c.lightCol = 0xffb46a;
    for (let z = 1; z <= H; z++) for (let x = 1; x <= W; x++) c.tiles[c.idx(x, z)] = 1;
    c.rooms.push({ x: 1, z: 1, w: W, h: H, level: 0 });
    const rng = new Rng(hashStr(id));
    const cx = (W + 2) / 2, back = 1.6, front = H + 0.4;
    // the way out: the door is in the middle of the front wall (+z)
    c.entry = { x: cx, z: H - 0.2, y: 0, rot: 0 };
    c.usables.push({ kind: 'door', x: cx, y: 1.2, z: H + 0.9, r: 1.1, door: { to: 'ext', ext: door, name: 'Outside' }, name: LOC[c.loc]?.name || 'Outside' });
    c.props.push({ type: 'door_frame', x: cx, z: H + 0.95, y: 0, rot: 0 });
    const P = (type, x, z, rot = 0, o = {}) => { const p = { type, x, z, y: 0, rot, ...o }; c.props.push(p); return p; };
    const box = (x, z, hw, hd, h, rot = 0, walk = false) => c.colliders.add({ t: 'b', x, z, hw, hd, rot, y0: -1, y1: h, walk });
    const light = (x, z, y, r = 7, i = 0.9, col = 0xffa860) => { c.lights.push({ x, z, y, r, i, col }); };
    const spot = (x, z, rot, tags) => c.spots.push({ x, z, y: 0, rot, tags });
    const chest = (x, z, rot, ckind = 'chest', locked = 0) => { P('chest', x, z, rot); box(x, z, 0.5, 0.3, 0.6, rot); c.usables.push({ kind: 'container', x, y: 0.5, z, r: 0.7, cid: `${id}:chest:${c.usables.length}`, ckind, owner: c.owner, locked, name: 'Chest' }); };
    const bed = (x, z, rot) => { P('bed', x, z, rot); box(x, z, 0.55, 1.05, 0.55, rot, true); c.usables.push({ kind: 'bed', x, y: 0.5, z, r: 1, owner: c.owner, name: 'Bed' }); spot(x + Math.sin(rot) * 0.2, z, rot, ['bed']); };
    const table = (x, z, rot = 0, long = 1.8) => { P('table', x, z, rot, { len: long }); box(x, z, long / 2, 0.45, 0.85, rot); };
    const benchSpots = (x, z, long) => { for (const s of [-1, 1]) { P('bench', x, z + s * 0.9, 0, { len: long }); spot(x - long / 4, z + s * 0.9, s > 0 ? Math.PI : 0, ['sit']); spot(x + long / 4, z + s * 0.9, s > 0 ? Math.PI : 0, ['sit']); } };
    const hearth = (x, z, len = 1.4) => { P('hearth', x, z, 0, { len }); box(x, z, len / 2 + 0.3, 0.7, 0.4); light(x, z, 1, len > 2 ? 12 : 8, 1); c.lights.push({ x, z, y: 0.6, r: 0, i: 0, fire: true, len }); spot(x + len / 2 + 1.2, z, Math.PI / 2, ['hearth']); spot(x - len / 2 - 1.2, z, -Math.PI / 2, ['hearth']); };
    const counter = (x, z, len) => { P('counter', x, z, 0, { len }); box(x, z, len / 2, 0.35, 1.05); spot(x, z - 1.0, Math.PI, ['counter']); };
    const shelf = (x, z, rot) => { P('shelf', x, z, rot); box(x, z, 0.9, 0.25, 2, rot); };
    const station = (type, x, z, rot = 0) => { P(type, x, z, rot); box(x, z, 0.8, 0.45, 1, rot); c.usables.push({ kind: 'station', x, y: 0.9, z, r: 1, station: { type, id: `${id}:${type}`, loc: c.loc } }); spot(x, z - 1.1, Math.PI, ['study']); };
    const candles = (x, z) => { P('candles', x, z); light(x, z, 1.2, 5, 0.7); };
    switch (kind) {
        case 'house': {
            hearth(1 + W * 0.22, cx > 5 ? 1 + H * 0.45 : 2.5, 1.2);
            table(cx + 1, H * 0.55, 0, 1.6); benchSpots(cx + 1, H * 0.55, 1.6);
            bed(W - 0.2, back + 0.6, 0); if (W > 9) bed(W - 1.6, back + 0.6, 0);
            chest(W - 0.4, back + 2.4, -Math.PI / 2);
            shelf(1.6, back - 0.2, 0); P('barrel', 1.6, H - 0.4); candles(cx + 1, H * 0.55);
            break;
        }
        case 'inn': {
            hearth(cx, H * 0.5, 4);
            counter(W - 3, back + 1.2, 4); shelf(W - 3, back - 0.3, 0); P('barrel', W - 0.4, back + 0.2); P('barrel', W - 0.4, back + 1.2);
            for (const [tx, tz] of [[3, 3.2], [3, H - 2.8], [cx + 4, H - 2.8]]) { table(tx, tz, 0, 2); benchSpots(tx, tz, 2); candles(tx, tz); }
            bed(1.2, back + 0.4, 0); bed(2.8, back + 0.4, 0);
            spot(cx + 3, H * 0.5, -Math.PI / 2, ['bard']);
            station('cookpot', 1.5, H * 0.5 + 2.5, Math.PI / 2);
            break;
        }
        case 'shop': {
            counter(cx, back + 1.6, 3.4); shelf(cx - 1.5, back - 0.2, 0); shelf(cx + 1.5, back - 0.2, 0);
            chest(W - 0.4, back + 0.4, -Math.PI / 2, 'merchant', 3); bed(1.2, back + 0.6, 0); candles(cx, back + 1.6);
            P('barrel', 1.6, H - 0.4); P('crate', W - 0.6, H - 0.6);
            break;
        }
        case 'hall': {
            hearth(cx, H * 0.55, 9);
            P('highseat', cx, back + 0.6, 0); box(cx, back + 0.6, 0.8, 0.6, 1.4); spot(cx, back + 0.8, Math.PI, ['throne']);
            spot(cx - 2.2, back + 1.3, Math.PI, ['court']); spot(cx + 2.2, back + 1.3, Math.PI, ['court']);
            for (const s of [-1, 1]) { table(cx + s * 6, H * 0.55, 0, 7); for (let k = -1; k <= 1; k++) { spot(cx + s * 6 + k * 2, H * 0.55 + 0.9, Math.PI, ['sit']); spot(cx + s * 6 + k * 2, H * 0.55 - 0.9, 0, ['sit']); } }
            for (const x of [3, W - 1]) for (const z of [3, H - 2]) P('pillar', x, z);
            station('alchemy', 2.2, back + 0.6, 0); station('runetable', 4.4, back + 0.6, 0);
            P('banner_in', cx - 4, back - 0.3); P('banner_in', cx + 4, back - 0.3);
            chest(W - 1, back + 0.4, 0, 'chest', 4);
            break;
        }
        case 'guild': {
            hearth(cx, H * 0.5, 5);
            for (const s of [-1, 1]) { table(cx + s * 5.5, H * 0.5, 0, 3); benchSpots(cx + s * 5.5, H * 0.5, 3); }
            P('trophy', cx, back - 0.2); P('rack', 2, back); P('rack', W - 1, back);
            bed(1.4, H - 1, Math.PI / 2); bed(W - 0.4, H - 1, -Math.PI / 2);
            spot(cx, back + 1, Math.PI, ['court']);
            break;
        }
        case 'temple': {
            P('altar', cx, back + 0.8); box(cx, back + 0.8, 1.2, 0.5, 1.1); spot(cx, back + 1.9, Math.PI, ['altar']);
            for (let r = 0; r < 3; r++) for (const s of [-1, 1]) { P('bench', cx + s * 2.6, back + 4 + r * 2.4, 0, { len: 3 }); spot(cx + s * 2.6, back + 4 + r * 2.4, Math.PI, ['sit']); }
            candles(cx - 2, back + 0.6); candles(cx + 2, back + 0.6); light(cx, back + 1, 3, 10, 1, 0xffe0a0);
            break;
        }
        case 'barracks': {
            for (let i = 0; i < 4; i++) bed(1.4 + i * 2.2, back + 0.6, 0);
            table(cx, H - 2.5, 0, 3); benchSpots(cx, H - 2.5, 3); P('rack', W - 0.6, H - 2); candles(cx, H - 2.5);
            break;
        }
        case 'academy': {
            P('orrery_small', cx, H * 0.5); light(cx, H * 0.5, 3, 12, 1, 0x9ab8ff);
            station('runetable', 2.2, back + 0.4, 0); station('alchemy', W - 1.2, back + 0.4, 0);
            for (let i = 0; i < 4; i++) shelf(2 + i * 3.5, H + 0.4, Math.PI);
            table(cx, back + 3.5, 0, 3); benchSpots(cx, back + 3.5, 3); candles(cx, back + 3.5);
            bed(1.2, H - 1.5, Math.PI / 2);
            break;
        }
        case 'monastery': {
            hearth(cx, H * 0.45, 3); table(cx, H - 3, 0, 4); benchSpots(cx, H - 3, 4);
            for (let i = 0; i < 4; i++) bed(1.4 + i * 2.2, back + 0.4, 0);
            P('telescope', W - 2, back + 1.5); light(W - 2, back + 1.5, 3, 6, 0.6, 0x9ab8ff);
            break;
        }
        case 'keep': {
            // Hollowmere Keep: the armoury where the prologue gear waits, and the stair down to the undercroft
            for (let i = 0; i < 3; i++) { P('rack', 2 + i * 3, back - 0.2); }
            chest(W - 1, back + 0.6, 0, 'armoury'); chest(W - 1, back + 2.4, 0, 'armoury');
            table(cx, H * 0.5, 0, 3); candles(cx, H * 0.5); hearth(2.5, H - 2.5, 1.4);
            c.usables.push({ kind: 'door', x: 1.2, y: 1.2, z: H * 0.5, r: 1.1, door: { to: 'undercroft:d0', name: 'Hollowmere Undercroft' }, name: 'Hollowmere Undercroft' });
            P('trapdoor', 1.2, H * 0.5);
            break;
        }
    }
    if (rng.chance(0.5) && kind === 'house') P('rug', cx, H * 0.55);
    return c;
}

// ------------------------------------------------------------------ dungeons
function carveRect(c, x, z, w, h, level) { for (let tz = z; tz < z + h; tz++) for (let tx = x; tx < x + w; tx++) { const i = c.idx(tx, tz); c.tiles[i] = 1; c.fh[i] = level; } }

/** The Eye of the Storm: broken temple islands floating in a storm, open to the sky, joined by stone bridges. */
function genEye() {
    const W = 44, H = 44;
    const c = new Cell('eye', 'dungeon', 4, W, H);
    Object.assign(c, { theme: 'eye', loc: 'vahlokar', open: true, wallH: 0.6, wallLayer: 'masonry', floorLayer: 'flag', ambient: 0.6, fog: 0x2a3040, surface: 'stone', lightCol: 0x9ab8ff, level: 0, levels: 1 });
    const rng = new Rng(0xe7e);
    const disc = (cx, cz, r, h) => { for (let tz = Math.floor(cz - r); tz <= cz + r; tz++) for (let tx = Math.floor(cx - r); tx <= cx + r; tx++) { if (tx < 1 || tz < 1 || tx >= W - 1 || tz >= H - 1) continue; if (Math.hypot(tx + 0.5 - cx, tz + 0.5 - cz) > r + rng.next() * 0.6 - 0.3) continue; const i = c.idx(tx, tz); c.tiles[i] = 1; c.fh[i] = h + rng.next() * 0.15; } };
    const bridge = (ax, az, bx, bz, ha, hb) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) * 2); for (let k = 0; k <= n; k++) { const t = k / n; const tx = Math.floor(ax + (bx - ax) * t), tz = Math.floor(az + (bz - az) * t); const i = c.idx(tx, tz); if (!c.tiles[i]) { c.tiles[i] = 2; c.fh[i] = ha + (hb - ha) * t; } } };
    const mid = W / 2;
    disc(mid, mid, 7, 0);
    c.rooms.push({ x: mid - 7, z: mid - 7, w: 14, h: 14, level: 0 });
    const isl = [];
    for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2 + 0.3, x = mid + Math.cos(a) * 15, z = mid + Math.sin(a) * 15, h = [-2, 1.5, 3, -1, 2][k];
        disc(x, z, 3.2, h); bridge(mid + Math.cos(a) * 6, mid + Math.sin(a) * 6, x - Math.cos(a) * 2.5, z - Math.sin(a) * 2.5, 0, h);
        isl.push({ x, z, h, a });
        c.rooms.push({ x: Math.floor(x - 3), z: Math.floor(z - 3), w: 6, h: 6, level: h });
    }
    const P = (type, x, z, rot = 0, o = {}) => { const p = { type, x, z, y: c.floorAt(x, z), rot, ...o }; c.props.push(p); return p; };
    // broken pillars round the central disc, braziers of storm-fire on the islands
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, x = (mid + Math.cos(a) * 6.2) * 4, z = (mid + Math.sin(a) * 6.2) * 4; if (k % 3) P('pillar_broken', x, z, a); }
    for (const i of isl) { const x = i.x * 4, z = i.z * 4; P('brazier_in', x, z, 0, { s: 1.4 }); c.lights.push({ x, z, y: c.floorAt(x, z) + 1.6, r: 14, i: 1, col: 0x8ab0ff, fire: true }); P('rubble', x + 3, z - 2, i.a); }
    c.lights.push({ x: mid * 4, z: mid * 4, y: 6, r: 30, i: 0.8, col: 0x9ab8ff, fire: false });
    const ex = isl[1];
    // arrive on the island's inner edge, facing the central disc (the brazier stands at its centre)
    const ix = ex.x - Math.cos(ex.a) * 2.2, iz = ex.z - Math.sin(ex.a) * 2.2;
    c.entry = { x: ix * 4, z: iz * 4, rot: Math.atan2(-(mid - ix), -(mid - iz)) };
    c.upSpot = c.entry;
    // the way home appears once the storm breaks
    c.usables.push({ kind: 'door', x: ex.x * 4 - 4, y: c.floorAt(ex.x * 4 - 4, ex.z * 4) + 1.4, z: ex.z * 4, r: 1.4, door: { to: 'ext', name: 'Vahlokar Temple' }, name: 'Stair Down to Vahlokar', hidden: true, eyeExit: true });
    P('door_frame_big', ex.x * 4 - 4, ex.z * 4, Math.PI / 2);
    return c;
}

function genDungeon(id, loc, level, levels) {
    const L = LOC[loc] || { name: id, dungeon: { theme: 'cave' } };
    const D = L.dungeon || { theme: 'cave' };
    const theme = THEMES[D.theme] ? D.theme : 'cave';
    const T = THEMES[theme];
    const rng = new Rng(hashStr(id) ^ 0x5eed);
    const small = !!D.small;
    const W = small ? 16 : 26, H = small ? 16 : 26;
    const c = new Cell(id, 'dungeon', T.ts, W, H);
    Object.assign(c, { theme, loc, wallH: T.wallH, wallLayer: T.layer, floorLayer: T.floor, ambient: T.ambient, fog: T.fog, surface: T.surface, lightCol: T.light, organic: !!T.organic, level, levels });
    const last = level === levels - 1;
    // ---- rooms
    const want = small ? 4 : 7 + rng.int(0, 2);
    for (let tries = 0; tries < 400 && c.rooms.length < want; tries++) {
        const w = rng.int(2, theme === 'cave' ? 5 : 4) + (c.rooms.length === want - 1 && last ? 2 : 0), h = rng.int(2, 4) + (c.rooms.length === want - 1 && last ? 2 : 0);
        const x = rng.int(1, W - w - 2), z = rng.int(1, H - h - 2);
        if (c.rooms.some((r) => x < r.x + r.w + 1 && x + w + 1 > r.x && z < r.z + r.h + 1 && z + h + 1 > r.z)) continue;
        c.rooms.push({ x, z, w, h, level: 0 });
    }
    // order: start at the room nearest the bottom edge, then nearest-unvisited
    const rooms = [];
    let cur = c.rooms.reduce((a, b) => (b.z + b.h > a.z + a.h ? b : a));
    const left = new Set(c.rooms);
    while (cur) { rooms.push(cur); left.delete(cur); let best = null, bd = 1e9; for (const r of left) { const d = Math.hypot(r.x + r.w / 2 - cur.x - cur.w / 2, r.z + r.h / 2 - cur.z - cur.h / 2); if (d < bd) { bd = d; best = r; } } cur = best; }
    c.rooms = rooms;
    let lev = 0;
    rooms.forEach((r, i) => { if (i > 0) lev = clamp(lev + rng.pick([-1.6, 0, 0, 1.2, -0.8]), -8, 6); r.level = lev; carveRect(c, r.x, r.z, r.w, r.h, lev); });
    // ---- corridors (L-shaped, with ramps), plus a loop back near the end
    const corridor = (a, b, wide) => {
        let x = Math.floor(a.x + a.w / 2), z = Math.floor(a.z + a.h / 2);
        const tx = Math.floor(b.x + b.w / 2), tz = Math.floor(b.z + b.h / 2);
        const path = [];
        const horizFirst = rng.chance(0.5);
        const stepTo = (axis) => { while (axis === 'x' ? x !== tx : z !== tz) { if (axis === 'x') x += Math.sign(tx - x); else z += Math.sign(tz - z); path.push([x, z]); } };
        if (horizFirst) { stepTo('x'); stepTo('z'); } else { stepTo('z'); stepTo('x'); }
        const n = path.length;
        path.forEach(([px, pz], k) => {
            const inRoom = (tx2, tz2) => c.rooms.some((r) => tx2 >= r.x && tx2 < r.x + r.w && tz2 >= r.z && tz2 < r.z + r.h);
            const h = a.level + (b.level - a.level) * ((k + 1) / (n + 1));
            for (const [ox, oz] of wide ? [[0, 0], [1, 0], [0, 1]] : [[0, 0]]) {
                const qx = px + ox, qz = pz + oz;
                if (qx <= 0 || qz <= 0 || qx >= W - 1 || qz >= H - 1 || inRoom(qx, qz)) continue;
                const i = c.idx(qx, qz);
                if (!c.tiles[i]) { c.tiles[i] = 2; c.fh[i] = h; }
            }
        });
        return path;
    };
    c.corridors = [];
    for (let i = 1; i < rooms.length; i++) c.corridors.push(corridor(rooms[i - 1], rooms[i], T.organic));
    if (rooms.length > 4 && !small) corridor(rooms[rooms.length - 1], rooms[1], false);   // the way back out
    // organic themes: roughen the walls by opening random edge tiles next to floor
    if (T.organic) for (let k = 0; k < W * H * 0.08; k++) {
        const tx = rng.int(1, W - 2), tz = rng.int(1, H - 2);
        const i = c.idx(tx, tz);
        if (c.tiles[i]) continue;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => c.idx(tx + dx, tz + dz)).filter((j) => c.tiles[j] === 1);
        if (nb.length >= 2) { c.tiles[i] = 1; c.fh[i] = c.fh[nb[0]]; }
    }
    // relax corridor heights so no step between neighbours is a cliff
    for (let pass = 0; pass < 30; pass++) {
        for (let tz = 1; tz < H - 1; tz++) for (let tx = 1; tx < W - 1; tx++) {
            const i = c.idx(tx, tz);
            if (c.tiles[i] !== 2) continue;
            let s = 0, n = 0, worst = 0;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = c.idx(tx + dx, tz + dz); if (!c.tiles[j]) continue; s += c.fh[j]; n++; worst = Math.max(worst, Math.abs(c.fh[j] - c.fh[i])); }
            if (n && worst > 0.9) c.fh[i] = c.fh[i] * 0.4 + (s / n) * 0.6;
        }
    }
    // ---- entrance / exit doors
    const r0 = rooms[0], rl = rooms[rooms.length - 1];
    const doorAtEdge = (r, toward) => {
        // a door on the room edge that faces solid rock (it's drawn into the wall)
        const sides = toward === 'south' ? [[0, 1]] : [[0, -1], [1, 0], [-1, 0], [0, 1]];
        for (const [dx, dz] of sides) {
            const tx = dx === 0 ? Math.floor(r.x + r.w / 2) : dx > 0 ? r.x + r.w - 1 : r.x;
            const tz = dz === 0 ? Math.floor(r.z + r.h / 2) : dz > 0 ? r.z + r.h - 1 : r.z;
            if (!c.tiles[c.idx(tx + dx, tz + dz)]) {
                const cc = c.center(tx, tz);
                return { x: cc.x + dx * c.ts * 0.42, z: cc.z + dz * c.ts * 0.42, y: cc.y, rot: Math.atan2(dx, dz), inward: Math.atan2(-dx, -dz) };
            }
        }
        const cc = c.center(Math.floor(r.x + r.w / 2), Math.floor(r.z + r.h / 2));
        return { x: cc.x, z: cc.z, y: cc.y, rot: 0, inward: Math.PI };
    };
    const entryDoor = doorAtEdge(r0, 'south');
    const outName = level === 0 ? (LOC[loc]?.name ? `Leave ${LOC[loc].name}` : 'Outside') : 'Back up';
    c.usables.push({ kind: 'door', x: entryDoor.x, y: entryDoor.y + 1.2, z: entryDoor.z, r: 1.4, door: { to: level === 0 ? 'ext' : `${loc}:d${level - 1}`, ext: level === 0 ? { id: `${loc}:entrance` } : null, name: outName, arriveAt: level === 0 ? null : 'down' }, name: outName });
    c.props.push({ type: theme === 'cave' || theme === 'mine' ? 'cave_exit' : 'door_frame_big', x: entryDoor.x, z: entryDoor.z, y: entryDoor.y, rot: entryDoor.rot });
    const ein = { x: entryDoor.x + Math.sin(entryDoor.rot) * -2.2, z: entryDoor.z + Math.cos(entryDoor.rot) * -2.2 };
    c.entry = { x: ein.x, z: ein.z, y: c.floorAt(ein.x, ein.z), rot: entryDoor.rot };
    if (!last) {
        const dd = doorAtEdge(rl, 'any');
        c.usables.push({ kind: 'door', x: dd.x, y: dd.y + 1.2, z: dd.z, r: 1.4, door: { to: `${loc}:d${level + 1}`, name: 'Deeper', arriveAt: 'up' }, name: 'Deeper' });
        c.props.push({ type: 'door_frame_big', x: dd.x, z: dd.z, y: dd.y, rot: dd.rot });
        c.downSpot = { x: dd.x - Math.sin(dd.rot) * 2.2, z: dd.z - Math.cos(dd.rot) * 2.2, rot: dd.rot };
    }
    c.upSpot = c.entry;
    // ---- furnishing
    const P = (type, x, z, rot = 0, o = {}) => { const p = { type, x, z, y: c.floorAt(x, z), rot, ...o }; c.props.push(p); return p; };
    const roomPt = (r, mx = 0.3) => ({ x: (r.x + mx + rng.next() * (r.w - 2 * mx)) * c.ts, z: (r.z + mx + rng.next() * (r.h - 2 * mx)) * c.ts });
    const wallPt = (r) => {
        const side = rng.int(0, 3);
        const t = r.x * c.ts + 1 + rng.next() * (r.w * c.ts - 2), u = r.z * c.ts + 1 + rng.next() * (r.h * c.ts - 2);
        if (side === 0) return { x: t, z: r.z * c.ts + 0.6, rot: 0 };
        if (side === 1) return { x: t, z: (r.z + r.h) * c.ts - 0.6, rot: Math.PI };
        if (side === 2) return { x: r.x * c.ts + 0.6, z: u, rot: Math.PI / 2 };
        return { x: (r.x + r.w) * c.ts - 0.6, z: u, rot: -Math.PI / 2 };
    };
    const light = (x, z, y, r = 10, i = 0.85, col = T.light, fire = true) => { c.lights.push({ x, z, y, r, i, col, fire }); };
    const container = (ckind, x, z, rot, o = {}) => {
        P(ckind === 'urn' ? 'urn' : ckind === 'satchel' ? 'satchel' : ckind === 'boss' ? 'chest_big' : 'chest', x, z, rot);
        c.usables.push({ kind: 'container', x, y: c.floorAt(x, z) + 0.5, z, r: 0.8, cid: `${id}:c${c.usables.length}`, ckind, owner: null, locked: o.locked || 0, level: o.level, boss: ckind === 'boss', name: { urn: 'Burial Urn', satchel: 'Satchel', boss: 'Ornate Chest', chest: 'Chest' }[ckind] });
        if (ckind !== 'urn' && ckind !== 'satchel') c.colliders.add({ t: 'b', x, z, hw: 0.55, hd: 0.35, rot, y0: -10, y1: c.floorAt(x, z) + 0.7 });
    };
    rooms.forEach((r, i) => {
        const isLast = i === rooms.length - 1;
        const rc = { x: (r.x + r.w / 2) * c.ts, z: (r.z + r.h / 2) * c.ts };
        // lights
        const nl = 1 + (r.w * r.h > 12 ? 1 : 0);
        for (let k = 0; k < nl; k++) {
            const wp = wallPt(r);
            if (theme === 'barrow' || theme === 'temple') { P('brazier_in', wp.x, wp.z, wp.rot); light(wp.x, wp.z, c.floorAt(wp.x, wp.z) + 1.2, 11, 0.9, theme === 'barrow' ? 0xffb070 : 0xff8a40); }
            else if (theme === 'cave') { P('glowcaps', wp.x, wp.z, wp.rot); light(wp.x, wp.z, c.floorAt(wp.x, wp.z) + 0.5, 8, 0.6, T.light, false); }
            else if (theme === 'deepforge') { P('brass_lamp', wp.x, wp.z, wp.rot); light(wp.x, wp.z, c.floorAt(wp.x, wp.z) + 3, 12, 0.9, T.light, false); }
            else { P('lantern', wp.x, wp.z, wp.rot); light(wp.x, wp.z, c.floorAt(wp.x, wp.z) + 2, 10, 0.85); }
        }
        // theme dressing
        if (theme === 'barrow' || theme === 'temple') {
            for (let k = 0; k < 2 + rng.int(0, 2); k++) { const wp = wallPt(r); P('niche', wp.x, wp.z, wp.rot); }
            if (rng.chance(0.6)) { const p = roomPt(r, 0.6); container('urn', p.x, p.z, rng.next() * 6); }
            if (rng.chance(0.4)) { const p = roomPt(r, 0.6); P('coffin', p.x, p.z, rng.next() * 6); }
            if (theme === 'temple' && rng.chance(0.6)) { const wp = wallPt(r); P('wyrm_statue', wp.x, wp.z, wp.rot); }
        } else if (theme === 'cave') {
            for (let k = 0; k < 3; k++) { const p = roomPt(r, 0.3); P('stalagmite', p.x, p.z, rng.next() * 6, { s: 0.6 + rng.next() }); }
            if (rng.chance(0.5)) { const p = roomPt(r, 0.5); P('bones', p.x, p.z, rng.next() * 6); }
            if (rng.chance(0.35)) { const p = roomPt(r, 0.5); container('satchel', p.x, p.z, rng.next() * 6); }
        } else if (theme === 'mine') {
            for (let k = 0; k < 2; k++) { const wp = wallPt(r); P('ore_vein', wp.x, wp.z, wp.rot); c.usables.push({ kind: 'ore', x: wp.x, y: c.floorAt(wp.x, wp.z) + 1, z: wp.z, r: 1, ore: rng.pick(['ore_iron', 'ore_iron', 'ore_copper', 'ore_silver', 'ore_glimmer']), vid: `${id}:v${c.usables.length}`, name: 'Ore Vein' }); }
            P('support', rc.x, rc.z, 0); if (rng.chance(0.5)) { const p = roomPt(r, 0.5); P('minecart', p.x, p.z, rng.next() * 6); }
            if (rng.chance(0.5)) { const p = roomPt(r, 0.5); P('bedroll', p.x, p.z, rng.next() * 6); }
        } else if (theme === 'fort' || theme === 'undercroft') {
            if (rng.chance(0.6)) { const p = roomPt(r, 0.7); P('table', p.x, p.z, 0, { len: 2 }); }
            if (rng.chance(0.5)) { const wp = wallPt(r); P('rack', wp.x, wp.z, wp.rot); }
            if (rng.chance(0.5)) { const p = roomPt(r, 0.4); P('barrel', p.x, p.z); }
            if (rng.chance(0.4)) { const p = roomPt(r, 0.5); P('bedroll', p.x, p.z, rng.next() * 6); }
        } else if (theme === 'deepforge') {
            for (let k = 0; k < 2; k++) { const wp = wallPt(r); P('pipes', wp.x, wp.z, wp.rot); }
            if (rng.chance(0.5)) { const p = roomPt(r, 0.6); P('gearwork', p.x, p.z, rng.next() * 6); }
        }
        if (!isLast && i > 0 && rng.chance(0.3)) { const p = roomPt(r, 0.6); container('chest', p.x, p.z, rng.next() * 6, { locked: rng.chance(0.5) ? rng.int(1, 3) : 0 }); }
        // spawns
        if (i > 0) {
            const n = isLast ? rng.int(1, 2) : rng.int(1, 3) - (theme === 'cave' && rng.chance(0.3) ? 1 : 0);
            for (let k = 0; k < n; k++) {
                const tpl = rng.weighted(T.foes);
                let p = roomPt(r, 0.5), rot = rng.next() * 6, sleep = false;
                if (T.sleepers && rng.chance(0.55) && tpl.startsWith('wight')) { const wp = wallPt(r); p = wp; rot = wp.rot; sleep = true; P('niche', wp.x, wp.z, wp.rot); }
                c.spawns.push({ tpl, x: p.x, z: p.z, rot, sleep });
            }
        }
        if (isLast && last) {
            // the boss chamber
            const bp = { x: rc.x, z: rc.z };
            if (theme === 'barrow' || theme === 'temple') P('sarcophagus', bp.x, bp.z - c.ts * 0.6, 0);
            if (theme === 'deepforge') P('orrery', bp.x, bp.z, 0);
            const bossTpl = D.boss || T.foes[0][0];
            c.spawns.push({ tpl: bossTpl, x: bp.x, z: bp.z + 1, rot: 0, boss: true });
            const cp = wallPt(r);
            container('boss', cp.x, cp.z, cp.rot);
            if (D.sigil) {
                const sp = { x: rc.x + (r.w * c.ts) * 0.3, z: rc.z - (r.h * c.ts) * 0.25 };
                P('sigilstone_in', sp.x, sp.z, 0);
                c.usables.push({ kind: 'sigilstone', x: sp.x, y: c.floorAt(sp.x, sp.z) + 2.2, z: sp.z, r: 3, ring: D.sigil, loc, name: 'Sigil Stone' });
                light(sp.x, sp.z, c.floorAt(sp.x, sp.z) + 2.6, 9, 0.8, 0x88b8ff, false);
            }
            // the gate into the boss room: a star-dial puzzle in barrows with a dial, a lever elsewhere
            const path = c.corridors[c.corridors.length - 1];
            if (path && path.length > 2) {
                const [gx, gz] = path[path.length - 2];
                if (c.tiles[c.idx(gx, gz)] === 2) {
                    const gid = `${id}:gate`;
                    const ang = path.length > 2 ? Math.atan2(path[path.length - 1][0] - path[path.length - 3][0], path[path.length - 1][1] - path[path.length - 3][1]) : 0;
                    c.gates.push({ id: gid, tx: gx, tz: gz, rot: ang });
                    const gc = c.center(gx, gz);
                    P('gate', gc.x, gc.z, ang, { gate: gid });
                    if (D.dial && (theme === 'barrow' || theme === 'temple')) {
                        const solution = [0, 1, 2].map(() => rng.int(0, SYMBOLS.length - 1));
                        c.puzzle = { kind: 'dial', gate: gid, solution };
                        // three dials on the wall beside the gate, and the clue on a mural in an earlier room
                        const perp = ang + Math.PI / 2;
                        for (let k = 0; k < 3; k++) {
                            const dx = gc.x + Math.sin(ang) * -1.6 + Math.sin(perp) * (k - 1) * 0.9, dz = gc.z + Math.cos(ang) * -1.6 + Math.cos(perp) * (k - 1) * 0.9;
                            P('dial', dx, dz, ang + Math.PI, { dial: k });
                            c.usables.push({ kind: 'dial', x: dx, y: c.floorAt(dx, dz) + 1.4, z: dz, r: 0.45, dial: k, name: 'Star Dial' });
                        }
                        const mr = rooms[Math.max(1, rooms.length - 3)];
                        const mw = wallPt(mr);
                        P('mural', mw.x, mw.z, mw.rot, { solution });
                        c.usables.push({ kind: 'mural', x: mw.x, y: c.floorAt(mw.x, mw.z) + 1.8, z: mw.z, r: 1.2, solution, name: 'Carved Mural' });
                    } else {
                        const lr = rooms[rooms.length - 2];
                        const lw = wallPt(lr);
                        P('lever', lw.x, lw.z, lw.rot, { gate: gid });
                        c.usables.push({ kind: 'lever', x: lw.x, y: c.floorAt(lw.x, lw.z) + 1.1, z: lw.z, r: 0.6, gate: gid, name: 'Lever' });
                    }
                }
            }
        }
    });
    // ---- traps in corridors
    let trapN = theme === 'barrow' || theme === 'temple' ? 3 : theme === 'deepforge' ? 3 : theme === 'cave' ? 0 : 1;
    for (const path of c.corridors) {
        if (trapN <= 0) break;
        if (path.length < 4 || !rng.chance(0.55)) continue;
        const [tx, tz] = path[Math.floor(path.length / 2)];
        if (c.tiles[c.idx(tx, tz)] !== 2 || c.gates.some((g) => g.tx === tx && g.tz === tz)) continue;
        const cc = c.center(tx, tz);
        const kind = theme === 'deepforge' ? 'steam' : rng.pick(['plate', 'plate', 'blades', 'spikes']);
        const along = path.length > 1 ? Math.atan2(path[1][0] - path[0][0], path[1][1] - path[0][1]) : 0;
        c.traps.push({ id: `${id}:t${c.traps.length}`, kind, x: cc.x, z: cc.z, y: cc.y, rot: along, t: rng.next() * 3, cool: 0 });
        c.props.push({ type: `trap_${kind}`, x: cc.x, z: cc.z, y: cc.y, rot: along });
        trapN--;
    }
    return c;
}

// ------------------------------------------------------------------ the manager
export class Interiors {
    constructor(world) {
        this.w = world;
        this.cache = new Map();
        this.state = {};          // cellId → { dead: {spawnIdx: true}, gates: {}, dials: [], spawned, bossDead, loose }
        this.usedSpots = new Set();
    }
    stateOf(id) { return this.state[id] || (this.state[id] = { dead: {}, gates: {}, dials: [0, 0, 0], bossDead: false, loose: false, veins: {} }); }

    get(id) {
        let c = this.cache.get(id);
        if (c) return c;
        const m = /^([a-z_0-9]+):d(\d+)$/.exec(id);
        if (id === 'eye') c = genEye();
        else if (m) {
            const loc = m[1];
            const levels = LOC[loc]?.dungeon?.levels || 1;
            c = genDungeon(id, loc, +m[2], levels);
        } else {
            const door = this.w.settlements.doors.find((d) => d.to === id);
            const b = this.w.settlements.buildings.find((bb) => bb.id === id);
            c = buildInterior(id, b, door || (id === 'hollowmere:keep' ? { interior: 'keep', loc: 'hollowmere', id: 'hollowmere:keep' } : null));
        }
        c.state = this.stateOf(id);
        this.cache.set(id, c);
        return c;
    }

    /** A spot for a named NPC in the current building, by role. */
    spot(n, a) {
        const c = this.cache.get(this.w.cellId);
        if (!c || !c.spots.length) return null;
        const hour = this.w.time.hour;
        const want = hour < 6 || hour >= 22 ? 'bed'
            : { merchant: 'counter', innkeeper: 'counter', alchemist: 'counter', smith: 'counter', warden: 'throne', steward: 'court', sworn: 'court', wizard: 'study', scholar: 'study', priest: 'altar', elder: 'hearth', guildmaster: 'court' }[n.role] || 'sit';
        const free = (s) => !this.usedSpots.has(`${c.id}:${c.spots.indexOf(s)}`);
        const pick = c.spots.find((s) => s.tags.includes(want) && free(s)) || c.spots.find((s) => s.tags.includes('sit') && free(s)) || c.spots.find(free);
        if (!pick) return null;
        this.usedSpots.add(`${c.id}:${c.spots.indexOf(pick)}`);
        return pick;
    }

    /** Spawn the cell's inhabitants (skipping the dead) and loose loot, once per visit. */
    populate(c) {
        const w = this.w;
        const st = c.state;
        const lvl = w.player.sheet.level;
        c.actors = [];
        c.spawns.forEach((s, i) => {
            if (st.dead[i]) return;
            const a = w.spawn(s.tpl, s.x, s.z, { level: s.boss ? lvl + 2 : lvl, y: c.floorAt(s.x, s.z) + 1 });
            a.yaw = s.rot; a.spawnIdx = i; a.cellId = c.id;
            if (s.boss) { a.boss = true; a.isCellBoss = true; }
            if (s.sleep && a.ai) { a.ai.state = 'sleep'; a.ai.restPos = { x: s.x, z: s.z }; }
            else if (a.ai) a.ai.state = 'idle';
            c.actors.push(a);
        });
        if (!st.loose) {
            st.loose = true;
            const rng = new Rng(hashStr(c.id) ^ 77);
            for (const r of c.rooms.slice(1)) {
                if (!rng.chance(c.kind === 'dungeon' ? 0.35 : 0.0)) continue;
                const x = (r.x + 0.5 + rng.next() * (r.w - 1)) * c.ts, z = (r.z + 0.5 + rng.next() * (r.h - 1)) * c.ts;
                const id = rng.pick(['potion_restoreHealth_0', 'potion_restoreMana_0', 'potion_restoreStamina_0', 'lockpick', 'gold', 'arrow_iron', 'gem_garnet', 'goblet', 'essence_faint']);
                w.dropItem({ id }, id === 'gold' ? rng.int(5, 30) : id === 'arrow_iron' ? rng.int(3, 10) : 1, { x, y: c.floorAt(x, z) + 0.05, z });
            }
        }
    }

    onKill(t) {
        const c = this.cache.get(this.w.cellId);
        if (!c || t.spawnIdx == null || t.cellId !== c.id) return;
        c.state.dead[t.spawnIdx] = true;
        if (t.isCellBoss) {
            c.state.bossDead = true;
            if (c.loc && !this.w.cleared.has(c.loc)) { this.w.cleared.add(c.loc); this.w.emit('cleared', { loc: c.loc, dungeon: true }); }
        }
    }

    /** Levers, dials, murals, beds and ore veins. */
    use(f, world) {
        const c = this.cache.get(world.cellId);
        if (!c) return;
        const st = c.state;
        switch (f.kind) {
            case 'lever':
                st.gates[f.gate] = !st.gates[f.gate];
                world.emit('lever', { gate: f.gate, open: st.gates[f.gate] });
                break;
            case 'dial': {
                st.dials[f.dial] = (st.dials[f.dial] + 1) % SYMBOLS.length;
                world.emit('dial', { dial: f.dial, symbol: SYMBOLS[st.dials[f.dial]] });
                const pz = c.puzzle;
                if (pz && pz.solution.every((v, k) => st.dials[k] === v) && !st.gates[pz.gate]) { st.gates[pz.gate] = true; world.emit('lever', { gate: pz.gate, open: true, solved: true }); world.emit('note', { text: 'The star-dials lock into place. Somewhere a gate grinds open.' }); }
                break;
            }
            case 'mural': world.emit('mural', { solution: f.solution.map((k) => SYMBOLS[k]) }); break;
            case 'bed': world.emit('bed', { owner: f.owner }); break;
            case 'ore': {
                if (st.veins[f.vid] != null && world.time.total - st.veins[f.vid] < 72) { world.emit('note', { text: 'This vein is worked out for now.' }); break; }
                const p = world.player;
                if (!p.inv.some((e) => e.id === 'pickaxe')) { world.emit('note', { text: 'You need a pickaxe to mine this vein.' }); break; }
                st.veins[f.vid] = world.time.total;
                world.giveItem({ id: f.ore }, 2 + world.rng.int(0, 1));
                world.emit('mine', { ore: f.ore });
                break;
            }
            default: world.emit('use', { focus: f });
        }
    }

    /** Traps tick while the player is inside. */
    tick(dt) {
        const w = this.w;
        const c = this.cache.get(w.cellId);
        if (!c) return;
        for (const tr of c.traps) {
            tr.t += dt;
            tr.cool = Math.max(0, tr.cool - dt);
            const hs = c.ts * 0.42;
            const inTile = (a) => Math.abs(a.pos.x - tr.x) < hs && Math.abs(a.pos.z - tr.z) < hs && Math.abs(a.pos.y - tr.y) < 1.5;
            const victims = w.actors.filter((a) => !a.dead && a.cell === c.id && inTile(a) && a.rig !== 'dragon');
            if (tr.kind === 'plate' || tr.kind === 'spikes') {
                if (tr.cool > 0 || !victims.length) continue;
                const v = victims[0];
                if (v.kind === 'player' && v.sneaking && w.rng.chance(v.sheet.skills.sneak / 150)) { tr.cool = 1.5; continue; }
                tr.cool = tr.kind === 'plate' ? 2.5 : 4;
                for (const a of victims) applyDamage(w, a, { amount: (tr.kind === 'plate' ? 14 : 22) + w.player.sheet.level, type: 'phys', source: null, stagger: tr.kind === 'spikes', trap: true });
                w.emit('trap', { kind: tr.kind, x: tr.x, y: tr.y, z: tr.z, rot: tr.rot });
            } else if (tr.kind === 'blades') {
                const ph = Math.sin(tr.t * 2.4);
                tr.phase = ph;
                if (Math.abs(ph) < 0.25) for (const a of victims) {
                    if ((a.bladeCool || 0) > w.time.total) continue;
                    a.bladeCool = w.time.total + 0.02;
                    applyDamage(w, a, { amount: 18 + w.player.sheet.level, type: 'phys', source: null, stagger: true, trap: true });
                    w.emit('trap', { kind: 'blades', x: tr.x, y: tr.y, z: tr.z });
                }
            } else if (tr.kind === 'steam') {
                const on = (tr.t % 4) < 1.2;
                if (on !== tr.on) { tr.on = on; if (on) w.emit('trap', { kind: 'steam', x: tr.x, y: tr.y, z: tr.z }); }
                if (on) for (const a of victims) applyDamage(w, a, { amount: 9 * dt, type: 'fire', source: null, quiet: true, trap: true });
            }
        }
    }
}
