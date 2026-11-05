// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// The player walks on the outside of a small asteroid. Their position is a unit vector p and
// their frame is a unit tangent f ("screen up"), carried along by parallel transport as they
// walk, so pushing the stick up always walks up the screen while the rock turns underneath.
// Input arrives in screen terms: { x, y } to move and { ax, ay } to aim (y down), `fire` held,
// `dash` an edge.

import { LIVES, PLAYER, DASH, BUL, EBUL, TURRET, ENEMY, ENEMY_SIGHT, ENEMY_TRACK, BOSS, PICKUP, SCORE, PHASE, EXIT } from '../config.js';
import { LEVELS } from './data.js';
import { makeRng } from '../rng.js';
import * as V from './vec.js';
import { buildWorld, cellOf, collideWalls, inWall, los, bfs } from './world.js';

export function newGame(seed = 1, { level = 0, cadet = false } = {}) {
    const G = {
        v: 1,
        seed,
        rng: makeRng(seed),
        t: 0,
        lt: 0,                      // time on this asteroid
        score: 0,
        lives: cadet ? LIVES + 2 : LIVES,
        cadet,                      // the gentler difficulty: less damage taken, two more lives
        level: 0,
        levelSeed: 0,
        phase: 'intro',             // intro | play | dead | warp | over | won
        phaseT: PHASE.intro,
        over: false,
        won: false,
        nextId: 1,
        kills: 0,
        player: null,
        bullets: [],
        enemies: [],
        turrets: [],
        pickups: [],
        boss: null,
        exit: null,
        spawnT: 0,
        events: [],                 // { type, ... } since the last drain; never saved
    };
    G.player = { p: [0, 1, 0], f: [0, 0, -1], aim: [0, 0, -1], hp: PLAYER.hp, inv: 0, dashT: 0, dashCd: 0, dashDir: [0, 0, -1], fireCd: 0, power: 1, moving: 0 };
    loadLevel(G, level);
    return G;
}

export const levelDef = (G) => LEVELS[G.level];
export const right = (P) => V.cross(P.f, P.p);

function loadLevel(G, n) {
    G.level = n;
    G.levelSeed = (G.rng() * 2147483647) | 0;
    G.world = buildWorld(LEVELS[n], G.levelSeed);
    G.flow = null; G.flowCell = -1;
    const W = G.world, def = LEVELS[n];
    const P = G.player;
    P.p = W.cells[W.start].c.slice();
    P.f = V.norm(V.tangent(P.p, [0, 0, -1]));
    P.aim = P.f.slice();
    P.hp = Math.max(P.hp, PLAYER.hp * 0.5);
    P.inv = 0; P.dashT = 0; P.dashCd = 0; P.fireCd = 0;
    G.bullets = []; G.enemies = []; G.pickups = [];
    G.turrets = W.turretCells.map((ci, k) => {
        const kind = def.boss ? 'pylon' : def.tkinds[k % def.tkinds.length];
        const hp = def.boss ? TURRET.pylonHp : TURRET.hp + TURRET.hpPerLevel * n;
        const c = W.cells[ci].c.slice();
        return { id: G.nextId++, kind, fire: def.boss ? def.tkinds[k % def.tkinds.length] : kind, p: c, cell: ci, hp, maxHp: hp, alive: true, aim: V.anyTangent(c), cd: 1 + G.rng(), burst: 0, bt: 0, sees: false, alarmed: false, seeT: G.rng() * 0.15, ring: 0 };
    });
    G.boss = def.boss ? { p: W.cells[W.bossCell].c.slice(), hp: BOSS.hp, maxHp: BOSS.hp, shield: true, alive: true, t: 0, ang: 0, cd: 3, mode: 0 } : null;
    G.exit = { p: W.cells[W.exit].c.slice(), cell: W.exit, open: false };
    G.lt = 0;
    G.phase = 'intro'; G.phaseT = PHASE.intro;
    G.spawnT = def.spawn;
    // a first wave waits in the hangars
    for (let i = 0; i < Math.ceil(def.cap / 2); i++) spawnEnemy(G, true);
    G.events.push({ type: 'level', n, name: def.name });
}

// ------------------------------------------------------------------ helpers
const distW = (G, a, b) => V.chord(a, b) * G.world.R;       // chord ≈ arc for the short ranges that matter

/** Walk entity position p by a tangent velocity vel (world units/s). Returns { p, vel } carried along. */
function move(G, p, vel, dt) {
    const sp = V.len(vel);
    if (sp < 1e-9) return { p, vel };
    const u = V.scale(vel, 1 / sp);
    const w = V.walk(p, u, (sp * dt) / G.world.R);
    const [p2, u2] = V.tidy(w.p, w.d);
    return { p: p2, vel: V.scale(u2, sp), u, u2: w.d };
}

/** Push p out of a round obstacle at c (radii in world units). */
function pushOut(G, p, c, r) {
    const d = distW(G, p, c);
    if (d >= r) return p;
    let away = V.tangent(p, V.sub(p, c));
    away = V.len(away) > 1e-9 ? V.norm(away) : V.anyTangent(p);
    return V.norm(V.madd(p, away, (r - d) / G.world.R));
}

function obstacles(G) {
    const o = [];
    for (const t of G.turrets) if (t.alive) o.push([t.p, TURRET.r]);
    if (G.boss?.alive) o.push([G.boss.p, BOSS.r]);
    return o;
}

function fireBolt(G, p, d, spd = EBUL.speed + EBUL.perLevel * G.level) {
    const start = V.walk(p, d, 0.9 / G.world.R);
    G.bullets.push({ p: start.p, d: start.d, spd, life: EBUL.life, own: 0, dmg: EBUL.dmg, r: EBUL.r });
}

// ------------------------------------------------------------------ step
/** Advance one fixed step. */
export function step(G, inp, dt) {
    if (G.over) return;
    G.t += dt;
    if (G.phase === 'warp') {
        G.phaseT -= dt;
        if (G.phaseT <= 0) {
            if (G.level >= LEVELS.length - 1) {
                G.phase = 'won'; G.over = true; G.won = true;
                G.events.push({ type: 'win', score: G.score });
            } else loadLevel(G, G.level + 1);
        }
        return;
    }
    if (G.phase === 'dead') {
        G.phaseT -= dt;
        stepBullets(G, dt);
        if (G.phaseT <= 0) respawn(G);
        return;
    }
    if (G.phase === 'intro') {
        G.phaseT -= dt;
        if (G.phaseT <= 0) { G.phase = 'play'; G.events.push({ type: 'go' }); }
    } else G.lt += dt;
    const live = G.phase === 'play';
    stepPlayer(G, inp, dt);
    stepBullets(G, dt);
    if (live) {
        stepTurrets(G, dt);
        stepBoss(G, dt);
        stepEnemies(G, dt);
        stepSpawns(G, dt);
    }
    stepPickups(G, dt);
    // the gate
    const P = G.player;
    if (G.exit.open && G.phase === 'play' && distW(G, P.p, G.exit.p) < EXIT.r + PLAYER.r) {
        const bonus = SCORE.clear + Math.max(0, Math.round(SCORE.par - G.lt)) * SCORE.timeBonus + Math.round(P.hp) * SCORE.hpBonus;
        G.score += bonus;
        G.phase = 'warp'; G.phaseT = PHASE.warp;
        G.bullets = []; G.enemies = [];
        G.events.push({ type: 'warp', bonus, level: G.level });
    }
}

function stepPlayer(G, inp, dt) {
    const P = G.player, W = G.world;
    P.inv = Math.max(0, P.inv - dt);
    P.dashT = Math.max(0, P.dashT - dt);
    P.dashCd -= dt;
    P.fireCd -= dt;
    const R0 = right(P);
    let mx = inp.x || 0, my = inp.y || 0;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const mv = [R0[0] * mx - P.f[0] * my, R0[1] * mx - P.f[1] * my, R0[2] * mx - P.f[2] * my];
    let ax = inp.ax || 0, ay = inp.ay || 0;
    const al = Math.hypot(ax, ay);
    if (al > 0.25) P.aim = V.norm([R0[0] * ax - P.f[0] * ay, R0[1] * ax - P.f[1] * ay, R0[2] * ax - P.f[2] * ay]);
    else if (ml > 0.3 && !inp.fire) P.aim = V.norm(mv);

    if (inp.dash && P.dashCd <= 0) {
        P.dashDir = ml > 0.15 ? V.norm(mv) : P.aim.slice();
        P.dashT = DASH.t; P.dashCd = DASH.cd;
        G.events.push({ type: 'dash' });
    }
    const vel = P.dashT > 0 ? V.scale(P.dashDir, PLAYER.speed * DASH.mult) : V.scale(mv, PLAYER.speed);
    P.moving = V.len(vel);
    P.vel = vel;
    if (P.moving > 1e-6) {
        const m = move(G, P.p, vel, dt);
        // carry the frame, the aim and the dash heading along the same walk
        const f = V.transport(P.f, P.p, m.u, m.u2);
        const a = V.transport(P.aim, P.p, m.u, m.u2);
        const dd = V.transport(P.dashDir, P.p, m.u, m.u2);
        let p = m.p;
        let hit;
        [p, hit] = collideWalls(W, p, PLAYER.r);
        for (const [c, r] of obstacles(G)) p = pushOut(G, p, c, r + PLAYER.r);
        P.p = p;
        [, P.f] = V.tidy(p, f);
        [, P.aim] = V.tidy(p, a);
        [, P.dashDir] = V.tidy(p, dd);
    }
    if (inp.fire && P.fireCd <= 0) shoot(G);
}

function shoot(G) {
    const P = G.player, R = G.world.R;
    const side = V.cross(P.aim, P.p);
    const pattern = P.power >= 3 ? [[0, -0.14], [0, 0], [0, 0.14]] : P.power === 2 ? [[-0.2, 0], [0.2, 0]] : [[0, 0]];
    for (const [off, ang] of pattern) {
        let p = P.p, d = P.aim;
        if (off) { const s = V.walk(p, V.scale(side, Math.sign(off)), Math.abs(off) / R); p = s.p; d = V.norm(V.tangent(p, d)); }
        if (ang) d = V.turn(p, d, ang);
        const w = V.walk(p, d, 0.55 / R);
        G.bullets.push({ p: w.p, d: w.d, spd: BUL.speed, life: BUL.life, own: 1, dmg: BUL.dmg, r: BUL.r });
    }
    P.fireCd = BUL.cd;
    G.events.push({ type: 'shot', power: P.power });
}

function hurt(G, dmg) {
    const P = G.player;
    if (P.inv > 0 || P.dashT > 0 || G.phase !== 'play') return false;
    P.hp -= G.cadet ? dmg * 0.6 : dmg;
    P.inv = PLAYER.iframes;
    G.events.push({ type: 'hurt', dmg, hp: P.hp });
    if (P.hp <= 0) die(G);
    return true;
}

function die(G) {
    const P = G.player;
    G.lives--;
    P.hp = 0;
    G.events.push({ type: 'die', p: P.p.slice(), lives: G.lives });
    if (G.lives <= 0) {
        G.phase = 'over'; G.over = true;
        G.events.push({ type: 'over', score: G.score });
    } else {
        G.phase = 'dead'; G.phaseT = PHASE.dead;
    }
}

function respawn(G) {
    const P = G.player, W = G.world;
    P.p = W.cells[W.start].c.slice();
    P.f = V.norm(V.tangent(P.p, P.f));
    if (V.len(P.f) < 0.5) P.f = V.anyTangent(P.p);
    P.aim = P.f.slice();
    P.hp = PLAYER.hp; P.inv = PLAYER.respawnInv; P.dashT = 0;
    P.power = Math.max(1, P.power - 1);
    G.enemies = G.enemies.filter((e) => distW(G, e.p, P.p) > 12);
    G.bullets = G.bullets.filter((b) => b.own);
    G.phase = 'play';
    G.events.push({ type: 'respawn' });
}

function stepBullets(G, dt) {
    const W = G.world, R = W.R, P = G.player;
    const list = G.bullets;
    for (let i = list.length - 1; i >= 0; i--) {
        // a hit can end the boss or the player, which replaces the list: stop iterating the old one
        if (G.bullets !== list || i >= list.length) break;
        const b = list[i];
        const w = V.walk(b.p, b.d, (b.spd * dt) / R);
        [b.p, b.d] = V.tidy(w.p, w.d);
        b.life -= dt;
        let gone = b.life <= 0;
        if (!gone && inWall(W, b.p, b.r)) {
            gone = true;
            G.events.push({ type: 'spark', p: b.p.slice(), own: b.own });
        }
        if (!gone && b.own) {
            for (let j = G.enemies.length - 1; j >= 0 && !gone; j--) {
                const e = G.enemies[j];
                if (distW(G, b.p, e.p) < ENEMY[e.kind].r + b.r) { gone = true; damageEnemy(G, j, b.dmg); }
            }
            for (const t of G.turrets) {
                if (gone || !t.alive) continue;
                if (distW(G, b.p, t.p) < TURRET.r + b.r) { gone = true; damageTurret(G, t, b.dmg); }
            }
            const B = G.boss;
            if (!gone && B?.alive && distW(G, b.p, B.p) < BOSS.r + b.r) {
                gone = true;
                if (B.shield) G.events.push({ type: 'deflect', p: b.p.slice() });
                else damageBoss(G, b.dmg);
            }
        } else if (!gone && G.phase === 'play' && distW(G, b.p, P.p) < PLAYER.r + b.r) {
            if (P.dashT <= 0) { gone = true; hurt(G, b.dmg); }
        }
        if (gone && G.bullets === list) list.splice(i, 1);
    }
}

// ------------------------------------------------------------------ turrets and the boss
function stepTurrets(G, dt) {
    const P = G.player, W = G.world;
    for (const t of G.turrets) {
        if (!t.alive) continue;
        t.seeT -= dt;
        if (t.seeT <= 0) {
            t.seeT = 0.15;
            const was = t.sees;
            t.sees = los(W, t.p, P.p, TURRET.range);
            if (t.sees && !was) {
                t.cd = Math.min(t.cd, 0.6);
                // the first sighting sounds the alarm: the hangar launches what it has
                if (!t.alarmed) {
                    t.alarmed = true;
                    const kind = pickKind(G);
                    for (let i = 0; i < TURRET.alarm && G.enemies.length < levelDef(G).cap + 2; i++) spawnAt(G, kind, t.p, TURRET.r + ENEMY[kind].r + 0.5);
                    G.events.push({ type: 'alarm', id: t.id, p: t.p.slice() });
                }
            }
        }
        if (t.sees) {
            // later beacons lead their shots at where the player is going
            const lead = G.level >= 2 && P.vel ? Math.min(1, G.level * 0.15) * (V.chord(t.p, P.p) * W.R) / (EBUL.speed + EBUL.perLevel * G.level) : 0;
            const want = V.toward(t.p, lead ? V.norm(V.madd(P.p, P.vel, lead / W.R)) : P.p);
            const a = V.angleTo(t.p, t.aim, want);
            const k = Math.max(-TURRET.turn * dt, Math.min(TURRET.turn * dt, a));
            t.aim = V.norm(V.tangent(t.p, V.turn(t.p, t.aim, k)));
            t.cd -= dt;
            const aimed = Math.abs(a) < 0.3;
            if (t.fire === 'ring' && t.cd <= 0) {
                t.ring += 0.35;
                for (let i = 0; i < 10; i++) fireBolt(G, t.p, V.turn(t.p, t.aim, t.ring + (i * Math.PI * 2) / 10), EBUL.speed * 0.8);
                t.cd = TURRET.cd.ring;
                G.events.push({ type: 'tfire', id: t.id, kind: 'ring' });
            } else if (t.fire !== 'ring' && t.cd <= 0 && aimed) {
                t.burst = t.fire === 'burst' ? 3 : 1; t.bt = 0;
                t.cd = TURRET.cd[t.fire] * (1 - G.level * 0.04);
            }
        } else t.cd = Math.max(t.cd, 0.5);
        if (t.burst > 0) {
            t.bt -= dt;
            if (t.bt <= 0) {
                fireBolt(G, t.p, t.aim);
                t.burst--; t.bt = 0.13;
                G.events.push({ type: 'tfire', id: t.id, kind: t.fire });
            }
        }
    }
}

function damageTurret(G, t, dmg) {
    t.hp -= dmg;
    G.events.push({ type: 'thit', id: t.id, p: t.p.slice() });
    if (t.hp > 0) return;
    t.alive = false;
    const pylon = t.kind === 'pylon';
    G.score += pylon ? SCORE.pylon : SCORE.turret;
    const left = G.turrets.filter((x) => x.alive).length;
    G.events.push({ type: 'turretDown', id: t.id, p: t.p.slice(), left, pylon });
    dropPickup(G, t.p, G.rng() < 0.4 ? 'repair' : G.rng() < 0.6 ? 'power' : 'crystal');
    if (left === 0) {
        if (G.boss?.alive) { G.boss.shield = false; G.events.push({ type: 'shieldDown' }); }
        else openExit(G);
    }
}

function openExit(G) {
    if (G.exit.open) return;
    G.exit.open = true;
    G.events.push({ type: 'exitOpen', p: G.exit.p.slice() });
}

function stepBoss(G, dt) {
    const B = G.boss;
    if (!B?.alive) return;
    const P = G.player;
    B.t += dt;
    B.ang += dt * (B.shield ? 0.5 : 0.9);
    const d = distW(G, B.p, P.p);
    if (d < BOSS.r + PLAYER.r + 0.05) hurt(G, BOSS.contact);
    if (d > BOSS.range) return;
    B.cd -= dt;
    if (B.cd > 0) return;
    const base = V.toward(B.p, P.p);
    const mode = B.mode++ % 4;
    if (mode === 0 || mode === 2) {
        const n = B.shield ? 12 : 16;
        for (let i = 0; i < n; i++) fireBolt(G, B.p, V.turn(B.p, base, B.ang + (i * Math.PI * 2) / n), EBUL.speed * 0.75);
    } else if (mode === 1) {
        for (let i = -2; i <= 2; i++) fireBolt(G, B.p, V.turn(B.p, base, i * 0.16), EBUL.speed * 1.1);
    } else {
        for (let i = 0; i < 2 && G.enemies.length < levelDef(G).cap + 2; i++) spawnAt(G, 'seeker', B.p, 2.4);
    }
    B.cd = B.shield ? 2.3 : 1.5;
    G.events.push({ type: 'bfire', mode });
}

function damageBoss(G, dmg) {
    const B = G.boss;
    B.hp -= dmg;
    G.events.push({ type: 'bhit', p: B.p.slice() });
    if (B.hp > 0) return;
    B.alive = false;
    G.score += SCORE.boss;
    G.enemies = [];
    G.bullets = G.bullets.filter((b) => b.own);
    G.events.push({ type: 'bossDown', p: B.p.slice() });
    openExit(G);
}

// ------------------------------------------------------------------ enemies
function pickKind(G) {
    const kinds = levelDef(G).kinds;
    let tot = 0;
    for (const k in kinds) tot += kinds[k];
    let r = G.rng() * tot;
    for (const k in kinds) { r -= kinds[k]; if (r <= 0) return k; }
    return 'drone';
}

function spawnAt(G, kind, c, off) {
    const W = G.world;
    let p = c;
    for (let tries = 0; tries < 8; tries++) {
        const d = V.turn(c, V.anyTangent(c), G.rng() * Math.PI * 2);
        p = V.walk(c, d, off / W.R).p;
        if (!inWall(W, p, ENEMY[kind].r)) break;
    }
    const e = { id: G.nextId++, kind, p: V.norm(p), vel: [0, 0, 0], hp: ENEMY[kind].hp, cd: 1 + G.rng() * 1.5, hitCd: 0, sees: false, seeT: G.rng() * 0.25, ph: G.rng() * 6.28 };
    G.enemies.push(e);
    G.events.push({ type: 'spawn', kind, p: e.p.slice() });
    return e;
}

/** Enemies come out of the hangar under a live beacon that the player can't see from where they stand. */
function spawnEnemy(G, quiet = false) {
    const P = G.player;
    const hangars = G.turrets.filter((t) => t.alive && distW(G, t.p, P.p) > 9);
    if (!hangars.length) return null;
    const t = G.rng.pick(hangars);
    const kind = pickKind(G);
    const n = kind === 'seeker' ? 2 : 1;
    let e = null;
    for (let i = 0; i < n && G.enemies.length < levelDef(G).cap; i++) {
        e = spawnAt(G, kind, t.p, TURRET.r + ENEMY[kind].r + 0.5);
        if (quiet) G.events.pop();
    }
    return e;
}

function stepSpawns(G, dt) {
    G.spawnT -= dt;
    if (G.spawnT > 0) return;
    const def = levelDef(G);
    G.spawnT = def.spawn * (0.7 + G.rng() * 0.6);
    if (G.enemies.length < def.cap) spawnEnemy(G);
}

function stepEnemies(G, dt) {
    const W = G.world, P = G.player;
    const pc = cellOf(W, P.p);
    if (pc !== G.flowCell || !G.flow) { G.flow = bfs(W, pc); G.flowCell = pc; }
    const obs = obstacles(G);
    for (let i = G.enemies.length - 1; i >= 0; i--) {
        const e = G.enemies[i], K = ENEMY[e.kind];
        e.cd -= dt; e.hitCd -= dt; e.seeT -= dt;
        const d = distW(G, e.p, P.p);
        if (e.seeT <= 0) { e.seeT = 0.25; e.sees = los(W, e.p, P.p, ENEMY_SIGHT); }
        let want = null;
        if (e.sees) {
            want = V.toward(e.p, P.p);
            if (e.kind === 'shard') {
                // keep a firing distance and circle
                const side = V.cross(e.p, want);
                const k = d < 5 ? -1 : d > 8 ? 1 : 0;
                want = V.norm(V.add(V.scale(want, k), V.scale(side, 0.7 * Math.sin(G.t * 0.7 + e.ph))));
                if (V.len(want) < 0.1) want = side;
            }
        } else {
            const c = cellOf(W, e.p);
            const fd = G.flow[c];
            if (fd > 0 && fd <= ENEMY_TRACK) {
                const cell = W.cells[c];
                let best = -1;
                for (let k = 0; k < 4; k++) if (cell.open[k] && G.flow[cell.nb[k]] >= 0 && G.flow[cell.nb[k]] < fd) { best = cell.nb[k]; break; }
                if (best >= 0) {
                    // aim at the doorway first, then the next cell's middle, so they don't hug corners
                    const nc = W.cells[best].c;
                    const door = V.norm(V.add(cell.c, nc));
                    want = V.toward(e.p, V.chord(e.p, door) * W.R > 0.8 ? door : nc);
                }
            } else if (fd === 0) want = V.toward(e.p, P.p);
        }
        if (want && e.kind === 'seeker') want = V.turn(e.p, want, Math.sin(G.t * 5 + e.ph) * 0.55);
        const target = want ? V.scale(want, K.speed) : V.scale(e.vel, 0.9);
        const k = Math.min(1, dt * 5);
        e.vel = V.tangent(e.p, V.add(V.scale(e.vel, 1 - k), V.scale(target, k)));
        // keep a little room from each other
        for (const o of G.enemies) {
            if (o === e) continue;
            const dd = distW(G, e.p, o.p), rr = K.r + ENEMY[o.kind].r;
            if (dd < rr && dd > 1e-6) e.vel = V.add(e.vel, V.scale(V.toward(e.p, o.p), -(rr - dd) * 6));
        }
        const m = move(G, e.p, e.vel, dt);
        let p = m.p;
        [p] = collideWalls(W, p, K.r);
        for (const [c, r] of obs) p = pushOut(G, p, c, r + K.r);
        e.p = p;
        e.vel = V.tangent(p, m.vel);
        // contact
        if (d < K.r + PLAYER.r && e.hitCd <= 0) {
            e.hitCd = 0.9;
            hurt(G, K.dmg);
            e.vel = V.scale(V.toward(e.p, P.p), -7);
        }
        if (e.kind === 'shard' && e.sees && e.cd <= 0 && d < 11) {
            const base = V.toward(e.p, P.p);
            for (const a of [-0.26, 0, 0.26]) fireBolt(G, e.p, V.turn(e.p, base, a));
            e.cd = K.cd;
            G.events.push({ type: 'efire', id: e.id });
        }
    }
}

function damageEnemy(G, j, dmg) {
    const e = G.enemies[j];
    e.hp -= dmg;
    G.events.push({ type: 'ehit', id: e.id, p: e.p.slice() });
    if (e.hp > 0) return;
    G.enemies.splice(j, 1);
    G.kills++;
    G.score += ENEMY[e.kind].score;
    G.events.push({ type: 'kill', kind: e.kind, p: e.p.slice() });
    if (G.rng() < PICKUP.drop) {
        const r = G.rng();
        dropPickup(G, e.p, r < 0.45 ? 'repair' : r < 0.7 ? 'power' : 'crystal');
    }
}

// ------------------------------------------------------------------ pickups
function dropPickup(G, p, kind) {
    G.pickups.push({ id: G.nextId++, kind, p: p.slice(), life: PICKUP.life });
}

function stepPickups(G, dt) {
    const P = G.player;
    for (let i = G.pickups.length - 1; i >= 0; i--) {
        const k = G.pickups[i];
        k.life -= dt;
        if (k.life <= 0) { G.pickups.splice(i, 1); continue; }
        if (G.phase !== 'play' && G.phase !== 'intro') continue;
        if (distW(G, k.p, P.p) > PLAYER.pickR) continue;
        G.pickups.splice(i, 1);
        if (k.kind === 'repair') P.hp = Math.min(PLAYER.hp, P.hp + PICKUP.repair);
        else if (k.kind === 'power') { if (P.power < 3) P.power++; else G.score += PICKUP.crystal; }
        else G.score += PICKUP.crystal;
        G.events.push({ type: 'pickup', kind: k.kind, p: k.p.slice() });
    }
}

// ------------------------------------------------------------------ queries for the view, UI and bot
export function objectives(G) {
    const out = G.turrets.filter((t) => t.alive).map((t) => ({ p: t.p, kind: t.kind }));
    if (G.boss?.alive && !G.boss.shield) out.push({ p: G.boss.p, kind: 'boss' });
    if (G.exit.open) out.push({ p: G.exit.p, kind: 'exit' });
    return out;
}

// ------------------------------------------------------------------ saves
export function serialize(G) {
    const { rng, events, world, flow, flowCell, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    if (!LEVELS[d.level]) throw new Error('unknown level');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    G.world = buildWorld(LEVELS[G.level], G.levelSeed);
    G.flow = null; G.flowCell = -1;
    return G;
}
