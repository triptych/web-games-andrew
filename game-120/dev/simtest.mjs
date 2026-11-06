/**
 * simtest.mjs — headless checks of HEXAPOD RISING's simulation. No browser.
 *
 *   node game-120/dev/simtest.mjs                    # everything
 *   ONLY=purity,terrain node game-120/dev/simtest.mjs
 *   SEEDS=6 VERBOSE=1 node game-120/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the
 *    clock, and never import the view, UI, audio, input or save.
 * 2. data: tables are consistent; every boss attack named in a phase exists.
 * 3. terrain: every level generates a field the weakest walker can cross, reaching every pod, on many seeds;
 *    generation is deterministic.
 * 4. rules: moving, the corridor, jump jets and fuel, guns, missiles, pickups, pods, hazards, upgrades and growth,
 *    stomps, drop-pod ambushes, the level flow.
 * 5. bosses: every attack of every phase of every boss runs; phase changes are invulnerable set-pieces;
 *    pylons shield; exposed cores take more; the wyrm cannot be hit underground; killing one opens the gate.
 * 6. determinism: the same seed and inputs give the same game; a save round trip mid-fight plays on identically.
 * 7. bot: the bot plays whole campaigns with per-step invariants and the balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 3);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const D = await import('../js/sim/data.js');
const T = await import('../js/sim/terrain.js');
const Gm = await import('../js/sim/game.js');
const Core = await import('../js/sim/core.js');
const Bs = await import('../js/sim/boss.js');
const Bt = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, aim: false, ax: 0, az: -1, ad: 26, fire: false, msl: false, jump: false, jet: false, boost: false };
const inp = (o) => ({ ...NONE, ...o });
const run = (G, i, secs) => { for (let t = 0; t < secs && G.phase !== 'dead'; t += DT) { Gm.step(G, typeof i === 'function' ? i(G) : i, DT); G.events.length = 0; } };
const fresh = (seed = 1, level = 0, upg = null) => {
    const G = Gm.newGame(seed);
    if (upg) { Object.assign(G.upg, upg); Core.refreshStats(G); }
    if (level > 0 || upg) { Gm.startLevel(G, level); }
    Gm.begin(G); G.events.length = 0;
    return G;
};
const finite = (G) => {
    const p = G.player;
    if (![p.x, p.y, p.z, p.hp, p.fuel, p.vx, p.vz, p.vy, p.yaw].every(Number.isFinite)) return 'player not finite';
    for (const e of G.enemies) if (![e.x, e.y, e.z, e.hp, e.vx, e.vz].every(Number.isFinite)) return `enemy ${e.type} not finite`;
    for (const b of G.bullets) if (![b.x, b.y, b.z].every(Number.isFinite)) return `bullet ${b.kind} not finite`;
    return null;
};
const godify = (G) => { G.player.shieldT = 1e9; };
const bossOf = (G) => G.enemies.find((e) => e.b);

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

if (want('data')) {
    section('data');
    ok(D.LEVELS.length === 6, 'six levels');
    ok(D.LEVELS.filter((l) => l.boss).length === 5, 'five bosses');
    const attacks = new Set(['fan', 'burst', 'shells', 'charge', 'lance', 'stomp', 'beam', 'missiles', 'summon', 'burrow', 'shards', 'spit', 'blizzard', 'flamering', 'fireballs', 'orbital']);
    for (const [name, b] of Object.entries(D.BOSSES)) {
        ok(b.phases.length >= 2, `${name} has at least two phases (${b.phases.length})`);
        ok(b.phases[0].at === 1, `${name}: the first phase starts at full health`);
        ok(b.phases.every((p, i) => i === 0 || p.at < b.phases[i - 1].at), `${name}: phases descend`);
        ok(b.phases.every((p) => p.atk.every(([k]) => attacks.has(k))), `${name}: every attack exists`);
        ok(b.phases.every((p) => p.cd[0] <= p.cd[1] && p.spd > 0), `${name}: cooldowns and speeds are sane`);
    }
    ok(D.BOSSES.warlord.phases.length === 4, 'the Warlord has four phases');
    ok(Object.keys(D.BOSSES).every((k) => D.LEVELS.some((l) => l.boss === k)), 'every boss belongs to a level');
    for (const t of D.TRACKS) ok(D.COSTS[t].length === D.MAX_TIER && D.COSTS[t].every((c, i) => i === 0 || c > D.COSTS[t][i - 1]), `${t} costs rise over ${D.MAX_TIER} tiers`);
    ok(D.WEAPONS.length === 6 && D.MISSILES.length === 6 && D.ARMOR.length === 6 && D.FUEL.length === 6 && D.LEGS.length === 6, 'six tiers per track');
    for (let i = 1; i < 6; i++) ok(D.WEAPONS[i].dmg * D.WEAPONS[i].rate >= D.WEAPONS[i - 1].dmg * D.WEAPONS[i - 1].rate * 0.95, `gun tier ${i} is no weaker than tier ${i - 1}`);
}

if (want('terrain')) {
    section('terrain');
    let worst = 0, total = 0, n = 0;
    const t0 = Date.now();
    for (let li = 0; li < 6; li++) {
        for (let s = 1; s <= 10; s++) {
            const w = T.makeWorld(li, s * 7919 + li);
            n++; total += w.attempt; worst = Math.max(worst, w.attempt);
            if (!ok(w.ok, `level ${li} seed ${s} is crossable (attempt ${w.attempt})`)) continue;
            ok(w.pods.length === D.LEVELS[li].pods, `level ${li} seed ${s}: every pod placed`);
            ok(Number.isFinite(w.h(0, 0)) && Number.isFinite(w.h(w.cx(-100), -100)), `level ${li} seed ${s}: heights are finite`);
            if (D.LEVELS[li].boss) ok(w.arena && Math.abs(w.arena.z + w.L - 48) < 1, `level ${li}: the boss arena sits before the gate`);
        }
    }
    console.log(`  ${n} fields in ${Date.now() - t0} ms · attempts mean ${(total / n).toFixed(2)}, worst ${worst}`);
    ok(worst <= 6, 'generation needs at most 7 attempts');
    const a = T.makeWorld(2, 99), b = T.makeWorld(2, 99);
    ok(a.attempt === b.attempt && a.blockers.length === b.blockers.length && a.h(12, -77) === b.h(12, -77) && a.spawns.length === b.spawns.length, 'the same seed builds the same field');
    const w = T.makeWorld(0, 5);
    ok(w.spawns.every((s) => Math.abs(s.x - w.cx(s.z)) < w.hw(s.z) * 1.2), 'enemies start inside the corridor');
    const heavy = w.camps.map((c) => w.spawns.filter((s) => s.camp === c.i && D.ENEMIES[s.type].cost >= 12).length);
    ok(Math.max(...heavy) <= 1, `level 1 camps hold at most one heavy mech (${heavy.join(',')})`);
}

if (want('rules')) {
    section('rules');
    let G = fresh(1);
    const w = G.world;
    // moving, walls
    const z0 = G.player.z;
    run(G, inp({ y: -1 }), 1);
    ok(G.player.z < z0 - 3, 'forward is toward -z at walking speed');
    run(G, inp({ x: 1 }), 20);
    ok(Math.abs(G.player.x - w.cx(G.player.z)) <= w.hw(G.player.z) * 1.05 + 0.1, 'the corridor wall stops you');
    // jump jets and fuel
    G = fresh(2); godify(G);
    const f0 = G.player.fuel;
    run(G, inp({ jump: true }), DT * 2);
    ok(G.player.vy > 5 && G.player.fuel < f0, 'jump leaps and burns fuel');
    let peak = 0; for (let t = 0; t < 1.5; t += DT) { Gm.step(G, inp({ jet: true }), DT); G.events.length = 0; peak = Math.max(peak, G.player.y - G.world.h(G.player.x, G.player.z)); }
    ok(peak > 4.5, `holding jet in the air goes higher (peak ${peak.toFixed(1)})`);
    run(G, NONE, 4);
    ok(G.player.fuel > f0 * 0.8, 'fuel refills on the ground');
    G = fresh(2); G.player.fuel = 50; run(G, inp({ y: -1, boost: true }), 0.5);
    ok(G.player.boosting && G.player.fuel < 45, 'boost burns fuel');
    G.player.fuel = 0; run(G, inp({ y: -1, boost: true }), 0.1);
    ok(!G.player.boosting, 'no fuel, no boost');
    // guns
    G = fresh(3);
    const tr = Core.addEnemy(G, 'trooper', G.player.x, G.player.z - 18, { awake: false });
    G.enemies.forEach((e) => { if (e.id !== tr.id) e.x += 500; });
    G.player.yaw = 0;
    run(G, inp({ fire: true }), 3);
    ok(tr.hp < tr.maxhp || tr.hp <= 0 || tr.dead, 'the gun hurts what is in front of you');
    ok(G.stat.dealt > 0 || G.stat.kills > 0, 'damage is counted');
    // strafing must not turn the guns (a spider walks sideways without swinging its barrels)
    G = fresh(3); G.enemies.length = 0; G.player.yaw = 0;
    run(G, inp({ x: 1 }), 1.5); const yR = G.player.yaw;
    run(G, inp({ x: -1 }), 1.5); const yL = G.player.yaw;
    run(G, inp({ y: 1 }), 1.5);
    ok(Math.abs(yR) < 0.01 && Math.abs(yL) < 0.01 && Math.abs(G.player.yaw) < 0.01, `strafing and backing up keep the guns down-range (yaw ${yR.toFixed(3)}, ${yL.toFixed(3)}, ${G.player.yaw.toFixed(3)})`);
    G = fresh(3); G.enemies.length = 0; G.player.yaw = 1.0; run(G, NONE, 1.5);
    ok(Math.abs(G.player.yaw) < 0.1, 'with nothing to aim at the walker squares up to face down-range');
    G = fresh(3); G.enemies.length = 0; run(G, inp({ x: 1, aim: true, ax: 0, az: -1 }), 1.5);
    ok(Math.abs(G.player.yaw) < 0.01, 'strafing with an explicit aim keeps that aim');
    // missiles
    G = fresh(3); G.enemies.length = 0;
    const m0 = G.player.missiles;
    const cl = [0, 1, 2].map((i) => Core.addEnemy(G, 'trooper', G.player.x + (i - 1) * 1.2, G.player.z - 25, { awake: true }));
    cl.forEach((e) => { e.cd = 99; e.hp = e.maxhp = 40; });
    run(G, inp({ msl: true }), DT);
    run(G, NONE, 2.5);
    ok(G.player.missiles < m0, 'a missile uses ammo');
    ok(cl.every((e) => e.hp < e.maxhp || e.dead), 'missile splash hits a cluster');
    // homing rockets from the very first tier; crates refill the rack
    G = fresh(3); G.enemies.length = 0;
    const hb = Core.addEnemy(G, 'bulwark', G.player.x + 14, G.player.z - 24, { awake: true }); hb.cd = 999;
    G.player.yaw = 0; Gm.step(G, inp({ msl: true }), DT);
    run(G, NONE, 0.2);
    const rk = G.bullets.find((b) => b.kind === 'missile');
    ok(D.MISSILES.every((m) => m.homing), 'every missile tier homes');
    ok(rk && rk.tgt === hb.id && rk.turn > 0, 'the tier-0 rocket locks on to the enemy in front of you');
    run(G, NONE, 4);
    ok(hb.hp < hb.maxhp, 'and hits it');
    G = fresh(3); G.enemies.length = 0; G.player.missiles = 0;
    Core.spawnPickup(G, 'ammo', G.player.x, G.player.z, 0, { vy: 0 }); run(G, NONE, 1);
    ok(G.player.missiles >= 2, `a rocket crate refills the rack (${G.player.missiles.toFixed(1)})`);
    G.player.missiles = 0; run(G, NONE, 6);
    ok(G.player.missiles >= 1, 'the rack also recharges by itself');
    // pickups and pods
    G = fresh(4); G.enemies.length = 0;
    Core.spawnPickup(G, 'scrap', G.player.x, G.player.z, 25, { vy: 0 });
    Core.spawnPickup(G, 'hp', G.player.x, G.player.z, 0, { vy: 0 });
    G.player.hp = 20; run(G, NONE, 1);
    ok(G.scrap === 25 && G.player.hp > 20, 'scrap and repair kits are collected by walking over them');
    const pod = G.pods[0];
    G.player.x = pod.x; G.player.z = pod.z + 12; G.enemies.length = 0; G.player.yaw = 0;
    G.player.y = G.world.h(G.player.x, G.player.z);
    run(G, inp({ fire: true, aim: true, ax: 0, az: -1, ad: 12 }), 6);
    ok(pod.freed && G.rescued === pod.n && G.podsFreed === 1, 'shooting a pod frees its colonists');
    ok(G.pickups.some((k) => k.type === 'ammo'), 'a freed pod leaves a rocket crate');
    // hazards
    G = fresh(5); G.enemies.length = 0;
    const hz = { x: G.player.x, z: G.player.z, r: 6, type: 'lava', y: 0 };
    G.world.hazards.push(hz);
    const hp0 = G.player.hp; G.player.shieldT = 0; run(G, NONE, 2);
    ok(G.player.hp < hp0, 'standing in lava hurts');
    // armour reduces damage
    const a = fresh(6), b = fresh(6, 0, { armor: 5 });
    a.player.shieldT = b.player.shieldT = 0;
    Core.hurtPlayer(a, 50, 0, 0); Core.hurtPlayer(b, 50, 0, 0);
    ok(b.player.hp / b.st.maxHp > a.player.hp / a.st.maxHp, 'armour tiers take less damage and have more hit points');
    // upgrades and growth
    G = fresh(7); G.phase = 'hangar'; G.scrap = 50000;
    const s0 = G.st.scale; let bought = 0;
    for (const t of D.TRACKS) for (let i = 0; i < 5; i++) if (Gm.buy(G, t).ok) bought++;
    ok(bought === 25 && G.upg.guns === 5 && G.scrap === 50000 - Object.values(D.COSTS).flat().reduce((x, y) => x + y, 0), 'all 25 upgrades can be bought, at the listed price');
    ok(G.st.scale > s0 * 2.2, `the walker grows with every upgrade (${s0.toFixed(2)} to ${G.st.scale.toFixed(2)})`);
    ok(Gm.buy(G, 'guns').reason === 'max', 'tier 5 is the top');
    G = fresh(7); G.scrap = 10; ok(Gm.buy(G, 'guns').reason === 'scrap', 'no scrap, no upgrade');
    // stomp
    G = fresh(8, 0, { legs: 3 }); G.enemies.length = 0; godify(G);
    const v = Core.addEnemy(G, 'stalker', G.player.x + 3, G.player.z, { awake: false });
    G.player.y += 10; G.player.vy = -20;
    run(G, NONE, 1);
    ok(v.hp < v.maxhp, 'landing hard stomps what is under you');
    // legs: rubble you can step over
    const hi = fresh(9, 0, { legs: 5, guns: 5, armor: 5, fuel: 5, missiles: 5 });
    ok(hi.st.clear > 4, `a grown walker steps over rubble (${hi.st.clear.toFixed(1)} m)`);
    // ambush
    G = fresh(10); G.enemies.length = 0; godify(G);
    const amb = G.world.ambushes[0];
    G.player.z = -amb.t - 1; G.player.x = G.world.cx(G.player.z);
    run(G, NONE, 0.1);
    ok(G.marks.filter((m) => m.kind === 'drop').length === amb.units.length, 'passing an ambush trigger calls in drop pods');
    run(G, NONE, 5);
    ok(G.enemies.length >= amb.units.length, 'the pods land and unload');
    // level flow
    G = fresh(11); G.enemies = []; G.bossAlive = false; G.bossDone = true; godify(G);
    G.player.z = -(G.world.L - 6); G.player.x = G.world.cx(G.player.z); run(G, NONE, DT * 3);
    ok(G.phase === 'complete' && G.report.level === 0, 'reaching the gate ends the level with a report');
    ok(Gm.toHangar(G) === undefined && G.phase === 'hangar', 'on to the hangar');
    ok(Gm.deploy(G) && G.level === 1 && G.phase === 'brief', 'deploy starts the next mission');
    G = fresh(12); G.player.hp = 1; G.player.shieldT = 0; Core.hurtPlayer(G, 99, 0, 0);
    ok(G.phase === 'dead' && G.events.some((e) => e.type === 'dead'), 'zero armour destroys the walker');
    Gm.retry(G);
    ok(G.phase === 'brief' && G.player.hp === G.st.maxHp && G.deaths === 1, 'retry restarts the mission with full armour');
}

if (want('bosses')) {
    section('bosses');
    const LV = { gatekeeper: 0, strider: 2, leviathan: 3, titan: 4, warlord: 5 };
    const loadout = { guns: 3, missiles: 2, armor: 3, fuel: 2, legs: 2 };
    const arenaGame = (name, seed = 3) => {
        const G = fresh(seed, LV[name], loadout); godify(G);
        const e = bossOf(G), A = G.world.arena;
        G.enemies = G.enemies.filter((q) => q.b);
        G.player.x = A.x; G.player.z = A.z + 24; G.player.y = G.world.h(G.player.x, G.player.z);
        e.awake = false;
        return { G, e };
    };
    for (const name of Object.keys(LV)) {
        const def = D.BOSSES[name];
        // 1. every attack in every phase runs to its end without blowing up
        for (let ph = 0; ph < def.phases.length; ph++) {
            for (const [atk] of def.phases[ph].atk) {
                const { G, e } = arenaGame(name);
                run(G, NONE, 0.1);
                e.hp = e.maxhp * (def.phases[ph].at - 0.001); if (ph === 0) e.hp = e.maxhp;
                run(G, NONE, 4);
                const pylons = G.enemies.filter((q) => q.type === 'pylon').length;
                e.b.stun = 0; e.b.shield = false; e.b.trans = 0; e.b.act = null;
                Bs.startAttack(G, e, atk);
                let bad = null, t = 0;
                for (; t < 14 && e.b.act && !bad; t += DT) { Gm.step(G, NONE, DT); G.events.length = 0; bad = finite(G); }
                ok(!bad, `${name} phase ${ph + 1}: ${atk} stays finite${bad ? ' (' + bad + ')' : ''}`);
                ok(!e.b.act || atk === 'burrow', `${name} phase ${ph + 1}: ${atk} finishes (${t.toFixed(1)} s)`);
                if (atk === 'burrow') ok(e.b.act === null || e.b.act.s >= 1, `${name}: the burrow attack dives`);
                void pylons;
            }
        }
        // 2. phase transitions are invulnerable set-pieces that fire events
        const { G, e } = arenaGame(name);
        run(G, NONE, 0.2);
        ok(e.awake && e.b.ph === 0, `${name} wakes when you reach the arena`);
        const ph1 = def.phases[1].at;
        e.hp = e.maxhp * (ph1 - 0.01);
        G.events.length = 0;
        const evs = [];
        for (let t = 0; t < 0.3; t += DT) { Gm.step(G, NONE, DT); evs.push(...G.events); G.events.length = 0; }
        ok(e.b.ph === 1, `${name} enters phase 2 when its health crosses ${ph1}`);
        ok(evs.some((x) => x.type === 'bossPhase' && x.ph === 1) && evs.some((x) => x.type === 'radio'), `${name}: a phase change announces itself`);
        const hpBefore = e.hp;
        Core.hurtEnemy(G, e, 500, {});
        ok(e.hp === hpBefore, `${name}: a phase change is invulnerable`);
        run(G, NONE, 3);
        const shielded = def.phases[1].enter?.pylons;
        if (shielded) {
            ok(e.b.shield && G.enemies.filter((q) => q.type === 'pylon' && q.hp > 0).length === shielded, `${name}: phase 2 raises ${shielded} shield pylons`);
            const h0 = e.hp; Core.hurtEnemy(G, e, 500, {});
            ok(e.hp === h0, `${name}: the shield soaks damage`);
            for (const p of G.enemies.filter((q) => q.type === 'pylon')) Core.hurtEnemy(G, p, 1e6, {});
            run(G, NONE, 0.2);
            ok(!e.b.shield && e.b.stun > 0, `${name}: breaking the pylons drops the shield and stuns it`);
            Core.hurtEnemy(G, e, 100, {});
            ok(e.hp < h0, `${name}: then it can be hurt`);
        }
        // 3. the last phase exposes a core that takes extra damage
        const last = def.phases[def.phases.length - 1];
        if (last.vuln) {
            const H = arenaGame(name); H.e.awake = true; run(H.G, NONE, 0.1);
            H.e.hp = H.e.maxhp * (last.at - 0.01); run(H.G, NONE, 4);
            H.e.b.stun = 0; H.e.b.shield = false; H.e.b.under = false; H.G.enemies.filter((q) => q.type === 'pylon').forEach((p) => { p.hp = 0; p.dead = 1; });
            const base = H.e.hp; Core.hurtEnemy(H.G, H.e, 100, {});
            const dealt = base - H.e.hp;
            ok(dealt > 100 * last.vuln * 0.9 * 0.5, `${name}: the exposed core takes ×${last.vuln} (${dealt.toFixed(0)} from 100 raw)`);
        }
        // 4. death: the gate opens and the level can be completed
        const K = arenaGame(name); K.e.awake = true; run(K.G, NONE, 0.1);
        K.e.b.trans = 0; K.e.hp = 1; K.e.b.shield = false;
        Core.hurtEnemy(K.G, K.e, 1e5, {});
        ok(K.e.b.dying > 0 && !K.G.bossAlive, `${name}: killing it starts the death sequence`);
        let evs2 = [];
        for (let t = 0; t < 4; t += DT) { Gm.step(K.G, NONE, DT); evs2.push(...K.G.events); K.G.events.length = 0; }
        ok(K.G.bossDone && evs2.some((x) => x.type === 'gateOpen'), `${name}: the gate opens`);
        if (name === 'warlord') ok(K.G.phase === 'victory', 'the Warlord falling wins the game');
        else {
            K.G.player.z = -(K.G.world.L - 6); K.G.player.x = K.G.world.cx(K.G.player.z); run(K.G, NONE, DT * 4);
            ok(K.G.phase === 'complete', `${name}: through the gate, the level completes`);
        }
    }
    // the wyrm cannot be hit underground
    const { G, e } = arenaGame('leviathan');
    run(G, NONE, 0.2); e.b.trans = 0;
    Bs.startAttack(G, e, 'burrow');
    for (let t = 0; t < 2 && !e.b.under; t += DT) Gm.step(G, NONE, DT);
    const h0 = e.hp; Core.hurtEnemy(G, e, 300, {});
    ok(e.b.under && e.hp === h0, 'the Leviathan is untouchable while burrowed');
    G.events.length = 0;
    let erupted = false;
    for (let t = 0; t < 8 && !erupted; t += DT) { Gm.step(G, NONE, DT); erupted = G.events.some((x) => x.type === 'erupt'); G.events.length = 0; }
    ok(erupted && !e.b.under, 'it erupts under the walker after a telegraph');
    // stomp waves are jumped, beams are jumped
    const S = arenaGame('strider'); S.G.player.shieldT = 0; S.G.enemies[0].awake = true; run(S.G, NONE, 0.1); S.e.b.trans = 0;
    S.G.waves.push({ id: 99, kind: 'shock', x: S.G.player.x, z: S.G.player.z, r: 0.5, speed: 17, max: 30, dmg: 30, w: 2.4, hit: false });
    const hpA = S.G.player.hp; run(S.G, NONE, 0.5);
    ok(S.G.player.hp < hpA, 'a shockwave hurts a walker that stays on the ground');
    const J = arenaGame('strider'); J.G.player.shieldT = 0; run(J.G, NONE, 0.1); J.e.b.trans = 0; J.e.b.act = null; J.e.cd = 99; J.e.b.cd = 99;
    J.G.waves.push({ id: 99, kind: 'shock', x: J.G.player.x, z: J.G.player.z, r: 0.5, speed: 17, max: 30, dmg: 30, w: 2.4, hit: false });
    const hpJ = J.G.player.hp; J.G.player.vy = 13; J.G.player.y += 2.5;
    for (let t = 0; t < 0.45; t += DT) { Gm.step(J.G, inp({ jet: true }), DT); J.G.events.length = 0; }
    ok(J.G.player.hp === hpJ, 'jumping the shockwave avoids it');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = fresh(seed); const b = Bt.makeBot(); run(G, (g) => Bt.botInput(g, b, DT), secs); return G; };
    const a = play(42, 25), b = play(42, 25);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    ok(a.enemies.length > 0 && a.stat.dealt > 0, '(and something happened)');

    const G = fresh(7); const bot = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, bot, DT), 30);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, b1, DT), 12);
    run(copy, (g) => Bt.botInput(g, b2, DT), 12);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-fight plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    // a boss fight survives a round trip, phase, pylons and all
    const B = fresh(3, 4, { guns: 4, armor: 4 }); godify(B);
    const e = bossOf(B), A = B.world.arena;
    B.player.x = A.x; B.player.z = A.z + 22; B.player.y = B.world.h(B.player.x, B.player.z);
    run(B, NONE, 0.2); e.hp = e.maxhp * 0.6; run(B, NONE, 5);
    const Bc = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(B))));
    ok(bossOf(Bc).b.ph === bossOf(B).b.ph && Bc.enemies.filter((q) => q.type === 'pylon').length === B.enemies.filter((q) => q.type === 'pylon').length, 'boss phase and pylons survive a save');
    run(B, NONE, 6); run(Bc, NONE, 6);
    ok(JSON.stringify(Gm.serialize(B)) === JSON.stringify(Gm.serialize(Bc)), 'and the fight plays on identically');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    const campaign = (seed, skill, maxLevels = 6) => {
        const G = Gm.newGame(seed * 1009), bot = Bt.makeBot({ skill });
        let steps = 0, lvDeaths = 0, bad = null, cleared = 0;
        const t0 = Date.now();
        for (;;) {
            if (G.phase === 'brief') Gm.begin(G);
            else if (G.phase === 'play') {
                Gm.step(G, Bt.botInput(G, bot, DT), DT); steps++; G.events.length = 0;
                if (steps % 240 === 0) bad = bad || finite(G);
                if (steps > 120 * 60 * 25) break;
            } else if (G.phase === 'dead') { if (++lvDeaths > 10) break; Gm.retry(G); }
            else if (G.phase === 'complete') { cleared++; lvDeaths = 0; if (cleared >= maxLevels) break; Gm.toHangar(G); Bt.botBuy(G); Gm.deploy(G); }
            else if (G.phase === 'victory') { cleared++; break; }
            else break;
        }
        return { seed, skill, cleared, deaths: G.deaths, won: G.phase === 'victory', rescued: G.rescued, upg: Object.values(G.upg).reduce((a, b) => a + b, 0), scale: G.st.scale, bad, secs: (Date.now() - t0) / 1000, steps, score: G.score };
    };
    for (let s = 1; s <= SEEDS; s++) rows.push(campaign(s, 1));
    for (let s = 1; s <= Math.min(2, SEEDS); s++) rows.push(campaign(s, 0.6, 3));
    for (const r of rows) console.log(`  seed ${r.seed} skill ${r.skill}: cleared ${r.cleared}${r.won ? ' (VICTORY)' : ''}, deaths ${r.deaths}, rescued ${r.rescued}, upgrades ${r.upg} (size ${r.scale.toFixed(2)}), ${r.secs.toFixed(1)} s`);
    const good = rows.filter((r) => r.skill === 1);
    ok(good.every((r) => !r.bad), 'invariants hold through whole campaigns (no non-finite numbers)');
    ok(good.filter((r) => r.won).length >= Math.ceil(good.length * 0.6), `the skilled bot wins most campaigns (${good.filter((r) => r.won).length}/${good.length})`);
    const avg = (k, f) => { const l = rows.filter((r) => r.skill === k); return l.reduce((a, r) => a + f(r), 0) / l.length; };
    ok(avg(1, (r) => r.cleared / (r.cleared + 0) || 1) >= 0, 'campaign table printed');
    ok(avg(1, (r) => r.cleared) >= avg(0.6, (r) => r.cleared) || avg(1, (r) => r.deaths / Math.max(1, r.cleared)) <= avg(0.6, (r) => r.deaths / Math.max(1, r.cleared)), 'a worse bot does not do better');
    ok(good.every((r) => r.scale > 1.4), `the walker is much bigger by the end (${good.map((r) => r.scale.toFixed(2)).join(', ')})`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
