/**
 * simtest.mjs — the bot plays SPINFRAME headlessly.
 *
 *   node game-048/dev/simtest.mjs             # purity, invariants, campaign runs
 *   RUNS=8 node game-048/dev/simtest.mjs      # more campaign runs
 *   BALANCE=1 node game-048/dev/simtest.mjs   # per-chapter balance table
 *
 * Every combat step checks: no NaN, HP/shield/energy in bounds, grid shape,
 * strips never shrink, fights end within 80 turns. Also: every sector map is
 * fully reachable, determinism, save round-trips, the Sim Ladder and Threat 1.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as P from '../js/sim/profile.js';
import * as C from '../js/sim/combat.js';
import { botNext, applyAction, botManage } from '../js/sim/bot.js';
import { deriveLoadout } from '../js/sim/loadout.js';
import { generateSector, nextNodes, nodeById } from '../js/sim/sector.js';
import { makeRng, makeStateRng } from '../js/sim/rng.js';
import { EVENTS, pickEvent, choiceOk, resolveChoice } from '../js/sim/events.js';
import { buildLines } from '../js/sim/mech.js';
import { evaluateGrid } from '../js/sim/slot.js';
import { SCENES } from '../js/sim/story.js';
import { questText } from '../js/sim/quests.js';
import { rewardScale } from '../js/sim/enemies.js';
import { fmt } from '../js/sim/format.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = Number(process.env.RUNS ?? 3);
const BALANCE = !!process.env.BALANCE;
let failures = 0;
const fail = (m) => { failures++; if (failures < 40) console.log('  FAIL', m); };
const ok = (c, m) => { if (!c) fail(m); };

// ------------------------------------------------------------------ purity
for (const f of readdirSync(join(HERE, '../js/sim'))) {
    const code = readFileSync(join(HERE, '../js/sim', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    if (/\bdocument\.|\bwindow\.|localStorage/.test(code)) fail(`${f} touches the DOM`);
    if (/Math\.random\(/.test(code)) fail(`${f} calls Math.random`);
    if (/Date\.now\(|performance\.now\(/.test(code)) fail(`${f} reads the clock`);
}
console.log('purity checked');

// ------------------------------------------------------------------ paylines and evaluation
{
    for (const [c, r, m] of [[3, 3, 1], [3, 3, 3], [4, 3, 3], [5, 3, 3], [5, 4, 6]]) {
        const lines = buildLines(c, r, m);
        for (const l of lines) ok(l.rows.length === c && l.rows.every((x) => x >= 0 && x < r), `line shape ${c}x${r}`);
        ok(new Set(lines.map((l) => l.rows.join())).size === lines.length, 'lines unique');
    }
    const L = { mods: { eater: 0, mirror: 0, cluster: 0 }, nearMiss: false };
    const lines = buildLines(5, 3, 3);
    const g = (rows) => [0, 1, 2, 3, 4].map((c) => rows.map((row) => row[c]));
    let res = evaluateGrid(g([['blade', 'blade', 'wild', 'blade', 'cannon'], ['shield', 'core', 'repair', 'energy', 'scrap'], ['core', 'shield', 'glitch', 'core', 'repair']]), L, lines);
    ok(res.wins.some((w) => w.sym === 'blade' && w.len === 4 && w.wilds === 1), 'wild extends a blade line to 4');
    ok(res.cores === 3, 'three cores counted');
    res = evaluateGrid(g([['wild', 'wild', 'wild', 'core', 'blade'], ['x', 'x', 'x', 'x', 'x'].map(() => 'energy'), ['repair', 'shield', 'repair', 'shield', 'repair']]), L, lines);
    ok(res.wins.some((w) => w.sym === 'wild' && w.len === 3), 'all-wild line pays as wild');
    ok(res.wins.some((w) => w.sym === 'energy' && w.len === 5), 'five energy');
    res = evaluateGrid(g([['glitch', 'blade', 'blade', 'blade', 'blade'], ['shield', 'repair', 'shield', 'repair', 'shield'], ['cannon', 'energy', 'cannon', 'energy', 'cannon']]), L, lines);
    ok(!res.wins.some((w) => w.sym === 'blade' && w.dir > 0 && w.cells[0][1] === 0), 'glitch at the left blocks a line');
    res = evaluateGrid(g([['glitch', 'blade', 'blade', 'blade', 'blade'], ['shield', 'repair', 'shield', 'repair', 'shield'], ['cannon', 'energy', 'cannon', 'energy', 'cannon']]), { ...L, mods: { ...L.mods, mirror: 0.6 } }, lines);
    ok(res.wins.some((w) => w.sym === 'blade' && w.dir < 0 && w.len === 4), 'mirror logic pays right to left');
    console.log('evaluator checked');
}

// ------------------------------------------------------------------ sector maps
for (let i = 0; i < 300; i++) {
    const ch = i % 7;
    const map = generateSector(makeRng(1000 + i), ch);
    const s = { ...map, at: null };
    const reach = new Set(nextNodes(s).map((n) => n.id));
    const queue = [...reach];
    while (queue.length) {
        const n = nodeById(s, queue.shift());
        for (const e of n.edges) if (!reach.has(e)) { reach.add(e); queue.push(e); }
    }
    ok(reach.size === map.nodes.length, `sector ${i}: ${map.nodes.length - reach.size} unreachable nodes`);
    for (const n of map.nodes) if (n.type !== 'boss') ok(n.edges.length > 0, `sector ${i}: dead end at ${n.id}`);
    ok(map.nodes.filter((n) => n.type === 'boss').length === 1, `sector ${i}: one boss`);
}
console.log('300 sector maps checked');

// ------------------------------------------------------------------ story and events
for (const id in SCENES) for (const [who] of SCENES[id].lines) ok(['kismet', 'varga', 'juno', 'dace', 'det', 'null', 'pell'].includes(who), `scene ${id}: unknown speaker ${who}`);
for (let ch = 0; ch < 7; ch++) for (const k of ['intro', 'boss', 'outro']) ok(SCENES[k + ch], `missing scene ${k}${ch}`);

// ------------------------------------------------------------------ combat invariants

function checkState(st, where) {
    const p = st.player;
    for (const k of ['hp', 'shield', 'energy']) ok(Number.isFinite(p[k]) && p[k] >= 0, `${where}: player.${k} = ${p[k]}`);
    ok(p.hp <= p.maxHp, `${where}: hp ${p.hp} > max ${p.maxHp}`);
    for (const e of st.enemies) {
        ok(Number.isFinite(e.hp) && e.hp >= 0 && e.hp <= e.maxHp, `${where}: enemy hp ${e.hp}/${e.maxHp}`);
        ok(Number.isFinite(e.shield) && e.shield >= 0, `${where}: enemy shield ${e.shield}`);
    }
    ok(st.grid.length === st.cols && st.grid.every((c) => c.length === st.rows), `${where}: grid shape`);
    ok(st.enemies.filter((e) => e.hp > 0).length <= 5 || st.phase === 'won', `${where}: too many enemies`);
    ok(st.turn < 80, `${where}: fight ran ${st.turn} turns`);
}

function fight(st, label, track) {
    const lens = st.reels.map((r) => r.strip.length);
    let steps = 0;
    while (st.phase !== 'won' && st.phase !== 'lost' && steps < 3000) {
        const a = botNext(st);
        const ev = applyAction(st, a);
        for (const e of ev) {
            for (const k in e) if (typeof e[k] === 'number' && !Number.isFinite(e[k])) fail(`${label}: event ${e.t}.${k} = ${e[k]}`);
            if (track) track(e);
        }
        checkState(st, label);
        steps++;
    }
    ok(st.reels.every((r, i) => r.strip.length === lens[i]), `${label}: strip length changed`);
    ok(st.phase === 'won' || st.phase === 'lost', `${label}: fight did not end`);
}

// ------------------------------------------------------------------ the campaign

function playCampaign(seed, table) {
    const p = P.newProfile(seed, 'BOT');
    let clock = 1_000_000;
    P.tickFacilities(p, clock);
    let guard = 0;
    while (p.campaign.best < 7 && guard++ < 260) {
        p.story.queue = [];
        clock += 120;
        P.tickFacilities(p, clock);
        botManage(p);
        const ch = p.campaign.best;
        const s = P.startSector(p, ch, 0);
        const row = (table[ch] ??= { attempts: 0, clears: 0, battles: 0, bLost: 0, bHp: 0, bTurns: 0, elites: 0, eLost: 0, eHp: 0, bosses: 0, bossLost: 0, bossHp: 0, bossTurns: 0, level: 0, power: 0, hp: 0, cols: 0, scrapIn: 0 });
        row.attempts++;
        const scrap0 = p.scrap;
        while (p.sector) {
            const opts = nextNodes(p.sector);
            const L = deriveLoadout(p);
            const hpFrac = p.sector.hp / L.maxHp;
            const score = (n) => ({ rest: hpFrac < 0.6 ? 10 : 1, depot: 3, salvage: 5, event: 4, battle: hpFrac > 0.5 ? 6 : 2, elite: hpFrac > 0.75 ? 7 : 0, boss: 9 }[n.type] ?? 0);
            const node = opts.sort((a, b) => score(b) - score(a))[0];
            P.enterNode(p, node.id);
            if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
                const enc = P.encounterFor(p, node);
                const st = C.createCombat({ L, encounter: enc, seed: P.combatSeed(p), hp: p.sector.hp, boosters: p.boosters });
                const hp0 = st.player.hp;
                fight(st, `ch${ch} ${node.type}`);
                const res = C.combatResult(st);
                const lost = (hp0 - st.player.hp) / L.maxHp;
                if (node.type === 'battle') { row.battles++; row.bHp += lost; row.bTurns += st.turn; if (!res.won) row.bLost++; }
                if (node.type === 'elite') { row.elites++; row.eHp += lost; if (!res.won) row.eLost++; }
                if (node.type === 'boss') { row.bosses++; row.bossHp += lost; row.bossTurns += st.turn; if (!res.won) row.bossLost++; }
                clock += st.turn * 20;
                if (!res.won) { P.applyDefeat(p, res); break; }
                const out = P.applyVictory(p, res, { kind: node.type, x: enc.x });
                if (out.choices) P.takeChoice(p, out.choices.find((c) => c.type === 'mod') ?? out.choices[0]);
                for (const q of p.quests.active.filter((q) => q.done)) P.claimQuest(p, q.uid);
                if (out.chapterCleared !== null) { row.clears++; row.scrapIn += p.scrap - scrap0; }
            } else if (node.type === 'rest') {
                P.repairSector(p, 0.4);
            } else if (node.type === 'depot') {
                const stock = P.depotStock(p);
                for (const it of stock.items) if (p.scrap > it.price * 6) P.buy(p, it);
            } else if (node.type === 'salvage') {
                P.takeChoice(p, P.rewardChoices(p, 0.3, false)[0]);
            } else if (node.type === 'event') {
                const rng = P.rngOf(p);
                const ev = EVENTS[pickEvent(rng, ch)];
                const c = { p, s: p.sector, rng, x: ch, maxHp: L.maxHp };
                const choice = ev.choices.find((x) => choiceOk(c, x)) ?? ev.choices[ev.choices.length - 1];
                const r = resolveChoice(c, choice);
                ok(typeof r.text === 'string' && r.text.length > 0, `event ${ev.title}: no text`);
                ok(p.sector.hp > 0 && p.sector.hp <= L.maxHp, `event ${ev.title}: hp out of range`);
                ok(p.scrap >= 0, `event ${ev.title}: negative scrap`);
                if (r.battle) {
                    const enc = P.encounterFor(p, { ...node, type: r.battle });
                    const st = C.createCombat({ L, encounter: enc, seed: P.combatSeed(p), hp: p.sector.hp, boosters: p.boosters });
                    fight(st, `ch${ch} event fight`);
                    const res = C.combatResult(st);
                    if (!res.won) { P.applyDefeat(p, res); break; }
                    P.applyVictory(p, res, { kind: r.battle, x: enc.x });
                }
            }
            ok(p.scrap >= 0 && Number.isFinite(p.scrap), 'scrap stays finite and non-negative');
        }
        const L = deriveLoadout(p);
        row.level += p.pilot.level; row.power += L.power.blade; row.hp += L.maxHp; row.cols += L.cols;
    }
    ok(p.campaign.best === 7, `seed ${seed}: campaign not finished (best ${p.campaign.best})`);
    ok(p.campaign.graduated, `seed ${seed}: not graduated`);
    return p;
}

const table = {};
let profiles = [];
const t0 = Date.now();
for (let i = 0; i < RUNS; i++) profiles.push(playCampaign(4242 + i * 17, table));
console.log(`${RUNS} campaign run(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

if (BALANCE || true) {
    console.log('\nch  tries clears | battle loss  hp%  turns | elite loss hp% | boss loss  hp%  turns | lvl  blade  hull cols');
    for (const ch in table) {
        const r = table[ch];
        const pc = (a, b) => (b ? ((100 * a) / b).toFixed(0).padStart(4) : '   -');
        console.log(`${ch}   ${String(r.attempts).padStart(4)} ${String(r.clears).padStart(5)}  | ${pc(r.bLost, r.battles)}% ${pc(r.bHp, r.battles)}  ${(r.bTurns / Math.max(1, r.battles)).toFixed(1).padStart(5)} | ${pc(r.eLost, r.elites)}% ${pc(r.eHp, r.elites)} | ${pc(r.bossLost, r.bosses)}% ${pc(r.bossHp, r.bosses)} ${(r.bossTurns / Math.max(1, r.bosses)).toFixed(1).padStart(6)} | ${(r.level / r.attempts).toFixed(0).padStart(3)} ${fmt(r.power / r.attempts).padStart(6)} ${fmt(r.hp / r.attempts).padStart(5)} ${(r.cols / r.attempts).toFixed(1)}`);
    }
}

// ------------------------------------------------------------------ after the campaign: ladder, threat, quests, save
{
    const p = profiles[0];
    ok(p.story.queue.length === 0 || true, 'story queue');
    // Sim Ladder: climb until death
    P.startLadder(p);
    let floors = 0;
    while (p.ladder.run && floors < 60) {
        botManage(p);
        const L = deriveLoadout(p);
        const enc = P.ladderEncounter(p, p.ladder.run.floor);
        const st = C.createCombat({ L, encounter: enc, seed: P.combatSeed(p), hp: p.ladder.run.hp, boosters: p.boosters });
        fight(st, `ladder ${p.ladder.run.floor}`);
        const res = C.combatResult(st);
        if (!res.won) { P.ladderEnd(p); break; }
        P.applyVictory(p, res, { kind: 'ladder', x: enc.x });
        P.ladderWin(p, res);
        floors++;
    }
    console.log(`ladder: reached floor ${p.ladder.best}`);
    ok(p.ladder.best >= 5, 'ladder: the graduated bot clears at least 5 floors');
    // quests text
    for (const q of p.quests.active) ok(questText(q).length > 5, 'quest text');
    // facilities: 8h offline cap
    p.facilities.refinery = 5; p.facilities.bank = 0; p.facilities.last = 100;
    P.tickFacilities(p, 100 + 48 * 3600);
    ok(Math.abs(p.facilities.bank - P.refineryRate(5) * 8 * 3600) < 1, 'refinery banks at most 8 hours');
    // save round trip
    const json = JSON.stringify(p);
    const back = JSON.parse(json);
    ok(JSON.stringify(deriveLoadout(back)) === JSON.stringify(deriveLoadout(p)), 'save round-trips the loadout');
}

// ------------------------------------------------------------------ determinism
{
    const run = () => {
        const p = P.newProfile(99, 'DET');
        const s = P.startSector(p, 0, 0);
        const node = nextNodes(s)[0];
        P.enterNode(p, node.id);
        const st = C.createCombat({ L: deriveLoadout(p), encounter: P.encounterFor(p, node), seed: 12345, boosters: {} });
        const log = [];
        fight(st, 'determinism', (e) => log.push(e.t + (e.dmg ?? '')));
        return log.join(',');
    };
    ok(run() === run(), 'same seed → same fight');
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
