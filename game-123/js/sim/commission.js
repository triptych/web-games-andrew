// Commissions: who wants a map, what they will do with it, and how the chart is judged.
// A client does not grade the parchment; they use it. The adventurer walks the route the chart suggests, the
// ship sails it, the farmer ploughs where it says plains. Pure: built from the world and a seeded rng.

import { WORLD, T, TERRAIN_NAMES, COST, HAZARD } from '../config.js';
import { astar, pathCost } from './path.js';

const W = WORLD.w, H = WORLD.h;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const CLIENTS = {
    farm: { name: 'Farmer Hobb', emoji: '🧑‍🌾', role: 'a farmer' },
    ore: { name: 'Brunna Deepdelve', emoji: '⛏️', role: 'a dwarven prospector' },
    route: { name: 'Sir Kael', emoji: '🗡️', role: 'an adventurer' },
    sail: { name: 'Captain Mara', emoji: '⚓', role: 'a ship captain' },
    shrine: { name: 'Sister Ione', emoji: '🕯️', role: 'a pilgrim' },
    survey: { name: 'King Aldric', emoji: '👑', role: 'the king' },
};

// ---------------------------------------------------------------------------------------------- cost functions

/** What really happens to someone crossing each cell. */
export function truthCost(world, ship) {
    const tab = ship ? COST.ship : COST.foot;
    return (i) => {
        const fi = world.featureAt[i];
        if (ship && fi >= 0) {
            const k = world.features[fi].kind;
            if (k === 'reef') return Infinity;
            if (k === 'harbor') return 1;
        }
        return tab[world.terrain[i]];
    };
}

/** What the chart says. Blank parchment costs `unknown`; a reef you found is a wall; a harbor you found is open water. */
export function planCost(G, ship, unknown = 6) {
    const tab = ship ? COST.ship : COST.foot;
    const found = new Set(G.found);
    const feats = G.world.features, at = G.world.featureAt;
    return (i) => {
        if (ship) {
            const fi = at[i];
            if (fi >= 0 && found.has(fi)) {
                if (feats[fi].kind === 'reef') return Infinity;
                if (feats[fi].kind === 'harbor') return 1;
            }
        }
        const t = G.ink[i];
        return t === 0 ? unknown : tab[t];
    };
}

// ---------------------------------------------------------------------------------------------- generation

const rect = (x, y, w, h) => ({ x: clamp(Math.round(x), 0, W - w), y: clamp(Math.round(y), 0, H - h), w, h });
const inRect = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
const shuffled = (rng, arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

function bestRect(world, rng, w, h, score) {
    let best = null, bs = -Infinity;
    for (let y = 0; y <= H - h; y++) {
        for (let x = 0; x <= W - w; x++) {
            const r = { x, y, w, h };
            const s = score(r) + rng() * 0.5;
            if (s > bs) { bs = s; best = r; }
        }
    }
    return best;
}

function featuresIn(world, r, kind) {
    return world.features.filter((f) => f.kind === kind && inRect(r, f.x, f.y));
}

function nearest(world, kind, x, y) {
    let best = null, bd = Infinity;
    for (const f of world.features) if (f.kind === kind) { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } }
    return best;
}

/** A zone of 14×10 cells with the goal comfortably inside it (not in the middle: that would give it away). */
function zoneAround(rng, f) {
    let r = rect(f.x - rng.int(3, 10), f.y - rng.int(2, 7), 14, 10);
    if (f.x < r.x + 2 || f.x > r.x + 11 || f.y < r.y + 2 || f.y > r.y + 7) r = rect(f.x - 7, f.y - 5, 14, 10);
    return r;
}

/** The season: six clients, easy to hard. Every commission is checked against the true world as it is built. */
export function makeSeason(world, rng) {
    const out = [];
    const plan = ['farm', 'ore', 'route', 'sail', 'shrine', 'survey'];
    plan.forEach((kind, n) => {
        const c = (BUILD[kind](world, rng, n) || BUILD.survey(world, rng, n, true));
        c.id = 'c' + n;
        out.push(c);
    });
    return out;
}

const BUILD = {
    farm(world, rng) {
        const r = bestRect(world, rng, 16, 11, (q) => {
            let n = 0;
            for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) if (world.terrain[y * W + x] === T.PLAINS) n++;
            return n + (featuresIn(world, q, 'farm').length ? 25 : 0);
        });
        const farm = nearest(world, 'farm', r.x + r.w / 2, r.y + r.h / 2);
        return {
            kind: 'farm', client: CLIENTS.farm, title: `The Plots near ${farm ? farm.name : 'Longfield'}`, region: r, time: 40,
            quote: 'Good dirt is flat and sweet, miss. The new plough is paid for and I do not know where to put it.',
            brief: 'Chart the shaded country and tell me which of it is plains.',
            judged: 'Judged on the plains you inked: how much of the real plains you found, and how little you inked wrongly.',
        };
    },
    ore(world, rng) {
        const r = bestRect(world, rng, 20, 14, (q) => featuresIn(world, q, 'ore').length * 10);
        const targets = featuresIn(world, r, 'ore').map((f) => f.id);
        if (targets.length < 3) return null;
        return {
            kind: 'ore', client: CLIENTS.ore, title: `The ${world.features[targets[0]].name} Prospect`, region: r, time: 50, targets,
            quote: 'There is iron under those hills, I can smell it. Veins are small, mind. Rush the spell and it will not see them.',
            brief: 'Find every ore vein in the shaded country. A vein only shows to a cast with some focus behind it.',
            judged: `Judged on veins found: all ${targets.length} is a masterwork.`,
        };
    },
    route(world, rng) {
        const towns = shuffled(rng, world.features.filter((f) => f.kind === 'town'));
        const ruins = shuffled(rng, world.features.filter((f) => f.kind === 'ruin'));
        const cost = truthCost(world, false);
        let pick = null;
        for (const lim of [[22, 56], [14, 80]]) {
            for (const s of towns) {
                for (const g of ruins) {
                    const p = astar(W, H, cost, s.x, s.y, g.x, g.y);
                    if (p && p.path.length >= lim[0] && p.path.length <= lim[1]) { pick = { s, g, len: p.path.length }; break; }
                }
                if (pick) break;
            }
            if (pick) break;
        }
        if (!pick) return null;
        const zone = zoneAround(rng, pick.g);
        return {
            kind: 'route', client: CLIENTS.route, title: `The Road to ${pick.g.name}`, region: zone, time: Math.round(clamp(40 + pick.len * 0.8, 55, 90)),
            start: pick.s.id, goal: pick.g.id,
            quote: `I ride from ${pick.s.name} and I follow your map to the letter. Swamps, mountain passes, fords: they are on your head.`,
            brief: `Find ${pick.g.name}, said to lie in the shaded country, and chart a way there from ${pick.s.name}. Sir Kael takes the cheapest road your map shows.`,
            judged: 'Judged on the road he really walks: a map that sends him into water or over a peak fails; one that finds the swift, safe way earns three stars.',
        };
    },
    sail(world, rng) {
        const harbors = shuffled(rng, world.features.filter((f) => f.kind === 'harbor'));
        const cost = truthCost(world, true);
        let pick = null;
        for (const lim of [[24, 64], [14, 90]]) {
            for (const a of harbors) {
                for (const b of harbors) {
                    if (a === b) continue;
                    const p = astar(W, H, cost, a.x, a.y, b.x, b.y);
                    if (p && p.path.length >= lim[0] && p.path.length <= lim[1]) { pick = { a, b, len: p.path.length }; break; }
                }
                if (pick) break;
            }
            if (pick) break;
        }
        if (!pick) return null;
        const zone = zoneAround(rng, pick.b);
        return {
            kind: 'sail', client: CLIENTS.sail, title: `${pick.a.name} to ${pick.b.name}`, region: zone, time: Math.round(clamp(40 + pick.len * 0.8, 55, 90)),
            start: pick.a.id, goal: pick.b.id,
            quote: `Cargo is waiting at ${pick.a.name}. I steer by your chart alone, and last year a reef took my keel. Mark the rocks!`,
            brief: `Find ${pick.b.name}, in the shaded waters, and chart a sea lane to it from ${pick.a.name}. Reefs are small: they only show to a steady cast.`,
            judged: 'Judged on the voyage: a reef you missed, or land you called sea, wrecks the ship. Deep water is quick, shoals are slow and risky.',
        };
    },
    shrine(world, rng) {
        const r = bestRect(world, rng, 20, 14, (q) => featuresIn(world, q, 'shrine').length * 10);
        const targets = featuresIn(world, r, 'shrine').map((f) => f.id);
        if (targets.length < 3) return null;
        return {
            kind: 'shrine', client: CLIENTS.shrine, title: 'The Pilgrim’s Way', region: r, time: 50, targets,
            quote: 'There are holy places in that country that no pilgrim has found since the war. A candle for every one you mark.',
            brief: 'Find every shrine in the shaded country. Like ore, they only show to a steady cast.',
            judged: `Judged on shrines found: all ${targets.length} lights every candle.`,
        };
    },
    survey(world, rng, n, fallback = false) {
        const r = bestRect(world, rng, 28, 18, (q) => featuresIn(world, q, 'town').length * 30 + (q.x > 6 ? 0 : -5));
        return {
            kind: 'survey', client: CLIENTS.survey, title: fallback ? 'The Royal Survey' : 'The Borderlands', region: r, time: 75,
            quote: 'My generals march blind. Draw the whole of my borderlands, every hill, wood and river, and draw it true.',
            brief: 'Chart the whole of the shaded country, as truthfully as you can.',
            judged: 'Judged on accuracy across the whole shaded region: blank parchment and wrongly inked cells both count against you.',
        };
    },
};

// ---------------------------------------------------------------------------------------------- judging

const stars = (v, a, b, c) => (v >= a ? 3 : v >= b ? 2 : v >= c ? 1 : 0);
const pctText = (v) => Math.round(v * 100) + '%';

/** How the client fared with the chart as it stands. Returns { stars, pct, outcome, headline, lines, path }. */
export function evaluate(G, c) {
    const world = G.world;
    const r = c.region;
    const found = new Set(G.found);
    const res = { stars: 0, pct: 0, outcome: 'ok', headline: '', lines: [], path: null };

    if (c.kind === 'farm') {
        let truth = 0, inked = 0, both = 0;
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
            const i = y * W + x, t = world.terrain[i] === T.PLAINS, k = G.ink[i] === T.PLAINS;
            if (t) truth++;
            if (k) inked++;
            if (t && k) both++;
        }
        const recall = truth ? both / truth : 1, precision = inked ? both / inked : 0;
        const f1 = recall + precision ? (2 * recall * precision) / (recall + precision) : 0;
        res.pct = f1;
        res.stars = stars(f1, 0.85, 0.65, 0.4);
        res.headline = res.stars ? 'Hobb marks his plots and gets to ploughing.' : 'Hobb cannot make head or tail of it.';
        res.lines.push(`Plains found: ${both} of ${truth} (${pctText(recall)})`, `Plains inked rightly: ${both} of ${inked} (${pctText(precision)})`);
    } else if (c.kind === 'ore' || c.kind === 'shrine') {
        const n = c.targets.filter((id) => found.has(id)).length;
        const v = n / c.targets.length;
        res.pct = v;
        res.stars = v >= 0.999 ? 3 : v >= 0.6 ? 2 : v >= 0.3 ? 1 : 0;
        const noun = c.kind === 'ore' ? 'veins' : 'shrines';
        res.headline = res.stars === 3 ? `Every one of the ${noun} is on the chart.` : res.stars ? `Some of the ${noun} are still hidden.` : `Not a single one of the ${noun} was found.`;
        res.lines.push(`${noun[0].toUpperCase() + noun.slice(1)} found: ${n} of ${c.targets.length}`);
        res.lines.push(...c.targets.map((id) => `${found.has(id) ? '✔' : '✘'} ${world.features[id].name}`));
    } else if (c.kind === 'survey') {
        let good = 0, blank = 0, wrong = 0;
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
            const i = y * W + x;
            if (G.ink[i] === world.terrain[i]) good++; else if (G.ink[i] === 0) blank++; else wrong++;
        }
        const total = r.w * r.h, v = good / total;
        res.pct = v;
        res.stars = stars(v, 0.8, 0.6, 0.35);
        res.headline = res.stars === 3 ? 'The generals have never seen a truer map.' : res.stars ? 'The king studies it, frowning.' : 'The king has it burned.';
        res.lines.push(`Cells charted truly: ${good} of ${total} (${pctText(v)})`, `Left blank: ${blank} · Inked wrongly: ${wrong}`);
        const towns = featuresIn(world, r, 'town');
        if (towns.length) res.lines.push(`Towns recorded: ${towns.filter((f) => found.has(f.id)).length} of ${towns.length}`);
    } else {
        evaluateTravel(G, c, res);
    }
    return res;
}

function evaluateTravel(G, c, res) {
    const world = G.world, ship = c.kind === 'sail';
    const who = c.client.name.split(' ').pop();
    const S = world.features[c.start], Gl = world.features[c.goal];
    if (!G.found.includes(c.goal)) {
        res.outcome = 'nogoal';
        res.headline = `${who} cannot go anywhere: ${Gl.name} is not on the chart.`;
        res.lines.push('You never found the destination. Look inside the shaded country, and cast with some focus.');
        return;
    }
    const plan = astar(W, H, planCost(G, ship, 6), S.x, S.y, Gl.x, Gl.y);
    if (!plan) {
        res.outcome = 'noroute';
        res.headline = `${who} finds no way through your chart.`;
        res.lines.push('Every way from the start to the goal is blocked on your map.');
        return;
    }
    const tcost = truthCost(world, ship);
    const path = plan.path;
    for (let k = 1; k < path.length - 1; k++) {
        const [x, y] = path[k], i = y * W + x;
        if (tcost(i) === Infinity) {
            const fi = world.featureAt[i];
            const reef = ship && fi >= 0 && world.features[fi].kind === 'reef';
            res.outcome = reef ? 'reef' : 'blocked';
            res.path = path.slice(0, k + 1);
            const real = TERRAIN_NAMES[world.terrain[i]];
            res.headline = ship
                ? (reef ? `${c.client.name} struck an uncharted reef and the ship broke up.` : `${c.client.name} ran aground on ${real} that your chart called sea.`)
                : `${c.client.name} reached ${real} where your map promised a road, and turned back.`;
            res.lines.push(`Your map said “${TERRAIN_NAMES[G.ink[i]] || 'unknown'}”; it was ${reef ? 'a reef' : real}.`);
            return;
        }
    }
    const opt = astar(W, H, tcost, S.x, S.y, Gl.x, Gl.y);
    // the start and goal are always enterable, exactly as the planner treats them
    const ends = new Set([S.y * W + S.x, Gl.y * W + Gl.x]);
    const trueC = pathCost(W, (i) => (ends.has(i) ? 1 : tcost(i)), path);
    const eff = opt ? clamp(opt.cost / trueC, 0, 1) : 1;
    const haz = new Set(ship ? HAZARD.ship : HAZARD.foot);
    const hz = (p) => p.slice(1, -1).filter(([x, y]) => haz.has(world.terrain[y * W + x])).length;
    const extra = Math.max(0, hz(path) - (opt ? hz(opt.path) : 0));
    res.path = path;
    res.pct = eff;
    res.stars = eff >= 0.85 && extra === 0 ? 3 : eff >= 0.6 && extra <= 3 ? 2 : 1;
    res.headline = res.stars === 3 ? `${who} arrives swiftly and safely.` : res.stars === 2 ? `${who} arrives, a little the worse for the way.` : `${who} arrives at last, by a long and dangerous road.`;
    res.lines.push(`Journey: ${path.length - 1} steps, ${pctText(eff)} as efficient as the best way`);
    res.lines.push(extra ? `Needless hazards crossed: ${extra} (${ship ? 'shoals' : 'swamp and mountain'})` : 'No needless hazards.');
}
