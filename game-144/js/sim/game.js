// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// Input each step: { x, y, focus, bomb, warp, burst, done, cont } — x, y in [-1, 1] (y down); focus held;
// bomb, warp, burst, done (finish the scene on screen) and cont (continue after game over) are presses.

import { STEP, DIFFS, RANK, PLAYER, FIELD } from '../config.js';
import { makeRng } from '../rng.js';
import { PILOT_BY_ID } from './data/pilots.js';
import { STAGES } from './data/world.js';
import { storyPlan } from './data/story.js';
import { newPlayer, stepPlayer, checkPlayerHits, synergyState } from './player.js';
import { stepEnemies } from './enemies.js';
import { stepBullets } from './patterns.js';
import { stepCapital } from './capital.js';
import { startBoss, stepBoss } from './bosses.js';
import { stepStage, STAGE_COUNT, endlessWave, stepEndless, BOSS_ORDER, ENDLESS_BOSS_EVERY } from './stages.js';
import { ev, spawnEnemy, cancelBullets } from './core.js';

export const SAVE_VERSION = 1;

/**
 * A new run. opts: { mode: 'story'|'endless', pilot: 'sora'|'kaito'|'lyra', diff: 0|1|2, stage: 0..5, skipIntro }.
 */
export function newGame(seed = 1, opts = {}) {
    const mode = opts.mode || 'story';
    const pilot = PILOT_BY_ID[opts.pilot] ? opts.pilot : 'sora';
    const diff = opts.diff ?? 1;
    const D = DIFFS[diff];
    const G = {
        v: SAVE_VERSION, seed, rng: makeRng((seed ^ 0x9e3779b9) >>> 0), mode, pilot, diff,
        t: 0, phase: 'play', stage: opts.stage || 0, stageT: 0, scriptI: 0, stageSeed: 0, stageColor: 0,
        score: 0, lives: D.lives, bombs: PLAYER.bombs, nextExtend: 0, credits: 0, continues: 0,
        chain: { n: 0, t: 0, best: 0 }, burst: 0, rank: 0, bspd: D.speed, erate: D.rate, ehp: D.hp, chill: 1.5,
        player: newPlayer(pilot),
        bullets: [], beams: [], shots: [], enemies: [], items: [], walls: [], pending: [],
        capital: null, boss: null, bossClear: 0, warnT: 0, clearT: 0, overT: 0,
        talk: null, talkQ: [], after: null,
        wave: 0, waveT: 0, loop: 0,
        syn: {}, synSeen: {}, collected: {},
        kills: 0, hits: 0, grazes: 0, gems: 0, deaths: 0, bombsUsed: 0, warps: 0, bursts: 0, bossesKilled: 0, capitalsBroken: 0, bossDmg: 0,
        nextId: 1, events: [], won: false, over: false, stageScores: [],
    };
    hooks(G);
    G.syn = synergyState(G);
    if (mode === 'endless') {
        G.stage = 0;
        startEndless(G);
    } else if (opts.skipIntro) startStage(G, G.stage);
    else queueTalk(G, storyPlan(pilot).intro, { do: 'stage', n: G.stage });
    return G;
}

function hooks(G) {
    G.byId = new Map();
    G.spawnHook = (g, type, x, y, p) => spawnEnemy(g, type, x, y, { mv: { speed: 6, amp: 2 }, ...p });
}

// ---------------------------------------------------------------------------- flow
function queueTalk(G, scenes, after) {
    G.talkQ = scenes.slice();
    G.after = after;
    G.phase = 'talk';
    nextTalk(G);
}
function nextTalk(G) {
    if (!G.talkQ.length) { G.talk = null; return afterTalk(G); }
    G.talk = G.talkQ.shift();
    ev(G, 'talk', { scene: G.talk, pilot: G.pilot });
}
function afterTalk(G) {
    const a = G.after;
    G.after = null;
    G.phase = 'play';
    if (!a) return;
    if (a.do === 'stage') startStage(G, a.n);
    else if (a.do === 'boss') beginBoss(G);
    else if (a.do === 'won') { G.won = true; G.over = true; G.phase = 'won'; ev(G, 'won', { score: G.score }); }
}

function startStage(G, n) {
    G.stage = n;
    G.stageT = 0;
    G.scriptI = 0;
    G._script = null;
    G.stageSeed = 1000 + n * 77;
    G.stageColor = n % 6;
    G.capital = null;
    G.boss = null;
    G.walls.length = 0;
    G.bossClear = 0;
    G.warnT = 0;
    G.phase = 'play';
    G.chill = 1.5;
    G.stageStart = G.score;
    ev(G, 'stage', { n, id: STAGES[n].id, name: STAGES[n].name, sub: STAGES[n].sub, music: STAGES[n].music });
    ev(G, 'radio', { scene: `stage${n + 1}` });
}

function startEndless(G) {
    G.phase = 'play';
    G.wave = 0;
    G.waveT = 0;
    G.stageSeed = 4242;
    ev(G, 'stage', { n: 0, id: 'endless', name: 'THE ENDLESS CHOIR', sub: 'Survival', music: 'endless' });
    ev(G, 'radio', { scene: 'endless' });
    nextWave(G);
}

function nextWave(G) {
    G.wave++;
    G.waveT = 0;
    const theme = Math.floor((G.wave - 1) / ENDLESS_BOSS_EVERY) % STAGES.length;
    if (theme !== G.stage) { G.stage = theme; G.stageColor = theme; ev(G, 'theme', { n: theme, id: STAGES[theme].id }); }
    ev(G, 'wave', { n: G.wave });
    if (G.wave % ENDLESS_BOSS_EVERY === 0) {
        G.warnT = 3;
        ev(G, 'warning', { key: BOSS_ORDER[(G.wave / ENDLESS_BOSS_EVERY - 1) % BOSS_ORDER.length] });
    } else endlessWave(G);
}

function beginBoss(G) {
    const key = G.mode === 'endless' ? BOSS_ORDER[(G.wave / ENDLESS_BOSS_EVERY - 1) % BOSS_ORDER.length] : STAGES[G.stage].boss;
    const loop = G.mode === 'endless' ? Math.floor((G.wave / ENDLESS_BOSS_EVERY - 1) / BOSS_ORDER.length) : 0;
    // break the mothership's engines in stage 3 and its Choirmaster starts weaker
    const hpScale = key === 'organ' ? 1 - 0.07 * (G.lastEnginesDown || 0) : 1;
    startBoss(G, key, { hpMul: 1 + loop * 0.45 + (G.mode === 'endless' ? G.wave * 0.012 : 0), hpScale });
}

function stageCleared(G) {
    G.stageScores.push(G.score - (G.stageStart || 0));
    ev(G, 'clear', { n: G.stage, score: G.score - (G.stageStart || 0) });
    G.phase = 'clear';
    G.clearT = 4.5;
}

function afterClear(G) {
    if (G.mode === 'endless') { G.phase = 'play'; nextWave(G); return; }
    const plan = storyPlan(G.pilot);
    const n = G.stage + 1;
    const scenes = (plan.afterStage[n] || []).slice();
    if (n >= STAGE_COUNT) queueTalk(G, plan.ending, { do: 'won' });
    else if (scenes.length) queueTalk(G, scenes, { do: 'stage', n });
    else startStage(G, n);
}

// ---------------------------------------------------------------------------- the step
export function step(G, inp, dt = STEP) {
    if (G.over) return;
    G.t += dt;
    if (!G.byId) hooks(G);

    if (G.phase === 'talk') {
        if (inp.done) nextTalk(G);
        return;
    }
    if (G.phase === 'over') {
        G.overT += dt;
        if (inp.cont && G.mode === 'story') {
            G.continues++;
            G.score = 0;
            G.nextExtend = 0;
            G.lives = DIFFS[G.diff].lives;
            G.bombs = PLAYER.bombs;
            G.phase = 'play';
            G.player.dead = 0.01;
            G.player.inv = PLAYER.respawnInv;
            ev(G, 'continue', { n: G.continues });
        } else if (inp.done || (G.mode === 'endless' && G.overT > 0.5 && inp.cont)) {
            G.over = true;
            ev(G, 'final', { score: G.score });
        }
        return;
    }

    // difficulty rank climbs slowly through a run
    const D = DIFFS[G.diff];
    G.rank = Math.min(RANK.max, (G.t / 60) * RANK.perMinute + (G.mode === 'endless' ? G.wave * 0.006 : 0));
    const endlessMul = G.mode === 'endless' ? 1 + Math.min(0.5, G.wave * 0.012) : 1;
    G.bspd = D.speed * (1 + G.rank) * Math.min(1.25, endlessMul);
    G.erate = D.rate * (1 + G.rank) * endlessMul;
    G.ehp = D.hp;
    if (G.chill > 0) G.chill -= dt;
    if (G.chain.t > 0) { G.chain.t -= dt; if (G.chain.t <= 0) G.chain.n = 0; }

    G.byId.clear();
    for (const e of G.enemies) G.byId.set(e.id, e);

    stepCapital(G, dt);
    const bossWas = G.boss && !G.boss.dead;
    if (stepBoss(G, dt) === 'dead' && bossWas) { /* bossClear timer set */ }
    if (G.capital) G.lastEnginesDown = G.capital.enginesDown;

    const res = G.phase === 'play' ? stepPlayer(G, inp, dt) : null;
    if (res === 'gameover') { gameOver(G); return; }
    stepEnemies(G, dt);
    stepBullets(G, dt, G.player.chronoT > 0 ? 0.45 : 1);
    for (const bm of G.beams) {
        bm.t += dt;
        const o = bm.owner != null && (G.byId.get(bm.owner) || (G.boss && G.boss.id === bm.owner ? G.boss : null));
        if (o && !o.dead) { bm.x = o.x + (bm.ox || 0); bm.y = o.y + (bm.oy || 0); }
        if (bm.spin && bm.t > bm.warm) bm.ang += bm.spin * dt;
    }
    G.beams = G.beams.filter((b) => b.t < b.warm + b.life);
    // walls eat enemy bullets too
    if (G.walls.length) G.bullets = G.bullets.filter((b) => !G.walls.some((w) => b.x > w.x && b.x < w.x + w.w && b.y > w.y && b.y < w.y + w.h));
    if (G.phase === 'play') checkPlayerHits(G);

    // the flow of a stage or a survival run
    if (G.warnT > 0) {
        G.warnT -= dt;
        if (G.warnT <= 0) {
            const talk = G.mode === 'story' ? storyPlan(G.pilot).bossTalk(G.stage + 1) : null;
            cancelBullets(G, () => true, true, 80);
            if (talk) queueTalk(G, [talk], { do: 'boss' }); else beginBoss(G);
        }
        return;
    }
    if (G.bossClear > 0) {
        G.bossClear -= dt;
        if (G.bossClear <= 0) { G.boss = null; G.walls.length = 0; stageCleared(G); }
        return;
    }
    if (G.phase === 'clear') {
        G.clearT -= dt;
        if (G.clearT <= 0) afterClear(G);
        return;
    }
    if (G.boss) return;
    if (G.mode === 'story') {
        if (stepStage(G, dt)) {
            G.warnT = 3.2;
            ev(G, 'warning', { key: STAGES[G.stage].boss });
            ev(G, 'radio', { scene: 'warn' });
        }
    } else if (stepEndless(G, dt)) {
        if (G.wave % 4 === 0) { G.phase = 'clear'; G.clearT = 2.5; ev(G, 'waveClear', { n: G.wave }); }
        else nextWave(G);
    }
}

function gameOver(G) {
    G.phase = 'over';
    G.overT = 0;
    G.bullets.length = 0;
    G.beams.length = 0;
    ev(G, 'gameover', { score: G.score, mode: G.mode, wave: G.wave, stage: G.stage });
    ev(G, 'radio', { scene: 'gameover' });
}

// ---------------------------------------------------------------------------- saving
const TRANSIENT = ['rng', 'events', 'byId', 'spawnHook', '_script'];

export function serialize(G) {
    const out = {};
    for (const k of Object.keys(G)) if (!TRANSIENT.includes(k)) out[k] = G[k];
    out.rngState = G.rng.state();
    return JSON.parse(JSON.stringify(out));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_VERSION) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    hooks(G);
    return G;
}

export { FIELD };
