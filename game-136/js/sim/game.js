// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// A cozy builder is turn-based at heart: everything the player does is a command to act(G, cmd),
// which validates it, changes G and pushes events. The UI, the bot and the tests all go through it.
//
// Commands
//   { t: 'level', id }                         open a room (progress is kept)
//   { t: 'craft', recipe }                     pinch a thing out of clay onto the shelf
//   { t: 'place', id, x, y, rot }              put a shelf thing (or move a placed one) on the floor
//   { t: 'place', id, wall, u, v }             … or on a wall
//   { t: 'rotate', id }                        turn a placed thing a quarter (or the next turn that fits)
//   { t: 'stow', id }                          back to the shelf (with anything standing on it)
//   { t: 'squish', id }                        a shelf thing back into clay, full refund
//   { t: 'clear' }                             everything back on the shelf
//   { t: 'undo' }
//   { t: 'finish' }                            rate the room; the best rating is kept

import { KINDS, costOf, validRecipe } from './data/catalog.js';
import { LEVEL, LEVELS } from './data/levels.js';
import { placementFor, footprint, tilesOf } from './room.js';
import { evaluate } from './rate.js';
import { makeRng } from '../rng.js';
import { UNDO_DEPTH, SHELF_MAX } from '../config.js';

export function newGame(seed = 1, levelId = 'pip') {
    const G = {
        v: 1,
        seed,
        rng: makeRng(seed),
        t: 0,
        progress: {},               // levelId → { stars, score }
        made: 0,                    // things pinched, all time
        level: null,
        room: null,
        w: 0, d: 0,
        clay: 0,
        items: [],
        nextId: 1,
        result: null,
        events: [],                 // { type, ... } since the last drain; never saved
        hist: [],                   // undo snapshots; never saved
    };
    openLevel(G, levelId);
    return G;
}

function roomOf(L) {
    return {
        name: L.name, who: L.who, studio: !!L.studio,
        door: { ...L.door }, windows: L.windows.map((w) => ({ ...w })), blocked: L.blocked.map((b) => [...b]),
        goals: L.goals.map((g) => JSON.parse(JSON.stringify(g))),
    };
}

function openLevel(G, id) {
    const L = LEVEL[id];
    if (!L) return false;
    G.level = id;
    G.room = roomOf(L);
    G.w = L.w; G.d = L.d;
    G.clay = L.clay;
    G.items = [];
    G.result = null;
    G.hist = [];
    for (const r of L.gifts) addItem(G, r, true);
    G.events.push({ type: 'level', id });
    return true;
}

function addItem(G, r, gift = false) {
    const it = {
        id: G.nextId++, kind: r.kind, size: r.size, variant: r.variant, motif: r.motif | 0,
        colors: [r.colors[0], r.colors[1]], lump: Math.floor(G.rng() * 1e6), gift, at: null,
    };
    G.items.push(it);
    return it;
}

/** Is a level open to play? The first always, each next once the one before has a star. */
export function unlocked(G, id) {
    if (LEVEL[id]?.studio) return true;
    const i = LEVELS.findIndex((l) => l.id === id);
    if (i <= 0) return i === 0;
    return (G.progress[LEVELS[i - 1].id]?.stars || 0) >= 1;
}

export function totalStars(G) {
    return LEVELS.reduce((a, l) => a + (G.progress[l.id]?.stars || 0), 0);
}

const item = (G, id) => G.items.find((i) => i.id === id) || null;
export const shelf = (G) => G.items.filter((i) => !i.at);

function snapshot(G) {
    G.hist.push(JSON.stringify({ items: G.items, clay: G.clay, nextId: G.nextId }));
    if (G.hist.length > UNDO_DEPTH) G.hist.shift();
}

/** Anything standing on top of a thing goes back to the shelf with it. */
function dropRiders(G, host) {
    const out = [];
    for (const it of G.items) if (it.at && it.at.layer === 'top' && it.at.on === host.id) { it.at = null; out.push(it.id); }
    return out;
}

const fail = (G, why, cmd) => { G.events.push({ type: 'nope', why, cmd: cmd.t }); return { ok: false, why }; };

export function act(G, cmd) {
    if (!cmd || typeof cmd.t !== 'string') return { ok: false, why: 'bad' };
    switch (cmd.t) {
        case 'level': {
            if (!LEVEL[cmd.id]) return fail(G, 'missing', cmd);
            if (!unlocked(G, cmd.id)) return fail(G, 'locked', cmd);
            openLevel(G, cmd.id);
            return { ok: true };
        }
        case 'craft': {
            const r = cmd.recipe;
            if (!validRecipe(r)) return fail(G, 'bad', cmd);
            const cost = costOf(r.kind, r.size);
            if (cost > G.clay) return fail(G, 'clay', cmd);
            if (G.items.filter((i) => !i.at).length >= SHELF_MAX) return fail(G, 'shelf', cmd);
            snapshot(G);
            G.clay -= cost;
            const it = addItem(G, r);
            G.made++;
            G.events.push({ type: 'craft', id: it.id, kind: r.kind, cost });
            return { ok: true, id: it.id };
        }
        case 'place': {
            const it = item(G, cmd.id);
            if (!it) return fail(G, 'missing', cmd);
            const p = placementFor(G, it.id, cmd);
            if (!p.at) return fail(G, p.why, cmd);
            snapshot(G);
            const moved = !!it.at;
            const riders = moved ? dropRiders(G, it) : [];
            it.at = p.at;
            G.events.push({ type: 'place', id: it.id, kind: it.kind, moved, layer: p.at.layer });
            for (const r of riders) G.events.push({ type: 'stow', id: r, rider: true });
            return { ok: true };
        }
        case 'rotate': {
            const it = item(G, cmd.id);
            if (!it || !it.at) return fail(G, 'missing', cmd);
            if (it.at.layer === 'wall') return fail(G, 'wall', cmd);
            const at = it.at;
            for (let k = 1; k <= 3; k++) {
                const rot = (at.rot + k) % 4;
                let spec = { x: at.x, y: at.y, rot };
                // a thing that isn't square turns about its first tile; keep it in the room
                if (at.layer !== 'top') {
                    const [w, d] = footprint(it, rot);
                    spec = { x: Math.min(at.x, G.w - w), y: Math.min(at.y, G.d - d), rot };
                }
                const p = at.layer === 'top' ? { at: { ...at, rot } } : placementFor(G, it.id, spec);
                if (p.at) {
                    snapshot(G);
                    it.at = p.at;
                    // riders whose tile the turned host no longer covers go back on the shelf
                    const riders = [];
                    if (at.layer !== 'top') {
                        const cover = new Set(tilesOf(it).map(([x, y]) => x + ',' + y));
                        for (const r of G.items) if (r.at && r.at.layer === 'top' && r.at.on === it.id && !cover.has(r.at.x + ',' + r.at.y)) { r.at = null; riders.push(r.id); }
                    }
                    G.events.push({ type: 'rotate', id: it.id });
                    for (const r of riders) G.events.push({ type: 'stow', id: r, rider: true });
                    return { ok: true };
                }
            }
            return fail(G, 'taken', cmd);
        }
        case 'stow': {
            const it = item(G, cmd.id);
            if (!it || !it.at) return fail(G, 'missing', cmd);
            if (shelf(G).length >= SHELF_MAX) return fail(G, 'shelf', cmd);
            snapshot(G);
            const riders = dropRiders(G, it);
            it.at = null;
            G.events.push({ type: 'stow', id: it.id });
            for (const r of riders) G.events.push({ type: 'stow', id: r, rider: true });
            return { ok: true };
        }
        case 'squish': {
            const it = item(G, cmd.id);
            if (!it || it.at) return fail(G, 'missing', cmd);
            snapshot(G);
            G.items = G.items.filter((i) => i !== it);
            const back = it.gift ? 0 : costOf(it.kind, it.size);
            G.clay += back;
            G.events.push({ type: 'squish', id: it.id, kind: it.kind, back });
            return { ok: true };
        }
        case 'clear': {
            if (!G.items.some((i) => i.at)) return fail(G, 'empty', cmd);
            snapshot(G);
            for (const it of G.items) it.at = null;
            G.events.push({ type: 'clear' });
            return { ok: true };
        }
        case 'undo': {
            const s = G.hist.pop();
            if (!s) return fail(G, 'empty', cmd);
            const o = JSON.parse(s);
            G.items = o.items; G.clay = o.clay; G.nextId = o.nextId;
            G.events.push({ type: 'undo' });
            return { ok: true };
        }
        case 'finish': {
            const r = evaluate(G);
            G.result = { stars: r.stars, score: r.score };
            const prev = G.progress[G.level];
            const best = !prev || r.score > prev.score;
            if (!G.room.studio && (best || r.stars > (prev?.stars || 0))) {
                G.progress[G.level] = { stars: Math.max(r.stars, prev?.stars || 0), score: Math.max(r.score, prev?.score || 0) };
            }
            G.events.push({ type: 'rated', stars: r.stars, score: r.score, best, level: G.level });
            return { ok: true, stars: r.stars, score: r.score };
        }
        default: return { ok: false, why: 'bad' };
    }
}

/** Time only moves the clock (nothing in a room changes by itself). */
export function step(G, dt) { G.t += dt; }

export function serialize(G) {
    const { rng, events, hist, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    if (!LEVEL[d.level]) throw new Error('unknown room');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [], hist: [] };
    G.rng.setState(rngState);
    for (const it of G.items) if (!KINDS[it.kind]) throw new Error('unknown thing');
    return G;
}
