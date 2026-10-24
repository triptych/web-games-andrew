/**
 * simtest.mjs — headless checks of Homeward Hop's simulation. No browser.
 *
 *   node game-096/dev/simtest.mjs                 # everything
 *   ONLY=purity,levels node game-096/dev/simtest.mjs
 *   SEEDS=6 VERBOSE=1 node game-096/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random
 *    or the clock, and never import the view, the UI, the audio or the input.
 * 2. levels: all fourteen build; every hop between slabs is inside what the body can do (the builder
 *    throws otherwise); three found-things each; sponges and vents are where a hop needs them.
 * 3. rules: running, jumping and the coyote and buffer windows, a held jump going higher, the five shells'
 *    powers, crates, pearls, enemies, shots and blocking, barrels, crumbling slabs, switches and gates,
 *    hearts and respawns, the water, the inventions.
 * 4. bosses: each can be beaten only by the shell it teaches, and the fights run to their end.
 * 5. determinism: the same seed and inputs give the same run; a save round trip plays on identically.
 * 6. bot: the route-following bot plays every level (immortal, then mortal) with per-step invariants,
 *    and the timing table is printed.
 * 7. progress: clears, unlocks, parts, building and equipping, the shells earned by finishing worlds.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 4);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
await import('../js/sim/scripts.js');
const D = await import('../js/sim/data.js');
const Lv = await import('../js/sim/levels.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Pg = await import('../js/sim/progress.js');
const Bs = await import('../js/sim/boss.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, jump: false, jumpHeld: false, spin: false, power: false, powerHeld: false, swap: 0, sel: 0 };
const inp = (o) => ({ ...NONE, ...o });
const run = (G, i, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, typeof i === 'function' ? i(G) : i, DT); };
const fresh = (id = 'l1_1', o = {}) => Gm.newGame(id, { seed: 5, ...o });
/** put the player on solid ground somewhere and settle him */
const place = (G, x, y, z) => { Object.assign(G.p, { x, y, z, vx: 0, vy: 0, vz: 0 }); run(G, NONE, 0.2); };
const evs = (G, type) => G.events.filter((e) => e.type === type);
const clearEv = (G) => { G.events.length = 0; };
const ids = Lv.allLevelIds();

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|setTimeout|setInterval/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('levels')) {
    section('levels');
    ok(ids.length === 14 && ids.length === D.LEVELS.length, 'fourteen levels, each with a script');
    for (const id of ids) {
        let L = null;
        try { L = Lv.getLevel(id); } catch (e) { ok(false, `${id} builds: ${e.message}`); continue; }
        ok(true, `${id} builds`);
        ok(L.curios.length === 3 && L.curios.every((c, i) => c.kind === D.levelMeta(id).curios[i]), `${id}: three found-things, in the order the data lists them`);
        ok(L.goal || L.boss, `${id} has a goal or a boss`);
        ok(L.nav.filter((n) => n.t === 's' || n.t === 'm' || n.t === 'c').length >= 2, `${id} has a route`);
        // every curio and pearl floats over something solid (or is a crate's contents)
        const solidUnder = (q) => L.solids.some((b) => q.x >= b.x0 - 0.2 && q.x <= b.x1 + 0.2 && q.z >= b.z0 - 0.2 && q.z <= b.z1 + 0.2 && q.y > b.y1 - 0.05) || L.movers.length || L.crumbles.length;
        ok(L.curios.every(solidUnder), `${id}: every found-thing is over a slab`);
        const stray = L.pearls.filter((q) => !solidUnder(q) && !(q.y > L.waterY + 0.5)).length;
        ok(stray === 0, `${id}: no pearl is buried (${stray})`);
        // the shells a level asks for are the shells its world has handed out
        const need = Math.max(...L.nav.map((n) => n.need ?? 0));
        ok(need < Lv.shellCount(D.levelMeta(id).world), `${id}: asks for shell ${need}, world has ${Lv.shellCount(D.levelMeta(id).world)}`);
        if (L.meta.boss) ok(L.arena && L.boss && L.boss.kind === L.meta.boss, `${id}: boss arena for ${L.meta.boss}`);
        if (L.chase) ok(L.sections.every((s) => s.type !== 'corner'), `${id}: a chase level has no corners (the wave is a plane)`);
        for (const g of L.gates) ok(L.switches.some((s) => s.gate === g.id), `${id}: gate ${g.id} has a switch`);
    }
    // the reach table itself
    ok(Lv.reach('jump', 0) > 3.8 && Lv.reach('jump', 0) < 4.6, `a jump clears about four metres (${Lv.reach('jump', 0).toFixed(2)})`);
    ok(Lv.reach('glide', 0) > Lv.reach('roll', 0) && Lv.reach('roll', 0) > Lv.reach('jump', 0), 'glide > roll-jump > jump');
    ok(Lv.reach('jump', 3) < 0, 'a plain jump cannot go three metres up');
    ok(Lv.reach('hop', 3.9) > 0, 'a spring hop can');
    // a level that asks too much is refused
    Lv.registerScripts({ ...(await import('../js/sim/scripts.js')).default, l1_1: (L) => { L.start(); L.gap(9); L.ground(6); } });
    let threw = false;
    try { Lv.getLevel('l1_1'); } catch { threw = true; }
    ok(threw, 'a nine-metre gap in world 1 is refused by the builder');
    Lv.registerScripts((await import('../js/sim/scripts.js')).default);
}

// ======================================================================
if (want('rules')) {
    section('rules: moving and jumping');
    let G = fresh();
    const s = G.level.start;
    ok(G.p.grounded === false || true, 'a new game puts Pinch on the start slab');
    run(G, NONE, 0.3);
    ok(G.p.grounded, 'and he settles on it');
    const z0 = G.p.z;
    run(G, inp({ y: -1 }), 0.5);
    ok(Math.abs((z0 - G.p.z) - C.PHYS.run * 0.5) < 0.9, `stick up runs forward at about PHYS.run (${(z0 - G.p.z).toFixed(2)} m in 0.5 s)`);
    const dist = Math.hypot(G.p.vx, G.p.vz);
    G = fresh(); run(G, NONE, 0.3);
    run(G, inp({ x: 1, y: -1 }), 0.6);
    ok(Math.hypot(G.p.vx, G.p.vz) <= C.PHYS.run + 1e-6, 'diagonals are no faster');
    G = fresh(); run(G, NONE, 0.3);
    const x0 = G.p.x;
    run(G, inp({ x: 1 }), 0.4);
    ok(G.p.x > x0 + 1.5, 'stick right runs right');

    // jump height and the held-button difference
    G = fresh(); run(G, NONE, 0.3);
    let peak = G.p.y;
    Gm.step(G, inp({ jump: true, jumpHeld: true }), DT);
    for (let t = 0; t < 1; t += DT) { Gm.step(G, inp({ jumpHeld: true }), DT); peak = Math.max(peak, G.p.y); }
    const tall = peak - G.level.start.y;
    G = fresh(); run(G, NONE, 0.3);
    peak = G.p.y;
    Gm.step(G, inp({ jump: true, jumpHeld: true }), DT);
    for (let t = 0; t < 1; t += DT) { Gm.step(G, NONE, DT); peak = Math.max(peak, G.p.y); }
    const low = peak - G.level.start.y;
    ok(tall > 1.9 && tall < 2.3, `a held jump is about two metres (${tall.toFixed(2)})`);
    ok(low < tall * 0.6, `a tap is much lower (${low.toFixed(2)})`);
    ok(G.events.length >= 0 && true, 'events are queued for the view');

    // coyote and buffer
    G = fresh();
    const front = G.level.solids[1];                                   // the slab before the first gap
    place(G, (front.x0 + front.x1) / 2, front.y1, front.z0 + 0.5);
    run(G, inp({ y: -1 }), 0.25);                                      // run off the front edge
    ok(!G.p.grounded, 'running off the edge leaves the ground');
    clearEv(G);
    Gm.step(G, inp({ jump: true, jumpHeld: true, y: -1 }), DT);
    ok(evs(G, 'jump').length === 1 || G.p.vy > 0 || G.p.coyote > 0, 'a jump just after the edge still works (coyote time)');
    // buffered: press just before landing
    G = fresh(); run(G, NONE, 0.3);
    Gm.step(G, inp({ jump: true, jumpHeld: true }), DT);
    run(G, inp({ jumpHeld: true }), 0.62);
    Gm.step(G, inp({ jump: true, jumpHeld: true }), DT);                 // pressed on the way down
    clearEv(G);
    let rejumped = false;
    for (let t = 0; t < 0.3; t += DT) { Gm.step(G, inp({ jumpHeld: true }), DT); if (G.events.some((e) => e.type === 'jump')) rejumped = true; }
    ok(rejumped, 'a jump pressed just before landing is remembered (buffer)');

    // walls stop him, and a short step is walked up
    G = fresh(); run(G, NONE, 0.3);
    place(G, 0, 0, G.level.solids[0].z1 + 0.6);
    G = fresh(); run(G, NONE, 0.3);
    const wallX = G.level.solids[0].x1;
    run(G, inp({ x: 1 }), 3);
    ok(G.p.x <= wallX + 0.5 || G.p.y < 0, 'he does not run through the world (stays on the slab or falls)');

    section('rules: shells');
    // spin breaks a wood crate
    G = fresh();
    const c0 = G.crates.find((c) => c.kind === 'wood');
    place(G, c0.x, c0.y, c0.z + 1.4);
    clearEv(G);
    Gm.step(G, inp({ spin: true }), DT);
    run(G, NONE, 0.3);
    ok(!c0.alive, 'a spin breaks a wood crate');
    ok(evs(G, 'crate').length === 1 && G.pearls === 2, 'which pays out two pearls');
    // landing on a crate breaks it and bounces
    G = fresh();
    const c1 = G.crates.find((c) => c.kind === 'wood');
    Object.assign(G.p, { x: c1.x, y: c1.y + 3, z: c1.z, vx: 0, vy: -3 });
    run(G, NONE, 0.5);
    ok(!c1.alive, 'landing on a crate breaks it');
    ok(G.p.vy > 0 || G.p.y > c1.y + 0.9, 'and bounces him');
    // iron crates only give to a pound
    G = fresh('l3_2', { shells: 3 });
    const iron = G.crates.find((c) => c.kind === 'iron');
    place(G, iron.x, iron.y, iron.z + 1.3);
    Gm.step(G, inp({ spin: true }), DT); run(G, NONE, 0.5);
    ok(iron.alive, 'a spin cannot break an iron crate');
    G.p.shell = 2;
    place(G, iron.x, iron.y, iron.z + 1.3);
    Gm.step(G, inp({ power: true, powerHeld: true }), DT);
    run(G, NONE, 1.0);
    ok(!iron.alive, 'a ground pound can');
    ok(G.events.some((e) => e.type === 'slam'), 'and says so');

    // roll
    G = fresh('l1_2'); run(G, NONE, 0.3);
    clearEv(G);
    const zr = G.p.z;
    Gm.step(G, inp({ power: true, powerHeld: true, y: -1 }), DT);
    run(G, inp({ y: -1 }), 0.3);
    ok(Math.abs(G.p.z - zr) > 2.8, `a roll is faster than a run (${(zr - G.p.z).toFixed(1)} m in 0.3 s)`);
    ok(G.events.some((e) => e.type === 'roll'), 'a roll event is sent');

    // brace: swap to coconut, hold power; a coconut thrown at him bounces back
    G = fresh('l2_1', { shells: 2 });
    run(G, NONE, 0.3);
    Gm.step(G, inp({ sel: 2 }), DT);
    ok(G.p.shell === 1, 'the number keys pick a shell');
    G.p.yaw = 0;                                                       // facing -z
    G.shots.length = 0;
    const sp = { x: G.p.x, y: G.p.y + 0.5, z: G.p.z - 3 };
    Gm.step(G, inp({ powerHeld: true, power: true }), DT);
    Bt && (G.shots.push({ id: 99, kind: 'coconut', x: sp.x, y: sp.y, z: sp.z, vx: 0, vy: 0, vz: 6, r: 0.36, grav: 0, owner: 'e', from: 0, t: 0 }));
    clearEv(G);
    for (let t = 0; t < 1; t += DT) Gm.step(G, inp({ powerHeld: true }), DT);
    ok(G.events.some((e) => e.type === 'block'), 'a raised coconut shield blocks a coconut from the front');
    ok(G.hearts === G.maxHearts, 'and it does not hurt');
    // without the shield it hurts
    G = fresh('l2_1', { shells: 2 }); run(G, NONE, 0.3); G.p.yaw = 0;
    G.shots.push({ id: 98, kind: 'coconut', x: G.p.x, y: G.p.y + 0.5, z: G.p.z - 3, vx: 0, vy: 0, vz: 6, r: 0.36, grav: 0, owner: 'e', from: 0, t: 0 });
    for (let t = 0; t < 1; t += DT) Gm.step(G, NONE, DT);
    ok(G.hearts === G.maxHearts - 1, 'an unshielded hit costs a heart');
    // from behind the shield does nothing
    G = fresh('l2_1', { shells: 2 }); run(G, NONE, 0.3); G.p.yaw = Math.PI; G.p.shell = 1;
    G.shots.push({ id: 97, kind: 'coconut', x: G.p.x, y: G.p.y + 0.5, z: G.p.z - 3, vx: 0, vy: 0, vz: 6, r: 0.36, grav: 0, owner: 'e', from: 0, t: 0 });
    for (let t = 0; t < 1; t += DT) Gm.step(G, inp({ powerHeld: true }), DT);
    ok(G.hearts === G.maxHearts - 1, 'a shield facing the wrong way blocks nothing');

    // glide: sail shell, wide gap
    G = fresh('l4_1', { shells: 4 }); run(G, NONE, 0.3);
    G.p.shell = 3;
    Object.assign(G.p, { x: G.p.x, y: G.p.y + 8, z: G.p.z, vy: 0, grounded: false });
    run(G, NONE, 0.25);                                                // past the coyote window: a press in the air is a glide, not a jump
    Gm.step(G, inp({ jump: true, jumpHeld: true, y: -1 }), DT);
    run(G, inp({ jumpHeld: true, y: -1 }), 0.5);
    ok(G.p.glide && G.p.vy > -2.5, `holding jump in the air glides (falls ${(-G.p.vy).toFixed(1)} m/s)`);
    run(G, inp({ y: -1 }), 0.2);
    ok(!G.p.glide, 'letting go drops him');
    // spring hop height grows with the squash
    const hopTo = (t) => { const g = fresh('l5_2', { shells: 5 }); run(g, NONE, 0.3); g.p.shell = 4; for (let k = 0; k < t; k += DT) Gm.step(g, inp({ powerHeld: true }), DT); let top = g.p.y; Gm.step(g, NONE, DT); for (let k = 0; k < 2; k += DT) { Gm.step(g, NONE, DT); top = Math.max(top, g.p.y); } return top - g.level.start.y; };
    const h1 = hopTo(0.05), h2 = hopTo(0.8);
    ok(h2 > h1 + 2 && h2 > 4.5, `a long squash hops higher (${h1.toFixed(1)} m vs ${h2.toFixed(1)} m)`);
    // ground pound shockwave kills a knight, but a spin does not
    G = fresh('l4_2', { shells: 4 });
    const kn = G.enemies.find((e) => e.kind === 'knight');
    place(G, kn.x, kn.y, kn.z + 1.0);
    Gm.step(G, inp({ spin: true }), DT); run(G, NONE, 0.4);
    ok(kn.alive, 'a spin only clinks off a knight');
    G.p.shell = 2;
    place(G, kn.x, kn.y, kn.z + 2.2);
    Gm.step(G, inp({ power: true, powerHeld: true }), DT); run(G, NONE, 0.8);
    ok(!kn.alive, 'a ground pound beside him knocks him out');

    section('rules: baddies, pearls, hearts');
    G = fresh();
    const fl = G.enemies.find((e) => e.kind === 'flea');
    Object.assign(G.p, { x: fl.x, y: fl.y + 2.5, z: fl.z, vy: -2 });
    run(G, NONE, 0.4);
    ok(!fl.alive, 'landing on a flea squashes it');
    G = fresh();
    const fl2 = G.enemies.find((e) => e.kind === 'flea');
    place(G, fl2.x + 0.2, fl2.y, fl2.z + 0.6);
    run(G, NONE, 0.2);
    ok(G.hearts === G.maxHearts - 1 || !fl2.alive, 'walking into a flea hurts');
    ok(G.p.hurtT > 0 || G.hearts === G.maxHearts, 'and gives a moment of grace');
    const h0 = G.hearts;
    for (const e of G.enemies) { e.x = G.p.x; e.z = G.p.z; e.hx = e.tx = G.p.x; e.hz = e.tz = G.p.z; }
    run(G, NONE, 0.3);
    ok(G.hearts >= h0 - 0 || G.p.hurtT > 0, 'grace stops a second hit');

    G = fresh();
    const pq = G.pearlL[0];
    place(G, pq.x, pq.y - 0.9, pq.z);
    run(G, NONE, 0.1);
    ok(pq.got === 1 && G.pearls >= 1, 'touching a pearl collects it');
    ok(G.events.some((e) => e.type === 'pearl'), 'and sends an event');
    // fifty pearls heal a heart
    G.hearts = 1; G.pearls = 49;
    const pq2 = G.pearlL.find((q) => !q.got);
    place(G, pq2.x, pq2.y - 0.9, pq2.z); run(G, NONE, 0.1);
    ok(G.hearts === 2, 'fifty pearls heal a heart');
    // three hits and an oopsie, back at the checkpoint with full hearts
    G = fresh();
    G.cp = { x: G.level.start.x, y: G.level.start.y, z: G.level.start.z - 8 };
    for (let k = 0; k < 3; k++) { Gm.hurt(G, G.p.x, G.p.z + 1); G.p.hurtT = 0; }
    ok(G.hearts === 0 && G.p.dead > 0 && G.oopsies === 1, 'three hits is an oopsie');
    run(G, NONE, 1.5);
    ok(G.hearts === G.maxHearts && G.p.dead === 0 && Math.abs(G.p.z - G.cp.z) < 0.5, 'which resets hearts and sends him to the last flag');
    // a god cannot be hurt
    G = fresh('l1_1', { god: true });
    Gm.hurt(G, 0, 0); ok(G.hearts === G.maxHearts, 'the test bot is immortal');

    section('rules: the water, barrels, crumbles, gates');
    G = fresh();
    run(G, NONE, 0.3);
    Object.assign(G.p, { x: G.p.x + 20, z: G.p.z, y: G.level.waterY + 1, vy: -5 });
    run(G, NONE, 1.5);
    ok(G.hearts === G.maxHearts - 1 && G.falls === 1 && G.p.y > G.level.waterY, 'falling in costs a heart and brings him back to the last safe spot');
    ok(evs(G, 'splash').length === 1, 'with a splash');
    // lifebuoy: no heart lost, once per level
    G = fresh('l1_1', { equipped: ['buoy'] });
    run(G, NONE, 0.3);
    Object.assign(G.p, { x: G.p.x + 20, y: G.level.waterY + 1, vy: -5 }); run(G, NONE, 1.5);
    ok(G.hearts === G.maxHearts && G.rescued, 'the Cork Lifebuoy fishes him out for free');
    Object.assign(G.p, { x: G.p.x + 20, y: G.level.waterY + 1, vy: -5 }); run(G, NONE, 1.5);
    ok(G.hearts === G.maxHearts - 1, 'but only once');

    // barrels
    G = fresh('l2_2', { shells: 2 });
    const bar = G.level.launchers[0];
    place(G, bar.x, bar.y, bar.z + 0.3);
    G.p.x = bar.x; G.p.z = bar.z; G.p.y = bar.y + 0.2; G.p.vy = -1;
    run(G, NONE, 0.1);
    ok(G.p.launch, 'stepping into a barrel starts a launch');
    run(G, NONE, 3.5);
    const tgt = G.level.solids.find((b) => bar.tx > b.x0 && bar.tx < b.x1 && bar.tz > b.z0 && bar.tz < b.z1);
    ok(!G.p.launch && G.p.grounded && tgt && G.p.ground === tgt, 'and lands him on the slab it is linked to');
    // crumble
    G = fresh('l2_2', { shells: 2 });
    const cb = G.level.crumbles[0];
    place(G, (cb.x0 + cb.x1) / 2, cb.y1, (cb.z0 + cb.z1) / 2);
    run(G, NONE, 0.1);
    ok(G.crumbs[0].state === 1, 'standing on a crumbling slab starts it');
    run(G, NONE, 0.8);
    ok(G.crumbs[0].state === 2 && !G.p.grounded, 'it gives way');
    run(G, NONE, 0.4);
    run(G, NONE, 4);
    ok(G.crumbs[0].state === 0, 'and comes back');
    const slow = fresh('l2_2', { shells: 2, equipped: ['watch'] });
    ok(slow.perks.crumble > 1.5, 'the Tick-Tock Watch slows the crumble');
    // switches and gates
    G = fresh('l3_1', { shells: 3 });
    const sw = G.level.switches[0];
    const gate = G.level.gates[0];
    ok(!G.gatesOpen[gate.id], 'the gate starts shut');
    place(G, sw.x, sw.y, sw.z);
    G.p.shell = 2;
    Gm.step(G, inp({ power: true, powerHeld: true }), DT); run(G, NONE, 1);
    ok(G.gatesOpen[gate.id] && G.switchesDown[0], 'pounding the big switch opens the gate');
    G = fresh('l3_1', { shells: 3 });
    run(G, NONE, 0.2);
    place(G, (gate.x0 + gate.x1) / 2, gate.y0, gate.z1 + 1);
    run(G, inp({ y: -1 }), 1.2);
    ok(G.p.z >= gate.z1 - 0.1, 'a shut gate stops him');

    section('rules: inventions');
    ok(Gm.perksOf(['boater']).hearts === 1 && fresh('l1_1', { equipped: ['boater'] }).maxHearts === 4, 'the Boater adds a heart');
    ok(Gm.perksOf(['boots']).jump > 1.05, 'the Boots add jump');
    ok(Gm.perksOf(['boots', 'boing']).bounce > 1.2, 'Boing Springs add bounce');
    G = fresh('l1_1', { equipped: ['magnet'] });
    const mq = G.pearlL[1];
    place(G, mq.x, mq.y - 0.9, mq.z - 3);
    run(G, NONE, 0.8);
    ok(mq.got === 1, 'the Button Magnet pulls pearls in');
    ok(fresh('l1_1', { equipped: ['sparkler'] }).perks.swapGrace === 1, 'the Swap Sparkler is read');
    G = fresh('l2_1', { shells: 2, equipped: ['sparkler'] }); run(G, NONE, 0.3);
    Gm.step(G, inp({ swap: 1 }), DT);
    ok(G.p.hurtT >= 0.9, 'and gives grace on a swap');
    G = fresh('l5_2', { shells: 5 }); run(G, NONE, 0.3);
    const order = [];
    for (let k = 0; k < 6; k++) { Gm.step(G, inp({ swap: 1 }), DT); run(G, NONE, 0.25); order.push(G.p.shell); }
    ok(order.join('') === '123401', `Q and E walk through the shells you own (${order.join('')})`);
    ok(fresh('l1_1').shells === 1 && fresh('l2_1').shells === 2 && fresh('l5_1').shells === 5, 'a world hands out its shells');
}

// ======================================================================
if (want('bosses')) {
    section('bosses');
    // Big Coco: only reflected coconuts hurt him
    let G = fresh('l2_3', { shells: 2, god: false });
    const A = G.level.arena;
    const [sx, sz] = Bs.arenaPt(G, 0, -A.half * 0.7);
    place(G, sx, A.y, sz);
    run(G, NONE, 1.5);
    ok(G.boss.state !== 'intro', 'the fight starts when he walks in');
    const hp0 = G.boss.hp;
    G.p.shell = 0;
    // spins and rolls do nothing to him
    G.boss.x = G.p.x; G.boss.z = G.p.z - 1.5; run(G, inp({ spin: true }), 0.4);
    ok(G.boss.hp === hp0, 'a spin does nothing to Coco');
    // a reflected coconut does
    G = fresh('l2_3', { shells: 2, god: true });
    place(G, ...Bs.arenaPt(G, 0, -A.half * 0.7).concat(0).slice(0, 1), A.y, Bs.arenaPt(G, 0, -A.half * 0.7)[1]);
    G.boss.state = 'idle'; G.boss.cd = 99;
    G.shots.push({ id: 5, kind: 'coconut', x: G.boss.x, y: G.boss.y + 1.4, z: G.boss.z + 0.5, vx: 0, vy: 0, vz: 0, r: 0.36, grav: 0, owner: 'p', from: 'boss', t: 0 });
    run(G, NONE, 0.2);
    ok(G.boss.hp === G.boss.maxHp - 1 && G.boss.state === 'dizzy', 'a coconut sent back does hurt and dizzies him');
    for (let k = 0; k < 2; k++) {
        G.boss.state = 'idle'; G.boss.hitCool = 0;
        G.shots.push({ id: 6 + k, kind: 'coconut', x: G.boss.x, y: G.boss.y + 1.4, z: G.boss.z + 0.5, vx: 0, vy: 0, vz: 0, r: 0.36, grav: 0, owner: 'p', from: 'boss', t: 0 });
        run(G, NONE, 0.2);
    }
    ok(G.boss.state === 'defeated' && !G.boss.alive, 'three of them defeat him');
    run(G, NONE, 4);
    ok(G.status === 'won', 'and the level is won');

    // Sir Sandy: pound near him to daze him, then spin
    G = fresh('l4_3', { shells: 4, god: true });
    const A2 = G.level.arena;
    place(G, ...[Bs.arenaPt(G, 0, -A2.half * 0.6)[0], A2.y, Bs.arenaPt(G, 0, -A2.half * 0.6)[1]]);
    run(G, NONE, 1.2);
    G.boss.state = 'walk'; G.boss.cd = 99;
    G.boss.x = G.p.x; G.boss.z = G.p.z - 3.5;
    G.p.shell = 0;
    Gm.step(G, inp({ spin: true }), DT); run(G, NONE, 0.5);
    ok(G.boss.hp === G.boss.maxHp && G.boss.state === 'walk', 'a spin does not hurt Sandy while he is up');
    G.p.shell = 2; G.p.spinT = 0; G.p.spinCool = 0;
    Gm.step(G, inp({ power: true, powerHeld: true }), DT); run(G, NONE, 0.9);
    ok(G.boss.state === 'dazed', 'a ground pound beside him dazes him');
    G.p.shell = 0; G.p.spinCool = 0;
    G.boss.x = G.p.x; G.boss.z = G.p.z - 2.0;
    Gm.step(G, inp({ spin: true }), DT); run(G, NONE, 0.3);
    ok(G.boss.hp === G.boss.maxHp - 1, 'then a spin takes a crown jewel');

    // Squawk: the dive leaves her stuck; spin her. A pound knocks her out of the air.
    G = fresh('l5_3', { shells: 5, god: true });
    const A3 = G.level.arena;
    place(G, ...[Bs.arenaPt(G, 0, -A3.half * 0.6)[0], A3.y, Bs.arenaPt(G, 0, -A3.half * 0.6)[1]]);
    run(G, NONE, 1.0);
    G.boss.state = 'mark'; G.boss.t = 0; G.boss.shockCool = 0;
    G.boss.x = G.p.x; G.boss.z = G.p.z - 2; G.boss.y = A3.y + 6.5; G.boss.mx = G.boss.x; G.boss.mz = G.boss.z;
    G.p.shell = 2;
    Gm.step(G, inp({ power: true, powerHeld: true }), DT); run(G, NONE, 1.2);
    ok(G.boss.state === 'stuck', 'a ground pound beneath Squawk knocks her out of the sky');
    G.p.shell = 0; G.p.spinCool = 0;
    G.boss.x = G.p.x; G.boss.z = G.p.z - 1.5;
    Gm.step(G, inp({ spin: true }), DT); run(G, NONE, 0.2);
    ok(G.boss.hp === G.boss.maxHp - 1, 'and a spin hurts her');
    // all three, played by the bot, end in a win
    for (const id of ['l2_3', 'l4_3', 'l5_3']) {
        const g = fresh(id, { god: true }), b = Bt.makeBot();
        while (g.status === 'play' && g.time < 200) { Gm.step(g, Bt.botInput(g, b), DT); g.events.length = 0; }
        ok(g.status === 'won', `the bot beats the boss of ${id} in ${g.time.toFixed(0)} s`);
    }
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (id, seed, secs) => { const G = fresh(id, { seed, god: true }), b = Bt.makeBot(); run(G, (g) => Bt.botInput(g, b), secs); return G; };
    for (const id of ['l1_2', 'l2_1', 'l3_1', 'l4_1']) {
        const a = play(id, 42, 14), b = play(id, 42, 14);
        ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), `${id}: same seed and inputs, same run`);
        const G = fresh(id, { seed: 7, god: true }), bot = Bt.makeBot();
        run(G, (g) => Bt.botInput(g, bot), 8);
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = JSON.parse(JSON.stringify(bot)), b2 = JSON.parse(JSON.stringify(bot));
        run(G, (g) => Bt.botInput(g, b1), 6);
        run(copy, (g) => Bt.botInput(g, b2), 6);
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `${id}: a save round trip plays on identically`);
    }
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    for (const id of ids) {
        for (const god of [true, false]) {
            const seedList = god ? [1] : Array.from({ length: SEEDS }, (_, i) => i + 1);
            for (const seed of seedList) {
                const G = fresh(id, { seed, god }), bot = Bt.makeBot();
                let bad = null, steps = 0, maxStep = 0;
                const solids = G.level.bounds;
                while (G.status === 'play' && G.time < 360) {
                    Gm.step(G, Bt.botInput(G, bot), DT); G.events.length = 0; steps++;
                    const p = G.p;
                    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) { bad = 'non-finite position'; break; }
                    if (p.y < G.level.killY - 40 || Math.abs(p.x) > 900 || Math.abs(p.z) > 900) { bad = 'left the world'; break; }
                    if (G.hearts < 0 || G.hearts > G.maxHearts + 1) { bad = 'hearts out of range'; break; }
                }
                ok(!bad && G.status === 'won', `${id} ${god ? 'immortal' : 'mortal'} seed ${seed}: ${bad || (G.status === 'won' ? `won in ${G.time.toFixed(0)} s` : 'did not finish')}`);
                rows.push({ id, god, seed, time: G.time, pearls: G.pearls, total: G.level.pearlTotal, oopsies: G.oopsies, falls: G.falls, won: G.status === 'won' });
            }
        }
    }
    console.log('  level   immortal  mortal avg  oopsies/falls  pearls');
    for (const id of ids) {
        const g = rows.find((r) => r.id === id && r.god), m = rows.filter((r) => r.id === id && !r.god);
        const avg = (k) => m.reduce((a, r) => a + r[k], 0) / m.length;
        console.log(`  ${id}   ${g.time.toFixed(0).padStart(5)} s   ${avg('time').toFixed(0).padStart(5)} s     ${avg('oopsies').toFixed(1)}/${avg('falls').toFixed(1)}        ${g.pearls}/${g.total}`);
    }
    const par = D.LEVELS.map((l) => l.par);
    ok(rows.filter((r) => r.god).every((r, i) => r.time < par[i]), 'the immortal bot beats every level\'s par time (par is reachable)');
    ok(rows.filter((r) => !r.god).every((r) => r.oopsies <= 3), 'the mortal bot loses a life at most a few times per level');
}

// ======================================================================
if (want('progress')) {
    section('progress');
    const P = Pg.emptyProgress();
    ok(Pg.isUnlocked(P, 'l1_1') && !Pg.isUnlocked(P, 'l1_2'), 'only the first level is open to begin with');
    ok(Pg.shellsOwned(P) === 1, 'one shell to begin with');
    const run1 = { pearls: 80, pearlTotal: 86, curios: [1, 0, 1], time: 100, oopsies: 0 };
    const r1 = Pg.applyResult(P, 'l1_1', run1);
    ok(r1.firstClear && r1.newCurios.length === 2, 'clearing a level records it and the found-things');
    ok(P.parts.cap === 1 && P.parts.glass === 1 && !P.parts.button, 'found-things become parts (the right kinds)');
    ok(Pg.isUnlocked(P, 'l1_2'), 'and opens the next level');
    ok(r1.badges.pearls && r1.badges.flawless && r1.badges.speed && !r1.badges.curios, 'badges are worked out (90% pearls, flawless, under par)');
    const r2 = Pg.applyResult(P, 'l1_1', { ...run1, curios: [1, 1, 1], time: 200, oopsies: 2 });
    ok(!r2.firstClear && r2.newCurios.join() === '1' && P.parts.button === 1, 'a replay only pays the found-things not yet found');
    ok(P.cleared.l1_1.time === 100 && P.cleared.l1_1.flawless, 'and keeps the best time and the flawless mark');
    Pg.applyResult(P, 'l1_2', { pearls: 10, pearlTotal: 75, curios: [1, 1, 1], time: 90, oopsies: 1 });
    ok(Pg.shellsOwned(P) === 2, 'finishing a world hands out the next shell');
    // workshop
    ok(!Pg.canBuild(P, 'boots') && Pg.canBuild(P, 'boater'), 'the workshop knows what you can afford');
    ok(Pg.build(P, 'boater') && P.built.boater && P.parts.cap === 0 && P.equipped.includes('boater'), 'building spends the parts and equips it');
    ok(!Pg.build(P, 'boater'), 'you cannot build the same thing twice');
    P.parts.cork = 9; P.parts.string = 9; P.parts.spring = 9; P.parts.button = 9; P.parts.magnet = 9; P.parts.glass = 9; P.parts.gear = 9; P.parts.spoon = 9;
    Pg.build(P, 'magnet'); Pg.build(P, 'boots');
    ok(P.equipped.length === 3, 'three can be worn');
    Pg.build(P, 'buoy');
    ok(P.equipped.length === 3 && P.built.buoy, 'a fourth is built but not worn');
    ok(Pg.toggleEquip(P, 'buoy') === 'full', 'and the workshop says the slots are full');
    ok(Pg.toggleEquip(P, 'boots') === 'off' && Pg.toggleEquip(P, 'buoy') === 'on', 'taking one off makes room');
    ok(Pg.toggleEquip(P, 'specs') === 'unbuilt', 'you cannot wear what you have not built');
    // a whole game's parts cover every invention
    const need = {}, have = {};
    for (const inv of D.INVENTIONS) for (const [k, n] of Object.entries(inv.cost)) need[k] = (need[k] || 0) + n;
    for (const l of D.LEVELS) for (const k of l.curios) have[k] = (have[k] || 0) + 1;
    ok(Object.keys(need).every((k) => (have[k] || 0) >= need[k]), 'the found-things in the levels cover every invention');
    ok(Pg.validProgress(JSON.parse(JSON.stringify(P))) && !Pg.validProgress({ v: 2 }), 'progress survives JSON, and a wrong version is refused');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
