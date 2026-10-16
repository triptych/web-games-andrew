/**
 * simtest.mjs — headless checks of BUBBLE NEBULA's simulation. No browser.
 *
 *   node game-082/dev/simtest.mjs            # everything
 *   ONLY=purity,levels,rules node game-082/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-082/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. levels: every sector builds; its floor holds the player's start; every platform, every
 *    walker's spawn, the air current and the top gap can be reached, proved on the jump graph
 *    that the real body mover makes; nothing that drops in through the top falls forever.
 * 3. rules: walking, the jump, one-way platforms, walls, the wrap; blowing, trapping, escaping
 *    angry, popping, chains and their loot, bouncing; letters and EXTEND; extra lives; HURRY UP!
 *    and the Wraith; dying, respawning, GAME OVER and continuing; zap, nova and every power-up;
 *    clearing, the quick-clear bonus and the warp; the Baron from first hit to the Nebula Heart.
 * 4. determinism: the same seed and inputs give the same game; a save round trip mid-sector
 *    plays on identically; unknown or broken saves are rejected.
 * 5. bot: the bot plays the whole campaign on SEEDS seeds at two skills with per-step invariants,
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
const Lv = await import('../js/sim/levels.js');
const Ph = await import('../js/sim/physics.js');
const Nv = await import('../js/sim/nav.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, jump: false, fire: false, fireP: false };
const inp = (o) => ({ ...NONE, ...o });
const run = (G, input, secs, until = null) => {
    for (let t = 0; t < secs; t += DT) {
        Gm.step(G, typeof input === 'function' ? input(G) : input, DT);
        if (until && until(G)) return true;
    }
    return false;
};
/** A fresh game at a sector, already in play, with its crew out of the way. */
const playing = (level = 0, seed = 1, opts = {}) => {
    const G = Gm.newGame(seed, { level, ...opts });
    run(G, NONE, C.TIMING.intro + 0.05);
    G.events.length = 0;
    return G;
};
const parkEnemies = (G) => { for (const e of G.enemies) { e.x = 28; e.y = 1.5 + e.h; e.st = 'trap'; } };
const has = (G, type) => G.events.some((e) => e.type === type);

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        // strip comments and string literals first, so a sentence can't trip the grep (game-080)
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8')
            .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
            .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
        ok(!/\bdocument\.|\bwindow\.|from "three"|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        const imports = [...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/from '([^']+)'/g)].map((m) => m[1]);
        ok(!imports.some((i) => /\/(view|ui|audio|input|save|main)(\.js|\/)/.test(i) || i === 'three'), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('purity')) {
    section('stamp');
    const { execFileSync } = await import('node:child_process');
    let stamped = true;
    try { execFileSync(process.execPath, [path.join(HERE, 'stamp.mjs'), '--check'], { stdio: 'pipe' }); } catch { stamped = false; }
    ok(stamped, 'index.html imports every module stamped with this VERSION (run dev/stamp.mjs)');
}

if (want('levels')) {
    section('levels');
    ok(Lv.LEVELS.length === 25 && Lv.LEVELS[Lv.LAST].boss, '25 sectors, the last is the Baron');
    let reachedAll = 0;
    for (let i = 0; i < Lv.LEVELS.length; i++) {
        const tag = `sector ${i + 1} (${Lv.LEVELS[i].name})`;
        let L;
        try { L = Lv.buildLevel(i); } catch (err) { ok(false, `${tag} builds: ${err.message}`); continue; }
        ok(Ph.supported(L, C.PLAYER.startX, C.PLAYER.startY, C.PLAYER.w), `${tag}: the floor holds the player's start`);
        ok(Ph.solid(L, 0, 12) && Ph.solid(L, 1, 12) && Ph.solid(L, 30, 12) && Ph.solid(L, 31, 12), `${tag}: side walls`);
        const nav = Nv.navFor(i);
        const start = Ph.segmentAt(nav.segs, C.PLAYER.startX, C.PLAYER.startY, C.PLAYER.w);
        const R = Nv.reachable(nav, start.id);
        const lost = nav.segs.filter((s) => !R.has(s.id));
        ok(!lost.length, `${tag}: every platform can be reached (${nav.segs.length} platforms)${lost.length ? ' — not ' + lost.map((s) => `row ${s.r} cols ${s.c0}-${s.c1}`).join(', ') : ''}`);
        if (!lost.length) reachedAll++;
        // spawns: no two on top of each other; walkers drop onto reachable platforms
        const keys = new Set(L.spawns.map((s) => `${s.x},${s.y}`));
        ok(keys.size === L.spawns.length, `${tag}: no two enemies share a spawn`);
        for (const s of L.spawns) {
            if (!['blip', 'spark', 'grunt'].includes(s.type)) { ok(s.x >= 3 && s.x <= 29 && s.y > 1, `${tag}: ${s.type} spawns inside`); continue; }
            const r = Ph.groundBelow(L, s.x, s.y, C.ENEMY[s.type].w);
            const seg = r != null && Ph.segmentAt(nav.segs, s.x, r, C.ENEMY[s.type].w);
            ok(seg && R.has(seg.id), `${tag}: the ${s.type} at ${s.x},${s.y} lands on a reachable platform`);
        }
        // the air current: a jump from some reachable platform touches a bubble resting there
        const REACH = C.PLAYER.jumpV ** 2 / (2 * C.PLAYER.gravity);
        const air = L.air;
        const touch = C.BUBBLE.r + 0.72 - 0.3;
        const airOk = nav.segs.some((s) => {
            const [lo, hi] = Nv.standRange(s);
            const dx = Math.abs(Math.max(lo, Math.min(hi, air.x)) - air.x);
            return R.has(s.id) && dx < touch && s.r > air.y && (s.r - C.PLAYER.h / 2 - REACH) - air.y < Math.sqrt(touch * touch - dx * dx);
        });
        ok(airOk, `${tag}: a jump reaches the air current at ${air.x},${air.y}`);
        // the top gap: whatever drops through it lands
        if (!L.boss) {
            for (const x of [14.2, 16, 17.8]) {
                const b = { x, y: -0.5, w: 1.2, h: 1.2, vx: 0, vy: 0, ground: false };
                let t = 0;
                while (!b.ground && t < 10) { b.vy = Math.min(C.PLAYER.maxFall, b.vy + C.PLAYER.gravity * DT); Ph.moveBody(L, b, DT); t += DT; }
                ok(b.ground && !b.wrapped, `${tag}: loot dropping in at x=${x} lands without falling out again`);
            }
            const gapTop = [...Array(28)].map((_, i) => !Ph.solid(L, 2 + i, 0));
            const gapBot = [...Array(28)].map((_, i) => !Ph.solid(L, 2 + i, 25));
            ok(gapTop.every((g, i) => g === gapBot[i]), `${tag}: the ceiling and floor gaps line up`);
        }
    }
    console.log(`  ${Lv.LEVELS.length} sectors, ${reachedAll} fully connected`);
}

if (want('rules')) {
    section('rules');
    // ---- movement
    let G = playing(0);
    parkEnemies(G);
    const x0 = G.player.x;
    run(G, inp({ x: 1 }), 0.5);
    ok(Math.abs(G.player.x - (x0 + C.PLAYER.speed * 0.5)) < 0.15, 'walks at PLAYER.speed');
    G = playing(0); parkEnemies(G);
    let minY = 99;
    Gm.step(G, inp({ jump: true }), DT);
    run(G, NONE, 1.2, (g) => { minY = Math.min(minY, g.player.y); return false; });
    const h = C.PLAYER.startY - minY;
    ok(h > 4.5 && h < 5.0, `the jump is about 4.76 tiles (got ${h.toFixed(2)}): enough for platforms 4 rows apart`);
    G = playing(0); parkEnemies(G);
    G.player.x = 10;
    Gm.step(G, inp({ jump: true }), DT);
    run(G, NONE, 1.5, (g) => g.player.ground && g.player.y < 25);
    ok(G.player.ground && G.player.y === 21, 'jumping up through a platform lands on top of it');
    run(G, inp({ x: -1 }), 2);
    ok(G.player.y > 21, 'walking off its end drops you');
    G = playing(0); parkEnemies(G);
    run(G, inp({ x: -1 }), 1);
    ok(G.player.x >= C.LEFT + C.PLAYER.w / 2 - 1e-6, 'the side wall stops you');
    G = playing(0); parkEnemies(G);
    G.player.x = 16; G.player.y = 25; G.player.ground = false;
    let wrapped = false;
    run(G, NONE, 3, (g) => { if (g.player.y < 3) wrapped = true; return wrapped && g.player.ground; });
    ok(wrapped && G.player.ground && G.player.y === 9, 'falling out of the bottom gap drops you back in at the top');

    // ---- bubbles
    G = playing(0); parkEnemies(G);
    Gm.step(G, inp({ fire: true, fireP: true }), DT);
    let b = G.bubbles[0];
    ok(b && b.mode === 'shot' && has(G, 'blow'), 'the action button blows a bubble');
    run(G, NONE, 0.5);
    ok(b.mode === 'float' && Math.abs(b.x - (C.PLAYER.startX + 0.9 + C.BUBBLE.range)) < 0.6, 'it dashes BUBBLE.range then floats');
    const by = b.y;
    run(G, NONE, 3);
    ok(b.y < by - 3 && Math.abs(b.x - Lv.buildLevel(0).air.x) < Math.abs(C.PLAYER.startX + 6 - 16), 'floating bubbles rise and drift to the air current');
    run(G, NONE, C.BUBBLE.emptyLife);
    ok(!G.bubbles.includes(b) && has(G, 'fizz'), 'an empty bubble pops by itself in time');

    // trap, escape angry
    G = playing(0);
    let e = G.enemies[0];
    for (const o of G.enemies.slice(1)) { o.x = 28; o.y = 2.5; o.st = 'trap'; }
    e.x = 8; e.y = 25; e.ground = true; e.vx = 0; e.face = -1;
    G.player.x = 4; G.player.y = 25;
    e.think = 99;
    Gm.step(G, inp({ fire: true, fireP: true }), DT);
    run(G, NONE, 0.4);
    ok(e.st === 'trap' && G.events.some((q) => q.type === 'trap'), 'a blown bubble traps an enemy it hits');
    G.player.x = 4;
    run(G, NONE, C.BUBBLE.trapTime + 0.2, (g) => e.st === 'live');
    ok(e.st === 'live' && e.mad && has(G, 'escape'), `a trapped enemy breaks out after ${C.BUBBLE.trapTime} s, angry`);
    ok(Gm.angryNow(G, e), 'and an angry enemy is faster');

    // pop → loot; chain of three
    G = playing(0);
    for (const o of G.enemies) o.st = 'trap';
    const trapped = G.enemies.slice(0, 3).map((q, i) => {
        const bb = { id: G.nextId++, kind: 'plain', mode: 'float', x: 10 + i * 1.95, y: 22, vx: 0, vy: 0, r: C.BUBBLE.r * 1.08, t: 1, enemy: q.id, trapT: 0 };
        q.bubble = bb.id;
        G.bubbles.push(bb);
        return q;
    });
    G.enemies[3].st = 'trap'; G.enemies[3].x = 28; G.enemies[3].y = 3;
    Gm.popChain(G, G.bubbles[0]);
    ok(trapped.every((q) => q.st === 'dead'), 'popping one bubble pops every bubble touching it');
    ok(trapped.map((q) => q.value).join() === '500,1000,2000', `the loot doubles along a chain (${trapped.map((q) => q.value).join(', ')})`);
    ok(G.events.some((q) => q.type === 'chain' && q.n === 3), 'and a chain of three is announced');
    run(G, NONE, 4);
    ok(G.items.length === 3 && G.items.some((it) => it.kind === 'cone' && it.value === 2000), 'popped enemies come down as loot');
    const s0 = G.score;
    const it = G.items[0];
    G.player.x = it.x; G.player.y = Math.round(it.y); G.player.ground = Ph.supported(Lv.buildLevel(0), it.x, Math.round(it.y), 1.5);
    run(G, NONE, 0.1);
    ok(G.score === s0 + it.value && has(G, 'item'), 'walking into loot scores it');

    // bouncing
    for (const hold of [true, false]) {
        G = playing(0); parkEnemies(G);
        // columns 2–3 of the first sector are open all the way down
        G.bubbles.push({ id: 999, kind: 'plain', mode: 'float', x: 3.1, y: 18.5, vx: 0, vy: 0, r: C.BUBBLE.r, t: 2, enemy: null, trapT: 0 });
        G.player.x = 3.1; G.player.y = 15.5; G.player.ground = false; G.player.vy = 3;
        let bounced = false;
        run(G, inp({ jump: hold }), 0.5, (g) => { if (g.player.vy < -10) bounced = true; return bounced || !g.bubbles.length; });
        if (hold) ok(bounced && G.bubbles.length === 1 && has(G, 'bounce'), 'landing on a bubble holding jump bounces off it');
        else ok(!bounced && !G.bubbles.length, 'landing on it without jump held pops it');
    }

    // ---- letters, EXTEND, extra lives
    G = playing(2);
    G.letters = [true, true, true, true, true, false];
    const lives0 = G.lives;
    G.bubbles.push({ id: 998, kind: 'letter', letter: 5, mode: 'float', x: G.player.x, y: G.player.y - 1, vx: 0, vy: 0, r: C.BUBBLE.r, t: 1, enemy: null, trapT: 0 });
    run(G, NONE, DT * 2);
    ok(G.lives === lives0 + 1 && has(G, 'extend') && G.phase === 'extend' && !G.enemies.length, 'N-E-B-U-L-A: an extra life, and the sector is skipped');
    run(G, NONE, C.TIMING.extend + C.TIMING.warp + 0.1);
    ok(G.level === 3 && G.letters.every((v) => !v), 'EXTEND warps to the next sector and the letters reset');
    G = playing(0);
    const l0 = G.lives;
    Gm.addScore(G, 20000);
    ok(G.lives === l0 + 1 && has(G, 'life'), 'an extra life at 20 000');
    Gm.addScore(G, 40000);
    Gm.addScore(G, 100000);
    ok(G.lives === l0 + 3, 'and at 60 000 and 160 000');

    // ---- hurry, the wraith, dying, game over, continue
    G = playing(0);
    for (const q of G.enemies) { q.st = 'trap'; q.x = 28; q.y = 3; }
    run(G, NONE, Lv.buildLevel(0).hurry + 0.3, (g) => g.hurry);
    ok(G.hurry && has(G, 'hurry'), 'HURRY UP! after the sector\'s hurry time');
    ok(Gm.angryNow(G, G.enemies[0]), 'and the crew turns angry');
    run(G, NONE, C.TIMING.wraithAfter + 0.2, (g) => !!g.wraith);
    ok(!!G.wraith && has(G, 'wraith'), `the Void Wraith comes ${C.TIMING.wraithAfter} s later`);
    const lv = G.lives;
    run(G, NONE, 20, (g) => g.player.state === 'dead');
    ok(G.player.state === 'dead' && G.events.some((q) => q.type === 'die' && q.cause === 'wraith'), 'it goes through walls and kills');
    run(G, NONE, C.PLAYER.dieTime + 0.1);
    ok(G.player.state === 'alive' && G.lives === lv - 1 && !G.wraith && !G.hurry && G.player.inv > 0, 'you respawn at the start, the Wraith is gone, the clock eases off');
    G.lives = 0;
    G.player.inv = 0;
    Gm.killPlayer(G, 'test');
    run(G, NONE, C.PLAYER.dieTime + 0.1);
    ok(G.over && has(G, 'over'), 'dying with no lives left is GAME OVER');
    Gm.addScore(G, 3000);
    Gm.continueGame(G);
    ok(!G.over && G.score === 0 && G.lives === 2 && G.level === 0 && G.phase === 'intro' && G.continues === 1, 'a continue restarts the sector with the score at zero');

    // enemies kill on touch; a frozen one doesn't
    G = playing(0);
    for (const q of G.enemies.slice(1)) { q.st = 'trap'; q.x = 28; q.y = 3; }
    e = G.enemies[0];
    e.x = G.player.x + 0.5; e.y = G.player.y; e.think = 99;
    G.freezeT = 2;
    run(G, NONE, 0.2);
    ok(G.player.state === 'alive', 'a frozen enemy is harmless');
    G.freezeT = 0;
    run(G, NONE, 0.1);
    ok(G.player.state === 'dead', 'a live enemy kills on touch');

    // ---- zap, nova
    G = playing(4);
    for (const q of G.enemies) { q.st = 'trap'; q.x = 28; q.y = 3; }
    e = G.enemies[0];
    Object.assign(e, { st: 'live', x: 20, y: 25, ground: true, think: 99, vx: 0 });
    G.player.face = 1;
    G.bubbles.push({ id: 997, kind: 'zap', mode: 'float', x: 8, y: 24, vx: 0, vy: 0, r: C.BUBBLE.r, t: 1, enemy: null, trapT: 0 });
    Gm.popChain(G, G.bubbles.find((q) => q.id === 997));
    ok(G.bolts.length === 1 && has(G, 'zap'), 'a zap bubble fires a bolt the way you face');
    run(G, NONE, 1);
    ok(e.st === 'dead' && e.value === C.SCORE.zap[0], 'the bolt fries what it crosses, for 1000');
    G = playing(7);
    for (const q of G.enemies) { q.st = 'trap'; q.x = 28; q.y = 3; }
    e = G.enemies[0];
    Object.assign(e, { st: 'live', x: 7, y: 21, ground: true, think: 99, vx: 0, face: 1 });
    e.freezeMe = true;
    G.bubbles.push({ id: 996, kind: 'nova', mode: 'float', x: 6, y: 15, vx: 0, vy: 0, r: C.BUBBLE.r, t: 1, enemy: null, trapT: 0 });
    Gm.popChain(G, G.bubbles.find((q) => q.id === 996));
    run(G, NONE, 1.5, (g) => g.flames.length > 0);
    ok(G.flames.length > 1 && has(G, 'nova'), 'a nova bubble drops a fireball that spreads flames along the platform');
    run(G, NONE, 0.6);
    ok(e.st === 'dead', 'the flames burn the crew');
    G.player.x = G.flames[0].c + 0.5; G.player.y = G.flames[0].r; G.player.ground = true; G.player.inv = 0;
    run(G, NONE, 0.3);
    ok(G.player.state === 'alive' && G.player.stun > 0 && has(G, 'burn'), 'and only stun you');

    // ---- power-ups
    const power = (kind, level = 0) => {
        const g = playing(level);
        g.items.push({ id: 995, kind: 'p:' + kind, value: 0, x: g.player.x, y: g.player.y, vx: 0, vy: 0, w: 1.2, h: 1.2, ground: true, t: 0 });
        Gm.step(g, NONE, DT);
        return g;
    };
    G = power('boots'); parkEnemies(G);
    const bx = G.player.x;
    run(G, inp({ x: 1 }), 0.5);
    ok(G.player.powers.boots && G.player.x - bx > C.PLAYER.speed * 0.5 * 1.2, 'Rocket Boots: faster');
    G = power('long'); parkEnemies(G);
    Gm.step(G, inp({ fire: true, fireP: true }), DT);
    run(G, NONE, 0.8);
    ok(G.bubbles[0].x > C.PLAYER.startX + C.BUBBLE.longRange, 'Long Shot: bubbles fly further');
    G = power('rapid'); parkEnemies(G);
    run(G, inp({ fire: true, fireP: true }), 0.6);
    ok(G.bubbles.length >= 4, `Rapid Blower: blow faster (${G.bubbles.length} in 0.6 s)`);
    G = power('clock');
    ok(G.freezeT > 0, 'Stasis Clock: time stops for the crew');
    G = power('bomb');
    ok(G.enemies.every((q) => q.st === 'dead') && has(G, 'bomb'), 'Supernova: pops every enemy');
    G = power('warp', 2);
    run(G, NONE, C.TIMING.warp + 0.1);
    ok(G.level === 6, 'Wormhole: skips three sectors');
    G = playing(0);
    run(G, NONE, C.TIMING.powerAt[1] + 0.2);
    ok(G.powerDone, 'a power-up has its chance to appear in every sector');

    // ---- clearing and the warp
    G = playing(1);
    for (const q of G.enemies) Gm.popChain(G, (() => { const bb = { id: G.nextId++, kind: 'plain', mode: 'float', x: 6, y: 3, vx: 0, vy: 0, r: 1, t: 1, enemy: q.id, trapT: 0 }; q.st = 'trap'; q.bubble = bb.id; G.bubbles.push(bb); return bb; })());
    run(G, NONE, 4, (g) => g.phase === 'clear');
    ok(G.phase === 'clear' && has(G, 'clear') && has(G, 'quick'), 'the last enemy down clears the sector (with a quick-clear bonus)');
    run(G, NONE, C.TIMING.clearMax + C.TIMING.warp + 0.1);
    ok(G.level === 2 && G.phase === 'intro' && has(G, 'level'), 'and warps to the next one');

    // ---- the Baron
    G = playing(Lv.LAST);
    ok(!!G.boss && G.boss.st === 'live' && G.boss.hp === C.BOSS.hp, `the last sector is the Void Baron (${C.BOSS.hp} hp)`);
    run(G, NONE, 4);
    ok(G.bubbles.some((q) => q.kind === 'zap'), 'zap bubbles rise in his core');
    ok(G.shots.some((s) => s.kind === 'orb'), 'he throws void orbs');
    G.player.inv = 999;
    for (let k = 0; k < C.BOSS.hp; k++) {
        const zb = { id: G.nextId++, kind: 'zap', mode: 'float', x: 4, y: 12, vx: 0, vy: 0, r: 1, t: 1, enemy: null, trapT: 0 };
        G.bubbles.push(zb);
        Gm.popChain(G, zb);
        run(G, NONE, 1.6, (g) => !g.bolts.length);
    }
    ok(G.boss.st === 'trap' && has(G, 'bossTrap') && G.bubbles.some((q) => q.kind === 'boss'), 'a bolt aims at him; at zero he is caught in a giant bubble');
    Gm.popChain(G, G.bubbles.find((q) => q.kind === 'boss'));
    run(G, NONE, 6, (g) => g.items.some((i) => i.kind === 'heart'));
    const heart = G.items.find((i) => i.kind === 'heart');
    ok(!!heart && !G.boss, 'popping it sends him spinning off, and he leaves the Nebula Heart');
    G.player.x = heart.x; G.player.y = heart.y; G.player.state = 'alive';
    const sh = G.score;
    run(G, NONE, 0.1);
    ok(G.won && G.over && has(G, 'ending') && G.score >= sh + C.SCORE.heart, 'the Heart ends the game, won');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); run(G, (g) => Bt.botInput(g, b), secs); return G; };
    const a = play(42, 90), b2 = play(42, 90);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b2)), 'same seed and inputs, same game');

    // a save mid-sector, with bubbles, trapped enemies and loot about, plays on identically
    for (const at of [9, 23, 41]) {
        const G = Gm.newGame(7, { lives: 99 });
        const bot = Bt.makeBot({ seed: 3 });
        run(G, (g) => Bt.botInput(g, bot), at);
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        // the bot's own state is not part of the game: both continue with identical fresh bots
        const b1 = Bt.makeBot({ seed: 5 }), b3 = Bt.makeBot({ seed: 5 });
        run(G, (g) => Bt.botInput(g, b1), 30);
        run(copy, (g) => Bt.botInput(g, b3), 30);
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save round trip at ${at} s plays on identically (sector ${G.level + 1}, ${G.bubbles.length} bubbles)`);
    }
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    threw = false;
    try { Gm.deserialize({ ...Gm.serialize(Gm.newGame(1)), level: 99 }); } catch { threw = true; }
    ok(threw, 'a save pointing past the last sector is rejected');
}

if (want('bot')) {
    section('bot');
    const NAMES = Lv.LEVELS.map((l) => l.name);
    const table = (skill) => {
        const T = NAMES.map(() => ({ n: 0, time: 0, deaths: 0 }));
        const runs = [];
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 7919, { lives: 999 });
            const bot = Bt.makeBot({ skill, seed: s });
            let bad = null;
            while (!G.over && G.t < 2400 && !bad) {
                Gm.step(G, Bt.botInput(G, bot), DT);
                G.events.length = 0;
                const p = G.player;
                if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) bad = 'non-finite player';
                else if (p.x < C.LEFT || p.x > C.RIGHT) bad = 'player outside the walls';
                else if (G.enemies.some((e) => !Number.isFinite(e.x) || !Number.isFinite(e.y))) bad = 'non-finite enemy';
                else if (G.bubbles.some((b) => !Number.isFinite(b.x) || b.x < C.LEFT || b.x > C.RIGHT)) bad = 'a bubble left the field';
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            ok(G.won, `seed ${s} skill ${skill}: the bot beats the Baron (${(G.t / 60).toFixed(1)} min, ${G.stats.deaths} deaths)`);
            for (const l of G.log) { const r = T[l.level]; r.n++; r.time += l.time; r.deaths += l.deaths; }
            runs.push({ won: G.won, t: G.t, deaths: G.stats.deaths, score: G.score, chain: G.stats.bestChain, letters: G.stats.letters });
        }
        return { T, runs };
    };
    const A = table(1), B = table(0.6);
    console.log('\n  sector                 time(s) deaths   time(s) deaths');
    console.log('                         skill 1          skill 0.6');
    const avg = (r, k) => (r.n ? r[k] / r.n : 0);
    NAMES.forEach((name, i) => console.log(`  ${String(i + 1).padStart(2)} ${name.padEnd(18)} ${avg(A.T[i], 'time').toFixed(0).padStart(6)} ${avg(A.T[i], 'deaths').toFixed(2).padStart(6)}   ${avg(B.T[i], 'time').toFixed(0).padStart(6)} ${avg(B.T[i], 'deaths').toFixed(2).padStart(6)}`));
    const sum = (R, k) => R.runs.reduce((a, r) => a + r[k], 0) / R.runs.length;
    console.log(`  campaign: skill 1 ${(sum(A, 't') / 60).toFixed(1)} min, ${sum(A, 'deaths').toFixed(1)} deaths, score ${Math.round(sum(A, 'score'))}, best chain ${Math.max(...A.runs.map((r) => r.chain))}`);
    console.log(`            skill 0.6 ${(sum(B, 't') / 60).toFixed(1)} min, ${sum(B, 'deaths').toFixed(1)} deaths, score ${Math.round(sum(B, 'score'))}`);
    const normal = (R) => R.T.slice(0, Lv.LAST).reduce((a, r) => a + r.deaths, 0) / Math.max(1, R.T.slice(0, Lv.LAST).reduce((a, r) => a + r.n, 0));
    ok(normal(A) < 1.6, `the perfect bot dies less than 1.6 times a sector (${normal(A).toFixed(2)})`);
    ok(sum(A, 'deaths') < sum(B, 'deaths'), 'a better bot dies less');
    const bossT = avg(A.T[Lv.LAST], 'time');
    ok(bossT > 40 && bossT < 180, `the Baron takes the perfect bot 40–180 s (${bossT.toFixed(0)} s)`);
    const slow = NAMES.slice(0, Lv.LAST).map((n, i) => [n, avg(A.T[i], 'time')]).filter(([, t]) => t > 75);
    ok(!slow.length, `no sector takes the perfect bot more than 75 s on average${slow.length ? ': ' + slow.map(([n, t]) => `${n} ${t.toFixed(0)} s`).join(', ') : ''}`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
