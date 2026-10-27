// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// A sector is played one asteroid at a time:
//   ready   aim and fire (G.aim)                      → flight
//   flight  an asteroid is out; a tap uses its special → settle (it came to rest or left)
//   settle  the station comes to rest                  → ready (more ammo) or lost
//   clear   the last robot fell; a beat, then won
//   won / lost   G.over is set and the 'over' event fires once

import { SLING, KILL, ISLANDS, AMMO, MATS, ROBOT, SCORE, STARS, GRAVITY } from '../config.js';
import { makeRng } from '../rng.js';
import { makeBody, stepWorld, wake, wakeNear } from './physics.js';
import { LEVELS } from './levels.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const speedOf = (b) => Math.hypot(b.vx, b.vy);

export function newGame(seed = 1, level = 0) {
    const index = clamp(level | 0, 0, LEVELS.length - 1);
    const def = LEVELS[index];
    const G = {
        v: 1,                       // save format version
        seed, level: index,
        rng: makeRng(seed),
        t: 0,
        score: 0,
        over: false, won: false, stars: 0,
        state: 'ready', stateT: 0,
        aim: { angle: 0.75, power: 0.7 },
        ammo: [...def.ammo],
        shots: 0,
        bodies: [],
        nextId: 1,
        cache: {},                  // last step's contact impulses (warm starting) — part of the state
        wells: def.wells.map((w) => ({ ...w })),
        robots: 0,
        valueTotal: 0,
        proj: 0,                    // id of the asteroid in flight
        events: [],                 // { type, ... } since the last drain; never saved
    };
    for (const isl of ISLANDS) {
        add(G, { kind: 'box', static: true, mat: 'rock', tag: 'island', fric: 0.8,
            x: (isl.x0 + isl.x1) / 2, y: isl.top - isl.depth / 2, hx: (isl.x1 - isl.x0) / 2, hy: isl.depth / 2 });
    }
    const lay = def.build();
    for (const [mat, x, y, w, h] of lay.blocks) addPiece(G, mat, x, y, w / 2, h / 2);
    for (const [x, y] of lay.robots) addPiece(G, 'robot', x, y, ROBOT.w / 2, ROBOT.h / 2);
    G.robots = lay.robots.length;
    return G;
}

function add(G, spec) {
    const b = makeBody({ id: G.nextId++, ...spec });
    G.bodies.push(b);
    return b;
}

function addPiece(G, mat, x, y, hx, hy) {
    const m = MATS[mat];
    G.valueTotal += m.value;
    return add(G, { kind: 'box', mat, x, y, hx, hy, density: m.density, fric: m.fric, rest: m.rest,
        hp: m.hp, maxHp: m.hp, value: m.value });
}

// ---------------------------------------------------------------------- aiming and firing

function launch(G) {
    const type = G.ammo.shift();
    const def = AMMO[type];
    const { angle, power } = G.aim;
    const v = power * SLING.vmax;
    const b = add(G, { kind: 'circle', mat: 'ast', tag: 'proj', ammo: type, r: def.r, density: def.density,
        punch: def.punch, fric: 0.5, rest: 0.25, x: SLING.x, y: SLING.y,
        vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, asleep: false });
    G.proj = b.id;
    G.shots++;
    setState(G, 'flight');
    G.events.push({ type: 'launch', ammo: type, x: b.x, y: b.y, power });
}

function special(G) {
    const b = G.bodies.find((o) => o.id === G.proj);
    if (!b || b.spent || b.tag !== 'proj') return;
    b.spent = true;
    const kind = AMMO[b.ammo].special;
    const sp = speedOf(b) || 1;
    if (kind === 'boost') {
        b.vx += (b.vx / sp) * 9; b.vy += (b.vy / sp) * 9;
        G.events.push({ type: 'boost', x: b.x, y: b.y });
    } else if (kind === 'slam') {
        b.vx *= 0.15; b.vy = -26;
        G.events.push({ type: 'slam', x: b.x, y: b.y });
    } else if (kind === 'split') {
        removeBody(G, b);
        const ang = Math.atan2(b.vy, b.vx);
        for (let i = -1; i <= 1; i++) {
            const a = ang + i * 0.2 + G.rng.range(-0.03, 0.03);
            add(G, { kind: 'circle', mat: 'ast', tag: 'shard', ammo: 'ice', r: 0.36, density: 1.2, punch: 0.8,
                fric: 0.5, rest: 0.25, x: b.x - Math.sin(ang) * i * 0.7, y: b.y + Math.cos(ang) * i * 0.7,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, asleep: false });
        }
        G.events.push({ type: 'split', x: b.x, y: b.y });
    } else if (kind === 'blast') {
        const q = [];
        removeBody(G, b);
        explode(G, b.x, b.y, 3.4, 15, q);
        processDeaths(G, q);
    }
}

function removeBody(G, b) {
    const i = G.bodies.indexOf(b);
    if (i >= 0) G.bodies.splice(i, 1);
}

// ---------------------------------------------------------------------- damage

function damage(b, dmg, q) {
    if (b.invMass === 0 || dmg <= 0 || b.dead || !MATS[b.mat]) return;
    b.hp -= dmg;
    if (b.hp <= 0) { b.dead = true; q.push(b); }
}

function explode(G, x, y, R, power, q) {
    G.events.push({ type: 'boom', x, y, r: R });
    for (const b of G.bodies) {
        if (b.invMass === 0 || b.dead) continue;
        const d = Math.hypot(b.x - x, b.y - y);
        if (d > R + b.rad) continue;
        const f = clamp(1 - d / (R + b.rad), 0, 1);
        const nx = d > 1e-6 ? (b.x - x) / d : 0, ny = d > 1e-6 ? (b.y - y) / d : 1;
        wake(b);
        const dv = Math.min(16, power * f * 1.6 * b.invMass);
        b.vx += nx * dv; b.vy += ny * dv + dv * 0.25;
        damage(b, power * f * 3, q);
    }
    wakeNear(G.bodies, x, y, R + 1);
}

function processDeaths(G, q) {
    while (q.length) {
        const b = q.shift();
        const i = G.bodies.indexOf(b);
        if (i < 0) continue;
        G.bodies.splice(i, 1);
        G.score += b.value;
        wakeNear(G.bodies, b.x, b.y, 3);
        if (b.mat === 'robot') G.events.push({ type: 'robot', x: b.x, y: Math.max(b.y, KILL.yMin + 3), value: b.value, fell: !!b.fell });
        else if (b.fell) G.events.push({ type: 'fall', mat: b.mat, value: b.value });
        else G.events.push({ type: 'break', x: b.x, y: b.y, mat: b.mat, w: b.hx * 2, h: b.hy * 2, value: b.value });
        if (b.mat === 'fuel' && !b.fell) explode(G, b.x, b.y, 2.8, 11, q);
    }
}

function hurt(G, h, q) {
    const { a, b, impact } = h;
    const shot = (o) => o.tag === 'proj' || o.tag === 'shard';
    if (shot(a)) a.touched = true;
    if (shot(b)) b.touched = true;
    if (impact >= 3 && G.events.length < 40) {
        const other = a.invMass === 0 ? b : a;
        G.events.push({ type: 'hit', x: h.x, y: h.y, power: impact, mat: MATS[other.mat] ? other.mat : (MATS[b.mat] ? b.mat : 'rock') });
    }
    // What hurts a body is the speed it was hit at and how much mass hit it: a heavy rock shatters a
    // light pane even though the pane barely slows it (the reduced mass alone would say otherwise).
    for (const [x, o] of [[a, b], [b, a]]) {
        const m = MATS[x.mat];
        if (!m) continue;
        const mo = o.invMass ? 1 / o.invMass : h.mred;             // a static partner counts as the body itself
        damage(x, (h.speed * 0.5 * (h.mred + mo) * o.punch - m.thr) * m.k, q);
    }
}

// ---------------------------------------------------------------------- the step

/**
 * Advance one fixed step.
 * inp = { adjA, adjP, aim, fire, act }
 *   adjA, adjP  in [-1, 1]: keyboard/pad nudges of the aim angle and power
 *   aim         null, or { angle, power }: a pointer drag in progress
 *   fire, act   edges pressed since the last step. act fires when ready and uses the special in flight.
 */
export function step(G, inp, dt) {
    if (G.over) return;
    G.t += dt; G.stateT += dt;

    if (G.state === 'ready') {
        const a = G.aim;
        if (inp.aim) {
            a.angle = clamp(inp.aim.angle, SLING.minAngle, SLING.maxAngle);
            a.power = clamp(inp.aim.power, 0, 1);
        } else {
            a.angle = clamp(a.angle + (inp.adjA || 0) * 1.1 * dt, SLING.minAngle, SLING.maxAngle);
            a.power = clamp(a.power + (inp.adjP || 0) * 0.7 * dt, SLING.minPower, 1);
        }
        if ((inp.fire || inp.act) && G.ammo.length && a.power >= SLING.minPower) launch(G);
    } else if (G.state === 'flight' && inp.act) {
        special(G);
    }

    const hits = stepWorld(G, dt);
    const q = [];
    for (const h of hits) hurt(G, h, q);

    // anything past the edge of the world is gone
    for (let i = G.bodies.length - 1; i >= 0; i--) {
        const b = G.bodies[i];
        if (b.invMass === 0) continue;
        if (b.y < KILL.yMin || b.x < KILL.xMin || b.x > KILL.xMax) {
            if (MATS[b.mat]) { b.fell = true; b.dead = true; q.push(b); } else G.bodies.splice(i, 1);
        }
    }
    processDeaths(G, q);
    flow(G, dt);
}

function setState(G, s) { G.state = s; G.stateT = 0; }

function flow(G, dt) {
    G.robots = 0;
    for (const b of G.bodies) if (b.mat === 'robot') G.robots++;
    if (G.robots === 0 && G.state !== 'clear') { setState(G, 'clear'); G.events.push({ type: 'clear' }); }

    if (G.state === 'flight') {
        const shots = G.bodies.filter((b) => b.tag === 'proj' || b.tag === 'shard');
        let live = 0;
        for (const s of shots) {
            s.idle = s.touched && speedOf(s) < 0.6 ? s.idle + dt : 0;
            if (s.ammo === 'bomb' && s.touched && !s.spent) {
                s.fuse += dt;
                if (s.fuse > 1.0) { G.proj = s.id; special(G); continue; }
            }
            if (s.idle < 1.0) live++;
        }
        if (!live || G.stateT > 9) {
            for (const s of G.bodies) if (s.tag === 'proj' || s.tag === 'shard') s.tag = 'debris';
            setState(G, 'settle');
        }
    } else if (G.state === 'settle') {
        if (G.stateT >= 0.8) {
            const calm = G.bodies.every((b) => b.invMass === 0 || b.asleep || (speedOf(b) < 0.2 && Math.abs(b.w) * b.rad < 0.4));
            if (calm || G.stateT > 6) {
                if (G.ammo.length) {
                    setState(G, 'ready');
                    G.events.push({ type: 'ready', ammo: G.ammo[0] });
                } else finish(G, false);
            }
        }
    } else if (G.state === 'clear') {
        if (G.stateT > 1.6) finish(G, true);
    }

    // old spent asteroids pile up; the oldest can go
    let n = 0;
    for (const b of G.bodies) if (b.tag === 'debris') n++;
    for (let i = 0; n > 10 && i < G.bodies.length; i++) {
        if (G.bodies[i].tag === 'debris') { G.bodies.splice(i, 1); i--; n--; }
    }
}

function finish(G, won) {
    G.over = true; G.won = won;
    G.state = won ? 'won' : 'lost';
    if (won) {
        G.score += G.ammo.length * SCORE.spare;
        G.stars = 1 + (G.score >= STARS[0] * G.valueTotal ? 1 : 0) + (G.score >= STARS[1] * G.valueTotal ? 1 : 0);
    }
    G.events.push({ type: 'over', won, stars: G.stars, score: G.score, level: G.level });
}

// ---------------------------------------------------------------------- helpers for the view and the bot

/** Where a free asteroid launched with this aim goes (no collisions): [{ x, y }] sampled every `every` s. */
export function predict(G, angle, power, tmax = 1.6, every = 0.06) {
    let x = SLING.x, y = SLING.y;
    const v = power * SLING.vmax;
    let vx = Math.cos(angle) * v, vy = Math.sin(angle) * v;
    const dt = 1 / 120, pts = [];
    const sampleEvery = Math.round(every / dt);
    for (let i = 0, n = Math.round(tmax / dt); i < n; i++) {
        vy -= GRAVITY * dt;
        for (const w of G.wells) {
            const dx = w.x - x, dy = w.y - y, d2 = dx * dx + dy * dy + 4;
            const f = w.k / (d2 * Math.sqrt(d2));
            vx += dx * f * dt; vy += dy * f * dt;
        }
        x += vx * dt; y += vy * dt;
        if (i % sampleEvery === 0) pts.push({ x, y });
    }
    return pts;
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
