/**
 * simtest.mjs — headless checks on the real rules (js/sim + js/config).
 *
 *   node game-058/dev/simtest.mjs              # rules, invariants, balance gate
 *   BALANCE=1 node game-058/dev/simtest.mjs    # + per-level balance table
 *
 * No dependencies. Exits non-zero on the first failed section.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    LEVELS, MASKS, KINDS, GARDENS, SIZE_IDS, COLOUR_IDS, FAMILY_IDS, JARS, GOLDEN_CHAIN, MIN_CHAIN,
    CONTINUE_MOVES, PICNIC_BASKET, albumVariants, levelSenses,
} from '../js/config.js';
import { Game, buildPool } from '../js/sim/game.js';
import { hasMove, findHint, bestChain } from '../js/sim/search.js';
import { botPlay, botStep } from '../js/sim/bot.js';
import { makeRng } from '../js/sim/rng.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
function ok(cond, msg) {
    if (cond) { passed++; return; }
    failed++;
    console.log('  ✗ ' + msg);
}
function section(name, fn) {
    const before = failed;
    try { fn(); } catch (e) { failed++; console.log('  ✗ threw: ' + (e.stack || e)); }
    console.log(`${failed === before ? '✓' : '✗'} ${name}`);
}

// ------------------------------------------------------------
section('sim is pure: no three.js, no DOM, no Math.random', () => {
    const dir = path.join(HERE, '../js/sim');
    for (const f of fs.readdirSync(dir)) {
        // Strip comments so prose like "never calls Math.random" doesn't count.
        const src = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        ok(!/from ['"]three/.test(src), `${f} imports three`);
        ok(!/\bdocument\.|\bwindow\./.test(src), `${f} touches the DOM`);
        ok(!/Math\.random/.test(src), `${f} calls Math.random`);
    }
});

// ------------------------------------------------------------
section('level data is consistent', () => {
    ok(LEVELS.length === 30, `30 levels (got ${LEVELS.length})`);
    LEVELS.forEach((L, i) => {
        const tag = `level ${i + 1} ${L.name}`;
        const mask = MASKS[L.mask];
        ok(!!mask && mask.length === 8 && mask.every(r => r.length === 7), `${tag}: mask ${L.mask} is 7×8`);
        ok(L.goals.length >= 1 && L.goals.length <= 4, `${tag}: 1–4 goals`);
        ok(L.moves > 0, `${tag}: moves`);
        const pool = buildPool(L);
        const kinds = pool.kinds.map(k => k.kind);
        const colours = new Set(pool.kinds.flatMap(k => k.colours));
        const families = new Set(kinds.map(k => KINDS[k].family));
        for (const k of kinds) ok(!!KINDS[k], `${tag}: kind ${k} exists`);
        for (const g of L.goals) {
            if (g.t === 'kind') ok(kinds.includes(g.v), `${tag}: goal kind ${g.v} spawns`);
            if (g.t === 'colour') ok(colours.has(g.v), `${tag}: goal colour ${g.v} spawns`);
            if (g.t === 'size') ok((L.sizes ?? ['M']).includes(g.v), `${tag}: goal size ${g.v} spawns`);
            if (g.t === 'family') ok(families.has(g.v), `${tag}: goal family ${g.v} spawns`);
            if (g.t === 'leaf') ok((L.leaves ?? []).length >= g.n, `${tag}: enough leaf piles for the goal`);
            if (g.t === 'frost') ok((L.frost ?? []).length >= g.n, `${tag}: enough frost for the goal`);
        }
        for (const [r, c] of [...(L.leaves ?? []), ...(L.frost ?? [])]) ok(mask[r]?.[c] === '.', `${tag}: obstacle at ${r},${c} sits on the blanket`);
        // A colour goal must be reachable with this garden's senses (no colour sense → classic colours only).
        if (!levelSenses(L).includes('colour')) ok(pool.kinds.every(k => k.colours.length === 1), `${tag}: one colour per kind before Colour sense`);
    });
    // Each garden's first level introduces its newest sense, and senses only grow.
    for (let g = 1; g < GARDENS.length; g++) ok(GARDENS[g].senses.length === GARDENS[g - 1].senses.length + 1, `garden ${g} adds exactly one sense`);
    ok(albumVariants().length === 81, `album has 81 variants (got ${albumVariants().length})`);
});

// ------------------------------------------------------------
function checkInvariants(game, tag) {
    const ids = new Set();
    for (let r = 0; r < game.rows; r++) {
        for (let c = 0; c < game.cols; c++) {
            const cell = game.cells[r][c];
            if (cell.hole || cell.leaf > 0) { ok(!cell.fruit, `${tag}: no fruit in hole/leaf ${r},${c}`); continue; }
            ok(!!cell.fruit, `${tag}: cell ${r},${c} is filled`);
            if (!cell.fruit) continue;
            ok(!ids.has(cell.fruit.id), `${tag}: duplicate fruit id`);
            ids.add(cell.fruit.id);
            ok(SIZE_IDS.includes(cell.fruit.size) && COLOUR_IDS.includes(cell.fruit.colour) && FAMILY_IDS.includes(cell.fruit.family), `${tag}: fruit traits valid`);
        }
    }
    if (game.status === 'playing') ok(hasMove(game, false), `${tag}: a legal trail exists`);
    for (const g of game.goals) ok(g.have >= 0 && g.have <= g.n, `${tag}: goal progress in range`);
    for (const j of game.jars) ok(j.charges >= 0 && j.charges <= 2 && j.fill >= 0 && j.fill <= j.need, `${tag}: jar ${j.sense} in range (${j.fill}/${j.need}, ${j.charges})`);
    ok(Number.isFinite(game.score) && game.score >= 0, `${tag}: score finite`);
}

section('board invariants hold through 40 bot games', () => {
    for (let s = 0; s < 40; s++) {
        const li = s % LEVELS.length;
        const game = new Game(LEVELS[li], { seed: 1000 + s });
        checkInvariants(game, `L${li + 1} s${s} start`);
        let guard = 0;
        while (game.status === 'playing' && guard++ < 60) {
            const ev = botStep(game, { skill: 0.5, rng: makeRng(s) });
            if (!ev) break;
            checkInvariants(game, `L${li + 1} s${s} step ${guard}`);
        }
    }
});

// ------------------------------------------------------------
/** A board with exactly the fruit we want, for rule tests. */
function rig(spec, rows, opts = {}) {
    const game = new Game({ g: 3, mask: 'full', moves: 20, kinds: ['apple'], goals: [{ t: 'any', n: 999 }], ...spec }, { seed: 7, ...opts });
    const map = {
        A: ['apple', 'red', 'M'], a: ['apple', 'green', 'M'], S: ['strawberry', 'red', 'M'], L: ['lime', 'green', 'M'],
        Y: ['lemon', 'yellow', 'L'], G: ['grape', 'purple', 'L'], B: ['blueberry', 'blue', 'S'], O: ['orange', 'orange', 'S'],
        P: ['pineapple', 'yellow', 'M'], N: ['banana', 'yellow', 'S'],
    };
    for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) {
        const ch = rows[r][c];
        const cell = game.cells[r][c];
        cell.leaf = 0; cell.hole = false;
        if (ch === '#') { cell.fruit = null; cell.leaf = 1; continue; }
        const [kind, colour, size] = map[ch];
        cell.fruit = game._makeFruit(kind, colour, size);
    }
    return game;
}
const DEAD = ['BOBOBOB', 'NPNPNPN', 'BOBOBOB', 'NPNPNPN', 'BOBOBOB', 'NPNPNPN', 'BOBOBOB', 'NPNPNPN'];
const FILL = ['BOBOBOB', 'OBOBOBO', 'BOBOBOB', 'OBOBOBO', 'BOBOBOB', 'OBOBOBO', 'BOBOBOB', 'OBOBOBO'];
const withRow = (r0, s) => FILL.map((row, i) => (i === r0 ? s : row));

section('trail rules: adjacency, length, links by sense', () => {
    // Kind only (garden 0): red apple → strawberry shares only colour → illegal.
    let g = rig({ g: 0 }, withRow(0, 'AASBOBO'), { senses: ['kind'] });
    ok(!g.validChain([[0, 0], [0, 1], [0, 2]]), 'kind-only: apple→strawberry (same colour) rejected');
    ok(!g.validChain([[0, 0], [0, 1]]), 'trail of 2 rejected');
    ok(!g.validChain([[0, 0], [0, 2], [0, 1]]), 'non-adjacent hop rejected');
    ok(!g.validChain([[0, 0], [0, 1], [0, 0]]), 'revisiting a cell rejected');
    // Kind + colour.
    g = rig({}, withRow(0, 'AASBOBO'), { senses: ['kind', 'colour'] });
    ok(g.validChain([[0, 0], [0, 1], [0, 2]]), 'colour sense: apple→apple→strawberry accepted');
    ok(g.linkTraits(g.cells[0][1].fruit, g.cells[0][2].fruit).includes('colour'), 'link names the shared trait');
    // Word-ladder trail: red apple → green apple (kind) → lime (colour).
    g = rig({}, withRow(0, 'AaLBOBO'), { senses: ['kind', 'colour'] });
    ok(g.validChain([[0, 0], [0, 1], [0, 2]]), 'ladder: red apple → green apple → lime');
    // Size: big lemon → big grape only with size sense.
    g = rig({}, withRow(0, 'YGYBOBO'), { senses: ['kind', 'colour'] });
    ok(!g.validChain([[0, 0], [0, 1], [0, 2]]), 'no size sense: big lemon → big grape rejected');
    g = rig({}, withRow(0, 'YGYBOBO'), { senses: ['kind', 'colour', 'size'] });
    ok(g.validChain([[0, 0], [0, 1], [0, 2]]), 'size sense: big lemon → big grape accepted');
    // Family: lemon (citrus, L) → orange (citrus, S) only with family sense.
    g = rig({}, withRow(0, 'YOYBGBG'), { senses: ['kind', 'colour', 'size'] });
    ok(!g.validChain([[0, 0], [0, 1], [0, 2]]), 'no family sense: lemon → orange rejected');
    g = rig({}, withRow(0, 'YOYBGBG'), { senses: ['kind', 'colour', 'size', 'family'] });
    ok(g.validChain([[0, 0], [0, 1], [0, 2]]), 'family sense: lemon → orange accepted');
    // Diagonal hops.
    g = rig({}, ['ABOBOBO', 'BAOBOBO', 'BOAOBOB', ...FILL.slice(3)], { senses: ['kind'] });
    ok(g.validChain([[0, 0], [1, 1], [2, 2]]), 'diagonal trail accepted');
});

section('harvest: moves, score, gravity and refill', () => {
    const g = rig({}, withRow(7, 'AAAAOBO'), { senses: ['kind'] });
    const before = g.movesLeft();
    const ids = [0, 1, 2, 3].map(c => g.cells[7][c].fruit.id);
    const ev = g.playChain([[7, 0], [7, 1], [7, 2], [7, 3]]);
    ok(!!ev, 'legal trail plays');
    ok(g.movesLeft() === before - 1, 'one move spent');
    ok(g.score >= 160, `score 10·n² (got ${g.score})`);
    ok(ev[0].type === 'harvest' && ev[0].items.length === 4, 'harvest event lists the fruit');
    ok(ev.some(e => e.type === 'settle'), 'settle event follows');
    for (let c = 0; c < 4; c++) ok(!ids.includes(g.cells[7][c].fruit.id), `column ${c} refilled`);
    checkInvariants(g, 'after harvest');
    ok(g.playChain([[7, 0], [5, 5], [3, 3]]) === null, 'illegal trail returns null and changes nothing');
});

section('golden fruit: grows from a long trail and links to anything', () => {
    const g = rig({}, withRow(7, 'AAAAAAA'), { senses: ['kind'] });
    const ev = g.playChain([[7, 0], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]]);
    const gold = ev.find(e => e.type === 'golden');
    ok(GOLDEN_CHAIN === 7 && !!gold, 'a 7-trail grows a golden fruit');
    ok(g.stats.golden === 1, 'golden counted');
    let found = null;
    g.forEachFruit((f, r, c) => { if (f.golden) found = [r, c]; });
    ok(!!found, 'golden fruit is on the board');
    const f = g.cells[found[0]][found[1]].fruit;
    ok(g.canLink(f, { kind: 'lime', colour: 'green', size: 'S', family: 'citrus' }), 'golden links to anything');
});

section('power-ups: honey, paint, bomb, rainbow', () => {
    let g = rig({}, ['AOBOBOB', 'OBOBOBA', 'BOAOBOB', ...FILL.slice(3)], { senses: ['kind', 'colour', 'size', 'family'] });
    const honey = g.jars.findIndex(j => j.power === 'honey');
    g.jars[honey].charges = 1;
    let apples = 0; g.forEachFruit(f => { if (f.kind === 'apple') apples++; });
    const before = g.movesLeft();
    let ev = g.usePower(honey, 0, 0);
    ok(!!ev && ev[0].items.length === apples, `honey collects all ${apples} apples`);
    ok(g.movesLeft() === before, 'power-ups cost no move');
    ok(g.jars[honey].charges === 0, 'charge spent');
    ok(g.usePower(honey, 0, 0) === null, 'no charge → refused');

    g = rig({}, FILL, { senses: ['kind', 'colour', 'size', 'family'] });
    const paint = g.jars.findIndex(j => j.power === 'paint');
    g.jars[paint].charges = 1;
    ev = g.usePower(paint, 3, 3);
    const colour = g.cells[3][3].fruit.colour;
    ok(!!ev && [[2, 2], [2, 3], [2, 4], [3, 2], [3, 4], [4, 2], [4, 3], [4, 4]].every(([r, c]) => g.cells[r][c].fruit.colour === colour), 'paint turns all 8 neighbours the tapped colour');

    g = rig({}, FILL, { senses: ['kind', 'colour', 'size', 'family'] });
    const bomb = g.jars.findIndex(j => j.power === 'bomb');
    g.jars[bomb].charges = 1;
    ev = g.usePower(bomb, 4, 3);
    ok(!!ev && ev[0].items.length === 9, 'bomb collects the 3×3');
    checkInvariants(g, 'after bomb');

    g = rig({}, ['ABOBOBO', ...FILL.slice(1)], { senses: ['kind', 'colour', 'size', 'family'] });
    const rb = g.jars.findIndex(j => j.power === 'rainbow');
    g.jars[rb].charges = 1;
    // Apple (orchard, red, M) → blueberry (berry, blue, S) shares nothing.
    ok(!g.canLink(g.cells[0][0].fruit, g.cells[0][1].fruit), 'apple → blueberry share nothing');
    ev = g.usePower(rb);
    ok(!!ev && g.wild, 'rainbow arms wild trail');
    ok(g.canLink({ kind: 'apple', colour: 'red', size: 'M', family: 'orchard' }, { kind: 'blueberry', colour: 'blue', size: 'S', family: 'berry' }), 'wild: unrelated fruit link');
    g.playChain([[0, 0], [0, 1], [0, 2]]);
    ok(!g.wild, 'wild used up by one trail');
});

section('jars: fill from matching fruit, earn charges, pick a new set', () => {
    const g = rig({}, withRow(7, 'AAAAAAB'), { senses: ['kind'] });
    const jar = g.jars[0];
    jar.target = 'apple'; jar.fill = 3; jar.charges = 0;
    g.playChain([[7, 0], [7, 1], [7, 2], [7, 3], [7, 4]]);
    ok(jar.charges === 1, `8-apple set earns a charge (charges ${jar.charges})`);
    ok(g.takeFilledJars().includes(0), 'filled jar reported once');
    ok(g.takeFilledJars().length === 0, '…and only once');
    ok(jar.need === JARS.kind.need, 'need from config');
});

section('obstacles: leaf piles rake, frost thaws, frozen fruit is fixed', () => {
    const spec = { leaves: [[6, 1, 2]], frost: [[6, 4, 2]] };
    const g = new Game({ g: 3, mask: 'full', moves: 30, kinds: ['apple', 'orange'], goals: [{ t: 'leaf', n: 1 }, { t: 'frost', n: 1 }], ...spec }, { seed: 3, senses: ['kind'] });
    ok(g.cells[6][1].leaf === 2 && !g.cells[6][1].fruit, 'leaf pile has no fruit');
    ok(g.cells[6][4].fruit?.frost === 2 && !g.selectable(6, 4), 'frosted fruit is not selectable');
    const frozenId = g.cells[6][4].fruit.id;
    const row7 = () => { for (let c = 0; c < 7; c++) g.cells[7][c].fruit = g._makeFruit('apple', 'red', 'M'); };
    const trail = [[7, 0], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5]];
    row7();
    g.playChain(trail);
    ok(g.cells[6][1].leaf === 1, 'one leaf layer raked');
    ok(g.cells[6][4].fruit?.id === frozenId && g.cells[6][4].fruit.frost === 1, 'frozen fruit stayed put and lost a layer');
    row7();
    g.playChain(trail);
    ok(g.cells[6][1].leaf === 0, 'pile cleared');
    ok(g.goals[0].have === 1, 'leaf goal counted');
    ok(g.goals[1].have === 1, 'frost goal counted');
    checkInvariants(g, 'after obstacles');
});

section('win, stars, out of moves, +5 continue', () => {
    let g = rig({ moves: 10, goals: [{ t: 'kind', v: 'apple', n: 3 }] }, withRow(7, 'AAABOBO'), { senses: ['kind'] });
    g.playChain([[7, 0], [7, 1], [7, 2]]);
    ok(g.status === 'won' && g.stars === 3, `win with 9/10 moves left = 3 stars (${g.status}, ${g.stars})`);
    ok(g.leftoverBonus === 9 * 150, 'sweet finish bonus');

    g = rig({ moves: 1, goals: [{ t: 'kind', v: 'apple', n: 50 }] }, withRow(7, 'AAABOBO'), { senses: ['kind'] });
    g.playChain([[7, 0], [7, 1], [7, 2]]);
    ok(g.status === 'lost', 'out of moves → lost');
    ok(g.continueGame() && g.status === 'playing' && g.movesLeft() === CONTINUE_MOVES, '+5 moves continues');
    g.moves = g.movesUsed;
    g.status = 'lost';
    ok(!g.continueGame(), 'only one continue');
    g.status = 'playing'; g.moves = g.movesUsed + 5; g.goals[0].have = 49;
    for (let c = 0; c < 3; c++) g.cells[7][c].fruit = g._makeFruit('apple', 'red', 'M');
    g.playChain([[7, 0], [7, 1], [7, 2]]);
    ok(g.status === 'won' && g.stars === 1, 'a continued win is capped at 1 star');

    // Charged power-ups keep you playing after the last move.
    g = rig({ moves: 1, goals: [{ t: 'kind', v: 'apple', n: 50 }] }, withRow(7, 'AAABOBO'), { senses: ['kind', 'colour', 'size'] });
    g.jars[2].charges = 1;
    g.playChain([[7, 0], [7, 1], [7, 2]]);
    ok(g.status === 'playing', 'out of moves with a bomb charged → still playing');
    g.usePower(2, 4, 3);
    ok(g.status === 'lost', 'last charge spent → lost');
});

section('determinism: same seed, same game', () => {
    const run = () => {
        const g = new Game(LEVELS[12], { seed: 4242 });
        botPlay(g, { skill: 0.6, rng: makeRng(9) });
        return JSON.stringify([g.score, g.movesUsed, g.status, g.goals.map(x => x.have)]);
    };
    ok(run() === run(), 'two runs match');
});

section('hints and dead boards', () => {
    for (let s = 0; s < 20; s++) {
        const g = new Game(LEVELS[s % LEVELS.length], { seed: 50 + s });
        const h = findHint(g);
        ok(h && g.validChain(h), `hint is a legal trail (L${(s % LEVELS.length) + 1})`);
    }
    // A board with no legal trail gets shuffled until it has one.
    const g = rig({}, DEAD, { senses: ['kind'] });
    ok(!hasMove(g, false), 'four kinds in a 2×2 tiling have no kind-trail');
    const ev = [];
    g._ensureMove(ev);
    ok(ev.some(e => e.type === 'shuffle') && hasMove(g, false), 'shuffle restores a move');
});

section('picnic: no move limit, baskets add kinds', () => {
    const spec = { picnic: true, g: 3, mask: 'full', moves: Infinity, goals: [], sizes: ['S', 'M', 'L'], kinds: ['apple', 'orange', 'lemon', 'lime', 'grape'], extraKinds: [{ kind: 'banana', colours: ['yellow'] }, { kind: 'mango', colours: ['orange'] }], maxKinds: 10 };
    const g = new Game(spec, { seed: 11, senses: ['kind', 'colour', 'size', 'family'] });
    let guard = 0;
    while (g.basket < 2 && guard++ < 200) botStep(g, { skill: 0.5, rng: makeRng(2) });
    ok(g.status === 'playing', 'picnic never ends');
    ok(g.basket >= 2, `baskets fill (got ${g.basket})`);
    ok(g.pool.kinds.length === 7, `each basket adds a kind (pool ${g.pool.kinds.length})`);
    ok(PICNIC_BASKET === 40, 'basket size');
});

// ------------------------------------------------------------
section('balance: every level is winnable by casual bots', () => {
    const N = process.env.BALANCE ? 24 : 8;
    const rows = [];
    LEVELS.forEach((L, i) => {
        const res = {};
        for (const skill of [0.4, 1]) {
            let wins = 0, left = 0, s3 = 0;
            for (let s = 1; s <= N; s++) {
                const g = new Game(L, { seed: s * 7919 + i });
                botPlay(g, { skill, rng: makeRng(s) });
                if (g.status === 'won') { wins++; left += g.movesLeft(); if (g.stars === 3) s3++; }
            }
            res[skill] = { win: wins / N, left: wins ? left / wins : 0, s3: s3 / N };
        }
        rows.push([i + 1, L.name, L.moves, res]);
        ok(res[1].win >= 0.9, `L${i + 1} ${L.name}: strong bot wins ≥ 90% (${(res[1].win * 100).toFixed(0)}%)`);
        ok(res[0.4].win >= 0.7, `L${i + 1} ${L.name}: casual bot wins ≥ 70% (${(res[0.4].win * 100).toFixed(0)}%)`);
    });
    if (process.env.BALANCE) {
        console.log('\n  lvl name             moves | casual win  left  3★ | strong win  left  3★');
        for (const [n, name, moves, r] of rows) {
            const f = (x) => `${(x.win * 100).toFixed(0).padStart(3)}% ${x.left.toFixed(1).padStart(5)} ${(x.s3 * 100).toFixed(0).padStart(3)}%`;
            console.log(`  ${String(n).padStart(3)} ${name.padEnd(16)} ${String(moves).padStart(5)} | ${f(r[0.4])}    | ${f(r[1])}`);
        }
    }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
