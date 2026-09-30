/**
 * simtest.mjs — the bot plays whole runs of Ashes & Aces headlessly.
 *
 *   node game-047/dev/simtest.mjs            # invariants + a quick table
 *   RUNS=30 node game-047/dev/simtest.mjs    # more runs
 *   BALANCE=1 node game-047/dev/simtest.mjs  # per-world win-rate table
 *
 * Every combat step checks: no NaN, HP within bounds, every card uid in exactly
 * one zone, the table never holds an arcana, combats end within 80 turns.
 * Also checks determinism (same seed → same run) and the purity of js/sim/.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as R from '../js/sim/run.js';
import { createCombat, combatResult } from '../js/sim/combat.js';
import { botTurn, cardWant } from '../js/sim/bot.js';
import { canUpgrade, canEnchant } from '../js/sim/run.js';
import { cardChips, cardValue } from '../js/sim/cards.js';
import { HERO_KEYS } from '../js/sim/heroes.js';
import { RELICS } from '../js/sim/relics.js';
import { generateMap } from '../js/sim/map.js';
import { WORLDS, FLOORS } from '../js/sim/rules.js';
import { evaluate } from '../js/sim/poker.js';

const HERE = dirname(fileURLToPath(import.meta.url));
let failures = 0;
const fail = (m) => { failures++; if (failures < 40) console.log('  FAIL', m); };

// ------------------------------------------------------------------ purity
for (const f of readdirSync(join(HERE, '../js/sim'))) {
    const code = readFileSync(join(HERE, '../js/sim', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    if (/from\s+['"]three/.test(code)) fail(`${f} imports three`);
    if (/\bdocument\.|\bwindow\.|localStorage/.test(code)) fail(`${f} touches the DOM`);
    if (/Math\.random\(/.test(code)) fail(`${f} calls Math.random`);
}

// ------------------------------------------------------------------ poker evaluator
const C = (s) => {
    const m = s.match(/^(10|[2-9JQKA])([SCDH])$/);
    if (s === 'JK') return { kind: 'play', joker: true, rank: 0 };
    if (s === 'X') return { kind: 'ash', rank: 0 };
    const r = { J: 11, Q: 12, K: 13, A: 14 }[m[1]] ?? Number(m[1]);
    return { kind: 'play', rank: r, suit: m[2] };
};
const hand = (s) => evaluate(s.split(' ').map(C));
const expect = (s, k) => { const got = hand(s); if (got !== k) fail(`evaluate(${s}) = ${got}, expected ${k}`); };
expect('2S 3S 4S 5S 6S', 'straightFlush');
expect('10H JH QH KH AH', 'royalFlush');
expect('AS 2C 3D 4H 5S', 'straight');
expect('10S JC QD KH AS', 'straight');
expect('2S 5S 9S JS KS', 'flush');
expect('7S 7C 7D 2H 2S', 'fullHouse');
expect('7S 7C 7D 7H 2S', 'fourKind');
expect('7S 7C 2D 2H 9S', 'twoPair');
expect('7S 7C 2D 3H 9S', 'pair');
expect('7S 8C 2D 3H KS', 'high');
expect('7S 7C JK 2H 9S', 'threeKind');
expect('7S 7C 7D JK JK', 'fiveKind');
expect('2S 3S JK 5S 6S', 'straightFlush');
expect('2S 3S X 5S 6S', 'high');
expect('7S 7C X 7H 9S', 'threeKind');
expect('7S 7C 8D 8H JK', 'fullHouse');
expect('QS KS AS 2S 3S', 'flush');

// ------------------------------------------------------------------ maps
for (let s = 1; s <= 20; s++) {
    for (let w = 0; w < WORLDS; w++) {
        const m = generateMap(s * 7919, w);
        if (m.floors.length !== FLOORS) fail(`map ${s}/${w}: ${m.floors.length} floors`);
        for (let f = 1; f < FLOORS; f++) if (!m.floors[f - 1].length) fail(`map ${s}/${w}: empty floor ${f}`);
        // every node reachable from the start and reaches the boss
        const seen = new Set(m.startIds);
        const stack = [...m.startIds];
        while (stack.length) { const id = stack.pop(); for (const n of m.nodes[id].next) if (!seen.has(n)) { seen.add(n); stack.push(n); } }
        for (const id in m.nodes) if (!seen.has(id)) fail(`map ${s}/${w}: ${id} unreachable`);
        for (const id in m.nodes) if (id !== m.bossId && !m.nodes[id].next.length) fail(`map ${s}/${w}: ${id} dead end`);
        for (const id of m.floors[4]) if (m.nodes[id].type !== 'treasure') fail(`map ${s}/${w}: floor 5 not treasure`);
        for (const id of m.floors[8]) if (m.nodes[id].type !== 'rest') fail(`map ${s}/${w}: floor 9 not rest`);
    }
}

// ------------------------------------------------------------------ combat invariants
function checkCombat(st, deckUids) {
    const zones = [st.draw, st.hand, st.discard, st.exhaust, st.board.map((b) => b.card).filter(Boolean)];
    const seen = new Map();
    for (const z of zones) for (const c of z) seen.set(c.uid, (seen.get(c.uid) ?? 0) + 1);
    for (const [u, n] of seen) if (n > 1) fail(`uid ${u} in ${n} zones`);
    for (const u of deckUids) if (!seen.has(u)) fail(`deck card ${u} lost`);
    for (const b of st.board) if (b.card && b.card.kind === 'arcana') fail('arcana on table');
    const p = st.player;
    if (!Number.isFinite(p.hp) || !Number.isFinite(p.ward) || p.hp > p.maxHp) fail(`bad player hp ${p.hp}/${p.maxHp} ward ${p.ward}`);
    for (const e of st.enemies) if (!Number.isFinite(e.hp) || !Number.isFinite(e.ward) || e.hp > e.maxHp) fail(`bad enemy ${e.name} hp ${e.hp}/${e.maxHp}`);
}

// ------------------------------------------------------------------ run bot
function decide(run, rng) {
    const p = run.pending;
    // picks first
    while (run.picks.length) {
        const pk = run.picks[0];
        const cands = R.pickable(run);
        if (!cands.length) { R.skipPick(run); continue; }
        let pick;
        if (pk.kind === 'remove') pick = cands.reduce((b, c) => (c.kind === 'ash' ? c : b.kind === 'ash' ? b : (cardValue(c) < cardValue(b) ? c : b)), cands[0]);
        else pick = cands.reduce((b, c) => (cardValue(c) > cardValue(b) ? c : b), cands[0]);
        R.resolvePick(run, pick.uid);
    }
    return p;
}

let combatTurns = 0, combats = 0, maxTurns = 0;
const bal = {}; // `${world}:${kind}` → { n, lost, turns, hpLoss }
const worldDeaths = Array(WORLDS).fill(0);
const worldWins = Array(WORLDS).fill(0);

function playRun(seed, cls, { maxRekindles = 30, verbose = false } = {}) {
    const run = R.newRun(seed, cls);
    const rng = R.makeRng(seed ^ 0xabc);
    run.story = [];
    let steps = 0, rekindles = 0;
    const trace = [];
    while (run.phase !== 'done' && steps++ < 5000) {
        run.story = [];
        if (run.phase === 'dead') {
            worldDeaths[run.world]++;
            if (rekindles >= maxRekindles) break;
            rekindles++;
            R.rekindle(run);
            continue;
        }
        if (run.phase === 'ending') { R.chooseEnding(run, R.availableEndings(run)[rng.int(0, R.availableEndings(run).length - 1)]); break; }
        if (run.phase === 'map') {
            const opts = R.availableNodes(run);
            const map = R.mapOf(run);
            const score = (id) => {
                const t = map.nodes[id].type;
                const hpf = run.hp / run.maxHp;
                return ({ rest: hpf < 0.55 ? 9 : 2, shop: run.gold > 160 ? 7 : 2, elite: hpf > 0.75 ? 6 : 0, event: 4, battle: 3.5, treasure: 5, boss: 5 }[t] ?? 1) + rng.next();
            };
            const id = opts.reduce((b, x) => (score(x) > score(b) ? x : b), opts[0]);
            R.enterNode(run, id);
            // interlude first
            const il = R.CHAPTERS_INTERLUDE?.(run);
            void il;
            if (run.flags[`interlude${run.world}`] && !run.flags[`interludeDone${run.world}`]) {
                run.flags[`interludeDone${run.world}`] = true;
                R.chooseInterlude(run, rng.int(0, 2));
                decide(run, rng);
            }
            trace.push(id);
            continue;
        }
        const p = run.pending;
        if (!p) { fail('node with no pending'); break; }
        decide(run, rng);
        switch (p.type) {
            case 'combat': {
                const o = R.combatOptions(run);
                const st = createCombat(o);
                const uids = run.deck.map((c) => c.uid);
                let t = 0;
                while ((st.phase === 'player' || st.phase === 'enemy') && t++ < 80) {
                    botTurn(st);
                    checkCombat(st, uids);
                    st.events.length = 0;
                }
                if (t >= 80) fail(`combat ran 80 turns (w${run.world} f${p.floor} ${p.kind})`);
                combats++; combatTurns += st.turn; maxTurns = Math.max(maxTurns, st.turn);
                const res = combatResult(st);
                const bk = `${run.world}:${p.kind}`;
                const b = (bal[bk] ??= { n: 0, lost: 0, turns: 0, hpLoss: 0 });
                b.n++; b.turns += st.turn; if (!res.won) b.lost++;
                b.hpLoss += Math.max(0, o.hp - res.hp) / o.maxHp;
                if (res.won && p.kind === 'boss') worldWins[run.world]++;
                R.finishCombat(run, res);
                if (verbose) console.log(`  w${run.world + 1} f${p.floor} ${p.kind.padEnd(6)} ${res.won ? 'WIN ' : 'LOSS'} turns ${st.turn} hp ${res.hp}/${run.maxHp} deck ${run.deck.length} relics ${run.relics.length}`);
                break;
            }
            case 'reward': {
                R.takeRewardRelic(run);
                R.takeRewardRelic(run);
                R.takeRewardElixir(run);
                const best = p.cards.map((c, i) => [cardWant(c, run.deck.length), i]).sort((a, b) => b[0] - a[0])[0];
                if (best && best[0] > 0) R.takeRewardCard(run, best[1]); else R.skipRewardCard(run);
                R.leaveNode(run);
                break;
            }
            case 'event': {
                if (!p.done) {
                    const ok = p.ev.choices.map((c, i) => i).filter((i) => !p.ev.choices[i].cost || run.gold >= p.ev.choices[i].cost);
                    R.chooseEvent(run, rng.pick(ok));
                    decide(run, rng);
                    if (p.cardOffer) R.takeOfferCard(run, 0);
                    if (p.after) { R.beginEventFight(run); break; }
                }
                R.leaveNode(run);
                break;
            }
            case 'shop': {
                const s = p.stock;
                if (run.deck.some((c) => c.kind === 'ash') || run.deck.length > 22) { if (R.buyPurge(run)) decide(run, rng); }
                s.relics.forEach((it, i) => { if (run.gold >= it.price + 20) R.buyRelic(run, i); });
                s.cards.forEach((it, i) => { if (run.gold >= it.price + 40 && cardWant(it.card, run.deck.length) > 10) R.buyCard(run, i); });
                s.elixirs.forEach((it, i) => { if (run.gold >= it.price + 60) R.buyElixir(run, i); });
                R.leaveNode(run);
                break;
            }
            case 'rest':
                if (run.hp < run.maxHp * 0.6) R.rest(run); else R.temper(run);
                decide(run, rng);
                R.leaveNode(run);
                break;
            case 'treasure':
                R.openTreasure(run);
                R.leaveNode(run);
                break;
            default: fail(`unknown pending ${p.type}`); R.leaveNode(run);
        }
        // invariants on the run
        if (!Number.isFinite(run.hp) || run.hp > run.maxHp || run.gold < 0) fail(`bad run state hp ${run.hp}/${run.maxHp} gold ${run.gold}`);
        for (const r of run.relics) if (!RELICS[r]) fail(`unknown relic ${r}`);
        if (JSON.stringify(run).length > 400000) fail('save too big');
    }
    return { run, rekindles, trace };
}

// ------------------------------------------------------------------ determinism
{
    const a = playRun(1234, 'knight'), b = playRun(1234, 'knight');
    if (JSON.stringify(a.trace) !== JSON.stringify(b.trace) || a.run.hp !== b.run.hp || a.run.world !== b.run.world) fail('same seed diverged');
    // save/load round trip mid-run
    const r1 = R.newRun(99, 'witch');
    const r2 = JSON.parse(JSON.stringify(r1));
    if (!R.validateRun(r2)) fail('save does not validate');
}

// ------------------------------------------------------------------ campaign
const RUNS = Number(process.env.RUNS ?? 6);
const t0 = Date.now();
const results = [];
for (let i = 0; i < RUNS; i++) {
    const cls = HERO_KEYS[i % 3];
    const { run, rekindles } = playRun(1000 + i * 17, cls, { verbose: !!process.env.VERBOSE });
    results.push({ cls, world: run.world + 1, floor: run.floor, done: run.phase === 'done', rekindles, deck: run.deck.length, relics: run.relics.length, ending: run.ending, best: run.stats.bestHand, lines: run.stats.lines });
}
console.log(`\n${RUNS} runs in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${combats} combats, avg ${(combatTurns / Math.max(1, combats)).toFixed(1)} turns (max ${maxTurns})`);
for (const r of results) console.log(`  ${r.cls.padEnd(7)} ${r.done ? 'FINISHED' : `stopped w${r.world} f${r.floor}`}  rekindles ${String(r.rekindles).padStart(2)}  deck ${r.deck} relics ${r.relics} best ${r.best} ending ${r.ending}`);
console.log('  deaths by world:', worldDeaths.join(' '));
console.log('  boss wins by world:', worldWins.join(' '));

if (process.env.BALANCE) {
    console.log('\n  world | battle: n  loss%  turns  hp-lost% | elite: n loss% turns hp% | boss: n loss% turns hp%');
    for (let w = 0; w < WORLDS; w++) {
        const cell = (k) => { const b = bal[`${w}:${k}`]; if (!b) return '   -'; return `${String(b.n).padStart(4)} ${String(Math.round(100 * b.lost / b.n)).padStart(4)}% ${(b.turns / b.n).toFixed(1).padStart(5)} ${String(Math.round(100 * b.hpLoss / b.n)).padStart(4)}%`; };
        console.log(`  ${String(w + 1).padStart(5)} | ${cell('battle')} | ${cell('elite')} | ${cell('boss')}`);
    }
}
if (failures) { console.log(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nall checks passed');
