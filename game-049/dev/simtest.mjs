/**
 * simtest.mjs — headless checks against the real simulation.
 *
 *   node game-049/dev/simtest.mjs                 bots play full runs (all three heroes), invariants checked every turn
 *   BALANCE=1 node game-049/dev/simtest.mjs       per-world table: deaths, turns, levels, HP and oil
 *   SEEDS=6 FLOORS=100 node game-049/dev/simtest.mjs
 *
 * Also: purity of js/sim (no three, DOM or Math.random), determinism, save/load
 * round-trips mid-run, and that every floor 1–100 generates and validates.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newRun, serialize, deserialize, rekindle, drainEvents, pstats, autoExplore, visibleHostiles } from '../js/sim/game.js';
import { botStep } from '../js/sim/bot.js';
import { buildLevel } from '../js/sim/dungeon.js';
import { makeRng, hashSeed } from '../js/sim/rng.js';
import { worldOf, WORLDS } from '../js/sim/worlds.js';
import { T, TP } from '../js/sim/tiles.js';
import { SPECIES } from '../js/sim/monsters.js';
import { distanceMap } from '../js/sim/path.js';

const HERE = dirname(fileURLToPath(import.meta.url));
let fails = 0;
const fail = (m) => { fails++; console.log('  FAIL', m); };
const ok = (c, m) => { if (!c) fail(m); };

// 1. Purity.
for (const f of readdirSync(join(HERE, '../js/sim'))) {
    const code = readFileSync(join(HERE, '../js/sim', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    if (/from\s+['"]three/.test(code)) fail(`${f} imports three`);
    if (/\bdocument\.|\bwindow\.|localStorage/.test(code)) fail(`${f} touches the DOM`);
    if (/Math\.random\(/.test(code) && f !== 'bot.js') fail(`${f} calls Math.random`);
}
console.log('purity checked');

// 2. Every floor generates; stairs reachable; data references valid.
for (const w of WORLDS.slice(1)) for (const s of w.bestiary) ok(SPECIES[s], `world ${w.id} species ${s}`);
for (let f = 1; f <= 100; f++) {
    for (let s = 0; s < 3; s++) {
        const lv = buildLevel(makeRng(hashSeed(s, f)), f, worldOf(f));
        const D = distanceMap(lv, [[lv.start.x, lv.start.y]], (i) => TP[lv.tiles[i]].pass || lv.tiles[i] === T.DOOR);
        if (!lv.boss) ok(D[lv.down.y * lv.w + lv.down.x] > 0, `floor ${f} seed ${s}: stairs unreachable`);
    }
}
console.log('levels checked');

// 3. Bot runs.
const SEEDS = +(process.env.SEEDS || 2);
const FLOORS = +(process.env.FLOORS || 100);
const table = {};
Math.random = (() => { const r = makeRng(12345); return r.next; })();
function play(seed, cls) {
    let run = newRun({ seed, cls, mode: 'lantern' });
    let steps = 0, lastFloor = 0, floorTurns = 0, rek = 0, minHp = 1, pots = 0, bossHp = 0;
    const t0 = Date.now();
    while (steps++ < 400000) {
        if (run.over) {
            if (run.won) break;
            const w = worldOf(run.floor);
            (table[w] ??= { deaths: 0, floors: 0, turns: 0, lvl: 0, n: 0 }).deaths++;
            if (process.env.DEATHS) console.log(`   death: ${cls} floor ${run.dead.floor} by ${run.dead.cause} (lvl ${run.p.lvl})`);
            if (rek++ > 25 || !rekindle(run)) break;
            continue;
        }
        botStep(run);
        drainEvents(run);
        if (run.floor !== lastFloor) {
            if (lastFloor) {
                const w = worldOf(lastFloor); const r = (table[w] ??= { deaths: 0, floors: 0, turns: 0, lvl: 0, n: 0 });
                r.floors++; r.turns += floorTurns; r.lvl += run.p.lvl; r.minHp = (r.minHp || 0) + minHp; r.pots = (r.pots || 0) + run.stats.potions - pots;
                if (lastFloor % 10 === 0) { r.boss = (r.boss || 0) + bossHp; r.bossN = (r.bossN || 0) + 1; }
            }
            lastFloor = run.floor; floorTurns = 0; minHp = 1; pots = run.stats.potions; bossHp = 0;
            if (run.floor > FLOORS) break;
            // Save/load round-trip at every floor start.
            const json = serialize(run);
            const back = deserialize(json);
            ok(back && serialize(back) === json, `seed ${seed} floor ${run.floor}: save round-trip`);
            run = back;
        }
        floorTurns++;
        { const f = run.p.hp / pstats(run).hpMax; if (f < minHp) minHp = f; if (run.lv.boss) bossHp = Math.max(bossHp, 1 - f); }
        // Invariants.
        const p = run.p;
        if (!Number.isFinite(p.hp) || !Number.isFinite(p.oil)) { fail(`NaN hero at floor ${run.floor}`); break; }
        if (!run.over && !TP[run.lv.tiles[p.y * run.lv.w + p.x]].pass) { fail(`hero in a wall at floor ${run.floor}`); break; }
        for (const m of run.mons) {
            const t = run.lv.tiles[m.y * run.lv.w + m.x];
            if (!(TP[t].pass || (SPECIES[m.sp] && SPECIES[m.sp].fly && TP[t].fly) || m.boss)) { fail(`${m.name} stuck in tile ${t} at floor ${run.floor}`); m.dead = true; }
            if (!Number.isFinite(m.hp)) { fail(`NaN monster ${m.name}`); m.dead = true; }
        }
        if (floorTurns > 6000) {
            fail(`seed ${seed} ${cls}: stuck on floor ${run.floor}`);
            const p = run.p;
            console.log('   at', p.x, p.y, 'hp', p.hp, 'explore', JSON.stringify(autoExplore(run, true)), 'foes', visibleHostiles(run).map((m) => `${m.name}@${m.x},${m.y}`).join(' '));
            console.log('   ' + run.log.slice(-6).map((l) => l.text).join(' | '));
            if (process.env.DUMP) {
                const lv = run.lv;
                let out = '';
                for (let y = 0; y < lv.h; y++) {
                    for (let x = 0; x < lv.w; x++) {
                        const i = y * lv.w + x;
                        const o = run.objs.find((o) => o.x === x && o.y === y && !o.gone), m = run.mons.find((m) => m.x === x && m.y === y);
                        out += x === p.x && y === p.y ? '@' : m ? 'm' : o ? o.k[0].toUpperCase() : (lv.seen[i] ? '' : '\x1b[2m') + '#.+/><~W =OVp,:p_'[lv.tiles[i]] + '\x1b[0m';
                    }
                    out += '\n';
                }
                console.log(out, 'down', lv.down, 'vault', JSON.stringify(lv.vault), 'gen', lv.gen);
            }
            break;
        }
    }
    return { run, ms: Date.now() - t0, rek };
}
for (let s = +(process.env.FROM || 1); s <= SEEDS; s++) for (const cls of (process.env.CLS ? [process.env.CLS] : ['warden', 'ranger', 'witch'])) {
    const { run, ms, rek } = play(1000 + s, cls);
    console.log(`seed ${s} ${cls.padEnd(6)} floor ${String(run.floor).padStart(3)} lvl ${run.p.lvl} won=${run.won || '-'} deaths=${run.stats.deaths} rekindles=${rek} kills=${run.stats.kills} quests=${run.stats.quests} pages=${run.p.pages.length} turns=${run.turn} ${ms}ms`);
}
if (process.env.BALANCE) {
    console.log('\nworld  deaths  floors  turns/floor  avg lvl  min hp%  potions/floor  warden max hp lost%');
    for (const w of Object.keys(table)) {
        const r = table[w];
        const n = Math.max(1, r.floors);
        console.log(`${String(w).padStart(5)}  ${String(r.deaths).padStart(6)}  ${String(r.floors).padStart(6)}  ${String(Math.round(r.turns / n)).padStart(11)}  ${(r.lvl / n).toFixed(1).padStart(7)}  ${String(Math.round(100 * (r.minHp || 0) / n)).padStart(7)}  ${((r.pots || 0) / n).toFixed(2).padStart(13)}  ${String(Math.round(100 * (r.boss || 0) / Math.max(1, r.bossN || 0))).padStart(6)}`);
    }
}

// 4. Determinism.
{
    const a = newRun({ seed: 77, cls: 'ranger' }), b = newRun({ seed: 77, cls: 'ranger' });
    Math.random = makeRng(5).next; for (let k = 0; k < 600; k++) botStep(a);
    Math.random = makeRng(5).next; for (let k = 0; k < 600; k++) botStep(b);
    ok(serialize(a) === serialize(b), 'determinism: same seed, same run');
}
console.log(fails ? `\n${fails} FAILURES` : '\nall checks passed');
process.exit(fails ? 1 : 0);
