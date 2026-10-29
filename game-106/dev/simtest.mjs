/**
 * simtest.mjs — headless checks of INTRUDER ALERT '84's simulation. No browser.
 *
 *   node game-106/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-106/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-106/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. rules: moving, the auto-laser, chips and levels, upgrades, contact damage and i-frames, the
 *    dash, electrified walls, gunner bolts, sectors and the purge, the Grinner, both endings.
 * 3. maze: over many seeds every room keeps the player clear and every door reachable.
 * 4. determinism: the same seed and inputs give the same game; a save round trip mid-game (and
 *    mid-level-up) plays on identically.
 * 5. bot: the bot plays whole runs on SEEDS seeds at two skills with per-step invariants (finite
 *    numbers, nothing outside the room) and the balance table is printed.
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
const Mz = await import('../js/sim/maze.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const run = (G, inp, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const NONE = { x: 0, y: 0, a: false };
const had = (G, type) => G.events.some((e) => e.type === type);
/** A quiet room: no inner walls, no spawning, so one rule can be looked at alone. */
const quiet = (seed = 1) => { const G = Gm.newGame(seed); G.walls = G.walls.filter((w) => w.outer); G.spawnT = 1e9; return G; };
const robot = (G, kind, x, y) => { G.robots.push({ id: G.nid++, kind, x, y, kx: 0, ky: 0, hp: C.ROBOTS[kind].hp, maxHp: C.ROBOTS[kind].hp, zap: 0, oT: 0, fT: 0, hitT: 0 }); return G.robots[G.robots.length - 1]; };

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

if (want('rules')) {
    section('rules');
    // ---- moving
    let G = quiet(1);
    ok(G.player.hp === C.PLAYER.hp && G.sector === 1 && G.level === 1, 'a new run starts full, in sector 1, at level 1');
    const x0 = G.player.x;
    run(G, { x: 1, y: 0, a: false }, 0.5);
    ok(Math.abs(G.player.x - (x0 + C.PLAYER.speed * 0.5)) < 0.1, 'moves right at PLAYER.speed');
    run(G, { x: 1, y: 1, a: false }, 0.2);
    ok(Math.hypot(G.player.vx, G.player.vy) <= C.PLAYER.speed + 1e-6, 'diagonals are no faster');
    run(G, { x: 1, y: 0, a: false }, 10);
    ok(G.player.x <= C.FIELD.w - C.PLAYER.radius + 1e-9, 'stays inside the room');

    // ---- spawning
    G = Gm.newGame(2);
    run(G, NONE, 2);
    ok(G.robots.length > 0, 'robots come in');
    ok(G.robots.every((r) => Mz.doors().some((d) => Math.hypot(d.x - r.x, d.y - r.y) < 4)), 'through the doors');
    ok(G.robots.every((r) => C.ROBOTS[r.kind].from <= 1), 'only sector-1 robots in sector 1');

    // ---- the auto-laser, kills and chips
    G = quiet(3);
    const p = G.player;
    const d = robot(G, 'drone', p.x + 4, p.y);
    run(G, NONE, 0.6);
    ok(G.lasers.length > 0 || G.kills === 1, 'the laser fires on its own at a robot');
    run(G, NONE, 0.4);
    ok(G.kills === 1 && !G.robots.includes(d) && had(G, 'kill'), 'one laser kills a drone');
    ok(G.chips.length === 1 && G.score === C.ROBOTS.drone.score, 'the drone drops a chip and scores');
    G.events.length = 0;
    const ch = G.chips[0];
    G.player.x = ch.x - C.PLAYER.magnet * 0.8;
    run(G, NONE, 1.5);
    ok(G.chips.length === 0 && G.xp === 1 && had(G, 'chip'), 'the magnet pulls a nearby chip in');

    G = quiet(3);
    run(G, NONE, 1);
    ok(G.lasers.length === 0 && !had(G, 'shoot'), 'no shots with nothing to shoot');

    G = quiet(3);
    for (let i = 0; i < C.CHIP.crowd; i++) G.chips.push({ x: 4, y: 4, v: 1 });
    G.player.x = 9; G.player.y = 4;              // out of magnet range of the pile
    G.player.fireT = 0;
    robot(G, 'drone', 5, 4).hp = 0.01;
    run(G, NONE, 0.3);
    ok(G.kills === 1 && G.chips.length === C.CHIP.crowd && G.chips.some((c) => c.v === 2), 'a crowded floor merges a new chip into a near one');

    // ---- levels and upgrades
    G = quiet(4);
    G.chips.push({ x: G.player.x, y: G.player.y, v: Gm.xpNeed(1) });
    Gm.step(G, NONE, DT);
    ok(G.level === 2 && G.choice?.options.length === 3 && had(G, 'levelup'), 'enough chips level you up with three choices');
    ok(new Set(G.choice.options).size === 3, 'the three choices differ');
    const t1 = G.t;
    run(G, { x: 1, y: 0, a: false }, 0.5);
    ok(G.t === t1, 'the game waits while a level-up is on screen');
    const pick = G.choice.options[0];
    ok(Gm.choose(G, 0) && G.up[pick] === 1 && !G.choice && had(G, 'choose'), 'choose() applies the upgrade and play goes on');
    G = quiet(4);
    G.chips.push({ x: G.player.x, y: G.player.y, v: Gm.xpNeed(1) + Gm.xpNeed(2) });
    Gm.step(G, NONE, DT);
    ok(G.level === 3 && G.pending === 2, 'two levels at once are both kept');
    Gm.choose(G, 0);
    ok(G.choice && G.pending === 1, 'and offered one after the other');
    G = quiet(5);
    G.up.rate = 2; G.up.split = 2; G.up.power = 1;
    const S = Gm.stats(G);
    ok(S.laserCount === 3 && S.laserCool < C.LASER.cool && S.dmg > C.LASER.dmg, 'upgrades change the laser');
    for (const k of Object.keys(C.UPGRADES)) G.up[k] = k === 'repair' ? 0 : C.UPGRADES[k].max;
    G.chips.push({ x: G.player.x, y: G.player.y, v: 1000 });
    Gm.step(G, NONE, DT);
    ok(G.choice.options.every((o) => o === 'repair'), 'with everything maxed only repairs are offered');
    G.player.hp = 10;
    Gm.choose(G, 0);
    ok(G.player.hp === 50, 'a repair heals 40');
    G = quiet(5);
    G.up.armor = 0; G.chips.push({ x: G.player.x, y: G.player.y, v: Gm.xpNeed(1) });
    Gm.step(G, NONE, DT);
    G.choice.options[0] = 'armor';
    Gm.choose(G, 0);
    ok(G.player.maxHp === C.PLAYER.hp + 25, 'armor raises max HP');

    // ---- contact damage, i-frames, the dash
    G = quiet(6);
    robot(G, 'hunter', G.player.x + 0.3, G.player.y);
    G.player.fireT = 99;
    Gm.step(G, NONE, DT);
    ok(G.player.hp === C.PLAYER.hp - C.ROBOTS.hunter.dmg && had(G, 'hurt'), 'a robot touching you hurts');
    const hp1 = G.player.hp;
    run(G, NONE, C.PLAYER.iframes * 0.8);
    ok(G.player.hp === hp1, 'i-frames after a hit');
    G = quiet(6);
    G.player.fireT = 99;
    Gm.step(G, { x: 1, y: 0, a: true }, DT);
    ok(G.player.dash > 0 && had(G, 'dash'), 'the action button dashes');
    robot(G, 'hunter', G.player.x + 0.3, G.player.y);
    Gm.step(G, NONE, DT);
    ok(G.player.hp === C.PLAYER.hp, 'a dash passes through robots unhurt');
    run(G, { x: 0, y: 0, a: true }, 0.4);
    ok(G.player.dashCool > 0, 'the dash has a cooldown');

    // ---- electrified walls
    G = quiet(7);
    G.walls.push({ x: G.player.x + 1, y: G.player.y - 2, w: 0.45, h: 4 });
    run(G, { x: 1, y: 0, a: false }, 0.5);
    ok(G.player.hp === C.PLAYER.hp - C.WALL.touch && G.events.some((e) => e.type === 'hurt' && e.cause === 'zap'), 'a wall zaps you');
    ok(G.walls.every((w) => !Mz.circleRect(G.player.x, G.player.y, C.PLAYER.radius - 0.01, w)), 'and you never end up inside it');
    G = quiet(7);
    G.walls.push({ x: G.player.x + 3, y: G.player.y - 2, w: 0.45, h: 4 });
    robot(G, 'drone', G.player.x + 4.2, G.player.y);
    G.player.fireT = 99;
    run(G, NONE, 1);
    ok(G.kills === 1 && G.events.some((e) => e.type === 'kill' && e.by === 'wall'), 'a drone that walks into a wall fries');

    // ---- gunner bolts
    G = quiet(8);
    robot(G, 'gunner', G.player.x + 6, G.player.y).fT = 0;
    G.player.fireT = 99;
    Gm.step(G, NONE, DT);
    ok(G.bolts.length === 1 && had(G, 'bolt'), 'a gunner fires a bolt');
    G.player.fireT = 99;
    run(G, (g) => { g.player.fireT = 99; return NONE; }, 1.2);
    ok(G.events.some((e) => e.type === 'hurt' && e.cause === 'bolt'), 'the bolt hurts');
    G = quiet(8);
    G.walls.push({ x: G.player.x + 2, y: G.player.y - 2, w: 0.45, h: 4 });
    robot(G, 'gunner', G.player.x + 6, G.player.y).fT = 0;
    G.player.fireT = 99;
    Gm.step(G, NONE, DT);
    ok(G.bolts.length === 0, 'a gunner holds fire with a wall in the way');

    // ---- sectors and the purge
    G = Gm.newGame(9);
    const b = Bt.makeBot();
    run(G, (g) => { if (g.choice) Gm.choose(g, Bt.botChoose(g)); return Bt.botInput(g, b); }, C.SECTOR.seconds - 0.5);
    const walls1 = JSON.stringify(G.walls), alive = G.robots.length, kills = G.kills;
    G.events.length = 0;
    run(G, (g) => { if (g.choice) Gm.choose(g, Bt.botChoose(g)); return Bt.botInput(g, b); }, 1);
    ok(G.sector === 2 && had(G, 'sector'), 'after a minute the next sector begins');
    ok(G.kills >= kills + alive - 2 && G.events.some((e) => e.type === 'kill' && e.by === 'purge'), 'the purge destroys the robots in the room');
    ok(JSON.stringify(G.walls) !== walls1, 'the maze is rebuilt');
    ok(G.walls.every((w) => !Mz.circleRect(G.player.x, G.player.y, C.PLAYER.radius, w)), 'with no wall on the player');

    // ---- the Grinner
    G = quiet(10);
    G.sector = 2; G.st = C.SECTOR.grinnerAt - 0.1;
    G.player.fireT = 99;
    run(G, (g) => { g.player.fireT = 99; return NONE; }, 0.2);
    ok(G.grinner && had(G, 'grinner'), 'the Grinner comes late in a sector');
    const g = G.grinner;
    g.x = G.player.x + 5; g.y = G.player.y;
    G.player.fireT = 0;
    const gx = g.x;
    run(G, NONE, 0.5);
    ok(had(G, 'ping') && G.grinner, 'lasers hit the Grinner but cannot kill it');
    ok(G.grinner.x > gx - C.GRINNER.speed * 0.5 * 0.9, 'and knock it back');
    G = quiet(10);
    G.sector = 1; G.st = C.SECTOR.grinnerAt + 1;
    run(G, NONE, 0.2);
    ok(!G.grinner, 'never in the first sector');

    // ---- endings
    G = quiet(11);
    G.player.hp = 5;
    robot(G, 'brute', G.player.x + 0.5, G.player.y);
    G.player.fireT = 99;
    Gm.step(G, NONE, DT);
    ok(G.over && !G.win && had(G, 'over'), 'running out of HP ends the run');
    G = quiet(12);
    G.t = C.ROUND.seconds - 0.01; G.st = 1;
    run(G, NONE, 0.05);
    ok(G.over && G.win && G.score >= 5000, 'surviving every sector wins, with a bonus');
}

if (want('maze')) {
    section('maze');
    // flood-fill on a fine grid: from the middle, can a player-sized body reach every door?
    const reach = (walls, sx, sy) => {
        const g = 0.25, W = Math.ceil(C.FIELD.w / g), H = Math.ceil(C.FIELD.h / g);
        const free = (i, j) => { const x = (i + 0.5) * g, y = (j + 0.5) * g; return x > C.PLAYER.radius && y > C.PLAYER.radius && x < C.FIELD.w - C.PLAYER.radius && y < C.FIELD.h - C.PLAYER.radius && !walls.some((w) => Mz.circleRect(x, y, C.PLAYER.radius, w)); };
        const seen = new Uint8Array(W * H), q = [[Math.floor(sx / g), Math.floor(sy / g)]];
        seen[q[0][1] * W + q[0][0]] = 1;
        while (q.length) {
            const [i, j] = q.pop();
            for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const ni = i + a, nj = j + c;
                if (ni < 0 || nj < 0 || ni >= W || nj >= H || seen[nj * W + ni] || !free(ni, nj)) continue;
                seen[nj * W + ni] = 1; q.push([ni, nj]);
            }
        }
        return (x, y) => seen[Math.floor(y / g) * W + Math.floor(x / g)] === 1;
    };
    let bad = 0, inner = 0;
    const N = 200;
    for (let s = 1; s <= N; s++) {
        const G = Gm.newGame(s);
        inner += G.walls.filter((w) => !w.outer).length;
        if (G.walls.some((w) => Mz.circleRect(G.player.x, G.player.y, 2, w))) { bad++; continue; }
        const can = reach(G.walls, G.player.x, G.player.y);
        const ds = Mz.doors().map((d) => ({ x: d.side === 2 ? 1.2 : d.side === 3 ? C.FIELD.w - 1.2 : d.x, y: d.side === 0 ? 1.2 : d.side === 1 ? C.FIELD.h - 1.2 : d.y }));
        if (!ds.every((d) => can(d.x, d.y))) bad++;
    }
    ok(bad === 0, `${N} rooms: spawn clear and every door reachable (${bad} bad)`);
    ok(inner / N >= 7.5, `rooms are mazes, not empty (${(inner / N).toFixed(1)} inner walls on average)`);
}

if (want('determinism')) {
    section('determinism');
    const auto = (b) => (g) => { if (g.choice) Gm.choose(g, Bt.botChoose(g)); return Bt.botInput(g, b); };
    const play = (seed) => { const G = Gm.newGame(seed); run(G, auto(Bt.makeBot()), 40); return G; };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');

    const G = Gm.newGame(7);
    run(G, auto(Bt.makeBot()), 30);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    run(G, auto(Bt.makeBot()), 40);
    run(copy, auto(Bt.makeBot()), 40);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');

    const H = Gm.newGame(8);
    const hb = Bt.makeBot();
    while (!H.choice) Gm.step(H, Bt.botInput(H, hb), DT);
    const hc = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(H))));
    ok(hc.choice && JSON.stringify(hc.choice) === JSON.stringify(H.choice), 'a save in the middle of a level-up keeps the choice');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.6]) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill });
            let bad = null;
            while (!G.over) {
                if (G.choice) Gm.choose(G, Bt.botChoose(G));
                Gm.step(G, Bt.botInput(G, bot), DT);
                G.events.length = 0;
                const p = G.player;
                if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.hp)) bad = 'non-finite player';
                else if (p.x < 0 || p.y < 0 || p.x > C.FIELD.w || p.y > C.FIELD.h) bad = 'player outside the room';
                else if (G.robots.some((r) => !Number.isFinite(r.x) || r.x < 0 || r.y < 0 || r.x > C.FIELD.w || r.y > C.FIELD.h)) bad = 'robot outside the room';
                else if (G.robots.length > C.SPAWN.cap) bad = 'too many robots';
                if (bad) break;
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            rows.push({ seed: s, skill, t: G.t, win: G.win, score: G.score, level: G.level, sector: G.sector });
        }
    }
    const of = (k) => rows.filter((r) => r.skill === k);
    const avg = (k, f) => of(k).reduce((a, r) => a + r[f], 0) / SEEDS;
    ok(avg(1, 't') > avg(0.6, 't') + 20, 'a better bot survives longer');
    ok(avg(1, 'score') > avg(0.6, 'score'), 'and scores more');
    ok(avg(1, 't') >= 150, `the perfect bot averages at least 2:30 (got ${avg(1, 't').toFixed(0)} s)`);
    ok(of(0.6).every((r) => r.t >= 60), 'nobody dies in the first sector');
    ok(of(1).some((r) => r.win) || SEEDS < 8, 'the perfect bot can win');
    console.log('  skill  avg time  wins  avg level  avg score');
    for (const k of [1, 0.6]) console.log(`  ${String(k).padEnd(5)}  ${avg(k, 't').toFixed(0).padStart(6)} s  ${String(of(k).filter((r) => r.win).length).padStart(4)}  ${avg(k, 'level').toFixed(1).padStart(9)}  ${avg(k, 'score').toFixed(0).padStart(9)}`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
