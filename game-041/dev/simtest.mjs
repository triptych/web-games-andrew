/**
 * simtest.mjs — assertions against the REAL simulation (js/game.js, js/world.js).
 * No browser needed: the sim touches no DOM and audio no-ops under Node.
 *
 *   node dev/simtest.mjs
 */
import { Game } from '../js/game.js';
import { World, DIRT, TUNNEL, OCC_ROCK, DOT_GEM, DOT_NONE } from '../js/world.js';
import { COLS, ROWS, CORE, SPAWNS, TOWERS, WAVES_PER_ROUND } from '../js/config.js';
import { buildAtlas } from '../js/atlas.js';
import { SPRITES } from '../js/sprites.js';

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { pass++; } else { fail++; console.log('  FAIL', msg); }
}
function section(name) { console.log(name); }

const STEP = 1 / 60;
const idle = { dir: -1, pump: false, pumpPressed: false };
function run(g, secs, inp = idle, until = null) {
    for (let i = 0; i < secs * 60; i++) {
        g.update(STEP, typeof inp === 'function' ? inp(g, i) : inp);
        if (until && until(g)) return true;
    }
    return false;
}
function fresh(seed = 7) {
    const g = new Game(seed);
    g.newGame();
    g.phase = 'play';
    g.countdown = 1e9;          // no waves unless a test asks
    return g;
}

// ------------------------------------------------------------------ atlas & art
section('atlas');
{
    const a = buildAtlas();
    ok(Object.keys(a.frames).length > 100, 'atlas has every sprite + glyph');
    for (const [k, rows] of Object.entries(SPRITES)) ok(rows.every(r => r.length === rows[0].length), `sprite ${k} rows equal width`);
    for (const t of Object.values(TOWERS)) ok(a.frames[t.head], `tower head ${t.head} exists`);
    for (const n of ['grub0', 'skitter1', 'drake0', 'stalker1', 'borer0', 'king0', 'scared0', 'scaredW1', 'eyes', 'fire1', 'core1', 'g_A', 'g_0'])
        ok(a.frames[n], `frame ${n}`);
}

// ------------------------------------------------------------------ maze generation
section('maze generation (200 seeds)');
{
    let bad = 0;
    for (let s = 1; s <= 200; s++) {
        const w = new World();
        w.generate(s * 7919);
        const f = w.fields.core;
        for (const sp of SPAWNS) if (!(f[w.idx(sp.c, sp.r)] < Infinity)) bad++;
        let gems = 0;
        for (let i = 0; i < f.length; i++) if (w.dot[i] === DOT_GEM) gems++;
        if (gems !== 4) bad++;
        for (const k of w.rocks) if (w.tile[w.idx(k.c, k.r + 1)] !== DIRT || w.occ[w.idx(k.c, k.r)] !== OCC_ROCK) bad++;
        if (w.rocks.length < 5) bad++;
        // Leave room to build: plenty of dirt next to tunnels.
        let slots = 0;
        for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            if (!w.buildable(c, r)) continue;
            if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.isTunnel(c + dx, r + dy) && r + dy > 0)) slots++;
        }
        if (slots < 25) bad++;
    }
    ok(bad === 0, `every seed: both spawns reach the core, 4 gems, 5+ seated rocks, 25+ tower slots (${bad} problems)`);
}

// ------------------------------------------------------------------ digging
section('digging');
{
    const g = fresh();
    const w = g.world;
    // Find a surface column with dirt directly beneath.
    const c = [...Array(COLS).keys()].find(c => w.tile[w.idx(c, 1)] === DIRT && w.occ[w.idx(c, 1)] === 0 && Math.abs(c - 6) <= 3);
    g.player.fx = g.player.tx = c;
    const gold0 = g.gold, ver0 = w.version;
    run(g, 0.9, { dir: 1, pump: false, pumpPressed: false });
    ok(w.tile[w.idx(c, 1)] === TUNNEL, 'moving down from the surface carves a tunnel');
    ok(g.gold > gold0, 'carving collects the ore in the dirt');
    ok(w.version > ver0, 'terrain change bumps the world version');
    const t = g.player.t;
    run(g, 0.3, idle);
    ok(g.player.t === t, 'releasing the stick stops the miner where he stands');
}

// ------------------------------------------------------------------ enemies follow tunnels
section('enemies walk your tunnels');
{
    const g = fresh(11);
    g.player.inv = 1e9;
    g.hpMul = 1;
    const e = g.spawnEnemy('grub', 0);
    let inDirt = 0;
    const reached = run(g, 60, idle, gg => {
        if (e.x >= 0) {
            const cc = Math.round(e.x), cr = Math.round(e.y);
            if (gg.world.tile[gg.world.idx(cc, cr)] === DIRT) inDirt++;
        }
        return gg.coreHp < 10;
    });
    ok(reached, 'a grub reaches the core along the pre-dug maze');
    ok(inDirt === 0, 'a grub never enters dirt');
    ok(g.stats.leaks === 1, 'leak counted');

    // Shortcut: dig straight from the surface corridor down to the core and the path shortens.
    const g2 = fresh(11);
    const w = g2.world;
    const before = w.fields.core[w.idx(0, 0)];
    for (let r = 0; r <= CORE.r; r++) w.dig(CORE.c, r);
    w.updateFields();
    ok(w.fields.core[w.idx(0, 0)] < before, 'digging a shortcut shortens their route (the tension of the game)');
}

// ------------------------------------------------------------------ towers
section('towers');
{
    const g = fresh(3);
    g.player.inv = 1e9;
    g.gold = 1000;
    const w = g.world;
    let built = 0;
    for (let r = 1; r < ROWS && built < 10; r++) for (let c = 0; c < COLS && built < 10; c++) {
        if (!w.buildable(c, r)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.isTunnel(c + dx, r + dy) && r + dy > 0)) {
            if (g.build(c, r, built % 2 ? 'arc' : 'blaster')) built++;
        }
    }
    ok(built === 10, 'built ten towers');
    ok(g.world.occ[w.idx(g.towers[0].c, g.towers[0].r)] === 2, 'towers occupy their cell');
    g.hpMul = 1;
    for (let i = 0; i < 6; i++) g.spawnEnemy('grub', i % 2);
    run(g, 40, idle, gg => gg.enemies.length === 0);
    ok(g.stats.kills >= 5, `towers killed the grubs (${g.stats.kills} kills, ${g.stats.leaks} leaks)`);
    const t = g.towers[0], gold = g.gold;
    ok(g.upgrade(t) && t.lvl === 1 && g.gold < gold, 'upgrade spends gold and raises the level');
    const g3 = g.gold;
    ok(g.sell(t) && g.gold > g3 && !g.towers.includes(t) && g.world.occ[w.idx(t.c, t.r)] === 0, 'sell refunds and frees the cell');
    ok(!g.build(g.player.fx, 0, 'blaster'), 'cannot build on the surface');
    g.gold = 0;
    ok(!g.build(t.c, t.r, 'boomer'), 'cannot build without gold');
}

// ------------------------------------------------------------------ harpoon & pump
section('harpoon');
{
    const g = fresh(5);
    g.player.inv = 0;
    g.hpMul = 1;
    // Stand the miner on the surface facing right, grub two cells right of him, frozen in place.
    const p = g.player;
    p.fx = p.tx = 3; p.fy = p.ty = 0; p.dir = 0; p.x = 3; p.y = 0;
    const e = g.spawnEnemy('grub', 0);
    e.fx = e.tx = 5; e.fy = e.ty = 0; e.x = 5; e.y = 0; e.t = 0; e.def = { ...e.def, speed: 0 };
    let presses = 0;
    run(g, 3, (gg, i) => {
        const press = i % 15 === 0 && presses < 8;
        if (press) presses++;
        return { dir: -1, pump: false, pumpPressed: press };
    }, gg => e.dead);
    ok(e.dead && g.stats.popped === 1, `four pumps pop a grub (${presses} presses)`);
    ok(p.dead === false, 'the miner survives');
}

// ------------------------------------------------------------------ power gem
section('power gem');
{
    const g = fresh(9);
    g.player.inv = 0;
    g.hpMul = 1;
    const e = g.spawnEnemy('grub', 0);
    run(g, 1.5);
    g.startFright();
    ok(e.frightened, 'a gem frightens enemies');
    // Put the grub on top of the miner.
    e.x = g.player.x; e.y = g.player.y;
    g.checkCollisions();
    ok(e.dead && g.stats.eaten === 1 && !g.player.dead, 'touching a frightened enemy eats it');
    const k = g.spawnEnemy('king', 0);
    run(g, 1.5);
    g.startFright();
    ok(!k.frightened, 'the king ignores power gems');
}

// ------------------------------------------------------------------ rocks
section('rocks');
{
    const g = fresh(21);
    g.player.inv = 1e9;
    const w = g.world;
    const k = g.rocks[0];
    const e = g.spawnEnemy('grub', 0);
    // Dig out the three cells below the rock and park a grub two under it.
    for (let r = k.r + 1; r <= Math.min(ROWS - 2, k.r + 3); r++) w.dig(k.c, r);
    e.fx = e.tx = k.c; e.fy = e.ty = k.r + 2; e.x = k.c; e.y = k.r + 2; e.def = { ...e.def, speed: 0 };
    g.player.fx = g.player.tx = 0; g.player.fy = g.player.ty = 0;
    run(g, 3, idle, gg => gg.rocks.indexOf(k) < 0);
    ok(e.dead && g.stats.crushed === 1, 'a dropped rock crushes the enemy under it');
    ok(w.tile[w.idx(k.c, k.r)] === TUNNEL, 'the rock leaves a hole where it sat');
}

// ------------------------------------------------------------------ stalker & borer
section('stalker & borer');
{
    const g = fresh(13);
    g.player.inv = 1e9;
    g.hpMul = 1;
    // Miner deep in a sealed pocket: the only way to him is through dirt.
    const w = g.world;
    let spot = null;
    for (let r = 2; r < ROWS - 1 && !spot; r++) for (let c = 0; c < COLS; c++) {
        const i = w.idx(c, r);
        if (w.tile[i] === DIRT && w.occ[i] === 0 && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.isTunnel(c + dx, r + dy))) { spot = [c, r]; break; }
    }
    w.dig(spot[0], spot[1]);
    const p = g.player;
    p.fx = p.tx = spot[0]; p.fy = p.ty = spot[1];
    const s = g.spawnEnemy('stalker', 0);
    let wasGhost = false;
    run(g, 20, idle, () => { if (s.ghost) wasGhost = true; return Math.abs(s.x - p.x) + Math.abs(s.y - p.y) < 1.2; });
    ok(wasGhost, 'a stalker phases through dirt as eyes');
    ok(Math.abs(s.x - p.x) + Math.abs(s.y - p.y) < 1.2, 'and reaches a miner walled into dirt within its chase window');

    const g2 = fresh(13);
    g2.player.inv = 1e9;
    const dug0 = g2.world.tile.reduce((a, b) => a + b, 0);
    const b = g2.spawnEnemy('borer', 0);
    run(g2, 60, idle, gg => gg.coreHp < 10 || b.dead);
    const dug1 = g2.world.tile.reduce((a, b) => a + b, 0);
    ok(dug1 > dug0, `a borer drills new tunnels (${dug1 - dug0} cells)`);
    ok(g2.coreHp < 10, 'and reaches the core');
}

// ------------------------------------------------------------------ drake fire
section('drake fire');
{
    const g = fresh(17);
    g.player.inv = 0;
    const p = g.player;
    p.fx = p.tx = 6; p.fy = p.ty = 0; p.x = 6; p.y = 0;
    for (let c = 0; c < COLS; c++) g.world.dig(c, 0);
    const d = g.spawnEnemy('drake', 0);
    // About to step into column 3 on the surface lane, three cells from the miner.
    d.fx = 2; d.tx = 3; d.fy = d.ty = 0; d.t = 0.98; d.fireCd = 0;
    run(g, 10, idle, () => p.dead);
    ok(p.dead, 'a drake in the same row breathes fire and kills the miner');
}

// ------------------------------------------------------------------ a whole round
section('full round with an invincible miner and a tower wall');
{
    const g = new Game(99);
    g.newGame();
    g.gold = 5000;
    run(g, 3);
    g.player.inv = 1e9;
    const w = g.world;
    for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (!w.buildable(c, r)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.isTunnel(c + dx, r + dy) && r + dy > 0)) {
            const t = g.build(c, r, ['blaster', 'arc', 'frost', 'boomer'][(c + r) % 4]);
            if (t) { g.upgrade(t); g.upgrade(t); }
        }
    }
    const round1Towers = g.towers.length;
    const reached = run(g, 600, (gg) => { if (!gg.waveActive && gg.phase === 'play') gg.callWave(); gg.player.inv = 1e9; return idle; }, gg => gg.round === 2);
    ok(reached, `round 1 cleared (wave ${g.wave}, core ${g.coreHp}, kills ${g.stats.kills})`);
    ok(g.towers.length === 0 && round1Towers > 0, 'new round: new board, towers refunded');
    ok(g.world.fields.core[g.world.idx(0, 0)] < Infinity, 'round 2 board is walkable');
}

// ------------------------------------------------------------------ waves
section('wave composition');
{
    const g = fresh(1);
    for (let r = 1; r <= 4; r++) for (let wv = 1; wv <= WAVES_PER_ROUND; wv++) {
        const s = g.buildWave(r, wv);
        ok(s.list.length > 0 && s.list.every(t => t in { grub: 1, skitter: 1, drake: 1, stalker: 1, borer: 1, king: 1 }), `r${r}w${wv} valid`);
        if (wv === WAVES_PER_ROUND) ok(s.list.includes('king'), `r${r} boss wave has the king`);
        ok(s.hpMul >= 1 && s.interval >= 0.4, `r${r}w${wv} scaling sane`);
    }
}

// ------------------------------------------------------------------ determinism & cost
section('determinism & cost');
{
    const play = () => {
        const g = new Game(4242);
        g.newGame();
        const dirs = [1, 1, 0, 0, 1, 2, 2, 1, 3, 0];
        run(g, 90, (gg, i) => ({ dir: dirs[Math.floor(i / 50) % dirs.length], pump: i % 97 < 10, pumpPressed: i % 97 === 0 }));
        return [g.score, g.gold, g.stats.kills, g.stats.dots, g.player.fx, g.player.fy, g.enemies.length].join(',');
    };
    ok(play() === play(), 'same seed + same input = same game');

    const g = new Game(5);
    g.newGame();
    g.gold = 3000;
    run(g, 3);
    const w = g.world;
    for (let r = 1; r < ROWS; r += 2) for (let c = 0; c < COLS; c += 2) if (w.buildable(c, r)) g.build(c, r, ['blaster', 'arc', 'frost', 'boomer'][(c + r) % 4]);
    g.hpMul = 3;
    for (let i = 0; i < 40; i++) g.spawnEnemy(['grub', 'skitter', 'drake', 'stalker', 'borer'][i % 5], i % 2);
    const times = [];
    for (let i = 0; i < 600; i++) {
        const t0 = performance.now();
        g.player.inv = 1e9;
        g.update(STEP, { dir: (i >> 5) % 4, pump: false, pumpPressed: false });
        times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    console.log(`  sim step p95 ${p95.toFixed(3)}ms with ${g.towers.length} towers / 40 enemies (budget 16.7ms)`);
    ok(p95 < 4, 'simulation is cheap enough for a phone');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
