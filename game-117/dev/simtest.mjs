/**
 * simtest.mjs — headless checks of PERIHELION's simulation. No browser.
 *
 *   node game-117/dev/simtest.mjs            # everything
 *   ONLY=purity,world,rules node game-117/dev/simtest.mjs
 *   SEEDS=10 VERBOSE=1 node game-117/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. world: on 40 seeds of every asteroid, the cube-sphere grid is sound (four distinct,
 *    symmetric neighbours per cell), every cell is reachable, the beacons and the gate sit in
 *    distinct cells away from the start, and no cell centre is inside a wall.
 * 3. rules: walking keeps you on the sphere and the frame tangent, screen-up walks along f,
 *    walls stop you, the frame is carried round the rock, bullets fly great circles and stop at
 *    walls, beacons die and open the gate, the gate warps you to the next asteroid, a hit costs
 *    health and a dash dodges it, death and respawn, game over, pickups, the boss's shield.
 * 4. determinism: the same seed and inputs give the same game; a save round trip mid-game
 *    plays on identically; an unknown save version is rejected.
 * 5. bot: the bot plays whole campaigns on SEEDS seeds at two skills with per-step invariants,
 *    and the balance table is printed.
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
const Wd = await import('../js/sim/world.js');
const V = await import('../js/sim/vec.js');
const { LEVELS } = await import('../js/sim/data.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, ax: 0, ay: 0, fire: false, dash: false };
const run = (G, inp, secs) => { for (let t = 0; t < secs && !G.over; t += DT) { Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
/** A fresh game already past the intro, with the hangars emptied so nothing interferes. */
function quiet(seed = 1, level = 0) {
    const G = Gm.newGame(seed, { level });
    G.enemies = [];
    G.phase = 'play'; G.phaseT = 0;
    G.spawnT = 1e9;
    for (const t of G.turrets) { t.cd = 1e9; t.alarmed = true; }
    if (G.boss) G.boss.cd = 1e9;
    G.events.length = 0;
    return G;
}

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

if (want('world')) {
    section('world');
    let worlds = 0;
    for (const [li, def] of LEVELS.entries()) {
        let grid = true, reach = true, place = true, clear = true, lookup = true;
        for (let s = 1; s <= 40; s++) {
            const W = Wd.buildWorld(def, s * 101 + li);
            worlds++;
            for (const c of W.cells) {
                if (new Set(c.nb).size !== 4 || c.nb.includes(c.id)) grid = false;
                for (let k = 0; k < 4; k++) {
                    const n = W.cells[c.nb[k]];
                    if (n.nb[c.back[k]] !== c.id || n.open[c.back[k]] !== c.open[k]) grid = false;
                }
                if (Wd.cellOf(W, c.c) !== c.id) lookup = false;
                if (Wd.inWall(W, c.c, C.PLAYER.r)) clear = false;
            }
            const d = Wd.bfs(W, W.start);
            if ([...d].some((x) => x < 0)) reach = false;
            const spots = [W.start, W.exit, ...W.turretCells];
            if (new Set(spots).size !== spots.length || W.turretCells.length !== def.turrets) place = false;
            if (W.turretCells.some((c) => d[c] < 3) || d[W.exit] < 4) place = false;
        }
        ok(grid, `${def.name}: every cell has four distinct, symmetric neighbours`);
        ok(lookup, `${def.name}: cellOf() finds every cell from its own centre`);
        ok(reach, `${def.name}: every cell is reachable from the start on 40 seeds`);
        ok(place, `${def.name}: ${def.turrets} beacons and the gate in distinct cells, at least 3 and 4 cells of maze from the start`);
        ok(clear, `${def.name}: no cell centre is inside a wall (a player fits in every cell)`);
    }
    console.log(`  ${worlds} asteroids built`);
}

if (want('rules')) {
    section('rules');
    // walking
    let G = quiet(3);
    const P = G.player;
    const f0 = P.f.slice(), p0 = P.p.slice();
    run(G, { ...NONE, y: -1 }, 0.25);
    ok(near(V.len(P.p), 1, 1e-9) && near(V.dot(P.p, P.f), 0, 1e-9) && near(V.len(P.f), 1, 1e-9), 'walking keeps p on the sphere and f a unit tangent');
    ok(V.dot(V.sub(P.p, p0), f0) > 0, 'stick up walks along the frame (screen up)');
    // a full lap: the frame comes back to itself, so screen-up never drifts while walking straight
    G = quiet(3);
    G.world.walls = []; for (const c of G.world.cells) c.near = [];
    G.turrets = []; G.exit.p = [0, -1, 0];
    const lapP = G.player.p.slice(), lapF = G.player.f.slice();
    run(G, { ...NONE, y: -1 }, 0.5);
    ok(near(V.arc(lapP, G.player.p) * G.world.R, C.PLAYER.speed * 0.5, 0.05), 'walks at PLAYER.speed');
    run(G, { ...NONE, y: -1 }, -0.5 + 1e-9);
    const lap = (2 * Math.PI * G.world.R) / C.PLAYER.speed;
    run(G, { ...NONE, y: -1 }, lap - 0.5);
    ok(V.chord(G.player.p, lapP) < 0.03 && V.dot(G.player.f, lapF) > 0.995, 'a straight lap round the rock comes home with the same heading');
    // walls stop you
    G = quiet(4);
    let stopped = true;
    run(G, (g) => {
        for (const w of g.world.walls) if (Wd.wallDist(w, g.player.p) * g.world.R < C.PLAYER.r + C.WALL.half - 0.02) stopped = false;
        return { ...NONE, x: Math.sin(g.t * 0.7), y: Math.cos(g.t * 0.5) };
    }, 20);
    ok(stopped, 'twenty seconds of wandering never overlaps a wall');
    // bullets fly great circles and stop at walls
    G = quiet(5);
    run(G, { ...NONE, ax: 1, ay: 0, fire: true }, 0.02);
    const b = G.bullets[0];
    ok(!!b && b.own === 1, 'fire makes a bullet');
    if (b) {
        const axis = V.norm(V.cross(b.p, b.d));
        run(G, NONE, 0.2);
        const b2 = G.bullets.find((x) => x === b);
        ok(!b2 || near(V.dot(b2.p, axis), 0, 1e-6), 'a bullet stays on its great circle');
    }
    G = quiet(5);
    run(G, (g) => ({ ...NONE, ax: Math.cos(g.t * 3), ay: Math.sin(g.t * 3), fire: true }), 3);
    ok(G.events.some((e) => e.type === 'spark'), 'bullets stop at walls with a spark');
    // a beacon dies and the gate opens
    G = quiet(6);
    for (const t of G.turrets.slice(1)) t.alive = false;
    const t0 = G.turrets[0];
    G.player.p = V.walk(t0.p, V.anyTangent(t0.p), 3 / G.world.R).p;
    G.player.f = V.norm(V.tangent(G.player.p, G.player.f));
    const aim = V.toward(G.player.p, t0.p), R0 = Gm.right(G.player);
    run(G, () => ({ ...NONE, ax: V.dot(aim, R0), ay: -V.dot(aim, G.player.f), fire: true }), 8);
    ok(!t0.alive && G.events.some((e) => e.type === 'turretDown'), 'shooting a beacon brings it down');
    ok(G.exit.open && G.events.some((e) => e.type === 'exitOpen'), 'the last beacon opens the gate');
    // the gate
    G.player.p = G.exit.p.slice();
    run(G, NONE, 0.05);
    ok(G.phase === 'warp' && G.events.some((e) => e.type === 'warp'), 'walking into the open gate warps');
    run(G, NONE, C.PHASE.warp + 0.1);
    ok(G.level === 1 && G.phase === 'intro' && G.events.some((e) => e.type === 'level' && e.n === 1), 'the warp lands on the next asteroid');
    ok(G.world.R === LEVELS[1].R, 'the next asteroid is the next row of the table');
    // hurt, dash, death, respawn
    G = quiet(7);
    const hp0 = G.player.hp;
    G.bullets.push({ p: V.walk(G.player.p, G.player.f, 0.5 / G.world.R).p, d: V.scale(G.player.f, -1), spd: 10, life: 2, own: 0, dmg: 14, r: 0.22 });
    G.bullets[0].d = V.norm(V.tangent(G.bullets[0].p, G.bullets[0].d));
    run(G, NONE, 0.2);
    ok(G.player.hp === hp0 - 14 && G.events.some((e) => e.type === 'hurt'), 'a bolt costs health');
    G = quiet(7);
    G.bullets.push({ p: V.walk(G.player.p, G.player.f, 0.6 / G.world.R).p, d: V.scale(G.player.f, -1), spd: 10, life: 2, own: 0, dmg: 14, r: 0.22 });
    G.bullets[0].d = V.norm(V.tangent(G.bullets[0].p, G.bullets[0].d));
    Gm.step(G, { ...NONE, x: 1, dash: true }, DT);
    run(G, NONE, 0.2);
    ok(G.player.hp === hp0 && G.events.some((e) => e.type === 'dash'), 'a dash slips through it');
    G = quiet(8);
    G.player.hp = 5;
    G.bullets.push({ p: V.walk(G.player.p, G.player.f, 0.4 / G.world.R).p, d: V.scale(G.player.f, -1), spd: 10, life: 2, own: 0, dmg: 14, r: 0.22 });
    run(G, NONE, 0.2);
    ok(G.phase === 'dead' && G.lives === C.LIVES - 1, 'running out of health costs a life');
    run(G, NONE, C.PHASE.dead + 0.1);
    ok(G.phase === 'play' && G.player.hp === C.PLAYER.hp && G.player.inv > 0, 'and you respawn at the start, whole and briefly safe');
    G.lives = 1; G.player.inv = 0; G.player.hp = 1;
    G.bullets.push({ p: V.walk(G.player.p, G.player.f, 0.4 / G.world.R).p, d: V.scale(G.player.f, -1), spd: 10, life: 2, own: 0, dmg: 14, r: 0.22 });
    run(G, NONE, 0.3);
    ok(G.over && G.phase === 'over' && G.events.some((e) => e.type === 'over'), 'the last life ends the game');
    G = Gm.newGame(8, { cadet: true });
    ok(G.lives === C.LIVES + 2, 'cadet difficulty gives two more lives');
    // pickups
    G = quiet(9);
    G.player.hp = 50;
    G.pickups.push({ id: 99, kind: 'repair', p: G.player.p.slice(), life: 5 });
    G.pickups.push({ id: 98, kind: 'power', p: G.player.p.slice(), life: 5 });
    run(G, NONE, 0.05);
    ok(G.player.hp === 50 + C.PICKUP.repair && G.player.power === 2, 'repair heals, power raises the gun');
    run(G, { ...NONE, ax: 1, fire: true }, 0.02);
    ok(G.bullets.filter((x) => x.own).length === 2, 'power 2 fires a pair');
    // enemies hunt through the maze
    G = quiet(10, 1);
    const far = G.world.cells.find((c) => Gm.objectives && Wd.bfs(G.world, Wd.cellOf(G.world, G.player.p))[c.id] === 4);
    G.enemies.push({ id: 500, kind: 'drone', p: far.c.slice(), vel: [0, 0, 0], hp: 3, cd: 9, hitCd: 0, sees: false, seeT: 0, ph: 0 });
    const d0 = Wd.bfs(G.world, Wd.cellOf(G.world, G.player.p))[Wd.cellOf(G.world, G.enemies[0].p)];
    run(G, NONE, 6);
    const e = G.enemies[0];
    const d1 = e ? Wd.bfs(G.world, Wd.cellOf(G.world, G.player.p))[Wd.cellOf(G.world, e.p)] : 0;
    ok(d1 < d0, `a drone four cells away finds its way toward you (${d0} → ${d1} cells)`);
    // the boss's shield
    G = quiet(11, LEVELS.length - 1);
    ok(!!G.boss && G.turrets.every((t) => t.kind === 'pylon'), 'the last asteroid has the boss and its pylons');
    const B = G.boss;
    G.player.p = V.walk(B.p, V.anyTangent(B.p), 4 / G.world.R).p;
    G.player.f = V.norm(V.tangent(G.player.p, G.player.f));
    const aimB = () => { const a = V.toward(G.player.p, B.p), r = Gm.right(G.player); return { ...NONE, ax: V.dot(a, r), ay: -V.dot(a, G.player.f), fire: true }; };
    run(G, aimB, 1);
    ok(B.hp === B.maxHp && G.events.some((e) => e.type === 'deflect'), 'the shield turns bullets while a pylon stands');
    for (const t of G.turrets) { t.hp = 1; }
    for (const t of G.turrets) { G.bullets.push({ p: V.walk(t.p, V.anyTangent(t.p), 1 / G.world.R).p, d: V.scale(V.anyTangent(t.p), -1), spd: 30, life: 1, own: 1, dmg: 1, r: 0.15 }); G.bullets[G.bullets.length - 1].d = V.toward(G.bullets[G.bullets.length - 1].p, t.p); }
    run(G, NONE, 0.2);
    ok(!B.shield && G.events.some((e) => e.type === 'shieldDown'), 'the last pylon drops the shield');
    ok(!G.exit.open, 'the gate stays shut while the boss lives');
    B.hp = 2; G.player.inv = 99;
    run(G, aimB, 2);
    ok(!B.alive && G.exit.open && G.events.some((e) => e.type === 'bossDown'), 'the boss falls and the gate opens where it stood');
    G.player.p = G.exit.p.slice();
    run(G, NONE, C.PHASE.warp + 0.3);
    ok(G.won && G.over && G.events.some((e) => e.type === 'win'), 'the last gate wins the game');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed) => { const G = Gm.newGame(seed); const b = Bt.makeBot(); run(G, (g) => Bt.botInput(g, b), 40); return G; };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');

    const G = Gm.newGame(7);
    const bot = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, bot), 30);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    ok(copy.world.walls.length === G.world.walls.length, 'a loaded save rebuilds the same asteroid');
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, b1), 30);
    run(copy, (g) => Bt.botInput(g, b2), 30);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
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
            let bad = null, deaths = 0;
            while (!G.over && G.t < 1500) {
                Gm.step(G, Bt.botInput(G, bot), DT);
                for (const e of G.events) if (e.type === 'die') deaths++;
                G.events.length = 0;
                const p = G.player;
                if (!p.p.every(Number.isFinite) || !p.f.every(Number.isFinite)) bad = 'non-finite player';
                else if (Math.abs(V.len(p.p) - 1) > 1e-6 || Math.abs(V.dot(p.p, p.f)) > 1e-6) bad = 'player off the sphere';
                else if (G.enemies.some((e) => !e.p.every(Number.isFinite) || Math.abs(V.len(e.p) - 1) > 1e-6)) bad = 'enemy off the sphere';
                else if (G.bullets.length > 400) bad = 'bullets pile up';
                if (bad) break;
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            rows.push({ seed: s, skill, won: G.won, level: G.level + 1, deaths, score: G.score, t: Math.round(G.t) });
        }
    }
    const of = (k) => rows.filter((r) => r.skill === k);
    const avg = (k, f) => Math.round(of(k).reduce((a, r) => a + r[f], 0) / SEEDS * 10) / 10;
    const wins = (k) => of(k).filter((r) => r.won).length;
    console.log('  skill  won   avg level  avg deaths  avg score  avg time');
    for (const k of [1, 0.6]) console.log(`  ${String(k).padEnd(5)}  ${wins(k)}/${SEEDS}   ${String(avg(k, 'level')).padEnd(9)}  ${String(avg(k, 'deaths')).padEnd(10)}  ${String(avg(k, 'score')).padEnd(9)}  ${avg(k, 't')}s`);
    ok(wins(1) >= Math.ceil(SEEDS * 0.66), `the perfect bot wins most campaigns (${wins(1)}/${SEEDS})`);
    ok(avg(0.6, 'level') >= 4, `the mortal bot gets past asteroid IV on average (${avg(0.6, 'level')})`);
    ok(avg(1, 'score') > avg(0.6, 'score'), 'a better bot scores more');
    ok(wins(0.6) < SEEDS || avg(0.6, 'deaths') > 0, 'the mortal bot is mortal');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
