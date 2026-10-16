// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// A sector runs intro → play → clear → warp (→ the next sector's intro). Blow bubbles, trap the
// crew, pop them (touching bubbles pop together, and every enemy in one chain doubles the loot),
// grab the loot. Collect N-E-B-U-L-A from letter bubbles for an extra life and a free sector.
// Dawdle and it's HURRY UP!, and then the Void Wraith comes for you through the walls.

import { W, H, LEFT, RIGHT, PLAYER, BUBBLE, SCORE, ITEMS, POWERS, LETTERS, TIMING, BOSS } from '../config.js';
import { makeRng } from '../rng.js';
import { buildLevel, LAST } from './levels.js';
import { moveBody, surface, segments, clamp } from './physics.js';
import { makeEnemy, stepEnemy, killEnemy, isAngry } from './enemies.js';
import { makeBoss, stepBoss, hitBoss, popBoss } from './boss.js';

export const level = (G) => buildLevel(G.level);

function makePlayer() {
    return {
        x: PLAYER.startX, y: PLAYER.startY, vx: 0, vy: 0, w: PLAYER.w, h: PLAYER.h, ground: true, face: 1,
        state: 'alive', t: 0, inv: 0, cd: 0, stun: 0, blow: 0, bounce: 0,
        powers: { boots: false, long: false, rapid: false },
    };
}

export function newGame(seed = 1, opts = {}) {
    const G = {
        v: 1,                       // save format version
        seed,
        rng: makeRng(seed),
        t: 0,
        level: 0, lt: 0, phase: 'intro', phaseT: 0, nextLevel: 0,
        score: 0,
        lives: opts.lives ?? 2,     // spare lives
        letters: LETTERS.map(() => false),
        lifeIdx: 0, nextLifeAt: SCORE.lives[0],
        continues: 0,
        player: makePlayer(),
        enemies: [], bubbles: [], items: [], shots: [], bolts: [], novas: [], flames: [],
        wraith: null, boss: null,
        hurry: false, hurryAt: 0, wraithAt: 0,
        zapT: 0, novaT: 0, letterT: 0, powerT: 0, powerDone: false, freezeT: 0,
        grp: {},                    // kills per bolt / nova, for the doubling loot
        ldeaths: 0,
        log: [],                    // { level, time, deaths } per sector cleared
        stats: { blown: 0, pops: 0, traps: 0, kills: 0, deaths: 0, bestChain: 0, letters: 0, items: 0 },
        nextId: 1,
        over: false, won: false,
        events: [],                 // { type, ... } since the last drain; never saved
    };
    loadLevel(G, opts.level ?? 0);
    return G;
}

/** Start sector idx: its crew drops in, the loot and bubbles are gone, the timers restart. */
export function loadLevel(G, idx) {
    G.level = Math.max(0, Math.min(LAST, idx));
    const L = level(G);
    G.lt = 0; G.phase = 'intro'; G.phaseT = 0;
    G.enemies = L.spawns.map((s) => makeEnemy(G, s.type, s.x, s.y));
    G.bubbles = []; G.items = []; G.shots = []; G.bolts = []; G.novas = []; G.flames = []; G.grp = {};
    G.wraith = null;
    G.boss = L.boss ? makeBoss(G) : null;
    G.hurry = false; G.hurryAt = L.hurry; G.wraithAt = L.hurry + TIMING.wraithAfter;
    G.zapT = L.boss ? 2 : L.zap ? L.zap * 0.6 : 0;
    G.novaT = L.nova ? L.nova * 0.8 : 0;
    G.letterT = G.rng.range(8, 13);
    G.powerT = G.rng.range(TIMING.powerAt[0], TIMING.powerAt[1]);
    G.powerDone = L.boss;
    G.freezeT = 0;
    G.ldeaths = 0;
    const p = G.player;
    Object.assign(p, { x: PLAYER.startX, y: PLAYER.startY, vx: 0, vy: 0, ground: true, face: 1, state: 'alive', t: 0, stun: 0, cd: 0, inv: 0 });
    G.events.push({ type: 'level', idx: G.level, name: L.name, boss: L.boss });
}

/** After GAME OVER: the same sector again, the score back to zero (an arcade continue). */
export function continueGame(G) {
    G.over = false;
    G.score = 0; G.lives = 2; G.lifeIdx = 0; G.nextLifeAt = SCORE.lives[0];
    G.letters = LETTERS.map(() => false);
    G.continues++;
    G.player.powers = { boots: false, long: false, rapid: false };
    loadLevel(G, G.level);
}

export function addScore(G, n, x = null, y = null) {
    if (!n) return;
    G.score += n;
    if (x != null) G.events.push({ type: 'score', n, x, y });
    while (G.score >= G.nextLifeAt) {
        G.lives++;
        G.lifeIdx++;
        G.nextLifeAt = G.lifeIdx < SCORE.lives.length ? SCORE.lives[G.lifeIdx] : G.nextLifeAt + SCORE.lifeEvery;
        G.events.push({ type: 'life', lives: G.lives });
    }
}

// ====================================================================== the step

/**
 * Advance one fixed step. inp = { x, jump, fire, fireP }: x in [-1, 1]; jump and fire are held
 * (with taps latched until a step sees them); fireP is a fresh press of fire.
 */
export function step(G, inp, dt) {
    if (G.over) return;
    G.t += dt;
    const L = level(G);
    const p = G.player;
    if (G.phase === 'intro') {
        G.phaseT += dt;
        for (const e of G.enemies) stepEnemy(G, L, e, dt);
        stepBoss(G, L, dt);
        p.t += dt;
        if (G.phaseT >= TIMING.intro) {
            G.phase = 'play';
            for (const e of G.enemies) if (e.st === 'enter') { e.st = 'live'; e.t = 0; e.y = e.sy; }
            if (G.boss) G.boss.st = 'live';
            G.events.push({ type: 'go' });
        }
        return;
    }
    if (G.phase === 'warp' || G.phase === 'extend') {
        G.phaseT += dt;
        if (G.phase === 'extend' && G.phaseT >= TIMING.extend) startWarp(G, G.level + 1);
        else if (G.phase === 'warp' && G.phaseT >= TIMING.warp) loadLevel(G, G.nextLevel);
        return;
    }

    // ---- play / clear
    if (p.state === 'dead') {
        p.t += dt;
        p.vy = Math.min(14, p.vy + 30 * dt);
        p.y += p.vy * dt;
        if (p.t >= PLAYER.dieTime) respawn(G);
        return;
    }
    G.lt += dt;
    if (G.phase === 'clear') G.phaseT += dt;
    G.freezeT = Math.max(0, G.freezeT - dt);
    stepPlayer(G, L, inp, dt);
    stepBubbles(G, L, dt);
    playerTouchesBubbles(G, inp);
    for (const e of G.enemies) stepEnemy(G, L, e, dt);
    for (let i = G.enemies.length - 1; i >= 0; i--) {
        const e = G.enemies[i];
        if (e.done) { G.enemies.splice(i, 1); dropLoot(G, L, e.x, e.y, e.item, e.value); }
    }
    stepBoss(G, L, dt);
    stepShots(G, dt);
    stepBolts(G, dt);
    stepNovas(G, L, dt);
    stepWraith(G, dt);
    stepItems(G, L, dt);
    spawners(G, L, dt);
    if (p.state === 'alive') hurtChecks(G);

    if (G.phase === 'play' && !G.enemies.length && !G.boss && !L.boss) {
        G.phase = 'clear'; G.phaseT = 0;
        G.wraith = null; G.shots.length = 0;
        const quick = SCORE.quick.find(([s]) => G.lt < s);
        if (quick) { addScore(G, quick[1]); G.events.push({ type: 'quick', n: quick[1], secs: G.lt }); }
        G.log.push({ level: G.level, time: +G.lt.toFixed(2), deaths: G.ldeaths });
        G.events.push({ type: 'clear', idx: G.level, time: G.lt });
    }
    if (G.phase === 'clear' && (G.phaseT >= TIMING.clearMax || (G.phaseT >= TIMING.clearMin && !G.items.length))) startWarp(G, G.level + 1);
}

function startWarp(G, to) {
    if (to > LAST) to = LAST;
    G.phase = 'warp'; G.phaseT = 0; G.nextLevel = to;
    G.bubbles = []; G.items = []; G.shots = []; G.bolts = []; G.novas = []; G.flames = [];
    G.wraith = null;
    G.events.push({ type: 'warp', from: G.level, to });
}

// ====================================================================== the player

function stepPlayer(G, L, inp, dt) {
    const p = G.player;
    p.inv = Math.max(0, p.inv - dt);
    p.cd -= dt;
    p.blow = Math.max(0, p.blow - dt);
    p.bounce = Math.max(0, p.bounce - dt);
    p.t += dt;
    let dir = inp.x > 0.35 ? 1 : inp.x < -0.35 ? -1 : 0;
    if (p.stun > 0) { p.stun -= dt; dir = 0; }
    p.vx = dir * PLAYER.speed * (p.powers.boots ? 1.3 : 1);
    if (dir) p.face = dir;
    if (inp.jump && p.ground && p.stun <= 0) {
        p.vy = -PLAYER.jumpV; p.ground = false;
        G.events.push({ type: 'jump' });
    }
    if (!p.ground) p.vy = Math.min(PLAYER.maxFall, p.vy + PLAYER.gravity * dt);
    const wasGround = p.ground;
    moveBody(L, p, dt);
    if (p.landed && !wasGround) G.events.push({ type: 'land' });
    if ((inp.fireP || inp.fire) && p.cd <= 0 && p.stun <= 0) {
        p.cd = (p.powers.rapid ? PLAYER.rapidCd : PLAYER.shotCd) * (inp.fireP ? 1 : 1.5);
        blow(G);
    }
}

function blow(G) {
    const p = G.player;
    const r = BUBBLE.r;
    const x = clamp(p.x + p.face * 0.9, LEFT + r, RIGHT - r);
    const y = p.y - p.h * 0.55;
    G.bubbles.push({
        id: G.nextId++, kind: 'plain', mode: 'shot', x, y, vx: p.face * BUBBLE.speed, vy: 0, r, t: 0,
        dist: 0, range: p.powers.long ? BUBBLE.longRange : BUBBLE.range, enemy: null, trapT: 0,
    });
    p.blow = 0.22;
    G.stats.blown++;
    G.events.push({ type: 'blow', x, y });
}

function respawn(G) {
    const p = G.player;
    const L = level(G);
    G.wraith = null;
    G.hurry = false;
    G.hurryAt = G.lt + Math.max(20, L.hurry * 0.6);
    G.wraithAt = G.hurryAt + TIMING.wraithAfter;
    G.shots.length = 0;
    if (G.lives <= 0) {
        G.over = true;
        G.events.push({ type: 'over', score: G.score, level: G.level });
        return;
    }
    G.lives--;
    Object.assign(p, { x: PLAYER.startX, y: PLAYER.startY, vx: 0, vy: 0, ground: true, face: 1, state: 'alive', t: 0, stun: 0, cd: 0, inv: PLAYER.inv });
    p.powers = { boots: false, long: false, rapid: false };
    G.events.push({ type: 'respawn', lives: G.lives });
}

export function killPlayer(G, cause) {
    const p = G.player;
    if (p.state !== 'alive' || p.inv > 0 || (G.phase !== 'play' && G.phase !== 'clear')) return false;
    p.state = 'dead'; p.t = 0; p.vy = -12; p.vx = 0;
    G.stats.deaths++;
    G.ldeaths++;
    G.events.push({ type: 'die', cause, x: p.x, y: p.y - p.h / 2 });
    return true;
}

function hurtChecks(G) {
    const p = G.player;
    if (p.inv > 0) return;
    const pcy = p.y - p.h / 2;
    for (const e of G.enemies) {
        if (e.st !== 'live' || G.freezeT > 0) continue;
        if (Math.abs(e.x - p.x) < (e.w + p.w) / 2 - 0.4 && p.y - p.h + 0.25 < e.y && e.y - e.h + 0.25 < p.y) { killPlayer(G, e.type); return; }
    }
    for (const s of G.shots) {
        if (Math.abs(s.x - p.x) < 0.95 && Math.abs(s.y - pcy) < 1.05) { killPlayer(G, s.kind); return; }
    }
    const w = G.wraith;
    if (w && Math.hypot(w.x - p.x, w.y - pcy) < 1.25) { killPlayer(G, 'wraith'); return; }
    const B = G.boss;
    if (B && B.st === 'live' && Math.abs(B.x - p.x) < (B.w + p.w) / 2 - 0.7 && p.y - p.h + 0.5 < B.y && B.y - B.h + 0.5 < p.y) killPlayer(G, 'boss');
}

// ====================================================================== bubbles

function stepBubbles(G, L, dt) {
    const bs = G.bubbles;
    // floating bubbles push each other apart
    for (let i = 0; i < bs.length; i++) {
        const a = bs[i];
        if (a.mode !== 'float') continue;
        for (let j = i + 1; j < bs.length; j++) {
            const b = bs[j];
            if (b.mode !== 'float') continue;
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
            if (d >= min || d < 1e-6) continue;
            const f = (min - d) * 9 * dt, nx = dx / d, ny = dy / d;
            a.vx -= nx * f; a.vy -= ny * f; b.vx += nx * f; b.vy += ny * f;
        }
    }
    const air = L.air;
    for (let i = bs.length - 1; i >= 0; i--) {
        const b = bs[i];
        b.t += dt;
        if (b.mode === 'shot') {
            const d = b.vx * dt;
            b.x += d; b.dist += Math.abs(d);
            for (const e of G.enemies) {
                if (e.st !== 'live') continue;
                if (Math.abs(e.x - b.x) < e.w / 2 + b.r * 0.75 && Math.abs(e.y - e.h / 2 - b.y) < e.h / 2 + b.r * 0.7) { trap(G, b, e); break; }
            }
            if (b.mode === 'shot') {
                if (b.x < LEFT + b.r || b.x > RIGHT - b.r) { b.x = clamp(b.x, LEFT + b.r, RIGHT - b.r); b.mode = 'float'; b.vx = 0; }
                else if (b.dist >= b.range) { b.mode = 'float'; b.vx *= 0.08; }
            }
            continue;
        }
        // float: rise, then drift to the air current (zap bubbles in the Baron's core just rise)
        let tvx, tvy;
        if (b.kind === 'zap' && L.boss) { tvx = Math.sin(b.t * 1.7 + b.id) * 0.6; tvy = -BUBBLE.rise * 0.8; }
        else {
            tvx = clamp((air.x - b.x) * 1.2, -BUBBLE.drift, BUBBLE.drift) + Math.sin(b.t * 2 + b.id) * 0.25;
            tvy = b.y > air.y + 0.3 ? -BUBBLE.rise : clamp((air.y - b.y) * 2, -BUBBLE.rise, BUBBLE.rise);
        }
        const k = Math.min(1, 3 * dt);
        b.vx += (tvx - b.vx) * k; b.vy += (tvy - b.vy) * k;
        b.x = clamp(b.x + b.vx * dt, LEFT + b.r, RIGHT - b.r);
        b.y = Math.max(1 + b.r, b.y + b.vy * dt);
        if (b.enemy != null) {
            b.trapT += dt;
            const e = G.enemies.find((q) => q.id === b.enemy);
            if (e) { e.x = b.x; e.y = b.y + e.h / 2; }
            if (b.trapT >= BUBBLE.trapTime) { bs.splice(i, 1); if (e) escape(G, e, b); }
        } else if (b.kind === 'boss') {
            if (G.boss) { G.boss.x = b.x; G.boss.y = b.y + G.boss.h / 2; }
        } else {
            const life = b.kind === 'plain' ? BUBBLE.emptyLife : L.boss ? 7 : BUBBLE.specialLife;
            if (b.t >= life) { bs.splice(i, 1); G.events.push({ type: 'fizz', x: b.x, y: b.y, kind: b.kind }); }
        }
    }
}

function trap(G, b, e) {
    e.st = 'trap';
    e.bubble = b.id;
    b.enemy = e.id;
    b.mode = 'float';
    b.vx *= 0.25;
    b.trapT = 0;
    b.r = BUBBLE.r * 1.08;
    G.stats.traps++;
    G.events.push({ type: 'trap', x: b.x, y: b.y, etype: e.type });
}

function escape(G, e, b) {
    e.st = 'live';
    e.mad = true;
    e.bubble = null;
    e.x = clamp(b.x, LEFT + e.w / 2, RIGHT - e.w / 2);
    e.y = b.y + e.h / 2;
    e.vx = 0; e.vy = 0; e.ground = false; e.think = 0.2;
    G.events.push({ type: 'escape', x: b.x, y: b.y, etype: e.type });
}

function playerTouchesBubbles(G, inp) {
    const p = G.player;
    if (p.state !== 'alive') return;
    const cx = p.x, cy = p.y - p.h / 2;
    for (const b of [...G.bubbles]) {
        if (b.mode === 'shot' || !G.bubbles.includes(b)) continue;
        if (b.kind === 'plain' && b.enemy == null && b.t < 0.3) continue;
        const dx = b.x - cx, dy = b.y - cy;
        const reach = b.r + 0.72;
        if (dx * dx + dy * dy >= reach * reach) continue;
        const onTop = p.vy >= 0 && !p.ground && p.y <= b.y - b.r * 0.2;
        if (onTop && inp.jump && b.kind === 'plain') {
            p.vy = -PLAYER.jumpV;
            p.bounce = 0.25;
            b.vy += 2.2;
            G.events.push({ type: 'bounce', x: b.x, y: b.y });
            return;
        }
        popChain(G, b);
        return;
    }
}

/** Pop a bubble and every bubble touching it, and every bubble touching those. */
export function popChain(G, b0) {
    const L = level(G);
    const set = [b0];
    const inSet = new Set([b0.id]);
    for (let i = 0; i < set.length; i++) {
        const a = set[i];
        for (const b of G.bubbles) {
            if (inSet.has(b.id) || b.mode === 'shot') continue;
            if (Math.hypot(b.x - a.x, b.y - a.y) < a.r + b.r + BUBBLE.chainGap) { set.push(b); inSet.add(b.id); }
        }
    }
    G.bubbles = G.bubbles.filter((b) => !inSet.has(b.id));
    let n = 0;
    for (const b of set) {
        G.events.push({ type: 'pop', x: b.x, y: b.y, kind: b.kind, trapped: b.enemy != null, r: b.r });
        G.stats.pops++;
        if (b.enemy != null) {
            const e = G.enemies.find((q) => q.id === b.enemy);
            if (e) {
                e.bubble = null;
                const k = Math.min(n, SCORE.chain.length - 1);
                killEnemy(G, e, SCORE.chain[k], k, 'pop');
                G.stats.kills++;
                n++;
            }
        } else if (b.kind === 'zap') fireZap(G, b);
        else if (b.kind === 'nova') G.novas.push({ id: G.nextId++, x: b.x, y: b.y + 0.4, w: 0.8, h: 0.8, vx: 0, vy: 4, ground: false, t: 0 });
        else if (b.kind === 'letter') collectLetter(G, L, b.letter);
        else if (b.kind === 'boss') popBoss(G, b);
        else addScore(G, SCORE.pop);
    }
    if (n >= 2) G.events.push({ type: 'chain', n, x: b0.x, y: b0.y });
    G.stats.bestChain = Math.max(G.stats.bestChain, n);
}

function collectLetter(G, L, idx) {
    G.letters[idx] = true;
    G.stats.letters++;
    addScore(G, SCORE.letter);
    G.events.push({ type: 'letter', idx, letter: LETTERS[idx] });
    if (!G.letters.every(Boolean)) return;
    G.letters = LETTERS.map(() => false);
    G.lives++;
    G.events.push({ type: 'extend', lives: G.lives });
    if (!L.boss && G.phase === 'play' && G.level < LAST - 1) {
        // EXTEND: the sector is skipped, the crew teleports out
        G.phase = 'extend'; G.phaseT = 0;
        G.enemies = []; G.bubbles = []; G.shots = []; G.wraith = null;
    }
}

// ====================================================================== zaps, novas, shots

function fireZap(G, b) {
    let vx = G.player.face * 22, vy = 0;
    const B = G.boss;
    const homing = !!(B && B.st === 'live');
    if (homing) {
        // in the Baron's core a bolt seeks him out
        const dx = B.x - b.x, dy = B.y - B.h / 2 - b.y, d = Math.hypot(dx, dy) || 1;
        vx = (dx / d) * 22; vy = (dy / d) * 22;
    }
    const id = G.nextId++;
    G.bolts.push({ id, x: b.x, y: b.y, vx, vy, t: 0, hitBoss: false, homing });
    G.grp[id] = 0;
    G.events.push({ type: 'zap', x: b.x, y: b.y, vx, vy });
}

function grpKill(G, grp, e, cause) {
    const n = G.grp[grp] ?? 0;
    const k = Math.min(n, SCORE.zap.length - 1);
    killEnemy(G, e, SCORE.zap[k], Math.min(k + 1, ITEMS.length - 1), cause);
    G.grp[grp] = n + 1;
    G.stats.kills++;
}

function stepBolts(G, dt) {
    for (let i = G.bolts.length - 1; i >= 0; i--) {
        const z = G.bolts[i];
        z.t += dt;
        const B0 = G.boss;
        if (z.homing && B0 && B0.st === 'live' && !z.hitBoss) {
            const dx = B0.x - z.x, dy = B0.y - B0.h / 2 - z.y, d = Math.hypot(dx, dy) || 1;
            z.vx = (dx / d) * 22; z.vy = (dy / d) * 22;
        }
        z.x += z.vx * dt;
        z.y += z.vy * dt;
        for (const e of G.enemies) {
            if (e.st !== 'live' && e.st !== 'trap') continue;
            if (Math.abs(e.x - z.x) < e.w / 2 + 0.6 && Math.abs(e.y - e.h / 2 - z.y) < e.h / 2 + 0.6) grpKill(G, z.id, e, 'zap');
        }
        const B = G.boss;
        if (B && B.st === 'live' && !z.hitBoss && Math.abs(B.x - z.x) < B.w / 2 && Math.abs(B.y - B.h / 2 - z.y) < B.h / 2 + 0.9) { z.hitBoss = true; hitBoss(G); }
        if (z.x < -2 || z.x > W + 2 || z.y < -2 || z.y > H + 2) { G.bolts.splice(i, 1); delete G.grp[z.id]; }
    }
}

function stepNovas(G, L, dt) {
    for (let i = G.novas.length - 1; i >= 0; i--) {
        const n = G.novas[i];
        n.t += dt;
        n.vy = Math.min(14, n.vy + 40 * dt);
        moveBody(L, n, dt);
        if (!n.ground && n.t < 4) continue;
        G.novas.splice(i, 1);
        if (!n.ground) continue;
        const r = Math.round(n.y), c0 = Math.floor(n.x);
        G.grp[n.id] = 0;
        G.events.push({ type: 'nova', x: n.x, y: n.y });
        for (const dir of [-1, 1]) {
            for (let k = dir < 0 ? 0 : 1; k <= 5; k++) {
                const c = c0 + dir * k;
                if (!surface(L, c, r)) break;
                G.flames.push({ grp: n.id, c, r, t: -k * 0.07 });
            }
        }
    }
    const p = G.player;
    for (let i = G.flames.length - 1; i >= 0; i--) {
        const f = G.flames[i];
        f.t += dt;
        if (f.t >= TIMING.flame) { G.flames.splice(i, 1); continue; }
        if (f.t < 0) continue;
        const fx = f.c + 0.5, fy = f.r;
        for (const e of G.enemies) {
            if (e.st !== 'live') continue;
            if (Math.abs(e.x - fx) < e.w / 2 + 0.4 && e.y > fy - 1.2 && e.y - e.h < fy) grpKill(G, f.grp, e, 'nova');
        }
        if (p.state === 'alive' && p.stun <= 0 && p.inv <= 0 && Math.abs(p.x - fx) < p.w / 2 + 0.3 && Math.abs(p.y - fy) < 0.6) {
            p.stun = PLAYER.stun;
            G.events.push({ type: 'burn', x: p.x, y: p.y });
        }
    }
    if (!G.flames.length && !G.novas.length) for (const k of Object.keys(G.grp)) if (!G.bolts.some((z) => String(z.id) === k)) delete G.grp[k];
}

function stepShots(G, dt) {
    for (let i = G.shots.length - 1; i >= 0; i--) {
        const s = G.shots[i];
        s.t += dt;
        if (G.freezeT > 0 && s.kind !== 'orb') continue;
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.x < LEFT - 0.5 || s.x > RIGHT + 0.5 || s.y < -1 || s.y > H + 1 || s.t > 8) G.shots.splice(i, 1);
    }
}

function stepWraith(G, dt) {
    if (G.phase !== 'play') return;
    if (!G.hurry && G.lt >= G.hurryAt && !level(G).boss) {
        G.hurry = true;
        G.events.push({ type: 'hurry' });
    }
    if (!G.wraith && G.hurry && G.lt >= G.wraithAt) {
        G.wraith = { x: 16, y: -1.5, t: 0 };
        G.events.push({ type: 'wraith' });
    }
    const w = G.wraith;
    if (!w) return;
    w.t += dt;
    const p = G.player;
    const sp = Math.min(6.4, 2.2 + 0.14 * w.t);
    const dx = p.x - w.x, dy = p.y - p.h / 2 - w.y, d = Math.hypot(dx, dy) || 1;
    w.x += (dx / d) * sp * dt;
    w.y += (dy / d) * sp * dt;
}

// ====================================================================== loot

function dropLoot(G, L, x, y, item, value) {
    const def = ITEMS[Math.min(item, ITEMS.length - 1)];
    G.items.push({ id: G.nextId++, kind: def.id, value, x: clamp(x, LEFT + 0.6, RIGHT - 0.6), y, vx: 0, vy: 0, w: 1.2, h: 1.2, ground: false, t: 0 });
}

function stepItems(G, L, dt) {
    const p = G.player;
    for (let i = G.items.length - 1; i >= 0; i--) {
        const it = G.items[i];
        it.t += dt;
        if (!it.ground) { it.vy = Math.min(PLAYER.maxFall, it.vy + PLAYER.gravity * 0.8 * dt); moveBody(L, it, dt); }
        if (it.t > TIMING.itemLife && G.phase === 'play' && it.kind !== 'heart') { G.items.splice(i, 1); G.events.push({ type: 'fade', x: it.x, y: it.y }); continue; }
        if (p.state !== 'alive') continue;
        if (Math.abs(it.x - p.x) < (it.w + p.w) / 2 - 0.1 && Math.abs((it.y - it.h / 2) - (p.y - p.h / 2)) < (it.h + p.h) / 2 - 0.1) {
            G.items.splice(i, 1);
            collect(G, it);
            if (G.phase === 'warp' || G.over) return;     // a Wormhole or the Nebula Heart
        }
    }
}

function collect(G, it) {
    const p = G.player;
    G.stats.items++;
    if (it.kind === 'heart') {
        addScore(G, SCORE.heart, it.x, it.y - 1);
        G.won = true;
        G.over = true;
        G.log.push({ level: G.level, time: +G.lt.toFixed(2), deaths: G.ldeaths });
        G.events.push({ type: 'ending', score: G.score });
        return;
    }
    if (it.kind.startsWith('p:')) {
        const k = it.kind.slice(2);
        G.events.push({ type: 'power', kind: k, x: it.x, y: it.y });
        if (k in p.powers) p.powers[k] = true;
        else if (k === 'clock') G.freezeT = TIMING.clock;
        else if (k === 'bomb') {
            let n = 0;
            for (const e of G.enemies) if (e.st === 'live' || e.st === 'trap' || e.st === 'enter') { killEnemy(G, e, SCORE.bomb, 2, 'bomb'); n++; }
            G.stats.kills += n;
            G.events.push({ type: 'bomb', n });
        } else if (k === 'warp') {
            G.log.push({ level: G.level, time: +G.lt.toFixed(2), deaths: G.ldeaths, warp: true });
            startWarp(G, G.level + 4);
        }
        return;
    }
    addScore(G, it.value, it.x, it.y - 1);
    G.events.push({ type: 'item', kind: it.kind, value: it.value, x: it.x, y: it.y });
}

// ====================================================================== spawners

function spawners(G, L, dt) {
    if (G.phase !== 'play') return;
    const rng = G.rng;
    const specials = G.bubbles.filter((b) => b.kind !== 'plain' && b.kind !== 'boss').length;
    const rise = (kind, extra = {}) => {
        const x = L.boss ? rng.range(4, 28) : rng.range(14, 18);
        G.bubbles.push({ id: G.nextId++, kind, mode: 'float', x, y: H + 1.2, vx: 0, vy: -BUBBLE.rise, r: BUBBLE.r, t: 0, enemy: null, trapT: 0, ...extra });
    };
    if (L.boss) {
        G.zapT -= dt;
        if (G.zapT <= 0) {
            G.zapT = BOSS.zapEvery;
            if (G.boss?.st === 'live' && G.bubbles.filter((b) => b.kind === 'zap').length < 6) rise('zap');
        }
        return;
    }
    if (L.zap) {
        G.zapT -= dt;
        if (G.zapT <= 0) { G.zapT = L.zap; if (specials < 4) rise('zap'); }
    }
    if (L.nova) {
        G.novaT -= dt;
        if (G.novaT <= 0) { G.novaT = L.nova; if (specials < 4) rise('nova'); }
    }
    G.letterT -= dt;
    if (G.letterT <= 0) {
        G.letterT = rng.range(11, 16);
        const missing = G.letters.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
        if (missing.length && !G.bubbles.some((b) => b.kind === 'letter')) rise('letter', { letter: rng.pick(missing) });
    }
    if (!G.powerDone && G.lt >= G.powerT) {
        G.powerDone = true;
        if (rng() < 0.75) spawnPower(G, L);
    }
}

function spawnPower(G, L) {
    const rng = G.rng;
    const p = G.player;
    const pool = Object.entries(POWERS).filter(([k]) => !(k in p.powers && p.powers[k]) && (k !== 'warp' || G.level + 4 <= LAST - 1));
    let sum = pool.reduce((a, [, d]) => a + d.w, 0);
    let roll = rng() * sum, kind = pool[0][0];
    for (const [k, d] of pool) { roll -= d.w; if (roll <= 0) { kind = k; break; } }
    const segs = segments(L).filter((s) => s.r > 2);
    const spots = [];
    for (const s of segs) for (let c = s.c0; c <= s.c1; c++) if (Math.abs(c + 0.5 - p.x) > 4 || Math.abs(s.r - p.y) > 3) spots.push([c + 0.5, s.r]);
    if (!spots.length) return;
    const [x, y] = rng.pick(spots);
    G.items.push({ id: G.nextId++, kind: 'p:' + kind, value: 0, x, y, vx: 0, vy: 0, w: 1.2, h: 1.2, ground: true, t: -TIMING.itemLife * 0.5 });
    G.events.push({ type: 'powerAppear', kind, x, y });
}

// ====================================================================== saves

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    if (!(d.level >= 0 && d.level <= LAST)) throw new Error('bad level');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}

/** For the HUD: is anyone angry because of the clock? */
export const angryNow = (G, e) => isAngry(G, e);
