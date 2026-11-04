// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// inp = { x, y, jump, jumpHeld, fire, flare }: x and y in [-1, 1] with y UP; jump and flare are
// presses since the last step; fire is held (or tapped since the last step).

import { PLAYER, WEAPONS, FLARE, ACTIVATE_AHEAD, ACTIVATE_BEHIND, SCORE } from '../config.js';
import { makeRng, hash3 } from '../rng.js';
import { LEVELS, buildLevel } from './levels.js';
import { moveBody, onPlatform, inAcid, pointSolid, standable, overlap, clamp, tile, T_SOLID } from './physics.js';
import { ev, addEnemy, hurtPlayer, killPlayer, hitEnemy, hitBoss, hitPod, explode, addScore, inBox } from './common.js';
import { stepEnemies } from './enemies.js';
import { spawnBoss, stepBoss, stepHazards } from './bosses.js';

export const SAVE_V = 1;

export function newGame(seed = 1, opts = {}) {
    const G = {
        v: SAVE_V,
        seed,
        rng: makeRng(seed),
        t: 0,
        score: 0,
        lives: PLAYER.lives,
        levelIdx: 0,
        rescued: LEVELS.map(() => 0),
        stats: { kills: 0, shots: 0, hits: 0, deaths: 0, bossDmg: 0, continues: 0 },
        hard: !!opts.hard,
        god: false,
        events: [],                 // { type, ... } since the last drain; never saved
    };
    loadLevel(G, opts.level || 0);
    return G;
}

/** Start sector idx from the top. Keeps score, lives and the rescue tally. */
export function loadLevel(G, idx) {
    G.levelIdx = idx;
    G.level = buildLevel(idx, G.seed);
    G.rng = makeRng(Math.floor(hash3(G.seed, idx, 5) * 4294967296));
    G.diff = 1 + idx * 0.05 + (G.hard ? 0.18 : 0);
    G.hpScale = 1 + idx * 0.07 + (G.hard ? 0.25 : 0);
    G.phase = 'play';
    G.phaseT = 0;
    G.levelT = 0;
    G.levelDeaths = 0;
    G.levelStartScore = G.score;
    G.rescued[idx] = 0;
    G.nextId = 1;
    G.enemies = [];
    G.pbul = [];
    G.ebul = [];
    G.flares = [];
    G.hazards = [];
    G.boss = null;
    G.arenaLocked = false;
    G.cpIdx = -1;
    G.tally = null;
    const L = G.level;
    G.pods = L.pods.map((p) => ({ ...p, hp: 3, open: false, flash: 0 }));
    G.pickups = L.pickups.map((p, i) => ({ ...p, id: i, taken: false }));
    G.vents = L.vents.map((v) => ({ ...v }));
    G.spawns = L.spawns.map((s) => ({ ...s }));
    const keep = G.player;
    G.player = makePlayer(G, L.start.x, L.start.y);
    if (keep && idx > 0) { G.player.flares = Math.max(PLAYER.flares, Math.min(PLAYER.maxFlares, keep.flares)); G.player.weapon = keep.weapon; }
    ev(G, 'level', { idx, name: LEVELS[idx].name });
}

/** Full health: one less on Hard. */
export const maxHp = (G) => PLAYER.hp - (G.hard ? 1 : 0);

function makePlayer(G, x, y) {
    return {
        x, y, w: PLAYER.w, h: PLAYER.h, vx: 0, vy: 0, ground: false, drop: 0,
        face: 1, aim: { x: 1, y: 0 }, crouch: false, hp: maxHp(G), inv: 1.0,
        coyote: 0, cut: true, jumpBuf: 0, weapon: 'blaster', cool: 0, flares: PLAYER.flares,
        dead: false, safe: { x, y }, runT: 0, fireT: 0, airT: 0,
    };
}

// ====================================================================== player
/** The horizontal speed for a stick value (shared with the bot's jump planner). */
export const runSpeed = (x) => (Math.abs(x) < 0.2 ? 0 : clamp(x * 1.25, -1, 1) * PLAYER.speed);

function stepPlayer(G, inp, dt) {
    const p = G.player, L = G.level;
    if (p.dead) return;
    p.inv = Math.max(0, p.inv - dt);
    const up = inp.y > 0.5, down = inp.y < -0.5;
    const wantCrouch = p.ground && down && Math.abs(inp.x) < 0.45;
    // stand up only if there is room
    if (p.crouch && !wantCrouch) {
        const r = Math.floor(p.y + PLAYER.h - 0.02);
        const c0 = Math.floor(p.x - p.w / 2 + 0.02), c1 = Math.floor(p.x + p.w / 2 - 0.02);
        let room = true;
        for (let c = c0; c <= c1; c++) if (tile(L, c, r) === T_SOLID) room = false;
        p.crouch = !room;
    } else p.crouch = wantCrouch;
    p.h = p.crouch ? PLAYER.hCrouch : PLAYER.h;

    const aimOnly = up && Math.abs(inp.x) < 0.45;          // stand still and point up
    let vx = p.crouch || aimOnly ? 0 : runSpeed(inp.x);
    if (p.knock > 0) { p.knock -= dt; vx = p.knockV; }
    if (vx) p.face = Math.sign(vx);
    else if (Math.abs(inp.x) > (p.crouch ? 0.15 : 0.45)) p.face = Math.sign(inp.x);
    p.vx = vx;

    // jump, coyote time, a short buffer, and drop-through
    p.coyote = p.ground ? PLAYER.coyote : p.coyote - dt;
    if (inp.jump) {
        if (p.ground && down && onPlatform(L, p)) { p.drop = 0.22; p.ground = false; p.coyote = 0; ev(G, 'drop', { x: p.x, y: p.y }); }
        else p.jumpBuf = 0.12;
    }
    if (p.jumpBuf > 0) {
        p.jumpBuf -= dt;
        if (p.coyote > 0) {
            p.vy = PLAYER.jump; p.coyote = 0; p.jumpBuf = 0; p.cut = false; p.crouch = false; p.h = PLAYER.h;
            ev(G, 'jump', { x: p.x, y: p.y });
        }
    }
    if (!inp.jumpHeld && p.vy > 0 && !p.cut) { p.vy *= PLAYER.jumpCut; p.cut = true; }
    p.vy = Math.max(-PLAYER.maxFall, p.vy - PLAYER.gravity * dt);
    const fallV = p.vy;
    const wasGround = p.ground;
    moveBody(L, p, dt);
    if (G.arenaLocked) {
        const a = L.arena;
        let hi = a.x1 - 0.5;
        if (G.boss && G.boss.k === 'queen' && !G.boss.dead) hi = Math.min(hi, G.boss.x - G.boss.w / 2 - 0.5);
        p.x = clamp(p.x, a.x0 + 0.5, hi);
    }
    if (p.ground && !wasGround) ev(G, 'land', { x: p.x, y: p.y, v: -fallV });
    p.airT = p.ground ? 0 : p.airT + dt;
    p.runT = p.ground && vx ? p.runT + dt * Math.abs(vx) / PLAYER.speed : 0;

    // somewhere safe to come back to after a fall
    if (p.ground && !inAcid(L, p) && standable(L, Math.floor(p.x - 0.3), p.y) && standable(L, Math.floor(p.x + 0.3), p.y)) {
        p.safe = { x: p.x, y: p.y };
    }
    if (inAcid(L, p)) {
        if (hurtPlayer(G, 1, 'acid')) ev(G, 'splash', { x: p.x, y: p.y + 0.6 });
        if (!p.dead) { p.vy = 17; p.cut = true; p.ground = false; }
    }
    if (p.y < -1.5) {
        ev(G, 'fall', { x: p.x, y: 0 });
        if (!G.god) { p.inv = 0; hurtPlayer(G, 1, 'fall'); }
        if (!p.dead) { p.x = p.safe.x; p.y = p.safe.y + 0.01; p.vx = p.vy = 0; p.inv = PLAYER.iframes; }
    }

    // aim: eight ways
    let ax = Math.abs(inp.x) > 0.45 ? Math.sign(inp.x) : 0;
    let ay = up ? 1 : down && (!p.ground || ax) ? -1 : 0;
    if (p.crouch) { ax = p.face; ay = 0; }
    if (!ax && !ay) ax = p.face;
    const l = Math.hypot(ax, ay);
    p.aim = { x: ax / l, y: ay / l };

    // fire
    p.cool -= dt;
    p.fireT = Math.max(0, p.fireT - dt);
    if (inp.fire && p.cool <= 0) fire(G, p);
    if (inp.flare && p.flares > 0) {
        p.flares--;
        const upK = p.aim.y > 0.5 ? 1.4 : p.aim.y < -0.5 ? 0.3 : 1;
        G.flares.push({ x: p.x + p.face * 0.4, y: p.y + 1.2, vx: p.face * FLARE.vx * (p.aim.y > 0.9 ? 0.25 : 1) + p.vx * 0.3, vy: FLARE.vy * upK, t: FLARE.fuse, id: G.nextId++ });
        ev(G, 'flareThrow', { x: p.x, y: p.y + 1.2 });
    }
}

export function muzzle(p) {
    const sy = p.crouch ? 0.55 : 1.12;
    return { x: p.x + p.aim.x * 0.75, y: p.y + sy + p.aim.y * 0.7 };
}

function fire(G, p) {
    const W = WEAPONS[p.weapon];
    p.cool = W.rate;
    p.fireT = 0.08;
    const m = muzzle(p);
    const ang = Math.atan2(p.aim.y, p.aim.x);
    const shot = (a, extra = {}) => G.pbul.push({
        x: m.x, y: m.y, vx: Math.cos(a) * W.speed, vy: Math.sin(a) * W.speed,
        k: p.weapon, dmg: W.dmg, life: W.life, pierce: !!W.pierce, hit: [], id: G.nextId++, ...extra,
    });
    if (p.weapon === 'spread') for (let i = 0; i < W.n; i++) shot(ang + (i - (W.n - 1) / 2) * W.fan);
    else shot(ang);
    G.stats.shots++;
    ev(G, 'shot', { x: m.x, y: m.y, k: p.weapon, ax: p.aim.x, ay: p.aim.y });
}

// ====================================================================== bullets, flares, pickups
function stepBullets(G, dt) {
    const L = G.level;
    for (const b of G.pbul) {
        b.life -= dt;
        // two half-steps so fast lances can't skip a thin enemy
        for (let s = 0; s < 2 && b.life > 0; s++) {
            b.x += b.vx * dt / 2;
            b.y += b.vy * dt / 2;
            if (pointSolid(L, b.x, b.y)) {
                if (b.k === 'rocket') explode(G, b.x - Math.sign(b.vx) * 0.2, b.y, WEAPONS.rocket.splash, WEAPONS.rocket.splashDmg, 'rocket');
                else ev(G, 'spark', { x: b.x - b.vx * 0.01, y: b.y - b.vy * 0.01, k: b.k });
                b.life = 0;
                break;
            }
            for (const e of G.enemies) {
                if (e.dead || b.hit.includes(e.id)) continue;
                if (!inBox(b.x, b.y, e, 0.15)) continue;
                hitEnemy(G, e, b.dmg);
                if (b.k === 'rocket') { explode(G, b.x, b.y, WEAPONS.rocket.splash, WEAPONS.rocket.splashDmg, 'rocket'); b.life = 0; break; }
                if (b.pierce) b.hit.push(e.id); else { b.life = 0; break; }
            }
            if (b.life <= 0) break;
            for (const pod of G.pods) {
                if (pod.open || !inBox(b.x, b.y, { x: pod.x, y: pod.y, w: 1.0, h: 1.9 }, 0.1)) continue;
                hitPod(G, pod, 1);
                if (!b.pierce) b.life = 0;
                break;
            }
            if (b.life <= 0) break;
            const B = G.boss;
            if (B && B.vulnerable && !B.dead && !b.hit.includes('boss') && inBox(b.x, b.y, B, 0.1)) {
                if (b.k === 'rocket') { explode(G, b.x, b.y, WEAPONS.rocket.splash, WEAPONS.rocket.dmg + WEAPONS.rocket.splashDmg, 'rocket'); b.life = 0; break; }
                hitBoss(G, b.dmg);
                if (b.pierce) b.hit.push('boss'); else { b.life = 0; break; }
            }
        }
    }
    if (G.pbul.some((b) => b.life <= 0)) G.pbul = G.pbul.filter((b) => b.life > 0);

    const p = G.player;
    for (const b of G.ebul) {
        b.life -= dt;
        b.vy -= b.g * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (pointSolid(L, b.x, b.y) || b.y < 0) {
            b.life = 0;
            if (b.k === 'egg') {
                const e = addEnemy(G, 'hiveling', b.x, Math.max(2, Math.floor(b.y) + 1), {});
                e.face = p.x < b.x ? -1 : 1;
                ev(G, 'hatch', { x: b.x, y: b.y + 0.3 });
            } else ev(G, 'esplash', { x: b.x, y: b.y, k: b.k });
            continue;
        }
        if (!p.dead && inBox(b.x, b.y, p, b.r * 0.8)) {
            if (hurtPlayer(G, 1, b.k)) b.life = 0;
        }
    }
    if (G.ebul.some((b) => b.life <= 0)) G.ebul = G.ebul.filter((b) => b.life > 0);
}

function stepFlares(G, dt) {
    const L = G.level;
    for (const f of G.flares) {
        f.t -= dt;
        f.vy -= FLARE.gravity * dt;
        const nx = f.x + f.vx * dt;
        if (pointSolid(L, nx, f.y)) { f.vx *= -0.4; ev(G, 'flareBounce', { x: f.x, y: f.y }); } else f.x = nx;
        const ny = f.y + f.vy * dt;
        if (pointSolid(L, f.x, ny - 0.1) || tile(L, Math.floor(f.x), Math.floor(ny - 0.1)) === 2 && f.vy < 0) {
            if (f.vy < -3) ev(G, 'flareBounce', { x: f.x, y: f.y });
            f.vy = Math.abs(f.vy) > 3 ? -f.vy * 0.35 : 0;
            f.vx *= 0.6;
        } else f.y = ny;
        if (f.y < -1) f.t = 0;
        for (const e of G.enemies) if (!e.dead && f.t > 0.15 && inBox(f.x, f.y, e, 0.1)) f.t = Math.min(f.t, 0.12);
        if (G.boss?.vulnerable && inBox(f.x, f.y, G.boss, 0.1)) f.t = Math.min(f.t, 0.05);
        if (f.t <= 0) explode(G, f.x, f.y, FLARE.radius, FLARE.dmg, 'flare', { clearShots: true });
    }
    if (G.flares.some((f) => f.t <= 0)) G.flares = G.flares.filter((f) => f.t > 0);
}

function stepWorld(G, dt) {
    const p = G.player, L = G.level;
    // wake the spawn markers near the player
    for (const s of G.spawns) {
        if (s.on || s.x > p.x + ACTIVATE_AHEAD || s.x < p.x - ACTIVATE_BEHIND) continue;
        s.on = true;
        const e = addEnemy(G, s.k, s.x, s.y);
        e.face = p.x < s.x ? -1 : 1;
    }
    for (const pod of G.pods) pod.flash = Math.max(0, pod.flash - dt);
    for (const v of G.vents) {
        v.t = (v.t + dt) % 3;
        const was = v.on;
        v.on = v.t > 1.6;
        v.warn = v.t > 1.2 && !v.on;
        if (v.on && !was) ev(G, 'vent', { x: v.x, y: v.y });
        if (v.on && !p.dead && Math.abs(p.x - v.x) < 0.45 + p.w / 2 && p.y < v.y + 3 && p.y + p.h > v.y) hurtPlayer(G, 1, 'steam');
    }
    if (!p.dead) {
        for (const k of G.pickups) {
            if (k.taken) continue;
            const box = { x: k.x, y: k.y - (k.float ? 0.4 : 0), w: 0.9, h: 0.9 };
            if (!overlap(p, box)) continue;
            k.taken = true;
            if (k.k === 'med') p.hp = maxHp(G);
            else if (k.k === 'flare') p.flares = Math.min(PLAYER.maxFlares, p.flares + 2);
            else p.weapon = k.k;
            addScore(G, 250);
            ev(G, 'pickup', { k: k.k, x: k.x, y: k.y });
        }
        const cps = L.checkpoints;
        while (G.cpIdx + 1 < cps.length && p.x > cps[G.cpIdx + 1].x) {
            G.cpIdx++;
            ev(G, 'checkpoint', { x: cps[G.cpIdx].x, y: cps[G.cpIdx].y });
        }
        if (L.exit && p.x > L.exit.x - 0.3 && Math.abs(p.y - L.exit.y) < 2) clearLevel(G);
        if (L.arena && !G.arenaLocked && p.x > L.arena.x0 + 3.5) {
            G.arenaLocked = true;
            for (const e of G.enemies) e.dead = e.silent = true;
            spawnBoss(G);
        }
    }
}

function clearLevel(G) {
    if (G.phase !== 'play') return;
    const def = LEVELS[G.levelIdx];
    const pods = G.rescued[G.levelIdx];
    const tally = {
        idx: G.levelIdx,
        name: def.name,
        pods, podsTotal: G.pods.length,
        clear: SCORE.clear,
        podBonus: pods >= G.pods.length ? SCORE.perfectPods : 0,
        noDeath: G.levelDeaths === 0 ? SCORE.noDeath : 0,
        time: Math.round(G.levelT),
    };
    tally.total = tally.clear + tally.podBonus + tally.noDeath;
    addScore(G, tally.total);
    G.tally = tally;
    G.ebul.length = 0;
    const last = G.levelIdx === LEVELS.length - 1;
    G.phase = last ? 'won' : 'clear';
    ev(G, last ? 'won' : 'clear', { tally });
}

// ====================================================================== step
/** Advance one fixed step. */
export function step(G, inp, dt) {
    if (G.phase === 'clear' || G.phase === 'won' || G.phase === 'over') return;
    G.t += dt;
    if (G.phase === 'dying') {
        G.phaseT -= dt;
        stepEnemies(G, dt);
        stepBullets(G, dt);
        stepBoss(G, dt);
        if (G.phaseT <= 0) {
            if (G.lives <= 0) { G.phase = 'over'; ev(G, 'over', { score: G.score }); return; }
            respawn(G);
        }
        return;
    }
    G.levelT += dt;
    stepPlayer(G, inp, dt);
    stepWorld(G, dt);
    stepEnemies(G, dt);
    stepBullets(G, dt);
    stepFlares(G, dt);
    stepBoss(G, dt);
    stepHazards(G, dt);
    if (G.boss?.dead && G.boss.deadT <= 0) clearLevel(G);
}

function respawn(G) {
    const L = G.level;
    let at = G.cpIdx >= 0 ? L.checkpoints[G.cpIdx] : L.start;
    if (G.arenaLocked) at = { x: L.arena.x0 + 2.5, y: 2 };
    const keepFlares = G.player.flares;
    G.player = makePlayer(G, at.x, at.y);
    G.player.flares = Math.max(PLAYER.flares, keepFlares);
    G.player.inv = 2.2;
    G.ebul.length = 0;
    G.hazards.length = 0;
    // clear the area you come back to
    for (const e of G.enemies) if (Math.abs(e.x - at.x) < 6 && e.k !== 'nest' && e.k !== 'turret' && e.k !== 'spitter') e.dead = e.silent = true;
    G.phase = 'play';
    ev(G, 'respawn', { x: at.x, y: at.y });
}

/** After game over: try this sector again with full lives; the score goes back to its start. */
export function continueGame(G) {
    G.stats.continues++;
    G.score = G.levelStartScore;
    G.lives = PLAYER.lives;
    G.player = null;
    loadLevel(G, G.levelIdx);
}

/** On to the next sector after a clear. */
export function nextLevel(G) {
    if (G.levelIdx + 1 >= LEVELS.length) return false;
    loadLevel(G, G.levelIdx + 1);
    return true;
}

// ====================================================================== saves
/** The level is rebuilt from (seed, levelIdx); everything else is plain data. */
export function serialize(G) {
    const { rng, events, level, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_V) throw new Error('unknown save version');
    if (!(d.levelIdx >= 0 && d.levelIdx < LEVELS.length)) throw new Error('bad level');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    G.level = buildLevel(G.levelIdx, G.seed);
    return G;
}

export { LEVELS, killPlayer };
