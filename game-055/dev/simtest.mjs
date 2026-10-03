/**
 * simtest.mjs — headless, no browser. Plays the real simulation.
 *
 *  1. Purity: js/sim/** never touches the DOM, WebGL or Math.random.
 *  2. Every operation on SEEDS seeds with the loadout a player would plausibly
 *     own by then: a god-mode bot must reach and kill the boss with no phase
 *     timing out; a mortal dodging bot reports hits taken (balance).
 *  3. Endless: two sectors, the biome swaps and the second boss arrives.
 *  4. Determinism: the same seed and inputs give the same score and state.
 *
 *   node game-055/dev/simtest.mjs            SEEDS=3 DIFF=pilot OPS=0,1,2
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../js/sim/world.js';
import { OPS } from '../js/sim/campaign.js';
import { computeLoadout, typicalOwned } from '../js/sim/skills.js';
import { makeTerrain, LAND, WATER, LAVA, BIOME_IDS } from '../js/sim/terrain.js';
import { makeBot } from '../js/bot.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SIM = path.join(HERE, '..', 'js', 'sim');
const SEEDS = +(process.env.SEEDS ?? 2);
const DIFF = process.env.DIFF ?? 'pilot';
const OPSEL = (process.env.OPS ?? '0,1,2,3,4,5').split(',').map(Number);
let failed = 0;
const fail = (m) => { failed++; console.log('  FAIL ' + m); };

// ---------------------------------------------------------------- purity
console.log('purity');
for (const f of fs.readdirSync(SIM)) {
    const code = fs.readFileSync(path.join(SIM, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    if (/\bdocument\.|\bwindow\.|localStorage|WebGL|gl\./.test(code)) fail(`${f} touches the DOM or GL`);
    if (/Math\.random\(/.test(code)) fail(`${f} calls Math.random`);
    if (/from\s+['"]\.\.\/(gfx|ui)/.test(code)) fail(`${f} imports the view`);
}

// ---------------------------------------------------------------- terrain sanity
console.log('terrain');
for (const b of BIOME_IDS) {
    const t = makeTerrain(b, 1234, { platformY: b === 'volcano' ? 8000 : Infinity });
    const n = [0, 0, 0];
    for (let y = 0; y < 8000; y += 40) for (let x = 0; x < 540; x += 30) n[t.kind(x, y)]++;
    const tot = n[0] + n[1] + n[2];
    const pct = n.map((v) => Math.round(v / tot * 100));
    console.log(`  ${b.padEnd(8)} land ${pct[LAND]}%  water ${pct[WATER]}%  lava ${pct[LAVA]}%`);
    if (pct[LAND] < 35) fail(`${b} has too little land (${pct[LAND]}%)`);
}

// ---------------------------------------------------------------- runs
function run(opIdx, seed, { god, maxT = 420, difficulty = DIFF, endless = false, owned } = {}) {
    const op = OPS[opIdx];
    const L = computeLoadout(owned ?? typicalOwned(opIdx));
    const w = new World({ op, opIndex: opIdx, seed, difficulty, loadout: L, H: 900, god, endless });
    const bot = makeBot(w, { bombs: true });
    const phaseTimes = [];
    let lastPhase = -1, phaseStart = 0, bossSeen = false, sectors = 0;
    const evCount = {};
    while (w.t < maxT && w.state !== 'cleared' && w.state !== 'failed') {
        w.step(bot());
        for (const e of w.events) {
            evCount[e.type] = (evCount[e.type] || 0) + 1;
            if (e.type === 'bossPhase' && e.timeout) w.stats.phaseTimeouts++;
            if (e.type === 'bossIntro') bossSeen = true;
            if (e.type === 'banner' && /SECTOR/.test(e.text)) sectors++;
        }
        w.events.length = 0;
        const b = w.boss;
        if (b && b.phaseIdx !== lastPhase && b.phaseIdx >= 0) {
            if (lastPhase >= 0) phaseTimes.push(+(w.t - phaseStart).toFixed(1));
            lastPhase = b.phaseIdx; phaseStart = w.t;
        }
        if (b && b.dying && phaseTimes.length < b.phaseCount) phaseTimes.push(+(w.t - phaseStart).toFixed(1));
        if (endless && sectors >= 1 && w.director.phase === 'boss' && w.boss && w.boss.alive && w.director.sector >= 1) break;
        if (!Number.isFinite(w.player.x) || !Number.isFinite(w.score)) { fail('NaN in state'); break; }
    }
    return { w, phaseTimes, bossSeen, evCount, sectors };
}

console.log(`operations (difficulty ${DIFF}, ${SEEDS} seeds)`);
for (const i of OPSEL) {
    const op = OPS[i];
    for (let s = 0; s < SEEDS; s++) {
        const seed = 1000 + i * 97 + s * 13;
        const t0 = Date.now();
        const g = run(i, seed, { god: true });
        const ms = Date.now() - t0;
        const st = g.w.stats;
        const line = `  ${op.id.padEnd(10)} seed ${seed}: ${g.w.state} t=${g.w.t.toFixed(0)}s boss=${st.bossTime.toFixed(0)}s phases=[${g.phaseTimes.join(', ')}] kills ${st.kills}/${st.spawned} salvage ${st.salvage} survivors ${st.survivors}/${st.survivorsTotal} score ${g.w.score} (${ms} ms)`;
        console.log(line);
        if (g.w.state !== 'cleared') fail(`${op.id} seed ${seed}: god bot did not clear (state ${g.w.state})`);
        if (st.phaseTimeouts) fail(`${op.id} seed ${seed}: ${st.phaseTimeouts} boss phase(s) timed out`);
        if (!g.bossSeen) fail(`${op.id}: boss never appeared`);
        if (st.survivorsTotal < 6) fail(`${op.id}: only ${st.survivorsTotal} survivors placed`);
        const m = run(i, seed, { god: false });
        console.log(`  ${''.padEnd(10)} mortal bot: ${m.w.state} at t=${m.w.t.toFixed(0)}s, hits ${m.w.stats.hits}, bombs ${m.w.stats.bombs}, grazes ${m.w.stats.grazes}, armour left ${m.w.player.armor}/${m.w.player.maxArmor}`);
    }
}

// ---------------------------------------------------------------- endless
console.log('endless');
{
    const e = run(0, 4242, { god: true, endless: true, maxT: 600, owned: typicalOwned(4) });
    console.log(`  sectors ${e.w.director.sector}, biome now ${e.w.terrain.biome}, t=${e.w.t.toFixed(0)}s, score ${e.w.score}`);
    if (e.w.director.sector < 1) fail('endless did not reach sector 2');
    if (e.w.terrain.biome === 'coast') fail('endless did not change biome');
}

// ---------------------------------------------------------------- determinism
console.log('determinism');
{
    const a = run(2, 777, { god: false, maxT: 60 });
    const b = run(2, 777, { god: false, maxT: 60 });
    const ha = JSON.stringify([a.w.score, a.w.player.x, a.w.player.y, a.w.enemies.length, a.w.bs.list.length, a.w.stats]);
    const hb = JSON.stringify([b.w.score, b.w.player.x, b.w.player.y, b.w.enemies.length, b.w.bs.list.length, b.w.stats]);
    if (ha !== hb) fail('same seed, different outcome');
    else console.log('  identical');
}

console.log(failed ? `\n${failed} failure(s)` : '\nall passed');
process.exit(failed ? 1 : 0);
