// The story of one seed: whose diaries, where they are, what locks stand in the way, and the portal sequence. Pure.
//
// The chain is built so it can always be walked: diaries 1-3 sit in unlocked buildings; the first gate tool
// (crowbar, bolt cutters or staff badge, in a seeded order) lies with diary 3, the second with diary 5, the third
// with diary 7; a diary's building is only ever locked with a tool found earlier. The fuse lies with diary 9 and the
// director's keycard with Dr. Marrow's diary, which is always last. dev/simtest.mjs proves the chain with the same
// A* the bot walks with, over many seeds.

import { TILE, DIARIES, ITEM_AT, FUSE_AT, LEVERS } from '../config.js';
import { makeRng, hashSeed } from '../rng.js';
import { CITIZENS, MARROW } from './data/citizens.js';
import { interiorOf, interiorNeighbours, freeTiles, F } from './interior.js';

const ITEM_LOCK = { crowbar: 'boards', cutters: 'chain', badge: 'badge' };
const FALLBACK = { garage: ['warehouse', 'office'], school: ['house', 'apartment'], library: ['office', 'shop'], hotel: ['apartment'], mall: ['shop'], hospital: ['office'], factory: ['warehouse'], shop: ['house'], office: ['apartment'], apartment: ['house'], warehouse: ['factory'], house: ['apartment'] };
const ORD = ['first', 'second', 'third', 'fourth'];

const DIAL_CLUES = [
    'Scrawled in the margin in another hand, pressed hard enough to dent the page: the {nth} dial sits at {v}.',
    'Dr. Marrow said it to me once, smiling, as if it were a joke between us: "{Nth} dial, {v}. Remember that for me."',
    'On the inside of the back cover, in pencil: DIAL {N} — {v}. Underneath, smaller: "in case."',
    'I keep dreaming about a brass dial with a cracked glass face. In the dream it is the {nth} of three, and it is always turned to {v}.',
    'A slip of lab paper is tucked into the binding. It says only: {nth} resonance dial = {v}.',
];
const LEVER_CLUES = [
    'And the conduits. I heard it said in the hall, over and over like a prayer: the {nth} one you throw is {color}.',
    'Underlined twice at the bottom of the page: {COLOR} GOES {NTH}. I don\'t know what it means. I think I am meant to keep it.',
    'Someone has drawn four switches in the margin, coloured in with felt pen, and circled the {color} one: "{nth}".',
    'A note folded into the page: "Conduits in order. {Nth}: {color}." The handwriting shakes.',
    'I remember the colours of the conduit levers better than my own front door. {Color} was thrown {nth}.',
];

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? `{${k}}`);

export function makeStory(C, seed) {
    const rng = makeRng(hashSeed((seed ^ 0xD1A7) + 17));
    const B = C.buildings;
    const centre = C.n * TILE / 2;
    const bx = (b) => (b.x0 + b.w / 2) * TILE, bz = (b) => (b.z0 + b.d / 2) * TILE;

    // ---- who
    const cast = rng.shuffle(CITIZENS.slice()).slice(0, DIARIES - 1).sort((a, b) => a.chrono - b.chrono);
    cast.push(MARROW);

    // ---- where you wake: a two-storey house near the middle of town
    const houses = B.filter((b) => b.type === 'house' && b.floors === 2 && !b.compound)
        .sort((a, b) => Math.hypot(bx(a) - centre, bz(a) - centre) - Math.hypot(bx(b) - centre, bz(b) - centre));
    const home = rng.pick(houses.slice(0, 12));
    home.lock = null; home.innerLock = null; home.home = true;

    // ---- the tools, in this seed's order
    const tools = rng.shuffle(['crowbar', 'cutters', 'badge']);

    // ---- random locks across the city (not the home, not the compound, which is set by the city)
    for (const b of B) {
        if (b.compound || b === home) continue;
        const t = b.type;
        const pool = t === 'house' || t === 'shop' ? ['boards'] : t === 'factory' || t === 'warehouse' || t === 'garage' ? ['chain', 'boards']
            : t === 'mall' ? ['chain'] : ['badge', 'boards'];
        b.lock = rng.chance(t === 'house' ? 0.22 : 0.32) ? rng.pick(pool) : null;
        b.innerLock = b.floors >= 3 && rng.chance(0.25) ? rng.pick(['badge', 'boards', 'chain']) : null;
    }

    // ---- the diaries' buildings
    const used = new Set([home.id]);
    const story = { home: home.id, cast: cast.map((c) => c.id), tools, diaries: [], things: [], sequence: [] };
    let px = bx(home), pz = bz(home);
    const toolAt = {};
    for (const [k, ti] of Object.entries(ITEM_AT)) toolAt[k] = tools[ti];
    const avail = (k) => {
        // lock kinds the walker can open when going for diary k
        const s = new Set();
        for (const [kk, tool] of Object.entries(toolAt)) if (+kk < k) s.add(ITEM_LOCK[tool]);
        return s;
    };
    for (let k = 0; k < cast.length; k++) {
        const c = cast[k];
        const types = [c.where, ...(FALLBACK[c.where] ?? [])];
        let cands = [];
        for (const t of types) { cands = B.filter((b) => b.type === t && !used.has(b.id) && !b.compound); if (cands.length) break; }
        if (!cands.length) cands = B.filter((b) => !used.has(b.id) && !b.compound && b.type !== 'hall');
        const dist = (b) => Math.hypot(bx(b) - px, bz(b) - pz);
        const band = cands.filter((b) => dist(b) > 90 && dist(b) < 300);
        const b = rng.pick(band.length ? band : cands);
        used.add(b.id);
        const ok = avail(k);
        // a diary's own building is only locked with something already found
        b.lock = k >= 3 && ok.size && rng.chance(0.7) ? rng.pick([...ok]) : null;
        if (b.innerLock && !ok.has(b.innerLock) && rng.chance(0.5)) b.innerLock = null;
        story.diaries.push({ k, who: c.id, b: b.id });
        px = bx(b); pz = bz(b);
    }

    // ---- now the interiors can be built (locks are part of them) and the diaries placed
    for (const d of story.diaries) {
        const b = B[d.b];
        const I = interiorOf(C, b);
        const ok = avail(d.k);
        const canOpen = (lk) => lk === `b${b.id}` || ok.has(lk[0] === 's' ? b.innerLock : b.lock);
        const dist = reachFrom(I, canOpen);
        // prefer the upper floors and the far corners: the diary is somewhere you have to go looking
        let best = [];
        const byLevel = I.levels.map((_, LL) => freeTiles(I, LL).filter(([x, z]) => dist[LL][z * I.w + x] >= 0));
        const levels = byLevel.map((t, LL) => (t.length ? LL : -1)).filter((LL) => LL >= 0);
        if (!levels.length) throw new Error(`no room for diary ${d.k} in building ${b.id}`);
        const L = rng.chance(0.65) ? levels[levels.length - 1] : rng.pick(levels);
        const tiles = byLevel[L];
        tiles.sort((a, c) => dist[L][c[1] * I.w + c[0]] - dist[L][a[1] * I.w + a[0]]);
        best = tiles.slice(0, Math.max(1, Math.ceil(tiles.length * 0.35)));
        const [x, z] = rng.pick(best);
        const wx = I.x0 + (x + 0.5) * TILE, wz = I.z0 + (z + 0.5) * TILE;
        Object.assign(d, { L, x: wx, z: wz });
        const id = `diary${d.k}`;
        story.things.push({ id, kind: 'diary', k: d.k, who: d.who, b: b.id, L, x: wx, z: wz, r: rng() * 6.28 });
        story.sequence.push(id);
        const tool = toolAt[d.k] ?? (d.k === FUSE_AT ? 'fuse' : d.k === DIARIES - 1 ? 'labcard' : null);
        if (tool) {
            // the tool lies beside the diary, on the nearest free tile
            const near = tiles.filter(([tx, tz]) => !(tx === x && tz === z)).sort((a, c) => Math.hypot(a[0] - x, a[1] - z) - Math.hypot(c[0] - x, c[1] - z))[0] ?? [x, z];
            const ix = I.x0 + (near[0] + 0.5) * TILE + (near[0] === x && near[1] === z ? 0.6 : 0), iz = I.z0 + (near[1] + 0.5) * TILE;
            story.things.push({ id: `item_${tool}`, kind: 'item', item: tool, b: b.id, L, x: ix, z: iz, r: rng() * 6.28 });
            story.sequence.push(`item_${tool}`);
            d.tool = tool;
        }
    }

    // ---- the start: beside the bed, upstairs if the stairs allow it
    {
        const I = interiorOf(C, home);
        const dist = reachFrom(I, () => true);
        const L = home.floors - 1;
        const tiles = freeTiles(I, L).filter(([x, z]) => dist[L][z * I.w + x] >= 0);
        // a tile with a free neighbour to put the bed on
        rng.shuffle(tiles);
        let spot = null;
        for (const [x, z] of tiles) {
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, nz = z + dz;
                if (nx < 0 || nz < 0 || nx >= I.w || nz >= I.d) continue;
                const j = nz * I.w + nx, lv = I.levels[L];
                if (lv.flags[j] & (F.SOLID | F.STAIR | F.VOIDSTAIR | F.KEEP | F.HOLE | F.VOID) || lv.room[j] < 0) continue;
                // the bed must not seal anything off: only beside tiles with at least two other free neighbours
                spot = { x, z, bx: nx, bz: nz }; break;
            }
            if (spot) break;
        }
        const lv = I.levels[L];
        const bi = spot.bz * I.w + spot.bx;
        lv.flags[bi] |= F.SOLID;
        lv.props = lv.props.filter((p) => !(p.tiles?.includes(bi)));
        lv.props.push({ k: 'bed', x: (spot.bx + 0.5) * TILE, z: (spot.bz + 0.5) * TILE, r: Math.atan2(spot.bx - spot.x, spot.bz - spot.z), tiles: [bi], start: true });
        // check the bed blocked nothing; if it did, put it back as a pile of bedding (not solid)
        const after = reachFrom(I, () => true);
        let lost = false;
        for (let LL = 0; LL < I.floors; LL++) for (let i = 0; i < I.w * I.d; i++) if (dist[LL][i] >= 0 && after[LL][i] < 0 && !(LL === L && i === bi)) lost = true;
        if (lost) { lv.flags[bi] &= ~F.SOLID; lv.props[lv.props.length - 1].k = 'mattress'; }
        story.start = {
            b: home.id, L, x: I.x0 + (spot.x + 0.5) * TILE, z: I.z0 + (spot.z + 0.5) * TILE,
            yaw: Math.atan2(-(spot.bx - spot.x), (spot.bz - spot.z)),
        };
    }

    // ---- the portal sequence and the clues that carry it
    story.dials = [rng.int(1, 9), rng.int(1, 9), rng.int(1, 9)];
    story.leverColors = rng.shuffle(LEVERS.slice());          // which colour each lever on the console is
    story.order = rng.shuffle(LEVERS.slice());                // the order they must be thrown in
    const pieces = [0, 1, 2].map((i) => ({ kind: 'dial', i, v: story.dials[i] }))
        .concat([0, 1, 2, 3].map((i) => ({ kind: 'lever', i, color: story.order[i] })));
    const holders = rng.shuffle([...Array(DIARIES - 1).keys()]).slice(0, pieces.length);
    story.clues = {};
    pieces.forEach((p, n) => {
        const k = holders[n];
        const o = { nth: ORD[p.i], Nth: cap(ORD[p.i]), NTH: ORD[p.i].toUpperCase(), N: p.i + 1, v: p.v, color: p.color, Color: p.color && cap(p.color), COLOR: p.color?.toUpperCase() };
        const t = p.kind === 'dial' ? rng.pick(DIAL_CLUES) : rng.pick(LEVER_CLUES);
        story.clues[k] = { ...p, text: fill(t, o) };
    });
    return story;
}

/** Steps from the entrances to every tile of an interior (-1 = out of reach), opening the locks canOpen allows. */
export function reachFrom(I, canOpen) {
    const dist = I.levels.map(() => new Int32Array(I.w * I.d).fill(-1));
    const q = [];
    for (const e of I.b.entrances) { dist[0][e.z * I.w + e.x] = 0; q.push([0, e.x, e.z]); }
    const nb = [];
    for (let h = 0; h < q.length; h++) {
        const [L, x, z] = q[h];
        const dd = dist[L][z * I.w + x];
        for (const [L2, x2, z2] of interiorNeighbours(I, L, x, z, nb, { open: { has: canOpen } })) {
            if (L2 < 0) continue;
            const j = z2 * I.w + x2;
            if (dist[L2][j] >= 0) continue;
            dist[L2][j] = dd + 1;
            q.push([L2, x2, z2]);
        }
    }
    return dist;
}
