// ============================================================
// Procedural levels. Pure: seed in, level out. No DOM, no Math.random.
//
// A level is built left to right from segments (flat, gap, pipes, ? rows,
// stairs, floaters, lifts, firebars...). Between segments sit POCKETS —
// shelves, shafts, vaults and basements that hold the level's secret
// shards and Grandma's lost gadgets. Some pockets need a gadget the player
// doesn't have yet; that is the whole point.
//
// generateLevel() re-rolls a sub-seed until validate.js agrees that the
// goal and the non-gated shards are reachable with the moves the world
// assumes you own.
// ============================================================

import { RNG, hash32, clamp } from './rng.js';
import { T } from './tiles.js';
import { WORLDS, VAULTS, baselineFor, LEVEL_NAMES, LEVEL_TIME, GADGETS } from './config.js';
import { validateLevel } from './validate.js';

export const LEVEL_H = 28;
const G0 = 21;            // default surface row
const G_MIN = 14, G_MAX = 22;

export function themeOf(world, index) {
    if (world === 5) return 'keep';
    if (index === 5) return 'castle';
    return WORLDS[world - 1].theme;
}

const SEGMENTS = {
    meadow: [['flat', 2], ['hills', 3], ['gap', 3], ['stairs', 2], ['pipes', 3], ['qrow', 4], ['floaters', 1], ['spring', 1], ['coinarc', 1]],
    dunes: [['flat', 1], ['hills', 4], ['gap', 3], ['stairs', 3], ['qrow', 3], ['spikes', 3], ['pipes', 1], ['floaters', 1], ['spring', 1], ['boostep', 2]],
    grotto: [['flat', 1], ['hills', 3], ['gap', 3], ['qrow', 3], ['cavelow', 3], ['floaters', 2], ['pipes', 2], ['spikes', 1], ['bubblestair', 2], ['boostep', 1]],
    skies: [['floaters', 5], ['lift', 3], ['gap', 3], ['spring', 2], ['qrow', 2], ['flat', 1], ['hills', 1], ['chimney', 2], ['boostep', 1]],
    keep: [['flat', 1], ['lavapit', 4], ['firebar', 3], ['crusher', 2], ['stairs', 2], ['qrow', 1], ['spikes', 2], ['redwall', 2], ['lift', 1], ['chimney', 1], ['bubblestair', 1]],
    castle: [['flat', 2], ['lavapit', 3], ['firebar', 3], ['crusher', 2], ['stairs', 1], ['qrow', 1], ['spikes', 1]],
};

// Pocket types by the gadget they need (null = baseline moves).
export const POCKET_NEEDS = {
    basement: null, hiddenshelf: null, springshelf: null,
    high: 'boots', bubble: 'frost', shaft: 'mitts', red: 'rocket',
};

function baselinePocketTypes(base) {
    const out = ['basement', 'hiddenshelf', 'springshelf'];
    if (base.has('boots')) out.push('high');
    if (base.has('frost')) out.push('bubble');
    if (base.has('mitts')) out.push('shaft');
    if (base.has('rocket')) out.push('red');
    return out;
}
function gatedPocketTypes(base) {
    return ['high', 'bubble', 'shaft', 'red'].filter(t => !base.has(POCKET_NEEDS[t]));
}

class Gen {
    constructor(seed, world, index) {
        this.rng = new RNG(seed);
        this.world = world;
        this.index = index;
        this.theme = themeOf(world, index);
        this.castle = index === 5;
        this.base = baselineFor(world);
        this.t = clamp(((world - 1) * 4 + Math.min(index, 4) - 1) / 19, 0, 1);
        const len = this.castle ? 120 + world * 6 : 150 + Math.round(this.t * 60) + this.rng.int(0, 20);
        this.w = len;
        this.h = LEVEL_H;
        this.surf = new Int16Array(len + 64).fill(-1);
        this.pitKind = new Uint8Array(len + 64);   // 0 bottomless, 1 lava
        this.reserved = new Uint8Array(len + 64);
        this.ceil = new Int16Array(len + 64).fill(-1);
        this.tiles = new Uint8Array((len + 64) * LEVEL_H);
        this.contents = {};
        this.entities = [];
        this.carves = [];
        this.groundSpots = [];
        this.airSpots = [];
        this.shardSpots = [];
        this.gates = [];
        this.liftCells = [];
        this.x = 0;
        this.g = G0;
        this.maxRise = world === 1 ? 3 : 4;
        this.maxGap = world === 1 ? (index <= 2 ? 3 : 4) : world === 2 ? 4 : 5;
    }

    // ---------------------------------------------------- primitives
    set(x, y, t) { if (x >= 0 && y >= 0 && y < this.h && x < this.surf.length) this.tiles[y * this.surf.length + x] = t; }
    get(x, y) { return (x >= 0 && y >= 0 && y < this.h && x < this.surf.length) ? this.tiles[y * this.surf.length + x] : T.EMPTY; }
    col(h) { this.surf[this.x] = h; this.x++; }
    flat(n, enemies = true) {
        const x0 = this.x;
        for (let i = 0; i < n; i++) this.col(this.g);
        if (enemies) for (let x = x0 + 1; x < this.x - 1; x++) this.groundSpots.push([x, this.g - 1]);
    }
    pitCols(n, kind = 0) { for (let i = 0; i < n; i++) { this.pitKind[this.x] = kind; this.col(-1); } }
    content(x, y, what) { this.contents[y * this.surf.length + x] = what; }
    ent(e) { this.entities.push(e); return e; }
    rise() { return this.rng.int(1, this.maxRise); }
    setG(g) { this.g = clamp(g, G_MIN, G_MAX); }

    qContent(first) {
        const r = this.rng;
        if (first && r.chance(0.55)) return r.weighted([['berry', 5], ['pepper', 3], ['shield', 3], ['star', 1]]);
        return r.chance(0.08) ? r.weighted([['berry', 3], ['pepper', 1], ['shield', 1]]) : 'coin';
    }
    brickContent() {
        const r = this.rng;
        if (r.chance(0.07)) return 'coins';
        if (r.chance(0.015)) return 'star';
        return null;
    }

    // ---------------------------------------------------- segments
    seg_flat() { this.flat(this.rng.int(4, 8)); }

    seg_hills() {
        const steps = this.rng.int(2, 4);
        for (let i = 0; i < steps; i++) {
            const up = this.rng.chance(0.5);
            const d = up ? this.rise() : this.rng.int(1, 4);
            this.setG(this.g + (up ? -d : d));
            this.flat(this.rng.int(3, 6));
        }
    }

    seg_gap(kind = 0) {
        this.flat(2, false);
        const rise = this.rng.chance(0.3) ? this.rng.int(1, 2) * (this.rng.chance(0.5) ? -1 : 1) : 0;
        let w = this.rng.int(2, this.maxGap);
        if (rise < 0) w = Math.max(2, Math.min(w, this.maxGap - 1));     // landing is higher
        const x0 = this.x;
        this.pitCols(w, kind);
        if (this.rng.chance(0.5)) {            // coin arc over the gap
            for (let i = 0; i < w; i++) this.set(x0 + i, this.g - 3 - (i > 0 && i < w - 1 ? 1 : 0), T.COIN);
        }
        this.setG(this.g + rise);
        this.flat(3, false);
        if (kind === 1) {
            for (let i = 0; i < w; i += 3) if (this.rng.chance(0.6)) this.ent({ t: 'enemy', kind: 'lavabub', x: x0 + i, y: this.h - 4 });
        }
    }

    seg_lavapit() { this.seg_gap(1); }

    seg_stairs() {
        const hN = this.rng.int(3, this.world === 1 ? 4 : 6);
        this.flat(2);
        const x0 = this.x;
        for (let i = 1; i <= hN; i++) {
            this.col(this.g);
            for (let k = 1; k <= i; k++) this.set(this.x - 1, this.g - k, T.HARD);
        }
        let gap = 0;
        if (this.rng.chance(0.5)) {
            gap = this.rng.int(1, Math.min(3, this.maxGap));
            this.pitCols(gap);
        }
        if (this.rng.chance(0.7)) {
            for (let i = hN; i >= 1; i--) {
                this.col(this.g);
                for (let k = 1; k <= i; k++) this.set(this.x - 1, this.g - k, T.HARD);
            }
        } else {
            // plateau: the ground simply rises to the top step
            this.setG(this.g - hN);
        }
        this.shardSpots.push([x0 + hN - 1, this.g - hN - 3]);
        this.flat(3);
    }

    seg_pipes() {
        const n = this.rng.int(1, 3);
        this.flat(2);
        for (let i = 0; i < n; i++) {
            const ph = this.rng.int(2, this.maxRise);
            const x = this.x;
            this.col(this.g); this.col(this.g);
            this.set(x, this.g - ph, T.PIPE_TL); this.set(x + 1, this.g - ph, T.PIPE_TR);
            for (let k = this.g - ph + 1; k < this.g; k++) { this.set(x, k, T.PIPE_L); this.set(x + 1, k, T.PIPE_R); }
            if (this.world !== 2 && this.rng.chance(0.35 + this.t * 0.3) && this.hasEnemy('chomper')) {
                this.ent({ t: 'enemy', kind: 'chomper', x: x, y: this.g - ph - 1 });
            }
            if (i === n - 1) this.shardSpots.push([x, this.g - ph - 3]);
            this.flat(this.rng.int(3, 5));
        }
    }

    hasEnemy(k) { return WORLDS[this.world - 1].enemies.some(([e]) => e === k); }

    seg_qrow() {
        this.flat(2);
        const n = this.rng.int(3, 6);
        const x0 = this.x;
        this.flat(n + 4);
        const row = this.g - 4;
        let firstQ = true;
        for (let i = 0; i < n; i++) {
            const x = x0 + 2 + i;
            if (this.rng.chance(0.45)) {
                this.set(x, row, T.QBLOCK);
                this.content(x, row, this.qContent(firstQ));
                firstQ = false;
            } else {
                this.set(x, row, T.BRICK);
                const c = this.brickContent();
                if (c) this.content(x, row, c);
            }
        }
        if (this.rng.chance(0.45)) {
            // an upper row, reached by standing on the lower one
            const m = Math.max(2, n - 2);
            const u0 = x0 + 2 + this.rng.int(0, n - m);
            for (let i = 0; i < m; i++) {
                const x = u0 + i;
                if (i === 0 || this.rng.chance(0.3)) { this.set(x, row - 3, T.QBLOCK); this.content(x, row - 3, this.qContent(i === 0)); }
                else this.set(x, row - 3, T.BRICK);
            }
            this.shardSpots.push([u0 + (m >> 1), row - 5]);
        } else {
            for (let i = 0; i < n; i++) if (this.rng.chance(0.6)) this.set(x0 + 2 + i, row - 1, T.COIN);
        }
    }

    seg_coinarc() {
        this.flat(2);
        const x0 = this.x;
        this.flat(7);
        for (let i = 0; i < 6; i++) this.set(x0 + i, this.g - 2 - Math.round(Math.sin(i / 5 * Math.PI) * 2), T.COIN);
    }

    seg_floaters() {
        this.flat(2, false);
        const plats = this.rng.int(2, 4);
        let y = this.g;
        const x0 = this.x;
        for (let p = 0; p < plats; p++) {
            const gap = this.rng.int(2, Math.min(3, this.maxGap));
            this.pitCols(gap);
            const w = this.rng.int(2, 4);
            y = clamp(y + this.rng.int(-2, 2), this.g - 3, this.g + 1);
            const px = this.x;
            this.pitCols(w);
            for (let i = 0; i < w; i++) this.set(px + i, y, T.ONEWAY);
            if (this.rng.chance(0.5)) for (let i = 0; i < w; i++) this.set(px + i, y - 1, T.COIN);
            if (p === 1) this.shardSpots.push([px + (w >> 1), y - 4]);
            if (this.rng.chance(0.4)) this.airSpots.push([px, y - 3]);
        }
        const gap = this.rng.int(2, Math.min(3, this.maxGap));
        this.pitCols(gap);
        // land no higher than the last platform can reach
        this.setG(Math.max(this.g, y - 2));
        this.flat(3, false);
        if (this.x - x0 > 6) this.airSpots.push([x0 + 4, this.g - 5]);
    }

    seg_spring() {
        this.flat(3);
        const x = this.x;
        this.col(this.g);
        this.set(x, this.g - 1, T.SPRING);
        this.col(this.g);
        const hw = this.rng.int(this.maxRise + 2, 7);
        this.setG(this.g - hw);
        this.flat(4);
        this.shardSpots.push([this.x - 2, this.g - 3]);
        this.flat(2);
    }

    seg_spikes() {
        this.flat(3);
        const patches = this.rng.int(1, 3);
        for (let p = 0; p < patches; p++) {
            const w = this.rng.int(1, 3);
            const x0 = this.x;
            this.flat(w, false);
            for (let i = 0; i < w; i++) this.set(x0 + i, this.g - 1, T.SPIKE);
            this.flat(this.rng.int(3, 5), false);
        }
    }

    seg_boostep() {
        if (!this.base.has('boots')) return this.seg_hills();
        this.flat(3);
        this.setG(this.g - this.rng.int(5, 6));
        this.flat(5);
        this.shardSpots.push([this.x - 3, this.g - 3]);
        this.flat(2);
        this.setG(this.g + this.rng.int(3, 5));
        this.flat(3);
    }

    seg_cavelow() {
        this.flat(2);
        const n = this.rng.int(8, 14);
        const x0 = this.x;
        const cy = this.g - 6;
        for (let i = 0; i < n; i++) {
            this.col(this.g);
            this.ceil[this.x - 1] = cy;
        }
        for (let x = x0 + 2; x < this.x - 2; x += this.rng.int(3, 6)) {
            if (this.rng.chance(0.5)) this.ent({ t: 'enemy', kind: 'bat', x, y: cy + 1 });
            else this.groundSpots.push([x, this.g - 1]);
        }
        for (let i = 2; i < n - 2; i++) if (this.rng.chance(0.3)) this.set(x0 + i, this.g - 2, T.COIN);
        this.flat(2);
    }

    seg_bubblestair() {
        if (!this.base.has('frost')) return this.seg_hills();
        this.flat(3, false);
        const x0 = this.x;
        this.flat(6, false);
        // bubbles every 3 rows, zig-zagging up to a plateau 9 high
        this.set(x0 + 1, this.g - 3, T.BUBBLE);
        this.set(x0 + 3, this.g - 6, T.BUBBLE);
        this.set(x0 + 5, this.g - 9, T.BUBBLE);
        this.setG(this.g - 10);
        this.flat(5);
        this.shardSpots.push([this.x - 3, this.g - 3]);
    }

    seg_chimney() {
        if (!this.base.has('mitts')) return this.seg_floaters();
        // a hanging pillar next to a tall plateau: walk under the pillar and wall-jump up
        this.flat(3, false);
        const x0 = this.x;
        this.flat(3, false);
        const R = 9;
        for (let y = this.g - R - 1; y <= this.g - 3; y++) this.set(x0, y, T.HARD);
        this.setG(this.g - R);
        this.flat(5);
        this.shardSpots.push([this.x - 2, this.g - 3]);
    }

    seg_lift() {
        this.flat(2, false);
        const n = this.rng.int(8, 12);
        const x0 = this.x;
        this.pitCols(n, this.theme === 'keep' || this.theme === 'castle' ? 1 : 0);
        const y = this.g;
        this.ent({ t: 'lift', x: x0, y, x0, x1: x0 + n - 3, speed: 34 + this.t * 16 });
        for (let i = 0; i < n; i++) this.liftCells.push([x0 + i, y]);
        this.flat(3, false);
    }

    seg_firebar() {
        this.flat(3);
        const x0 = this.x;
        this.flat(7, false);
        const by = this.g - 3;
        this.set(x0 + 3, by, T.USED);
        this.ent({ t: 'firebar', x: x0 + 3, y: by, len: this.rng.int(3, 5), speed: (this.rng.chance(0.5) ? 1 : -1) * (1.6 + this.t) });
        this.flat(2);
    }

    seg_crusher() {
        this.flat(2);
        const n = this.rng.int(1, 2);
        for (let i = 0; i < n; i++) {
            const x0 = this.x;
            this.flat(5, false);
            this.ent({ t: 'enemy', kind: 'crusher', x: x0 + 2, y: this.g - 7 });
        }
        this.flat(2);
    }

    seg_redwall() {
        if (!this.base.has('rocket')) return this.seg_firebar();
        this.flat(3, false);
        const x = this.x;
        this.flat(4, false);
        for (let y = 3; y <= this.g - 1; y++) this.set(x + 1, y, y >= this.g - 3 ? T.RED : T.HARD);
        for (let y = 3; y <= this.g - 1; y++) this.set(x + 2, y, y >= this.g - 3 ? T.RED : T.HARD);
        this.gates.push('red');
        this.flat(2);
    }

    // ---------------------------------------------------- pockets
    pocket(type, reward) {
        // reserved flat stretch: nothing else nearby that could be used as a step
        const margin = 6;
        this.setG(clamp(this.g, 19, 21));
        const x0 = this.x;
        const w = type === 'red' || type === 'basement' ? 10 : 6;
        this.flat(margin + w + margin, false);
        for (let x = x0; x < this.x; x++) this.reserved[x] = 1;
        const cx = x0 + margin;           // first column of the pocket body
        const g = this.g;
        let rx, ry;
        switch (type) {
            case 'high': {
                for (let i = 0; i < 4; i++) this.set(cx + 1 + i, g - 6, T.ONEWAY);
                rx = cx + 2; ry = g - 8;
                for (let i = 0; i < 4; i++) if (i !== 1) this.set(cx + 1 + i, g - 7, T.COIN);
                break;
            }
            case 'bubble': {
                this.set(cx, g - 3, T.BUBBLE);
                this.set(cx + 2, g - 6, T.BUBBLE);
                this.set(cx, g - 9, T.BUBBLE);
                for (let i = 0; i < 4; i++) this.set(cx + 2 + i, g - 11, T.ONEWAY);
                rx = cx + 3; ry = g - 13;
                break;
            }
            case 'shaft': {
                // two walls with a 2-wide chimney between; a room on top
                const L = cx + 1, R = cx + 4;
                const roomFloor = g - 13;
                for (let y = roomFloor; y <= g - 3; y++) { this.set(L, y, T.HARD); this.set(R, y, T.HARD); }
                // room: floor with the chimney mouth, walls, ceiling
                for (let x = L - 2; x <= R + 2; x++) {
                    this.set(x, roomFloor - 4, T.HARD);
                    if (x > L && x < R) continue;
                    this.set(x, roomFloor, T.HARD);
                }
                for (let y = roomFloor - 4; y <= roomFloor; y++) { this.set(L - 2, y, T.HARD); this.set(R + 2, y, T.HARD); }
                rx = R + 1; ry = roomFloor - 1;
                this.set(L - 1, roomFloor - 1, T.COIN);
                break;
            }
            case 'red': {
                // a low bunker (3 high, so it's a single-jump step) sealed with red rock
                const x1 = cx + 7;
                for (let x = cx; x <= x1; x++) { this.set(x, g - 3, T.HARD); }
                for (let y = g - 3; y <= g - 1; y++) { this.set(cx, y, T.HARD); this.set(x1, y, T.HARD); }
                for (let y = g - 2; y <= g - 1; y++) this.set(cx, y, T.RED);
                for (let x = cx + 2; x < x1 - 1; x++) this.set(x, g - 1, T.COIN);
                rx = cx + 6; ry = g - 1;
                break;
            }
            case 'basement': {
                const b0 = cx + 1, b1 = cx + 8;
                this.carves.push(() => {
                    for (let x = b0; x <= b1; x++) for (let y = g + 1; y <= g + 2; y++) this.set(x, y, T.EMPTY);
                    this.set(cx + 2, g, T.CRACK); this.set(cx + 3, g, T.CRACK);
                    for (let x = b0 + 3; x <= b1 - 1; x++) this.set(x, g + 2, T.COIN);
                });
                rx = b1; ry = g + 2;
                break;
            }
            case 'hiddenshelf': {
                this.set(cx + 1, g - 4, T.HIDDEN);
                this.content(cx + 1, g - 4, 'coin');
                for (let i = 0; i < 3; i++) this.set(cx + 2 + i, g - 7, T.ONEWAY);
                rx = cx + 3; ry = g - 8;
                break;
            }
            case 'springshelf': {
                this.set(cx, g - 1, T.SPRING);
                for (let i = 0; i < 3; i++) this.set(cx + 2 + i, g - 7, T.ONEWAY);
                rx = cx + 3; ry = g - 8;
                break;
            }
        }
        if (POCKET_NEEDS[type]) this.gates.push(type);
        const e = { ...reward, x: rx, y: ry, pocket: type };
        this.ent(e);
        return e;
    }

    // ---------------------------------------------------- level
    build(slots) {
        const r = this.rng;
        const table = SEGMENTS[this.theme];
        this.flat(12, false);
        // pockets at spread-out positions
        const pocketQueue = [...slots];
        const endX = this.w - (this.castle ? 34 : 26);
        const pocketAt = pocketQueue.map((_, i) => Math.round(endX * (0.18 + 0.68 * (i + 0.5) / pocketQueue.length)));
        let checkpointDone = false;
        let last = '';
        while (this.x < endX) {
            if (pocketQueue.length && this.x >= pocketAt[0]) {
                pocketAt.shift();
                const p = pocketQueue.shift();
                this.pocket(p.type, p.reward);
                continue;
            }
            if (!checkpointDone && this.x >= endX * 0.5) {
                this.setG(clamp(this.g, 17, 21));
                const x = this.x;
                this.flat(4, false);
                this.ent({ t: 'checkpoint', x: x + 1, y: this.g - 1 });
                checkpointDone = true;
                continue;
            }
            let s = r.weighted(table);
            if (s === last && r.chance(0.6)) s = r.weighted(table);
            last = s;
            this['seg_' + s]();
            // keep the ground within bounds for the next segment
            if (this.g < 16) { this.setG(this.g + 3); this.flat(2); }
        }
        while (pocketQueue.length) { const p = pocketQueue.shift(); this.pocket(p.type, p.reward); }
        if (this.castle) this.arena();
        else this.finish();
    }

    finish() {
        this.setG(clamp(this.g, 18, 21));
        this.flat(3);
        const h = this.world === 1 ? 5 : 7;
        const x0 = this.x;
        for (let i = 1; i <= h; i++) {
            this.col(this.g);
            for (let k = 1; k <= i; k++) this.set(this.x - 1, this.g - k, T.HARD);
        }
        this.col(this.g);
        for (let k = 1; k <= h; k++) this.set(this.x - 1, this.g - k, T.HARD);
        this.flat(3, false);
        const px = this.x;
        this.flat(1, false);
        this.set(px, this.g - 1, T.HARD);
        for (let y = this.g - 11; y < this.g - 1; y++) this.set(px, y, T.POLE);
        this.ent({ t: 'goal', x: px, y: this.g - 1, top: this.g - 11 });
        this.flat(12, false);
        this.ent({ t: 'castle', x: this.x - 8, y: this.g - 1 });
        this.shardSpots.push([x0 + h - 1, this.g - h - 3]);
        this.w = this.x;
    }

    arena() {
        this.setG(20);
        this.flat(4, false);
        const x0 = this.x;
        const n = 26;
        this.flat(n, false);
        const top = this.g - 12;
        for (let x = x0; x < x0 + n; x++) for (let y = 0; y <= top; y++) this.set(x, y, T.HARD);
        for (let y = 0; y < this.g; y++) this.set(x0 + n, y, T.HARD);
        this.col(this.g);
        // two dodge platforms
        for (let i = 0; i < 3; i++) { this.set(x0 + 5 + i, this.g - 4, T.ONEWAY); this.set(x0 + n - 8 + i, this.g - 4, T.ONEWAY); }
        this.arenaBox = { x0, x1: x0 + n - 1, top: top + 1, floor: this.g };
        this.ent({ t: 'boss', kind: WORLDS[this.world - 1].boss, x: x0 + n - 6, y: this.g - 1 });
        this.w = this.x;
    }

    // ---------------------------------------------------- finishing passes
    fill() {
        const W = this.surf.length;
        for (let x = 0; x < this.w; x++) {
            const s = this.surf[x];
            if (s >= 0) {
                for (let y = s; y < this.h; y++) if (this.get(x, y) === T.EMPTY) this.set(x, y, T.GROUND);
            } else if (this.pitKind[x] === 1) {
                this.set(x, this.h - 3, T.LAVA);
                for (let y = this.h - 2; y < this.h; y++) this.set(x, y, T.LAVA_FILL);
            }
            if (this.ceil[x] >= 0) for (let y = 0; y <= this.ceil[x]; y++) if (this.get(x, y) === T.EMPTY) this.set(x, y, T.CEIL);
        }
        if (this.theme === 'grotto' || this.theme === 'keep' || this.theme === 'castle') {
            for (let x = 0; x < this.w; x++) for (let y = 0; y < 2; y++) if (this.get(x, y) === T.EMPTY) this.set(x, y, T.CEIL);
        }
        for (const c of this.carves) c();
        void W;
    }

    populate() {
        const r = this.rng;
        const list = WORLDS[this.world - 1].enemies.filter(([k]) => k !== 'chomper');
        const ground = list.filter(([k]) => !['bee', 'bat', 'drizzle'].includes(k));
        const air = list.filter(([k]) => ['bee', 'bat', 'drizzle'].includes(k));
        const dens = 0.05 + 0.05 * this.t + (this.castle ? 0.02 : 0);
        const target = Math.round(this.w * dens);
        const spots = r.shuffle(this.groundSpots.filter(([x]) => x > 14 && !this.reserved[x] && this.surf[x] >= 0));
        const used = [];
        const free = x => !used.some(u => Math.abs(u - x) < 4);
        let placed = 0;
        for (const [x, y] of spots) {
            if (placed >= target * 0.8) break;
            if (!free(x)) continue;
            if (this.get(x, y) !== T.EMPTY || this.get(x, y - 1) !== T.EMPTY) continue;
            if (this.surf[x] !== y + 1) continue;
            used.push(x);
            this.ent({ t: 'enemy', kind: r.weighted(ground), x, y });
            placed++;
        }
        if (air.length) {
            for (const [x, y] of r.shuffle(this.airSpots)) {
                if (placed >= target) break;
                if (x < 14 || this.reserved[x] || !free(x)) continue;
                used.push(x);
                this.ent({ t: 'enemy', kind: r.weighted(air), x, y });
                placed++;
            }
            // a few extra fliers over open ground
            let extra = Math.round((target - placed) * 0.5);
            for (const [x, y] of r.shuffle(this.groundSpots.slice())) {
                if (extra <= 0) break;
                if (x < 16 || this.reserved[x] || !free(x)) continue;
                const k = r.weighted(air);
                const ay = k === 'drizzle' ? y - 8 : y - r.int(2, 4);
                if (ay < 3) continue;
                let clear = true;
                for (let yy = ay - 1; yy <= ay + 1; yy++) if (this.get(x, yy) !== T.EMPTY) clear = false;
                if (!clear) continue;
                used.push(x);
                this.ent({ t: 'enemy', kind: k, x, y: ay });
                extra--;
            }
        }
    }

    decorate() {
        const r = this.rng;
        for (let x = 1; x < this.w - 1; x++) {
            const s = this.surf[x];
            if (s < 1) continue;
            if (this.get(x, s - 1) !== T.EMPTY || this.get(x, s) !== T.GROUND) continue;
            if (r.chance(0.16)) this.set(x, s - 1, T.DECO_A + r.int(0, 3));
        }
        // background wall decorations for indoor themes (torches, crystals)
        if (this.theme === 'keep' || this.theme === 'castle' || this.theme === 'grotto') {
            for (let x = 3; x < this.w - 3; x += r.int(5, 9)) {
                const s = this.surf[x];
                if (s < 6) continue;
                const y = s - r.int(4, 6);
                if (this.get(x, y) === T.EMPTY) this.set(x, y, T.DECO_E + r.int(0, 1));
            }
        }
    }
}

/** Which pockets a level holds and what's in them. */
function planSlots(world, index, rng) {
    if (index === 5) return [];
    const base = baselineFor(world);
    const slots = [];
    const bTypes = baselinePocketTypes(base);
    slots.push({ type: rng.pick(bTypes), reward: { t: 'shard', slot: 1 } });
    const gated = gatedPocketTypes(base);
    slots.push({ type: gated.length ? rng.pick(gated) : rng.pick(bTypes), reward: { t: 'shard', slot: 2 } });
    const v = VAULTS.find(v => v.world === world && v.level === index);
    if (v) slots.push({ type: v.gate, reward: { t: 'vault', item: v.item } });
    return rng.shuffle(slots);
}

function buildOnce(seed, world, index) {
    const gen = new Gen(seed, world, index);
    const slots = planSlots(world, index, gen.rng);
    gen.build(slots);
    gen.fill();
    gen.populate();
    gen.decorate();

    // shard A: on the route, somewhere interesting in the middle of the level
    if (index !== 5) {
        const spots = gen.shardSpots.filter(([x, y]) => x > gen.w * 0.25 && x < gen.w * 0.9 && y > 2 && !gen.reserved[x]);
        const [ax, ay] = spots.length ? gen.rng.pick(spots) : [Math.round(gen.w * 0.6), G0 - 4];
        let y = ay;
        while (y < gen.h - 1 && gen.get(ax, y) !== T.EMPTY) y--;
        gen.ent({ t: 'shard', slot: 0, x: ax, y });
    }

    // crop the tile array to the final width
    const w = gen.w, h = gen.h, W = gen.surf.length;
    const tiles = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tiles[y * w + x] = gen.tiles[y * W + x];
    const contents = {};
    for (const k in gen.contents) {
        const i = Number(k), x = i % W, y = Math.floor(i / W);
        if (x < w) contents[y * w + x] = gen.contents[k];
    }
    const start = { x: 4, y: gen.surf[4] - 1 };
    return {
        world, index, seed, theme: gen.theme, castle: gen.castle,
        name: LEVEL_NAMES[WORLDS[world - 1].theme][index - 1],
        w, h, tiles, contents,
        entities: gen.entities.filter(e => e.x < w),
        start,
        gates: [...new Set(gen.gates)],
        liftCells: gen.liftCells,
        arena: gen.arenaBox || null,
        time: LEVEL_TIME,
        surf: Array.from(gen.surf.slice(0, w)),
    };
}

/**
 * Generate a level, re-rolling until its route is reachable with the world's
 * baseline gadgets (the goal, or the arena for a castle, plus route shards).
 */
export function generateLevel(gameSeed, world, index, opts = {}) {
    const base = baselineFor(world);
    let last = null;
    for (let attempt = 0; attempt < 12; attempt++) {
        const seed = hash32(gameSeed, world, index, attempt);
        const level = buildOnce(seed, world, index);
        level.attempt = attempt;
        if (opts.skipValidate) return level;
        const rep = validateLevel(level, base);
        level.report = rep;
        if (rep.ok) return level;
        last = level;
    }
    return last;
}

export { GADGETS };
