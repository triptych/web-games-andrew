// An auto-player. It plays through act(), the same commands the player's drags and clicks make, so
// the tests, the balance table and the title screen's demo all exercise the real rules. Pure, like
// the rest of js/sim: its own seeded randomness, no clock.

import { N } from '../config.js';
import { rnd } from '../rng.js';
import { canPlace, fitsAnywhere, itemUsable, skillUsable, live, elOf, idx } from './level.js';
import { rotateCells, sizeOf, SHAPES, SHAPE_IDS } from './data/shapes.js';
import { choices, nodeOf, canLearn, canTrain, canAfford } from './game.js';
import { ENHANCEMENTS } from './data/potions.js';
import { SKILLS } from './data/skills.js';

/** skill 1 plays its best move; lower skill adds noise to its judgement and blunders sometimes. */
export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rs: seed | 0 };
}

// ------------------------------------------------------------------ in a level

/** Fill a tile into a copy of the board and clear its lines. */
function simulate(L, cells, x, y) {
    const b = L.cells.map((v, i) => (v > 0 || L.foeAt[i] >= 0 ? 1 : 0));
    for (const [cx, cy] of cells) b[idx(x + cx, y + cy)] = 1;
    const lines = [];
    for (let r = 0; r < N; r++) { let ok = true; for (let c = 0; c < N && ok; c++) ok = !!b[idx(c, r)]; if (ok) lines.push([...Array(N)].map((_, c) => idx(c, r))); }
    for (let c = 0; c < N; c++) { let ok = true; for (let r = 0; r < N && ok; r++) ok = !!b[idx(c, r)]; if (ok) lines.push([...Array(N)].map((_, r) => idx(c, r))); }
    const set = new Set();
    for (const l of lines) for (const i of l) set.add(i);
    for (const i of set) if (L.foeAt[i] < 0) b[i] = 0;
    return { b, lines, set };
}

/** How good a board is to keep playing on: open, smooth, few lonely holes, near-full lines. */
function evaluate(b) {
    let empty = 0, holes = 0, rough = 0, near = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const f = !!b[idx(x, y)];
        if (!f) {
            empty++;
            let walls = 0;
            if (x === 0 || b[idx(x - 1, y)]) walls++;
            if (x === N - 1 || b[idx(x + 1, y)]) walls++;
            if (y === 0 || b[idx(x, y - 1)]) walls++;
            if (y === N - 1 || b[idx(x, y + 1)]) walls++;
            if (walls >= 3) holes += walls === 4 ? 2 : 1;
        }
        if (x < N - 1 && f !== !!b[idx(x + 1, y)]) rough++;
        if (y < N - 1 && f !== !!b[idx(x, y + 1)]) rough++;
    }
    for (let r = 0; r < N; r++) { let n = 0; for (let c = 0; c < N; c++) if (b[idx(c, r)]) n++; if (n >= N - 2) near++; }
    for (let c = 0; c < N; c++) { let n = 0; for (let r = 0; r < N; r++) if (b[idx(c, r)]) n++; if (n >= N - 2) near++; }
    return empty * 1.2 - holes * 6 - rough * 0.9 + near * 1.6;
}

function fitsOn(b, cells) {
    const { w, h } = sizeOf(cells);
    for (let y = 0; y + h <= N; y++) for (let x = 0; x + w <= N; x++) {
        let ok = true;
        for (const [cx, cy] of cells) if (b[idx(x + cx, y + cy)]) { ok = false; break; }
        if (ok) return true;
    }
    return false;
}

/** What the level wants out of a clear, beyond keeping the board open. */
function goalValue(L, sim, el, cells, x, y) {
    let v = 0;
    const set = sim.set;
    if (L.deposits.length) {
        const hit = new Set();
        for (const c of set) if (L.cover[c] > 0) hit.add(L.depAt[c]);
        v += hit.size * 40;
        // build toward lines that cross a covered deposit
        for (const [cx, cy] of cells) {
            const px = x + cx, py = y + cy;
            for (let k = 0; k < N; k++) if (L.cover[idx(k, py)] > 0 || L.cover[idx(px, k)] > 0) { v += 1.2; break; }
        }
    }
    if (L.battle) {
        for (const f of L.battle.foes) if (f.hp > 0) { const h = f.cells.filter((c) => set.has(c)).length; v += h * 14 * sim.lines.length; }
        // keep foes from growing toward the middle: placing next to them walls them in
        for (const [cx, cy] of cells) {
            const i = idx(x + cx, y + cy);
            for (const d of [-1, 1, -N, N]) if (L.foeAt[i + d] >= 0) v += 1.5;
        }
    }
    if (L.refine) {
        const R = L.refine;
        for (const line of sim.lines) {
            const count = {};
            for (const c of line) { const e = L.cells[c] > 0 ? elOf(L.cells[c]) : (cells.some(([cx, cy]) => idx(x + cx, y + cy) === c) ? el : null); if (e) count[e] = (count[e] || 0) + 1; }
            for (const cd of R.conds) {
                if (cd.type === 'lines' && !cd.met && (count[cd.el] || 0) >= 3) v += 30;
                if (cd.type === 'forbid' && (count[cd.el] || 0) >= 3) v -= 35;
            }
            if (line.some((c) => L.crucible[c])) v += 6;
        }
        const combo = R.conds.find((c) => c.type === 'combo');
        if (combo && !combo.met && sim.lines.length >= combo.target) v += 60;
        const streak = R.conds.find((c) => c.type === 'streak');
        if (streak && !streak.met && sim.lines.length) v += 8 * L.streak;
        // set up a double: two near-full lines are worth more than one
        if (combo && !combo.met) {
            let near = 0;
            for (let r = 0; r < N; r++) { let k = 0; for (let c = 0; c < N; c++) if (sim.b[idx(c, r)]) k++; if (k === N - 1 || k === N - 2) near++; }
            for (let c = 0; c < N; c++) { let k = 0; for (let r = 0; r < N; r++) if (sim.b[idx(c, r)]) k++; if (k === N - 1 || k === N - 2) near++; }
            v += near * 3;
        }
        // lean the recipe's element toward lines that are filling up
        const want = R.conds.find((c) => c.type === 'lines' && !c.met);
        if (want && el === want.el) v += 2;
    }
    return v;
}

/** The bot's next level command, or null. */
export function levelCommand(L, bot) {
    if (!live(L)) return null;
    const noise = (1 - bot.skill) * 90;
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < L.hand.length; i++) {
        const h = L.hand[i];
        if (!h) continue;
        const { w, h: hh } = sizeOf(h.cells);
        for (let y = 0; y + hh <= N; y++) for (let x = 0; x + w <= N; x++) {
            if (!canPlace(L, h.cells, x, y)) continue;
            const s = simulate(L, h.cells, x, y);
            const n = s.lines.length;
            let score = n * 30 + n * n * 6 + evaluate(s.b) + goalValue(L, s, h.el, h.cells, x, y);
            for (let j = 0; j < L.hand.length; j++) if (j !== i && L.hand[j] && !fitsOn(s.b, L.hand[j].cells)) score -= 60;
            if (noise) score += (rnd(bot) - 0.5) * noise;
            if (score > bestScore) { bestScore = score; best = { t: 'place', i, x, y }; }
        }
    }
    if (L.battle && L.battle.hp <= 8 && itemUsable(L, 'tonic')) return { t: 'item', id: 'tonic' };
    if (best && bot.skill < 1 && rnd(bot) < (1 - bot.skill) * 0.1) {
        const legal = [];
        L.hand.forEach((h, i) => { if (h) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (canPlace(L, h.cells, x, y)) legal.push({ t: 'place', i, x, y }); });
        if (legal.length) return legal[Math.floor(rnd(bot) * legal.length)];
    }
    if (best) return best;
    return rescue(L);
}

/** Stuck: spend a skill or an item on whatever gets the hand moving. */
function rescue(L) {
    if (skillUsable(L, 'swap')) {
        for (let i = 0; i < L.hand.length; i++) {
            const h = L.hand[i];
            if (!h) continue;
            let c = h.cells;
            for (let k = 0; k < 3; k++) { c = rotateCells(c); if (fitsAnywhere(L, c)) return { t: 'skill', id: 'swap', i }; }
        }
    }
    if (skillUsable(L, 'affinity')) return { t: 'skill', id: 'affinity' };
    if (skillUsable(L, 'reclaim')) return { t: 'skill', id: 'reclaim' };
    if (itemUsable(L, 'vial')) {
        const i = L.hand.findIndex((h) => h && h.cells.length > 1);
        if (fitsAnywhere(L, [[0, 0]])) return { t: 'item', id: 'vial', i };
    }
    if (itemUsable(L, 'catalyst')) return { t: 'item', id: 'catalyst' };
    if (itemUsable(L, 'dissolvent')) {
        // the filled cell whose removal leaves the most room for the smallest tile in hand
        const smallest = L.hand.filter(Boolean).sort((a, b) => a.cells.length - b.cells.length)[0];
        let pick = null, ps = -1;
        for (let c = 0; c < N * N; c++) {
            if (!(L.cells[c] > 0)) continue;
            const v = L.cells[c];
            L.cells[c] = 0;
            const ok = smallest && fitsAnywhere(L, smallest.cells);
            L.cells[c] = v;
            let s = ok ? 100 : 0;
            for (const d of [-1, 1, -N, N]) if (L.cells[c + d] === 0) s++;
            if (s > ps) { ps = s; pick = c; }
        }
        if (pick !== null) return { t: 'item', id: 'dissolvent', x: pick % N, y: Math.floor(pick / N) };
    }
    return { t: 'concede' };
}

// ------------------------------------------------------------------ between levels

/** The bot's next campaign command (outside a level), or null if it has nothing to do. */
export function runCommand(G, bot) {
    if (G.queue.length) return { t: 'seen', id: G.queue[0] };
    if (G.level) {
        if (live(G.level)) return levelCommand(G.level, bot);
        return { t: 'finish' };
    }
    if (G.shop) {
        const want = ['catalyst', 'dissolvent', 'vial', 'tonic', 'salts'];
        for (const id of want) {
            const s = G.shop.stock.find((x) => x.id === id);
            const have = G.items[id] || 0;
            if (s && s.left > 0 && G.gold >= s.price + 20 && have < 2) return { t: 'buy', id };
        }
        return { t: 'leave' };
    }
    // learn the biggest tile type the cauldron allows and the stores pay for
    const learn = SHAPE_IDS.filter((id) => canLearn(G, id)).sort((a, b) => SHAPES[b].cells.length - SHAPES[a].cells.length);
    if (learn.length && bot.skill > 0.3) return { t: 'learn', id: learn[0] };
    const order = ['swap', 'sight', 'surge', 'steady', 'affinity', 'vein', 'overflow', 'surveyor', 'reclaim'];
    for (const id of order) if (canTrain(G, id)) return { t: 'train', id };
    const opts = choices(G);
    if (!opts.length) return null;
    const pref = { shop: 3, cache: 4, explore: 2.5, refine: 2, battle: 1.8, elite: G.resolve >= 2 ? 1.5 : 0.2, boss: 1 };
    let pick = opts[0], ps = -Infinity;
    for (const id of opts) {
        const n = nodeOf(G, id);
        let s = pref[n.type] + rnd(bot) * 1.2;
        if (n.type === 'shop' && G.gold < 50) s -= 3;
        if (s > ps) { ps = s; pick = id; }
    }
    const n = nodeOf(G, pick);
    const enh = [];
    if (n.type === 'refine' || n.type === 'elite') {
        const cost = {};
        for (const e of ['potency', 'stabilizer']) {
            const c = { ...cost };
            for (const [k, v] of Object.entries(ENHANCEMENTS[e].cost)) c[k] = (c[k] || 0) + v;
            if (canAfford(G, c) && Object.values(G.stores).reduce((a, b) => a + b, 0) > 6) { enh.push(e); Object.assign(cost, c); }
        }
    }
    return { t: 'go', id: pick, enh };
}

export { SKILLS };
