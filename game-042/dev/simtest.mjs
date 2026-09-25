/**
 * simtest.mjs — assertions against the REAL simulation, in Node (no browser).
 *
 *   node dev/simtest.mjs
 */
import { generateLevel } from '../js/levelgen.js';
import { Game } from '../js/game.js';
import { stepPlayer, newPlayerBody } from '../js/physics.js';
import { T, K } from '../js/tiles.js';
import { PHYS, TILE, STEP, WORLDS, GADGETS } from '../js/config.js';
import { makeEnemy } from '../js/enemies.js';
import { compose, MOODS } from '../js/audio.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const section = s => console.log('-', s);

const NONE = { left: false, right: false, up: false, down: false, downPressed: false, jump: false, jumpPressed: false, fire: false, swapPressed: false };
const inp = o => ({ ...NONE, ...o });
const profileAll = (extra = {}) => ({ gadgets: new Set(GADGETS), weapons: ['pea', 'spread', 'frost', 'rocket'], maxHearts: 99, chips: 0, shards: new Set(), vaults: new Set(), ...extra });
const profileNone = () => ({ gadgets: new Set(), weapons: ['pea'], maxHearts: 3, chips: 0, shards: new Set(), vaults: new Set() });

// A flat test room: floor at row 20, w tiles wide.
function room(w = 60, h = 28) {
    const tiles = new Uint8Array(w * h);
    for (let x = 0; x < w; x++) for (let y = 20; y < h; y++) tiles[y * w + x] = T.GROUND;
    return { world: 1, index: 1, seed: 1, theme: 'meadow', castle: false, name: 'TEST', w, h, tiles, contents: {}, entities: [], start: { x: 3, y: 19 }, gates: [], liftCells: [], arena: null, time: 300, surf: new Array(w).fill(20) };
}
const run = () => ({ score: 0, coins: 0, lives: 5 });
const steps = (g, n, input = NONE) => { for (let i = 0; i < n; i++) g.step(typeof input === 'function' ? input(i) : input, STEP); };

// ------------------------------------------------------------ physics numbers
section('physics');
{
    const env = { w: 60, h: 28, rects: [], kind: (x, y) => (y >= 20 ? K.SOLID : K.EMPTY) };
    const p = newPlayerBody(100, 20 * TILE - PHYS.h); p.onGround = true;
    let top = p.y;
    for (let f = 0; f < 90; f++) { stepPlayer(p, inp({ jump: true, jumpPressed: f === 0 }), STEP, env, {}); top = Math.min(top, p.y); }
    const rise = 20 * TILE - PHYS.h - top;
    ok(rise > 64 && rise < 76, `full jump rises 4-4.75 tiles (${rise.toFixed(1)}px)`);
    const q = newPlayerBody(100, 20 * TILE - PHYS.h); q.onGround = true;
    let top2 = q.y;
    for (let f = 0; f < 90; f++) { stepPlayer(q, inp({ jump: f < 3, jumpPressed: f === 0 }), STEP, env, {}); top2 = Math.min(top2, q.y); }
    ok(20 * TILE - PHYS.h - top2 < 40, 'a tap is a short hop');
    const d = newPlayerBody(100, 20 * TILE - PHYS.h); d.onGround = true;
    let top3 = d.y;
    for (let f = 0; f < 120; f++) { stepPlayer(d, inp({ jump: true, jumpPressed: f === 0 || f === 22 }), STEP, env, { boots: true }); top3 = Math.min(top3, d.y); }
    const r3 = 20 * TILE - PHYS.h - top3;
    ok(r3 > 104 && r3 < 128, `double jump rises 6.5-8 tiles (${r3.toFixed(1)}px)`);
    const e = newPlayerBody(100, 20 * TILE - PHYS.h); e.onGround = true;
    for (let f = 0; f < 90; f++) stepPlayer(e, inp({ jump: true, jumpPressed: f === 30 }), STEP, env, {});
    ok(e.onGround, 'jump without boots in mid-air does nothing (lands)');
}

// ------------------------------------------------------------ stomp & shell
section('enemies');
{
    const L = room();
    const g = new Game(L, profileNone(), run());
    const bug = makeEnemy('bug', 8, 19); bug.active = true; g.enemies.push(bug);
    g.player.x = 8 * TILE + 3; g.player.y = 15 * TILE; g.player.onGround = false; g.player.vy = 50;
    steps(g, 40);
    ok(bug.dead && bug.deathHow === 'stomp', 'landing on a bug stomps it');
    ok(g.run.score >= 100, 'stomp scores');

    const g2 = new Game(room(), profileNone(), run());
    const sn = makeEnemy('snail', 8, 19); sn.active = true; g2.enemies.push(sn);
    g2.player.x = 8 * TILE + 2; g2.player.y = 15 * TILE; g2.player.vy = 50;
    steps(g2, 30);
    ok(!sn.dead && sn.state === 'shell', 'stomping a snail leaves a shell');
    const bug2 = makeEnemy('bug', 20, 19); bug2.active = true; g2.enemies.push(bug2);
    g2.player.x = sn.x - 12; g2.player.y = 20 * TILE - PHYS.h; g2.player.vy = 0; g2.player.invuln = 0;
    steps(g2, 90, inp({ right: true }));
    ok(sn.state === 'slide' || sn.dead, 'walking into a shell kicks it');
    ok(bug2.dead, 'a sliding shell knocks out the next enemy');

    const g3 = new Game(room(), profileNone(), run());
    const pr = makeEnemy('prickle', 8, 19); pr.active = true; g3.enemies.push(pr);
    g3.player.x = 8 * TILE + 3; g3.player.y = 15 * TILE; g3.player.vy = 50;
    steps(g3, 30);
    ok(g3.player.hp === 2 && !pr.dead, 'stomping a Pricklepuff hurts');

    const g4 = new Game(room(), profileAll(), run());
    const b4 = makeEnemy('bug', 12, 19); b4.active = true; g4.enemies.push(b4);
    g4.player.weaponIdx = 2;   // frost
    steps(g4, 40, i => inp({ fire: i < 5 }));
    ok(b4.frozen > 0 && !b4.dead, 'frost freezes an enemy');
    // stand on the ice block
    g4.player.x = b4.x; g4.player.y = b4.y - 30; g4.player.vy = 0;
    steps(g4, 30);
    ok(g4.player.onGround && Math.abs(g4.player.y + g4.player.h - b4.y) < 1, 'a frozen enemy is a platform');
}

// ------------------------------------------------------------ blocks
section('blocks');
{
    const L = room();
    L.tiles[16 * L.w + 5] = T.QBLOCK; L.contents[16 * L.w + 5] = 'berry';
    L.tiles[16 * L.w + 9] = T.BRICK;
    L.tiles[16 * L.w + 13] = T.HIDDEN; L.contents[16 * L.w + 13] = 'coin';
    const g = new Game(L, profileNone(), run());
    g.player.x = 5 * TILE + 3; g.player.y = 20 * TILE - PHYS.h;
    steps(g, 40, i => inp({ jump: i < 20, jumpPressed: i === 0 }));
    ok(g.tile(5, 16) === T.USED, '? block becomes used');
    ok(g.items.some(it => it.kind === 'berry'), 'berry sprouts');
    g.player.x = 9 * TILE + 3; g.player.y = 20 * TILE - PHYS.h; g.player.vy = 0;
    steps(g, 40, i => inp({ jump: i < 20, jumpPressed: i === 0 }));
    ok(g.tile(9, 16) === T.EMPTY, 'head-bumping a brick breaks it');
    g.player.x = 13 * TILE + 3; g.player.y = 20 * TILE - PHYS.h; g.player.vy = 0;
    const coins = g.run.coins;
    steps(g, 40, i => inp({ jump: i < 20, jumpPressed: i === 0 }));
    ok(g.tile(13, 16) === T.USED && g.run.coins === coins + 1, 'a hidden block appears and pays');
}

// ------------------------------------------------------------ gadget gates in play
section('gates');
{
    const L = room();
    for (let y = 18; y <= 19; y++) L.tiles[y * L.w + 12] = T.RED;
    for (let y = 0; y <= 17; y++) L.tiles[y * L.w + 12] = T.HARD;
    const g = new Game(L, profileAll(), run());
    g.player.weaponIdx = 3;
    g.player.x = 8 * TILE; g.player.y = 20 * TILE - PHYS.h;
    steps(g, 120, i => inp({ fire: i < 3 }));
    ok(g.tile(12, 18) === T.EMPTY && g.tile(12, 19) === T.EMPTY, 'a rocket clears the whole red rock wall');
    const g2 = new Game(L, profileAll(), run());
    g2.player.weaponIdx = 0;
    g2.player.x = 8 * TILE; g2.player.y = 20 * TILE - PHYS.h;
    steps(g2, 120, i => inp({ fire: i < 30 }));
    ok(g2.tile(12, 18) === T.RED, 'peas bounce off red rock');

    const L2 = room();
    L2.tiles[17 * L2.w + 8] = T.BUBBLE; L2.tiles[14 * L2.w + 10] = T.BUBBLE;
    const g3 = new Game(L2, profileAll(), run());
    g3.player.weaponIdx = 2;
    g3.player.x = 8 * TILE + 3; g3.player.y = 20 * TILE - PHYS.h; g3.player.facing = 1;
    steps(g3, 40, i => inp({ fire: i < 3, up: true }));
    ok(g3.tile(8, 17) === T.ICE && g3.tile(10, 14) === T.ICE, 'one frost shot freezes the whole bubble stair');
    steps(g3, 60 * 9);
    ok(g3.tile(8, 17) === T.BUBBLE, 'ice melts back into a bubble');

    // touching an unfrozen bubble without the Frost Ray: wobble + one-time hint
    const L2b = room();
    L2b.tiles[19 * L2b.w + 8] = T.BUBBLE;
    const g3b = new Game(L2b, profileNone(), run());
    g3b.player.x = 8 * TILE + 3; g3b.player.y = 16 * TILE; g3b.player.vy = 50;
    steps(g3b, 30);
    ok(g3b.tile(8, 19) === T.BUBBLE, 'a bubble stays non-solid without the Frost Ray');
    ok(g3b.bumps.some(b => b.bubble) || g3b.bubbleTouch.size > 0 || g3b.bubbleHinted, 'touching a bubble registers a reaction');
    ok(g3b.bubbleHinted, 'the freeze-ray hint fires on the first bubble touched');
    const hint = g3b.parts.filter(q => q.k === 'text' && /FREEZE RAY/.test(q.text));
    ok(hint.length === 1, 'exactly one freeze-ray hint popup is queued');
    // walking back over more bubbles must not spam the hint
    L2b.tiles[19 * L2b.w + 12] = T.BUBBLE;
    steps(g3b, 90, () => inp({ right: true }));
    ok(g3b.parts.filter(q => q.k === 'text' && /FREEZE RAY/.test(q.text)).length <= 1, 'the hint never repeats in a level');

    // with the Frost Ray in hand the hint is pointless, so it stays quiet
    const L2c = room();
    L2c.tiles[19 * L2c.w + 8] = T.BUBBLE;
    const g3d = new Game(L2c, profileAll(), run());
    g3d.player.x = 8 * TILE + 3; g3d.player.y = 16 * TILE; g3d.player.vy = 50;
    steps(g3d, 30);
    ok(!g3d.bubbleHinted, 'no freeze-ray hint once you already have the Frost Ray');

    const L3 = room();
    L3.tiles[20 * L3.w + 8] = T.CRACK;
    for (let y = 21; y <= 22; y++) L3.tiles[y * L3.w + 8] = T.EMPTY;
    const g4 = new Game(L3, profileNone(), run());
    g4.player.x = 8 * TILE + 3; g4.player.y = 20 * TILE - PHYS.h;
    steps(g4, 60, i => inp({ jump: i < 5, jumpPressed: i === 0, down: i >= 12, downPressed: i === 12 }));
    ok(g4.tile(8, 20) === T.EMPTY && g4.player.y > 20 * TILE, 'a ground pound breaks a cracked floor and drops through');
}

// ------------------------------------------------------------ pits, hurt, death
section('health');
{
    const L = room();
    for (let x = 10; x < 14; x++) for (let y = 20; y < 28; y++) L.tiles[y * L.w + x] = T.EMPTY;
    L.surf = L.surf.map((v, x) => (x >= 10 && x < 14 ? -1 : v));
    const g = new Game(L, profileNone(), run());
    g.player.x = 8 * TILE; g.player.y = 20 * TILE - PHYS.h;
    steps(g, 10);
    g.player.x = 11 * TILE; g.player.y = 21 * TILE;
    steps(g, 60);
    ok(g.player.hp === 2 && g.phase === 'play' && g.player.y < 20 * TILE, 'a pit costs one heart and puts Pip back on safe ground');
    g.player.hp = 1; g.player.invuln = 0;
    g.player.x = 11 * TILE; g.player.y = 21 * TILE;
    steps(g, 60);
    ok(g.phase === 'dying' || g.phase === 'dead', 'the last heart in a pit loses a life');
    steps(g, 200);
    ok(g.phase === 'dead' && g.events.some(e => e.type === 'died'), 'dying ends with a died event');
}

// ------------------------------------------------------------ real levels
section('levels');
{
    let clears = 0;
    for (const [w, i] of [[1, 1], [1, 2], [2, 1]]) {
        const L = generateLevel(77, w, i);
        const g = new Game(L, profileAll(), run());
        // a flag at the end: teleport near it and walk
        const goal = g.goal;
        g.player.x = (goal.x - 4) * TILE; g.player.y = (goal.y - 12) * TILE;
        let done = false;
        for (let f = 0; f < 60 * 25 && !done; f++) {
            g.step(inp({ right: true }), STEP);
            if (g.events.some(e => e.type === 'clear')) done = true;
            g.events.length = 0;
        }
        if (done) clears++;
    }
    ok(clears === 3, `flagpole → walk into castle → clear (${clears}/3)`);
    const L = generateLevel(77, 1, 3);
    const g = new Game(L, profileNone(), run());
    for (let f = 0; f < 600; f++) g.step(inp({ right: f % 90 < 70, jump: f % 30 < 12, jumpPressed: f % 30 === 0, fire: true }), STEP);
    ok(g.events.length <= 400, 'event queue is bounded');
    // determinism
    const A = new Game(L, profileNone(), run()), B = new Game(L, profileNone(), run());
    for (let f = 0; f < 900; f++) { const i = inp({ right: f % 100 < 80, jump: f % 25 < 10, jumpPressed: f % 25 === 0, fire: f % 7 === 0 }); A.step(i, STEP); B.step(i, STEP); }
    ok(A.player.x === B.player.x && A.player.y === B.player.y && A.run.score === B.run.score, 'the simulation is deterministic');
}

// ------------------------------------------------------------ bosses
section('bosses (bot, invincible Pip)');
for (let w = 1; w <= 5; w++) {
    const L = generateLevel(99, w, 5);
    const prof = profileAll({ maxHearts: 999 });
    prof.gadgets = new Set(GADGETS.slice(0, w - 1));
    prof.weapons = ['pea', ...prof.gadgets.has('frost') ? ['frost'] : [], ...prof.gadgets.has('rocket') ? ['rocket'] : []];
    const g = new Game(L, prof, run());
    const a = g.arenaPx;
    g.player.x = a.x0 + 70; g.player.y = a.floor - 30;
    const t0 = Date.now();
    let f = 0, frames = 0;
    const bossKind = WORLDS[w - 1].boss;
    let got = false;
    for (; f < 60 * 240; f++) {
        const b = g.boss;
        const p = g.player;
        p.hp = 999;
        let i = NONE;
        if (b && !b.dead) {
            const bx = b.x + b.w / 2, px = p.x + p.w / 2;
            const dx = bx - px, above = b.y + b.h < p.y;
            const face = dx >= 0;
            const wantUp = above && Math.abs(dx) < 30;
            const diag = above && !wantUp;
            // keep ~70px away, shoot, jump now and then
            const far = Math.abs(dx) > 90, near = Math.abs(dx) < 50;
            i = inp({
                right: (face && far) || (!face && near) || (diag && face && !near),
                left: (!face && far) || (face && near) || (diag && !face && !near),
                up: wantUp || diag, fire: true,
                jump: f % 50 < 16, jumpPressed: f % 50 === 0,
            });
            if (!face && !((face && far) || (!face && near))) p.facing = -1;
        } else if (b && b.dead) {
            const pk = g.pickups.find(k => k.t === 'gadget');
            if (pk) i = inp({ right: pk.x > p.x, left: pk.x < p.x });
        }
        g.step(i, STEP);
        if (g.events.some(e => e.type === 'gadget')) { got = true; break; }
        g.events.length = 0;
        frames++;
    }
    console.log(`    ${bossKind}: ${got ? "beaten" : "NOT beaten"} in ${(frames / 60).toFixed(0)}s of play, ${g.stats.hurts} hits taken`);
    ok(got, `${bossKind}: a shooting bot beats it and collects the reward (${(frames / 60).toFixed(0)}s sim, ${Date.now() - t0}ms)`);
}

// ------------------------------------------------------------ audio composer
section('music');
{
    for (const k in MOODS) {
        const s = compose(1234, MOODS[k]);
        ok(s.bars.length === 16 && s.bars.every(b => b.lead.length === 16 && b.bass.length === 16), `${k}: 16 bars of 16 steps`);
        ok(s.bars.every(b => b.lead.every(n => n === 0 || n === -1 || (n > 40 && n < 100))), `${k}: lead stays in range`);
    }
    const a = compose(5, MOODS.map), b = compose(5, MOODS.map), c = compose(6, MOODS.map);
    ok(JSON.stringify(a) === JSON.stringify(b), 'same seed, same song');
    ok(JSON.stringify(a) !== JSON.stringify(c), 'different seed, different song');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
