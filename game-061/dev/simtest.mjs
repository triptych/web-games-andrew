/**
 * simtest.mjs — headless tests of the pure simulation (no browser).
 *
 *   node game-061/dev/simtest.mjs            all checks
 *   ONLY=galaxy,flight node …                 subset: purity, determinism, galaxy, quests, economy, flight, combat, macro
 *   SEEDS=50 node …                           galaxy seeds to sweep (default 50)
 *
 * Exits non-zero on any failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateGalaxy, getSystem, reachable, lyDist, warpRange, route } from '../js/sim/galaxy.js';
import { storyPlan } from '../js/sim/story.js';
import { Game } from '../js/sim/game.js';
import { World } from '../js/sim/world.js';
import { boardFor, accept } from '../js/sim/quests.js';
import { yawPitchTo, wrapAngle, vdist, clamp } from '../js/sim/vec.js';
import { ITEMS, ROCK_TYPES } from '../js/config.js';
import { macroRun } from './macrobot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const run = (name) => !ONLY.length || ONLY.includes(name);
let fails = 0;
const fail = (msg) => { fails++; console.log(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);
const section = (s) => console.log(`\n== ${s}`);

// ------------------------------------------------------------------ purity
if (run('purity')) {
    section('purity: js/sim imports no three, touches no DOM, never calls Math.random');
    const dir = path.join(HERE, '../js/sim');
    for (const f of fs.readdirSync(dir)) {
        const code = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        if (/from\s+['"]three/.test(code)) fail(`${f} imports three`);
        if (/\bdocument\.|\bwindow\.|localStorage/.test(code)) fail(`${f} touches the DOM`);
        if (/Math\.random\(/.test(code)) fail(`${f} calls Math.random`);
    }
    ok('checked');
}

// ------------------------------------------------------------------ determinism
if (run('determinism')) {
    section('determinism');
    const snap = (seed) => {
        const g = generateGalaxy(seed);
        const sys = [g.home, 3, 17, 42].map((i) => getSystem(g, i));
        return JSON.stringify({ s: g.systems, sp: g.species.map((x) => ({ ...x, lang: x.lang })), sys });
    };
    const a = snap('ORION-7'), b = snap('ORION-7'), c = snap('orion-7 '), d = snap('ORION-8');
    a === b ? ok('same seed → identical galaxy') : fail('same seed differs');
    a === c ? ok('seed text is case- and whitespace-insensitive') : fail('seed normalisation broken');
    a !== d ? ok('different seed → different galaxy') : fail('different seeds collide');
    // Boards are deterministic too.
    const g1 = Game.create('BOARD-1'), g2 = Game.create('BOARD-1');
    const st1 = g1.system.stations[1], st2 = g2.system.stations[1];
    JSON.stringify(boardFor(g1, st1)) === JSON.stringify(boardFor(g2, st2)) ? ok('mission boards deterministic') : fail('boards differ');
}

// ------------------------------------------------------------------ galaxy rules
if (run('galaxy')) {
    const N = +(process.env.SEEDS || 50);
    section(`galaxy rules on ${N} seeds`);
    let bad = 0, t = 0;
    const stats = { w1: [], w2: [] };
    for (let i = 0; i < N; i++) {
        const seed = `SEED-${i}`;
        const t0 = performance.now();
        const g = generateGalaxy(seed);
        t += performance.now() - t0;
        const H = g.systems[g.home];
        const near = g.systems.filter((s) => s.id !== g.home && lyDist(s, H) < 7);
        if (near.length < 4) { bad++; fail(`${seed}: only ${near.length} Warp-I neighbours`); }
        if (!near.some((s) => s.hasStation)) { bad++; fail(`${seed}: no Warp-I neighbour with a station`); }
        const r3 = reachable(g, g.home, warpRange(3));
        const nonCore = g.systems.length - 1;
        if ([...r3].filter((id) => id !== g.core).length < nonCore) { bad++; fail(`${seed}: Warp III reaches ${r3.size}/${nonCore}`); }
        if (reachable(g, g.home, warpRange(4)).has(g.core)) { bad++; fail(`${seed}: core reachable at Warp IV`); }
        if (!reachable(g, g.home, warpRange(5)).has(g.core)) { bad++; fail(`${seed}: core unreachable at Warp V`); }
        const hs = getSystem(g, g.home);
        if (hs.belts.length < 2 || !hs.stations.some((s) => s.kind === 'hearth') || !hs.stations.some((s) => s.kind === 'hub')) { bad++; fail(`${seed}: home system missing belts or stations`); }
        if (!hs.planets.some((p) => p.type === 'gas')) { bad++; fail(`${seed}: home has no gas giant`); }
        const inner = hs.belts[0];
        if (!Object.keys(inner.comp).some((k) => ROCK_TYPES[k].mix.ferrite)) { bad++; fail(`${seed}: home inner belt has no ferrite`); }
        if (g.species.filter((s) => s.hostile).length !== 1) { bad++; fail(`${seed}: hostile species count`); }
        if (g.species[hs.stations[1].species].hostile) { bad++; fail(`${seed}: Waypost run by the hostile species`); }
        const plan = storyPlan(g);
        const hops = (id, r) => (route(g, g.home, id, r)?.length ?? 99) - 1;
        if (hops(plan.sites[0].system, warpRange(1)) > 3) { bad++; fail(`${seed}: shard 1 is ${hops(plan.sites[0].system, warpRange(1))} Warp-I jumps away`); }
        if (hops(plan.sites[1].system, warpRange(2)) > 8) { bad++; fail(`${seed}: warlord haven is ${hops(plan.sites[1].system, warpRange(2))} Warp-II jumps away`); }
        if (hops(plan.sites[2].system, warpRange(3)) > 20) { bad++; fail(`${seed}: shard 3 unreachable at Warp III`); }
        stats.w1.push(reachable(g, g.home, 7).size);
        stats.w2.push(reachable(g, g.home, 11).size);
        for (let k = 0; k < g.systems.length; k++) {
            const s = getSystem(g, k);
            for (const st of s.stations) if (st.species < 0 && st.kind !== 'hearth') { bad++; fail(`${seed}: station without species`); }
        }
    }
    const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
    if (!bad) ok(`all rules hold · avg gen ${(t / N).toFixed(1)} ms · reachable at Warp I ${avg(stats.w1)}, Warp II ${avg(stats.w2)}`);
}

// ------------------------------------------------------------------ quests
if (run('quests')) {
    section('missions point at things that exist');
    let n = 0, bad = 0;
    const types = {};
    for (let i = 0; i < 20; i++) {
        const G = Game.create(`QUEST-${i}`);
        for (const wmk of [0, 1, 2, 3]) {
            G.s.ship.comps.warp = wmk;
            for (let sid = 0; sid < G.galaxy.systems.length; sid += 23) {
                const sys = getSystem(G.galaxy, sid);
                for (const st of sys.stations.filter((x) => x.kind !== 'hearth')) {
                    G._boards = null;
                    G.s.time = i * 1000 + sid;
                    for (const q of boardFor(G, st)) {
                        n++;
                        types[q.type] = (types[q.type] || 0) + 1;
                        const t = q.target;
                        const tsys = getSystem(G.galaxy, t.system);
                        if (!tsys) { bad++; fail(`${q.id}: no system`); continue; }
                        if (t.station && !tsys.stations.some((s) => s.id === t.station)) { bad++; fail(`${q.id}: missing station`); }
                        if (t.poi && !tsys.pois.some((p) => p.id === t.poi)) { bad++; fail(`${q.id}: missing poi`); }
                        if (t.planets && !t.planets.every((pid) => tsys.planets.some((p) => p.id === pid))) { bad++; fail(`${q.id}: missing planet`); }
                        if (t.item && !ITEMS[t.item]) { bad++; fail(`${q.id}: bad item`); }
                        if (!(q.reward.credits > 0)) { bad++; fail(`${q.id}: no reward`); }
                        if (wmk === 0 && t.system !== sid && q.type !== 'envoy') { bad++; fail(`${q.id}: off-system mission without a warp drive`); }
                        const sp = G.galaxy.species[st.species];
                        if (t.item && sp.taboo === t.item) { bad++; fail(`${q.id}: asks for taboo goods`); }
                    }
                }
            }
        }
    }
    if (!bad) ok(`${n} missions valid · ${Object.entries(types).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

// ------------------------------------------------------------------ economy
if (run('economy')) {
    section('economy cannot be pumped');
    const G = Game.create('ECON-1');
    const st = G.system.stations[1];
    G.s.location.docked = st.id;
    G.s.credits = 100000;
    G.s.ship.hull = 5; G.s.ship.comps.cargo = 5;
    let worst = -Infinity;
    for (const id of Object.keys(ITEMS)) {
        const before = G.s.credits;
        const r = G.buy(id, 20);
        if (!r.ok) continue;
        G.sell(id, G.cargoOf(id));
        const gain = G.s.credits - before;
        worst = Math.max(worst, gain);
        if (gain > 0) fail(`buy→sell ${id} at one station gains ${gain}`);
    }
    ok(`best round trip at one station: ${worst} cr (must be ≤ 0)`);
    // Dumping lowers prices and they recover.
    G.s.cargo = { ferrite: 300 };
    const p0 = G.quote('ferrite').sell;
    G.sell('ferrite', 300);
    const p1 = G.quote('ferrite').sell;
    G.s.time += 3600;
    const p2 = G.quote('ferrite').sell;
    p1 < p0 * 0.8 && p2 > p1 ? ok(`dumping 300 Ferrite: ${p0} → ${p1}, recovers to ${p2} after an hour`) : fail(`price elasticity odd: ${p0} → ${p1} → ${p2}`);
}

// ------------------------------------------------------------------ flight bot
function steerTo(w, target) {
    const p = w.player;
    const a = yawPitchTo(p.pos, target);
    return { steerX: clamp(-wrapAngle(a.yaw - p.yaw) * 3, -1, 1), steerY: clamp((a.pitch - p.pitch) * 3, -1, 1) };
}
function nanCheck(w) {
    const p = w.player;
    for (const v of [p.pos.x, p.pos.y, p.pos.z, p.vel.x, p.yaw, p.pitch, p.shield, w.game.s.ship.hp, w.game.s.credits]) if (!Number.isFinite(v)) return true;
    for (const e of w.enemies) if (!Number.isFinite(e.pos.x + e.hp)) return true;
    return false;
}

if (run('flight')) {
    section('flight: undock → cruise to the belt → mine a hold → cruise home → dock → unload');
    const G = Game.create('FLIGHT-1');
    const w = new World(G, 'docked');
    w.undock();
    const dt = 1 / 60;
    let t = 0;
    const step = (inp) => { w.step(inp, dt); t += dt; if (nanCheck(w)) throw new Error('NaN in world'); };
    // fly clear of the station, then cruise to the belt
    w.setTarget(w.sys.belts[0].id);
    for (let i = 0; i < 60 * 15 && w.cruiseLocked(); i++) step({ ...steerTo(w, w.findNav(w.target).pos), throttleSet: 1 });
    step({ cruise: true });
    for (let i = 0; i < 60 * 90 && w.player.cruise.state !== 'off'; i++) step({});
    const db = vdist(w.player.pos, w.findNav(w.target).pos);
    db < 1500 ? ok(`cruised to the belt in ${t.toFixed(0)} s (now ${db.toFixed(0)} u away)`) : fail(`cruise ended ${db.toFixed(0)} u from the belt`);
    // mine
    const t0 = t;
    let guard = 0;
    while (G.cargoFree() > 0 && guard++ < 60 * 400) {
        let best = null, bd = Infinity;
        for (const r of w.rocks()) { if (r.hard > G.stats().mineHard) continue; const d = vdist(r.pos, w.player.pos); if (d < bd) { bd = d; best = r; } }
        if (!best) { step({ throttleSet: 0.5 }); continue; }
        const near = bd - best.radius < 120;
        step({ ...steerTo(w, best.pos), throttleSet: near ? 0 : 0.7, mine: near && !w.player.overheated });
    }
    G.cargoFree() === 0 ? ok(`filled a ${G.stats().cargo}-unit hold in ${(t - t0).toFixed(0)} s: ${JSON.stringify(G.s.cargo)}`) : fail('could not fill the hold');
    // home
    const hearth = w.sys.stations[0];
    w.setTarget(hearth.id);
    step({ cruise: true });
    for (let i = 0; i < 60 * 60 && w.player.cruise.state !== 'off'; i++) step({});
    const dh = vdist(w.player.pos, hearth.pos);
    // If cruise was refused (mass lock, rocks), fly manually.
    for (let i = 0; i < 60 * 120 && vdist(w.player.pos, hearth.pos) > 1500; i++) step({ ...steerTo(w, hearth.pos), throttleSet: 1, boost: true });
    console.log(`    (cruise ended ${dh.toFixed(0)} u from Hearth)`);
    for (let i = 0; i < 60 * 40 && !w.docked; i++) {
        const d = vdist(w.player.pos, hearth.pos);
        step({ ...steerTo(w, hearth.pos), throttleSet: d > 300 ? 0.6 : 0.1, interactPressed: w.ctx?.kind === 'dock' && w.ctx.ok });
    }
    w.docked ? ok(`docked at Hearth at t=${t.toFixed(0)} s`) : fail('could not dock');
    const r = G.unloadAll();
    r.moved > 0 && (G.s.stats.unloaded.ferrite || 0) > 0 ? ok(`unloaded ${r.moved} units`) : fail('unload failed');
    for (let i = 0; i < 120; i++) w.step({}, dt);
    G.s.story.stage >= 0 ? ok(`story stage ${G.s.story.stage} (${G.stage()?.title})`) : null;
}

if (run('combat')) {
    section('combat: ambush in a dangerous system, survive 10 sim-minutes with a dogfighting bot');
    const G = Game.create('COMBAT-1');
    // Find a danger-3 system and drop the player there with Mk III gear.
    const sid = G.galaxy.systems.find((s) => s.danger >= 3 && s.id !== G.galaxy.core).id;
    G.s.location.system = sid; G.s.location.docked = null;
    Object.assign(G.s.ship.comps, { weapon: 3, shield: 3, armor: 3, engine: 3, thrusters: 3 });
    G.s.ship.hull = 3;
    G.s.ship.hp = G.stats().hullMax;
    const w = new World(G, 'arrive');
    w.player.shield = G.stats().shield;
    const dt = 1 / 60;
    let kills0 = G.s.stats.kills, waves = 0, deaths = 0;
    for (let i = 0; i < 60 * 600; i++) {
        if (w.enemies.length === 0 && i % (60 * 40) === 0) { w.ambushAt(1200); waves++; }
        const e = w.enemies.reduce((b, x) => (!b || vdist(x.pos, w.player.pos) < vdist(b.pos, w.player.pos) ? x : b), null);
        const inp = e ? { ...steerTo(w, e.pos), throttleSet: 0.6, fire: true } : { throttleSet: 0.3 };
        w.step(inp, dt);
        if (nanCheck(w)) { fail('NaN in combat'); break; }
        if (w.player.dead) { deaths++; G.s.ship.hp = G.stats().hullMax; w.player.dead = false; w.player.shield = G.stats().shield; }
    }
    const kills = G.s.stats.kills - kills0;
    kills > 0 ? ok(`${waves} waves, ${kills} kills, ${deaths} deaths, ${w.loot.length} canisters floating, credits ${G.s.credits}`) : fail(`no kills in ${waves} waves`);
    if (deaths > waves) fail(`bot died ${deaths} times in ${waves} waves at Mk III: combat too hard?`);
}

if (run('macro')) {
    section('macro bot: full progression through the real game actions');
    const seeds = (process.env.MACRO_SEEDS || 'MACRO-2,MACRO-3').split(',');
    for (const s of seeds) {
        const r = macroRun(s, { verbose: !!process.env.VERBOSE, hours: 30, stall: 12 });
        const line = r.milestones.map(([k, t]) => `${k} ${(t / 60).toFixed(0)}m`).join(' · ');
        r.finished ? ok(`${s}: ${line}`) : fail(`${s}: stuck at "${r.stuck}" after ${(r.time / 60).toFixed(0)} min · ${line}`);
    }
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
