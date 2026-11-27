/**
 * simtest.mjs — headless checks of HAYATE RIVER STRIKE's simulation. No browser.
 *
 *   node game-152/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-152/dev/simtest.mjs
 *   SEEDS=12 VERBOSE=1 node game-152/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the
 *    clock, and never import the view, the UI or the audio.
 * 2. rules: steering, banks, throttle, fuel and depots, the jump (over mines, booms, sandbars and bullets),
 *    charges, guns, missiles, combo, telegraphs, lasers, every pickup and boost, bridges, booms, bosses and their
 *    phases, the dock and the next sector.
 * 3. skills: the tree's prices, order, refunds and respec, and that every node changes the boat.
 * 4. river: over 60 seeds × 3 sectors — every channel is wide enough, both arenas exist, enemies spawn on the
 *    right ground, nothing is NaN.
 * 5. determinism: same seed and inputs → same game; save round trips mid-run and mid-boss play on identically.
 * 6. bot: whole runs at three skill levels with per-step invariants, and the balance table with asserted bands.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 6);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Sk = await import('../js/sim/skills.js');
const D = await import('../js/sim/data.js');
const Rv = await import('../js/sim/river.js');
const Bs = await import('../js/sim/bosses.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, fire: false, jump: false, missile: false };
const run = (G, inp, secs) => { for (let t = 0; t < secs && !G.over; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const has = (G, type) => G.events.some((e) => e.type === type);
const clear = (G) => { G.enemies.length = 0; G.bullets.length = 0; G.spawnQ.length = 0; G.pickups.length = 0; G.lanes.length = 0; G.bridges.length = 0; G.events.length = 0; };
/** A quiet game: nothing on the river, the boat in the middle of a straight. */
function quiet(seed = 1, ranks = {}) {
    const G = Gm.newGame(seed, ranks);
    clear(G);
    G.spawnQ.push({ y: 1e9, kind: 'mine', f: 0 });     // keeps the queue from refilling the test area
    G.boat.x = Gm.riverAt(G.river, G.boat.y).cx;
    return G;
}
function put(G, kind, dx, dy, extra = {}) {
    const d = D.ENEMIES[kind];
    const e = { id: G.nextId++, kind, x: G.boat.x + dx, y: G.boat.y + dy, hp: d.hp, max: d.hp, home: G.boat.x + dx, vx: 0, vy: 0, t: 0, fireT: 99, tele: 0, aim: 0, mode: 'idle', onBridge: false, hit: 0, ...extra };
    G.enemies.push(e);
    return e;
}

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('rules')) {
    section('rules');
    let G = quiet(1);
    const x0 = G.boat.x;
    run(G, { ...NONE, x: 1 }, 0.4);
    ok(G.boat.x > x0 + 2, 'steering right moves the boat right');
    ok(Math.abs(G.boat.vx) <= C.BOAT.lateralMax + 1e-6, 'and never faster than lateralMax');

    G = quiet(1);
    const y0 = G.boat.y;
    run(G, NONE, 1);
    ok(Math.abs(G.boat.y - y0 - C.BOAT.cruise) < 0.5, 'with no throttle the boat cruises at BOAT.cruise');
    run(G, { ...NONE, y: -1 }, 3);
    ok(G.boat.speed > C.BOAT.cruise + 5, 'throttle speeds it up');
    run(G, { ...NONE, y: 1 }, 3);
    ok(G.boat.speed < C.BOAT.cruise - 3, 'brake slows it down');

    G = quiet(1);
    const hull0 = G.boat.hull;
    G.boat.x += 40;
    Gm.step(G, NONE, DT);
    const r = Gm.riverAt(G.river, G.boat.y);
    ok(Math.abs(G.boat.x - r.cx) <= r.hw - C.BOAT.radius + 1e-6, 'a bank pushes the boat back onto the water');
    ok(G.boat.hull === hull0 - C.DAMAGE.bank && !G.over, 'and scrapes the hull for DAMAGE.bank, not a kill');

    // fuel
    G = quiet(1);
    const f0 = G.boat.fuel;
    run(G, NONE, 4);
    ok(G.boat.fuel < f0 - 4, 'fuel drains while sailing');
    const dep = put(G, 'depot', 0, 0);
    G.boat.fuel = 50;
    const f1 = G.boat.fuel;
    Gm.step(G, NONE, DT); dep.y = G.boat.y;
    run(G, (g) => { dep.y = g.boat.y; return NONE; }, 0.5);
    ok(G.boat.fuel > f1 + 10, 'sitting over a depot refuels');
    G = quiet(1);
    G.boat.fuel = 0;
    const h1 = G.boat.hull;
    run(G, NONE, 2);
    ok(!G.over && G.boat.hull < h1 && G.boat.hull > h1 - 15, 'an empty tank drains the hull slowly, never an instant death');
    ok(G.boat.speed < C.BOAT.cruise, 'and the engine sputters to minSpeed');

    // jump
    G = quiet(1);
    G.boat.charge = 0;
    Gm.step(G, { ...NONE, jump: true }, DT);
    ok(G.boat.z === 0 && !has(G, 'jump'), 'no jump without a full charge');
    G.boat.charge = 1;
    Gm.step(G, { ...NONE, jump: true }, DT);
    ok(G.boat.z > 0 && has(G, 'jump'), 'a charge launches the boat');
    let peak = 0, air = 0;
    while (G.boat.z > 0 || G.boat.vz > 0) { Gm.step(G, NONE, DT); peak = Math.max(peak, G.boat.z); air += DT; }
    ok(peak > 2.5 && air > 0.8, `the jump clears ${peak.toFixed(1)} m for ${air.toFixed(2)} s`);
    ok(has(G, 'land'), 'and lands with a land event');
    const peakBase = peak, airBase = air;
    G = quiet(1, { foil: 3 });
    G.boat.charge = 1;
    Gm.step(G, { ...NONE, jump: true }, DT);
    peak = 0; air = 0;
    while (G.boat.z > 0 || G.boat.vz > 0) { Gm.step(G, NONE, DT); peak = Math.max(peak, G.boat.z); air += DT; }
    ok(peak > peakBase * 1.5 && air > airBase * 1.35, 'Spring Hydrofoils III jumps higher and longer');

    G = quiet(1);
    G.boat.charge = 0;
    run(G, NONE, C.JUMP.recharge + 0.1);
    ok(G.boat.charge >= 1, 'a charge comes back after JUMP.recharge seconds');

    // mines: hit on the water, cleared in the air
    G = quiet(1);
    put(G, 'mine', 0, 6);
    run(G, NONE, 0.8);
    ok(has(G, 'hurt') && G.boat.hull === G.stats.maxHull - C.DAMAGE.mine, 'sailing into a mine costs DAMAGE.mine');
    G = quiet(1);
    put(G, 'mine', 0, 9);
    G.boat.charge = 1;
    Gm.step(G, { ...NONE, jump: true }, DT);
    run(G, NONE, 0.8);
    ok(!has(G, 'hurt') && G.boat.hull === G.stats.maxHull, 'jumping clears a mine');

    // a closed boom: ram it and pay, or jump it for free
    G = quiet(1);
    put(G, 'blockade', 0, 8, { gap: null, w: 30, x: G.boat.x });
    run(G, NONE, 1);
    ok(has(G, 'hurt') && G.boat.hull === G.stats.maxHull - C.DAMAGE.blockade, 'ramming a closed boom costs DAMAGE.blockade');
    ok(!G.enemies.some((e) => e.kind === 'blockade'), 'and breaks it');
    G = quiet(1);
    put(G, 'blockade', 0, 10, { gap: null, w: 30, x: G.boat.x });
    G.boat.charge = 1;
    Gm.step(G, { ...NONE, jump: true }, DT);
    run(G, NONE, 1);
    ok(!has(G, 'hurt'), 'jumping a boom costs nothing');

    // bullets pass under a jumping boat
    G = quiet(1);
    G.bullets.push({ id: 999, kind: 'bullet', x: G.boat.x, y: G.boat.y + 10, vx: 0, vy: 0, life: 5, r: 0.45 });
    run(G, NONE, 1);
    ok(has(G, 'hurt'), 'a bullet in the path hits the boat on the water');
    G = quiet(1);
    G.bullets.push({ id: 999, kind: 'bullet', x: G.boat.x, y: G.boat.y + 9, vx: 0, vy: 0, life: 5, r: 0.45 });
    G.boat.charge = 1;
    Gm.step(G, { ...NONE, jump: true }, DT);
    run(G, NONE, 0.7);
    ok(!has(G, 'hurt'), 'and passes under it in the air');

    // guns, kills, combo
    G = quiet(1);
    const p = put(G, 'patrol', 0, 20);
    run(G, (g) => ({ ...NONE, fire: true }), 1.5);
    ok(!G.enemies.includes(p) && has(G, 'kill'), 'the cannons kill a patrol boat ahead');
    ok(G.score >= D.ENEMIES.patrol.score && G.pickups.some((q) => q.kind === 'core') || G.cores > 0, 'which scores and drops cores');
    const shotsPerVolley = (ranks) => { const g = quiet(1, ranks); Gm.step(g, { ...NONE, fire: true }, DT); return g.shots.length; };
    ok(shotsPerVolley({}) === 2 && shotsPerVolley({ rounds: 1, racks: 1, barrels: 2 }) === 4, 'twin cannons fire 2 shells; Extra Barrels II fires 4');

    G = quiet(1);
    for (let i = 0; i < 6; i++) put(G, 'patrol', (i - 2.5) * 0.4, 14 + i * 2, { hp: 0.5 });
    run(G, { ...NONE, fire: true }, 2);
    ok(G.combo >= 5 && G.mult === 1.5, `six quick kills make a ×1.5 multiplier (combo ${G.combo}, ×${G.mult})`);
    Gm.hurt(G, 5, 'test');
    ok(G.combo === 0 && G.mult === 1, 'getting hit resets the combo');

    G = quiet(1);
    const gb = put(G, 'gunboat', 8, 30);
    G.boat.missiles = 1;
    Gm.step(G, { ...NONE, missile: true }, DT);
    ok(G.boat.missiles === 0 && G.shots.some((s) => s.kind === 'missile'), 'a missile launches');
    run(G, NONE, 2.5);
    ok(gb.hp < D.ENEMIES.gunboat.hp, 'and homes in on a target off to the side');

    // telegraphs come first
    G = quiet(1);
    const tk = put(G, 'tank', 10, 40, { fireT: 1.5 });
    let teleAt = null, fireAt = null;
    for (let t = 0; t < 3; t += DT) {
        Gm.step(G, NONE, DT);
        for (const e of G.events) { if (e.type === 'tele' && teleAt === null) teleAt = G.t; if (e.type === 'efire' && fireAt === null) fireAt = G.t; }
        G.events.length = 0;
        tk.y = G.boat.y + 40;
    }
    ok(teleAt !== null && fireAt !== null && fireAt - teleAt > 0.9, `a tank shows its laser sight ${fireAt && teleAt ? (fireAt - teleAt).toFixed(2) : '?'} s before it fires`);

    // lasers
    G = quiet(1);
    G.lanes.push({ id: 1, x: G.boat.x, w: 3, tele: 0.5, dur: 0.6, t: 0, y0: G.boat.y + 30 });
    run(G, NONE, 0.4);
    ok(!has(G, 'hurt'), 'a laser lane does nothing while it is only a warning');
    run(G, NONE, 0.3);
    ok(has(G, 'hurt'), 'and burns once it fires');

    // pickups
    const pick = (kind) => { const g = quiet(1); g.boat.fuel = 40; g.boat.hull = 50; g.boat.charge = 0; g.pickups.push({ id: 5, kind, x: g.boat.x, y: g.boat.y + 2, value: 3, t: 0 }); run(g, NONE, 0.3); return g; };
    ok(pick('cell').boat.fuel > 60, 'an energy cell refuels');
    ok(pick('repair').boat.hull > 75, 'a repair kit patches the hull');
    ok(pick('jump').boat.charge >= 1, 'a jump cell fills the jump meter');
    ok(pick('core').cores === 3, 'a core adds its value to the run');
    for (const k of ['spread', 'plasma', 'rapid']) { const g = pick(k); ok(g.boat.weapon === k && g.boat.weaponT > 5, `${k} sets the weapon overdrive with a timer`); }
    G = pick('spread'); Gm.step(G, { ...NONE, fire: true }, DT);
    ok(G.shots.length === 6, 'spread shot fires a fan of 6');
    G = pick('overdrive');
    ok(G.boat.overdriveT > 5, 'overdrive starts its timer');
    run(G, { ...NONE }, 2);
    ok(G.boat.speed > C.BOAT.cruise * 1.4, 'and surges the speed');
    const hb = G.boat.hull; Gm.hurt(G, 20, 'test');
    ok(G.boat.hull === hb, 'and makes the boat invulnerable');
    G = pick('shield');
    ok(G.boat.shield === C.BOOSTS.shield.hits, 'a barrier gives BOOSTS.shield.hits hits');
    const hs = G.boat.hull; Gm.hurt(G, 20, 'test');
    ok(G.boat.hull === hs && G.boat.shield === C.BOOSTS.shield.hits - 1, 'and absorbs a hit');
    G = pick('magnet');
    G.pickups.push({ id: 6, kind: 'cell', x: G.boat.x + 9, y: G.boat.y + 8, value: 1, t: 0 });
    run(G, NONE, 1);
    ok(!G.pickups.some((q) => q.id === 6), 'a magnet pulls in a pickup 12 m away');
    G = quiet(1, { amp: 3 }); G.pickups.push({ id: 5, kind: 'rapid', x: G.boat.x, y: G.boat.y + 2, value: 1, t: 0 }); run(G, NONE, 0.3);
    ok(G.boat.weaponT > C.BOOSTS.rapid.time * 1.5, 'Boost Amplifier III makes boosts last longer');

    // bridges
    G = quiet(1);
    G.bridges.push({ id: 77, y: G.boat.y + 25, cx: G.boat.x, hw: 20, hp: 20, down: false });
    run(G, { ...NONE, fire: true }, 2);
    ok(G.bridges[0]?.down && has(G, 'bridge'), 'shooting a bridge brings it down');

    // shockwave landing
    G = quiet(1, { hull: 1, foil: 1, charge: 1, shock: 2 });
    const near = put(G, 'gunboat', 3, 3);
    near.vy = C.BOAT.cruise;
    G.boat.charge = 1;
    Gm.step(G, { ...NONE, jump: true }, DT);
    run(G, (g) => { near.y = g.boat.y + 3; return NONE; }, 1.2);
    ok(near.hp <= D.ENEMIES.gunboat.hp - C.JUMP.shockDamage[2], 'Shockwave Landing II hits what is near the landing');
    G = quiet(1, { hull: 1, foil: 1, charge: 1, shock: 1, barrage: 1 });
    G.boat.charge = 1;
    Gm.step(G, { ...NONE, jump: true }, DT);
    run(G, NONE, 1.2);
    ok(G.events.some((e) => e.type === 'land') && G.shots.length >= C.JUMP.barrageShots - 2, 'Landing Barrage fires a ring of shells');
    G = quiet(1, { fuel: 1, amp: 1, barrier: 2 });
    ok(G.boat.shield === 4, 'Starting Barrier II starts with a 4-hit barrier');

    // bosses
    G = quiet(1);
    Bs.spawnBoss(G, 'souen');
    ok(G.phase === 'boss' && has(G, 'boss'), 'a sector boss appears');
    run(G, NONE, 4);
    const B = G.boss;
    const coreP = B.parts.find((p) => p.role === 'core');
    G.events.length = 0;
    const hpBefore = coreP.hp;
    Bs.hitPart(G, coreP, 10);
    ok(coreP.hp === hpBefore && has(G, 'deflect'), 'phase 1: its core is shielded');
    for (const p of B.parts) if (p.group === 'hulls') Bs.hitPart(G, p, 999);
    ok(B.phase === 1 && G.events.some((e) => e.type === 'phase' && e.name === 'CORE EXPOSED'), 'losing both hulls exposes the core (phase 2)');
    ok(G.bullets.length === 0, 'and a phase change clears the bullets');
    run(G, NONE, 2);
    Bs.hitPart(G, coreP, coreP.max * 0.65);
    ok(B.phase === 2 && G.events.some((e) => e.type === 'phase' && e.overdrive), 'under 40% it goes into overdrive (phase 3)');
    run(G, NONE, 2);
    Bs.hitPart(G, coreP, 9999);
    ok(B.dying > 0 && has(G, 'bossdown'), 'destroying the core brings it down');
    run(G, NONE, 4);
    ok(G.boss === null && has(G, 'bosskill'), 'it sinks and pays out');
    run(G, NONE, 4);
    ok(G.phase === 'dock' && has(G, 'dock'), 'then the sector is clear and the boat docks');
    const ok1 = Gm.nextSector(G, { hull: 2 });
    ok(ok1 && G.sector === 1 && G.phase === 'run' && G.stats.maxHull === 140, 'leaving the dock starts sector 2 with the new skills');
    G = quiet(1);
    Bs.spawnBoss(G, 'kabuto');
    run(G, NONE, 4);
    const kc = G.boss.parts.find((p) => p.role === 'core');
    Bs.hitPart(G, kc, 5);
    ok(kc.hp < kc.max, "a mini-boss's core is open from the start");
    Bs.hitPart(G, kc, 9999);
    run(G, NONE, 3);
    ok(G.boss === null && G.phase === 'run', 'after a mini-boss the sector carries on');

    // the last sector ends the game
    G = Gm.newGame(1, {}, 2);
    clear(G);
    Bs.spawnBoss(G, 'tetsuren');
    run(G, NONE, 4);
    for (const p of G.boss.parts) Bs.hitPart(G, p, 9999);
    for (let i = 0; i < 3 && G.boss; i++) { for (const p of G.boss.parts) { p.dead = false; p.hp = 1; Bs.hitPart(G, p, 9999); } run(G, NONE, 2.5); }
    run(G, NONE, 8);
    ok(G.over && G.won && G.events.some((e) => e.type === 'victory'), 'beating the third boss wins the game');
    for (const k of Object.keys(D.BOSSES)) {
        const d = D.BOSSES[k];
        for (const ph of d.phases) for (const p of ph.patterns) ok(d.parts.some((q) => q.id === p.from), `${k}: pattern ${p.p} fires from a real part (${p.from})`);
        // no part is hidden behind the shielded core (Tetsuren's first draft had one)
        const c = d.parts.find((q) => q.role === 'core');
        if (d.phases.some((ph) => ph.shielded)) for (const q of d.parts) if (q !== c) ok(!(Math.abs(q.dx - c.dx) < c.r + 0.35 && q.dy > c.dy), `${k}: ${q.id} is not hidden behind the shielded core`);
    }
}

// ======================================================================
if (want('skills')) {
    section('skills');
    const meta = { cores: 1000, ranks: {} };
    ok(!Sk.buy(meta, 'foil'), 'a node needs the one above it');
    ok(Sk.buy(meta, 'hull') && meta.cores === 1000 - D.SKILLS[0].nodes[0].cost[0], 'Reinforced Hull I costs its price');
    ok(Sk.buy(meta, 'foil'), 'then the next node opens');
    Sk.buy(meta, 'hull'); Sk.buy(meta, 'hull');
    ok(!Sk.buy(meta, 'hull'), 'no buying past max rank');
    ok(Sk.statsFor(meta.ranks).maxHull === 160, 'Reinforced Hull III: 160 hull');
    const poor = { cores: 3, ranks: {} };
    ok(Sk.blocked(poor.ranks, 'hull', poor.cores) === 'cores' && !Sk.buy(poor, 'hull'), 'not enough cores, no sale');
    const m2 = { cores: 100, ranks: { hull: 1, foil: 1 } };
    ok(!Sk.refundOne(m2, 'hull'), "can't refund a node another node depends on");
    ok(Sk.refundOne(m2, 'foil') && m2.cores === 100 + D.SKILLS[0].nodes[1].cost[0], 'refunding the top rank returns its price');
    const spent = Sk.spent(meta.ranks), before = meta.cores;
    Sk.respec(meta);
    ok(meta.cores === before + spent && Object.keys(meta.ranks).length === 0, 'respec refunds every core');
    const full = {};
    for (const b of D.SKILLS) for (const n of b.nodes) full[n.id] = n.ranks;
    const s0 = Sk.statsFor({}), s1 = Sk.statsFor(full);
    for (const k of Object.keys(s0)) ok(s0[k] !== s1[k], `the tree changes ${k}`);
    console.log(`  whole tree costs ${Sk.spent(full)} cores`);
}

// ======================================================================
if (want('river')) {
    section('river');
    let worst = Infinity, bad = 0, nArena = 0;
    for (let seed = 1; seed <= 60; seed++) {
        for (let s = 0; s < 3; s++) {
            const G = Gm.newGame(seed, {}, s);
            const R = G.river;
            extendRiver(G, 3200);
            let arenas = R.segs.filter((q) => q.len === Infinity).length;
            // walk the boss arenas open as the game does, to reach the second one
            let guard = 0;
            while (!R.bossArena && guard++ < 5) {
                const a = R.segs.find((q) => q.len === Infinity);
                if (!a) break;
                a.len = 80; R.endY = a.y0 + 80;
                extendRiver(G, a.y0 + 900);
                arenas++;
            }
            nArena += arenas;
            for (const seg of R.segs) {
                const n = Rv.narrowest(R, seg);
                worst = Math.min(worst, n);
                if (n < 2 * (C.BOAT.radius + 2.5)) { bad++; if (bad < 4) console.log('   narrow', seed, s, seg.type, n.toFixed(2)); }
                for (let y = seg.y0; y < seg.y0 + Math.min(seg.len, 300); y += 7) {
                    const r = Rv.riverAt(R, y);
                    if (!Number.isFinite(r.cx) || !Number.isFinite(r.hw) || r.hw < 4) bad++;
                }
            }
        }
    }
    ok(bad === 0, `every channel is at least ${(2 * (C.BOAT.radius + 2.5)).toFixed(1)} m wide over 60 seeds × 3 sectors (narrowest ${worst.toFixed(1)} m)`);
    ok(nArena >= 360, `every sector has a mini-boss arena and a boss arena (${nArena} of 360)`);

    // enemies land on the right ground
    const En = await import('../js/sim/enemies.js');
    let wrong = 0, total = 0;
    for (let seed = 1; seed <= 30; seed++) for (let s = 0; s < 3; s++) {
        const G = Gm.newGame(seed, {}, s);
        G.enemies.length = 0;
        for (const sp of G.spawnQ.slice()) En.spawn(G, sp);
        for (const e of G.enemies) {
            if (e.kind === 'blockade') continue;
            total++;
            const sf = Rv.surface(G.river, e.x, e.y);
            const bank = D.ENEMIES[e.kind].where === 'bank' && !e.onBridge;
            if (bank ? sf.kind !== 'bank' : sf.kind !== 'water') { wrong++; if (wrong < 4) console.log('   misplaced', seed, s, e.kind, sf.kind); }
        }
    }
    ok(wrong === 0 && total > 1000, `${total} spawns: boats on the water, tanks and turrets on the bank (${wrong} wrong)`);
}
function extendRiver(G, to) { Rv.extendRiver(G.river, to, () => {}); }

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); run(G, (g) => Bt.botInput(g, b), secs); return { G, b }; };
    const a = play(42, 40).G, b = play(42, 40).G;
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    const roundTrip = (seed, secs, label) => {
        const { G, b: bot } = play(seed, secs);
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b2 = JSON.parse(JSON.stringify(bot));
        for (let t = 0; t < 15; t += DT) {
            if (G.phase === 'dock') { Gm.nextSector(G); Gm.nextSector(copy); }
            Gm.step(G, Bt.botInput(G, bot), DT); Gm.step(copy, Bt.botInput(copy, b2), DT);
        }
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save round trip ${label} plays on identically`);
        return G;
    };
    roundTrip(7, 20, 'mid-sector');
    // find a moment in a boss fight
    const { G: Gb } = play(3, 1);
    const bb = Bt.makeBot({ seed: 3 });
    while (!Gb.boss && !Gb.over) Gm.step(Gb, Bt.botInput(Gb, bb), DT);
    run(Gb, (g) => Bt.botInput(g, bb), 3);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(Gb))));
    const b2 = JSON.parse(JSON.stringify(bb));
    for (let t = 0; t < 15; t += DT) { Gm.step(Gb, Bt.botInput(Gb, bb), DT); Gm.step(copy, Bt.botInput(copy, b2), DT); }
    ok(Gb.boss !== undefined && JSON.stringify(Gm.serialize(Gb)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-boss plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const FULL = {};
    for (const b of D.SKILLS) for (const n of b.nodes) FULL[n.id] = n.ranks;
    const HALF = { hull: 2, foil: 1, rounds: 2, racks: 1, barrels: 1, fuel: 2, amp: 1 };   // ~200 cores: about two weak runs
    const rows = [];
    const plans = [['none', {}], ['some', HALF], ['full', FULL]];
    for (const [plan, ranks] of plans) for (const skill of [1, 0.6, 0.3]) {
        if (plan === 'full' && skill === 1) continue;
        for (let s = 1; s <= SEEDS; s++) {
            const seed = s * 7919 + 13;
            const G = Gm.newGame(seed, ranks);
            const bot = Bt.makeBot({ skill, seed });
            let bad = null;
            const dmg = {};
            while (!G.over && G.t < 1500) {
                if (G.phase === 'dock') Gm.nextSector(G);
                Gm.step(G, Bt.botInput(G, bot), DT);
                for (const e of G.events) if (e.type === 'hurt') dmg[e.cause] = (dmg[e.cause] || 0) + e.dmg;
                G.events.length = 0;
                const b = G.boat;
                if (![b.x, b.y, b.z, b.hull, b.fuel, b.speed, G.score].every(Number.isFinite)) bad = 'non-finite boat state';
                else if (b.hull > G.stats.maxHull + 1e-6 || b.fuel > C.FUEL.max + 1e-6 || b.fuel < 0) bad = 'gauge out of range';
                else if (b.z < 0) bad = 'boat under the water';
                else { const s2 = Rv.surface(G.river, b.x, b.y); if (s2.kind === 'bank' && s2.depth < -0.01) bad = 'boat on the bank'; }
                if (bad) break;
            }
            if (bad) ok(false, `${plan} skill ${skill} seed ${s}: ${bad}`);
            rows.push({ plan, skill, won: G.won, sector: G.sector + (G.won ? 1 : 0), t: G.t, score: G.score, cores: G.cores, jumps: G.jumps, dmg });
        }
    }
    const pick = (plan, skill) => rows.filter((r) => r.plan === plan && r.skill === skill);
    const winRate = (plan, skill) => { const r = pick(plan, skill); return r.length ? r.filter((q) => q.won).length / r.length : NaN; };
    const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    console.log('  plan  skill  win%  sectors(med)  time(med)  cores(med)  jumps(med)  top damage');
    for (const [plan] of plans) for (const skill of [1, 0.6, 0.3]) {
        const r = pick(plan, skill);
        if (!r.length) continue;
        const dm = {};
        for (const q of r) for (const k in q.dmg) dm[k] = (dm[k] || 0) + q.dmg[k];
        const top = Object.entries(dm).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${Math.round(v / r.length)}`).join(', ');
        console.log(`  ${plan.padEnd(5)} ${String(skill).padEnd(5)} ${String(Math.round(winRate(plan, skill) * 100)).padStart(4)}  ${String(med(r.map((q) => q.sector))).padStart(12)}  ${String(Math.round(med(r.map((q) => q.t)))).padStart(9)}  ${String(med(r.map((q) => q.cores))).padStart(10)}  ${String(med(r.map((q) => q.jumps))).padStart(10)}  ${top}`);
    }
    ok(winRate('none', 1) >= 0.6, `a perfect bot with no skills wins at least 60% (${Math.round(winRate('none', 1) * 100)}%): the game can be finished`);
    ok(winRate('none', 0.3) <= 0.34, `a weak bot with no skills usually loses (${Math.round(winRate('none', 0.3) * 100)}%)`);
    ok(med(pick('none', 0.3).map((q) => q.sector)) >= 1, 'but it gets past sector 1 most of the time (no wall at the start)');
    ok(winRate('full', 0.6) >= winRate('none', 0.6), `the skill tree helps a 0.6 bot (${Math.round(winRate('none', 0.6) * 100)}% → ${Math.round(winRate('full', 0.6) * 100)}%)`);
    ok(med(pick('none', 0.3).map((q) => q.cores)) >= 40, 'even a weak run earns enough cores for a few skills');
    ok(med(pick('none', 1).map((q) => q.jumps)) >= 5, 'the perfect bot uses the jump');
    const t = med(pick('none', 1).map((q) => q.t));
    ok(t > 420 && t < 900, `a full run takes ${Math.round(t / 60)} minutes for the perfect bot`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
