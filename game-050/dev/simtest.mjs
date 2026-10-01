/**
 * simtest.mjs — headless checks against the real simulation (no browser).
 *
 *   node game-050/dev/simtest.mjs                 everything below, 2 seeds × 2 classes
 *   BALANCE=1 node game-050/dev/simtest.mjs       + a per-wing balance table
 *   SEEDS=4 CLS=mage node game-050/dev/simtest.mjs
 *
 * 1. Purity: js/sim never imports three.js, touches the DOM, or calls Math.random / Date.
 * 2. Board: thousands of random moves, spells and potions; after every action the board is
 *    full, ids unique, no match left standing and a move exists — and replaying the event
 *    stream onto a mirror (exactly what the view does) reproduces the board gem for gem.
 * 3. Determinism: the same seed plays the same battle.
 * 4. Campaign: a bot plays new games to the ending with each class: manages the town
 *    (idle time is simulated), gear, stats, quests, potions, spell ranks and books, and
 *    fights every node. Invariants checked every battle; a save/load round-trip at every
 *    wing. Fails if a run cannot finish.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng } from '../js/sim/rng.js';
import { createBoard, findMoves, boardProblems, W } from '../js/sim/board.js';
import { makeBattle, doSwap, doCast, doPotion, monsterTurn } from '../js/sim/battle.js';
import { makeMonster, FAMILY_IDS } from '../js/sim/monsters.js';
import { newProfile, heroSide, startBattle, finishBattle, tick, nextStory, catchUp } from '../js/sim/game.js';
import { botBattleAction, botManage, botPlan } from '../js/sim/bot.js';
import { WINGS, generateWingMap, openNodes } from '../js/sim/regions.js';
import { sceneFor } from '../js/sim/story.js';
import { BOOKS } from '../js/sim/books.js';
import { POTION_IDS, SPELLS, SPELL_IDS } from '../js/sim/data.js';
import { makeItem } from '../js/sim/items.js';
import { makeQuest } from '../js/sim/quests.js';

const HERE = dirname(fileURLToPath(import.meta.url));
let fails = 0;
const fail = (m) => { fails++; if (fails < 60) console.log('  FAIL', m); };
const ok = (c, m) => { if (!c) fail(m); };

// ------------------------------------------------------------------ 1. Purity
for (const f of readdirSync(join(HERE, '../js/sim'))) {
    const code = readFileSync(join(HERE, '../js/sim', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    if (/from\s+['"]three/.test(code)) fail(`${f} imports three`);
    if (/\bdocument\.|\bwindow\.|localStorage/.test(code)) fail(`${f} touches the DOM`);
    if (/Math\.random\(/.test(code)) fail(`${f} calls Math.random`);
    if (/Date\.now\(|new Date\(/.test(code)) fail(`${f} reads the clock`);
}
console.log('1. purity checked');

// ------------------------------------------------------------------ 2. Board + event replay
function mirrorOf(b) {
    const m = new Map();
    b.cells.forEach((c, i) => m.set(c.id, { x: i % W, y: (i / W) | 0, t: c.t, sp: c.sp }));
    return m;
}
function applyEvents(m, ev) {
    for (const e of ev) {
        if (e.k === 'swap') {
            const A = m.get(e.ids[0]), B = m.get(e.ids[1]);
            [A.x, A.y, B.x, B.y] = [B.x, B.y, A.x, A.y];
        } else if (e.k === 'clear') for (const c of e.cells) { if (!m.has(c.id)) throw new Error('clear of unknown id'); m.delete(c.id); }
        else if (e.k === 'make' || e.k === 'morph') for (const c of e.cells || [e]) { const g = m.get(c.id); if (!g) throw new Error('make/morph unknown id'); g.t = c.t; g.sp = c.sp; }
        else if (e.k === 'fall') {
            for (const mv of e.moves) { const g = m.get(mv.id); if (!g || g.y !== mv.y0 || g.x !== mv.x) throw new Error('fall from wrong place'); g.y = mv.y1; }
            for (const s of e.spawns) m.set(s.id, { x: s.x, y: s.y, t: s.t, sp: s.sp });
        } else if (e.k === 'shuffle') { m.clear(); for (const c of e.cells) m.set(c.id, { x: c.x, y: c.y, t: c.t, sp: c.sp }); }
    }
}
function sameAsBoard(m, b) {
    if (m.size !== b.cells.length) return `mirror has ${m.size} gems`;
    for (const [id, g] of m) {
        const c = b.cells[g.y * W + g.x];
        if (!c || c.id !== id || c.t !== g.t || c.sp !== g.sp) return `mismatch at ${g.x},${g.y}`;
    }
    return null;
}

{
    let actions = 0, extras = 0, prisms = 0, bombs = 0, shuffles = 0, cascades = 0;
    for (let s = 0; s < 60; s++) {
        const r = makeRng(1000 + s);
        const mon = makeMonster(r, { level: 1 + (s % 30), family: FAMILY_IDS[s % FAMILY_IDS.length], rank: s % 7 === 0 ? 'guardian' : 'normal' });
        const hero = newProfile({ cls: s % 2 ? 'mage' : 'warrior', seed: s });
        const side = heroSide(hero);
        // give the hero every spell so every op gets exercised
        side.spells = SPELL_IDS.map((id) => ({ id, rank: 1 + (s % 5) }));
        side.manaCap = 99;
        const bt = makeBattle(side, mon.side, 777 + s, { potions: Object.fromEntries(POTION_IDS.map((id) => [id, 2])) });
        const mirror = mirrorOf(bt.board);
        for (let k = 0; k < 120 && !bt.over; k++) {
            let ev;
            if (bt.turn === 'p') {
                const roll = r.next();
                if (roll < 0.12) { for (const c of ['fire', 'water', 'leaf', 'spark']) bt.sides.p.mana[c] = 40; ev = doCast(bt, r.int(0, side.spells.length - 1)); }
                else if (roll < 0.17) ev = doPotion(bt, r.pick(POTION_IDS));
                else { const ms = findMoves(bt.board); const mv = r.pick(ms); ev = doSwap(bt, mv.a, mv.b); }
            } else ev = monsterTurn(bt);
            actions++;
            for (const e of ev) {
                if (e.k === 'extra') extras++;
                if (e.k === 'shuffle') shuffles++;
                if (e.k === 'clear') { if (e.step > 1) cascades++; for (const bl of e.blasts) { if (bl.kind === 'prism') prisms++; if (bl.kind === 'bomb') bombs++; } }
                if (e.k === 'dmg' || e.k === 'heal') ok(Number.isFinite(e.n) && Number.isFinite(e.hp), `non-finite ${e.k}`);
            }
            try { applyEvents(mirror, ev); } catch (err) { fail(`seed ${s} action ${k}: ${err.message}`); break; }
            const diff = sameAsBoard(mirror, bt.board);
            if (diff) { fail(`seed ${s} action ${k}: event replay ${diff}`); break; }
            const probs = boardProblems(bt.board);
            if (probs.length) { fail(`seed ${s} action ${k}: ${probs.join(', ')}`); break; }
            for (const sd of Object.values(bt.sides)) {
                ok(sd.hp >= 0 && sd.hp <= sd.maxHp, `hp out of range ${sd.hp}/${sd.maxHp}`);
                for (const c of ['fire', 'water', 'leaf', 'spark']) ok(sd.mana[c] >= 0 && sd.mana[c] <= sd.manaCap, `mana out of range ${c}=${sd.mana[c]}`);
            }
        }
    }
    console.log(`2. board: ${actions} actions, ${cascades} cascades, ${extras} extra turns, ${bombs} bombs, ${prisms} prism blasts, ${shuffles} shuffles — replay matched`);
}

// ------------------------------------------------------------------ 3. Determinism
function playBattle(p, ctx, maxActions = 900) {
    const run = startBattle(p, ctx);
    const bt = run.bt;
    let n = 0;
    while (!bt.over && n++ < maxActions) {
        if (bt.turn === 'p') {
            const a = botBattleAction(bt);
            let ev = [];
            if (a.potion) ev = doPotion(bt, a.potion);
            else if (a.cast !== undefined) ev = doCast(bt, a.cast);
            if (!ev.length) { const mv = a.move || findMoves(bt.board)[0]; doSwap(bt, mv.a, mv.b); }
        } else monsterTurn(bt);
    }
    if (!bt.over) fail(`battle did not end in ${maxActions} actions (${run.mon.name} L${run.mon.level})`);
    return run;
}
{
    const a = newProfile({ cls: 'mage', seed: 42 }), b = newProfile({ cls: 'mage', seed: 42 });
    const ra = playBattle(a, { type: 'node', wing: 0, node: 0 }), rb = playBattle(b, { type: 'node', wing: 0, node: 0 });
    ok(JSON.stringify(ra.bt.board) === JSON.stringify(rb.bt.board) && ra.bt.turnNo === rb.bt.turnNo, 'same seed → same battle');
    console.log(`3. determinism: battle replayed identically (${ra.bt.turnNo} turns, ${ra.bt.over})`);
}

// ------------------------------------------------------------------ Data sanity
for (const w of WINGS) for (const f of w.bestiary) ok(FAMILY_IDS.includes(f), `wing ${w.id} family ${f}`);
for (let s = 0; s < 30; s++) for (let wi = 0; wi < WINGS.length; wi++) {
    const map = generateWingMap(s, wi);
    // every node reachable from the entrance
    const cleared = {};
    let open = openNodes(map, cleared), grew = true;
    while (grew) { grew = false; for (const id of open) if (!cleared[id]) { cleared[id] = true; grew = true; } open = openNodes(map, cleared); }
    ok(Object.keys(cleared).length === map.nodes.length, `seed ${s} wing ${wi}: unreachable nodes`);
}
for (const b of BOOKS) ok(typeof b.bonus(1) === 'string', `book ${b.id}`);
for (const id of SPELL_IDS) ok(SPELLS[id].desc && SPELLS[id].ops.length, `spell ${id}`);
for (let s = 0; s < 200; s++) { const it = makeItem(makeRng(s), { cls: s % 2 ? 'mage' : 'warrior', iL: 1 + (s % 40) }); ok(it.name && Object.values(it.mods).every(Number.isFinite), `item ${s}`); }
console.log('   data: maps reachable, items finite, books and spells described');

// ------------------------------------------------------------------ 4. Campaign
const SEEDS = +(process.env.SEEDS || 2);
const CLASSES = process.env.CLS ? [process.env.CLS] : ['mage', 'warrior'];
const table = {};
const rows = [];
let totalBattles = 0;
for (const cls of CLASSES) for (let s = 1; s <= SEEDS; s++) {
    let p = newProfile({ cls, seed: s * 7919, now: 0 });
    let now = 0, battles = 0, lostInRow = 0, lastWing = -1;
    const t0 = Date.now();
    while (!p.won && battles < 2500) {
        while (nextStory(p)) { /* read */ }
        botManage(p, now);
        const plan = botPlan(p);
        if (plan.done) { fail(`${cls} seed ${s}: nothing left to do in wing ${p.wingOpen}`); break; }
        const wingBefore = p.wingOpen;
        const run = playBattle(p, plan.battle);
        const bt = run.bt;
        const res = finishBattle(p, run);
        battles++;
        // simulated time: ~8 s per turn, plus a 2-hour break every 12 battles
        now += bt.turnNo * 2 * 8000 + 30000;
        if (battles % 12 === 0) { now += 2 * 3600000; catchUp(p, now); }
        tick(p, now);
        lostInRow = res.win ? 0 : lostInRow + 1;
        // invariants
        ok(Number.isFinite(p.xp) && p.xp >= 0, 'xp finite');
        for (const [k, v] of Object.entries(p.res)) ok(Number.isFinite(v) && v >= -1e-6, `res ${k}=${v}`);
        for (const [k, v] of Object.entries(p.potions)) ok(v >= 0, `potion ${k}=${v}`);
        ok(p.slots.length <= 5, 'slot count');
        // per-wing stats
        const wi = plan.battle.wing ?? -1;
        const key = `${cls}`;
        const T = (table[key] ||= {});
        const row = (T[wi] ||= { battles: 0, losses: 0, bossTries: 0, bossLosses: 0, turns: 0, hpLost: 0, lvlIn: p.level, lvlOut: 0, minutes: 0, patrols: 0 });
        row.battles++; row.turns += bt.turnNo; row.hpLost += 1 - bt.sides.p.hp / bt.sides.p.maxHp;
        if (!res.win) row.losses++;
        if (run.mon.boss) { row.bossTries++; if (!res.win) row.bossLosses++; if (process.env.BOSSLOG) console.log(`   ${cls} L${p.level} vs ${run.mon.name} L${run.mon.level}: ${res.win ? 'win' : 'LOSS'} t${bt.turnNo} hp ${bt.sides.p.hp}/${bt.sides.p.maxHp} foe ${bt.sides.e.hp}/${bt.sides.e.maxHp}`); }
        if (plan.battle.type === 'patrol') row.patrols++;
        row.lvlOut = p.level;
        row.minutes = Math.round(now / 60000);
        if (p.wingOpen !== wingBefore || lastWing === -1) {
            // save/load round trip at each new wing
            const copy = JSON.parse(JSON.stringify(p));
            ok(JSON.stringify(copy) === JSON.stringify(p), 'save round-trip');
            p = copy;
            lastWing = p.wingOpen;
        }
        for (const k of Object.keys(p.story.seen)) ok(sceneFor(k), `missing scene ${k}`);
    }
    totalBattles += battles;
    ok(p.won, `${cls} seed ${s}: did not finish (${battles} battles, wing ${p.wingOpen}, level ${p.level})`);
    rows.push(`   xp sources ${JSON.stringify(p.counters.xpFrom)} wins ${p.counters.wins} losses ${p.counters.losses} quests ${p.counters.questsDone || 0}`);
    rows.push(`   ${cls.padEnd(8)} seed ${s}: ${p.won ? 'WON ' : 'STUCK'} in ${battles} battles, level ${p.level}, ${Math.round(now / 3600000 * 10) / 10} h game time, books ${Object.keys(p.books).length}, gold ${p.res.gold}, ${(Date.now() - t0)} ms`);
    // quests sanity
    for (let i = 0; i < 50; i++) { const q = makeQuest(p, makeRng(i)); ok(q.title && q.desc && q.reward.gold > 0, 'quest'); }
}
console.log('4. campaign');
for (const r of rows) console.log(r);

if (process.env.BALANCE) {
    for (const [key, T] of Object.entries(table)) {
        console.log(`\n   ${key} (summed over ${SEEDS} seeds)`);
        console.log('   wing          battles patrols loss%  boss tries/losses  turns  hpLost%  level in→out  game min');
        for (const [wi, r] of Object.entries(T)) {
            const name = wi === '-1' ? 'bounties' : WINGS[wi].short;
            console.log(`   ${name.padEnd(13)} ${String(r.battles).padStart(7)} ${String(r.patrols).padStart(7)} ${String(Math.round(100 * r.losses / r.battles)).padStart(5)}  ${String(r.bossTries).padStart(10)}/${String(r.bossLosses).padEnd(6)} ${String(Math.round(r.turns / r.battles)).padStart(5)}  ${String(Math.round(100 * r.hpLost / r.battles)).padStart(7)}   ${String(r.lvlIn).padStart(4)}→${String(r.lvlOut).padEnd(6)} ${String(r.minutes).padStart(8)}`);
        }
    }
}

console.log(fails ? `\n${fails} FAILURE(S)` : `\nALL PASS (${totalBattles} campaign battles)`);
process.exit(fails ? 1 : 0);
