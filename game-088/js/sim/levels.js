// Level specs. Pure and deterministic: levelSpec(n) always builds the same dig.
//
// The 60 story levels (five chapters of twelve) are generated from a seed per level and a
// difficulty curve, then the moves and star scores are fitted to the bot's play by
// dev/tune.mjs and written into TUNED below. Levels past 60 are the endless Night Digs, built
// the same way with the formula alone.

import { makeRng } from '../rng.js';

export const STORY_LEVELS = 60;
export const PER_CHAPTER = 12;

const W = 9;
// Board shapes on a 9×9 grid. 'o' is a cell, '.' is not.
const SHAPES = {
    full: ['ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo'],
    corners: ['.ooooooo.', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', '.ooooooo.'],
    diamond: ['..ooooo..', '.ooooooo.', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', '.ooooooo.', '..ooooo..'],
    hourglass: ['ooooooooo', 'ooooooooo', '.ooooooo.', '..ooooo..', '..ooooo..', '..ooooo..', '.ooooooo.', 'ooooooooo', 'ooooooooo'],
    cross: ['..ooooo..', '..ooooo..', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', '..ooooo..', '..ooooo..'],
    donut: ['ooooooooo', 'ooooooooo', 'ooooooooo', 'ooo...ooo', 'ooo...ooo', 'ooo...ooo', 'ooooooooo', 'ooooooooo', 'ooooooooo'],
    arch: ['ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooo...ooo', 'ooo...ooo', 'ooo...ooo', 'ooo...ooo'],
    twin: ['oooo.oooo', 'oooo.oooo', 'oooo.oooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'oooo.oooo', 'oooo.oooo', 'oooo.oooo'],
    pyramid: ['...ooo...', '..ooooo..', '.ooooooo.', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo'],
    bowl: ['ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'ooooooooo', '.ooooooo.', '..ooooo..', '...ooo...'],
    small: ['ooooooo', 'ooooooo', 'ooooooo', 'ooooooo', 'ooooooo', 'ooooooo', 'ooooooo'],
    eight: ['oooooooo', 'oooooooo', 'oooooooo', 'oooooooo', 'oooooooo', 'oooooooo', 'oooooooo', 'oooooooo'],
};

/** Fitted by dev/tune.mjs: [moves, two-star score, three-star score] for each story level. */
export const TUNED = [
    [16, 15500, 23500], [16, 40000, 82500], [16, 23000, 58500], [14, 15500, 19500], [32, 24500, 31000], [14, 16000, 25500],
    [17, 9500, 16000], [17, 16000, 21500], [22, 24500, 34000], [19, 18000, 20500], [21, 20500, 25000], [33, 28000, 32000],
    [17, 11500, 16500], [16, 11500, 17500], [25, 24000, 32000], [36, 25000, 32000], [26, 23500, 31000], [15, 17500, 21500],
    [16, 13500, 18500], [12, 19000, 22500], [37, 32000, 38000], [29, 29500, 37500], [23, 17000, 23000], [26, 17000, 23000],
    [24, 21500, 26000], [14, 26500, 35000], [19, 21000, 25000], [31, 20000, 22000], [19, 34000, 38000], [16, 20500, 26500],
    [16, 24500, 29000], [22, 21500, 26000], [28, 29500, 34000], [18, 20500, 23500], [20, 16000, 20000], [27, 18000, 25500],
    [26, 20000, 24500], [23, 25000, 31000], [28, 23500, 29500], [22, 22500, 29500], [29, 17500, 22500], [21, 22000, 27500],
    [38, 33000, 37000], [21, 23500, 27000], [29, 31000, 35000], [42, 20000, 23000], [45, 22500, 26000], [43, 35500, 43000],
    [27, 31000, 41500], [16, 17500, 22500], [45, 35000, 41000], [28, 26000, 31000], [25, 27500, 30500], [41, 37000, 42500],
    [21, 21000, 26500], [21, 26500, 32000], [26, 35500, 46000], [35, 29500, 34500], [25, 19500, 24500], [45, 18000, 23000],
];

/** Which mechanics a level may use, by level number: the order they are taught. */
const TEACH = { soil: 2, fossil: 4, relic: 5, rock: 7, crust: 13 };

const TIPS = {
    1: 'Swap two finds side by side to line up three of a kind. Collect the amphorae!',
    2: 'Dark squares are buried in dirt. Clear finds on them to dig the dirt away.',
    3: 'Line up four for a Trowel: it sweeps a whole row or column. Make a T or an L for a Pickaxe!',
    4: 'Bones are hidden under the dirt. Dig every square above a fossil to uncover it.',
    5: 'Bring the relics down to the bottom of the dig to lift them out.',
    6: 'Match a 2×2 square and a Scarab hatches. It flies off to dig where you need it most.',
    7: 'Boulders crack when you make matches next to them. Specials smash them too.',
    9: 'Line up five for a Sunstone. Swap it with any find to clear every one of that kind.',
    11: 'Swap two specials together for a combo!',
    13: 'Crusted finds are stuck in hard sand. Match them to break the crust.',
};

/** A chapter's look on the board view: tray colour and sand, by chapter. */
export const CHAPTER_OF = (n) => Math.min(4, Math.floor((n - 1) / PER_CHAPTER));

export function levelSpec(n) {
    const rng = makeRng(0x5eed + n * 7919);
    const story = n <= STORY_LEVELS;
    const ch = story ? CHAPTER_OF(n) : 2 + ((n - 1) % 3);
    const k = (n - 1) % PER_CHAPTER;
    // difficulty: rises through a chapter with a spike on every fourth level, eases at a new chapter
    let diff = story ? 0.08 + ch * 0.12 + k * 0.025 + (k % 4 === 3 ? 0.12 : 0) : 0.6 + Math.min(0.3, (n - STORY_LEVELS) * 0.004) + rng() * 0.15;
    if (n <= 3) diff = 0.02 * n;
    const can = (m) => n >= TEACH[m];

    // ------------------------------------------------ shape
    let shapeKey;
    if (n === 1) shapeKey = 'small';
    else if (n <= 4) shapeKey = 'eight';
    else {
        const pool = ['full', 'corners', 'diamond', 'hourglass', 'cross', 'donut', 'arch', 'twin', 'pyramid', 'bowl', 'eight'];
        shapeKey = pool[Math.floor(rng() * pool.length)];
    }
    const base = SHAPES[shapeKey];
    const R = base.length, C = base[0].length;
    const g = base.map((row) => row.split(''));
    const cells = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (g[r][c] === 'o') cells.push([r, c]);
    const free = () => cells.filter(([r, c]) => g[r][c] === 'o');
    const take = (list) => list.splice(Math.floor(rng() * list.length), 1)[0];

    // ------------------------------------------------ the goals this level is about
    const kinds = [];
    if (n === 1 || n === 3) kinds.push('color');
    else if (n === 2) kinds.push('soil');
    else if (n === 4) kinds.push('fossil');
    else if (n === 5) kinds.push('relic');
    else if (n === 7) kinds.push('rock', 'color');
    else if (n === 13) kinds.push('crust');
    else {
        const pool = ['color', 'soil', 'fossil', 'relic', 'rock', 'crust'].filter((m) => m === 'color' || can(m));
        const want = diff > 0.55 && rng() < 0.6 ? 3 : diff > 0.25 ? 2 : 1;
        // every chapter's third level brings relics, its sixth fossils: the museum needs them
        if (k === 2 && can('relic')) kinds.push('relic');
        if (k === 5 && can('fossil')) kinds.push('fossil');
        while (kinds.length < want) {
            const m = pool[Math.floor(rng() * pool.length)];
            if (!kinds.includes(m)) kinds.push(m);
        }
    }
    const has = (m) => kinds.includes(m);
    const relicLevel = has('relic');

    // ------------------------------------------------ dirt
    if (has('soil') || has('fossil')) {
        const layers = diff > 0.3 && rng() < 0.6 ? 2 : 1;
        const style = n === 2 ? 'bottom' : ['bottom', 'blob', 'band', 'scatter', 'frame'][Math.floor(rng() * 5)];
        const pick = [];
        const amount = Math.round(cells.length * (0.3 + diff * 0.4));
        if (style === 'bottom') for (const [r, c] of cells) { if (r >= R - Math.ceil(amount / C)) pick.push([r, c]); }
        if (style === 'band') { const r0 = 2 + Math.floor(rng() * (R - 5)); for (const [r, c] of cells) if (r >= r0 && r < r0 + Math.ceil(amount / C)) pick.push([r, c]); }
        if (style === 'frame') for (const [r, c] of cells) { if (r === 0 || c === 0 || r === R - 1 || c === C - 1) pick.push([r, c]); }
        if (style === 'blob') {
            const cr = (R - 1) / 2 + (rng() - 0.5) * 2, cc = (C - 1) / 2 + (rng() - 0.5) * 2;
            const sorted = cells.slice().sort((a, b) => Math.hypot(a[0] - cr, a[1] - cc) - Math.hypot(b[0] - cr, b[1] - cc));
            pick.push(...sorted.slice(0, amount));
        }
        if (style === 'scatter') { const list = cells.slice(); for (let i = 0; i < amount; i++) pick.push(take(list)); }
        for (const [r, c] of pick) g[r][c] = String(layers);
        if (has('fossil')) {
            const soilCells = pick.slice();
            const nf = Math.max(3, Math.min(soilCells.length, Math.round(3 + diff * 6)));
            for (let i = 0; i < nf && soilCells.length; i++) { const [r, c] = take(soilCells); g[r][c] = layers === 2 ? 'F' : 'f'; }
        }
    }

    // ------------------------------------------------ boulders
    if (has('rock')) {
        const nr = Math.round(4 + diff * 8);
        // never in the lowest cell of a column: that is where relics leave the board
        const lowest = (c) => { for (let r = R - 1; r >= 0; r--) if (g[r][c] !== '.') return r; return -1; };
        const list = free().filter(([r, c]) => r > 0 && r < lowest(c) - (relicLevel ? 1 : 0));
        for (let i = 0; i < nr && list.length; i++) {
            const [r, c] = take(list);
            g[r][c] = diff > 0.3 && rng() < 0.5 ? 'R' : 'r';
            // a mirrored partner looks designed rather than random
            const mc = C - 1 - c;
            if (rng() < 0.6 && g[r][mc] === 'o' && i + 1 < nr) { g[r][mc] = g[r][c]; i++; }
        }
    }

    // ------------------------------------------------ crust
    if (has('crust')) {
        const nc = Math.round(6 + diff * 12);
        const list = cells.filter(([r, c]) => g[r][c] === 'o' || g[r][c] === '1');
        for (let i = 0; i < nc && list.length; i++) { const [r, c] = take(list); g[r][c] = g[r][c] === '1' ? 'y' : 'x'; }
    }

    // ------------------------------------------------ colours
    const ncol = n <= 3 ? 4 : !relicLevel && ((diff > 0.6 && rng() < 0.5) || (!story && diff > 0.7)) ? 6 : 5;
    const order = [0, 1, 2, 3, 4, 5];
    // amphora, coin, leaf and shell are the first four; later levels shuffle the set
    if (n > 3) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const colors = order.slice(0, ncol).sort((a, b) => a - b);

    // ------------------------------------------------ goals with counts from the board itself
    const rows = g.map((row) => row.join(''));
    const count = (re) => rows.join('').split('').filter((ch) => re.test(ch)).length;
    const goals = [];
    let work = 0;
    if (has('soil')) { const s = count(/[12fFy]/); goals.push({ kind: 'soil', n: s }); work += count(/[12fFy]/) + count(/[2F]/); }
    if (has('fossil')) { const f = count(/[fF]/); goals.push({ kind: 'fossil', n: f }); work += f * 3; }
    if (has('rock')) { const s = count(/[rR]/); goals.push({ kind: 'rock', n: s }); work += count(/r/) * 1.5 + count(/R/) * 2.6; }
    if (has('crust')) { const s = count(/[xy]/); goals.push({ kind: 'crust', n: s }); work += s * 1.4; }
    let relics = null;
    if (relicLevel) {
        const total = n === 5 ? 2 : Math.min(4, Math.round(2 + diff * 3));
        relics = { total, max: total > 3 ? 2 : 1 + (rng() < 0.4 ? 1 : 0) };
        goals.push({ kind: 'relic', n: total });
        work += total * 5;
    }
    if (has('color')) {
        const nGoal = n === 1 ? 1 : goals.length >= 2 ? 1 : 1 + (rng() < 0.5 ? 1 : 0);
        const pickCols = colors.slice();
        for (let i = 0; i < nGoal; i++) {
            const c = n === 1 ? 0 : pickCols.splice(Math.floor(rng() * pickCols.length), 1)[0];
            const amt = n === 1 ? 20 : Math.round((20 + diff * 40) / 5) * 5;
            goals.push({ kind: 'color', c, n: amt });
            work += amt * 0.45;
        }
    }

    // ------------------------------------------------ moves and stars
    const t = story ? TUNED[n - 1] : null;
    let moves = t ? t[0] : Math.round(Math.max(14, 10 + work * (0.62 - diff * 0.18)));
    if (n === 1) moves = Math.max(moves, 20);
    const star2 = t ? t[1] : Math.round((moves * 900) / 500) * 500;
    const star3 = t ? t[2] : Math.round((moves * 1500) / 500) * 500;

    return {
        n, story, chapter: ch, shape: shapeKey, diff: Math.round(diff * 100) / 100,
        rows, colors, moves, goals, relics,
        stars: [0, star2, star3],
        tip: TIPS[n] || null,
        hard: story && k % 4 === 3 && n > 4,
    };
}

/** Stars a finished score earns (1 for any win). */
export function starsFor(spec, score) {
    return score >= spec.stars[2] ? 3 : score >= spec.stars[1] ? 2 : 1;
}

export { W as BOARD_W };
