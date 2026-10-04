/**
 * simtest.mjs — headless checks on the real simulation (no browser).
 *
 *   node game-057/dev/simtest.mjs              # from the repo root
 *   BALANCE=1 node game-057/dev/simtest.mjs    # adds the per-sector balance table over more seeds
 *
 * Purity, sector generation over many seeds (connectivity, every room role,
 * vents, no props in doorways), the escape route and horde arena,
 * determinism, per-tick invariants, every weapon, every bug, every boss
 * (each attack pattern used, then killed), a save round-trip, and bot
 * campaigns (a perfect bot and a fallible one) through all five sectors and
 * the escape.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIM_DT, WEAPONS, WEAPON_ORDER, ENEMY_ORDER, BOSSES, SECTORS } from '../js/config.js';
import { generateSector, generateEscape, generateHorde, T_FLOOR, isSolid } from '../js/sim/level.js';
import { newRun, newWorld, step, completeSector, choosePerk } from '../js/sim/world.js';
import { makeBot, botInput } from '../js/sim/bot.js';
import { spawnEnemy } from '../js/sim/core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BALANCE = !!process.env.BALANCE;
let fails = 0, passes = 0;
const check = (cond, msg) => { if (cond) passes++; else { fails++; console.log('  FAIL', msg); } };
const section = (s) => console.log(`\n== ${s}`);

// ------------------------------------------------------------------ Purity
section('purity');
for (const f of fs.readdirSync(path.join(HERE, '../js/sim'))) {
    const src = fs.readFileSync(path.join(HERE, '../js/sim', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    check(!/from 'three'/.test(src), `${f} does not import three.js`);
    check(!/\bdocument\.|\bwindow\.|localStorage|performance\.now/.test(src), `${f} does not touch the DOM or timers`);
    check(!/Math\.random/.test(src), `${f} never calls Math.random`);
}
console.log('  sim modules are pure');

// ------------------------------------------------------------------ Generation
section('generation');
function floodFrom(lv, sx, sy) {
    const seen = new Uint8Array(lv.w * lv.h);
    const q = [Math.floor(sy) * lv.w + Math.floor(sx)];
    seen[q[0]] = 1;
    let n = 0;
    while (q.length) {
        const i = q.pop();
        n++;
        for (const o of [1, -1, lv.w, -lv.w]) {
            const j = i + o;
            if (j < 0 || j >= seen.length || seen[j] || lv.tiles[j] !== T_FLOOR) continue;
            if (lv.propAt[j] >= 0) continue;
            seen[j] = 1; q.push(j);
        }
    }
    return { seen, n };
}
let genCount = 0;
for (let seed = 1; seed <= 40; seed++) {
    for (let s = 0; s < 5; s++) {
        const lv = generateSector(seed * 7919 + s, s);
        genCount++;
        const types = new Set(lv.rooms.map((r) => r.type));
        for (const t of ['start', 'boss', 'treasure', 'shop', 'med', 'archive', 'combat']) check(types.has(t), `seed ${seed} sector ${s}: has a ${t} room`);
        const { seen } = floodFrom(lv, lv.start.x, lv.start.y);
        let unreached = 0;
        for (let i = 0; i < seen.length; i++) if (lv.tiles[i] === T_FLOOR && lv.propAt[i] < 0 && !seen[i]) unreached++;
        check(unreached === 0, `seed ${seed} sector ${s}: every free floor tile is reachable (${unreached} not)`);
        for (const r of lv.rooms) if (r.type === 'combat' || r.type === 'boss') check(r.vents.length >= 4, `seed ${seed} sector ${s}: room ${r.id} has vents`);
        for (const d of lv.doors) for (let y = d.y; y < d.y + d.h; y++) for (let x = d.x; x < d.x + d.w; x++) check(lv.propAt[y * lv.w + x] < 0 && lv.tiles[y * lv.w + x] === T_FLOOR, `seed ${seed} sector ${s}: door ${d.id} is clear`);
        // Rooms never overlap.
        for (const a of lv.rooms) for (const b of lv.rooms) if (a.id < b.id) check(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `seed ${seed} sector ${s}: rooms ${a.id}/${b.id} don't overlap`);
        const items = new Set(lv.items.map((it) => it.kind));
        for (const k of ['chest', 'shopitem', 'med', 'terminal', 'pad']) check(items.has(k), `seed ${seed} sector ${s}: item ${k}`);
        check(lv.items.filter((it) => it.kind === 'terminal').length === 3, `seed ${seed} sector ${s}: three data logs`);
    }
    const es = generateEscape(seed * 31);
    const pad = es.rooms[es.padRoom];
    const f = floodFrom(es, es.start.x, es.start.y);
    check(f.seen[Math.floor(pad.cy) * es.w + Math.floor(pad.cx)] === 1, `seed ${seed}: escape pad reachable`);
    check(es.rooms.filter((r) => r.type === 'holdout').length === 3, `seed ${seed}: escape has three holdouts`);
    check(es.rooms.length >= 9, `seed ${seed}: escape route is long (${es.rooms.length} rooms)`);
    const hz = generateHorde(seed);
    check(floodFrom(hz, hz.start.x, hz.start.y).n > 700, `seed ${seed}: horde arena open`);
}
console.log(`  ${genCount} sectors, 40 escape routes, 40 arenas generated`);

// ------------------------------------------------------------------ Helpers
function finiteAll(o, where) {
    for (const k of ['x', 'y', 'vx', 'vy', 'hp']) if (k in o && !Number.isFinite(o[k])) return `${where}.${k}=${o[k]}`;
    return null;
}

function hashWorld(w) {
    let h = 0;
    const mix = (v) => { h = (Math.imul(h ^ Math.round(v * 1000), 2654435761) + 0x9e3779b9) >>> 0; };
    mix(w.player.x); mix(w.player.y); mix(w.player.hp); mix(w.enemies.length); mix(w.stats.kills); mix(w.rng.next());
    for (const e of w.enemies) { mix(e.x); mix(e.y); mix(e.hp); }
    return h;
}

function runBot(w, sec, opts = {}) {
    const bot = opts.bot ?? makeBot(opts.skill ?? 1);
    const n = Math.round(sec / SIM_DT);
    let bad = null;
    for (let i = 0; i < n; i++) {
        if (w.phase === 'perk') choosePerk(w, w.perkOptions[0]);
        if (w.phase === 'complete' || w.phase === 'victory' || w.phase === 'dead') break;
        step(w, botInput(w, bot));
        w.events.length = 0;
        if (opts.invariants && !bad) {
            const p = w.player;
            bad = finiteAll(p, 'player');
            if (!bad && isSolid(w.lv, p.x, p.y)) bad = `player inside a wall at ${p.x.toFixed(2)},${p.y.toFixed(2)}`;
            if (!bad && p.hp > p.maxHp + 1e-6) bad = 'hp > maxHp';
            if (!bad && p.salvage < 0) bad = 'negative salvage';
            if (!bad) for (const x of p.weapons) if (x.mag < 0 || x.reserve < 0) bad = `negative ammo on ${x.id}`;
            if (!bad) for (const e of w.enemies) { const f = finiteAll(e, e.type); if (f) { bad = f; break; } if (!e.under && isSolid(w.lv, e.x, e.y) && e.spawnT <= 0) { bad = `${e.type} inside a wall`; break; } }
            if (!bad) for (const b of w.ebullets) if (!Number.isFinite(b.x)) bad = 'enemy bullet NaN';
        }
        if (opts.onStep) opts.onStep(w);
    }
    return bad;
}

// ------------------------------------------------------------------ Determinism & invariants
section('determinism and invariants');
{
    const a = newWorld(newRun({ seed: 99 })), b = newWorld(newRun({ seed: 99 }));
    runBot(a, 60); runBot(b, 60);
    check(hashWorld(a) === hashWorld(b), 'same seed and inputs → same world after 60 s');
    for (let s = 0; s < 5; s++) {
        const run = newRun({ seed: 500 + s });
        run.sector = s;
        const w = newWorld(run);
        w.god = true;
        const bad = runBot(w, 120, { invariants: true });
        check(!bad, `sector ${s}: tick invariants hold for 2 minutes (${bad ?? 'ok'})`);
    }
}

// ------------------------------------------------------------------ Weapons
section('weapons');
for (const id of WEAPON_ORDER) {
    for (const mk of [1, 3]) {
        const run = newRun({ seed: 3 });
        run.loadout.weapons = [{ id, mk, mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve }];
        const w = newWorld(run);
        w.god = true;
        const p = w.player;
        // A clump of bugs in the start room, in front of the marine.
        for (let i = 0; i < 8; i++) spawnEnemy(w, i % 3 ? 'skitter' : 'drone', p.x + (i % 4) * 0.7 - 1, p.y - 4 - Math.floor(i / 4), { instant: true });
        let dealt = 0;
        for (let i = 0; i < 60 * 4; i++) {
            const e = w.enemies.find((x) => !x.dead);
            const tx = e ? e.x : p.x, ty = e ? e.y : p.y - 5;
            step(w, { mx: 0, my: 0, aimX: tx, aimY: ty, fire: true, assist: false });
            for (const ev of w.events) if (ev.type === 'kill') dealt++;
            w.events.length = 0;
        }
        check(w.stats.dmgDealt > 0 && dealt > 0, `${id} Mk ${mk} damages and kills (${Math.round(w.stats.dmgDealt)} dmg, ${dealt} kills)`);
    }
}

// ------------------------------------------------------------------ Bugs
section('the Brood');
for (const type of [...ENEMY_ORDER, 'clone']) {
    const run = newRun({ seed: 11 });
    run.sector = 2;
    const w = newWorld(run);
    w.god = true;
    const p = w.player;
    const room = w.lv.rooms[w.lv.startRoom];
    const e = spawnEnemy(w, type, room.cx + 3, room.cy - 2, { instant: true, room: room.id });
    const states = new Set();
    let acted = false;
    runBot(w, 25, { onStep: () => { states.add(e.state); if (Math.hypot(e.vx, e.vy) > 0.1 || w.ebullets.length || e.state !== 'chase') acted = true; } });
    check(acted || type === 'sac', `${type} acts (states: ${[...states].join(', ')})`);
    check(e.dead, `${type} can be killed`);
    void p;
}

// ------------------------------------------------------------------ Bosses
section('bosses');
for (let s = 0; s < 5; s++) {
    const run = newRun({ seed: 21 + s });
    run.sector = s;
    // Arrive the way a player would: a found gun or two, upgraded as the sectors go.
    if (s >= 1) run.loadout.weapons.push({ id: 'scatter', mk: Math.min(3, s), mag: 6, reserve: 48 });
    if (s >= 3) run.loadout.weapons.push({ id: 'smart', mk: 2, mag: 120, reserve: 480 });
    const w = newWorld(run);
    w.god = true;
    const room = w.lv.rooms[w.lv.bossRoom];
    w.player.x = room.cx; w.player.y = room.y + room.h - 3;
    const pats = new Set();
    let maxPhase = 1, bullets = 0;
    const t0 = w.t;
    runBot(w, 420, { onStep: (ww) => { if (ww.boss) { pats.add(ww.boss.pat); maxPhase = Math.max(maxPhase, ww.boss.phase); bullets = Math.max(bullets, ww.ebullets.length); } } });
    const b = w.boss;
    const type = SECTORS[s].boss;
    check(b && b.type === type, `sector ${s}: ${type} spawns`);
    check(b && b.dead, `${type} is killed (in ${(w.t - t0).toFixed(0)} s)`);
    check(maxPhase >= 2, `${type} reaches phase ${maxPhase}`);
    pats.delete('idle'); pats.delete(undefined);
    console.log(`  ${BOSSES[type].name}: patterns ${[...pats].join(', ')}; peak ${bullets} bullets`);
    check(pats.size >= 3, `${type} uses its attack patterns`);
    const exit = w.items.find((it) => it.kind === (type === 'mother' ? 'cocoon' : 'elevator'));
    check(!!exit, `${type}: the way on appears`);
}

// ------------------------------------------------------------------ Save round-trip
section('save');
{
    const run = newRun({ seed: 42, difficulty: 'nightmare' });
    const w = newWorld(run);
    w.god = true;
    runBot(w, 400);
    completeSector(w);
    const json = JSON.parse(JSON.stringify(run));
    for (const wp of json.loadout.weapons) if (wp.id === 'pulse') wp.reserve = Infinity;
    check(json.sector === 1 && json.difficulty === 'nightmare', 'run survives JSON');
    const w2 = newWorld(json);
    check(w2.player.weapons[0].reserve === Infinity && w2.sectorNum === 1, 'a saved run rebuilds sector II with the loadout');
    let ok = true;
    try { runBot(w2, 20); } catch (e) { ok = false; console.log(e); }
    check(ok, 'and plays');
}

// ------------------------------------------------------------------ Campaign
section('campaign (bots)');
function campaign(seed, skill, difficulty = 'marine') {
    const run = newRun({ seed, difficulty });
    const rows = [];
    for (let s = 0; s <= 5; s++) {
        let deaths = 0, w;
        for (;;) {
            w = newWorld(run);
            const bot = makeBot(skill);
            runBot(w, 900, { bot });
            if (w.phase !== 'dead') break;
            deaths++;
            run.attempt++;
            if (deaths >= 12) break;
        }
        const p = w.player;
        rows.push({ sector: s === 5 ? 'escape' : SECTORS[s].roman, phase: w.phase, deaths, time: Math.round(w.t), kills: w.stats.kills, taken: Math.round(w.stats.dmgTaken), hp: Math.round(p.hp), salvage: p.salvage, weapons: p.weapons.map((x) => x.id + x.mk).join(' ') });
        if (w.phase === 'victory') break;
        if (w.phase !== 'complete') break;
        completeSector(w);
    }
    return rows;
}
const seeds = BALANCE ? [1, 2, 3, 4] : [7];
for (const [skill, diff] of BALANCE ? [[1, 'marine'], [0.6, 'recruit'], [0.6, 'marine'], [1, 'nightmare']] : [[1, 'marine'], [0.6, 'marine']]) {
    for (const seed of seeds) {
        const t = Date.now();
        const rows = campaign(seed, skill, diff);
        const won = rows.at(-1)?.phase === 'victory';
        console.log(`  seed ${seed}, skill ${skill}, ${diff}: ${won ? 'VICTORY' : 'stopped at ' + rows.at(-1)?.sector} in ${((Date.now() - t) / 1000).toFixed(1)} s wall`);
        if (BALANCE || skill === 1) console.table(rows);
        if (skill === 1 && diff === 'marine') check(won, `perfect bot wins the campaign on seed ${seed}`);
    }
}

console.log(`\n${passes} checks passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
