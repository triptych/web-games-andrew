// The decorator bot. It plays through act() like the player, one command per call, so the tests,
// the balance table and the title-screen demo all exercise the real rules. Pure, like js/sim.
//
// skill 1: reads every goal (required and bonus), picks a colour scheme that suits them, places
//          each thing where the rating is highest, then keeps adding decor while it helps.
// skill < 1: plans only the required goals, picks colours and sizes at random, and puts each
//          thing in the best spot only `skill` of the time (anywhere that fits otherwise).

import { KINDS, PALETTE, COLOR, defaultRecipe, matches } from './data/catalog.js';
import { act, shelf, serialize, deserialize } from './game.js';
import { placementFor, tilesOf, againstWall, walk } from './room.js';
import { evaluate } from './rate.js';
import { makeRng, hash3 } from '../rng.js';
import { WALL_ROWS } from '../config.js';

const REP = { light: 'floorlamp', seat: 'chair', toy: 'toy', green: 'plant', soft: 'rug', art: 'picture', surface: 'nightstand', books: 'bookshelf', sleep: 'bed', time: 'clock', fire: 'fireplace', work: 'desk', table: 'table', rug: 'rug' };
const kindFor = (of, planned) => {
    if (of.kind) return of.kind;
    // a lamp goes on a surface when one is planned, else it stands on the floor
    if (of.tag === 'light') return planned.some((k) => KINDS[k].surface) ? 'tablelamp' : 'floorlamp';
    return REP[of.tag] || 'plant';
};
const countMatching = (planned, of) => planned.filter((k) => matches({ kind: k }, of)).length;
const ORDER = { rug: 0, floor: 1, small: 2, wall: 3 };
const SCHEMES = {
    warm: ['tomato', 'butter', 'tangerine', 'blush', 'cream'],
    cool: ['cornflower', 'sky', 'lilac', 'teal', 'cream'],
    green: ['moss', 'sage', 'mint', 'tomato', 'cream'],
    any: ['teal', 'butter', 'tomato', 'cream', 'sky', 'blush'],
};

export function makeBot({ skill = 1, seed = 1 } = {}) {
    return { skill, rng: makeRng(Math.floor(hash3(seed, 77, 3) * 4294967296)), phase: 'plan', queue: [], mine: new Set(), tries: 0, wantColors: 4 };
}

/** The recipes a room's goals call for. */
function plan(G, bot) {
    const goals = G.room.goals.filter((g) => g.req || bot.skill >= 1);
    const kinds = [];
    const need = (of, n) => { while (countMatching(kinds, of) < n) kinds.push(kindFor(of, kinds)); };
    for (const g of goals) {
        if (g.t === 'count' || g.t === 'against' || g.t === 'window') need(g.of || g.a, g.min);
        else if (g.t === 'near') { need(g.b, 1); need(g.a, g.min); }
        else if (g.t === 'on') { need(g.b, 1); need(g.a, g.min); }
        else if (g.t === 'onrug') { need({ kind: 'rug' }, 1); need(g.a, g.min); }
    }
    let fam = 'any', nColors = 4;
    for (const g of goals) {
        if (g.t === 'family') fam = g.fam;
        if (g.t === 'colors') nColors = Math.max(nColors, g.min);
    }
    const scheme = SCHEMES[fam].slice();
    if (nColors > scheme.length) for (const c of PALETTE) if (scheme.length < nColors && !scheme.includes(c.id)) scheme.push(c.id);
    const famGoal = goals.find((g) => g.t === 'family');
    // the big rug carries more on it; everything else small, to save clay
    const sizeOf = (k) => {
        if (bot.skill < 1) return bot.rng.int(0, 2);
        if (k === 'rug') return goals.some((g) => g.t === 'onrug' && (g.min > 1 || g.a.kind === 'bed')) ? 2 : 1;
        return 0;
    };
    return kinds.map((kind, i) => {
        const r = defaultRecipe(kind);
        r.size = sizeOf(kind);
        r.variant = bot.skill < 1 ? bot.rng.int(0, KINDS[kind].variants.length - 1) : i % KINDS[kind].variants.length;
        if (KINDS[kind].motifs) r.motif = bot.skill < 1 ? bot.rng.int(0, KINDS[kind].motifs.length - 1) : i % KINDS[kind].motifs.length;
        if (KINDS[kind].glow) r.motif = 0;
        if (bot.skill < 1) r.colors = [bot.rng.pick(PALETTE).id, bot.rng.pick(PALETTE).id];
        else {
            const n = Math.min(scheme.length, Math.max(nColors, 3));
            const primary = famGoal ? scheme.filter((c) => COLOR[c].fam === fam)[i % 3] || scheme[0] : scheme[i % n];
            r.colors = [primary, scheme[(i + 1) % n]];
        }
        return r;
    }).sort((a, b) => ORDER[KINDS[a.kind].layer] - ORDER[KINDS[b.kind].layer]);
}

/** Every spot a thing could go. */
function candidates(G, it) {
    const out = [];
    if (KINDS[it.kind].layer === 'wall') {
        for (const wall of ['L', 'R']) for (let u = 0; u < (wall === 'L' ? G.w : G.d); u++) for (let v = 0; v < WALL_ROWS; v++) out.push({ wall, u, v });
        return out;
    }
    const [w, d] = KINDS[it.kind].fp[it.size];
    const rots = w === d ? [0, 1, 2, 3] : [0, 1, 2, 3];
    for (const rot of rots) for (let y = 0; y < G.d; y++) for (let x = 0; x < G.w; x++) out.push({ x, y, rot });
    return out;
}

/** A tie-breaker that makes rooms look lived in: big things against walls, seats facing what they serve. */
function niceness(G, it) {
    const at = it.at;
    if (at.layer === 'wall') return at.v === 1 ? 1 : 0;
    const K = KINDS[it.kind];
    let n = 0;
    const tiles = tilesOf(it);
    const cx = tiles.reduce((a, t) => a + t[0], 0) / tiles.length + 0.5, cy = tiles.reduce((a, t) => a + t[1], 0) / tiles.length + 0.5;
    if (at.layer === 'rug') return -Math.hypot(cx - G.w / 2, cy - G.d / 2) * 0.5;
    const area = K.fp[it.size][0] * K.fp[it.size][1];
    if (at.layer === 'floor' && (area >= 2 || K.tags.some((t) => t === 'books' || t === 'fire' || t === 'sleep'))) n += againstWall(it) ? 3 : 0;
    // face: rot 0 → +y, 1 → +x, 2 → −y, 3 → −x
    let tx = G.w / 2, ty = G.d / 2;
    if (K.tags.includes('seat')) {
        let best = 9;
        for (const o of G.items) {
            if (!o.at || o === it || o.at.layer === 'wall' || !KINDS[o.kind].tags.some((t) => t === 'surface' || t === 'fire')) continue;
            const ot = tilesOf(o);
            const ox = ot.reduce((a, t) => a + t[0], 0) / ot.length + 0.5, oy = ot.reduce((a, t) => a + t[1], 0) / ot.length + 0.5;
            const dd = Math.hypot(ox - cx, oy - cy);
            if (dd < best && dd < 2.6) { best = dd; tx = ox; ty = oy; }
        }
    }
    const f = [[0, 1], [1, 0], [0, -1], [-1, 0]][at.rot];
    n += (f[0] * (tx - cx) + f[1] * (ty - cy)) > 0.1 ? 1 : 0;
    n += walk(G).reached.size * 0.03;
    return n;
}

/** The bot's own measure: the score, plus partial credit toward goals that need several things
 *  (one chair of the two at the table is progress, though it earns nothing yet). */
function worth(G) {
    const e = evaluate(G);
    let part = 0;
    for (const g of e.goals) part += Math.min(1, g.have / g.need) * (g.req ? 2 : 1);
    return e.score * 100 + part * 300;
}

/** The best spot for a thing, or null. Ties go to the earliest candidate, so it's deterministic. */
export function bestSpot(G, id, bot = { skill: 1, rng: makeRng(1) }) {
    const it = G.items.find((i) => i.id === id);
    const was = it.at;
    const valid = [];
    for (const spec of candidates(G, it)) {
        const p = placementFor(G, id, spec);
        if (p.at) valid.push({ spec, at: p.at });
    }
    if (!valid.length) return null;
    if (bot.skill < 1 && bot.rng() > bot.skill) return valid[Math.floor(bot.rng() * valid.length)].spec;
    // riders would drop when a placed host moves; the bot only places shelf things, so it.at is null
    let best = null, bs = -Infinity;
    for (const v of valid) {
        it.at = v.at;
        const s = worth(G) + niceness(G, it);
        if (s > bs) { bs = s; best = v.spec; }
    }
    it.at = was;
    return best;
}

/** Extra decor the perfect bot tries once the brief is done. */
function extras(G, bot) {
    const placedColors = G.items.filter((i) => i.at).map((i) => i.colors[0]);
    const c = placedColors.length ? placedColors : ['cream', 'teal'];
    const mk = (kind, size = 0, motif = 0) => ({ kind, size, variant: (bot.tries + size) % KINDS[kind].variants.length, motif, colors: [c[bot.tries % c.length], c[(bot.tries + 1) % c.length]] });
    return [mk('picture', 0, bot.tries % 6), mk('plant'), mk('tablelamp'), mk('floorlamp'), mk('rug', 0), mk('armchair'), mk('toy'), mk('nightstand'), mk('chair'), mk('clock')];
}

/** The next command, or null when the bot is done. */
export function botNext(G, bot) {
    if (bot.phase === 'plan') {
        bot.queue = plan(G, bot);
        bot.phase = 'craft';
    }
    if (bot.phase === 'craft') {
        while (bot.queue.length) {
            const r = bot.queue[0];
            if (KINDS[r.kind].cost[r.size] > G.clay) {
                // out of clay: try the small one, else skip it
                if (r.size > 0) { r.size = 0; continue; }
                bot.queue.shift();
                continue;
            }
            bot.queue.shift();
            return { t: 'craft', recipe: r };
        }
        bot.phase = 'place';
    }
    if (bot.phase === 'place') {
        const waiting = shelf(G).sort((a, b) => ORDER[KINDS[a.kind].layer] - ORDER[KINDS[b.kind].layer] || a.id - b.id);
        for (const it of waiting) {
            const spec = bestSpot(G, it.id, bot);
            if (spec) return { t: 'place', id: it.id, ...spec };
            return { t: 'squish', id: it.id };
        }
        bot.phase = bot.skill >= 1 ? 'improve' : 'finish';
    }
    if (bot.phase === 'improve') {
        const now = evaluate(G).score;
        if (bot.tries < 10 && now < 97) {
            bot.tries++;
            let best = null, bs = worth(G) + 1;
            for (const r of extras(G, bot)) {
                if (KINDS[r.kind].cost[r.size] > G.clay) continue;
                if (G.items.filter((i) => i.kind === r.kind).length >= 2) continue;   // variety, not five lamps
                const C = deserialize(serialize(G));
                const res = act(C, { t: 'craft', recipe: r });
                if (!res.ok) continue;
                const spec = bestSpot(C, res.id);
                if (!spec) continue;
                act(C, { t: 'place', id: res.id, ...spec });
                const s = worth(C);
                if (s > bs) { bs = s; best = { t: 'craft', recipe: r }; }
            }
            // moving something already placed: lift it and find it the best spot in the room as it is now
            for (const it of G.items) {
                if (!it.at || it.at.layer === 'top') continue;
                const C = deserialize(serialize(G));
                const was = C.items.find((i) => i.id === it.id);
                const riders = C.items.filter((i) => i.at && i.at.layer === 'top' && i.at.on === it.id).length;
                if (riders) continue;
                const keep = was.at;
                was.at = null;
                const spec = bestSpot(C, it.id);
                was.at = keep;
                if (!spec) continue;
                if (!act(C, { t: 'place', id: it.id, ...spec }).ok) continue;
                const s = worth(C);
                if (s > bs + 20) { bs = s; best = { t: 'place', id: it.id, ...spec }; }
            }
            if (best) {
                if (best.t === 'craft') bot.phase = 'place';
                return best;
            }
        }
        bot.phase = 'finish';
    }
    if (bot.phase === 'finish') { bot.phase = 'done'; return { t: 'finish' }; }
    return null;
}

/** Play a room to the end. Returns the evaluation at the finish. */
export function botPlayRoom(G, opts = {}) {
    const bot = makeBot(opts);
    let guard = 0, cmd;
    while ((cmd = botNext(G, bot)) && guard++ < 500) act(G, cmd);
    return evaluate(G);
}

