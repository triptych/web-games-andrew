// The simulation. Pure: no DOM, no rendering, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// Input each step: inp = { x, y, fire, bomb } — x and y in [-1, 1] (y down), fire = held (or tapped
// since the last step), bomb = pressed since the last step.

import { FIELD, PLAYER, BOMB, SCORE, WAVE } from '../config.js';
import { makeRng } from '../rng.js';
import { clamp, emit } from './util.js';
import { TYPES, addEnemy, updateEnemies, touches } from './enemies.js';
import { bossProps, startBossDeath } from './bosses.js';
import { planWave, CARRY } from './waves.js';

const W = FIELD.w, H = FIELD.h;

export function newGame(seed = 1) {
    const G = {
        v: 1,                       // save format version
        seed,
        rng: makeRng(seed),
        t: 0,
        over: false,
        endT: 0,                    // > 0 once the last ship is gone: the time before the game ends
        score: 0,
        lives: PLAYER.lives,
        bombs: PLAYER.bombs,
        wave: 0,
        diff: 0,
        phase: 'intro',             // intro | fight | clear
        phaseT: 0,
        plan: null,
        player: { x: W / 2, y: PLAYER.startY, vx: 0, vy: 0, alive: true, respawn: 0, inv: PLAYER.startInv, fireT: 0, weapon: 1, speed: 0, shield: 0, bank: 0 },
        enemies: [],
        ebullets: [],
        pbullets: [],
        powerups: [],
        adds: [],                   // enemies bosses have asked for this step
        form: { diveT: 2.4 },
        bombFx: null,
        bombId: 0,
        chain: 0,
        chainT: 0,
        medal: 0,
        nextLife: SCORE.firstLife,
        dropIdx: 0,
        nid: 1,
        stats: { kills: 0, shots: 0, deaths: 0, perfects: 0, maxChain: 0, bombs: 0, medals: 0 },
        events: [],                 // { type, ... } since the last drain; never saved
    };
    startWave(G, 1);
    return G;
}

// ------------------------------------------------------------------ waves
function startWave(G, n) {
    G.wave = n;
    G.diff = n - 1;
    G.plan = planWave(n, G);
    G.phase = 'intro';
    G.phaseT = 0;
    G.form.diveT = 2.4;
    emit(G, { type: 'wave', n, kind: G.plan.kind, boss: G.plan.boss ? G.plan.boss.idx : -1 });
}

/** Cut straight to a wave (used by the debug hooks and the tests). */
export function jumpToWave(G, n) {
    G.enemies.length = 0; G.ebullets.length = 0; G.adds.length = 0;
    startWave(G, n);
}

function spawnOrder(G, o) {
    if (o.type === 'boss') {
        addEnemy(G, 'boss', bossProps(G, o.props.idx, o.props.cycle));
        emit(G, { type: 'bossappear', idx: o.props.idx });
    } else addEnemy(G, o.type, { ...o.props });
}

function updateWave(G, dt) {
    G.phaseT += dt;
    const plan = G.plan;
    if (G.phase === 'intro') {
        if (G.phaseT >= (plan.kind === 'boss' ? WAVE.bossIntro : WAVE.intro)) { G.phase = 'fight'; G.phaseT = 0; }
        return;
    }
    if (G.phase === 'fight') {
        while (plan.idx < plan.orders.length && plan.orders[plan.idx].t <= G.phaseT) spawnOrder(G, plan.orders[plan.idx++]);
        if (plan.idx >= plan.orders.length && G.enemies.every((e) => e.dead)) endWave(G);
        return;
    }
    if (G.phase === 'clear' && G.phaseT >= WAVE.clear) startWave(G, G.wave + 1);
}

function endWave(G) {
    const plan = G.plan;
    const perfect = plan.kind !== 'boss' && plan.escaped === 0 && plan.killed >= plan.total;
    let bonus = 0;
    if (perfect) {
        G.stats.perfects++;
        if (plan.kind === 'bonus') { bonus = SCORE.bonusPerfect; G.bombs = Math.min(PLAYER.maxBombs, G.bombs + 1); }
        else bonus = SCORE.perfectPerWave * G.wave;
        addScore(G, bonus);
    }
    G.phase = 'clear';
    G.phaseT = 0;
    emit(G, { type: 'waveclear', n: G.wave, kind: plan.kind, perfect, bonus, killed: plan.killed, total: plan.total });
}

// ------------------------------------------------------------------ scoring
function addScore(G, pts) {
    G.score += pts;
    while (G.score >= G.nextLife) {
        G.nextLife += SCORE.lifeEvery;
        if (G.lives < PLAYER.maxLives) G.lives++;
        emit(G, { type: '1up' });
    }
}

/** Score multiplier from the current kill chain. */
export const multiplier = (G) => 1 + Math.min(SCORE.chainMax - 1, Math.floor(G.chain / SCORE.chainPer));

// ------------------------------------------------------------------ power-ups
function dropPowerup(G, x, y, kind) {
    G.powerups.push({ x, y, vx: (G.rng() - 0.5) * 18, vy: 26, kind, t: 0 });
}

function collect(G, u) {
    const p = G.player;
    let pts = 0;
    switch (u.kind) {
        case 'P': if (p.weapon < PLAYER.maxWeapon) p.weapon++; else pts = 1000; break;
        case 'S': if (p.speed < PLAYER.maxSpeedLevel) p.speed++; else pts = 500; break;
        case 'B': if (G.bombs < PLAYER.maxBombs) G.bombs++; else pts = 500; break;
        case 'H': if (!p.shield) p.shield = 1; else pts = 500; break;
        case '1': if (G.lives < PLAYER.maxLives) G.lives++; else pts = 2000; break;
        case 'M': {
            pts = SCORE.medals[Math.min(G.medal, SCORE.medals.length - 1)];
            G.medal++;
            G.stats.medals++;
            emit(G, { type: 'medal', x: u.x, y: u.y, value: pts, step: Math.min(G.medal, SCORE.medals.length) });
            break;
        }
    }
    if (pts) { addScore(G, pts); emit(G, { type: 'popup', x: u.x, y: u.y, text: String(pts) }); }
    emit(G, { type: 'pickup', kind: u.kind, x: u.x, y: u.y });
}

// ------------------------------------------------------------------ the player
function fire(G) {
    const p = G.player, s = PLAYER.bulletSpeed, y = p.y - 8, w = p.weapon;
    const b = (dx, ang, dmg = 1, pierce = 0, k = 0) => G.pbullets.push({ x: p.x + dx, y, vx: Math.sin(ang) * s, vy: -Math.cos(ang) * s, dmg, pierce, k });
    if (w === 1) b(0, 0);
    else if (w === 2) { b(-4, 0); b(4, 0); }
    else if (w === 3) { b(0, 0, 1, 0, 1); b(-5, -0.13); b(5, 0.13); }
    else if (w === 4) { b(0, 0, 1, 0, 1); b(-4, -0.11); b(4, 0.11); b(-7, -0.27); b(7, 0.27); }
    else { b(0, 0, 2, 2, 2); b(-4, -0.08); b(4, 0.08); b(-7, -0.22, 1); b(7, 0.22, 1); b(-10, -0.4, 1); b(10, 0.4, 1); }
    G.stats.shots++;
    emit(G, { type: 'shoot', w });
}

function setOff(G) {
    const p = G.player;
    G.bombs--;
    G.stats.bombs++;
    G.bombId++;
    G.bombFx = { id: G.bombId, x: p.x, y: p.y, r: 0, t: 0 };
    p.inv = Math.max(p.inv, BOMB.inv);
    emit(G, { type: 'bomb', x: p.x, y: p.y });
}

function updatePlayer(G, inp, dt) {
    const p = G.player;
    if (!p.alive) {
        p.respawn -= dt;
        if (p.respawn <= 0 && G.lives > 0) {
            Object.assign(p, { x: W / 2, y: PLAYER.startY, alive: true, inv: PLAYER.invuln, fireT: 0, bank: 0 });
            emit(G, { type: 'respawn' });
        }
        return;
    }
    const len = Math.hypot(inp.x, inp.y), k = len > 1 ? 1 / len : 1;
    const sp = PLAYER.speed + PLAYER.speedStep * p.speed;
    p.vx = inp.x * k * sp;
    p.vy = inp.y * k * sp;
    p.x = clamp(p.x + p.vx * dt, PLAYER.margin, W - PLAYER.margin);
    p.y = clamp(p.y + p.vy * dt, PLAYER.minY, H - PLAYER.margin - 14);
    p.bank += clamp(inp.x - p.bank, -dt * 9, dt * 9);          // the sprite leans into a turn
    p.inv = Math.max(0, p.inv - dt);
    p.fireT = Math.max(p.fireT - dt, -dt);
    if (inp.fire && p.fireT <= 0) { fire(G); p.fireT += PLAYER.fireGap[p.weapon]; }
    if (inp.bomb && G.bombs > 0 && !G.bombFx) setOff(G);
}

function hurtPlayer(G) {
    const p = G.player;
    if (!p.alive || p.inv > 0) return;
    if (p.shield) {
        p.shield = 0;
        p.inv = 1.3;
        emit(G, { type: 'shieldbreak', x: p.x, y: p.y });
        return;
    }
    p.alive = false;
    p.respawn = PLAYER.respawn;
    p.weapon = Math.max(1, p.weapon - 2);
    G.lives--;
    G.chain = 0;
    G.chainT = 0;
    G.medal = 0;
    G.stats.deaths++;
    emit(G, { type: 'pdie', x: p.x, y: p.y });
    emit(G, { type: 'boom', x: p.x, y: p.y, size: 2, c: 6 });
    // a ship that dies takes the nearby bullets with it, so the next one is not born under fire
    G.ebullets = G.ebullets.filter((b) => {
        if (Math.hypot(b.x - p.x, b.y - p.y) > 70) return true;
        emit(G, { type: 'cancel', x: b.x, y: b.y });
        return false;
    });
    if (G.lives <= 0) G.endT = 2.6;
}

// ------------------------------------------------------------------ enemies dying
function hurtEnemy(G, e, dmg) {
    if (e.dead || e.inv || (e.boss && e.boss.st === 'dying')) return false;
    e.hp -= dmg;
    e.hitT = 0.07;
    if (e.hp > 0) { emit(G, { type: 'ehit', x: e.x, y: e.y, boss: !!e.boss }); return false; }
    killEnemy(G, e);
    return true;
}

function killEnemy(G, e) {
    const T = TYPES[e.type];
    const plan = G.plan, bonus = plan.kind === 'bonus';
    if (e.boss) {
        e.hp = 0;
        startBossDeath(G, e);
        // the whole screen of bullets turns to sparks
        for (const b of G.ebullets) emit(G, { type: 'cancel', x: b.x, y: b.y });
        G.ebullets.length = 0;
        emit(G, { type: 'bossdying', x: e.x, y: e.y, idx: e.boss.idx });
        return;
    }
    e.dead = true;
    if (e.cnt) plan.killed++;
    G.stats.kills++;
    if (!bonus) {
        G.chain++;
        G.chainT = SCORE.chainWindow;
        G.stats.maxChain = Math.max(G.stats.maxChain, G.chain);
    }
    const pts = bonus ? 200 : T.pts * multiplier(G);
    addScore(G, pts);
    emit(G, { type: 'boom', x: e.x, y: e.y, size: T.size, c: T.c });
    emit(G, { type: 'kill', kind: e.type, x: e.x, y: e.y, pts });
    emit(G, { type: 'popup', x: e.x, y: e.y - 6, text: String(pts) });
    if (e.carry) dropPowerup(G, e.x, e.y, e.carry);
    else if (!bonus && G.rng() < 0.03) dropPowerup(G, e.x, e.y, CARRY[G.dropIdx++ % CARRY.length]);
    if (!bonus && G.rng() < (T.size >= 1 ? 0.45 : 0.1)) dropPowerup(G, e.x + 3, e.y, 'M');
    if (T.burst) {                         // a mine goes off in a ring of bullets
        const sp = 58 + G.diff;
        for (let i = 0; i < T.burst; i++) {
            const a = (i / T.burst) * Math.PI * 2 + e.t;
            if (G.ebullets.length < 90) G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, k: 0 });
        }
    }
}

function bossRewards(G, e) {
    const b = e.boss, pts = 5000 * (b.cycle + 1) + 2500 * b.idx;
    e.dead = true;
    G.plan.killed++;
    G.stats.kills++;
    addScore(G, pts);
    emit(G, { type: 'popup', x: e.x, y: e.y - 10, text: String(pts) });
    // a shower of treasure
    for (const [i, kind] of ['P', 'S', 'B', 'M', 'M', 'M', 'M', 'M'].entries()) {
        G.powerups.push({ x: e.x + (i - 3.5) * 10, y: e.y, vx: (i - 3.5) * 10, vy: 12 + (i % 3) * 8, kind, t: 0 });
    }
    if (b.cycle >= 1 && G.lives < PLAYER.maxLives) G.powerups.push({ x: e.x, y: e.y, vx: 0, vy: 22, kind: '1', t: 0 });
}

// ------------------------------------------------------------------ one step
export function step(G, inp, dt) {
    if (G.over) return;
    G.t += dt;

    updatePlayer(G, inp, dt);
    updateWave(G, dt);
    updateEnemies(G, dt);
    for (const a of G.adds) addEnemy(G, a.type, a.props);
    G.adds.length = 0;

    // bullets
    for (const b of G.pbullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    G.pbullets = G.pbullets.filter((b) => b.y > -6 && b.x > -6 && b.x < W + 6);
    for (const b of G.ebullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    G.ebullets = G.ebullets.filter((b) => b.y > -10 && b.y < H + 10 && b.x > -10 && b.x < W + 10);

    // the bomb: a ring that grows from the ship, hurting what it crosses and wiping the bullets
    const fx = G.bombFx;
    if (fx) {
        fx.t += dt;
        fx.r += BOMB.speed * dt;
        for (const e of G.enemies) {
            if (e.dead || e.bombed === fx.id || e.y < -4) continue;
            if (Math.hypot(e.x - fx.x, e.y - fx.y) < fx.r + e.r) { e.bombed = fx.id; hurtEnemy(G, e, e.boss ? BOMB.bossDmg : BOMB.dmg); }
        }
        G.ebullets = G.ebullets.filter((b) => {
            if (Math.hypot(b.x - fx.x, b.y - fx.y) > fx.r) return true;
            emit(G, { type: 'cancel', x: b.x, y: b.y });
            return false;
        });
        if (fx.t >= BOMB.dur) G.bombFx = null;
    }

    // player bullets against enemies
    for (const b of G.pbullets) {
        if (b.dead) continue;
        for (const e of G.enemies) {
            if (e.dead || e.y < -2 || e.inv) continue;
            if (!touches(e, b.x, b.y, 2)) continue;
            hurtEnemy(G, e, b.dmg);
            if (b.pierce-- <= 0) { b.dead = true; break; }
        }
    }
    G.pbullets = G.pbullets.filter((b) => !b.dead);

    const p = G.player;
    if (p.alive) {
        // enemy bullets, bodies and beams against the ship
        for (const b of G.ebullets) {
            if (Math.hypot(b.x - p.x, b.y - p.y) < PLAYER.r + (b.k === 1 ? 2.6 : 1.8)) { b.dead = true; hurtPlayer(G); break; }
        }
        G.ebullets = G.ebullets.filter((b) => !b.dead);
        for (const e of G.enemies) {
            if (e.dead || e.inv || (e.boss && e.boss.st === 'dying')) continue;
            if (e.beam && e.beam.on && Math.abs(p.x - e.beam.x) < e.beam.w / 2 + PLAYER.r && p.y > e.y + 8) hurtPlayer(G);
            if (touches(e, p.x, p.y, PLAYER.bodyR) && p.alive && p.inv <= 0) {
                hurtPlayer(G);
                if (!e.boss && !e.dead) hurtEnemy(G, e, 4);
            }
        }
        // power-ups
        for (const u of G.powerups) {
            if (Math.hypot(u.x - p.x, u.y - p.y) < PLAYER.pickR + 5) { u.dead = true; collect(G, u); }
        }
    }
    for (const u of G.powerups) {
        u.t += dt;
        u.x = clamp(u.x + u.vx * dt, 8, W - 8);
        if (u.x <= 8 || u.x >= W - 8) u.vx = -u.vx;
        u.y += u.vy * dt;
        u.vx *= 1 - 0.8 * dt;
        u.vy += (u.kind === 'M' ? 10 : 0) * dt;            // medals speed up as they fall
        if (u.y > H + 8) u.dead = true;
    }
    G.powerups = G.powerups.filter((u) => !u.dead);

    // dead bosses pay out once their last explosion has gone off
    for (const e of G.enemies) if (e.bossDone && !e.dead) bossRewards(G, e);
    G.enemies = G.enemies.filter((e) => !e.dead);

    if (G.chainT > 0) { G.chainT -= dt; if (G.chainT <= 0) G.chain = 0; }

    if (G.endT > 0) {
        G.endT -= dt;
        if (G.endT <= 0) {
            G.over = true;
            emit(G, { type: 'over', score: G.score, wave: G.wave });
        }
    }
}

// ------------------------------------------------------------------ saves
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    if (!G.plan || !Array.isArray(G.enemies)) throw new Error('damaged save');
    return G;
}
