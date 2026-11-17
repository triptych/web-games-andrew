// Builds a level from a map node: what lies buried, what the recipe asks, who is waiting, and the
// finite supply of tiles to do it with. Pure and seeded: the same node and the same alchemist always
// give the same level.

import { N, HAND } from '../config.js';
import { rnd, rint, rpick, rshuffle, rweighted } from '../rng.js';
import { SHAPES, RARITY_WEIGHT, START_SHAPES } from './data/shapes.js';

/** The average size of a starting tile, weighted as a supply deals them (about 2 cells). */
const START_AVG = (() => {
    let w = 0, c = 0;
    for (const id of START_SHAPES) { const s = SHAPES[id]; w += RARITY_WEIGHT[s.rarity]; c += RARITY_WEIGHT[s.rarity] * s.cells.length; }
    return (c / w) * 0.9;
})();
import { POTIONS, ENHANCEMENTS } from './data/potions.js';
import { ROSTER } from './data/foes.js';

const idx = (x, y) => y * N + x;

/** The elements a chapter's lattice is made of, with weights. */
export function palette(ch) {
    if (ch <= 1) return { salt: 5, ember: 5, dew: 1 };
    if (ch === 2) return { salt: 4, ember: 4, dew: 4, root: 4 };
    if (ch === 3) return { salt: 3, ember: 3, dew: 3, root: 3, ash: 4 };
    return { salt: 3, ember: 3, dew: 3, root: 3, ash: 3, aether: 3 };
}
/** The elements a chapter's deposits hold. */
function depositElements(ch) {
    if (ch <= 1) return { salt: 5, ember: 5, dew: 1 };
    if (ch === 2) return { dew: 5, root: 5, salt: 2, ember: 2, ash: 1 };
    if (ch === 3) return { ash: 5, dew: 3, root: 3, salt: 1, ember: 1, aether: 1 };
    return { aether: 4, ash: 4, dew: 2, root: 2 };
}

const NAMES = {
    explore: ['The First Stir', 'Salt Vein', 'Ember Pocket', 'Dew and Embers', 'The Deep Seam', 'Root Hollow', 'The Dew Cavern',
        'Twin Veins', 'Old Workings', 'Quiet Strata', 'The Crooked Shaft', 'Glimmer Bed', 'Ashfall Cache', 'The Lantern Seam', 'Buried Trove'],
    battle: ['Cinder Imps', 'Root Crawlers', 'Scratching in the Walls', 'Uninvited', 'Something Stirs', 'The Infestation', 'Soot and Gears'],
};

/**
 * node: { type: 'explore' | 'refine' | 'battle' | 'elite' | 'boss', chapter, seed, first? }
 * alc:  { shapes: [ids unlocked], enh: [enhancement ids chosen for a refine] }
 */
export function makeLevel(node, alc) {
    const o = { rs: node.seed | 0 };
    const ch = node.chapter;
    let kind = node.type === 'elite' ? (rnd(o) < 0.6 ? 'explore' : 'battle') : node.type === 'boss' ? 'battle' : node.type;
    if (node.type === 'elite' && ch >= 2 && rnd(o) < 0.3) kind = 'refine';
    const elite = node.type === 'elite';
    const def = { kind, chapter: ch, elite, boss: node.type === 'boss', residue: [], deposits: [], mercy: Math.max(1, 4 - ch) };
    let work;   // the lines a clean solve needs, roughly
    if (kind === 'explore') work = explore(o, def, ch, elite, node.first);
    else if (kind === 'refine') work = refine(o, def, ch, elite, alc.enh || []);
    else work = battle(o, def, ch, elite, node.type === 'boss');
    residue(o, def, node.first ? 4 : 6 + Math.min(8, 2 * ch));
    // how much spare supply over a clean solve: generous at first, tighter each chapter and at elites and bosses
    const tight = Math.min(0.3, 0.1 * (ch - 1));
    const slack = node.first ? 2.2 : (node.type === 'boss' ? 1.4 : elite ? 1.3 : 1.55) - tight;
    def.work = work;
    def.supply = supply(o, def, alc.shapes, work * slack, kind === 'refine' ? def.refine : null, ch);
    return def;
}

// ------------------------------------------------------------------ exploration

function explore(o, def, ch, elite, first) {
    const n = first ? 1 : Math.min(4, 2 + (elite ? 1 : 0) + (rnd(o) < 0.3 ? 1 : 0));
    const maxLayers = Math.min(3, 1 + Math.floor((ch + (elite ? 1 : 0)) / 2) + (rnd(o) < 0.35 ? 1 : 0));
    const taken = new Set();
    const els = depositElements(ch);
    for (let k = 0; k < n; k++) {
        const el = rweighted(o, els);
        const cells = blob(o, taken, rint(o, 2, first ? 3 : 4), 1);
        if (!cells.length) continue;
        const layers = first ? 1 : rint(o, 1, maxLayers);
        def.deposits.push({ id: `${el}-${k}`, el, qty: 1 + Math.floor(cells.length / 2) + (layers > 1 ? 1 : 0) + (elite ? 1 : 0), cells, layers });
    }
    const roll = first ? 0 : rnd(o);
    let work;
    if (first) {
        def.objective = { kind: 'lines', target: 5 };
        work = 5;
    } else if (roll < 0.45 || elite) {
        def.objective = { kind: 'harvest', ids: def.deposits.map((d) => d.id) };
        work = def.deposits.reduce((a, d) => a + d.layers * 1.6, 2);
    } else if (roll < 0.75) {
        const t = 6 + 2 * ch + rint(o, 0, 2);
        def.objective = { kind: 'lines', target: t };
        work = t;
    } else {
        const t = Math.round((900 + 450 * ch + rint(o, 0, 4) * 100) / 50) * 50;
        def.objective = { kind: 'score', target: t };
        work = t / 140;
    }
    def.name = first ? 'The First Stir' : rpick(o, NAMES.explore);
    return work;
}

/** A connected clump of `size` cells, at least `pad` cells in from the edge, not touching `taken`. */
function blob(o, taken, size, pad) {
    for (let tries = 0; tries < 40; tries++) {
        const x = rint(o, pad, N - 1 - pad), y = rint(o, pad, N - 1 - pad);
        const cells = [idx(x, y)];
        for (let g = 0; g < 30 && cells.length < size; g++) {
            const c = rpick(o, cells);
            const [dx, dy] = rpick(o, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
            const px = (c % N) + dx, py = Math.floor(c / N) + dy;
            if (px < pad || py < pad || px > N - 1 - pad || py > N - 1 - pad) continue;
            const i = idx(px, py);
            if (!cells.includes(i)) cells.push(i);
        }
        const near = (i) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => taken.has(i + dy * N + dx)));
        if (cells.some(near)) continue;
        for (const c of cells) taken.add(c);
        return cells;
    }
    return [];
}

// ------------------------------------------------------------------ refinement

function refine(o, def, ch, elite, enh) {
    const pool = Object.values(POTIONS).filter((p) => p.chapter <= Math.min(ch, 4) && p.id !== 'mastery');
    const fresh = pool.filter((p) => p.chapter === Math.min(ch, 4));
    const P = rpick(o, fresh.length && rnd(o) < 0.6 ? fresh : pool);
    const conds = [{ type: 'lines', el: P.main, target: 2 + Math.min(2, Math.floor(ch / 2)) + (elite ? 1 : 0) }];
    if (ch >= 2) conds.push({ type: 'lines', el: P.second, target: 1 + (elite ? 1 : 0) });
    // chapter 1 asks for a streak (clears on placements in a row); from chapter 2 a double clear too
    if (ch >= 2 || elite) conds.push({ type: 'combo', target: 2 });
    conds.push({ type: 'streak', target: 2 });
    if (P.forbid) conds.push({ type: 'forbid', el: P.forbid });
    if (enh.includes('stabilizer')) for (const c of conds) if (c.type === 'combo' || c.type === 'streak') c.target = Math.max(1, c.target - 1);
    const cx = rint(o, 2, 4), cy = rint(o, 2, 4), w = rint(o, 2, 3);
    const crucible = [];
    for (let y = cy; y < cy + 3; y++) for (let x = cx; x < cx + w; x++) crucible.push(idx(x, y));
    def.refine = { potion: P.id, conds, crucible, boost: enh.includes('potency') ? 1 : 0, forgive: enh.includes('buffer') ? 1 : 0 };
    def.objective = { kind: 'brew' };
    def.name = P.name;
    return conds.reduce((a, c) => a + (c.type === 'lines' ? c.target * 1.7 : c.type === 'combo' ? 7 : c.type === 'streak' ? 2 : 0), 2);
}

export function enhancementsFor() { return Object.values(ENHANCEMENTS); }

// ------------------------------------------------------------------ battle

const BOSSES = {
    1: [{ kind: 'warden', cells: [[3, 0], [4, 0], [5, 0], [3, 1], [4, 1], [5, 1]] }],
    2: [{ kind: 'serpent', cells: [[3, 0], [4, 0], [5, 0], [4, 1]] }, { kind: 'tail', cells: [[1, 1], [7, 1]] }],
    3: [{ kind: 'homunculus', cells: [[3, 0], [4, 0], [5, 0], [3, 1], [4, 1], [5, 1], [4, 2]] }, { kind: 'wisp', cells: [[0, 1]] }, { kind: 'wisp', cells: [[8, 1]] }],
};

function battle(o, def, ch, elite, boss) {
    const foes = [];
    if (boss) {
        const b = BOSSES[Math.min(ch, 3)];
        const k = ch > 3 ? 1 + 0.25 * (ch - 3) : 1;
        for (const f of b) foes.push({ kind: f.kind, cells: f.cells.map(([x, y]) => idx(x, y)), hpMul: k });
        def.name = { 1: 'The Ember Warden', 2: 'The Dew Serpent', 3: 'The Ashen Homunculus' }[Math.min(ch, 3)];
        if (ch > 3) def.name += ` (Road ${ch - 3})`;
    } else {
        const roster = ROSTER[Math.min(ch, 3)];
        const n = rint(o, 2, 3) + (elite ? 1 : 0);
        const used = new Set();
        for (let k = 0; k < n; k++) {
            let x, y, tries = 0;
            do { x = rint(o, 0, N - 1); y = rint(o, 0, 1); tries++; } while ((used.has(idx(x, y)) || used.has(idx(x - 1, y)) || used.has(idx(x + 1, y))) && tries < 50);
            const kind = rpick(o, roster);
            used.add(idx(x, y));
            foes.push({ kind, cells: [idx(x, y)], hpMul: (elite ? 1.3 : 1) * (ch > 3 ? 1 + 0.2 * (ch - 3) : 1) });
        }
        def.name = rpick(o, NAMES.battle);
    }
    def.battle = { hp: 18 + 5 * Math.min(ch, 4) + (boss ? 6 : 0), every: boss ? 3 : elite ? 3 : 4, foes };
    def.objective = { kind: 'defeat' };
    const hp = foes.reduce((a, f) => a + 10 * (f.hpMul || 1) * (f.kind === 'warden' ? 6 : f.kind === 'serpent' ? 4.5 : f.kind === 'homunculus' ? 9 : f.kind === 'tail' ? 2.8 : 1.3), 0);
    return hp / 7 + 3;
}

// ------------------------------------------------------------------ the board and the supply

/** A few loose tiles already on the lattice, never completing a line, never on a foe or a deposit. */
function residue(o, def, n) {
    const blocked = new Set();
    for (const d of def.deposits) for (const c of d.cells) blocked.add(c);
    for (const f of def.battle?.foes || []) for (const c of f.cells) { blocked.add(c); blocked.add(c + N); }
    const rows = new Array(N).fill(0), cols = new Array(N).fill(0);
    const pal = palette(def.chapter);
    for (let k = 0, tries = 0; k < n && tries < 200; tries++) {
        const c = rint(o, 0, N * N - 1);
        const x = c % N, y = Math.floor(c / N);
        if (blocked.has(c) || rows[y] >= N - 3 || cols[x] >= N - 3) continue;
        blocked.add(c); rows[y]++; cols[x]++;
        def.residue.push({ c, el: rweighted(o, pal) });
        k++;
    }
}

/**
 * The finite supply: enough tiles to fill `lines` lines (rounded up to whole hands) from the unlocked types, weighted by
 * rarity, with at least 40% small (1–2 cell) tiles so an opening is always playable. A refinement's
 * supply leans toward the elements its recipe asks for.
 */
function supply(o, def, unlocked, lines, R, ch) {
    const shapes = unlocked.map((id) => SHAPES[id]).filter(Boolean);
    const weights = {};
    for (const s of shapes) weights[s.id] = RARITY_WEIGHT[s.rarity] / shapes.filter((t) => t.rarity === s.rarity).length;
    // sized for the starting tiles: bigger types you have learned make the same supply go further
    const count = Math.max(HAND * 4, Math.ceil((lines * N) / START_AVG / HAND) * HAND);
    const small = shapes.filter((s) => s.cells.length <= 2).map((s) => s.id);
    const pal = { ...palette(ch) };
    if (R) for (const c of R.conds) if (c.type === 'lines') pal[c.el] = (pal[c.el] || 0) + (c === R.conds[0] ? 9 : 5);
    const out = [];
    for (let k = 0; k < count; k++) {
        const shape = rweighted(o, weights);
        out.push({ shape, el: rweighted(o, pal) });
    }
    // the small-tile floor
    const want = Math.ceil(count * 0.4);
    let have = out.filter((t) => SHAPES[t.shape].cells.length <= 2).length;
    for (let k = 0; k < out.length && have < want; k++) {
        if (SHAPES[out[k].shape].cells.length > 2 && rnd(o) < 0.6) { out[k].shape = rpick(o, small); have++; }
    }
    return rshuffle(o, out);
}
