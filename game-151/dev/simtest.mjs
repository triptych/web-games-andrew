/**
 * simtest.mjs — headless checks of One Shot's simulation. No browser.
 *
 *   node game-151/dev/simtest.mjs            # everything
 *   ONLY=purity,board node game-151/dev/simtest.mjs
 *   SEEDS=6 VERBOSE=1 node game-151/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the clock.
 * 2. board: generation (no runs, always a move, over 200 seeds), runs, specials (4 → line, 5 → nova, L/T → cross),
 *    blasts, static shattering, gravity and refill, shuffles.
 * 3. rules: swaps, charge and its multipliers, missiles and escorts, enemy fire, rounds, routing, the final window,
 *    the shot, resistances, the shifting barrier, jammers, the desperate shot, grades, rewards, unlocks, the hangar.
 * 4. determinism: same seed and commands → same game; a save round trip mid-round plays on identically.
 * 5. bot: whole campaigns at skill 1 and 0.6 over SEEDS seeds with per-step invariants, the balance table, and the
 *    bands the campaign must land in.
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
const Gm = await import('../js/sim/game.js');
const B = await import('../js/sim/board.js');
const Bt = await import('../js/sim/bot.js');
const { BOSSES } = await import('../js/sim/data.js');
const { makeRng } = await import('../js/rng.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const run = (G, secs, until = () => false) => { for (let t = 0; t < secs && !until(G); t += DT) Gm.step(G, DT); };
const idx = B.idx;
const T = (k, sp = 0) => ({ id: Math.random() * 1e9 | 0, k, sp });     // test boards only

/** A board of a repeating pattern with no runs, then the given cells set. */
function boardOf(set = {}) {
    const b = { cells: [], nextId: 1000, phase: 'idle', t: 0, depth: 0, swap: null, pending: null };
    for (let r = 0; r < C.BOARD.rows; r++) for (let c = 0; c < C.BOARD.cols; c++) b.cells.push({ id: b.nextId++, k: (r * 2 + c) % 4 + 1, sp: 0 });
    // speed, thermal, cryo and volt in a pattern that never makes three in a row or column; power and shield are free
    for (const [i, t] of Object.entries(set)) b.cells[+i] = { id: b.nextId++, ...t };
    return b;
}
function freshMission(seed = 1, level = 0) {
    const G = Gm.newGame(seed);
    G.unlocked = level;
    Gm.act(G, { t: 'start', level });
    Gm.act(G, { t: 'launch' });
    G.events.length = 0;
    return G;
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
if (want('board')) {
    section('board');
    let bad = 0;
    for (let s = 1; s <= 200; s++) {
        const b = B.newBoard(makeRng(s));
        if (B.findRuns(b.cells).length || !B.hasMove(b.cells) || b.cells.length !== 49) bad++;
    }
    ok(bad === 0, `200 fresh boards: no runs, always a move (${bad} bad)`);
    ok(B.findRuns(boardOf().cells).length === 0, 'the test pattern has no runs');

    // a horizontal three
    let b = boardOf({ [idx(3, 0)]: { k: 5, sp: 0 }, [idx(3, 1)]: { k: 5, sp: 0 }, [idx(3, 2)]: { k: 5, sp: 0 } });
    let res = B.clearRuns(b, []);
    ok(res && res.cleared.length === 3 && !res.created.length, 'three in a row clear, no special');
    ok(b.cells[idx(3, 1)] === null, 'cleared cells are emptied');

    // four → a line at the pivot
    b = boardOf({ [idx(2, 1)]: { k: 5, sp: 0 }, [idx(2, 2)]: { k: 5, sp: 0 }, [idx(2, 3)]: { k: 5, sp: 0 }, [idx(2, 4)]: { k: 5, sp: 0 } });
    res = B.clearRuns(b, [idx(2, 3)]);
    ok(res.created.length === 1 && res.created[0].sp === C.SP.lineH && res.created[0].i === idx(2, 3), 'four in a row leave a horizontal line at the swapped cell');
    // five → a nova
    b = boardOf(Object.fromEntries([0, 1, 2, 3, 4].map((r) => [idx(r, 6), { k: 5, sp: 0 }])));
    res = B.clearRuns(b, []);
    ok(res.created.length === 1 && res.created[0].sp === C.SP.nova, 'five in a column leave a nova');
    // L → a cross at the corner
    b = boardOf({ [idx(4, 2)]: { k: 5, sp: 0 }, [idx(4, 3)]: { k: 5, sp: 0 }, [idx(4, 4)]: { k: 5, sp: 0 }, [idx(5, 4)]: { k: 5, sp: 0 }, [idx(6, 4)]: { k: 5, sp: 0 } });
    res = B.clearRuns(b, []);
    ok(res.created.length === 1 && res.created[0].sp === C.SP.cross && res.created[0].i === idx(4, 4), 'an L leaves a cross at its corner');

    // a line caught in a run clears its row
    b = boardOf({ [idx(3, 0)]: { k: 5, sp: C.SP.lineH }, [idx(4, 0)]: { k: 5, sp: 0 }, [idx(5, 0)]: { k: 5, sp: 0 } });
    res = B.clearRuns(b, []);
    ok(res.blasts.length === 1 && res.cleared.length === 3 + 6, 'a line special in a match clears its whole row');
    b = boardOf({ [idx(0, 0)]: { k: 5, sp: C.SP.nova }, [idx(0, 1)]: { k: 5, sp: 0 }, [idx(0, 2)]: { k: 5, sp: 0 }, [idx(6, 6)]: { k: 5, sp: 0 } });
    res = B.clearRuns(b, []);
    ok(res.cleared.some((t) => t.i === idx(6, 6)), 'a nova clears every tile of its kind');

    // static shatters next to a clear and never matches
    b = boardOf({ [idx(3, 0)]: { k: 5, sp: 0 }, [idx(3, 1)]: { k: 5, sp: 0 }, [idx(3, 2)]: { k: 5, sp: 0 }, [idx(2, 1)]: { k: C.STATIC, sp: 0 } });
    res = B.clearRuns(b, []);
    ok(res.cleared.some((t) => t.k === C.STATIC), 'static next to a match shatters');
    b = boardOf({ [idx(1, 0)]: { k: C.STATIC, sp: 0 }, [idx(1, 1)]: { k: C.STATIC, sp: 0 }, [idx(1, 2)]: { k: C.STATIC, sp: 0 } });
    ok(!B.findRuns(b.cells).length, 'three static in a row are not a match');
    ok(B.swapGain(b.cells, idx(1, 0), idx(2, 0)) === null, 'static cannot be swapped');

    // gravity
    b = boardOf({ [idx(3, 0)]: { k: 5, sp: 0 }, [idx(3, 1)]: { k: 5, sp: 0 }, [idx(3, 2)]: { k: 5, sp: 0 } });
    const above = b.cells[idx(2, 0)].id;
    B.clearRuns(b, []);
    const g = B.gravity(b, makeRng(4));
    ok(b.cells.every(Boolean), 'gravity leaves no holes');
    ok(b.cells[idx(3, 0)].id === above && g.moves.some((mv) => mv.id === above && mv.to === idx(3, 0)), 'tiles fall into the gap');
    ok(g.spawns.length === 3 && g.spawns.every((s) => s.drop === 1), 'one new tile per column drops in from above');

    // shuffle
    b = B.newBoard(makeRng(9));
    for (let i = 0; i < 49; i++) b.cells[i].k = i % 2 ? 6 : b.cells[i].k;     // half static
    B.shuffle(b, makeRng(10));
    ok(!B.findRuns(b.cells).length && B.hasMove(b.cells), 'a shuffle always leaves a move and no runs');
}

// ======================================================================
if (want('rules')) {
    section('rules');
    let G = freshMission(1, 0);
    run(G, 1.2);
    ok(G.m.phase === 'round' && G.m.round === 0 && G.m.clock > 20 && G.m.drones.length, 'launch starts round 1 with its clock, and escorts come');
    ok(!Gm.act(G, { t: 'fire' }), 'the Lance cannot fire during a round');
    ok(!Gm.act(G, { t: 'swap', a: 0, b: 2 }), 'a swap of non-neighbours is refused');

    // a valid swap charges, an invalid one swaps back
    const mv = B.listMoves(G.m.board.cells)[0];
    Gm.act(G, { t: 'swap', a: mv.a, b: mv.b });
    run(G, 2, (g) => g.m.board.phase === 'idle' && g.events.some((e) => e.type === 'clear'));
    run(G, 3, (g) => g.m.board.phase === 'idle');
    const total = (m) => Object.values(m.charge).reduce((s, v) => s + v, 0) + m.shield;
    ok(total(G.m) > 0 && G.events.some((e) => e.type === 'clear'), 'a matching swap clears tiles and charges');
    ok(G.events.some((e) => e.type === 'missile'), 'and fires missiles at the escorts');
    G = freshMission(2, 0);
    const cells = G.m.board.cells;
    let bad = null;
    for (let i = 0; i < 48 && !bad; i++) if ((i % 7) < 6 && !B.swapGain(cells, i, i + 1)) bad = [i, i + 1];
    const before = cells[bad[0]].id;
    Gm.act(G, { t: 'swap', a: bad[0], b: bad[1] });
    run(G, 0.5, (g) => g.m.board.phase === 'idle');
    ok(G.events.some((e) => e.type === 'swapFail') && G.m.board.cells[bad[0]].id === before, 'a swap that matches nothing swaps back');

    // a swap made while the board settles is kept
    G = freshMission(3, 0);
    const m1 = B.listMoves(G.m.board.cells)[0];
    Gm.act(G, { t: 'swap', a: m1.a, b: m1.b });
    Gm.step(G, DT);
    ok(Gm.act(G, { t: 'swap', a: 0, b: 1 }) && G.m.board.pending, 'a swap during a cascade is queued, not lost');

    // multipliers: cascade depth and rush
    G = freshMission(4, 0);
    G.m.board = boardOf({ [idx(3, 0)]: { k: 0, sp: 0 }, [idx(3, 1)]: { k: 0, sp: 0 }, [idx(4, 2)]: { k: 0, sp: 0 } });
    G.m.rushT = 0;
    // swap (4,2) up into (3,2): power × 3
    Gm.act(G, { t: 'swap', a: idx(4, 2), b: idx(3, 2) });
    run(G, 0.2, (g) => g.events.some((e) => e.type === 'clear'));
    const ce = G.events.find((e) => e.type === 'clear');
    ok(ce && ce.depth === 0 && Math.abs(ce.gain.power - 3 * C.CHARGE.tile) < 1e-6, 'three power tiles give 3 × the tile value at depth 0, rush 1');
    G.m.rush = 6;
    ok(Math.abs(Gm.rushMult(G.m) - (1 + 5 * C.CHARGE.rushStep)) < 1e-9, 'each rush link adds rushStep to the multiplier');
    G.m.rush = 99;
    ok(Gm.rushMult(G.m) === C.CHARGE.rushMax, 'the rush multiplier is capped');
    G = freshMission(4, 0);
    G.up.capacitor = 2;
    G.m.board = boardOf({ [idx(3, 0)]: { k: 0, sp: 0 }, [idx(3, 1)]: { k: 0, sp: 0 }, [idx(4, 2)]: { k: 0, sp: 0 } });
    Gm.act(G, { t: 'swap', a: idx(4, 2), b: idx(3, 2) });
    run(G, 0.2, (g) => g.events.some((e) => e.type === 'clear'));
    ok(Math.abs(G.events.find((e) => e.type === 'clear').gain.power - 3 * C.CHARGE.tile * 1.3) < 1e-6, 'the Lance Capacitor adds 15% Power per level');

    // shield tiles fill the deflector, capped
    G = freshMission(5, 0);
    G.m.board = boardOf({ [idx(3, 0)]: { k: 5, sp: 0 }, [idx(3, 1)]: { k: 5, sp: 0 }, [idx(4, 2)]: { k: 5, sp: 0 } });
    Gm.act(G, { t: 'swap', a: idx(4, 2), b: idx(3, 2) });
    run(G, 0.2, (g) => g.events.some((e) => e.type === 'clear'));
    ok(G.m.shield === 3 * C.CHARGE.shieldTile, 'shield tiles charge the deflector');

    // escorts: they come in, aim, fire; the deflector blocks, the hull bleeds charge
    G = freshMission(6, 0);
    run(G, 1.0);
    ok(G.m.drones.length === 1 && G.events.some((e) => e.type === 'droneIn'), 'the first escort launches');
    G.m.shield = 100;
    run(G, 8, (g) => g.events.some((e) => e.type === 'hit'));
    let hit = G.events.find((e) => e.type === 'hit');
    ok(hit && hit.absorbed === hit.dmg && hit.rest === 0 && G.m.hull === G.m.maxHull, 'the deflector absorbs a shot');
    G.events.length = 0;
    G.m.shield = 0;
    G.m.charge.speed = 500;
    run(G, 8, (g) => g.events.some((e) => e.type === 'hit'));
    hit = G.events.find((e) => e.type === 'hit');
    ok(hit && hit.rest > 0 && G.m.hull < G.m.maxHull && hit.stat === 'speed' && G.m.charge.speed < 500, 'a hull hit leaks charge from the biggest stat');

    // missiles kill escorts; the round ends when the wave is down
    G = freshMission(7, 0);
    G.up.missiles = 5;
    const bot = Bt.makeBot({ skill: 1 });
    for (let t = 0; t < 40 && G.m.phase === 'round'; t += DT) { Gm.step(G, DT); const c = G.m.phase === 'round' && Bt.botCmd(G, bot, DT); if (c) Gm.act(G, c); }
    ok(G.m.phase === 'clear' && G.events.some((e) => e.type === 'roundEnd' && e.cleared), 'shooting the whole wave down clears the round');
    ok(G.events.filter((e) => e.type === 'droneDown').length === BOSSES[0].waves[0].count, 'every escort of the wave went down');
    const spare = G.m.spare, sp0 = G.m.charge.speed;
    ok(spare > 0, 'a cleared round banks its spare seconds');
    Gm.act(G, { t: 'route', stat: 'speed' });
    ok(Math.abs(G.m.charge.speed - sp0 - Math.round(C.ROUND.routeBase + spare * C.ROUND.routePerSec)) < 1e-6, 'routing adds routeBase + routePerSec × spare to the chosen stat');
    ok(G.m.phase === 'round' && G.m.round === 1, 'and the next round starts');

    // a round that times out: survivors make a final pass, no spare
    G = freshMission(8, 0);
    G.m.shield = 0;
    run(G, BOSSES[0].roundTime + 3, (g) => g.m.phase !== 'round');
    ok(G.m.phase === 'clear' && G.m.spare === 0 && G.m.timeouts === 1, 'a timed-out round ends with no spare seconds');
    ok(G.events.some((e) => e.type === 'roundEnd' && !e.cleared), 'and says the wave escaped');

    // after the last round the mothership is exposed; the Lance fires on FIRE or when the window closes
    G = freshMission(9, 0);
    G.m.round = G.m.rounds - 1; G.m.phase = 'clear'; G.m.spare = 0;
    Gm.act(G, { t: 'route', stat: 'power' });
    ok(G.m.phase === 'lance' && G.events.some((e) => e.type === 'exposed') && Math.abs(G.m.clock - Gm.lanceTime(G)) < 1e-9, 'after the last round comes the final window');
    ok(!G.m.drones.length, 'with no escorts');
    run(G, Gm.lanceTime(G) + 2, (g) => g.m.phase !== 'lance');
    ok(G.m.phase === 'beam' && G.m.firedWith === 0, 'the Lance fires itself when the window closes');
    G = freshMission(9, 0);
    G.m.round = G.m.rounds - 1; G.m.phase = 'clear'; G.m.spare = 0;
    Gm.act(G, { t: 'route', stat: 'power' });
    run(G, 1);
    Gm.act(G, { t: 'fire' });
    run(G, 1, (g) => g.m.phase === 'beam');
    ok(G.m.phase === 'beam' && G.m.firedWith > 8, 'FIRE fires early and remembers the time left');
    ok(!Gm.act(G, { t: 'swap', a: 0, b: 1 }), 'no swaps once the Lance has fired');

    // the shot: each stat against its requirement
    G = freshMission(10, 1);
    const boss = BOSSES[1];
    Object.assign(G.m.charge, { power: boss.req.armor * 2, speed: boss.req.speed * 2, thermal: 0, cryo: 0, volt: 0 });
    G.m.charge.cryo = boss.req.barrier / (1 - boss.resist.cryo) * 2;
    let ev = Gm.evaluate(G);
    ok(Math.abs(ev.ratios.armor - 2) < 1e-9 && Math.abs(ev.ratios.speed - 2) < 1e-9 && Math.abs(ev.ratios.barrier - 2) < 1e-9, 'ratios are stat / requirement, elements after resistance');
    ok(Gm.gradeFor(ev.min) === 'S', 'everything at 2× is an S');
    G.m.charge.cryo = 0; G.m.charge.thermal = boss.req.barrier * 2;
    ev = Gm.evaluate(G);
    ok(Math.abs(ev.ratios.barrier - 2 * (1 - boss.resist.thermal)) < 1e-9, 'a resisted element is soaked by the barrier');
    ok(Gm.gradeFor(0.99) === 'F' && Gm.gradeFor(1) === 'C' && Gm.gradeFor(1.3) === 'B' && Gm.gradeFor(1.6) === 'A', 'grades step at 1.0, 1.3, 1.6 and 2.0');

    // a full sortie: destroyed, graded, rewarded, unlocked; then the replay pays half
    const shoot = (g, k) => {
        const b = BOSSES[g.m.level];
        g.m.round = g.m.rounds - 1; g.m.phase = 'clear'; g.m.spare = 0;
        Gm.act(g, { t: 'route', stat: 'power' });
        const best = C.ELEMENTS.reduce((a, e) => (g.m.resist[e] < g.m.resist[a] ? e : a), 'thermal');
        Object.assign(g.m.charge, { power: b.req.armor * k, speed: b.req.speed * k, thermal: 0, cryo: 0, volt: 0 });
        g.m.charge[best] = b.req.barrier / (1 - g.m.resist[best]) * k;
        Gm.act(g, { t: 'fire' });
        run(g, 12, (x) => x.m.phase === 'result');
        return g.m.result;
    };
    G = freshMission(11, 0);
    let r = shoot(G, 2.1);
    ok(r && r.destroyed && r.grade === 'S' && G.best[0] === 'S' && G.unlocked === 1 && G.scrap === r.scrap, 'a 2× shot destroys it with an S, pays scrap and unlocks the next');
    ok(r.medals.includes('flawless'), 'no hull damage earns Flawless');
    Gm.act(G, { t: 'done' });
    ok(G.m === null && G.events.some((e) => e.type === 'hangar'), 'Continue returns to the hangar');
    Gm.act(G, { t: 'start', level: 0 }); Gm.act(G, { t: 'launch' });
    const r2 = shoot(G, 2.1);
    ok(!r2.improved && r2.scrap < r.scrap * 0.7, 'replaying for the same grade pays half');
    Gm.act(G, { t: 'done' });
    ok(!Gm.act(G, { t: 'start', level: 3 }), 'a locked mothership cannot be started');
    Gm.act(G, { t: 'start', level: 1 }); Gm.act(G, { t: 'launch' });
    r = shoot(G, 0.8);
    ok(!r.destroyed && r.grade === 'F' && G.unlocked === 1 && r.scrap > 0, 'a shot short of a requirement fails but pays a little');
    Gm.act(G, { t: 'retry' });
    ok(G.m && G.m.phase === 'brief' && G.m.level === 1, 'Retry goes straight back to the briefing');

    // the desperate shot
    G = freshMission(12, 0);
    G.m.hull = 1; G.m.shield = 0;
    G.m.charge.power = 100;
    run(G, 12, (g) => g.m.phase !== 'round');
    ok(G.m.phase === 'beam' && G.m.desperate && G.events.some((e) => e.type === 'downed'), 'a ship going down fires what it has');
    ok(Math.abs(G.m.shot.stats.armor - (G.m.charge.power) * C.DESPERATE) < 1e-6, 'at the desperate fraction');

    // the shifting barrier and the jammer
    G = freshMission(13, 4);
    const r0 = { ...G.m.resist };
    run(G, BOSSES[4].shift.every + 0.1);
    ok(G.events.some((e) => e.type === 'shift') && JSON.stringify(r0) !== JSON.stringify(G.m.resist), 'the Prism Cathedral shifts its barrier on time');
    ok(JSON.stringify(Gm.nextResist(G)) !== JSON.stringify(G.m.resist), 'and the HUD can read the next tuning');
    G = freshMission(14, 3);
    run(G, BOSSES[3].jam.first + 0.5);
    ok(G.events.some((e) => e.type === 'jam') && B.countStatic(G.m.board.cells) >= 1, 'the Storm Lattice jams the board with static');
    G.m.shield = 999;
    run(G, 60);
    ok(B.countStatic(G.m.board.cells) <= BOSSES[3].jam.max, 'never more than its static cap');

    // the hangar
    G = Gm.newGame(15);
    ok(!Gm.act(G, { t: 'buy', id: 'capacitor' }), 'no scrap, no upgrade');
    G.scrap = 1000;
    ok(Gm.act(G, { t: 'buy', id: 'capacitor' }) && G.up.capacitor === 1 && G.scrap === 1000 - C.UPGRADE_COST[0], 'an upgrade costs its price');
    G.up.capacitor = C.UPGRADE_MAX;
    ok(!Gm.act(G, { t: 'buy', id: 'capacitor' }), 'a maxed upgrade cannot be bought');
    G.up.reactor = 2;
    ok(Gm.roundTime(G, BOSSES[0]) === BOSSES[0].roundTime + 6 && Gm.lanceTime(G) === C.ROUND.lance + 6, 'the Reactor Core lengthens rounds and the final window');
    Gm.act(G, { t: 'start', level: 0 });
    ok(Gm.act(G, { t: 'abort' }) && G.m === null, 'a sortie can be aborted from the briefing');

    // data sanity
    ok(BOSSES.every((b) => b.waves.length >= 2 && b.req.speed > 0 && C.ELEMENTS.every((e) => b.resist[e] < 1)), 'every mothership has waves, requirements and a beatable barrier');
    ok(BOSSES.every((b) => C.ELEMENTS.some((e) => b.resist[e] <= 0)), 'every barrier has an element it does not resist');
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => {
        const G = freshMission(seed, 1);
        const bot = Bt.makeBot({ skill: 1 });
        for (let t = 0; t < secs; t += DT) { Gm.step(G, DT); const c = Bt.botCmd(G, bot, DT); if (c) Gm.act(G, c); G.events.length = 0; }
        return G;
    };
    ok(JSON.stringify(Gm.serialize(play(42, 25))) === JSON.stringify(Gm.serialize(play(42, 25))), 'same seed and commands, same game');
    ok(JSON.stringify(Gm.serialize(play(42, 25))) !== JSON.stringify(Gm.serialize(play(43, 25))), 'a different seed, a different game');

    const G = play(7, 12);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ skill: 1, seed: 9 }), b2 = Bt.makeBot({ skill: 1, seed: 9 });
    for (const [g, b] of [[G, b1], [copy, b2]]) for (let t = 0; t < 20; t += DT) { Gm.step(g, DT); const c = Bt.botCmd(g, b, DT); if (c) Gm.act(g, c); g.events.length = 0; }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip mid-round plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    for (const skill of [1, 0.6]) {
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill, seed: s });
            const log = [];
            let bad = null, steps = 0;
            while (!G.ended && G.missions < 60 && !bad) {
                Gm.step(G, DT);
                const c = Bt.botCmd(G, bot, DT);
                if (c) Gm.act(G, c);
                for (const e of G.events) if (e.type === 'result') log.push(`${e.level + 1}${e.grade}`);
                G.events.length = 0;
                const m = G.m;
                if (m) {
                    const vals = [...Object.values(m.charge), m.shield, m.hull, m.clock];
                    if (!vals.every(Number.isFinite)) bad = 'non-finite numbers';
                    else if (Object.values(m.charge).some((v) => v < -1e-9) || m.hull < 0 || m.shield > Gm.shieldCap(G) + 1e-9) bad = 'a stat out of range';
                    else if (m.board.cells.some((t) => !t) && m.board.phase === 'idle') bad = 'a hole in a settled board';
                    else if (m.board.phase === 'idle' && B.findRuns(m.board.cells).length) bad = 'an uncleared run on a settled board';
                }
                if (++steps > 120 * 60 * 120) bad = 'took over two hours';
            }
            ok(!bad, `skill ${skill} seed ${s}: ${bad || 'invariants hold'}`);
            rows.push({ skill, seed: s, missions: G.missions, ended: G.ended, scrap: G.scrap, ups: Object.values(G.up).reduce((a, v) => a + v, 0), log: log.join(' ') });
        }
    }
    for (const r of rows) console.log(`  skill ${r.skill} seed ${r.seed}: ${r.ended ? 'won' : 'NOT WON'} in ${r.missions} sorties, ${r.ups} upgrades · ${r.log}`);
    const p = rows.filter((r) => r.skill === 1), q = rows.filter((r) => r.skill === 0.6);
    ok(p.every((r) => r.ended && r.missions <= 9), 'the perfect bot beats all six motherships in at most 9 sorties');
    ok(q.every((r) => r.ended && r.missions <= 30), 'the skill-0.6 bot wins within 30 sorties');
    ok(q.every((r) => r.missions >= 7), 'and needs at least one retry to do it');
    ok(q.reduce((a, r) => a + r.missions, 0) > p.reduce((a, r) => a + r.missions, 0), 'a worse pilot needs more sorties');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
