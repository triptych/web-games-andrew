/**
 * simtest.mjs — headless checks of STARBLAZER '86's simulation. No browser.
 *
 *   node game-109/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-109/dev/simtest.mjs
 *   SEEDS=8 VERBOSE=1 node game-109/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the
 *    clock, and never import the view, UI, audio or input.
 * 2. rules: moving, walls, shooting, hits and scoring, lives, shields, bombs, every power-up, chains,
 *    extra lives, the wave cycle, the bonus stage (nothing fires), formations that dive and return,
 *    mines, the game ending.
 * 3. waves: the planner over 60 waves and several seeds: every order is valid and starts off screen,
 *    new pieces unlock on schedule, bosses and bonus stages fall where they should, and a bot that
 *    cannot be hurt clears every one of waves 1-40 in a sane time (nothing is unwinnable or stuck).
 * 4. bosses: each boss enters untouchable, fights in phases, can be killed, blows up in a chain,
 *    pays out and hands over to the next wave.
 * 5. hangar: credits earned, the flight to the mothership after a boss, buying every upgrade and supply
 *    (price, limits, effect), upgrades surviving death, launching, saves in the hangar, the bot spending.
 * 6. determinism: the same seed and inputs give the same game; a save round trip, mid-game, mid-boss
 *    and mid-formation, plays on identically.
 * 7. bots: whole games at three skills with per-step invariants, and the balance table.
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
const Bt = await import('../js/sim/bot.js');
const En = await import('../js/sim/enemies.js');
const Wv = await import('../js/sim/waves.js');
const Bs = await import('../js/sim/bosses.js');
const Up = await import('../js/sim/upgrades.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP, W = C.FIELD.w, H = C.FIELD.h;
const NONE = { x: 0, y: 0, fire: false, bomb: false };
const has = (G, type) => G.events.some((e) => e.type === type);
const run = (G, inp, secs, each) => { for (let t = 0; t < secs && !G.over; t += DT) { Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); each?.(G); } };
/** A game already in the fight phase of wave n with nothing on screen. */
const fightAt = (seed, n) => {
    const G = Gm.newGame(seed);
    Gm.jumpToWave(G, n);
    G.events.length = 0;
    run(G, NONE, 4);                       // through the intro
    G.events.length = 0;
    return G;
};
const clearField = (G) => { G.enemies.length = 0; G.ebullets.length = 0; G.pbullets.length = 0; G.powerups.length = 0; G.plan.idx = G.plan.orders.length; };

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|AudioContext/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('rules')) {
    section('rules');
    let G = Gm.newGame(1);
    ok(G.lives === C.PLAYER.lives && G.bombs === C.PLAYER.bombs, 'a new game starts with the right lives and bombs');
    ok(G.wave === 1 && G.phase === 'intro' && has(G, 'wave'), 'it opens on wave 1 with an intro and a wave event');
    ok(G.player.alive && G.player.inv > 0, 'the ship starts invulnerable for a moment');

    // moving
    G = fightAt(2, 1); clearField(G);
    const x0 = G.player.x;
    run(G, { x: 1, y: 0 }, 0.5);
    ok(Math.abs(G.player.x - (x0 + C.PLAYER.speed * 0.5)) < 0.2, 'moves right at PLAYER.speed');
    run(G, { x: 1, y: 0 }, 5);
    ok(G.player.x <= W - C.PLAYER.margin + 1e-9, 'stops at the right wall');
    run(G, { x: 0, y: -1 }, 5);
    ok(G.player.y >= C.PLAYER.minY - 1e-9, 'cannot climb above the lowest part of the sky');
    run(G, { x: 0, y: 1 }, 5);
    ok(G.player.y <= H - C.PLAYER.margin, 'stops at the bottom');
    run(G, { x: 1, y: 1 }, 0.1);
    ok(Math.hypot(G.player.vx, G.player.vy) <= C.PLAYER.speed + 1e-6, 'diagonals are no faster');
    G.player.speed = 3;
    run(G, { x: -1, y: 0 }, 0.05);
    ok(Math.abs(G.player.vx) > C.PLAYER.speed + 30, 'speed power-ups make the ship faster');

    // shooting
    G = fightAt(3, 1); clearField(G);
    Gm.step(G, { ...NONE, fire: true }, DT);
    ok(G.pbullets.length === 1 && has(G, 'shoot'), 'firing makes one bullet and a shoot event');
    run(G, { ...NONE, fire: true }, 1);
    const rate = G.stats.shots;
    ok(rate >= 6 && rate <= 8, `held fire at level 1 shoots about 1/0.15 s (${rate} shots in a second)`);
    for (let w = 1; w <= 5; w++) {
        G = fightAt(3, 1); clearField(G); G.player.weapon = w;
        Gm.step(G, { ...NONE, fire: true }, DT);
        ok(G.pbullets.length === [0, 1, 2, 3, 5, 7][w], `weapon level ${w} fires ${[0, 1, 2, 3, 5, 7][w]} bullets`);
    }
    G = fightAt(3, 1); clearField(G); G.player.weapon = 5;
    run(G, { ...NONE, fire: true }, 3);
    ok(G.pbullets.length < 60, 'player bullets are cleared off the top of the screen');

    // hitting things and scoring
    G = fightAt(4, 3); clearField(G); G.chain = 0;
    const drone = En.addEnemy(G, 'drone', { path: En.linePath(112, 100, 0, 0), peace: true });
    G.plan.total = 1;
    G.pbullets.push({ x: 112, y: 100, vx: 0, vy: 0, dmg: 1, pierce: 0, k: 0 });
    Gm.step(G, NONE, DT);
    ok(drone.dead && G.score === 100, 'a bullet kills a drone for 100');
    ok(has(G, 'boom') && has(G, 'kill') && has(G, 'popup'), '... with boom, kill and popup events');
    G = fightAt(4, 8); clearField(G);
    const cr = En.addEnemy(G, 'cruiser', { path: En.linePath(112, 100, 0, 0) });
    const hp0 = cr.hp;
    G.pbullets.push({ x: 112, y: 100, vx: 0, vy: 0, dmg: 3, pierce: 0, k: 0 });
    Gm.step(G, NONE, DT);
    ok(cr.hp === hp0 - 3 && !cr.dead && has(G, 'ehit'), 'a tougher enemy takes damage and survives a hit');
    ok(!G.pbullets.length, 'a bullet is used up by what it hits');
    G.pbullets.push({ x: 112, y: 100, vx: 0, vy: 0, dmg: 1, pierce: 2, k: 2 });
    const d2 = En.addEnemy(G, 'drone', { path: En.linePath(112, 100, 0, 0) });
    Gm.step(G, NONE, DT);
    ok(d2.dead && G.pbullets.length === 1, 'a piercing bullet goes on through what it kills');

    // the chain multiplier
    G = fightAt(5, 3); clearField(G); G.plan.total = 99;
    const killDrone = () => { const e = En.addEnemy(G, 'drone', { path: En.linePath(112, 100, 0, 0), peace: true }); G.pbullets.push({ x: 112, y: 100, vx: 0, vy: 0, dmg: 9, pierce: 0, k: 0 }); Gm.step(G, NONE, DT); return e; };
    G.score = 0;
    for (let i = 0; i < 6; i++) killDrone();
    ok(Gm.multiplier(G) === 2, 'six kills in a row double the score');
    const before = G.score; killDrone();
    ok(G.score - before === 200, 'the multiplied score is awarded (100 x2)');
    run(G, NONE, C.SCORE.chainWindow + 0.1);
    ok(G.chain === 0 && Gm.multiplier(G) === 1, 'the chain runs out');

    // dying
    G = fightAt(6, 3); clearField(G); G.player.inv = 0; G.player.weapon = 4; G.medal = 3;
    G.ebullets.push({ x: G.player.x, y: G.player.y, vx: 0, vy: 0, k: 0 });
    Gm.step(G, NONE, DT);
    ok(!G.player.alive && G.lives === C.PLAYER.lives - 1 && has(G, 'pdie'), 'an enemy bullet costs a life');
    ok(G.player.weapon === 2 && G.medal === 0, 'dying drops the gun two levels and resets the medals');
    run(G, NONE, C.PLAYER.respawn + 0.1);
    ok(G.player.alive && G.player.inv > 1 && has(G, 'respawn'), 'the ship comes back, invulnerable');
    G.ebullets.push({ x: G.player.x, y: G.player.y, vx: 0, vy: 0, k: 0 });
    Gm.step(G, NONE, DT);
    ok(G.player.alive, 'an invulnerable ship is not hurt');
    G = fightAt(6, 3); clearField(G); G.player.inv = 0; G.player.shield = 1;
    G.ebullets.push({ x: G.player.x, y: G.player.y, vx: 0, vy: 0, k: 0 });
    Gm.step(G, NONE, DT);
    ok(G.player.alive && !G.player.shield && has(G, 'shieldbreak'), 'a shield takes one hit');
    G = fightAt(6, 3); clearField(G); G.player.inv = 0;
    En.addEnemy(G, 'drone', { path: En.linePath(G.player.x, G.player.y, 0, 0) });
    Gm.step(G, NONE, DT);
    ok(!G.player.alive, 'ramming an enemy is fatal');
    G = fightAt(6, 3); clearField(G); G.player.inv = 0;
    G.ebullets.push({ x: G.player.x + 14, y: G.player.y, vx: 0, vy: 0, k: 0 });
    Gm.step(G, NONE, DT);
    ok(G.player.alive, 'a bullet 14 px away misses (the hit box is small)');

    // game over
    G = fightAt(7, 3); clearField(G); G.lives = 1; G.player.inv = 0;
    G.ebullets.push({ x: G.player.x, y: G.player.y, vx: 0, vy: 0, k: 0 });
    Gm.step(G, NONE, DT);
    ok(G.lives === 0 && !G.over && G.endT > 0, 'the last ship goes, then there is a pause');
    run(G, NONE, 3);
    ok(G.over && has(G, 'over'), 'then the game is over');
    const t = G.t; Gm.step(G, NONE, DT);
    ok(G.t === t, 'a finished game no longer steps');

    // bombs
    G = fightAt(8, 6); clearField(G);
    for (let i = 0; i < 8; i++) G.ebullets.push({ x: 40 + i * 20, y: 150, vx: 0, vy: 30, k: 0 });
    const sa = En.addEnemy(G, 'saucer', { path: En.linePath(112, 140, 0, 0) });
    const far = En.addEnemy(G, 'cruiser', { path: En.linePath(30, 30, 0, 0) });
    const farHp = far.hp;
    G.player.y = 240; G.player.x = 112;
    Gm.step(G, { ...NONE, bomb: true }, DT);
    ok(G.bombs === C.PLAYER.bombs - 1 && G.bombFx && has(G, 'bomb'), 'a bomb costs one and starts a ring');
    run(G, NONE, 0.8);
    ok(G.ebullets.length === 0, 'the ring wipes the enemy bullets');
    ok(sa.dead, 'it destroys a saucer inside its reach');
    ok(far.hp === farHp || far.hp > farHp - C.BOMB.dmg * 2, 'it hurts a distant cruiser at most once');
    run(G, NONE, 0.5);
    ok(G.bombFx === null, 'the ring ends');
    G = fightAt(8, 6); clearField(G); G.bombs = 0;
    Gm.step(G, { ...NONE, bomb: true }, DT);
    ok(!G.bombFx, 'no bomb without a bomb');

    // power-ups
    const collectKind = (kind, setup) => {
        const g = fightAt(9, 3); clearField(g); setup?.(g);
        g.powerups.push({ x: g.player.x, y: g.player.y, vx: 0, vy: 0, kind, t: 0 });
        Gm.step(g, NONE, DT);
        return g;
    };
    ok(collectKind('P').player.weapon === 2, 'P raises the weapon');
    ok(collectKind('P', (g) => { g.player.weapon = 5; }).score === 1000, 'P at the maximum is worth 1000');
    ok(collectKind('S').player.speed === 1, 'S raises the speed');
    ok(collectKind('B').bombs === C.PLAYER.bombs + 1, 'B adds a bomb');
    ok(collectKind('B', (g) => { g.bombs = C.PLAYER.maxBombs; }).score === 500, 'B at the maximum is worth 500');
    ok(collectKind('H').player.shield === 1, 'H gives a shield');
    ok(collectKind('1').lives === C.PLAYER.lives + 1, '1 gives a life');
    {
        const g = fightAt(9, 3); clearField(g); g.score = 0;
        const vals = [];
        for (let i = 0; i < 5; i++) { g.powerups.push({ x: g.player.x, y: g.player.y, vx: 0, vy: 0, kind: 'M', t: 0 }); Gm.step(g, NONE, DT); }
        ok(g.score === 100 + 200 + 300 + 400 + 500, 'medals are worth more and more: 100, 200, 300, 400, 500');
    }
    G = fightAt(9, 3); clearField(G);
    G.powerups.push({ x: 100, y: H + 7, vx: 0, vy: 30, kind: 'P', t: 0 });
    run(G, NONE, 0.5);
    ok(G.powerups.length === 0, 'a power-up that falls off the bottom is gone');

    // extra lives
    G = fightAt(10, 3); clearField(G); G.score = C.SCORE.firstLife - 50; G.plan.total = 99;
    killDrone(); killDrone();
    ok(G.lives === C.PLAYER.lives + 1 && has(G, '1up'), `crossing ${C.SCORE.firstLife} gives an extra life`);
    ok(G.nextLife === C.SCORE.firstLife + C.SCORE.lifeEvery, '... and the next one is further off');

    // the wave cycle
    G = Gm.newGame(11);
    run(G, NONE, C.WAVE.intro + 0.1);
    ok(G.phase === 'fight', 'the intro gives way to the fight');
    G.player.inv = 1e9;
    run(G, { ...NONE, fire: true }, 25);
    ok(G.wave >= 1, 'a stationary ship still ends up somewhere sane');
    G = fightAt(11, 1); G.player.inv = 1e9;
    const b = Bt.makeBot();
    run(G, (g) => { g.player.inv = 1e9; return Bt.botInput(g, b); }, 60, (g) => { g.events.length = 0; });
    ok(G.wave >= 2, `the bot clears wave 1 and goes on (now wave ${G.wave})`);

    // mines
    G = fightAt(12, 12); clearField(G); G.plan.total = 99;
    const mine = En.addEnemy(G, 'mine', { path: En.linePath(112, 100, 0, 0) });
    G.pbullets.push({ x: 112, y: 100, vx: 0, vy: 0, dmg: 99, pierce: 0, k: 0 });
    Gm.step(G, NONE, DT);
    ok(mine.dead && G.ebullets.length === 8, 'a mine blows up into a ring of eight bullets');

    // a carried power-up
    G = fightAt(12, 3); clearField(G); G.plan.total = 99;
    En.addEnemy(G, 'drone', { path: En.linePath(112, 100, 0, 0), carry: 'S' });
    G.pbullets.push({ x: 112, y: 100, vx: 0, vy: 0, dmg: 9, pierce: 0, k: 0 });
    Gm.step(G, NONE, DT);
    ok(G.powerups.some((u) => u.kind === 'S'), 'an enemy that carries a capsule drops it');

    // formations: they hold, dive and come back
    G = fightAt(13, 3); G.player.inv = 1e9;
    G.player.x = 112;
    run(G, NONE, 14, (g) => { g.player.inv = 1e9; g.ebullets.length = 0; g.events.length = 0; });
    const form = G.enemies.filter((e) => e.ai === 'formation');
    ok(form.length >= 10 && form.every((e) => ['hold', 'dive', 'return', 'enter'].includes(e.st)), `a Galaga grid has settled (${form.length} enemies)`);
    ok(form.some((e) => e.st === 'dive' || e.st === 'return') || G.enemies.length < 12, 'some of it has dived by now');
    let sawReturn = false;
    run(G, NONE, 30, (g) => { g.player.inv = 1e9; g.ebullets.length = 0; g.events.length = 0; if (g.enemies.some((e) => e.st === 'return')) sawReturn = true; });
    ok(sawReturn, 'divers wrap round and return to their slots');
    ok(G.enemies.every((e) => e.x > -60 && e.x < W + 60 && e.y < H + 60), 'nothing is lost off the edges');
}

// ======================================================================
if (want('waves')) {
    section('waves');
    const planSeen = new Set();
    for (let seed = 1; seed <= 5; seed++) {
        const G = Gm.newGame(seed * 31);
        for (let n = 1; n <= 60; n++) {
            const plan = Wv.planWave(n, G);
            const kind = Wv.isBossWave(n) ? 'boss' : Wv.isBonusWave(n) ? 'bonus' : 'normal';
            if (plan.kind !== kind) { ok(false, `wave ${n} should be ${kind}, is ${plan.kind}`); continue; }
            let bad = null;
            for (const o of plan.orders) {
                if (o.type === 'boss') continue;
                if (!En.TYPES[o.type]) bad = `unknown type ${o.type}`;
                const p = o.props;
                if (p.path) {
                    for (const tt of [0, 0.5, 2, 6, 15]) { const [x, y] = En.pathPos(p.path, tt); if (!Number.isFinite(x) || !Number.isFinite(y)) bad = `non-finite path ${p.path.k}`; }
                    const [x0, y0] = En.pathPos(p.path, 0);
                    // nothing pops into the middle of the screen
                    if (x0 >= -2 && x0 <= W + 2 && y0 >= -2) bad = `${o.type} starts on screen at (${x0 | 0}, ${y0 | 0})`;
                } else if (p.ai === 'dart') { if (!(p.y < 0)) bad = 'dart starts on screen'; } else bad = 'no path and not a dart';
                if (p.ai === 'formation' && !(p.slot && p.slot.x > 20 && p.slot.x < W - 20)) bad = 'formation slot out of place';
            }
            if (plan.orders.some((o, i) => i && o.t < plan.orders[i - 1].t)) bad = 'orders not in time order';
            if (plan.total !== plan.orders.length) bad = 'total mismatch';
            ok(!bad, `seed ${seed} wave ${n} (${plan.kind}${plan.pieces.length ? ': ' + plan.pieces.join('+') : ''}) is valid${bad ? ' — ' + bad : ''}`);
            plan.pieces.forEach((p) => planSeen.add(p));
        }
    }
    ok(Object.keys(Wv.PIECES).every((p) => planSeen.has(p)), 'every piece appears somewhere in 60 waves');

    // pieces unlock on schedule, and the first wave to use one is built around it
    const first = {};
    for (let seed = 1; seed <= 12; seed++) {
        const G = Gm.newGame(seed * 77);
        for (let n = 1; n <= 12; n++) for (const p of Wv.planWave(n, G).pieces) first[p] = Math.min(first[p] ?? 99, n);
    }
    for (const [id, p] of Object.entries(Wv.PIECES)) ok(first[id] === undefined || first[id] >= p.min, `${id} never appears before wave ${p.min}`);
    const featured = { 1: 'lineS', 2: 'vee', 3: 'formation', 6: 'saucers', 7: 'rain', 8: 'cruiser', 11: 'carrier', 12: 'mines' };
    for (const [n, id] of Object.entries(featured)) {
        let all = true;
        for (let seed = 1; seed <= 8; seed++) all &&= Wv.planWave(+n, Gm.newGame(seed)).pieces.includes(id);
        ok(all, `wave ${n} always features ${id}`);
    }
    ok(Wv.bossFor(5).idx === 0 && Wv.bossFor(10).idx === 1 && Wv.bossFor(15).idx === 2 && Wv.bossFor(20).idx === 0 && Wv.bossFor(20).cycle === 1, 'the three bosses come round in turn, tougher each time');
    ok(Bs.bossProps(Gm.newGame(1), 1, 1).hp > Bs.bossProps(Gm.newGame(1), 1, 0).hp, 'a repeat boss has more health');

    // difficulty ramps
    const gA = Gm.newGame(1), gB = Gm.newGame(1);
    gA.diff = 0; gB.diff = 30;
    ok(En.addEnemy(gB, 'cruiser', {}).hp > En.addEnemy(gA, 'cruiser', {}).hp, 'enemies get tougher with the waves');
    ok(En.addEnemy(gB, 'drone', {}).hp > En.addEnemy(gA, 'drone', {}).hp, '... even the drones');

    // wave 1 is gentle: nothing shoots; and the bonus stage is peaceful
    {
        const G = fightAt(21, 1); G.player.inv = 1e9; let shots = 0, bullets = 0;
        run(G, NONE, 40, (g) => { if (g.wave !== 1) return; shots += g.events.filter((e) => e.type === 'eshot').length; bullets += g.ebullets.length; g.events.length = 0; });
        ok(G.wave >= 2, 'wave 1 ends by itself (enemies that get away end it too)');
        ok(shots === 0 && bullets === 0, 'nothing shoots on wave 1');
    }
    {
        const G = fightAt(22, 9); G.player.inv = 1e9; let shots = 0, bullets = 0, kinds = new Set();
        ok(G.plan.kind === 'bonus', 'wave 9 is a bonus stage');
        run(G, NONE, 40, (g) => { if (g.wave !== 9) return; shots += g.events.filter((e) => e.type === 'eshot').length; bullets += g.ebullets.length; g.events.length = 0; g.enemies.forEach((e) => kinds.add(e.type)); });
        ok(shots === 0 && bullets === 0, 'nothing shoots in a bonus stage');
        ok(kinds.size === 1 && kinds.has('drone'), 'a bonus stage is all drones');
    }
    // a perfect bonus stage is worth 10000 and a bomb
    {
        const G = fightAt(23, 4); G.player.inv = 1e9; const bomb0 = G.bombs; G.score = 0;
        const bot = Bt.makeBot();
        let info = null;
        run(G, (g) => { g.player.inv = 1e9; return Bt.botInput(g, bot); }, 80, (g) => { for (const e of g.events) if (e.type === 'waveclear') info = e; g.events.length = 0; });
        ok(info && info.kind === 'bonus', 'the bot finishes the bonus stage');
        console.log(`  bonus stage: ${info?.killed}/${info?.total} hit, perfect=${info?.perfect}`);
        if (info?.perfect) ok(G.score >= C.SCORE.bonusPerfect && G.bombs === bomb0 + 1, 'a perfect stage pays 10000 and a bomb');
    }

    // every wave 1..40 can be cleared by a bot that cannot be hurt, in a sane time
    const slow = [];
    for (let n = 1; n <= 40; n++) {
        const G = fightAt(100 + n, n), bot = Bt.makeBot();
        G.player.weapon = Math.min(5, 1 + Math.floor(n / 3));          // what a player would have by now
        const limit = Wv.isBossWave(n) ? 400 : 160;
        let t = 0;
        while (G.wave === n && t < limit) {
            G.player.inv = 1e9;
            Gm.step(G, Bt.botInput(G, bot), DT);
            G.events.length = 0;
            t += DT;
            if (G.over) break;
        }
        const cleared = G.wave > n;
        if (!cleared || t > limit * 0.75) slow.push(`${n}:${t.toFixed(0)}s`);
        ok(cleared, `wave ${n} (${G.wave > n ? 'cleared' : 'NOT cleared'} in ${t.toFixed(0)}s)`);
    }
    if (slow.length) console.log('  slow or stuck:', slow.join(' '));
}

// ======================================================================
if (want('bosses')) {
    section('bosses');
    for (const [n, name] of [[5, 'Mothership'], [10, 'Crab Warden'], [15, 'Overlord'], [20, 'Mothership again']]) {
        const G = Gm.newGame(40 + n);
        Gm.jumpToWave(G, n);
        const seenEv = new Set();
        run(G, NONE, C.WAVE.bossIntro + 0.2, (g) => g.events.forEach((e) => seenEv.add(e.type)));
        const boss = G.enemies.find((e) => e.boss);
        ok(boss && boss.boss.st === 'enter' && boss.inv, `${name}: it arrives untouchable`);
        const bi = boss.boss.idx, hpFull = boss.maxHp;
        G.pbullets.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, dmg: 50, pierce: 0, k: 0 });
        Gm.step(G, NONE, DT);
        ok(boss.hp === hpFull, `${name}: shots pass through it while it enters`);
        run(G, NONE, 3);
        ok(boss.boss.st === 'fight' && !boss.inv, `${name}: then it fights`);
        // it attacks
        G.player.inv = 1e9; let bullets = 0;
        run(G, NONE, 8, (g) => { bullets += g.ebullets.length; });
        ok(bullets > 0, `${name}: it fires bullets`);
        if (bi === 2) {
            let beam = false;
            run(G, NONE, 30, (g) => { if (g.enemies[0]?.beam?.on) beam = true; });
            ok(beam, `${name}: it fires its beam`);
        }
        // phases: bullets in a given time rise as it is hurt
        boss.hp = Math.round(hpFull * 0.2);
        run(G, NONE, 10);
        // kill it
        G.enemies.find((e) => e.boss).hp = 1;
        G.pbullets.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, dmg: 5, pierce: 0, k: 0 });
        G.player.inv = 1e9;
        const evs = [];
        Gm.step(G, NONE, DT);
        ok(boss.boss.st === 'dying' && G.ebullets.length === 0, `${name}: it dies, and the bullets with it`);
        let booms = 0, down = false;
        run(G, NONE, 3.2, (g) => { for (const e of g.events) { evs.push(e.type); if (e.type === 'boom') booms++; if (e.type === 'bossdown') down = true; } g.events.length = 0; });
        ok(booms >= 15 && down, `${name}: it comes apart in a chain of explosions (${booms} booms) and a final bang`);
        ok(G.powerups.length >= 5 && G.score >= 5000, `${name}: it pays out points and a shower of power-ups`);
        ok(G.phase === 'clear', `${name}: the wave is cleared`);
        run(G, NONE, C.WAVE.clear + 0.5);
        ok(G.phase === 'dock' && G.wave === n, `${name}: the ship is called back to the mothership`);
        run(G, NONE, 5);
        ok(G.dock?.st === 'shop', `${name}: and parks in the hangar`);
        Gm.launch(G);
        run(G, NONE, 1.6);
        ok(G.wave === n + 1 && G.phase === 'intro' && !G.dock, `${name}: after launch the next wave begins`);
    }
}


// ======================================================================
if (want('hangar')) {
    section('hangar');
    /** A game docked and waiting in the shop with `credits` to spend. */
    const docked = (credits = 1000, seed = 61) => {
        const G = fightAt(seed, 5); clearField(G);
        G.credits = credits;
        Gm.enterDock(G);
        run(G, NONE, 6);
        return G;
    };

    // credits come from kills, medals, perfect clears and bosses
    let G = fightAt(60, 3); clearField(G); G.plan.total = 99; G.credits = 0;
    const killOf = (type, props = {}) => { En.addEnemy(G, type, { path: En.linePath(112, 100, 0, 0), peace: true, ...props }); G.pbullets.push({ x: 112, y: 100, vx: 0, vy: 0, dmg: 999, pierce: 0, k: 0 }); Gm.step(G, NONE, DT); };
    killOf('drone');
    ok(G.credits === 1, 'a drone is worth 1 credit');
    killOf('saucer');
    ok(G.credits === 5, 'a saucer is worth 4');
    killOf('cruiser');
    ok(G.credits === 15, 'a cruiser is worth 10');
    G.powerups.push({ x: G.player.x, y: G.player.y, vx: 0, vy: 0, kind: 'M', t: 0 }); Gm.step(G, NONE, DT);
    ok(G.credits === 18, 'a medal is worth 3');

    // a normal wave does not go to the hangar; a boss does
    G = fightAt(62, 4); G.player.inv = 1e9;
    run(G, (g) => { g.player.inv = 1e9; return Bt.botInput(g, Bt.makeBot()); }, 60, (g) => { g.events.length = 0; });
    ok(G.wave >= 5 && !G.dock, 'waves 1-4 flow straight on, with no hangar');

    // the flight in
    G = fightAt(63, 5); clearField(G);
    G.powerups.push({ x: 30, y: 200, vx: 0, vy: 0, kind: 'P', t: 0 }, { x: 190, y: 100, vx: 0, vy: 0, kind: 'M', t: 0 });
    const w0 = G.player.weapon;
    Gm.enterDock(G);
    ok(G.phase === 'dock' && G.dock.st === 'approach' && has(G, 'dock'), 'entering the dock starts the approach');
    ok(G.player.weapon === w0 + 1 && G.powerups.length === 0, 'the capsules the boss dropped are scooped up on the way');
    ok(Gm.buy(G, 'engine') === false, 'nothing can be bought until the ship has docked');
    G.player.x = 20;
    run(G, { x: 1, y: 0, fire: true, bomb: true }, 0.3);
    ok(G.pbullets.length === 0 && G.bombFx === null, 'the ship flies itself: no shooting or bombing on the way in');
    run(G, NONE, 4);
    ok(G.dock.st === 'shop' && has(G, 'dockopen'), 'it docks and the shop opens');
    ok(Math.abs(G.player.x - C.FIELD.w / 2) < 0.01 && Math.abs(G.player.y - Gm.DOCK.y) < 0.01, 'parked under the mothership');
    const tdock = G.t; run(G, { x: 1, y: 1, fire: true }, 2);
    ok(G.player.x === C.FIELD.w / 2 && G.dock.st === 'shop', 'a docked ship does not move');

    // buying
    G = docked(1000);
    const upgrades = {
        engine: (g) => g.upg.engine, cannon: (g) => g.upg.cannon, rapid: (g) => g.upg.rapid,
        bay: (g) => g.upg.bay, magnet: (g) => g.upg.magnet, shield: (g) => g.upg.shield,
    };
    for (const u of Up.UPGRADES) {
        const g = docked(5000);
        let spent = 0;
        for (let lvl = 0; lvl < u.max; lvl++) {
            const before = g.credits;
            ok(Gm.buy(g, u.id), `${u.name} level ${lvl + 1} can be bought`);
            spent += before - g.credits;
            if (before - g.credits !== u.cost[lvl]) ok(false, `${u.name} level ${lvl + 1} costs ${u.cost[lvl]} (cost ${before - g.credits})`);
        }
        ok(upgrades[u.id](g) === u.max && spent === u.cost.reduce((a, b) => a + b, 0), `${u.name} maxes at ${u.max} for ${spent} credits`);
        ok(Gm.buy(g, u.id) === false && Up.offer(g, u.id) === null, `${u.name} cannot be bought past its maximum`);
    }
    G = docked(30);
    ok(Gm.buy(G, 'cannon') === false && G.credits === 30 && G.upg.cannon === 0, 'a purchase the player cannot afford does nothing');
    ok(Gm.buy(G, 'magnet') === true && G.credits === 0, 'one it can afford goes through, to the last credit');
    ok(Gm.buy(G, 'nonsense') === false, 'an unknown item is refused');

    // what each upgrade does
    {
        const g0 = fightAt(64, 3); clearField(g0);
        const dmgOf = (g) => { g.player.weapon = 1; g.pbullets.length = 0; g.player.fireT = 0; Gm.step(g, { ...NONE, fire: true }, DT); return g.pbullets[0].dmg; };
        const gap = (g) => { g.player.weapon = 1; g.player.fireT = 0; g.stats.shots = 0; run(g, { ...NONE, fire: true }, 3); return g.stats.shots; };
        const speedOf = (g) => { run(g, { x: -1, y: 0 }, 0.05); return Math.abs(g.player.vx); };
        const base = { dmg: dmgOf(g0), shots: gap(fightAt(64, 3)), speed: speedOf(fightAt(64, 3)) };
        const up = (id, n) => { const g = fightAt(64, 3); clearField(g); g.upg[id] = n; return g; };
        ok(dmgOf(up('cannon', 5)) === base.dmg * 2, 'cannons: five levels double the shot damage');
        ok(gap(up('rapid', 4)) > base.shots * 1.3, `rapid fire: four levels shoot over 30% more often (${base.shots} -> ${gap(up('rapid', 4))} shots in 3 s)`);
        ok(speedOf(up('engine', 5)) === base.speed + 40, 'engines: five levels add 40 speed');
        let g = up('bay', 2);
        g.bombs = C.PLAYER.maxBombs;
        g.powerups.push({ x: g.player.x, y: g.player.y, vx: 0, vy: 0, kind: 'B', t: 0 }); Gm.step(g, NONE, DT);
        ok(g.bombs === C.PLAYER.maxBombs + 1, 'bomb bay: a B capsule now takes you past the old limit');
        g = up('bay', 0); g.bombs = 0; g.phase = 'dock'; g.dock = { st: 'shop', t: 0, next: 9 }; g.credits = 999;
        Gm.buy(g, 'bay');
        ok(g.bombs === 1 && Up.maxBombs(g) === C.PLAYER.maxBombs + 1, 'buying a bomb bay also stocks a bomb');
        // the magnet: a capsule 20 px away is collected only with it
        const near = (n) => { const g2 = up('magnet', n); g2.powerups.push({ x: g2.player.x + 20, y: g2.player.y, vx: 0, vy: 0, kind: 'S', t: 0 }); run(g2, NONE, 0.6); return g2.player.speed; };
        ok(near(0) === 0 && near(3) === 1, 'magnet: it reaches a capsule 20 px away that an unupgraded ship would miss');
    }
    // the shield core
    {
        const g = fightAt(65, 3); g.upg.shield = 1; g.player.shield = 0;
        Gm.jumpToWave(g, 4);
        ok(g.player.shield === 1, 'shield core 1: a fresh shield at the start of each wave');
        g.player.inv = 0; g.upg.shield = 1; clearField(g);
        g.ebullets.push({ x: g.player.x, y: g.player.y, vx: 0, vy: 0, k: 0 }); Gm.step(g, NONE, DT);
        g.player.shield = 0; g.player.inv = 0; g.ebullets.push({ x: g.player.x, y: g.player.y, vx: 0, vy: 0, k: 0 }); Gm.step(g, NONE, DT);
        run(g, NONE, C.PLAYER.respawn + 0.1);
        ok(g.player.alive && g.player.shield === 0, 'shield core 1: a respawned ship has none');
        const h = fightAt(65, 3); h.upg.shield = 2; clearField(h); h.player.shield = 0; h.player.inv = 0;
        h.ebullets.push({ x: h.player.x, y: h.player.y, vx: 0, vy: 0, k: 0 }); Gm.step(h, NONE, DT);
        run(h, NONE, C.PLAYER.respawn + 0.1);
        ok(h.player.alive && h.player.shield === 1, 'shield core 2: it comes back with a shield on respawn');
    }

    // supplies
    G = docked(1000);
    G.lives = 3; Gm.buy(G, 'life');
    ok(G.lives === 4 && G.credits === 850, 'an extra ship costs 150');
    G.lives = C.PLAYER.maxLives;
    ok(Up.offer(G, 'life') === null, 'no extra ships past the limit');
    G.bombs = 0; Gm.buy(G, 'bomb');
    ok(G.bombs === 1 && G.credits === 800, 'a bomb costs 50');
    G.bombs = Up.maxBombs(G);
    ok(Up.offer(G, 'bomb') === null, 'no bombs past the limit');
    G.player.weapon = 2; Gm.buy(G, 'refit');
    ok(G.player.weapon === 5 && G.credits === 700, 'a weapon refit puts the gun back to full for 100');
    ok(Up.offer(G, 'refit') === null, 'and is not for sale when the gun is full');

    // upgrades survive death
    G = fightAt(66, 3); clearField(G); G.upg.cannon = 3; G.upg.engine = 2; G.player.inv = 0;
    G.ebullets.push({ x: G.player.x, y: G.player.y, vx: 0, vy: 0, k: 0 }); Gm.step(G, NONE, DT);
    run(G, NONE, 3);
    ok(G.upg.cannon === 3 && G.upg.engine === 2, 'upgrades are kept when a ship is lost');

    // launching
    G = docked(100);
    ok(Gm.launch(G) && G.dock.st === 'launch' && has(G, 'undock'), 'launching starts the flight out');
    ok(Gm.launch(G) === false || G.dock.st === 'launch', 'a second launch does nothing new');
    const wBefore = G.wave;
    run(G, NONE, 0.9);
    ok(G.wave === wBefore + 1 && !G.dock && G.phase === 'intro', 'the ship flies back out and the next wave begins');
    ok(Math.abs(G.player.y - C.PLAYER.startY) < 0.01 && G.player.inv > 0.5, 'it comes out at its start position, protected for a moment');
    ok(Gm.launch(G) === false, 'launch does nothing when not docked');

    // saves in the hangar
    for (const [label, runFor] of [['on the way in', 0.4], ['in the shop', 5], ['on the way out', 5.2]]) {
        let g = fightAt(67, 5); clearField(g); g.credits = 500; Gm.enterDock(g);
        run(g, NONE, runFor);
        if (label === 'on the way out') { Gm.buy(g, 'cannon'); Gm.launch(g); run(g, NONE, 0.2); }
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(g))));
        run(g, NONE, 6, (x) => { x.events.length = 0; }); run(copy, NONE, 6, (x) => { x.events.length = 0; });
        ok(JSON.stringify(Gm.serialize(g)) === JSON.stringify(Gm.serialize(copy)), `a save ${label} plays on identically`);
    }
    {
        const old = Gm.serialize(Gm.newGame(3)); delete old.upg; delete old.credits; delete old.dock;
        const g = Gm.deserialize(old);
        ok(g.upg.cannon === 0 && g.credits === 0 && g.dock === null, 'a save from before the hangar loads with no upgrades');
    }

    // the bot spends sensibly
    G = docked(400);
    const w5 = G.player.weapon; G.player.weapon = 2; G.lives = 1;
    Bt.botDock(G);
    ok(G.credits < 400 && G.player.weapon === 5 && G.lives >= 2, `the bot spends its credits (400 -> ${G.credits}), refits the gun and buys a ship when low`);
    ok(Object.values(G.upg).filter((v) => v > 0).length >= 3, 'and spreads them over several upgrades');
    G = docked(0); Bt.botDock(G);
    ok(G.credits === 0, 'with nothing to spend it buys nothing');
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, from = 1, secs = 40) => { const G = Gm.newGame(seed); if (from > 1) Gm.jumpToWave(G, from); const b = Bt.makeBot({ skill: 0.7 }); run(G, (g) => Bt.botInput(g, b), secs, (g) => { g.events.length = 0; }); return G; };
    const a = play(42), b = play(42), c = play(43);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    ok(JSON.stringify(Gm.serialize(a)) !== JSON.stringify(Gm.serialize(c)), 'a different seed, a different game');

    for (const [label, wave, warm] of [['mid-game', 1, 30], ['mid-formation', 3, 9], ['mid-boss', 5, 12], ['mid-beam boss', 15, 14]]) {
        const G = Gm.newGame(7);
        if (wave > 1) Gm.jumpToWave(G, wave);
        const bot = Bt.makeBot({ skill: 0.8 });
        run(G, (g) => { g.player.inv = Math.max(g.player.inv, 5); return Bt.botInput(g, bot); }, warm, (g) => { g.events.length = 0; });
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = JSON.parse(JSON.stringify(bot)), b2 = JSON.parse(JSON.stringify(bot));
        run(G, (g) => Bt.botInput(g, b1), 12, (g) => { g.events.length = 0; });
        run(copy, (g) => Bt.botInput(g, b2), 12, (g) => { g.events.length = 0; });
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save round trip ${label} plays on identically`);
    }
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    threw = false;
    try { Gm.deserialize({ v: 1, rngState: 1 }); } catch { threw = true; }
    ok(threw, 'a damaged save is rejected');
    ok(!('events' in Gm.serialize(Gm.newGame(1))) && !('rng' in Gm.serialize(Gm.newGame(1))), 'a save carries no events and no RNG object');
}

// ======================================================================
if (want('bots')) {
    section('bots');
    const LIMIT = 1500;
    const table = {};
    for (const skill of [1, 0.6, 0.3]) {
        const rows = [];
        for (let s = 1; s <= SEEDS; s++) {
            const G = Gm.newGame(s * 7919), bot = Bt.makeBot({ skill });
            let bad = null, peak = 0;
            while (!G.over && G.t < LIMIT) {
                Gm.step(G, Bt.botInput(G, bot), DT);
                G.events.length = 0;
                const p = G.player;
                if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) bad = 'non-finite position';
                else if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) bad = 'ship outside the field';
                else if (G.ebullets.length > C.ENEMY.maxBullets) bad = 'too many enemy bullets';
                else if (G.enemies.length > 90) bad = 'too many enemies';
                else if (G.enemies.some((e) => !Number.isFinite(e.x) || !Number.isFinite(e.y))) bad = 'a non-finite enemy';
                else if (G.lives < 0 || G.bombs < 0 || G.bombs > Up.maxBombs(G) || G.player.weapon < 1 || G.player.weapon > 5) bad = 'a counter out of range';
                if (bad) break;
                peak = Math.max(peak, G.ebullets.length);
            }
            ok(!bad, `skill ${skill} seed ${s}: ${bad || 'invariants hold'}`);
            rows.push({ wave: G.wave, score: G.score, deaths: G.stats.deaths, t: G.t, over: G.over, kills: G.stats.kills, chain: G.stats.maxChain, peak });
        }
        table[skill] = rows;
    }
    const avg = (rows, k) => Math.round((rows.reduce((a, r) => a + r[k], 0) / rows.length) * 10) / 10;
    console.log('\n  skill | avg wave | avg score | deaths | minutes | best chain | peak bullets | ended');
    for (const skill of [1, 0.6, 0.3]) {
        const r = table[skill];
        console.log(`  ${String(skill).padEnd(5)} | ${String(avg(r, 'wave')).padEnd(8)} | ${String(Math.round(avg(r, 'score'))).padEnd(9)} | ${String(avg(r, 'deaths')).padEnd(6)} | ${String(Math.round(avg(r, 't') / 6) / 10).padEnd(7)} | ${String(avg(r, 'chain')).padEnd(10)} | ${String(avg(r, 'peak')).padEnd(12)} | ${r.filter((x) => x.over).length}/${r.length} over`);
    }
    ok(avg(table[1], 'wave') > avg(table[0.3], 'wave'), 'a better bot gets further');
    ok(avg(table[1], 'wave') >= 12, `the best bot gets past wave 12 on average (${avg(table[1], 'wave')})`);
    ok(table[0.3].every((r) => r.over), 'the weakest bot always loses in the end: the game can be lost');
    ok(avg(table[0.3], 'wave') <= 20, `... and does not get far (${avg(table[0.3], 'wave')})`);
    ok(avg(table[1], 'peak') >= 20, 'late waves put real fire on the screen');
    ok(table[1].every((r) => r.score > table[0.3][0].score * 0.5), 'scores stay in a believable range');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
