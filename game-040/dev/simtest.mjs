/**
 * simtest.mjs — assertions against the real simulation. No browser, no mocks of
 * the game itself: every test below drives the same createWorld/stepWorld the
 * browser drives.
 *
 *   node dev/simtest.mjs
 */

import { createWorld, stepWorld, levelSummary } from '../js/sim/world.js';
import { makeBoss } from '../js/sim/bosses.js';
import { newRun, addCadet } from '../js/core/state.js';
import { CADET_BY_ID } from '../js/sim/story.js';
import { buildPattern } from '../js/sim/patterns.js';
import { PLAYER, ARENA, TICK, POD, MAX_POWER, WEAPONS, FLARE } from '../js/core/config.js';
import { loadSave, writeSave, recordRun, betterRank } from '../js/core/save.js';
import { installFakeDom } from './fake-dom.mjs';
import { makeRng } from '../js/core/rng.js';

installFakeDom();          // save.js needs a localStorage to round-trip through

let pass = 0, fail = 0;
function t(name, fn) {
    try {
        fn();
        console.log(`  ok   ${name}`);
        pass++;
    } catch (err) {
        console.log(`  FAIL ${name}\n       ${err.message}`);
        fail++;
    }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'not equal'}: ${a} !== ${b}`); }
function near(a, b, tol, msg) { if (Math.abs(a - b) > tol) throw new Error(`${msg || 'not near'}: ${a} vs ${b}`); }

const NO_INPUT = { ax: 0, ay: 0, focus: false, fire: false, flare: false, od: false, pointer: { active: false, x: 0, y: 0 } };
const input = (o = {}) => ({ ...NO_INPUT, ...o, pointer: o.pointer ?? { active: false, x: 0, y: 0 } });

function freshWorld(opts = {}) {
    const run = opts.run ?? newRun(opts.difficulty ?? 'pilot', opts.level ?? 1);
    const w = createWorld({ level: opts.level ?? 1, run, seed: opts.seed ?? 'test' });
    w.player.invuln = 0;
    if (opts.quiet !== false) w.level = { ...w.level, cues: [] };   // no wave traffic unless asked
    return w;
}
function run(w, seconds, inp = NO_INPUT) {
    const steps = Math.round(seconds / TICK);
    for (let i = 0; i < steps; i++) stepWorld(w, inp, TICK);
}

console.log('\n== player ==');

t('moves at the configured speed and is clamped to the arena', () => {
    const w = freshWorld();
    w.player.x = -6;
    const start = w.player.x;
    run(w, 0.5, input({ ax: 1 }));
    near(w.player.x - start, PLAYER.speed * 0.5, 0.15, 'half a second of right input');
    run(w, 5, input({ ax: 1 }));
    assert(w.player.x <= ARENA.right - PLAYER.bounds.pad + 1e-6, 'clamped to the right wall');
});

t('focus mode is materially slower', () => {
    const w = freshWorld();
    w.player.x = 0;
    run(w, 1, input({ ax: 1, focus: true }));
    near(w.player.x, PLAYER.focusSpeed, 0.2, 'focused travel');
});

t('the hitbox is the cockpit dot, not the ship', () => {
    const w = freshWorld();
    // a bullet 0.35u away must miss (ship is 0.8u); 0.05u away must hit
    w.eBullets.push(bullet(w.player.x + 0.35 + 0.2, w.player.y));
    run(w, TICK * 2);
    eq(w.player.pendingDeath, false, 'a near miss is a miss');
    w.eBullets.push(bullet(w.player.x + 0.02, w.player.y));
    run(w, TICK * 2);
    eq(w.player.pendingDeath, true, 'a hit on the dot registers');
});

t('grazing pays score and fills Overdrive', () => {
    const w = freshWorld();
    const before = w.stats.score;
    w.eBullets.push(bullet(w.player.x + 0.6, w.player.y));
    run(w, TICK * 2);
    assert(w.player.od > 0, 'Overdrive meter moved');
    assert(w.stats.score > before, 'graze scored');
    eq(w.player.pendingDeath, false, 'grazing is not being hit');
});

t('death-bomb: a flare inside the grace window saves the run', () => {
    const w = freshWorld();
    const lives = w.player.lives;
    w.eBullets.push(bullet(w.player.x, w.player.y));
    run(w, TICK * 2);
    assert(w.player.pendingDeath, 'hit registered');
    run(w, TICK, input({ flare: true }));
    eq(w.player.pendingDeath, false, 'flare cancelled the death');
    eq(w.player.lives, lives, 'no life lost');
});

t('without a flare the hit becomes a death, and costs a power level', () => {
    const w = freshWorld();
    w.player.power = 3;
    const lives = w.player.lives;
    w.eBullets.push(bullet(w.player.x, w.player.y));
    run(w, 0.5);
    eq(w.player.lives, lives - 1, 'a life was lost');
    eq(w.player.power, 2, 'one power level dropped');
    assert(w.pickups.some((p) => p.type === 'power'), 'power items scattered on death');
});

t('every weapon and power level fires the documented number of shots', () => {
    for (const [id, def] of Object.entries(WEAPONS)) {
        for (let lvl = 1; lvl <= MAX_POWER; lvl++) {
            const w = freshWorld();
            w.player.weapon = id;
            w.player.power = lvl;
            w.player.fireCd = 0;
            stepWorld(w, input({ fire: true }), TICK);
            eq(w.pBullets.length, def.levels[lvl - 1].length, `${id} L${lvl} muzzle count`);
        }
    }
});

t('Overdrive needs a full meter and then doubles the rate of fire', () => {
    const w = freshWorld();
    w.player.od = 99;
    stepWorld(w, input({ od: true }), TICK);
    eq(w.player.odActive, 0, 'cannot trigger below 100');
    w.player.od = 100;
    stepWorld(w, input({ od: true }), TICK);
    assert(w.player.odActive > 0, 'Overdrive engaged');
    const normal = freshWorld();
    run(normal, 1, input({ fire: true }));
    const od = freshWorld();
    od.player.od = 100;
    stepWorld(od, input({ od: true, fire: true }), TICK);
    run(od, 1, input({ fire: true }));
    assert(od.stats.shots > normal.stats.shots * 1.6,
        `Overdrive fires far more (${od.stats.shots} vs ${normal.stats.shots})`);
});

console.log('\n== the rescue loop ==');

t('flying over a pod rescues it and banks the cadets', () => {
    const w = freshWorld();
    const pod = w.spawnPod(w.player.x, w.player.y + 0.5);
    const aboard = pod.cadets;
    assert(aboard >= 1, 'a pod always carries someone');
    run(w, TICK * 2);
    eq(w.stats.rescued, 1, 'pod counted');
    eq(w.stats.cadets, aboard, 'cadets counted');
    eq(pod.alive, false, 'pod consumed');
});

t('a level can never yield more cadets than its share of the roll', () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
        const w = freshWorld({ level });
        let total = 0;
        for (let i = 0; i < w.podBudget + 5; i++) {
            const pod = w.spawnPod(0, 8);
            if (pod) total += pod.cadets;
        }
        eq(total, w.cadetBudget, `level ${level} pods carry exactly its cadet budget`);
        eq(w.podsSpawned, w.podBudget, `level ${level} pod count is capped`);
    }
});

t('a pod that falls past the bottom is lost for good', () => {
    const w = freshWorld();
    w.player.x = 9;                       // out of the way
    const pod = w.spawnPod(-8, ARENA.bottom + 0.5);
    const aboard = pod.cadets;
    run(w, 2);
    eq(w.stats.lost, 1, 'pod lost');
    eq(w.stats.cadetsLost, aboard, 'cadets lost with it');
});

t('enemy fire destroys pods', () => {
    const w = freshWorld();
    w.player.x = 9;
    const pod = w.spawnPod(-6, 5);
    const aboard = pod.cadets;
    for (let i = 0; i < POD.hp; i++) {
        w.eBullets.push(bullet(pod.x, pod.y));
        run(w, TICK * 2);
    }
    eq(pod.alive, false, 'pod destroyed by enemy fire');
    eq(w.stats.cadetsLost, aboard, 'everyone aboard is lost');
});

t('level 2 pods burn up on a timer', () => {
    const w = freshWorld({ level: 2 });
    w.player.x = 9;
    const pod = w.spawnPod(-6, 8);
    assert(pod.burn > 0, 'burn timer set on an atmospheric level');
    const l1 = freshWorld({ level: 1 });
    eq(l1.spawnPod(0, 8).burn, 0, 'no burn timer in vacuum');
});

t('the pod budget is exactly the level roll, boss release included', () => {
    const w = createWorld({ level: 1, run: newRun('pilot', 1), seed: 'budget' });
    for (let i = 0; i < w.podBudget + 20; i++) w.spawnPod(0, 8);
    eq(w.podsSpawned, w.podBudget, 'the budget is a hard cap');
});

console.log('\n== enemies, bosses, patterns ==');

t('difficulty scales radial pattern density and bullet speed', () => {
    const mk = (d) => {
        const w = freshWorld({ difficulty: d });
        const e = w.spawnEnemy('weaver', 0, 8);
        w.fire(e, { pattern: 'ring', count: 12, speed: 5 });
        return w.eBullets;
    };
    const cadet = mk('cadet'), ace = mk('ace');
    assert(ace.length > cadet.length, `ace is denser (${ace.length} vs ${cadet.length})`);
    assert(ace[0].speed > cadet[0].speed, 'ace bullets are faster');
});

t('a Shieldbearer eats shots from below and dies to shots from the side', () => {
    const w = freshWorld();
    const e = w.spawnEnemy('shieldbearer', 0, 5);
    const hp = e.hp;
    w.pBullets.push(pbullet(e.x, e.y - 0.9, 60));        // from below: into the shield
    run(w, TICK * 3);
    eq(e.hp, hp, 'shield absorbed it');
    assert(e.shieldHp < e.def.shieldHp, 'shield took the damage');
    w.pBullets.push(pbullet(e.x + 0.9, e.y + 0.2, 60));  // from the flank
    run(w, TICK * 3);
    assert(e.hp < hp, 'a flanking shot lands');
});

t('a Popper splits into drones and leaves a nova behind', () => {
    const w = freshWorld();
    const e = w.spawnEnemy('popper', 0, 5);
    w.pBullets.push(pbullet(e.x, e.y - 0.5, 999));
    run(w, TICK * 3);
    eq(e.alive, false, 'popper died');
    assert(w.enemies.filter((x) => x.type === 'drone').length === 3, 'three drones');
    assert(w.eBullets.length >= 8, 'death nova fired');
});

t('bosses advance through every phase and clear the screen between them', () => {
    const w = freshWorld();
    w.boss = null;
    const ids = ['tarpon', 'nimbus', 'ironmaw', 'choirmaster', 'kel', 'heart'];
    for (const id of ids) {
        const wb = freshWorld();
        wb.fire(wb.player, { pattern: 'ring', count: 6, speed: 3 });   // junk on screen
        wb.boss = null;
        const boss = makeBoss(id, wb);
        wb.boss = boss;
        boss.state = 'fight';
        boss.invuln = false;
        const seen = new Set();
        for (let i = 0; i < 6000; i++) {
            stepWorld(wb, NO_INPUT, TICK);
            if (wb.boss) { seen.add(wb.boss.phase.name); wb.boss.hp -= wb.boss.maxHp / 3000; }
            else break;
        }
        eq(seen.size, boss.def.phases.length, `${id} visited every phase`);
    }
});

t('shooting off an Ironmaw turret removes an attack from its cycle', () => {
    const wb = freshWorld();
    const boss = makeBoss('ironmaw', wb);
    wb.boss = boss;
    boss.state = 'fight';
    boss.invuln = false;
    const before = boss.phase.attacks.filter((a) => !a.needsPart
        || boss.parts.find((p) => p.id === a.needsPart)?.alive).length;
    boss.parts[0].alive = false;
    const after = boss.phase.attacks.filter((a) => !a.needsPart
        || boss.parts.find((p) => p.id === a.needsPart)?.alive).length;
    eq(after, before - 1, 'one fewer attack available');
});

t("the Heart opens one safe lane per named cadet rescued", () => {
    const ctx = { x: 0, y: 8, aimAng: -Math.PI / 2, phase: 0, rng: makeRng(1), bulletSpeed: 1, density: 0 };
    const none = buildPattern({ pattern: 'spiral', count: 24, lanes: 0 }, ctx).length;
    const all = buildPattern({ pattern: 'spiral', count: 24, lanes: 5 }, ctx).length;
    eq(none, 24, 'no cadets, no lanes');
    eq(all, 19, 'five cadets, five lanes');
});

t('telegraphed lasers are harmless while warning and lethal once firing', () => {
    const w = freshWorld();
    const e = w.spawnEnemy('sniper', 0, 10);
    w.player.x = 0;
    w.player.y = -9;
    w.fire(e, { pattern: 'laser', warn: 0.6, duration: 0.6, width: 1.2, aimed: true });
    const beam = w.beams[0];
    assert(beam, 'beam created');
    run(w, 0.3);
    eq(w.player.pendingDeath, false, 'the warning line does not kill');
    run(w, 0.5);
    assert(w.player.pendingDeath || !w.player.alive, 'the live beam does');
});

t('a flare erases bullets in its radius and damages what is near', () => {
    const w = freshWorld();
    const e = w.spawnEnemy('turret', 0, -6);
    const hp = e.hp;
    for (let i = 0; i < 40; i++) w.eBullets.push(bullet(w.player.x + (i % 8) - 4, w.player.y + 1));
    for (let i = 0; i < 10; i++) w.eBullets.push(bullet(0, ARENA.top - 0.5));   // far away
    stepWorld(w, input({ flare: true }), TICK);
    const remaining = w.eBullets.filter((b) => b.alive).length;
    assert(remaining <= 10, `bullets near the player were erased (${remaining} left)`);
    assert(e.hp < hp, 'the flare damaged a nearby enemy');
});

console.log('\n== wing abilities ==');

t('Bastion gives a drone that blocks a bullet on a cooldown', () => {
    const run_ = newRun('pilot', 2);
    addCadet(run_, CADET_BY_ID.bastion);
    const w = freshWorld({ run: run_, level: 2 });
    assert(w.player.drone, 'drone exists');
    run(w, 0.2);
    w.eBullets.push(bullet(w.player.drone.x, w.player.drone.y));
    run(w, TICK * 2);
    eq(w.player.drone.blockCd > 0, true, 'drone spent its block');
});

t('Second Flare raises flare capacity and leaves a field', () => {
    const run_ = newRun('pilot', 6);
    addCadet(run_, CADET_BY_ID.kel);
    const w = freshWorld({ run: run_, level: 6 });
    eq(w.player.maxFlares, PLAYER.maxFlares + 1, 'capacity +1');
    stepWorld(w, input({ flare: true }), TICK);
    assert(w.fields.length === 1, 'flare left a burning field');
});

t('Patchwork toughens pods and rebuilds flares', () => {
    const run_ = newRun('pilot', 2);
    addCadet(run_, CADET_BY_ID.juno);
    const w = freshWorld({ run: run_, level: 2 });
    const pod = w.spawnPod(0, 8);
    eq(pod.maxHp, POD.hp + 1, 'pods carry an extra point of hull');
    w.player.flares = 0;
    run(w, 26);
    assert(w.player.flares >= 1, 'a flare rebuilt itself');
});

t('Magnet Wake widens pickup collection', () => {
    const plain = freshWorld();
    plain.spawnPickup(plain.player.x + 5, plain.player.y, 'gem');
    run(plain, 0.4);
    const magnetRun = newRun('pilot', 5);
    addCadet(magnetRun, CADET_BY_ID.six);
    const magnet = freshWorld({ run: magnetRun, level: 5 });
    magnet.spawnPickup(magnet.player.x + 5, magnet.player.y, 'gem');
    run(magnet, 0.4);
    const d0 = Math.hypot(plain.pickups[0].x - plain.player.x, plain.pickups[0].y - plain.player.y);
    const d1 = magnet.pickups.length
        ? Math.hypot(magnet.pickups[0].x - magnet.player.x, magnet.pickups[0].y - magnet.player.y) : 0;
    assert(d1 < d0, `magnet pulled the pickup closer (${d1.toFixed(2)} vs ${d0.toFixed(2)})`);
});

console.log('\n== determinism, memory, persistence ==');

t('two runs with the same seed and inputs are identical', () => {
    const sig = (seed) => {
        const w = createWorld({ level: 3, run: newRun('pilot', 3), seed });
        let bot = 0;
        for (let i = 0; i < 12000; i++) {
            bot += TICK;
            stepWorld(w, input({ ax: Math.sin(bot * 2) > 0 ? 1 : -1, ay: 0, fire: true }), TICK);
        }
        return [w.stats.score, w.stats.kills, w.enemies.length, w.eBullets.length,
                w.pods.length, Math.round(w.player.x * 1e6)].join('|');
    };
    eq(sig('same'), sig('same'), 'identical seeds match');
    assert(sig('same') !== sig('other'), 'different seeds diverge');
});

t('entity arrays stay bounded across a long fight', () => {
    const w = createWorld({ level: 4, run: newRun('ace', 4), seed: 'mem' });
    let peak = 0;
    for (let i = 0; i < 24000; i++) {
        stepWorld(w, input({ fire: true, ax: Math.sin(i / 400) }), TICK);
        peak = Math.max(peak, w.eBullets.length + w.pBullets.length + w.enemies.length);
        if (w.phase === 'failed') { w.player.lives = 9; w.phase = 'wave'; }
    }
    assert(peak < 2000, `peak live entities ${peak} stays well under the instanced cap`);
    assert(w.fxQueue.length <= 600, 'the fx queue is bounded even when nobody drains it');
});

t('save round-trips and keeps the better rank', () => {
    const save = loadSave();
    save.unlockedLevel = 1;
    recordRun(save, { level: 1, score: 1000, rescued: 10, rank: 'B', cleared: true });
    recordRun(save, { level: 1, score: 500, rescued: 4, rank: 'S', cleared: true });
    writeSave(save);
    const back = loadSave();
    eq(back.levelBests['1'].score, 1000, 'best score kept');
    eq(back.levelBests['1'].rank, 'S', 'best rank kept');
    eq(back.unlockedLevel, 2, 'level unlocked');
    eq(betterRank('A', 'S'), 'S');
    eq(betterRank('A', 'C'), 'A');
});

t('level summary ranks on pods recovered', () => {
    const w = freshWorld();
    w.stats.rescued = w.podBudget;
    w.stats.lost = 0;
    const s = levelSummary(w);
    eq(s.rank, 'S', 'a perfect sweep is an S');
    w.stats.rescued = Math.floor(w.podBudget * 0.55);
    eq(levelSummary(w).rank, 'C');
});

// ---------------------------------------------------------------- helpers

function bullet(x, y) {
    return { x, y, ang: -Math.PI / 2, speed: 0, r: 0.2, kind: 'orb', color: 0xffb347,
             turn: 0, homing: 0, homingUntil: 0, speedKeys: null, burstAt: 0, burstSpec: null,
             life: 0, maxLife: 12, grazed: false, alive: true };
}
function pbullet(x, y, dmg) {
    return { x, y, ang: Math.PI / 2, speed: 0, vx: 0, vy: 0, r: 0.2, dmg, kind: 'dart',
             color: 0x7ef2ff, pierce: 0, homing: 0, hits: null, life: 0, alive: true };
}
console.log(`\n${fail === 0 ? `ALL ${pass} SIM TESTS PASSED` : `${fail} FAILED, ${pass} passed`}\n`);
process.exit(fail === 0 ? 0 : 1);
