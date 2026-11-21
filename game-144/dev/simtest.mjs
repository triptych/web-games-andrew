/**
 * simtest.mjs — headless checks of NEBULA REQUIEM's simulation. No browser.
 *
 *   node game-144/dev/simtest.mjs                     # everything (about a minute)
 *   ONLY=purity,rules node game-144/dev/simtest.mjs
 *   SEEDS=4 VERBOSE=1 node game-144/dev/simtest.mjs
 *
 * purity       js/sim, js/rng.js, js/config.js never touch the DOM, three.js, storage, Math.random or the clock
 * rules        guns, options, rockets, bombs, warp, shields, every power-up, synergies, graze, chains, extends,
 *              enemies, shield bearers, capital ships and their engines, bosses and their phases, walls
 * story        the whole story flow for each pilot: scenes, stages, bosses, cutscenes, ending; every scene exists
 * media        every portrait, cutscene, backdrop, boss card, music track, effect and voice line is on disk
 * generation   the mothership corridor is never narrower than MIN_GAP and always passable, over 60 seeds
 * determinism  same seed + inputs → same game; a save round trip mid-boss plays on identically
 * endless      survival waves escalate, bosses arrive on schedule, the run ends in a final score
 * bot          the bot plays the story at three skills for every pilot; prints the balance table and asserts bands
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 2);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Core = await import('../js/sim/core.js');
const Pl = await import('../js/sim/player.js');
const Cap = await import('../js/sim/capital.js');
const Bo = await import('../js/sim/bosses.js');
const St = await import('../js/sim/stages.js');
const Story = await import('../js/sim/data/story.js');
const { PILOTS } = await import('../js/sim/data/pilots.js');
const { STAGES, BOSSES, CAST } = await import('../js/sim/data/world.js');
const { POWERUPS, SYNERGIES } = await import('../js/sim/data/powerups.js');
const { ENEMIES } = await import('../js/sim/data/enemies.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0 };
const run = (G, inp, secs) => { for (let t = 0; t < secs && !G.over; t += DT) { Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); } };
const drain = (G) => G.events.splice(0);
const fresh = (o = {}) => { const G = Gm.newGame(o.seed || 5, { skipIntro: true, ...o }); G.chill = 99; return G; };
const quiet = (G) => { G.enemies.length = 0; G.bullets.length = 0; G._script = { script: [], end: 1e9 }; G.scriptI = 0; };

// ============================================================================ purity
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js'];
    const walk = (d) => { for (const f of fs.readdirSync(path.join(ROOT, d))) { const p = d + '/' + f; if (fs.statSync(path.join(ROOT, p)).isDirectory()) walk(p); else files.push(p); } };
    walk('js/sim');
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src) && !/from '\.\.\/\.\.\/(view|ui|audio)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ============================================================================ rules
if (want('rules')) {
    section('rules');
    // movement and focus
    let G = fresh();
    quiet(G);
    const x0 = G.player.x;
    run(G, { x: 1, y: 0 }, 0.5);
    ok(Math.abs(G.player.x - (x0 + PILOTS[0].stats.speed * 0.5)) < 0.2, 'moves right at the pilot\'s speed');
    const xf = G.player.x;
    run(G, { x: 1, y: 0, focus: true }, 0.5);
    ok(Math.abs(G.player.x - (xf + PILOTS[0].stats.focusSpeed * 0.5)) < 0.2, 'focus slows the ship');
    run(G, { x: 1, y: 1 }, 5);
    ok(G.player.x <= C.FIELD.w - 0.8 + 1e-9 && G.player.y <= C.FIELD.h - 0.45 + 1e-9, 'the ship stays on the screen');

    // auto fire, for every pilot
    for (const p of PILOTS) {
        G = fresh({ pilot: p.id });
        quiet(G);
        run(G, NONE, 0.5);
        ok(G.shots.length > 3, `${p.id}: the gun fires on its own`);
        const kinds = new Set(G.shots.map((s) => s.k));
        ok(kinds.has({ spread: 'vulcan', lance: 'lance', needle: 'needle' }[p.shot.kind]), `${p.id}: fires its own kind of shot`);
    }
    // power level widens the spread
    G = fresh({ pilot: 'sora' }); quiet(G);
    run(G, NONE, 0.1); const n1 = G.shots.length;
    G = fresh({ pilot: 'sora' }); quiet(G); G.player.power = 6;
    run(G, NONE, 0.1);
    ok(G.shots.length > n1 * 2, 'power 6 fires far more than power 1');

    // shots kill an enemy, scoring, chain
    G = fresh(); quiet(G);
    let e = Core.spawnEnemy(G, 'gunship', 14, G.player.y, { noFire: true, mv: { hx: 14, stay: 99 } });
    run(G, NONE, 3);
    ok(e.dead && G.score >= ENEMIES.gunship.score, 'shooting a gunship kills it and scores');
    ok(G.kills === 1 && G.chain.n === 1, 'a kill starts the chain');

    // every power-up does its thing
    G = fresh(); quiet(G);
    const P = G.player;
    for (const k of Object.keys(POWERUPS)) Pl.collect(G, k);
    ok(P.power === 2 && P.options === 1 && P.rockets === 1 && P.shield === 1 && P.warpMax === 1 && P.halo === 1, 'P, O, R, S, W and H each raise their level');
    ok(P.overdriveT > 0 && P.chronoT > 0 && P.magnetT > 0, 'X, T and M start their timers');
    ok(G.bombs === C.PLAYER.bombs + 1 && G.lives === C.DIFFS[1].lives + 1, 'B adds a bomb and U a life');
    ok(G.events.filter((x) => x.type === 'powerup').length === Object.keys(POWERUPS).length, 'each pickup emits a powerup event');

    // pickups by flying into a capsule
    G = fresh(); quiet(G);
    Core.dropItem(G, 'O', G.player.x + 0.3, G.player.y, 0, 0);
    run(G, NONE, 0.05);
    ok(G.player.options === 1, 'flying into a capsule collects it');

    // options and rockets fire
    G = fresh(); quiet(G); G.player.options = 2; G.player.rockets = 2;
    Core.spawnEnemy(G, 'cruiser', 25, 9, { noFire: true });
    run(G, NONE, 1);
    ok(G.shots.some((s) => s.k === 'rocket'), 'rocket pods launch rockets');
    ok(Pl.optionPositions(G).length === 2, 'two options fly with the ship');

    // synergies, each from its recipe
    const recipe = {
        aegis: (g) => { g.player.shield = 1; g.player.warpMax = 1; },
        swarm: (g) => { g.player.rockets = 1; g.player.options = 2; },
        sunwheel: (g) => { g.player.halo = 1; g.player.shield = 1; },
        nova: (g) => { g.player.overdriveT = 5; g.player.rockets = 1; },
        phase: (g) => { g.player.chronoT = 5; g.player.warpMax = 1; },
        cataclysm: (g) => { g.player.overdriveT = 5; g.bombs = 3; },
        wings: (g) => { g.player.options = 4; g.player.power = 6; },
        starfield: (g) => { g.player.magnetT = 5; g.player.halo = 1; },
        golden: (g) => { g.player.magnetT = 5; g.player.overdriveT = 5; },
    };
    for (const syn of SYNERGIES) {
        G = fresh(); quiet(G); G.bombs = 0;
        recipe[syn.id](G);
        const s = Pl.synergyState(G);
        ok(s[syn.id] && Object.values(s).filter(Boolean).length >= 1, `${syn.name} lights up from its recipe`);
    }
    // and each synergy actually changes something
    G = fresh(); quiet(G); G.player.options = 4; G.player.power = 6; Pl.updateSynergies(G);
    run(G, NONE, 0.3);
    ok(G.syn.wings && G.shots.filter((s) => s.k === 'lance').length > 8, 'SERAPH WINGS: options fire lances');
    G = fresh(); quiet(G); G.player.rockets = 2; G.player.options = 2; Pl.updateSynergies(G);
    Core.spawnEnemy(G, 'cruiser', 25, 9, { noFire: true });
    run(G, NONE, 0.7);
    ok(G.syn.swarm && G.shots.filter((s) => s.k === 'rocket').length >= 4, 'SWARM ARRAY: options launch rockets too');
    G = fresh(); quiet(G); G.player.shield = 1; G.player.warpMax = 1; G.player.warp = 1; Pl.updateSynergies(G);
    Gm.step(G, { x: 1, y: 0, warp: true }, DT);
    ok(G.syn.aegis && G.player.wake > 0, 'AEGIS JUMP: a warp leaves a wake');

    // bomb clears bullets and hurts everything
    G = fresh(); quiet(G);
    for (let i = 0; i < 40; i++) G.bullets.push({ x: 15 + i * 0.2, y: 9, vx: -1, vy: 0, r: 0.15, k: 'orb', c: 0, t: 0 });
    e = Core.spawnEnemy(G, 'carrier', 25, 4, { noFire: true });
    const bombs0 = G.bombs;
    Gm.step(G, { ...NONE, bomb: true }, DT);
    ok(G.bombs === bombs0 - 1 && G.bullets.length === 0, 'a bomb clears every bullet');
    ok(G.items.filter((i) => i.kind === 'gem').length >= 20, 'and turns them into stars');
    run(G, NONE, 2.5);
    ok(e.hp < e.maxhp * 0.6, 'the bomb burns enemies on screen');

    // warp: moves 7 forward, cuts bullets on the path, needs a charge
    G = fresh(); quiet(G);
    const wx = G.player.x;
    Gm.step(G, { x: 1, y: 0, warp: true }, DT);
    ok(Math.abs(G.player.x - wx) < 0.5, 'no warp without a charge');
    G.player.warpMax = 1; G.player.warp = 1;
    for (let i = 0; i < 10; i++) G.bullets.push({ x: wx + 1 + i * 0.6, y: G.player.y, vx: 0, vy: 0, r: 0.15, k: 'orb', c: 0, t: 0 });
    Gm.step(G, { x: 1, y: 0, warp: true }, DT);
    ok(G.player.x > wx + C.WEAPON.warpDist - 1, 'a warp blinks forward');
    ok(G.bullets.length === 0 && G.player.warp === 0, 'cutting the bullets on its path and spending the charge');
    run(G, NONE, C.WEAPON.warpRecharge + 0.2);
    ok(G.player.warp === 1, 'charges come back over time');

    // getting hit: shield absorbs, then a life
    G = fresh(); quiet(G); G.player.inv = 0; G.player.shield = 1;
    const L0 = G.lives;
    G.bullets.push({ x: G.player.x, y: G.player.y, vx: 0, vy: 0, r: 0.15, k: 'orb', c: 0, t: 0 });
    Gm.step(G, NONE, DT);
    ok(G.player.shield === 0 && G.lives === L0 && G.player.dead <= 0, 'a shield charge eats a hit');
    G.player.inv = 0;
    G.bullets.push({ x: G.player.x, y: G.player.y, vx: 0, vy: 0, r: 0.15, k: 'orb', c: 0, t: 0 });
    Gm.step(G, NONE, DT);
    ok(G.lives === L0 - 1 && G.player.dead > 0, 'without one, the ship is lost');
    ok(G.bullets.length === 0, 'and the screen is cleared');
    run(G, NONE, 2);
    ok(G.player.dead <= 0 && G.player.inv > 0, 'the ship respawns invulnerable');

    // graze
    G = fresh(); quiet(G); G.player.inv = 0;
    G.bullets.push({ x: G.player.x + 0.7, y: G.player.y, vx: 0, vy: 0, r: 0.12, k: 'orb', c: 0, t: 0 });
    Gm.step(G, NONE, DT);
    ok(G.grazes === 1 && G.burst > 0, 'a bullet brushing past grazes and fills Burst');
    Gm.step(G, NONE, DT);
    ok(G.grazes === 1, 'each bullet grazes only once');

    // burst, for every pilot
    for (const p of PILOTS) {
        G = fresh({ pilot: p.id }); quiet(G); G.burst = 100;
        Core.spawnEnemy(G, 'cruiser', 22, G.player.y, { noFire: true });
        Gm.step(G, { ...NONE, burst: true }, DT);
        ok(G.player.burstT > 0 && G.burst === 0, `${p.id}: a full gauge fires ${p.burst.name}`);
        const hp0 = G.enemies[0].hp;
        run(G, NONE, 1.5);
        ok(G.enemies[0].hp < hp0, `${p.id}: ${p.burst.name} does damage`);
    }

    // shield bearer: shots from the front bounce
    G = fresh(); quiet(G);
    e = Core.spawnEnemy(G, 'bearer', 15, G.player.y, { noFire: true, mv: { hx: 15, stay: 99 } });
    run(G, NONE, 1.5);
    ok(e.hp === e.maxhp && e.blocked > 0, 'a shield bearer blocks shots from the front');
    G.player.rockets = 2;
    run(G, NONE, 3);
    ok(e.hp < e.maxhp, 'rockets curve round and hurt it');

    // chains and extends
    G = fresh(); quiet(G);
    Core.addScore(G, C.SCORE.extends[0] + 1);
    ok(G.lives === C.DIFFS[1].lives + 1, 'crossing an extend score gives a life');
    G.chain.t = 1; G.chain.n = 19;
    ok(Core.chainTier(G) === 2, 'chain tier rises every 10 kills');

    // enemy fire comes from the patterns and lands as bullets
    G = fresh(); quiet(G); G.chill = 0;
    Core.spawnEnemy(G, 'pod', 20, 4);
    run(G, NONE, 2);
    ok(G.bullets.length >= 8, 'a pod fires its ring');
    G = fresh(); quiet(G); G.chill = 0;
    const tur = Core.spawnEnemy(G, 'turret', G.player.x + 2, G.player.y, { noFire: false });
    tur.ft = 0; G.enemies[0].mv = {};
    // mounted on nothing it dies: use a hover enemy that fires aimed shots instead
    G.enemies.length = 0;
    Core.spawnEnemy(G, 'sentinel', G.player.x + 2.5, G.player.y, { mv: { hx: G.player.x + 2.5, stay: 99 } }).ft = 0;
    run(G, NONE, 0.5);
    ok(!G.bullets.some((b) => b.k === 'needle'), 'no aimed fire from point-blank range');

    // capital ship: walls block, engines break it
    G = fresh(); quiet(G);
    Cap.startCapital(G, 'frigate', { x: 12 });
    Gm.step(G, NONE, DT);
    ok(G.walls.length > 2, 'a capital ship puts solid hull in the field');
    G.player.x = G.walls[1].x + 3; G.player.y = G.walls[1].y + 1;
    G.player.inv = 0;
    Gm.step(G, NONE, DT);
    ok(!Pl.wallAt(G, G.player.x, G.player.y), 'the ship is pushed out of the hull');
    G = fresh(); quiet(G);
    Cap.startCapital(G, 'frigate', { x: -8, speed: 0 });
    run(G, NONE, 0.1);
    for (const ee of G.enemies) if (ee.type === 'engine') Core.damageEnemy(G, ee, 1e6);
    run(G, NONE, 0.1);
    ok(G.capital?.broken && drain(G).some((x) => x.type === 'capitalBreak'), 'breaking every engine brings the capital ship down');

    // bosses: each one goes through all its phases and dies
    for (const key of Object.keys(Bo.BOSS_DEFS)) {
        G = fresh({ stage: STAGES.findIndex((s) => s.boss === key) }); quiet(G);
        G.god = true;
        Bo.startBoss(G, key);
        run(G, NONE, 3.5);
        const phases = Bo.BOSS_DEFS[key].phases.length;
        let seen = 0;
        for (let i = 0; i < 30000 && G.boss && !G.boss.dead; i++) {
            if (G.boss.vuln) G.boss.hp -= G.boss.maxhp / 200;
            Gm.step(G, NONE, DT);
            seen += drain(G).filter((x) => x.type === 'phase').length;
        }
        ok(G.boss?.dead || G.bossClear > 0 || G.phase === 'clear', `${BOSSES[key].name}: dies after its phases`);
        ok(seen === phases - 1, `${BOSSES[key].name}: goes through all ${phases} phases`);
    }
    // a boss phase that runs out of time moves on
    G = fresh(); quiet(G); G.god = true;
    Bo.startBoss(G, 'wyrm');
    run(G, NONE, 3.2 + Bo.BOSS_DEFS.wyrm.phases[0].time + 0.5);
    ok(G.boss.phase === 1 && G.boss.timeouts === 1, 'a phase that times out moves on, without its bonus');
    // Bellwether's core is shut until its engines are down
    G = fresh(); quiet(G); G.god = true;
    Bo.startBoss(G, 'bellwether');
    G.player.shotT = 1e9;                       // hold fire, so our own guns don't break the engines
    run(G, NONE, 5);
    ok(!G.boss.vuln, 'the Bellwether\'s core is shut while its engines run');
    for (const ee of G.enemies) if (ee.part === 'engine') Core.damageEnemy(G, ee, 1e6);
    run(G, NONE, 0.1);
    ok(G.boss.vuln, 'and opens when they are destroyed');
    // the Choirmaster starts weaker for every mothership engine broken
    G = fresh({ stage: 2 }); quiet(G); G.lastEnginesDown = 5;
    Bo.startBoss(G, 'organ', { hpScale: 1 - 0.07 * 5 });
    const weak = G.boss.maxhp;
    G = fresh({ stage: 2 }); quiet(G);
    Bo.startBoss(G, 'organ');
    ok(weak < G.boss.maxhp * 0.7, 'breaking the mothership\'s engines weakens its Choirmaster');
}

// ============================================================================ story
if (want('story')) {
    section('story');
    for (const p of PILOTS) {
        const plan = Story.storyPlan(p.id);
        const ids = [...plan.intro, ...Object.values(plan.afterStage).flat(), ...plan.ending, ...STAGES.map((_, i) => plan.bossTalk(i + 1))];
        ok(ids.every((id) => Story.SCENES[id]), `${p.id}: every scene in the plan exists`);
        ok(ids.every((id) => Story.storyFor(id, p.id).lines.every((l) => l.text && l.who && (CAST[l.who] || PILOTS.some((q) => q.id === l.who)))), `${p.id}: every line has a speaker and text`);
        // play the whole story with the god-mode bot: scenes, six stages, six bosses, the ending
        const G = Gm.newGame(3, { pilot: p.id });
        G.god = true;
        const bot = Bt.makeBot({ skill: 1 });
        const talks = [], stages = [], bosses = [];
        while (!G.over && G.t < 2500) {
            Gm.step(G, Bt.botInput(G, bot), DT);
            for (const e of drain(G)) { if (e.type === 'talk') talks.push(e.scene); if (e.type === 'stage') stages.push(e.n); if (e.type === 'bossDie') bosses.push(e.key); }
        }
        ok(G.won, `${p.id}: the story can be finished`);
        ok(stages.join() === '0,1,2,3,4,5', `${p.id}: through all six stages in order`);
        ok(bosses.join() === STAGES.map((s) => s.boss).join(), `${p.id}: fights all six bosses`);
        ok(talks[0] === 'opening' && talks.includes(`${p.id}-intro`) && talks[talks.length - 1] === `${p.id}-end`, `${p.id}: opens with the intro and ends with their own ending`);
        ok(STAGES.every((_, i) => talks.includes(`boss${i + 1}-${p.id}`)), `${p.id}: has their own words before every boss`);
        console.log(`  ${p.id}: ${talks.length} scenes, ${(G.t / 60).toFixed(1)} min`);
    }
    // continue after game over
    const G = Gm.newGame(4, { skipIntro: true });
    G.lives = 0; G.player.inv = 0; G.chill = 99;
    G.bullets.push({ x: G.player.x, y: G.player.y, vx: 0, vy: 0, r: 0.2, k: 'orb', c: 0, t: 0 });
    run(G, NONE, 2);
    ok(G.phase === 'over', 'losing the last ship is game over');
    Gm.step(G, { ...NONE, cont: true }, DT);
    ok(G.phase === 'play' && G.continues === 1 && G.score === 0 && G.lives === C.DIFFS[1].lives, 'a continue restores the lives and resets the score');
}

// ============================================================================ media
if (want('media')) {
    section('media');
    const has = (p) => fs.existsSync(path.join(ROOT, p));
    for (const id of [...PILOTS.map((p) => p.id), ...Object.keys(CAST).filter((k) => CAST[k].art)]) ok(has(`art/por/${id}.webp`), `portrait ${id}`);
    for (const p of PILOTS) ok(has(`art/por/${p.id}-fierce.webp`), `fierce portrait ${p.id}`);
    for (const s of Object.values(Story.SCENES)) if (s.art) ok(has(`art/cs/${s.art}.webp`), `cutscene art ${s.art}`);
    for (const s of STAGES) ok(has(`art/bg/${s.id}.webp`), `backdrop ${s.id}`);
    ok(has('art/bg/endless.webp') && has('art/cs/title.webp'), 'survival backdrop and title art');
    for (const k of Object.keys(BOSSES)) ok(has(`art/boss/${k}.webp`), `boss card ${k}`);
    for (const m of ['title', 'stage1', 'stage2', 'stage3', 'boss', 'final', 'endless', 'ending']) ok(has(`audio/music/${m}.mp3`), `music ${m}`);
    const lines = Story.allLines();
    const missing = lines.filter((l) => !has(`audio/vo/${l.vo}.mp3`));
    ok(missing.length === 0, `all ${lines.length} voice lines are on disk${missing.length ? ' — missing ' + missing.map((l) => l.vo).join(', ') : ''}`);
}

// ============================================================================ generation
if (want('generation')) {
    section('generation');
    let worst = 99;
    for (let seed = 1; seed <= 60; seed++) {
        const M = Cap.mothership(seed * 37, 330);
        // per 4-unit column: the open gap between ceiling and floor, then a passable path with pillars
        const cols = new Map();
        for (const b of M.blocks) {
            const c = Math.floor(b.x / 4);
            if (!cols.has(c)) cols.set(c, []);
            cols.get(c).push(b);
        }
        let okGap = true, okPath = true;
        for (const [, bl] of cols) {
            const top = Math.max(...bl.filter((b) => b.y < 0).map((b) => b.y + b.h));
            const bot = Math.min(...bl.filter((b) => b.y + b.h > C.FIELD.h).map((b) => b.y));
            const gap = bot - top;
            worst = Math.min(worst, gap);
            if (gap < Cap.MIN_GAP) okGap = false;
            // pillars: some vertical lane ≥ 2.2 tall must stay open in the column
            const solids = bl.filter((b) => b.y >= 0 && b.y + b.h <= C.FIELD.h).map((b) => [b.y, b.y + b.h]).concat([[-9, top], [bot, 99]]).sort((a, b) => a[0] - b[0]);
            let lane = 0;
            for (let i = 1; i < solids.length; i++) lane = Math.max(lane, solids[i][0] - solids[i - 1][1]);
            if (lane < 2.2) okPath = false;
        }
        ok(okGap, `seed ${seed}: the corridor is never narrower than ${Cap.MIN_GAP}`);
        ok(okPath, `seed ${seed}: every column leaves a lane past its pillars`);
    }
    console.log(`  60 mothership layouts, narrowest gap ${worst.toFixed(2)}`);
}

// ============================================================================ determinism
if (want('determinism')) {
    section('determinism');
    const play = (seed) => { const G = Gm.newGame(seed, { skipIntro: true }); const b = Bt.makeBot({ skill: 0.8, seed: 2 }); run(G, (g) => Bt.botInput(g, b), 30); return G; };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    // round trip in the middle of a boss fight with a capital-ship hull in play
    for (const [label, setup] of [['mid-stage', (G) => run(G, (g) => Bt.botInput(g, G._b), 50)], ['mid-boss', (G) => { G.god = true; G._script = { script: [], end: 0 }; G.scriptI = 0; run(G, (g) => Bt.botInput(g, G._b), 12); }]]) {
        const G = Gm.newGame(9, { skipIntro: true });
        G._b = Bt.makeBot({ skill: 1, seed: 3 });
        setup(G);
        delete G._b;
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        if (G._script && !G._script.script.length) copy._script = G._script;
        const b1 = Bt.makeBot({ skill: 1, seed: 4 }), b2 = Bt.makeBot({ skill: 1, seed: 4 });
        run(G, (g) => Bt.botInput(g, b1), 15);
        run(copy, (g) => Bt.botInput(g, b2), 15);
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save round trip ${label} plays on identically`);
    }
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ============================================================================ endless
if (want('endless')) {
    section('endless');
    const G = Gm.newGame(11, { mode: 'endless', pilot: 'kaito' });
    G.god = true;
    const bot = Bt.makeBot({ skill: 1 });
    const bosses = [];
    let maxWave = 0;
    while (G.t < 900 && G.wave < 17) {
        Gm.step(G, Bt.botInput(G, bot), DT);
        for (const e of drain(G)) { if (e.type === 'boss') bosses.push([G.wave, e.key]); }
        maxWave = Math.max(maxWave, G.wave);
    }
    ok(maxWave >= 17, `survival keeps sending waves (reached ${maxWave})`);
    ok(bosses.length >= 2 && bosses[0][0] === St.ENDLESS_BOSS_EVERY && bosses[1][0] === 2 * St.ENDLESS_BOSS_EVERY, 'a boss every ' + St.ENDLESS_BOSS_EVERY + ' waves');
    ok(bosses[0][1] !== bosses[1][1], 'and a different one each time');
    ok(G.erate > C.DIFFS[1].rate * 1.1, 'enemy fire rate climbs with the wave');
    // the run ends in a final score
    const H = Gm.newGame(12, { mode: 'endless' });
    const weak = Bt.makeBot({ skill: 0.2 });
    let final = false;
    while (!H.over && H.t < 900) { Gm.step(H, Bt.botInput(H, weak), DT); if (drain(H).some((e) => e.type === 'final')) final = true; }
    ok(H.over && final, 'a survival run ends with a final score');
}

// ============================================================================ bot + balance
if (want('bot')) {
    section('bot');
    const rows = [];
    for (const p of PILOTS) for (const skill of [1, 0.6, 0.3]) for (let s = 1; s <= SEEDS; s++) {
        const G = Gm.newGame(s * 131, { pilot: p.id, skipIntro: true });
        const bot = Bt.makeBot({ skill, seed: s });
        let bad = null;
        while (!G.over && G.phase !== 'over' && G.t < 2400) {
            Gm.step(G, Bt.botInput(G, bot), DT);
            G.events.length = 0;
            const pl = G.player;
            if (!Number.isFinite(pl.x) || !Number.isFinite(pl.y) || !Number.isFinite(G.score)) bad = 'non-finite state';
            else if (pl.x < 0 || pl.y < 0 || pl.x > C.FIELD.w || pl.y > C.FIELD.h) bad = 'ship outside the field';
            else if (G.bullets.length > C.LIMITS.bullets) bad = 'bullet cap broken';
            if (bad) break;
        }
        ok(!bad, `${p.id} skill ${skill} seed ${s}: ${bad || 'invariants hold'}`);
        rows.push({ pilot: p.id, skill, won: G.won, stage: G.stage + 1, deaths: G.deaths, score: G.score, min: +(G.t / 60).toFixed(1) });
    }
    const table = {};
    for (const r of rows) {
        const k = `${r.pilot} ${r.skill}`;
        const t = table[k] ||= { runs: 0, wins: 0, stage: 0, deaths: 0, score: 0 };
        t.runs++; t.wins += r.won ? 1 : 0; t.stage += r.stage; t.deaths += r.deaths; t.score += r.score;
    }
    console.log('  pilot skill   runs  won  avg stage  avg deaths  avg score');
    for (const [k, t] of Object.entries(table)) console.log(`  ${k.padEnd(12)} ${String(t.runs).padStart(4)} ${String(t.wins).padStart(4)} ${(t.stage / t.runs).toFixed(1).padStart(10)} ${(t.deaths / t.runs).toFixed(1).padStart(11)} ${String(Math.round(t.score / t.runs)).padStart(10)}`);
    const by = (skill) => rows.filter((r) => r.skill === skill);
    const winRate = (skill) => by(skill).filter((r) => r.won).length / by(skill).length;
    const avgStage = (skill) => by(skill).reduce((a, r) => a + r.stage, 0) / by(skill).length;
    ok(winRate(1) >= 0.5, `a perfect bot usually beats the story (${(winRate(1) * 100) | 0}%)`);
    ok(winRate(0.3) === 0, 'a weak bot never does');
    ok(avgStage(1) > avgStage(0.6) && avgStage(0.6) > avgStage(0.3), 'better bots get further');
    ok(avgStage(0.3) <= 3, `a weak bot falls in the first half on average (${avgStage(0.3).toFixed(1)})`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
