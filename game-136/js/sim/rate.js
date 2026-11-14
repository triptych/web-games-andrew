// The rating: goals met, style and cosiness, a 0–100 score and 0–3 stars. Pure, and cheap enough
// that the planner bot calls it thousands of times per room.

import { KINDS, COLOR, matches, warmLight } from './data/catalog.js';
import { occupancy, near, againstWall, byWindow, onRug, walk, coverage, tilesOf } from './room.js';
import { RATE, COSY } from '../config.js';

const placed = (G) => G.items.filter((i) => i.at);

/** How many distinct things satisfy a goal (or 0/1 for yes/no goals), and the target. */
function check(G, g, ctx) {
    const P = ctx.placed;
    switch (g.t) {
        case 'count': return P.filter((i) => matches(i, g.of)).length;
        case 'near': {
            const bs = P.filter((i) => matches(i, g.b));
            return P.filter((a) => matches(a, g.a) && bs.some((b) => b !== a && near(a, b))).length;
        }
        case 'on': return P.filter((a) => matches(a, g.a) && a.at.layer === 'top' && P.some((b) => b.id === a.at.on && matches(b, g.b))).length;
        case 'onrug': return P.filter((a) => matches(a, g.a) && KINDS[a.kind].layer !== 'rug' && onRug(G, a, ctx.occ)).length;
        case 'against': return P.filter((a) => matches(a, g.a) && againstWall(a)).length;
        case 'window': return P.filter((a) => matches(a, g.a) && byWindow(G, a)).length;
        case 'colors': return ctx.colors.size;
        case 'family': return P.filter((i) => COLOR[i.colors[0]].fam === g.fam).length;
        case 'walk': return ctx.walk.ok && P.some((i) => i.at.layer === 'floor') ? 1 : 0;
        case 'cosy': return ctx.cosy;
        case 'clay': return G.clay;
        default: return 0;
    }
}

export function cosiness(G, P = placed(G), cov = coverage(G)) {
    let c = 0;
    for (const it of P) {
        const tags = KINDS[it.kind].tags;
        if (tags.includes('rug')) c += COSY.rug;
        else if (tags.includes('soft')) c += COSY.soft;
        if (tags.includes('fire')) c += COSY.fire;
        if (tags.includes('light')) c += COSY.light + (warmLight(it) ? COSY.warmLight : 0);
        if (tags.includes('art')) c += COSY.art;
        if (tags.includes('green')) c += COSY.green;
    }
    if (cov > COSY.clutterAt) c -= (cov - COSY.clutterAt) * 150;
    return Math.max(0, Math.min(100, Math.round(c)));
}

/** Style, each part 0–100. */
function style(G, ctx) {
    const P = ctx.placed;
    const n = ctx.colors.size;
    const harmony = n === 0 ? 0 : n === 1 ? 50 : n === 2 ? 75 : n <= 6 ? 100 : n === 7 ? 90 : n === 8 ? 80 : 65;
    // Spread: which quarters of the room have something in them (walls count for their half).
    const quads = new Set();
    for (const it of P) {
        if (it.at.layer === 'wall') {
            const half = it.at.u * 2 < (it.at.wall === 'L' ? G.w : G.d) ? 0 : 1;
            quads.add(it.at.wall === 'L' ? (half ? 1 : 0) : (half ? 2 : 0));
            continue;
        }
        for (const [x, y] of tilesOf(it)) quads.add((x * 2 < G.w ? 0 : 1) + (y * 2 < G.d ? 0 : 2));
    }
    const balance = [0, 40, 70, 90, 100][quads.size];
    const cov = ctx.cov;
    const fullness = P.length === 0 ? 0
        : cov < 0.2 ? Math.round(100 * Math.pow(cov / 0.2, 0.7))
        : cov <= 0.5 ? 100 : Math.max(0, Math.round(100 - (cov - 0.5) * 250));
    const kinds = new Set(P.map((i) => i.kind)).size;
    const variety = Math.min(100, Math.round((kinds / 5) * 100));
    const cosy = ctx.cosy;
    const avg = Math.round((harmony + balance + fullness + variety + cosy) / 5);
    return { harmony, balance, fullness, variety, cosy, avg };
}

/** Everything the goals card, the results screen and the bot need. */
export function evaluate(G) {
    const P = placed(G);
    const occ = occupancy(G);
    const colors = new Set();
    for (const i of P) { colors.add(i.colors[0]); colors.add(i.colors[1]); }
    const cov = coverage(G, occ);
    const ctx = { placed: P, occ, colors, cov, walk: walk(G, occ), cosy: cosiness(G, P, cov) };
    const goals = G.room.goals.map((g) => {
        const have = check(G, g, ctx);
        const need = g.t === 'walk' ? 1 : g.min;
        return { text: g.text, req: !!g.req, have, need, ok: have >= need };
    });
    const req = goals.filter((g) => g.req), bonus = goals.filter((g) => !g.req);
    const reqMet = req.filter((g) => g.ok).length, bonusMet = bonus.filter((g) => g.ok).length;
    const st = style(G, ctx);
    let score;
    if (!goals.length) score = st.avg;
    else {
        score = RATE.reqWeight * (req.length ? reqMet / req.length : 1)
            + RATE.bonusWeight * (bonus.length ? bonusMet / bonus.length : 1)
            + RATE.styleWeight * st.avg / 100;
    }
    score = Math.round(score);
    const reqOk = reqMet === req.length;
    const stars = !reqOk ? 0 : score >= RATE.threeStars ? 3 : score >= RATE.twoStars ? 2 : 1;
    return { goals, reqOk, reqMet, reqTotal: req.length, bonusMet, bonusTotal: bonus.length, style: st, cosy: ctx.cosy, walk: ctx.walk, score, stars };
}
