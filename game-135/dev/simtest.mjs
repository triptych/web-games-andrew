/**
 * simtest.mjs — headless checks of HARD HAT HARBOR's simulation. No browser.
 *
 *   node game-135/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-135/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-135/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the
 *    clock, and never import the view, the UI or the audio.
 * 2. data: every job, step, giver and vehicle refers to something that exists; the unlock graph opens every job.
 * 3. rules: driving, walls, the river and the bridge, swapping vehicles, and each of the eight kinds of work.
 * 4. determinism: the same seed and inputs give the same game; a save round trip mid-game plays on identically.
 * 5. proofs: over 60 seeds the debris of every push and scoop step lands somewhere legal; every work site can be
 *    driven to, and the east bank can be reached with the bridge and NOT without it.
 * 6. bot: the bot finishes the whole game on SEEDS seeds at three skills, with per-step invariants, and the
 *    balance table is printed and its bands asserted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 8);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const W = await import('../js/sim/world.js');
const Nav = await import('../js/sim/nav.js');
const { JOBS, JOB, GIVERS, MAX_STARS, SPEECH, CALLS } = await import('../js/sim/data/jobs.js');
const City = await import('../js/sim/data/city.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, a: false, h: false };
const FWD = { x: 0, y: -1 }, BACK = { x: 0, y: 1 };
const run = (G, inp, secs) => { for (let t = 0; t < secs - 1e-9; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const seen = (G, type) => G.events.filter((e) => e.type === type).length;
const place = (G, x, y, a = 0) => { G.p.x = x; G.p.y = y; G.p.a = a; G.p.v = 0; };
const finish = (G, id) => { G.jobs[id].st = 'done'; G.rev++; };
/** A game with job `id` taken at step `k` (everything it needs marked done), in vehicle `veh`. */
function at(id, k = 0, veh = null, seed = 1) {
    const G = Gm.newGame(seed);
    for (const n of JOB[id].needs) { finish(G, n); for (const m of JOB[n].needs) finish(G, m); }
    if (id !== 'bridge' && JOB[id].needs.includes('bridge')) finish(G, 'bridge');
    G.jobs[id].st = 'open'; G.jobs[id].step = k; G.rev++;
    Gm.step(G, { ...NONE, job: id }, DT);
    if (veh) { G.veh = veh; }
    G.events.length = 0;
    return G;
}

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '(\.\.\/)+(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('data')) {
    section('data');
    const kinds = ['haul', 'roll', 'push', 'scoop', 'dig', 'pour', 'lift', 'wreck'];
    const used = new Set(), usedVeh = new Set();
    for (const j of JOBS) {
        ok(GIVERS[j.giver], `${j.id}: giver ${j.giver} exists`);
        ok(j.needs.every((n) => JOB[n]), `${j.id}: needs exist`);
        ok(j.brief.length > 20 && j.done.length > 10 && j.par > 0, `${j.id}: has a brief, a thank-you and a par`);
        for (const st of j.steps) {
            used.add(st.kind); usedVeh.add(st.veh);
            ok(kinds.includes(st.kind) && C.VEH[st.veh] && st.text, `${j.id}: step ${st.kind} is a known kind with a known vehicle and a line of text`);
            if (st.kind === 'haul') ok(City.ZONES[st.from], `${j.id}: load zone ${st.from} exists`);
            if (st.kind === 'wreck') ok(City.BUILDINGS.find((b) => b.id === st.building)?.until?.[0] === j.id, `${j.id}: the building it wrecks comes down with this job`);
        }
    }
    ok(kinds.every((k) => used.has(k)), 'every kind of work is used by some job');
    ok(C.VEHICLES.every((v) => usedVeh.has(v.id)), 'every vehicle in the toy box is needed by some job');
    ok(Object.keys(GIVERS).every((g) => JOBS.some((j) => j.giver === g)), 'every townsperson gives a job');
    ok(C.VEHICLES.every((v) => CALLS[v.id]), 'every vehicle has a call-out');
    ok(GIVERS[SPEECH.intro.giver] && GIVERS[SPEECH.finale.giver], 'the intro and the finale have speakers');
    // the unlock graph opens every job
    const done = new Set();
    for (let pass = 0; pass < JOBS.length; pass++) for (const j of JOBS) if (j.needs.every((n) => done.has(n))) done.add(j.id);
    ok(done.size === JOBS.length, 'every job can be unlocked');
    ok(City.BUILDINGS.every((b) => (!b.from || JOB[b.from]) && (!b.until || JOB[b.until[0]])), 'buildings that appear or vanish name real jobs');
    ok(City.TREES.length >= 30, `the town has trees (${City.TREES.length})`);
}

if (want('rules')) {
    section('rules: driving');
    let G = Gm.newGame(1);
    ok(G.jobs.potholes.st === 'open' && JOBS.filter((j) => G.jobs[j.id].st === 'open').length === 1, 'a new game has one job open');
    run(G, FWD, 1.5);
    ok(Math.abs(G.p.v - C.VEH.dump.vmax) < 0.01 && G.p.x > City.SPAWN.x + 10, 'the dump truck reaches its top speed going forward');
    G = Gm.newGame(1); run(G, BACK, 3);
    ok(Math.abs(G.p.v + C.VEH.dump.vmax * C.DRIVE.reverse) < 0.01, 'reverse is slower');
    G = Gm.newGame(1); run(G, { x: 1, y: -1 }, 0.5);
    ok(G.p.a > 0.2, 'steering right turns clockwise (toward +y)');
    G = Gm.newGame(1); run(G, { x: 1, y: 0 }, 1); const wheeled = G.p.a;
    G = Gm.newGame(1); G.veh = 'dozer'; run(G, { x: 1, y: 0 }, 1);
    ok(G.p.a > wheeled * 1.5 && Math.hypot(G.p.x - City.SPAWN.x, G.p.y - City.SPAWN.y) < 0.01, 'tracks turn on the spot faster than wheels');
    G = Gm.newGame(1); place(G, 48, 40, -Math.PI / 2); run(G, FWD, 3);
    const th = City.BUILDINGS.find((b) => b.id === 'townhall');
    ok(W.distRect(G.p, th) >= C.RADIUS - 0.01 && seen(G, 'bump') === 1, 'a building stops the truck, with one bump');
    G = Gm.newGame(1); place(G, 5, 48, Math.PI); run(G, FWD, 3);
    ok(G.p.x >= C.RADIUS - 1e-9, 'the edge of the map stops it');
    G = Gm.newGame(1); place(G, 70, 48, 0); run(G, FWD, 4);
    ok(G.p.x < City.RIVER.x, 'the river cannot be crossed before the bridge is built');
    G = Gm.newGame(1); finish(G, 'bridge'); place(G, 70, 48, 0); run(G, FWD, 4);
    ok(G.p.x > City.RIVER.x + City.RIVER.w, 'and can be once it is');
    G = Gm.newGame(1); finish(G, 'bridge'); place(G, 80, 30, 0); run(G, FWD, 4);
    ok(G.p.x < City.RIVER.x, 'but only over the bridge');

    section('rules: vehicles and jobs');
    G = Gm.newGame(1);
    Gm.step(G, { ...NONE, veh: 'dozer' }, DT);
    ok(G.veh === 'dozer' && seen(G, 'switch') === 1, 'climbing into another vehicle swaps it and says so');
    Gm.step(G, { ...NONE, veh: 'crane' }, DT);
    ok(G.veh === 'dozer', 'a second swap waits for the cooldown');
    run(G, NONE, C.DRIVE.switchCd + 0.05); Gm.step(G, { ...NONE, veh: 'nope' }, DT);
    ok(G.veh === 'dozer', 'an unknown vehicle is ignored');
    Gm.step(G, { ...NONE, job: 'bridge' }, DT);
    ok(G.active === null, 'a locked job cannot be taken');
    Gm.step(G, { ...NONE, job: 'potholes' }, DT);
    ok(G.active === 'potholes' && seen(G, 'jobStart') === 1, 'an open job can');
    G = Gm.newGame(1); Gm.step(G, { ...NONE, a: true }, DT); Gm.step(G, { ...NONE, a: true }, DT);
    ok(seen(G, 'honk') === 1, 'the action button with nothing to do honks (once per cooldown)');

    section('rules: haul and roll');
    const q = City.ZONES.quarry;
    G = at('potholes', 0, 'dozer'); place(G, q.x, q.y); run(G, NONE, 2);
    ok(!G.cargo.dump, 'only the dump truck loads at the quarry');
    G = at('potholes', 0, 'dump'); place(G, q.x, q.y); run(G, NONE, C.WORK.loadTime - 0.1);
    ok(!G.cargo.dump, 'loading takes time');
    run(G, NONE, 0.2);
    ok(G.cargo.dump === 1 && seen(G, 'loaded') === 1, 'then the truck is full');
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.cargo.dump === 1 && seen(G, 'honk') === 1, 'tipping away from the site only honks');
    const site = JOB.potholes.steps[0].site;
    place(G, site.x, site.y); Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.cargo.dump === 0 && seen(G, 'dumped') === 1 && G.jobs.potholes.step === 1 && seen(G, 'stepDone') === 1, 'tipping at the site finishes the step');
    const cells = W.cellsOf(JOB.potholes.steps[1].rect, C.WORK.rollCell);
    place(G, cells[0].x, cells[0].y); run(G, NONE, 0.1);
    ok(G.jobs.potholes.prog.n === 0, 'a dump truck does not flatten asphalt');
    G.veh = 'roller'; run(G, NONE, 0.1);
    ok(G.jobs.potholes.prog.n >= 1 && seen(G, 'rolled') >= 1, 'the roller does');
    for (const c of cells) { place(G, c.x, c.y); Gm.step(G, NONE, DT); }
    ok(G.jobs.potholes.st === 'done' && G.active === null && seen(G, 'jobDone') === 1, 'rolling every cell finishes the job');
    ok(G.jobs.potholes.stars === 3 && G.stars === 3, 'a quick job earns three stars');
    ok(G.jobs.rocks.st === 'open' && G.jobs.school.st === 'open' && G.jobs.bridge.st === 'locked' && seen(G, 'unlock') === 2, 'and unlocks the jobs that needed it');
    G = at('potholes', 1, 'roller'); G.jobs.potholes.time = JOB.potholes.par * C.STAR2 + 1;
    for (const c of cells) { place(G, c.x, c.y); Gm.step(G, NONE, DT); }
    ok(G.jobs.potholes.stars === 1, 'a very slow job earns one star');

    section('rules: push and scoop');
    G = at('rocks', 0, 'dump');
    ok(G.debris.length === 6 && G.debris.every((d) => d.kind === 'boulder'), 'the rockslide puts six boulders on the road');
    G.debris.length = 1; let d = G.debris[0]; d.x = 60; d.y = 48; G.jobs.rocks.prog.total = 1;
    place(G, 50, 48, 0); run(G, FWD, 3);
    ok(Math.abs(d.x - 60) < 0.01 && G.p.x < 60 - C.RADIUS - d.r + 0.01, 'a boulder blocks a dump truck');
    G = at('rocks', 0, 'dozer'); G.debris.length = 1; d = G.debris[0]; d.x = 60; d.y = 48.8; G.jobs.rocks.prog.total = 1;
    place(G, 50, 48, 0); run(G, FWD, 3);
    ok(d.x > 65 && Math.abs(d.y - 48) < 0.3, 'the bulldozer pushes it along and centres it on the blade');
    const zone = JOB.rocks.steps[0].zone;
    place(G, zone.x - 8, zone.y, 0); d.x = zone.x - 8 + C.RADIUS + d.r; d.y = zone.y; run(G, FWD, 2);
    ok(G.jobs.rocks.st === 'done' && seen(G, 'cleared') === 1, 'pushing the last boulder into the crusher finishes the job');
    G = at('rocks', 0, 'dozer'); d = G.debris[0]; d.x = th.x - d.r; d.y = th.y - d.r; run(G, NONE, 2);
    ok(W.distRect(d, th) >= d.r + C.WORK.wallMargin - 0.05, 'a boulder left against a wall drifts clear of it');

    G = at('farm', 2, 'loader');
    ok(G.debris.length === 6, 'the field has six rocks');
    const fz = JOB.farm.steps[2].zone;
    G.debris.forEach((r, i) => { r.x = 100 + i * 3; r.y = 90; });
    place(G, 96, 90, 0); run(G, FWD, 3);
    ok(G.cargo.loader === C.WORK.bucket && G.debris.length === 3 && seen(G, 'scoop') === 3, 'the loader scoops three and no more');
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.cargo.loader === 2 && G.debris.length === 4 && seen(G, 'drop') === 1, 'away from the pile the button tips one back out');
    place(G, fz.x, fz.y + 2, 0); G.debris.forEach((r, i) => { r.x = 100 + i * 3; r.y = 90; });
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.cargo.loader === 0 && G.jobs.farm.prog.n === 2 && seen(G, 'dumped') === 1, 'at the pile it tips the bucket and the rocks count');
    G.debris.forEach((r) => { r.x = fz.x; r.y = fz.y; }); Gm.step(G, NONE, DT);
    ok(G.jobs.farm.st === 'done', 'rocks shoved straight onto the pile count too');
    G = at('farm', 2, 'loader'); G.cargo.loader = 1; G.cargoJob = 'cannery';
    G.debris[0].x = G.p.x + C.RADIUS + 0.5; G.debris[0].y = G.p.y; run(G, NONE, 0.1);
    ok(G.cargo.loader === 1, "a bucket holding another job's rubble does not mix loads");

    section('rules: dig, pour, lift and wreck');
    G = at('bridge', 0, 'digger'); let sp = JOB.bridge.steps[0].spots[0];
    place(G, sp.x - 2.5, sp.y); run(G, NONE, 1);
    ok(G.jobs.bridge.prog.spots[0] === 0, 'digging needs the button held');
    run(G, { ...NONE, h: true }, C.WORK.digTime / 2);
    ok(G.jobs.bridge.prog.spots[0] > 0.4 && G.jobs.bridge.prog.spots[0] < 0.6 && seen(G, 'digTick') >= 2, 'holding digs, with ticks');
    G.veh = 'dump'; run(G, { ...NONE, h: true }, 1);
    ok(G.jobs.bridge.prog.spots[0] < 0.6, 'only the excavator digs');
    G.veh = 'digger'; run(G, { ...NONE, h: true }, C.WORK.digTime / 2 + 0.1);
    ok(G.jobs.bridge.prog.n === 1 && seen(G, 'dug') === 1, 'a spot finishes');
    place(G, sp.x - 2.5, JOB.bridge.steps[0].spots[1].y); run(G, { ...NONE, h: true }, C.WORK.digTime + 0.1);
    ok(G.jobs.bridge.step === 1, 'both spots dug moves on to the concrete');
    G.veh = 'mixer'; run(G, { ...NONE, h: true }, C.WORK.pourTime + 0.1);
    ok(G.jobs.bridge.prog.n === 1 && seen(G, 'poured') === 1, 'the mixer pours a footing');

    G = at('bridge', 2, 'crane'); const ls = JOB.bridge.steps[2].sites[0]; place(G, ls.x, ls.y);
    G.hookT = Math.PI / 2; Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.jobs.bridge.prog.n === 0 && seen(G, 'miss') === 1 && G.missCd > 0, 'pressing with the hook off the mark misses');
    G.hookT = 0; Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.jobs.bridge.prog.n === 0, 'and the crane needs a moment before it can try again');
    run(G, NONE, C.WORK.missCd + 0.05); G.hookT = 0; Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.jobs.bridge.prog.n === 1 && seen(G, 'placed') === 1, 'pressing with the hook over the mark places a span');
    G.hookT = 0; Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.jobs.bridge.prog.n === 1, 'the next span has to be rigged first (no two in one instant)');
    for (let i = 0; i < 3; i++) { run(G, NONE, C.WORK.placeCd + 0.05); G.hookT = 0; Gm.step(G, { ...NONE, a: true }, DT); }
    ok(G.jobs.bridge.st === 'done' && W.obstacles(G).length === W.obstacles(Gm.newGame(1)).length + 1, 'four spans open the bridge (the river is now two pieces)');

    G = at('cannery', 0, 'wrecker'); const can = City.BUILDINGS.find((b) => b.id === 'cannery');
    place(G, can.x + can.w / 2, can.y + can.h + C.RADIUS + 2);
    Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.swing > 0 && seen(G, 'swing') === 1 && G.jobs.cannery.prog.hp === 8, 'the button starts a swing');
    run(G, NONE, C.WORK.swingTime + 0.02);
    ok(G.jobs.cannery.prog.hp === 7 && seen(G, 'smash') === 1, 'which lands a moment later');
    place(G, 20, 66); Gm.step(G, { ...NONE, a: true }, DT);
    ok(G.swing === 0 && seen(G, 'honk') === 1, 'too far away it only honks');
    place(G, can.x + can.w / 2, can.y + can.h + C.RADIUS + 2);
    for (let i = 0; i < 7; i++) { Gm.step(G, { ...NONE, a: true }, DT); run(G, NONE, C.WORK.swingTime + 0.02); }
    ok(G.jobs.cannery.step === 1 && seen(G, 'collapse') === 1 && !W.buildingUp(G, can), 'eight hits bring the cannery down');
    ok(G.debris.filter((x) => x.kind === 'chunk').length === 3, 'leaving three big chunks to push');
    G.debris.length = 0;      // (the chunks are in the way; this is about the walls being gone)
    place(G, can.x + can.w / 2, can.y + can.h / 2, 0); run(G, FWD, 1);
    ok(G.p.x > can.x + can.w / 2 + 2, 'and the lot can be driven across');

    section('rules: the end');
    G = at('square', 3, 'crane'); for (const j of JOBS) if (j.id !== 'square') G.jobs[j.id].st = 'done';
    const ss = JOB.square.steps[3].sites[0]; place(G, ss.x, ss.y);
    for (let i = 0; i < 3; i++) { run(G, NONE, C.WORK.placeCd + 0.05); G.hookT = 0; Gm.step(G, { ...NONE, a: true }, DT); }
    ok(G.finished && seen(G, 'allDone') === 1, 'finishing the last job ends the story');
    run(G, NONE, 0.2);
    const st = City.BUILDINGS.find((b) => b.id === 'statue');
    ok(W.distRect(G.p, st) >= C.RADIUS - 0.01, 'a truck standing where the statue appears is moved out of it');
    run(G, FWD, 1);
    ok(Number.isFinite(G.p.x), 'and the town can still be driven around afterwards');
    G = Gm.newGame(3); run(G, NONE, 30);
    ok(G.events.length === 0 && G.t > 29.9, 'doing nothing for half a minute breaks nothing');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); run(G, (g) => { g.events.length = 0; return Bt.botInput(g, b); }, secs); return G; };
    ok(JSON.stringify(Gm.serialize(play(42, 90))) === JSON.stringify(Gm.serialize(play(42, 90))), 'same seed and inputs, same game');
    ok(JSON.stringify(Gm.serialize(play(42, 60)).debris) !== JSON.stringify(Gm.serialize(play(43, 60)).debris), 'a different seed scatters the boulders differently');

    // save in the middle of each kind of work, load, and play both copies on with the same inputs
    for (const secs of [30, 100, 170, 260]) {
        const G = play(7, secs);
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = Bt.makeBot({ seed: 9 }), b2 = Bt.makeBot({ seed: 9 });
        run(G, (g) => { g.events.length = 0; return Bt.botInput(g, b1); }, 40);
        run(copy, (g) => { g.events.length = 0; return Bt.botInput(g, b2); }, 40);
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save at ${secs}s (${G.active || 'between jobs'}) plays on identically`);
    }
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    const G = Gm.newGame(1); run(G, { ...NONE, a: true }, 30);
    ok(G.events.length <= 400, 'the event queue is bounded when nobody drains it');
}

if (want('proofs')) {
    section('proofs');
    let bad = 0, n = 0;
    for (let s = 1; s <= 60; s++) for (const j of JOBS) j.steps.forEach((st, k) => {
        if (st.kind !== 'push' && st.kind !== 'scoop') return;
        const G = at(j.id, k, null, s), obs = W.obstacles(G);
        for (const d of G.debris) {
            n++;
            const legal = d.x > d.r && d.y > d.r && d.x < C.WORLD.w - d.r && d.y < C.WORLD.h - d.r
                && obs.every((o) => W.distRect(d, o) >= d.r + C.WORK.wallMargin - 1e-6)
                && W.dist(d, st.zone) > st.zone.r
                && G.debris.every((e) => e === d || W.dist(d, e) >= d.r + e.r);
            if (!legal) bad++;
        }
    });
    ok(bad === 0, `60 seeds: all ${n} pieces of debris start clear of walls, of each other and of their zone (${bad} bad)`);

    // every place a job sends you can be driven to; the east bank only once the bridge is up
    const canReach = (G, pt) => {
        const seenCells = Nav.reachable(Nav.staticGrid(G), City.SPAWN.x, City.SPAWN.y);
        for (let i = 0; i < seenCells.length; i++) if (seenCells[i]) { const c = Nav.centre(i); if (Math.hypot(c.x - pt.x, c.y - pt.y) <= pt.reach) return true; }
        return false;
    };
    let nPts = 0, nEast = 0;
    const eastJobs = new Set();
    for (const j of JOBS) j.steps.forEach((st, k) => {
        const points = [];
        const add = (p, reach) => points.push({ x: p.x, y: p.y, reach, east: p.x > City.RIVER.x + City.RIVER.w });
        if (st.kind === 'haul') { add(City.ZONES[st.from], City.ZONES[st.from].r - 1); add(st.site, st.site.r - 1); }
        if (st.kind === 'roll') W.cellsOf(st.rect, C.WORK.rollCell).forEach((c) => add(c, C.WORK.rollReach - 0.4));
        if (st.kind === 'push' || st.kind === 'scoop') { add(st.at, st.at.r); add(st.zone, st.zone.r); }
        if (st.kind === 'dig' || st.kind === 'pour') st.spots.forEach((p) => add(p, C.WORK.workReach - 0.6));
        if (st.kind === 'lift') st.sites.forEach((p) => add(p, p.r - 1));
        if (st.kind === 'wreck') { const b = City.BUILDINGS.find((x) => x.id === st.building); add({ x: b.x + b.w / 2, y: b.y + b.h + C.RADIUS + 1 }, 2.5); }
        // the town as it stands when this step is in hand, and the same town with the bridge taken away
        const G = at(j.id, k), dry = at(j.id, k);
        G.debris.length = 0; dry.debris.length = 0;
        dry.jobs.bridge.st = 'open'; dry.rev++;
        for (const p of points) {
            nPts++;
            if (p.east) { nEast++; eastJobs.add(j.id); ok(!canReach(dry, p), `${j.id} ${st.kind} (${p.x},${p.y}) cannot be reached without the bridge`); }
            if (j.id !== 'bridge' || !p.east) ok(canReach(G, p), `${j.id} ${st.kind} (${p.x},${p.y}) can be driven to from the yard`);
        }
    });
    ok(nEast > 0 && nEast < nPts, `${nPts} work points, ${nEast} of them on the east bank`);
    const needsBridge = (id, seenIds = new Set()) => id === 'bridge' || JOB[id].needs.some((n) => !seenIds.has(n) && needsBridge(n, seenIds.add(n)));
    ok([...eastJobs].every((id) => JOB[id].needs.length && needsBridge(id)), `every job with work on the east bank (${[...eastJobs].join(', ')}) needs the bridge first`);
    const all = Gm.newGame(1); for (const j of JOBS) finish(all, j.id);
    const total = Nav.staticGrid(all).reduce((a, v) => a + (v ? 0 : 1), 0), got = Nav.reachable(Nav.staticGrid(all), City.SPAWN.x, City.SPAWN.y).reduce((a, v) => a + v, 0);
    ok(got / total > 0.93, `in the finished town ${Math.round(got / total * 100)}% of the open ground can be driven to (no sealed pockets)`);
}

if (want('bot')) {
    section('bot');
    const rows = [], skills = [1, 0.6, 0.2];
    for (const skill of skills) for (let s = 1; s <= SEEDS; s++) {
        const G = Gm.newGame(s * 7919), bot = Bt.makeBot({ skill, seed: s });
        let bad = null, n = 0, misses = 0;
        const times = {};
        while (!G.finished && G.t < 3600 && !bad) {
            Gm.step(G, Bt.botInput(G, bot), DT);
            for (const e of G.events) { if (e.type === 'jobDone') times[e.job] = e.time; if (e.type === 'miss') misses++; }
            G.events.length = 0;
            const p = G.p;
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.v) || !Number.isFinite(p.a)) bad = 'non-finite vehicle';
            else if (p.x < 0 || p.y < 0 || p.x > C.WORLD.w || p.y > C.WORLD.h) bad = 'outside the town';
            else if (++n % 12 === 0) {
                if (W.obstacles(G).some((o) => W.distRect(p, o) < C.RADIUS - 0.05)) bad = `inside a wall at ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                else if (G.debris.some((d) => !Number.isFinite(d.x) || d.x < 0 || d.y < 0 || d.x > C.WORLD.w || d.y > C.WORLD.h)) bad = 'debris lost';
                else if (G.cargo.loader > C.WORK.bucket || G.stars > MAX_STARS) bad = 'a counter over its limit';
            }
        }
        ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
        ok(G.finished, `seed ${s} skill ${skill}: the bot finishes every job (${Math.round(G.t)}s${G.finished ? '' : ', stuck in ' + G.active})`);
        rows.push({ skill, seed: s, t: G.t, stars: G.stars, misses, times, done: G.finished });
    }
    const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const of = (k) => rows.filter((r) => r.skill === k);
    console.log('  job (par)          ' + skills.map((k) => `skill ${k}`.padStart(10)).join(''));
    for (const j of JOBS) console.log('  ' + `${j.id} (${j.par})`.padEnd(19) + skills.map((k) => `${Math.round(med(of(k).map((r) => r.times[j.id] ?? 9999)))}s`.padStart(10)).join(''));
    console.log('  ' + 'whole game'.padEnd(19) + skills.map((k) => `${(med(of(k).map((r) => r.t)) / 60).toFixed(1)}m`.padStart(10)).join(''));
    console.log('  ' + `stars (of ${MAX_STARS})`.padEnd(19) + skills.map((k) => `${med(of(k).map((r) => r.stars))}`.padStart(10)).join(''));
    console.log('  ' + 'crane misses'.padEnd(19) + skills.map((k) => `${med(of(k).map((r) => r.misses))}`.padStart(10)).join(''));
    ok(of(1).every((r) => r.stars === MAX_STARS), 'a perfect bot earns every star on every seed');
    ok(of(1).every((r) => r.misses === 0), 'and never misses with the crane');
    ok(med(of(0.2).map((r) => r.stars)) < MAX_STARS, 'a slow, clumsy bot does not');
    ok(med(of(0.2).map((r) => r.stars)) >= JOBS.length * 2, 'but still earns two stars a job on average (nobody is punished hard)');
    ok(med(of(0.2).map((r) => r.misses)) > 0, 'and misses with the crane now and then');
    ok(med(of(1).map((r) => r.t)) < med(of(0.6).map((r) => r.t)) && med(of(0.6).map((r) => r.t)) < med(of(0.2).map((r) => r.t)), 'skill buys time, in order');
    for (const j of JOBS) {
        const t = med(of(1).map((r) => r.times[j.id]));
        ok(t < j.par * 0.75, `${j.id}: the perfect bot beats par with room to spare (${Math.round(t)}s of ${j.par}s)`);
        ok(t > j.par * 0.25, `${j.id}: par is not absurdly generous (${Math.round(t)}s of ${j.par}s)`);
    }
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
