/**
 * simtest.mjs — Alchemist's Lattice's rules, headless in Node. No browser, no framework.
 *
 *   node game-027/dev/simtest.mjs
 *   ONLY=purity,data,map,levels,rules,game,determinism,bot SEEDS=6 VERBOSE=1 node game-027/dev/simtest.mjs
 *
 * purity       js/sim/, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the clock
 * data         shapes, elements, recipes, foes, potions, skills; every scene's speakers, portraits and branches; every painting on disk
 * map          200 seeds × 4 chapters: the first node, the boss, every node reachable and leading on, a shop, no early or doubled elites
 * levels       generated levels: supply size and small-tile floor, deposits, the crucible, foes, residue that never completes a line
 * rules        placing, clearing, scoring, streaks, deposits, refinement, battle, items, skills, the deal and its mercy, stuck/jammed/out
 * game         travelling, finishing, rewards, resolve and the redrawn map, the shop, caches, the cauldron, skills, scenes, bosses, the ending
 * determinism  same seed and commands → same game; a save round trip mid-level plays on identically; bad saves are rejected
 * bot          whole campaigns at two skills on SEEDS seeds, with invariants after every command, and the balance table
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { N, HAND, RESOLVE } from '../js/config.js';
import { SHAPES, SHAPE_IDS, START_SHAPES, RARITY_TIER, sizeOf, rotateCells } from '../js/sim/data/shapes.js';
import { ELEMENTS, ELEMENT_IDS } from '../js/sim/data/elements.js';
import { FOES, ROSTER } from '../js/sim/data/foes.js';
import { POTIONS, ITEMS, ENHANCEMENTS, GRADES } from '../js/sim/data/potions.js';
import { SKILLS } from '../js/sim/data/skills.js';
import { CHARACTERS, SCRIPTS, CACHE_SCENES } from '../js/sim/data/story.js';
import { makeMap, node, nextIds } from '../js/sim/map.js';
import { makeLevel } from '../js/sim/levelgen.js';
import { newLevel, actLevel, canPlace, fitsAnywhere, progress, idx, elIndex, live, gradeOf, nearHarvest } from '../js/sim/level.js';
import { newGame, act, choices, serialize, deserialize, canLearn } from '../js/sim/game.js';
import { makeBot, runCommand, levelCommand } from '../js/sim/bot.js';
import { jobs, SHEETS } from './art/prompts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 6);
const VERBOSE = !!process.env.VERBOSE;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('  ✗', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
const section = (name, f) => { if (ONLY.length && !ONLY.includes(name)) return; const p0 = pass, f0 = fail; f(); console.log(`${fail > f0 ? '✗' : '✓'} ${name}: ${pass - p0} passed${fail > f0 ? `, ${fail - f0} failed` : ''}`); };

/** A bare level built by hand: an empty board, a given hand, a long supply of motes. */
function bare({ kind = 'explore', hand = ['mono', 'mono', 'mono'], supply = 30, deposits = [], refine = null, battle = null, objective = { kind: 'lines', target: 99 }, skills = [], items = {}, residue = [] } = {}) {
    const def = { kind, name: 'Test', chapter: 1, objective, residue, deposits, refine, battle, mercy: 0,
        supply: [...hand.map((s) => ({ shape: s, el: 'salt' })), ...Array.from({ length: supply }, () => ({ shape: 'mono', el: 'ember' }))] };
    return newLevel(def, { skills, items, seed: 1 });
}
/** Fill cells directly (as if tiles had been placed there). */
const fill = (L, cells, el = 'salt') => { for (const c of cells) L.cells[c] = elIndex(el); };
const row = (r, skip = []) => [...Array(N)].map((_, c) => idx(c, r)).filter((i) => !skip.includes(i % N));
const col = (c, skip = []) => [...Array(N)].map((_, r) => idx(c, r)).filter((i) => !skip.includes(Math.floor(i / N)));
const types = (L) => L.events.map((e) => e.type);

// ====================================================================================== purity
section('purity', () => {
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        for (const bad of [/\bdocument\./, /\bwindow\./, /Math\.random/, /Date\.now/, /new Date/, /\bperformance\./, /localStorage/, /from 'three'/, /requestAnimationFrame/, /setTimeout/]) {
            ok(!bad.test(src), `${f} uses ${bad}`);
        }
    }
});

// ====================================================================================== data
section('data', () => {
    for (const s of Object.values(SHAPES)) {
        // connected, at the origin, back after four turns
        const set = new Set(s.cells.map(([x, y]) => `${x},${y}`));
        const seen = new Set([`${s.cells[0][0]},${s.cells[0][1]}`]);
        const stack = [s.cells[0]];
        while (stack.length) { const [x, y] = stack.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); } } }
        ok(seen.size === s.cells.length, `${s.id} is connected`);
        ok(Math.min(...s.cells.map((c) => c[0])) === 0 && Math.min(...s.cells.map((c) => c[1])) === 0, `${s.id} starts at the origin`);
        let c = s.cells; for (let k = 0; k < 4; k++) c = rotateCells(c);
        eq(c.map(String).sort(), s.cells.map(String).sort(), `${s.id} four turns`);
        ok(RARITY_TIER[s.rarity] >= 1, `${s.id} rarity`);
        for (const e of Object.keys(s.recipe)) ok(ELEMENTS[e], `${s.id} recipe element ${e}`);
        // a recipe only asks for elements its cauldron can process
        for (const e of Object.keys(s.recipe)) ok(['common', 'uncommon', 'rare', 'exotic'].indexOf(ELEMENTS[e].tier) < RARITY_TIER[s.rarity] + 1, `${s.id} recipe ${e} fits its tier`);
    }
    ok(START_SHAPES.every((id) => SHAPES[id].cells.length <= 3), 'the starting tiles are small');
    for (const f of Object.values(FOES)) { ok(f.hp > 0 && f.dmg > 0, `${f.id} stats`); ok(f.pattern.every((a) => ['attack', 'advance', 'harden'].includes(a)), `${f.id} pattern`); }
    for (const r of Object.values(ROSTER)) for (const k of r) ok(FOES[k], `roster ${k}`);
    for (const p of Object.values(POTIONS)) for (const e of [p.main, p.second, p.forbid].filter(Boolean)) ok(ELEMENTS[e], `${p.id} ${e}`);
    for (const E of Object.values(ENHANCEMENTS)) for (const e of Object.keys(E.cost)) ok(ELEMENTS[e], `${E.id} cost`);
    for (const s of Object.values(SKILLS)) for (const r of s.req) ok(SKILLS[r], `${s.id} requires ${r}`);
    // scenes
    for (const [id, beats] of Object.entries(SCRIPTS)) {
        ok(beats.some((b) => b.end), `${id} ends`);
        for (const b of beats) {
            if (b.speaker) { ok(CHARACTERS[b.speaker], `${id} speaker ${b.speaker}`); ok(CHARACTERS[b.speaker]?.expressions.includes(b.portrait), `${id} ${b.speaker} has the ${b.portrait} portrait`); }
            if (b.choice) for (const c of b.choice) ok(beats.some((x) => x.id === c.next), `${id} branch ${c.next}`);
        }
    }
    for (const list of Object.values(CACHE_SCENES)) for (const id of list) ok(SCRIPTS[id], `cache scene ${id}`);
    for (let ch = 1; ch <= 3; ch++) for (const s of [`ch${ch}-boss-taunt`, `ch${ch}-boss-clear`]) ok(SCRIPTS[s], s);
    for (const s of ['ch1-intro', 'ch2-intro', 'ch3-intro', 'ch1-complete', 'ch2-complete', 'ending', 'open-road', 'first-cauldron', 'first-refine', 'first-battle', 'ch1-first-harvest', 'shop-pellerin-intro']) ok(SCRIPTS[s], s);
    // the paintings
    const want = ['title', 'workshop', 'map', 'cauldron', 'shop', 'ending', 'table', 'coin',
        ...ELEMENT_IDS.map((e) => 'el-' + e), ...Object.keys(ITEMS).map((i) => 'item-' + i), ...Object.keys(POTIONS).map((p) => 'potion-' + p),
        ...Object.values(FOES).filter((f) => f.art).map((f) => 'foe-' + f.id),
        ...Object.values(CHARACTERS).flatMap((c) => c.expressions.map((e) => `cast-${c.id}-${e}`))];
    for (const w of want) ok(fs.existsSync(path.join(ROOT, 'art', w + '.webp')), `art/${w}.webp`);
    ok(jobs.length === 22, `22 fal jobs (${jobs.length})`);
    for (const ids of Object.values(SHEETS)) for (const id of ids.filter(Boolean)) ok(want.includes(id), `sheet cell ${id} is used`);
});

// ====================================================================================== map
section('map', () => {
    for (let s = 1; s <= 200; s++) for (let ch = 1; ch <= 4; ch++) {
        const M = makeMap(s, ch);
        const all = M.layers.flat();
        ok(node(M, M.entry).type === 'explore', 'entry explores');
        ok(node(M, M.boss).type === 'boss' && !M.edges.some((e) => e.from === M.boss), 'boss is terminal');
        ok(all.some((n) => n.type === 'shop'), `a shop (${s}, ${ch})`);
        ok(!M.layers.slice(1, 3).flat().some((n) => n.type === 'elite'), 'no elite in the first two layers');
        for (const e of M.edges) ok(!(node(M, e.from).type === 'elite' && node(M, e.to).type === 'elite'), 'no elite after an elite');
        // every node reachable from the entry, and the boss reachable from every node
        const reach = new Set([M.entry]); const q = [M.entry];
        while (q.length) for (const t of nextIds(M, q.shift())) if (!reach.has(t)) { reach.add(t); q.push(t); }
        ok(reach.size === all.length, 'all reachable');
        for (const n of all) { if (n.type === 'boss') continue; ok(nextIds(M, n.id).length > 0, 'every node leads on'); }
        if (ch === 1) ok(M.layers[1].some((n) => n.type === 'refine') && M.layers[1].some((n) => n.type === 'battle'), 'chapter 1 offers a refinement and a battle early');
    }
    eq(makeMap(9, 2), makeMap(9, 2), 'maps are seeded');
});

// ====================================================================================== levels
section('levels', () => {
    for (let s = 1; s <= 60; s++) for (const type of ['explore', 'refine', 'battle', 'elite', 'boss']) for (const ch of [1, 2, 3, 5]) {
        const def = makeLevel({ type, chapter: ch, seed: s * 31 + ch, first: false }, { shapes: SHAPE_IDS, enh: [] });
        ok(def.supply.length % HAND === 0 && def.supply.length >= HAND * 4, 'supply in whole hands');
        const small = def.supply.filter((t) => SHAPES[t.shape].cells.length <= 2).length / def.supply.length;
        ok(small >= 0.3, `small-tile floor (${small.toFixed(2)})`);
        const taken = new Set();
        for (const d of def.deposits) {
            ok(d.cells.length >= 2 && d.layers >= 1 && d.layers <= 3, 'deposit shape');
            for (const c of d.cells) { ok(c >= 0 && c < N * N && !taken.has(c), 'deposits on the board, apart'); taken.add(c); }
        }
        if (def.objective.kind === 'harvest') ok(def.objective.ids.every((id) => def.deposits.some((d) => d.id === id)), 'harvest ids exist');
        if (def.refine) { ok(def.refine.crucible.length >= 6, 'crucible'); ok(def.refine.conds.some((c) => c.type === 'lines'), 'a lines condition'); }
        if (def.battle) {
            const cells = def.battle.foes.flatMap((f) => f.cells);
            ok(new Set(cells).size === cells.length, 'foes apart');
            for (const f of def.battle.foes) ok(FOES[f.kind], 'foe kind');
        }
        // residue never completes a line, never on a foe or a deposit
        const L = newLevel(def, { skills: [], items: {}, seed: 1 });
        for (let r = 0; r < N; r++) ok(row(r).some((c) => !L.cells[c] && L.foeAt[c] < 0), 'no full row at the start');
        for (let c = 0; c < N; c++) ok(col(c).some((i) => !L.cells[i] && L.foeAt[i] < 0), 'no full column at the start');
        for (const r of def.residue) ok(L.depAt[r.c] < 0, 'residue off deposits');
        ok(live(L), 'starts live');
    }
    const first = makeLevel({ type: 'explore', chapter: 1, seed: 5, first: true }, { shapes: START_SHAPES, enh: [] });
    ok(first.name === 'The First Stir' && first.objective.kind === 'lines' && first.deposits.length === 1, 'the first level is gentle');
    const stab = makeLevel({ type: 'refine', chapter: 2, seed: 7 }, { shapes: SHAPE_IDS, enh: ['stabilizer', 'potency', 'buffer'] });
    ok(stab.refine.boost === 1 && stab.refine.forgive === 1 && stab.refine.conds.filter((c) => c.type === 'combo' || c.type === 'streak').every((c) => c.target <= 1), 'enhancements apply');
});

// ====================================================================================== rules
section('rules', () => {
    // placing
    let L = bare({ hand: ['triH', 'domV', 'mono'] });
    ok(!canPlace(L, SHAPES.triH.cells, 7, 0), 'off the edge');
    ok(actLevel(L, { t: 'place', i: 0, x: 0, y: 0 }), 'place');
    ok(!actLevel(L, { t: 'place', i: 1, x: 0, y: 0 }), 'overlap refused');
    ok(types(L).includes('invalid'), 'an invalid event');
    ok(!actLevel(L, { t: 'place', i: 0, x: 3, y: 3 }), 'an empty slot');
    eq(L.score, 6, 'two points a cell');
    // a row, a column, a cross
    L = bare(); fill(L, row(4, [0]));
    L.events.length = 0;
    actLevel(L, { t: 'place', i: 0, x: 0, y: 4 });
    const cl = L.events.find((e) => e.type === 'clear');
    ok(cl && cl.rows[0] === 4 && cl.combo === 1, 'a row clears');
    ok(row(4).every((c) => !L.cells[c]), 'the row is empty');
    eq(cl.points, 9 * 10, 'nine cells × 10');
    L = bare(); fill(L, [...row(2, [5]), ...col(5, [2])]);
    actLevel(L, { t: 'place', i: 0, x: 5, y: 2 });
    const cr = L.events.find((e) => e.type === 'clear');
    ok(cr.rows.length === 1 && cr.cols.length === 1 && cr.combo === 2 && cr.cleared.length === 17, 'a cross clears both, sharing its cell');
    eq(cr.points, 17 * 10 * 2, 'a double is worth twice');
    // streak
    L = bare(); fill(L, [...row(0, [0]), ...row(1, [0])]);
    actLevel(L, { t: 'place', i: 0, x: 0, y: 0 });
    actLevel(L, { t: 'place', i: 1, x: 0, y: 1 });
    eq(L.streak, 2, 'streak counts');
    ok(L.events.filter((e) => e.type === 'clear')[1].points === 9 * 10 + 25, 'the streak bonus');
    actLevel(L, { t: 'place', i: 2, x: 5, y: 5 });
    eq(L.streak, 0, 'a placement that clears nothing ends the streak');
    // the deal: whole hands from the top of the supply
    L = bare({ hand: ['mono', 'mono', 'mono'], supply: 5 });
    for (let k = 0; k < 3; k++) actLevel(L, { t: 'place', i: k, x: k * 2, y: 8 });
    ok(L.hand.every(Boolean) && L.supply.length === 2, 'a new hand when all three are placed');
    ok(types(L).includes('deal'), 'deal event');
    // out of tiles
    L = bare({ supply: 0 });
    for (let k = 0; k < 3; k++) actLevel(L, { t: 'place', i: k, x: k * 2, y: 8 });
    ok(L.status === 'failed' && L.reason === 'out', 'out of tiles');
    // jammed vs stuck
    L = bare({ hand: ['tetH', 'tetH', 'tetH'] });
    for (let r = 0; r < N; r++) fill(L, row(r).filter((c) => (c % N) % 3 !== 0), 'ash');
    L.events.length = 0;
    actLevel(L, { t: 'place', i: 0, x: 0, y: 0 });     // illegal: re-checks nothing; force a check by an empty move
    const jam = bare({ hand: ['tetH', 'tetH', 'tetH'] });
    for (let r = 0; r < N; r++) fill(jam, row(r).filter((c) => (c % N) % 3 !== 0), 'ash');
    const J = newLevel({ kind: 'explore', name: 'J', chapter: 1, objective: { kind: 'lines', target: 9 }, residue: [...Array(N * N).keys()].filter((c) => (c % N) % 3 !== 0).map((c) => ({ c, el: 'ash' })), supply: [0, 1, 2].map(() => ({ shape: 'tetH', el: 'salt' })), mercy: 0 }, { skills: [], items: {}, seed: 2 });
    ok(J.status === 'failed' && J.reason === 'jammed', 'jammed with no rescue');
    const S = newLevel({ kind: 'explore', name: 'S', chapter: 1, objective: { kind: 'lines', target: 9 }, residue: [...Array(N * N).keys()].filter((c) => (c % N) % 3 !== 0).map((c) => ({ c, el: 'ash' })), supply: [0, 1, 2].map(() => ({ shape: 'tetH', el: 'salt' })), mercy: 0 }, { skills: [], items: { vial: 1 }, seed: 2 });
    ok(S.status === 'stuck', 'stuck while an item could help');
    ok(actLevel(S, { t: 'item', id: 'vial', i: 0 }) && S.status === 'play' && S.hand[0].cells.length === 1, 'the Transmute Vial makes a Mote');
    const C = newLevel({ kind: 'explore', name: 'C', chapter: 1, objective: { kind: 'lines', target: 9 }, residue: [...Array(N * N).keys()].filter((c) => (c % N) % 3 !== 0).map((c) => ({ c, el: 'ash' })), supply: [0, 1, 2].map(() => ({ shape: 'tetH', el: 'salt' })), mercy: 0 }, { skills: [], items: { vial: 1 }, seed: 2 });
    ok(actLevel(C, { t: 'concede' }) && C.status === 'failed' && C.reason === 'conceded', 'conceding a stuck level');
    // mercy: a tile that can't fit is swapped for one further down that can
    const M = newLevel({ kind: 'explore', name: 'M', chapter: 1, objective: { kind: 'lines', target: 9 }, residue: [...Array(N * N).keys()].filter((c) => (c % N) % 2 === 1).map((c) => ({ c, el: 'ash' })), supply: [{ shape: 'domH', el: 'salt' }, { shape: 'mono', el: 'salt' }, { shape: 'mono', el: 'salt' }, { shape: 'domV', el: 'salt' }], mercy: 3 }, { skills: [], items: {}, seed: 2 });
    ok(M.hand.every((h) => h && fitsAnywhere(M, h.cells)), 'mercy finds a hand that fits');

    // deposits: one layer per placement, harvested when bare
    L = bare({ deposits: [{ id: 'd', el: 'dew', qty: 2, cells: [idx(3, 4), idx(4, 4), idx(4, 5)], layers: 2 }], objective: { kind: 'harvest', ids: ['d'] } });
    fill(L, [...row(4, [0]), ...col(4, [0, 4])]);
    actLevel(L, { t: 'place', i: 0, x: 0, y: 4 });
    eq(L.deposits[0].cover, 1, 'a placement peels one layer, however many lines cross the deposit');
    ok(nearHarvest(L, L.deposits[0]), 'one clear from harvest');
    fill(L, row(4, [0]));
    actLevel(L, { t: 'place', i: 1, x: 0, y: 4 });
    ok(L.deposits[0].harvested && L.harvested[0] === 'd', 'harvested');
    ok(L.status === 'won', 'the harvest objective is met');
    ok(L.events.some((e) => e.type === 'harvest' && e.qty === 2), 'harvest event with its quantity');
    L = bare({ deposits: [{ id: 'd', el: 'dew', qty: 2, cells: [idx(3, 4)], layers: 1 }], skills: ['vein'], items: { salts: 1 }, objective: { kind: 'harvest', ids: ['d'] } });
    ok(actLevel(L, { t: 'item', id: 'salts', x: 3, y: 4 }) && L.deposits[0].harvested && L.events.find((e) => e.type === 'harvest').qty === 3, 'Reveal Salts strips a layer; Vein Sense adds one');

    // refinement
    const conds = [{ type: 'lines', el: 'ember', target: 2 }, { type: 'combo', target: 2 }, { type: 'forbid', el: 'dew' }];
    L = bare({ kind: 'refine', refine: { potion: 'ember-draught', conds, crucible: [idx(4, 4)], boost: 0, forgive: 0 }, objective: { kind: 'brew' } });
    fill(L, row(0, [0]), 'ember');
    actLevel(L, { t: 'place', i: 0, x: 0, y: 0 });
    eq(L.refine.conds[0].n, 1, 'an ember-rich line counts');
    fill(L, [...row(1, [0]), ...col(0, [1])], 'ember');
    actLevel(L, { t: 'place', i: 1, x: 0, y: 1 });
    ok(L.refine.conds[0].met && L.refine.conds[1].met, 'lines and the double met');
    ok(L.status === 'won' && GRADES.includes(L.refine.grade), `brewed (${L.refine.grade})`);
    L = bare({ kind: 'refine', refine: { potion: 'ember-draught', conds: conds.map((c) => ({ ...c })), crucible: [], boost: 0, forgive: 1 }, objective: { kind: 'brew' } });
    fill(L, row(0, [0]), 'dew');
    actLevel(L, { t: 'place', i: 0, x: 0, y: 0 });
    ok(L.events.some((e) => e.type === 'forgiven') && L.refine.conds[2].violated === 0, 'the buffer forgives one forbidden line');
    fill(L, row(1, [0]), 'dew');
    actLevel(L, { t: 'place', i: 1, x: 0, y: 1 });
    eq(L.refine.conds[2].violated, 1, 'the next one is a violation');
    eq(gradeOf({ quality: 90, boost: 0, conds: [{ type: 'forbid', violated: 1 }] }), 'pure', 'a violation lowers the grade');
    eq(gradeOf({ quality: 40, boost: 1, conds: [] }), 'pure', 'potency raises it');
    const streakL = bare({ kind: 'refine', refine: { potion: 'moonfire', conds: [{ type: 'streak', target: 2 }, { type: 'lines', el: 'salt', target: 9 }], crucible: [], boost: 0, forgive: 0 }, objective: { kind: 'brew' } });
    fill(streakL, [...row(0, [0]), ...row(1, [0])], 'ember');
    actLevel(streakL, { t: 'place', i: 0, x: 0, y: 0 });
    ok(!streakL.refine.conds[0].met, 'one clear is not a streak');
    actLevel(streakL, { t: 'place', i: 1, x: 0, y: 1 });
    ok(streakL.refine.conds[0].met, 'two in a row is');

    // battle
    const B = (foes, every = 2, hp = 20) => bare({ kind: 'battle', battle: { hp, every, foes }, objective: { kind: 'defeat' } });
    L = B([{ kind: 'imp', cells: [idx(4, 0)] }]);
    ok(L.foeAt[idx(4, 0)] === 0 && !canPlace(L, [[0, 0]], 4, 0), 'a foe blocks its cell');
    fill(L, row(0, [0, 4]));
    actLevel(L, { t: 'place', i: 0, x: 0, y: 0 });
    ok(L.status === 'won' && L.events.some((e) => e.type === 'defeat'), 'a line through it: 8 damage, a 6-hp imp falls');
    L = B([{ kind: 'vinelord', cells: [idx(4, 0), idx(5, 0)] }]);
    fill(L, row(0, [0, 4, 5]));
    actLevel(L, { t: 'place', i: 0, x: 0, y: 0 });
    const hit = L.events.find((e) => e.type === 'hit');
    ok(hit && hit.dmg === 8 * 2 - 1 && L.battle.foes[0].cells.length === 1, 'two cells hit, armour subtracted, cut back to one');
    // foe turns: attack, advance, harden
    L = B([{ kind: 'imp', cells: [idx(0, 0)] }], 1, 5);
    actLevel(L, { t: 'place', i: 0, x: 8, y: 8 });
    ok(L.events.some((e) => e.type === 'foe' && e.act === 'attack') && L.battle.hp === 2, 'the imp attacks');
    actLevel(L, { t: 'place', i: 1, x: 7, y: 8 });
    ok(L.events.some((e) => e.type === 'foe' && e.act === 'advance') && L.battle.foes[0].cells.length === 2, 'then grows');
    actLevel(L, { t: 'place', i: 2, x: 6, y: 8 });
    ok(L.status === 'failed' && L.reason === 'defeated', 'defeated at zero health');
    L = bare({ kind: 'battle', battle: { hp: 30, every: 1, foes: [{ kind: 'hulk', cells: [idx(0, 0)] }] }, objective: { kind: 'defeat' }, items: { tonic: 1 } });
    actLevel(L, { t: 'place', i: 0, x: 8, y: 8 });
    ok(L.battle.foes[0].armor === 2, 'the hulk hardens');
    L.battle.hp = 10;
    ok(actLevel(L, { t: 'item', id: 'tonic' }) && L.battle.hp === 20, 'the Hearth Tonic heals 10');

    // items and skills
    L = bare({ items: { dissolvent: 1, catalyst: 1 } });
    fill(L, [idx(2, 2)]);
    ok(actLevel(L, { t: 'item', id: 'dissolvent', x: 2, y: 2 }) && !L.cells[idx(2, 2)], 'Dissolvent');
    ok(!actLevel(L, { t: 'item', id: 'dissolvent', x: 2, y: 2 }), 'none left');
    const before = L.supply.length;
    ok(actLevel(L, { t: 'item', id: 'catalyst' }) && L.supply.length === before && L.hand.every(Boolean), 'Catalyst: the hand goes back and a new one is drawn');
    eq(L.used, { dissolvent: 1, catalyst: 1 }, 'items used are recorded');
    L = bare({ hand: ['triH', 'mono', 'mono'], skills: ['swap', 'affinity', 'reclaim'] });
    ok(actLevel(L, { t: 'skill', id: 'swap', i: 0 }) && sizeOf(L.hand[0].cells).h === 3 && L.swapCd === 6, 'Tile Swap turns a tile');
    ok(!actLevel(L, { t: 'skill', id: 'swap', i: 0 }), 'then cools down');
    ok(actLevel(L, { t: 'skill', id: 'affinity' }) && !actLevel(L, { t: 'skill', id: 'affinity' }), 'Catalyst Affinity once a level');
    const n0 = L.supply.length;
    ok(actLevel(L, { t: 'skill', id: 'reclaim' }) && L.supply.length === n0, 'Reclaim returns the hand');
    L = bare({ hand: ['triH', 'triH', 'triH'], supply: 9, skills: ['steady'] });
    L.supply = Array.from({ length: 9 }, (_, k) => ({ shape: k === 7 ? 'mono' : 'triH', el: 'salt' }));
    for (let k = 0; k < 3; k++) actLevel(L, { t: 'place', i: k, x: 0, y: k * 2 });
    ok(L.hand.some((h) => h && h.cells.length <= 2), 'Steady Hand deals a small tile');
    L = bare({ skills: ['overflow', 'surge'] });
    fill(L, [...row(0, [0]), ...row(1, [0]), ...row(2, [0]), ...col(0, [0, 1, 2])]);
    L.hand[0] = { uid: 99, shape: 'triV', el: 'salt', cells: SHAPES.triV.cells.map((c) => [...c]) };
    actLevel(L, { t: 'place', i: 0, x: 0, y: 0 });
    const big = L.events.find((e) => e.type === 'clear');
    ok(big.combo === 4 && big.points === (big.cleared.length * 10 * 4) + 60 * 2, 'Overflow: +60 a line past the second');
});

// ====================================================================================== game
section('game', () => {
    const G = newGame(42);
    eq(G.queue, ['ch1-intro'], 'the story begins');
    ok(!act(G, { t: 'go', id: 'n1_0' }), 'cannot skip ahead');
    act(G, { t: 'seen', id: 'ch1-intro' });
    eq(choices(G), ['n0_0'], 'the first node');
    ok(act(G, { t: 'go', id: 'n0_0' }) && G.level && G.level.name === 'The First Stir', 'the first level');
    ok(!act(G, { t: 'finish' }), 'cannot finish a live level');
    ok(!act(G, { t: 'learn', id: 'bendA' }), 'no cauldron mid-level');
    // win it by force
    const L = G.level;
    L.lines = 99; L.status = 'won'; L.harvested = []; L.used = { dissolvent: 1 };
    ok(act(G, { t: 'finish' }) && G.at === 'n0_0' && G.reward.won && G.gold > 40 && G.xp > 0, 'rewards');
    ok(!G.items.dissolvent, 'used items leave the satchel');
    // a failure costs resolve, three redraw the map
    for (let k = 0; k < RESOLVE; k++) {
        const id = choices(G)[0];
        act(G, { t: 'go', id, enh: [] });
        if (!G.level) { k--; if (G.shop) act(G, { t: 'leave' }); continue; }
        G.level.status = 'failed'; G.level.reason = 'jammed';
        act(G, { t: 'finish' });
    }
    ok(G.resolve === RESOLVE && G.at === null && G.stats.resets === 1 && G.reward.reset, 'resolve spent: the map is redrawn');
    // the cauldron and skills
    G.stores.salt = 5; G.stores.ember = 5;
    ok(canLearn(G, 'bendA') && act(G, { t: 'learn', id: 'bendA' }) && G.shapes.includes('bendA') && G.stores.salt === 4, 'learn a tile type');
    ok(!act(G, { t: 'learn', id: 'tetH' }), 'a rare type needs the Tin cauldron');
    G.xp = 500;
    ok(!act(G, { t: 'train', id: 'steady' }), 'skills need their prerequisite');
    ok(act(G, { t: 'train', id: 'swap' }) && act(G, { t: 'train', id: 'steady' }) && G.xp === 500 - 80 - 120, 'train skills');
    // the shop
    const S = newGame(7);
    const shopNode = S.map.layers.flat().find((n) => n.type === 'shop');
    S.at = S.map.edges.find((e) => e.to === shopNode.id).from;
    ok(act(S, { t: 'go', id: shopNode.id }) && S.shop, 'a shop opens');
    ok(S.queue.includes('shop-pellerin-intro'), "Pellerin's introduction");
    S.gold = 100;
    const price = S.shop.stock.find((x) => x.id === 'dissolvent').price;
    ok(act(S, { t: 'buy', id: 'dissolvent' }) && S.gold === 100 - price && S.items.dissolvent === 2, 'buy');
    act(S, { t: 'buy', id: 'dissolvent' });
    ok(!act(S, { t: 'buy', id: 'dissolvent' }), 'two of each');
    ok(!act(S, { t: 'go', id: choices({ ...S, shop: null })[0] }), 'no travel from inside the shop');
    ok(act(S, { t: 'leave' }) && !S.shop, 'leave');
    // a cache
    const K = newGame(11);
    const cacheNode = K.map.layers.flat().find((n) => n.type === 'cache');
    if (cacheNode) {
        K.at = K.map.edges.find((e) => e.to === cacheNode.id).from;
        const g0 = K.gold;
        ok(act(K, { t: 'go', id: cacheNode.id }) && K.gold > g0 && K.reward.cache && K.queue.includes('cache-spirit-1'), 'a cache gives and tells');
    }
    // a refinement takes its enhancements from the stores
    const R = newGame(3);
    R.stores.salt = 1; R.stores.ember = 0;
    const rn = R.map.layers[1].find((n) => n.type === 'refine');
    R.at = 'n0_0';
    ok(!act(R, { t: 'go', id: rn.id, enh: ['potency'] }), 'unaffordable enhancements refused');
    ok(act(R, { t: 'go', id: rn.id, enh: ['stabilizer'] }) && R.stores.salt === 0 && R.level.kind === 'refine', 'a refinement with its stabilizer');
    ok(R.queue.includes('first-refine'), 'the first refinement is explained');
    // bosses: a cauldron tier, the next chapter, the ending
    const Bo = newGame(5);
    for (let ch = 1; ch <= 4; ch++) {
        Bo.queue.length = 0;
        const boss = Bo.map.boss;
        Bo.at = Bo.map.edges.find((e) => e.to === boss).from;
        ok(act(Bo, { t: 'go', id: boss }) && Bo.level.boss, `chapter ${ch} boss`);
        if (ch <= 3) ok(Bo.queue.includes(`ch${ch}-boss-taunt`), 'its taunt');
        Bo.level.status = 'won';
        act(Bo, { t: 'finish' });
        eq(Bo.chapter, ch + 1, 'the next chapter');
        ok(Bo.at === null && Bo.resolve === RESOLVE, 'a fresh map');
        if (ch < 3) ok(Bo.queue.includes(`ch${ch + 1}-intro`), 'the next chapter is introduced');
        if (ch === 3) ok(Bo.won && Bo.queue.includes('ending') && Bo.reward.ending, 'the ending');
        if (ch === 4) ok(Bo.queue.includes('open-road'), 'the open road');
    }
    eq(Bo.tier, 4, 'the Gold cauldron');
});

// ====================================================================================== determinism
section('determinism', () => {
    const play = (seed, n, cut = -1) => {
        let G = newGame(seed);
        const bot = makeBot({ skill: 0.8, seed: 9 });
        for (let k = 0; k < n; k++) {
            if (k === cut) G = deserialize(JSON.parse(JSON.stringify(serialize(G))));
            const c = runCommand(G, bot);
            if (!c) break;
            act(G, c);
            G.events.length = 0; if (G.level) G.level.events.length = 0;
        }
        return serialize(G);
    };
    eq(play(5, 400), play(5, 400), 'same seed and commands, same game');
    // mid-level round trips
    for (const cut of [37, 120, 260]) eq(play(5, 400, cut), play(5, 400), `a save at command ${cut} plays on identically`);
    let threw = 0;
    for (const bad of [null, { v: 2 }, { v: 1 }, { v: 1, map: {}, shapes: [], stores: {}, level: { cells: 'x' } }]) { try { deserialize(bad); } catch { threw++; } }
    eq(threw, 4, 'bad saves are rejected');
});

// ====================================================================================== bot
section('bot', () => {
    const rows = [];
    for (const skill of [1, 0.3]) {
        const R = { won: 0, cmds: 0, levels: 0, fails: 0, resets: 0, kinds: {} };
        for (let s = 1; s <= SEEDS; s++) {
            const G = newGame(1000 + s);
            const bot = makeBot({ skill, seed: s });
            let n = 0, bad = 0;
            while (!G.won && n < 60000) {
                const c = runCommand(G, bot);
                if (!c) { bad++; break; }
                if (c.t === 'finish') { const L = G.level; const k = L.boss ? 'boss' : L.elite ? 'elite' : L.kind; R.kinds[k] ||= [0, 0]; R.kinds[k][L.status === 'won' ? 0 : 1]++; }
                if (!act(G, c)) { bad++; console.log('  rejected', JSON.stringify(c)); break; }
                G.events.length = 0;
                const L = G.level;
                if (L) {
                    L.events.length = 0;
                    // invariants: a tile and a foe never share a cell; covers match their deposits; health in range
                    for (let i = 0; i < N * N; i++) if (L.cells[i] && L.foeAt[i] >= 0) bad++;
                    for (const d of L.deposits) for (const c2 of d.cells) if (L.cover[c2] !== d.cover) bad++;
                    if (L.battle && (L.battle.hp < 0 || L.battle.hp > L.battle.maxHp)) bad++;
                }
                if (G.gold < 0 || Object.values(G.stores).some((v) => v < 0) || G.xp < 0) bad++;
                n++;
            }
            ok(!bad, `skill ${skill} seed ${s}: no invariant broken`);
            ok(G.won, `skill ${skill} seed ${s}: earns the guild mark`);
            if (G.won) R.won++;
            R.cmds += n; R.levels += G.stats.levels; R.fails += G.stats.fails; R.resets += G.stats.resets;
            if (VERBOSE) console.log(`   skill ${skill} seed ${s}: won ${G.won}, ${G.stats.levels} levels, ${G.stats.fails} lost, ${G.stats.resets} maps redrawn, ${G.shapes.length} tile types, ${G.skills.length} skills`);
        }
        rows.push({ skill, ...R });
    }
    console.log('   bot     won   levels  lost  redrawn  by kind (won/lost)');
    for (const r of rows) console.log(`   ${String(r.skill).padEnd(6)}  ${r.won}/${SEEDS}   ${(r.levels / SEEDS).toFixed(1).padStart(5)}  ${(r.fails / SEEDS).toFixed(1).padStart(4)}  ${(r.resets / SEEDS).toFixed(1).padStart(6)}   ${Object.entries(r.kinds).map(([k, [w, l]]) => `${k} ${w}/${l}`).join(', ')}`);
    // balance bands: the perfect bot rarely loses, the weak one loses more but still finishes
    ok(rows[0].fails / SEEDS <= 6, `the best bot loses few levels (${(rows[0].fails / SEEDS).toFixed(1)} a run)`);
    ok(rows[1].fails / SEEDS <= 12, `the careless bot still finishes without endless losses (${(rows[1].fails / SEEDS).toFixed(1)} a run)`);
    ok(rows.every((r) => r.levels / SEEDS >= 15), 'a campaign is at least fifteen levels');
});

console.log(`\n${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
