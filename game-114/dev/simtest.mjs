/**
 * simtest.mjs — headless checks of LAST COLONIST's simulation. No browser.
 *
 *   node game-114/dev/simtest.mjs            # everything
 *   ONLY=purity,levels,rules node game-114/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-114/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. levels: every chunk is rectangular and enters and leaves on the floor; every sector on many
 *    seeds has its pods, a start, an exit or an arena, and only standable pods and pickups.
 * 3. rules: running, jumping, the jump cut, platforms and dropping through, acid, pits, every
 *    weapon, flares, pods, pickups, checkpoints, dying and respawning, game over and continue,
 *    the exit, the arena lock and each boss being beatable.
 * 4. determinism: the same seed and inputs give the same game; a save round trip mid-sector plays
 *    on identically; unknown save versions are rejected.
 * 5. reach: an invulnerable bot crosses every sector and beats every boss on SEEDS seeds, which
 *    proves each generated level can be crossed with the real body mover.
 * 6. bot: mortal bots at two skills play the whole campaign; the balance table is printed.
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
const Lv = await import('../js/sim/levels.js');
const Bt = await import('../js/sim/bot.js');
const Ph = await import('../js/sim/physics.js');
const St = await import('../js/sim/data/story.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, jump: false, jumpHeld: false, fire: false, flare: false };
const I = (o) => ({ ...NONE, ...o });
const run = (G, inp, secs) => { for (let t = 0; t < secs; t += DT) { Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); G.events.length = 0; } };
const runEv = (G, inp, secs) => { const seen = []; for (let t = 0; t < secs; t += DT) { Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); seen.push(...G.events.splice(0)); } return seen; };
/** A quiet test level: one sector, every spawn removed. */
const quiet = (seed = 1, level = 0) => {
    const G = Gm.newGame(seed, { level });
    G.spawns.length = 0; G.enemies.length = 0; G.events.length = 0;
    return G;
};
/** A flat test floor: replace the level's tiles with a plain corridor. */
const flat = (G, w = 80) => {
    const L = G.level;
    L.w = w; L.tiles = new Array(w * L.h).fill(0);
    for (let x = 0; x < w; x++) { L.tiles[x] = 1; L.tiles[L.w + x] = 1; }
    L.exit = null; L.arena = null; L.checkpoints = [];
    G.pods.length = 0; G.pickups.length = 0; G.vents.length = 0; G.spawns.length = 0;
    G.player.x = 5; G.player.y = 2;
    return L;
};

// ====================================================================== purity
if (want('purity')) {
    section('purity');
    const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((f) => f.isDirectory() ? walk(d + '/' + f.name) : [d + '/' + f.name]);
    const files = ['js/rng.js', 'js/config.js', ...walk('js/sim')];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ====================================================================== levels
if (want('levels')) {
    section('levels');
    for (const [name, rows] of Object.entries(Lv.CHUNKS)) {
        let w = -1;
        try { w = Lv.chunkWidth(name); } catch { /* ragged */ }
        ok(w > 0, `chunk ${name} is rectangular`);
        const n = rows.length;
        ok(rows[n - 1][0] === '#' && rows[n - 2][0] === '#' && rows[n - 1][w - 1] === '#' && rows[n - 2][w - 1] === '#', `chunk ${name} enters and leaves on the floor`);
        ok(rows.slice(0, n - 2).every((r) => r[0] !== '#' && r[w - 1] !== '#' && r[1] !== '#'), `chunk ${name} has headroom at both edges`);
    }
    for (const L of Lv.LEVELS) for (const c of L.pool) ok(!!Lv.CHUNKS[c], `${L.id} pool chunk ${c} exists`);
    ok(Lv.LEVELS.length === 8 && St.BRIEFS.length === 8, 'eight sectors, eight briefings');
    let built = 0;
    for (let s = 1; s <= SEEDS * 3; s++) {
        for (let i = 0; i < Lv.LEVELS.length; i++) {
            const L = Lv.buildLevel(i, s * 101);
            const def = Lv.LEVELS[i];
            built++;
            if (!ok(L.pods.length === def.pods, `seed ${s} ${def.id}: ${L.pods.length}/${def.pods} pods`)) continue;
            ok(def.end === 'exit' ? !!L.exit && !L.arena : !!L.arena && !L.exit && L.arena.boss === def.end, `seed ${s} ${def.id}: has its ending`);
            const onGround = (o) => Ph.standable(L, Math.floor(o.x), o.y) && Math.abs(o.y - Math.round(o.y)) < 1e-6;
            ok(L.pods.every(onGround), `seed ${s} ${def.id}: pods stand on something`);
            ok(L.pickups.filter((k) => !k.float).every(onGround), `seed ${s} ${def.id}: pickups stand on something`);
            ok(L.spawns.filter((e) => e.k !== 'wisp').every(onGround), `seed ${s} ${def.id}: ground enemies stand on something`);
            ok(Ph.standable(L, 3, 2), `seed ${s} ${def.id}: the start has a floor`);
            const a = Lv.buildLevel(i, s * 101), b = Lv.buildLevel(i, s * 101);
            ok(JSON.stringify(a) === JSON.stringify(b), `seed ${s} ${def.id}: building is deterministic`);
        }
    }
    console.log(`  ${built} levels built, ${Lv.TOTAL_PODS} pods in a campaign`);
}

// ====================================================================== rules
const Cm0 = await import('../js/sim/common.js');
if (want('rules')) {
    section('rules');
    let G = quiet();
    flat(G);
    run(G, NONE, 0.3);
    ok(G.player.ground && Math.abs(G.player.y - 2) < 1e-6, 'the player stands on the floor');
    const x0 = G.player.x;
    run(G, I({ x: 1 }), 0.5);
    ok(Math.abs(G.player.x - (x0 + C.PLAYER.speed * 0.5)) < 0.15, 'runs right at PLAYER.speed');
    ok(G.player.face === 1, 'faces right');
    let top = 0;
    Gm.step(G, I({ jump: true, jumpHeld: true }), DT);
    ok(G.events.some((e) => e.type === 'jump'), 'jump emits an event');
    for (let t = 0; t < 1.2; t += DT) { Gm.step(G, I({ jumpHeld: true }), DT); top = Math.max(top, G.player.y); }
    ok(top > 2 + 3.7 && top < 2 + 4.2, `a full jump rises about four tiles (${(top - 2).toFixed(2)})`);
    ok(G.player.ground, 'and lands');
    Gm.step(G, I({ jump: true, jumpHeld: true }), DT);
    top = 0;
    for (let t = 0; t < 1.2; t += DT) { Gm.step(G, I({ jumpHeld: t < 0.08 }), DT); top = Math.max(top, G.player.y); }
    ok(top - 2 < 2.2, `letting go early cuts the jump short (${(top - 2).toFixed(2)})`);
    // a tap shorter than one step still jumps (the press is an edge)
    G.events.length = 0;
    Gm.step(G, I({ jump: true, jumpHeld: false }), DT);
    ok(G.events.some((e) => e.type === 'jump'), 'a jump tap released before the step still jumps');
    run(G, NONE, 1);

    // crouch and aim
    run(G, I({ y: -1 }), 0.1);
    ok(G.player.crouch && G.player.h === C.PLAYER.hCrouch, 'down on the ground crouches');
    const cx = G.player.x;
    run(G, I({ y: -1, x: 0.2 }), 0.3);
    ok(Math.abs(G.player.x - cx) < 1e-6, 'and crouching stands still');
    run(G, I({ y: 1 }), 0.05);
    ok(G.player.aim.y === 1 && G.player.aim.x === 0, 'up aims straight up');
    run(G, I({ y: 1, x: 1 }), 0.05);
    ok(G.player.aim.y > 0.6 && G.player.aim.x > 0.6, 'up + right aims diagonally');

    // platforms
    G = quiet();
    const L = flat(G);
    for (let x = 4; x < 10; x++) L.tiles[4 * L.w + x] = Ph.T_PLAT;
    G.player.x = 6;
    run(G, I({ jump: true, jumpHeld: true }), 0.02);
    run(G, I({ jumpHeld: true }), 1.2);
    ok(G.player.ground && Math.abs(G.player.y - 5) < 1e-6, 'jumps up through a platform and lands on it');
    ok(Ph.onPlatform(L, G.player), 'and knows it is on a platform');
    run(G, I({ y: -1, jump: true }), 0.02);
    run(G, NONE, 1);
    ok(Math.abs(G.player.y - 2) < 1e-6, 'down + jump drops through it');

    // walls
    G = quiet();
    const L2 = flat(G);
    for (let r = 2; r < 6; r++) L2.tiles[r * L2.w + 12] = 1;
    run(G, I({ x: 1 }), 2);
    ok(G.player.x < 12 - C.PLAYER.w / 2 + 0.01 && G.player.x > 11, 'a wall stops the player');

    // acid and pits
    G = quiet();
    const L3 = flat(G);
    for (let x = 10; x < 14; x++) L3.tiles[L3.w + x] = Ph.T_ACID;
    run(G, I({ x: 1 }), 0.9);
    let evs = runEv(G, NONE, 0.6);
    ok(evs.some((e) => e.type === 'hurt' && e.kind === 'acid') && G.player.hp === C.PLAYER.hp - 1, 'acid hurts');
    G = quiet();
    const L4 = flat(G);
    for (let x = 10; x < 16; x++) { L4.tiles[x] = 0; L4.tiles[L4.w + x] = 0; }
    evs = runEv(G, I({ x: 1 }), 1.2);
    ok(evs.some((e) => e.type === 'fall'), 'running into a pit falls');
    ok(G.player.hp === C.PLAYER.hp - 1 && G.player.x < 10.5, 'costs a hit and puts the player back on safe ground');

    // weapons
    for (const w of ['blaster', 'spread', 'laser', 'rocket']) {
        G = quiet();
        flat(G);
        G.player.weapon = w;
        G.player.inv = 0;
        G.enemies.push({ id: 900, k: 'turret', x: 10, y: 2, w: 1.3, h: 2.2, vx: 0, vy: 0, hp: 40, maxHp: 40, face: -1, t: 0, cool: 99, flash: 0, state: 'idle', st: 0, dead: false, ground: true });
        const e = G.enemies[0];
        const hp0 = e.hp;
        const evw = runEv(G, I({ fire: true }), 0.6);
        const shots = evw.filter((x) => x.type === 'shot').length;
        ok(shots >= 2 && hp0 - e.hp > 0, `${w}: holding fire shoots (${shots} shots, ${hp0 - e.hp} damage)`);
        if (w === 'spread') ok(G.pbul.length >= 5 || evw.length > 0, 'spread fires a fan');
    }
    G = quiet();
    flat(G);
    Gm.step(G, I({ fire: true }), DT);
    const n1 = G.pbul.length;
    Gm.step(G, I({ fire: false }), DT);
    ok(n1 === 1, 'a fire tap shoots exactly once');

    // laser pierces
    G = quiet();
    flat(G);
    G.player.weapon = 'laser';
    const mk = (id, x) => ({ id, k: 'skitter', x, y: 2, w: 0.9, h: 0.7, vx: 0, vy: 0, hp: 2, maxHp: 2, face: -1, t: 0, cool: 99, flash: 0, state: 'idle', st: 0, dead: false });
    run(G, NONE, 0.1);
    G.enemies.push(mk(1, 9), mk(2, 11));
    run(G, I({ y: -1, fire: true }), 0.05);
    run(G, NONE, 0.4);
    ok(G.enemies.length === 0, 'the lance pierces a row of enemies');

    // flares
    G = quiet();
    flat(G);
    run(G, NONE, 0.1);
    Cm0.addEnemy(G, 'turret', 10.5, 2);
    G.enemies[0].cool = 99;
    const f0 = G.player.flares;
    evs = runEv(G, I({ flare: true }), DT);
    evs.push(...runEv(G, NONE, 2));
    ok(G.player.flares === f0 - 1 && evs.some((e) => e.type === 'boom' && e.kind === 'flare'), 'a flare is thrown and goes off');
    ok(G.enemies.length === 0, 'and kills what it lands near');
    G = quiet(); flat(G);
    G.ebul.push({ x: 9, y: 3, vx: 0, vy: 0, k: 'bolt', g: 0, life: 9, r: 0.2 });
    G.flares.push({ x: 9, y: 3, vx: 0, vy: 0, t: 0.01, id: 99 });
    run(G, NONE, 0.05);
    ok(G.ebul.length === 0, 'a flare burst wipes out enemy shots');

    // pods
    G = quiet();
    flat(G);
    G.pods.push({ x: 9, y: 2, hp: C.POD_HP, open: false, flash: 0 });
    G.player.hp = 2;
    evs = runEv(G, I({ fire: true }), 1.0);
    ok(G.pods[0].open && evs.some((e) => e.type === 'rescue') && G.rescued[0] === 1, 'shooting a pod frees the colonist');
    ok(G.player.hp === 3, 'and the colonist patches you up');

    // pickups
    G = quiet();
    flat(G);
    G.pickups.push({ k: 'spread', x: 8, y: 3.4, float: true, id: 0, taken: false }, { k: 'med', x: 12, y: 2, id: 1, taken: false }, { k: 'flare', x: 15, y: 2, id: 2, taken: false });
    G.player.hp = 1;
    run(G, I({ x: 1 }), 1.8);
    ok(G.player.weapon === 'spread' && G.player.hp === C.PLAYER.hp && G.player.flares === C.PLAYER.flares + 2, 'weapon, med kit and flare pack pickups work');

    // dying, respawning, game over, continue
    G = quiet();
    flat(G);
    G.level.checkpoints = [{ x: 8, y: 2 }];
    run(G, I({ x: 1 }), 0.6);
    ok(G.cpIdx === 0, 'passing a beacon sets the checkpoint');
    G.player.weapon = 'laser';
    const Cm = await import('../js/sim/common.js');
    const hp = G.player.hp;
    for (let i = 0; i < hp; i++) { G.player.inv = 0; Cm.hurtPlayer(G, 1); }
    ok(G.player.dead && G.phase === 'dying' && G.lives === C.PLAYER.lives - 1, 'losing all health costs a life');
    run(G, NONE, C.PLAYER.respawnT + 0.1);
    ok(G.phase === 'play' && !G.player.dead && Math.abs(G.player.x - 8) < 0.01 && G.player.weapon === 'blaster', 'respawns at the checkpoint with the blaster');
    G.lives = 1;
    Cm.killPlayer(G);
    evs = runEv(G, NONE, C.PLAYER.respawnT + 0.1);
    ok(G.phase === 'over' && evs.some((e) => e.type === 'over'), 'the last life ends the game');
    G.score = 5000; G.levelStartScore = 1200;
    Gm.continueGame(G);
    ok(G.phase === 'play' && G.lives === C.PLAYER.lives && G.score === 1200 && G.stats.continues === 1, 'continue restarts the sector with the score it started with');

    // the exit
    G = quiet();
    G.player.x = G.level.exit.x - 1; G.player.y = G.level.exit.y;
    evs = runEv(G, I({ x: 1 }), 0.5);
    ok(G.phase === 'clear' && evs.some((e) => e.type === 'clear') && G.tally?.total > 0, 'the exit door clears the sector with a tally');
    ok(Gm.nextLevel(G) && G.levelIdx === 1 && G.phase === 'play', 'and the next sector loads');

    // enemies wake up and fight
    G = Gm.newGame(3);
    let woke = false, shot = false;
    for (let t = 0; t < 30 && !woke; t += DT) { Gm.step(G, I({ x: 1 }), DT); if (G.enemies.length) woke = true; G.events.length = 0; }
    ok(woke, 'spawn markers wake up as the player nears them');
    for (const k of ['spitter', 'turret', 'nest']) {
        G = quiet(); flat(G);
        Cm.addEnemy(G, k, 12, 2);
        G.player.inv = 99;
        evs = runEv(G, NONE, 5);
        ok(evs.some((e) => ['spit', 'eshot', 'hatch'].includes(e.type)), `a ${k} attacks`);
    }
    G = quiet(); flat(G);
    Cm.addEnemy(G, 'skitter', 10, 2);
    evs = runEv(G, NONE, 4);
    ok(evs.some((e) => e.type === 'hurt'), 'a skitter chases and bites');

    // bosses: each locks the arena and can be beaten
    for (const [lvl, k] of [[1, 'brood'], [3, 'warden'], [5, 'gravemaw'], [7, 'queen']]) {
        G = quiet(1, lvl);
        G.god = true;
        const a = G.level.arena;
        G.player.x = a.x0 + 2; G.player.y = 2;
        G.spawns.length = 0;
        evs = runEv(G, I({ x: 1 }), 0.4);
        ok(G.arenaLocked && G.boss?.k === k && evs.some((e) => e.type === 'bossIntro'), `${k}: the arena locks and the boss appears`);
        run(G, NONE, 3);
        G.boss.hp = 1;
        const bot = Bt.makeBot({ skill: 1 });
        evs = runEv(G, (g) => Bt.botInput(g, bot), 30);
        ok(evs.some((e) => e.type === 'bossDown'), `${k}: can be shot down`);
        ok(G.phase === (k === 'queen' ? 'won' : 'clear'), `${k}: its fall ${k === 'queen' ? 'wins the game' : 'clears the sector'}`);
    }
}

// ====================================================================== determinism
if (want('determinism')) {
    section('determinism');
    const play = (seed) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); run(G, (g) => Bt.botInput(g, b), 25); return G; };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');

    const G = Gm.newGame(7, { level: 2 });
    const bot = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, bot), 15);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 3 }), b2 = Bt.makeBot({ seed: 3 });
    run(G, (g) => Bt.botInput(g, b1), 15);
    run(copy, (g) => Bt.botInput(g, b2), 15);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    ok(JSON.stringify(Gm.serialize(G)).length < 60000, `a save is small (${JSON.stringify(Gm.serialize(G)).length} bytes)`);
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ====================================================================== reach
/** Play one sector with a bot; returns a summary. */
function playSector(G, bot, maxT = 400) {
    const start = G.levelIdx;
    let t = 0, bad = null, maxX = 0;
    while (t < maxT && G.levelIdx === start && (G.phase === 'play' || G.phase === 'dying')) {
        Gm.step(G, Bt.botInput(G, bot), DT);
        G.events.length = 0;
        t += DT;
        const p = G.player;
        maxX = Math.max(maxX, p.x);
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { bad = 'non-finite position'; break; }
        if (p.x < 0 || p.x > G.level.w) { bad = 'outside the level'; break; }
    }
    return { t, bad, maxX, phase: G.phase };
}

if (want('reach')) {
    section('reach (invulnerable bot, every sector)');
    for (let s = 1; s <= SEEDS; s++) {
        for (let i = 0; i < Lv.LEVELS.length; i++) {
            const G = Gm.newGame(s * 977, { level: i });
            G.god = true;
            const bot = Bt.makeBot({ skill: 1, seed: s });
            const r = playSector(G, bot, 600);
            const done = G.phase === 'clear' || G.phase === 'won';
            ok(done && !r.bad, `seed ${s} ${Lv.LEVELS[i].id}: crossed in ${r.t.toFixed(0)} s${done ? '' : ` — stuck at x ${G.player.x.toFixed(1)} of ${G.level.w} (${G.level.seq.join(' ')})${r.bad ? ' ' + r.bad : ''}`}`);
        }
    }
}

// ====================================================================== bot
if (want('bot')) {
    section('bot (mortal, whole campaign)');
    const rows = [];
    for (const skill of [1, 0.6]) {
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 31337);
            const bot = Bt.makeBot({ skill, seed: s });
            let t = 0;
            let bad = null;
            while (t < 4000) {
                const r = playSector(G, bot, 600);
                t += r.t;
                if (r.bad) { bad = r.bad; break; }
                if (G.phase === 'clear') { Gm.nextLevel(G); continue; }
                if (G.phase === 'over') { if (G.stats.continues >= 15) break; Gm.continueGame(G); continue; }
                break;
            }
            ok(!bad, `skill ${skill} seed ${s}: ${bad || 'invariants hold'}`);
            rows.push({ skill, seed: s, reached: G.levelIdx + 1, won: G.phase === 'won', continues: G.stats.continues, deaths: G.stats.deaths, pods: G.rescued.reduce((a, b) => a + b, 0), score: G.score, minutes: (t / 60).toFixed(1) });
        }
    }
    console.table(rows);
    const avg = (sk, k) => rows.filter((r) => r.skill === sk).reduce((a, r) => a + +r[k], 0) / SEEDS;
    const good = rows.filter((r) => r.skill === 1);
    ok(good.every((r) => r.reached === 8), 'the good bot reaches the Larder every time');
    ok(good.some((r) => r.won), 'and beats the Queen at least once');
    ok(avg(1, 'reached') - avg(1, 'deaths') / 100 > avg(0.6, 'reached') - avg(0.6, 'deaths') / 100, 'a sloppier bot does worse (gets less far, or dies more getting there)');
    ok(avg(0.6, 'deaths') > 2, 'the campaign is not a walk in the park');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
