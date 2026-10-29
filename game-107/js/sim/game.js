// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// Coordinates: x runs west to east, y runs north (0) to south (H). The view maps (x, y) to (x, 0, y).
// The ball's z is the height of its underside above the ground, so z = 0 means rolling.

import { BALL, LIVES, ABSORB, COMBO_TIME, FLOOR_H } from '../config.js';
import { makeRng } from '../rng.js';
import { LEVELS, THINGS, FOES, POWERS, POWER_KINDS, PERKS, bHeight, floorH } from './data.js';
import { genLevel, levelSeed } from './city.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;
const MAX_RUBBLE = 240;
const MAX_STUCK = 70;
const RANGE = 27;                       // how far a tank can shoot

// ---------------------------------------------------------------- set-up

export function newGame(seed = 1, li = 0) {
    const G = {
        v: 1, seed, level: 0, phase: 'play', t: 0, levelT: 0, score: 0, lives: LIVES, over: false, won: false,
        rng: makeRng(seed ^ 0x9E3779B9),
        perks: { hp: 0, cd: 0, size: 0, dmg: 0, pow: 0 },
        events: [],                 // { type, ... } since the last drain; never saved
    };
    loadLevel(G, li);
    G.score = 0;
    return G;
}

/** Build city number li into G, keeping the score, lives and perks. */
function loadLevel(G, li) {
    const lv = genLevel(G.seed, li);
    G.level = li;
    G.layout = lv.layout;
    G.buildings = lv.buildings;
    G.things = lv.things;
    G.nid = lv.nextId + 1;
    G.rubble = []; G.foes = []; G.shots = []; G.bombs = []; G.pickups = [];
    G.phase = 'play';
    G.levelT = 0;
    G.deadT = 0;
    G.totalHp = 0;
    for (const b of G.buildings) G.totalHp += b.hpMax;
    G.hpLeft = G.totalHp;
    const maxHp = BALL.hp + 25 * G.perks.hp;
    const r0 = LEVELS[li].r0 + 0.12 * G.perks.size;
    const prev = G.ball;
    G.ball = {
        x: lv.layout.start.x, y: lv.layout.start.y, z: 0, vx: 0, vy: -BALL.minSpeed, vz: 0, hx: 0, hy: -1,
        r: r0, V: r0 * r0 * r0, hp: prev ? Math.min(maxHp, prev.hp + 35) : maxHp, maxHp,
        inv: 1.2, cd: 0, air: false, stuck: [], sn: 0,
    };
    G.power = { fire: 0, magnet: 0, shield: 0 };
    G.combo = { n: 0, t: 0, best: 0 };
    const M = LEVELS[li].mil;
    G.mil = { tankT: M.tank[0], heliT: M.heli[0], jetT: M.jet[0] };
    G.stats = { t0: G.score, eaten: 0, smashed: 0, floors: 0, hpLost: 0, deaths: 0, pounces: 0 };
}

export function destroyedFrac(G) { return G.totalHp ? 1 - G.hpLeft / G.totalHp : 1; }

export function ballRadius(G) { return G.ball.r; }

// ---------------------------------------------------------------- helpers

function ev(G, e) { G.events.push(e); }

function distToBuilding(b, x, y) {
    if (b.shape === 'circle') return Math.max(0, Math.hypot(x - b.x, y - b.y) - b.r);
    const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0), dy = Math.max(Math.abs(y - b.y) - b.d / 2, 0);
    return Math.hypot(dx, dy);
}

const comboMult = (G) => Math.min(6, 1 + Math.floor(G.combo.n / 10));

function award(G, base, x, y) {
    const n = Math.round(base * comboMult(G));
    G.score += n;
    ev(G, { type: 'score', n, x, y });
}

function bump(G, n = 1) {
    G.combo.n += n;
    G.combo.t = COMBO_TIME;
    if (G.combo.n > G.combo.best) G.combo.best = G.combo.n;
    if (G.combo.n <= 60 && Math.floor(G.combo.n / 10) > Math.floor((G.combo.n - n) / 10)) ev(G, { type: 'combo', n: G.combo.n, mult: comboMult(G) });
}

function setV(G, V) {
    const b = G.ball, old = b.r;
    b.V = V;
    b.r = Math.min(BALL.maxR, Math.cbrt(V));
    if (b.r > old + 0.0001 && Math.floor(b.r * 4) > Math.floor(old * 4)) ev(G, { type: 'grow', r: b.r });
}

function spawnRubble(G, x, y, z, n, size, c, speed, ax = x, ay = y) {
    for (let i = 0; i < n; i++) {
        const a = G.rng() * TAU, s = speed * (0.35 + G.rng() * 0.65);
        let vx = Math.cos(a) * s, vy = Math.sin(a) * s;
        const dx = x - ax, dy = y - ay, dl = Math.hypot(dx, dy);
        if (dl > 0.01) { vx += (dx / dl) * speed * 0.35; vy += (dy / dl) * speed * 0.35; }
        G.rubble.push({
            x, y, z, vx, vy, vz: 3 + G.rng() * 5, s: size * (0.7 + G.rng() * 0.6), c, rest: false,
        });
    }
    if (G.rubble.length > MAX_RUBBLE) G.rubble.splice(0, G.rubble.length - MAX_RUBBLE);
}

// ---------------------------------------------------------------- damage to buildings

export function hurtBuilding(G, b, dmg, sx, sy) {
    if (b.dead || dmg <= 0) return;
    const old = b.hp;
    b.hp = Math.max(0, b.hp - dmg);
    G.hpLeft -= old - b.hp;
    const nf = b.hp <= 0 ? 0 : Math.ceil(b.hp / b.fhp - 1e-6);
    const fh = floorH(b);
    if (nf < b.fl) {
        const dropped = b.fl - nf;
        const top = b.fl * fh;
        b.fl = nf;
        G.stats.floors += dropped;
        ev(G, { type: 'floors', id: b.id, x: b.x, y: b.y, from: top, to: nf * fh, dropped, w: b.w, d: b.d, col: b.col });
        const size = clamp(Math.min(b.w, b.d) * 0.075, 0.22, 0.5);
        const n = Math.min(14, 2 + dropped * 2 + (b.hp <= 0 ? 4 : 0));
        spawnRubble(G, b.x + (G.rng() - 0.5) * b.w * 0.6, b.y + (G.rng() - 0.5) * b.d * 0.6, top, n, size, b.col, 3.5 + b.w * 0.2, sx ?? b.x, sy ?? b.y);
        award(G, b.sc * dropped, b.x, b.y - 1);
        bump(G, 1);
    }
    if (b.hp <= 0) collapse(G, b);
}

function collapse(G, b) {
    b.dead = true;
    b.fl = 0;
    ev(G, { type: 'collapse', id: b.id, x: b.x, y: b.y, w: b.w, d: b.d, h: bHeight({ ...b, fl: b.fl0 }), col: b.col, t: b.t });
    award(G, Math.round(b.sc * b.fl0 * 0.5), b.x, b.y);
    bump(G, 3);
    if (b.t !== 'deck' && b.t !== 'pylon' && G.rng() < (b.fl0 >= 7 ? 0.6 : b.fl0 >= 4 ? 0.3 : 0.12)) {
        G.pickups.push({ x: b.x, y: b.y, k: POWER_KINDS[Math.floor(G.rng() * POWER_KINDS.length)], life: 20 });
    }
    if (b.t === 'gas') blast(G, b.x, b.y, 5.5, 30, 14);
    if (b.t === 'pylon') {
        // a bridge is only as strong as its pylons: the decks it carried sag and fall
        for (const o of G.buildings) if (o.t === 'deck' && !o.dead && Math.abs(o.x - b.bridge) < 0.5 && !G.buildings.some((p) => p.t === 'pylon' && !p.dead && p.bridge === b.bridge)) hurtBuilding(G, o, o.hp + 1, b.x, b.y);
    }
}

/** An explosion: hurts buildings, tanks and (unless shielded or jumping clear) the ball. */
function blast(G, x, y, R, bdmg, ballDmg) {
    ev(G, { type: 'boom', x, y, R });
    for (const b of G.buildings) {
        if (b.dead) continue;
        const d = distToBuilding(b, x, y);
        if (d < R) hurtBuilding(G, b, bdmg * (1 - 0.6 * d / R), x, y);
    }
    for (const f of G.foes) if (f.k === 'tank' && Math.hypot(f.x - x, f.y - y) < R) f.hp -= 2;
    const ball = G.ball;
    if (ballDmg > 0 && Math.hypot(ball.x - x, ball.y - y) < R + ball.r * 0.4 && ball.z < 1.6) hurtBall(G, ballDmg, x, y);
}

// ---------------------------------------------------------------- damage to the kaiju

export function hurtBall(G, dmg, x, y) {
    const b = G.ball;
    if (G.phase !== 'play' || b.inv > 0) return;
    if (G.power.shield > 0) { ev(G, { type: 'shield', x: b.x, y: b.y }); b.inv = 0.3; return; }
    dmg = Math.max(1, Math.round(dmg / (1 + 0.1 * (b.r - 1.2))));
    b.hp -= dmg;
    b.inv = BALL.invuln;
    G.stats.hpLost += dmg;
    G.combo.n = 0; G.combo.t = 0;
    ev(G, { type: 'hurt', dmg, x: b.x, y: b.y, fromX: x, fromY: y });
    if (b.hp <= 0) {
        b.hp = 0;
        G.stats.deaths++;
        G.lives--;
        ev(G, { type: 'die', x: b.x, y: b.y, lives: G.lives });
        if (G.lives <= 0) { G.over = true; G.phase = 'over'; ev(G, { type: 'over', score: G.score }); }
        else { G.phase = 'dead'; G.deadT = 1.9; }
    }
}

function respawn(G) {
    const b = G.ball;
    b.hp = b.maxHp;
    b.x = G.layout.start.x; b.y = G.layout.start.y; b.z = 0; b.vx = 0; b.vy = -BALL.minSpeed; b.vz = 0; b.air = false;
    b.inv = 2.6;
    setV(G, Math.max(Math.pow(LEVELS[G.level].r0 + 0.12 * G.perks.size, 3), b.V * 0.86));
    b.stuck.splice(0, b.stuck.length >> 1);
    G.shots.length = 0; G.bombs.length = 0;
    G.foes = G.foes.filter((f) => f.k !== 'heli');
    G.phase = 'play';
    ev(G, { type: 'respawn', x: b.x, y: b.y });
}

// ---------------------------------------------------------------- eating

function stick(G, t, size, c) {
    const b = G.ball;
    if (b.stuck.length >= MAX_STUCK) b.stuck.shift();
    // a random direction on the sphere, favouring nothing: the ball turns, so all sides get decorated
    const u = G.rng() * 2 - 1, a = G.rng() * TAU, s = Math.sqrt(1 - u * u);
    b.sn = (b.sn || 0) + 1;
    b.stuck.push([t, +(s * Math.cos(a)).toFixed(3), +u.toFixed(3), +(s * Math.sin(a)).toFixed(3), +size.toFixed(2), c]);
}

function eat(G, kind, size, vol, sc, heal, x, y, c, stuckKind) {
    const b = G.ball;
    setV(G, b.V + vol);
    G.stats.eaten++;
    award(G, sc, x, y);
    bump(G);
    if (heal) { b.hp = Math.min(b.maxHp, b.hp + heal); ev(G, { type: 'heal', n: heal, x, y }); }
    if (stuckKind !== undefined) stick(G, stuckKind, size, c);
    ev(G, { type: 'eat', k: kind, x, y, size, heal: heal || 0, r: b.r });
}

const THING_KINDS = Object.keys(THINGS);

function smashThing(G, i, t) {
    G.things.splice(i, 1);
    G.stats.smashed++;
    award(G, THINGS[t.k].sc, t.x, t.y);
    bump(G);
    spawnRubble(G, t.x, t.y, 0.6, 2, Math.max(0.2, t.size * 0.35), t.c, 3.5);
    ev(G, { type: 'smash', k: t.k, x: t.x, y: t.y });
}

// ---------------------------------------------------------------- the ball

function inWater(G, b) {
    const rv = G.layout.river;
    if (!rv || b.z > 0.3) return false;
    if (b.y < rv.y || b.y > rv.y + rv.h) return false;
    for (const o of G.buildings) if (o.t === 'deck' && !o.dead && Math.abs(o.x - b.x) < o.w / 2 + 0.2 && Math.abs(o.y - b.y) < o.d / 2 + 0.2) return false;
    return true;
}

function dmgMul(G) { return (1 + 0.2 * G.perks.dmg) * (G.power.fire > 0 ? 2.2 : 1); }

function stepBall(G, inp, dt) {
    const b = G.ball;
    let ix = inp.x || 0, iy = inp.y || 0;
    const il = Math.hypot(ix, iy);
    if (il > 1) { ix /= il; iy /= il; }
    b.vx += ix * BALL.accel * dt;
    b.vy += iy * BALL.accel * dt;

    // pounce
    const cdMax = BALL.pounceCd * Math.pow(0.75, G.perks.cd);
    if (inp.a && b.cd <= 0 && !b.air) {
        b.air = true;
        b.vz = BALL.jump + b.r * 0.9;
        b.cd = cdMax;
        G.stats.pounces++;
        ev(G, { type: 'pounce', x: b.x, y: b.y });
    }

    const wading = inWater(G, b);
    let sp = Math.hypot(b.vx, b.vy);
    const cap = (BALL.maxSpeed + 0.55 * (b.r - 1.2)) * (wading ? 0.78 : 1);
    if (sp > 0.01) {
        sp *= Math.exp(-(il > 0.05 ? 0.25 : 0.9) * dt) * (wading ? Math.exp(-1.4 * dt) : 1);
        if (sp > cap) sp = Math.max(cap, sp - 40 * dt);
        if (sp < BALL.minSpeed) sp = Math.min(BALL.minSpeed, sp + 14 * dt);
        const hx = b.vx / Math.hypot(b.vx, b.vy), hy = b.vy / Math.hypot(b.vx, b.vy);
        b.hx = hx; b.hy = hy;
        b.vx = hx * sp; b.vy = hy * sp;
    } else {
        b.vx = b.hx * BALL.minSpeed * 0.3; b.vy = b.hy * BALL.minSpeed * 0.3;
    }

    // up and down
    if (b.air || b.z > 0) {
        b.vz -= BALL.gravity * dt;
        b.z += b.vz * dt;
        if (b.z <= 0) { b.z = 0; b.vz = 0; b.air = false; slam(G); }
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // the sea wall
    const W = G.layout.W, H = G.layout.H, r = b.r;
    let hit = 0;
    if (b.x < r) { b.x = r; if (b.vx < 0) { hit = -b.vx; b.vx = -b.vx * BALL.wallRest; } }
    else if (b.x > W - r) { b.x = W - r; if (b.vx > 0) { hit = b.vx; b.vx = -b.vx * BALL.wallRest; } }
    if (b.y < r) { b.y = r; if (b.vy < 0) { hit = Math.max(hit, -b.vy); b.vy = -b.vy * BALL.wallRest; } }
    else if (b.y > H - r) { b.y = H - r; if (b.vy > 0) { hit = Math.max(hit, b.vy); b.vy = -b.vy * BALL.wallRest; } }
    if (hit > 3) ev(G, { type: 'bounce', x: b.x, y: b.y, speed: hit, what: 'wall' });

    // buildings
    const mul = dmgMul(G);
    for (const o of G.buildings) {
        if (o.dead) continue;
        const reach = (o.shape === 'circle' ? o.r : Math.max(o.w, o.d) * 0.71) + r + 0.5;
        if (Math.abs(b.x - o.x) > reach || Math.abs(b.y - o.y) > reach) continue;
        const h = bHeight(o);
        if (b.z > h - 0.05) continue;                       // jumping clear over it
        let nx, ny, pen;
        if (o.shape === 'circle') {
            const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy);
            if (d >= r + o.r) continue;
            nx = d > 1e-6 ? dx / d : 0; ny = d > 1e-6 ? dy / d : -1; pen = r + o.r - d;
        } else {
            const px = clamp(b.x, o.x - o.w / 2, o.x + o.w / 2), py = clamp(b.y, o.y - o.d / 2, o.y + o.d / 2);
            let dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy;
            if (d2 >= r * r) continue;
            if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; pen = r - d; }
            else {                                          // centre inside: leave by the nearest face
                const ex = o.w / 2 - Math.abs(b.x - o.x), ey = o.d / 2 - Math.abs(b.y - o.y);
                if (ex < ey) { nx = b.x < o.x ? -1 : 1; ny = 0; pen = ex + r; } else { nx = 0; ny = b.y < o.y ? -1 : 1; pen = ey + r; }
            }
        }
        const sp2 = Math.hypot(b.vx, b.vy);
        if (h < r * 0.9) {
            // the ball is taller than this: roll right over it, crushing as it goes
            hurtBuilding(G, o, (28 + 22 * r) * mul * dt, b.x, b.y);
            const k = Math.exp(-1.2 * dt);
            b.vx *= k; b.vy *= k;
            continue;
        }
        b.x += nx * pen; b.y += ny * pen;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
            b.vx -= (1 + BALL.restitution) * vn * nx;
            b.vy -= (1 + BALL.restitution) * vn * ny;
            const impact = -vn;
            const dmg = (Math.max(0, impact - BALL.impactMin) * r * r * 2.2 + 2 * r) * mul;
            ev(G, { type: 'bounce', x: b.x - nx * r, y: b.y - ny * r, speed: impact, what: 'building', nx, ny, id: o.id });
            hurtBuilding(G, o, dmg, b.x, b.y);
            if (o.dead) { b.vx *= 0.9; b.vy *= 0.9; }
        } else if (sp2 > 0) { /* grazing: already leaving */ }
    }
}

/** The landing of a pounce: a shockwave that hurts whatever is near. */
function slam(G) {
    const b = G.ball;
    const R = b.r * 2.2 + 1.6;
    const mul = dmgMul(G);
    ev(G, { type: 'slam', x: b.x, y: b.y, R });
    for (const o of G.buildings) {
        if (o.dead) continue;
        const d = distToBuilding(o, b.x, b.y);
        if (d < R) hurtBuilding(G, o, (16 + 18 * b.r) * (1 - 0.55 * d / R) * mul, b.x, b.y);
    }
    // swallow what is close; flatten the rest
    for (let i = G.things.length - 1; i >= 0; i--) {
        const t = G.things[i], d = Math.hypot(t.x - b.x, t.y - b.y);
        if (d > R) continue;
        const T = THINGS[t.k];
        if (t.size <= b.r * ABSORB && d < R * 0.8) {
            G.things.splice(i, 1);
            eat(G, t.k, t.size, T.vol, T.sc, T.heal, t.x, t.y, t.c, T.stick ? THING_KINDS.indexOf(t.k) : undefined);
        } else if (T.tough > 0 || t.size > b.r * ABSORB) smashThing(G, i, t);
    }
    for (const f of G.foes) if (f.k === 'tank' && Math.hypot(f.x - b.x, f.y - b.y) < R) f.hp -= 2;
    for (const r of G.rubble) if (Math.hypot(r.x - b.x, r.y - b.y) < R) { r.rest = false; r.vz = 4 + G.rng() * 3; }
    for (let i = G.shots.length - 1; i >= 0; i--) if (Math.hypot(G.shots[i].x - b.x, G.shots[i].y - b.y) < R * 0.9) { ev(G, { type: 'deflect', x: G.shots[i].x, y: G.shots[i].y }); G.shots.splice(i, 1); }
    bump(G, 2);
}

// ---------------------------------------------------------------- things

function moveThing(G, t, dt) {
    const m = t.mv;
    const b = G.ball;
    let p = m.ax === 'x' ? t.x : t.y;
    let spd = m.spd;
    if (t.k === 'person') {
        const bp = m.ax === 'x' ? b.x : b.y;
        const dist = Math.hypot(b.x - t.x, b.y - t.y);
        if (dist < 7 + b.r) {                               // run away from the monster
            const away = p - bp;
            m.dir = away === 0 ? m.dir : Math.sign(away);
            spd = 3.2;
        } else {
            m.t -= dt;
            if (m.t <= 0) { m.t = 1.5 + G.rng() * 4; if (G.rng() < 0.4) m.dir = -m.dir; }
        }
    }
    p += m.dir * spd * dt;
    if (p > m.hi) { if (m.wrap) p = m.lo; else { p = m.hi; m.dir = -1; } }
    else if (p < m.lo) { if (m.wrap) p = m.hi; else { p = m.lo; m.dir = 1; } }
    if (m.ax === 'x') { t.x = p; t.a = m.dir > 0 ? 0 : Math.PI; } else { t.y = p; t.a = m.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
}

function stepThings(G, dt) {
    const b = G.ball, r = b.r;
    const sp = Math.hypot(b.vx, b.vy);
    const magnet = G.power.magnet > 0;
    const magR = 6 + r * 1.5;
    for (let i = G.things.length - 1; i >= 0; i--) {
        const t = G.things[i];
        const T = THINGS[t.k];
        if (t.mv) moveThing(G, t, dt);
        let dx = b.x - t.x, dy = b.y - t.y;
        let d2 = dx * dx + dy * dy;
        if (magnet && T.loose && t.size <= r * ABSORB && d2 < magR * magR && d2 > 0.01) {
            const d = Math.sqrt(d2), pull = 9 * dt;
            t.x += (dx / d) * pull; t.y += (dy / d) * pull; t.mv = null;
            dx = b.x - t.x; dy = b.y - t.y; d2 = dx * dx + dy * dy;
        }
        const reach = r + t.size * 0.55;
        if (d2 >= reach * reach || b.z > 1.2) continue;
        if (t.size <= r * ABSORB) {
            G.things.splice(i, 1);
            eat(G, t.k, t.size, T.vol, T.sc, T.heal, t.x, t.y, t.c, T.stick ? THING_KINDS.indexOf(t.k) : undefined);
        } else if (sp >= T.tough) {
            smashThing(G, i, t);
        } else {                                            // too big to swallow, too slow to flatten: bounce
            const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d;
            b.x += nx * (reach - d); b.y += ny * (reach - d);
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vy -= 1.7 * vn * ny; ev(G, { type: 'bounce', x: t.x, y: t.y, speed: -vn, what: 'thing' }); }
        }
    }
}

function stepRubble(G, dt) {
    const b = G.ball, r = b.r;
    const magnet = G.power.magnet > 0 && G.phase === 'play';
    const magR = 6 + r * 1.5;
    for (let i = G.rubble.length - 1; i >= 0; i--) {
        const q = G.rubble[i];
        if (!q.rest) {
            q.vz -= 24 * dt;
            q.z += q.vz * dt;
            q.x += q.vx * dt; q.y += q.vy * dt;
            if (q.z <= 0) {
                q.z = 0;
                if (Math.abs(q.vz) > 2.5) { q.vz = -q.vz * 0.35; q.vx *= 0.6; q.vy *= 0.6; }
                else { q.vz = 0; q.vx *= 0.8; q.vy *= 0.8; if (Math.hypot(q.vx, q.vy) < 0.3) { q.rest = true; q.vx = q.vy = 0; } }
            }
            q.x = clamp(q.x, 0.3, G.layout.W - 0.3); q.y = clamp(q.y, 0.3, G.layout.H - 0.3);
        }
        if (G.phase !== 'play') continue;
        const dx = b.x - q.x, dy = b.y - q.y, d2 = dx * dx + dy * dy;
        if (magnet && q.rest && d2 < magR * magR && d2 > 0.01) {
            const d = Math.sqrt(d2);
            q.x += (dx / d) * 10 * dt; q.y += (dy / d) * 10 * dt;
        }
        const reach = r + q.s * 0.5;
        if (d2 < reach * reach && b.z < 1.0 && q.s <= r * ABSORB + 0.2 && q.z < 1.3) {
            G.rubble.splice(i, 1);
            setV(G, b.V + q.s * q.s * 0.1);
            G.stats.eaten++;
            if (G.rng() < 0.35) stick(G, 100, q.s, q.c);
            ev(G, { type: 'eat', k: 'rubble', x: q.x, y: q.y, size: q.s, heal: 0, r: b.r });
            bump(G, 0.2);
            G.score += 1;
        }
    }
}

// ---------------------------------------------------------------- the army

function countFoes(G, k) { let n = 0; for (const f of G.foes) if (f.k === k) n++; return n; }

function spawnTank(G) {
    const L = G.layout, b = G.ball;
    for (let tries = 0; tries < 8; tries++) {
        const horiz = G.rng() < 0.5;
        let mv, x, y;
        if (horiz) {
            const roads = L.hroads.filter((h) => !h.river);
            const hr = roads[Math.floor(G.rng() * roads.length)];
            const s = G.rng() < 0.5 ? -1 : 1;
            x = 1.5 + G.rng() * (L.W - 3); y = hr.cy + s * L.rw * 0.22;
            mv = { ax: 'x', fixed: y, lo: 1.5, hi: L.W - 1.5, spd: 1.8, dir: G.rng() < 0.5 ? 1 : -1, wrap: false };
        } else {
            const vr = L.vroads[Math.floor(G.rng() * L.vroads.length)];
            const s = G.rng() < 0.5 ? -1 : 1;
            x = vr.cx + s * L.rw * 0.22; y = 1.5 + G.rng() * (L.roadEnd - 3);
            mv = { ax: 'y', fixed: x, lo: 1.5, hi: L.roadEnd - 1.5, spd: 1.8, dir: G.rng() < 0.5 ? 1 : -1, wrap: false };
        }
        if (Math.hypot(x - b.x, y - b.y) < 13 && tries < 7) continue;
        const f = { id: G.nid++, k: 'tank', x, y, a: 0, ta: 0, hp: FOES.tank.hp, cd: 1.5 + G.rng() * 1.5, mv };
        G.foes.push(f);
        ev(G, { type: 'wave', k: 'tank', x, y });
        return;
    }
}

function spawnHeli(G) {
    const L = G.layout;
    const left = G.rng() < 0.5;
    const f = {
        id: G.nid++, k: 'heli', x: left ? -6 : L.W + 6, y: G.rng() * L.H, z: FOES.heli.z, a: 0, hp: 1, cd: 2.2,
        orbit: G.rng() * TAU, dir: G.rng() < 0.5 ? 1 : -1, rad: 8 + G.rng() * 4,
    };
    G.foes.push(f);
    ev(G, { type: 'wave', k: 'heli', x: f.x, y: f.y });
}

function spawnJet(G) {
    const L = G.layout, b = G.ball;
    const dir = G.rng() < 0.5 ? 1 : -1;
    const f = { id: G.nid++, k: 'jet', x: dir > 0 ? -14 : L.W + 14, y: clamp(b.y + b.vy * 1.2, 3, L.H - 3), z: FOES.jet.z, a: 0, hp: 99, dir, state: 'warn', t: 1.9, lastDrop: 0 };
    G.foes.push(f);
    ev(G, { type: 'warn', k: 'jet', y: f.y, dir });
}

function fireShell(G, f, k) {
    const b = G.ball;
    const speed = k === 'missile' ? 8.5 : 13;
    const d = Math.hypot(b.x - f.x, b.y - f.y);
    const acc = Math.min(0.9, 0.45 + 0.1 * G.level);
    const lead = (d / speed) * acc;
    const tx = b.x + b.vx * lead, ty = b.y + b.vy * lead;
    const l = Math.hypot(tx - f.x, ty - f.y) || 1;
    const sh = { id: G.nid++, k, x: f.x, y: f.y, z: f.z || 0.8, vx: ((tx - f.x) / l) * speed, vy: ((ty - f.y) / l) * speed, life: k === 'missile' ? 4.2 : 3, dmg: k === 'missile' ? 14 : 13 };
    sh.x += (sh.vx / speed) * 1.1; sh.y += (sh.vy / speed) * 1.1;
    G.shots.push(sh);
    ev(G, { type: 'shot', x: f.x, y: f.y, k });
}

function stepFoes(G, dt) {
    const b = G.ball, r = b.r;
    const sp = Math.hypot(b.vx, b.vy);
    for (let i = G.foes.length - 1; i >= 0; i--) {
        const f = G.foes[i];
        if (f.k === 'tank') {
            const m = f.mv;
            let p = m.ax === 'x' ? f.x : f.y;
            p += m.dir * m.spd * dt;
            if (p > m.hi) { p = m.hi; m.dir = -1; } else if (p < m.lo) { p = m.lo; m.dir = 1; }
            if (m.ax === 'x') { f.x = p; f.a = m.dir > 0 ? 0 : Math.PI; } else { f.y = p; f.a = m.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
            const dx = b.x - f.x, dy = b.y - f.y, d = Math.hypot(dx, dy);
            f.ta = Math.atan2(dy, dx);
            f.cd -= dt;
            if (f.cd <= 0 && d < RANGE && d > 4) { fireShell(G, f, 'shell'); f.cd = Math.max(1.6, 3.4 - 0.2 * G.level) + G.rng() * 1.1; }
            if (d < r + 0.95 && b.z < 1.2) {
                if (sp >= 5 || r >= 2) f.hp = 0;
                else {
                    const nx = dx / (d || 1), ny = dy / (d || 1), vn = b.vx * nx + b.vy * ny;
                    b.x += nx * (r + 0.95 - d); b.y += ny * (r + 0.95 - d);
                    if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; }
                    f.hp -= 1;
                    hurtBall(G, 4, f.x, f.y);
                    ev(G, { type: 'bounce', x: f.x, y: f.y, speed: Math.abs(vn), what: 'thing' });
                }
            }
            if (f.hp <= 0) {
                G.foes.splice(i, 1);
                G.stats.smashed++;
                award(G, FOES.tank.sc, f.x, f.y);
                bump(G, 2);
                spawnRubble(G, f.x, f.y, 0.8, 4, 0.34, 6, 5);
                ev(G, { type: 'smash', k: 'tank', x: f.x, y: f.y });
                ev(G, { type: 'boom', x: f.x, y: f.y, R: 2 });
            }
        } else if (f.k === 'heli') {
            f.orbit += f.dir * 0.45 * dt;
            const tx = b.x + Math.cos(f.orbit) * f.rad, ty = b.y + Math.sin(f.orbit) * f.rad;
            const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
            const v = Math.min(d * 1.5, 8.5);
            if (d > 0.01) { f.x += (dx / d) * v * dt; f.y += (dy / d) * v * dt; }
            f.a = Math.atan2(b.y - f.y, b.x - f.x);
            f.cd -= dt;
            const bd = Math.hypot(b.x - f.x, b.y - f.y);
            if (f.cd <= 0 && bd < 24) { fireShell(G, f, 'missile'); f.cd = Math.max(2.2, 3.8 - 0.25 * G.level) + G.rng(); }
            // a pounce that reaches it swats it out of the sky
            const centre = r + b.z;
            if (bd < r + 1.1 && Math.abs(centre - f.z) < r + 0.7) f.hp = 0;
            if (f.hp <= 0) {
                G.foes.splice(i, 1);
                G.stats.smashed++;
                award(G, FOES.heli.sc, f.x, f.y);
                bump(G, 2);
                spawnRubble(G, f.x, f.y, f.z, 5, 0.3, 6, 6);
                ev(G, { type: 'smash', k: 'heli', x: f.x, y: f.y, z: f.z });
            }
        } else if (f.k === 'jet') {
            if (f.state === 'warn') { f.t -= dt; if (f.t <= 0) f.state = 'run'; }
            else {
                f.x += f.dir * 38 * dt;
                if (f.x > 0 && f.x < G.layout.W && Math.abs(f.x - f.lastDrop) >= 4.4) {
                    f.lastDrop = f.x;
                    G.bombs.push({ x: f.x, y: f.y + (G.rng() - 0.5) * 1.6, fuse: 0.85, R: 3 });
                    ev(G, { type: 'drop', x: f.x, y: f.y });
                }
                if (f.x < -16 || f.x > G.layout.W + 16) G.foes.splice(i, 1);
            }
        }
    }
}

function stepShots(G, dt) {
    const b = G.ball;
    for (let i = G.shots.length - 1; i >= 0; i--) {
        const s = G.shots[i];
        if (s.k === 'missile') {
            const want = Math.atan2(b.y - s.y, b.x - s.x), cur = Math.atan2(s.vy, s.vx);
            let da = want - cur;
            while (da > Math.PI) da -= TAU;
            while (da < -Math.PI) da += TAU;
            const turn = clamp(da, -1.3 * dt, 1.3 * dt);
            const sp = Math.hypot(s.vx, s.vy);
            s.vx = Math.cos(cur + turn) * sp; s.vy = Math.sin(cur + turn) * sp;
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.life -= dt;
        const d = Math.hypot(b.x - s.x, b.y - s.y);
        if (d < b.r + 0.4 && b.z < 1.1 && b.inv <= 0 && G.phase === 'play') {
            G.shots.splice(i, 1);
            ev(G, { type: 'boom', x: s.x, y: s.y, R: 1.6 });
            hurtBall(G, s.dmg, s.x, s.y);
            continue;
        }
        if (s.life <= 0) {
            G.shots.splice(i, 1);
            blast(G, s.x, s.y, 2, 5, 0);                    // the army hurts its own city
        }
    }
}

function stepBombs(G, dt) {
    for (let i = G.bombs.length - 1; i >= 0; i--) {
        const m = G.bombs[i];
        m.fuse -= dt;
        if (m.fuse <= 0) { G.bombs.splice(i, 1); blast(G, m.x, m.y, m.R, 16, 14); }
    }
}

function stepMilitary(G, dt) {
    const M = LEVELS[G.level].mil;
    G.mil.tankT -= dt;
    if (G.mil.tankT <= 0) { G.mil.tankT = M.tank[1]; if (countFoes(G, 'tank') < M.tank[2]) spawnTank(G); }
    G.mil.heliT -= dt;
    if (G.mil.heliT <= 0) { G.mil.heliT = M.heli[1]; if (countFoes(G, 'heli') < M.heli[2]) spawnHeli(G); }
    G.mil.jetT -= dt;
    if (G.mil.jetT <= 0) { G.mil.jetT = M.jet[1]; if (countFoes(G, 'jet') < 1) spawnJet(G); }
}

// ---------------------------------------------------------------- power-ups

function stepPower(G, dt) {
    const b = G.ball;
    for (const k of ['fire', 'magnet', 'shield']) if (G.power[k] > 0) G.power[k] = Math.max(0, G.power[k] - dt);
    if (G.power.fire > 0) {
        const reach = b.r + 2.2;
        for (const o of G.buildings) if (!o.dead && distToBuilding(o, b.x, b.y) < reach - b.r + 0.2) hurtBuilding(G, o, 16 * (1 + 0.2 * G.perks.dmg) * dt, b.x, b.y);
    }
    for (let i = G.pickups.length - 1; i >= 0; i--) {
        const p = G.pickups[i];
        p.life -= dt;
        if (p.life <= 0) { G.pickups.splice(i, 1); continue; }
        if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + 0.8 && b.z < 2) {
            G.pickups.splice(i, 1);
            const P = POWERS[p.k];
            if (P.time) G.power[p.k] = P.time * (1 + 0.35 * G.perks.pow);
            else if (p.k === 'meal') setV(G, b.V * 1.22 + 0.4);
            else if (p.k === 'heart') { b.hp = Math.min(b.maxHp, b.hp + 40); ev(G, { type: 'heal', n: 40, x: b.x, y: b.y }); }
            award(G, 50, p.x, p.y);
            ev(G, { type: 'power', k: p.k, x: p.x, y: p.y });
        }
    }
}

// ---------------------------------------------------------------- the step

export function choosePerk(G, id) {
    if (G.phase !== 'clear' || !(id in G.perks)) return false;
    G.perks[id]++;
    G.perkTaken = true;
    return true;
}

/** Leave the cleared city for the next one. */
export function nextLevel(G) {
    if (G.phase !== 'clear') return false;
    loadLevel(G, G.level + 1);
    G.perkTaken = false;
    ev(G, { type: 'level', level: G.level });
    return true;
}

/** Advance one fixed step. inp = { x, y, a }: x and y in [-1, 1] (y down), a = pounce pressed since the last step. */
export function step(G, inp, dt) {
    if (G.over) return;
    G.t += dt;
    const b = G.ball;
    if (b.inv > 0) b.inv = Math.max(0, b.inv - dt);
    if (b.cd > 0) b.cd = Math.max(0, b.cd - dt);
    if (G.combo.t > 0) { G.combo.t -= dt; if (G.combo.t <= 0) G.combo.n = 0; }

    if (G.phase === 'clear' || G.phase === 'won') { stepRubble(G, dt); return; }
    if (G.phase === 'dead') {
        stepRubble(G, dt); stepShots(G, dt); stepBombs(G, dt);
        G.deadT -= dt;
        if (G.deadT <= 0) respawn(G);
        return;
    }

    G.levelT += dt;
    stepBall(G, inp, dt);
    stepThings(G, dt);
    stepRubble(G, dt);
    stepFoes(G, dt);
    stepShots(G, dt);
    stepBombs(G, dt);
    stepPower(G, dt);
    stepMilitary(G, dt);

    if (G.phase === 'play' && destroyedFrac(G) >= LEVELS[G.level].goal) {
        const L = LEVELS[G.level];
        const stars = 1 + (G.levelT <= L.par ? 1 : 0) + (G.stats.deaths === 0 ? 1 : 0);
        G.shots.length = 0; G.bombs.length = 0;
        G.foes = [];
        const last = G.level >= LEVELS.length - 1;
        G.phase = last ? 'won' : 'clear';
        if (last) G.won = true;
        G.clear = { level: G.level, stars, time: G.levelT, score: G.score - G.stats.t0, frac: destroyedFrac(G), best: G.combo.best, last };
        ev(G, { type: last ? 'win' : 'clear', ...G.clear });
    }
}

// ---------------------------------------------------------------- save / load

export function serialize(G) {
    const { rng, events, layout, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1 || !(d.level >= 0 && d.level < LEVELS.length)) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    G.layout = genLevel(G.seed, G.level).layout;
    return G;
}

export { levelSeed, FLOOR_H };
