// Kaboom Keep — the rules. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// One game is one castle. G.state: 'aim' (playing) → 'clearing' (the last knight is down; the
// dust settles) → 'won', or 'aim' → 'lost' when the rack is empty and someone is still standing.

import { CANNON, AMMO, AMMO_ORDER, MATS, CHARS, BONK, BREAK, SCORE, PLAY } from '../config.js';
import { makeRng } from '../rng.js';
import * as P from './physics.js';
import { LEVELS, buildLevel } from './levels.js';
import { aimDir, muzzle, clampAim } from './aim.js';

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function newGame(seed = 1, level = 0) {
    const L = LEVELS[level];
    const G = {
        v: 1,
        seed,
        rng: makeRng(seed),
        t: 0,
        level,
        W: P.makeWorld(),
        state: 'aim',
        stateT: 0,
        aim: { ...CANNON.aim0 },
        reload: 0,
        ammo: { ...L.ammo },
        sel: AMMO_ORDER.find((k) => L.ammo[k] > 0),
        score: 0,
        shots: 0,
        targets: 0,
        bonked: 0,
        stats: { broken: 0, knocked: 0, booms: 0, total: 0 },
        follow: 0,                  // id of the ball the camera follows (0 = none)
        lastShot: -99,
        fuses: [],                  // pending explosions { p, at, blast }
        flags: [],                  // decorative flags { body id, offset, color }
        over: false,
        won: false,
        stars: 0,
        events: [],
    };
    loadCastle(G, buildLevel(level));
    return G;
}

function loadCastle(G, parts) {
    const W = G.W;
    for (const s of parts) {
        if (s.char) {
            const C = CHARS[s.char];
            P.addBody(W, {
                kind: 'char', role: s.char, name: s.name, shape: 'box', h: [...C.h],
                p: [s.p[0], s.p[1] + C.h[1] + 0.002, s.p[2]], density: C.density, fr: 0.8, re: 0.1,
                sl: true, dmg: 0, y0: s.p[1], bonked: false, bT: 0,
            });
            G.targets++;
        } else if (s.flag) {
            G.flags.push({ ...s });
        } else {
            const M = MATS[s.mat];
            P.addBody(W, {
                kind: s.st ? 'rock' : 'block', mat: s.mat, shape: 'box', h: s.h, p: s.p, q: s.q,
                density: M.density, fr: M.fr, re: M.re, st: s.st, sl: !s.st,
                dmg: 0, s0: [...s.p], knocked: false, look: s.look, coneH: s.coneH,
            });
            if (!s.st) G.stats.total++;
        }
    }
    // a flag rides on the highest block under its pole
    for (const f of G.flags) {
        let best = null;
        for (const b of W.bodies) {
            if (b.kind !== 'block') continue;
            if (Math.abs(b.p[0] - f.p[0]) > b.h[0] + 0.05 || Math.abs(b.p[2] - f.p[2]) > b.h[2] + 0.05) continue;
            if (b.p[1] > f.p[1]) continue;
            if (!best || b.p[1] > best.p[1]) best = b;
        }
        f.body = best ? best.id : 0;
        f.off = best ? [f.p[0] - best.p[0], f.p[1] - best.p[1], f.p[2] - best.p[2]] : [0, 0, 0];
    }
}

export const ammoLeft = (G) => AMMO_ORDER.reduce((n, k) => n + (G.ammo[k] || 0), 0);
export const bodyById = (G, id) => G.W.bodies.find((b) => b.id === id) || null;
export const ballsAlive = (G) => G.W.bodies.filter((b) => b.kind === 'ball');

/**
 * Advance one fixed step. inp = { x, y, a, aim, ammo }:
 *   x, y  aim rates in [-1, 1] (x right, y down) from keys, a stick or a pad
 *   aim   { yaw, pitch } to aim at directly (a pointer drag), or null
 *   ammo  a kind to load, or null
 *   a     fire (or, with a ball in flight that has a trick, do the trick) — pressed since the last step
 */
export function step(G, inp, dt) {
    if (G.over) return;
    G.t += dt;
    G.stateT += dt;

    if (G.state === 'aim') {
        if (inp.ammo && G.ammo[inp.ammo] > 0 && inp.ammo !== G.sel) { G.sel = inp.ammo; G.events.push({ type: 'select', ammo: inp.ammo }); }
        if (inp.aim) G.aim = clampAim(inp.aim);
        else if (inp.x || inp.y) G.aim = clampAim({ yaw: G.aim.yaw - (inp.x || 0) * CANNON.yawRate * dt, pitch: G.aim.pitch - (inp.y || 0) * CANNON.pitchRate * dt });
    }
    G.reload = Math.max(0, G.reload - dt);
    if (inp.a && (G.state === 'aim' || G.state === 'clearing')) {
        const trick = G.W.bodies.find((b) => b.kind === 'ball' && b.live && !b.tricked && AMMO[b.ammo].special);
        if (trick) doTrick(G, trick);
        else if (G.state === 'aim') fire(G);
    }

    const impacts = P.stepWorld(G.W, dt);
    handleImpacts(G, impacts);
    updateBodies(G, dt);
    updateFuses(G);
    updateState(G);
}

// ------------------------------------------------------------------ shooting
export function fire(G) {
    if (G.reload > 0 || !G.sel || !(G.ammo[G.sel] > 0)) return false;
    const A = AMMO[G.sel];
    const { p, d } = muzzle(G.aim);
    const b = P.addBody(G.W, {
        kind: 'ball', ammo: G.sel, shape: 'sphere', r: A.r, p, v: [d[0] * A.speed, d[1] * A.speed, d[2] * A.speed],
        density: A.density, fr: A.fr, re: A.re, live: true, tricked: false, age: 0, restT: 0,
    });
    G.ammo[G.sel]--;
    G.shots++;
    G.reload = CANNON.reload;
    G.lastShot = G.t;
    G.follow = b.id;
    G.events.push({ type: 'fire', ammo: G.sel, p, d, id: b.id });
    if (!(G.ammo[G.sel] > 0)) {
        const next = AMMO_ORDER.find((k) => G.ammo[k] > 0);
        G.sel = next || null;
        if (next) G.events.push({ type: 'select', ammo: next, auto: true });
    }
    return true;
}

function doTrick(G, b) {
    const A = AMMO[b.ammo];
    b.tricked = true;
    if (A.special === 'detonate') {
        explode(G, b.p, A.blast, 'ball');
        removeBody(G, b);
    } else if (A.special === 'split') {
        const sp = Math.hypot(b.v[0], b.v[1], b.v[2]);
        const yaw = Math.atan2(b.v[0], b.v[2]);
        const pitch = Math.asin(Math.max(-1, Math.min(1, b.v[1] / sp)));
        for (const s of [-1, 1]) {
            const d = aimDir({ yaw: yaw + s * A.spread, pitch: pitch + 0.02 });
            const c = P.addBody(G.W, {
                kind: 'ball', ammo: b.ammo, shape: 'sphere', r: A.r, p: [b.p[0] + d[0] * 0.1 + s * 0.3 * Math.cos(yaw), b.p[1], b.p[2] - s * 0.3 * Math.sin(yaw)],
                v: [d[0] * sp, d[1] * sp, d[2] * sp], density: A.density, fr: A.fr, re: A.re, live: true, tricked: true, age: b.age, restT: 0,
            });
        }
        G.events.push({ type: 'split', p: [...b.p] });
    }
}

// ------------------------------------------------------------------ damage
function threshold(b) {
    return b.kind === 'char' ? CHARS[b.role].thr : b.kind === 'block' ? MATS[b.mat].thr : Infinity;
}
function hpOf(b) {
    if (b.kind === 'char') return CHARS[b.role].hp;
    if (b.kind === 'block') return MATS[b.mat].hp * (b.piece ? BREAK.pieceHp : 1);
    return Infinity;
}

function handleImpacts(G, impacts) {
    const hits = [];
    for (const im of impacts) {
        const pair = [[im.a, im.b], [im.b, im.a]];
        for (const [x, other] of pair) {
            if (!x || x.st) continue;
            if (x.kind === 'ball') {
                if (x.live && im.vn > 1) {
                    x.live = false;
                    G.events.push({ type: 'impact', ammo: x.ammo, p: [...x.p], speed: im.vn, mat: other ? other.mat || other.kind : 'ground' });
                    if (AMMO[x.ammo].special === 'detonate') { x.boomNow = true; }
                }
                continue;
            }
            if (x.kind !== 'block' && x.kind !== 'char') continue;
            const punch = other && other.kind === 'ball' ? AMMO[other.ammo].punch : 1;
            const dv = (im.j / x.m) * punch;
            const over = dv - threshold(x);
            if (over > 0) x.dmg += over;
        }
        if (im.vn > 3 && im.j > 0.3) hits.push(im);
    }
    // sound and dust for the strongest few contacts of the step
    hits.sort((p, q) => q.j * q.vn - p.j * p.vn);
    for (const h of hits.slice(0, 4)) {
        const m = h.b ? (h.b.kind === 'ball' ? h.a : h.b) : h.a;
        G.events.push({ type: 'hit', p: [...h.p], mat: m.kind === 'char' ? 'char' : m.mat || m.kind, speed: h.vn, j: h.j });
    }
    // breaks and bonks (collected first: they change the body list)
    const broken = [];
    for (const b of G.W.bodies) {
        if (b.kind === 'ball' && b.boomNow) broken.push(b);
        else if (b.kind === 'block' && b.dmg >= hpOf(b)) broken.push(b);
    }
    for (const b of broken) {
        if (b.kind === 'ball') { explode(G, b.p, AMMO[b.ammo].blast, 'ball'); removeBody(G, b); }
        else breakBlock(G, b);
    }
}

function bonk(G, b, why) {
    if (b.bonked) return;
    b.bonked = true;
    b.bT = 0;
    G.bonked++;
    const pts = CHARS[b.role].score;
    G.score += pts;
    G.events.push({ type: 'bonk', id: b.id, role: b.role, name: b.name, why, p: [...b.p], score: pts, left: G.targets - G.bonked });
}

function breakBlock(G, b) {
    const M = MATS[b.mat];
    removeBody(G, b);
    G.stats.broken++;
    G.score += M.score;
    G.events.push({ type: 'break', mat: b.mat, p: [...b.p], q: [...b.q], h: [...b.h], v: [...b.v], look: b.look, score: M.score });
    if (M.blast) { G.fuses.push({ p: [...b.p], at: G.t + 0.12, blast: M.blast }); return; }
    if (M.shatter) return;
    // split in two across the longest side
    let k = 0;
    for (let i = 1; i < 3; i++) if (b.h[i] > b.h[k]) k = i;
    const hk = b.h[k] / 2;
    if (hk < BREAK.minHalf || G.W.bodies.length >= BREAK.maxBodies || b.look) return;
    const R = P.quatToMat(b.q);
    const ax = P.vec.axis(R, k);
    for (const s of [-1, 1]) {
        const off = [ax[0] * hk * s, ax[1] * hk * s, ax[2] * hk * s];
        const h = [...b.h]; h[k] = hk - 0.003;
        const wv = P.vec.cross(b.w, off);
        P.addBody(G.W, {
            kind: 'block', mat: b.mat, shape: 'box', h, p: P.vec.add(b.p, off), q: [...b.q],
            v: [b.v[0] + wv[0] + ax[0] * s * 0.6, b.v[1] + wv[1] + ax[1] * s * 0.6, b.v[2] + wv[2] + ax[2] * s * 0.6], w: [...b.w],
            density: M.density, fr: M.fr, re: M.re, dmg: 0, piece: true, s0: b.s0, knocked: true,
        });
    }
}

/** Remove a body and wake whatever it was holding up or leaning on. */
function removeBody(G, b) {
    P.removeBody(G.W, b);
    for (const o of P.bodiesNear(G.W, b.p, P.boundR(b) + 0.25)) P.wake(o);
    if (G.follow === b.id) G.follow = 0;
}

export function explode(G, p, blast, src) {
    G.stats.booms++;
    G.events.push({ type: 'boom', p: [...p], radius: blast.radius, src });
    for (const b of P.bodiesNear(G.W, p, blast.radius)) {
        if (b.st) continue;
        const c = P.closestPoint(b, p);
        const d = dist3(c, p);
        const f = 1 - d / blast.radius;
        if (f <= 0) continue;
        let dir = P.vec.sub(b.p, p);
        dir = P.vec.norm([dir[0], dir[1] + 0.5 * Math.hypot(dir[0], dir[2]) + 0.2, dir[2]]);
        const dv = blast.power * f / (1 + b.m * 0.12);
        P.impulseAt(b, P.vec.scale(dir, dv * b.m), c);
        if (b.kind === 'block' || b.kind === 'char') b.dmg = (b.dmg || 0) + blast.damage * f;
    }
}

function updateFuses(G) {
    if (!G.fuses.length) return;
    const due = G.fuses.filter((f) => f.at <= G.t);
    if (!due.length) return;
    G.fuses = G.fuses.filter((f) => f.at > G.t);
    for (const f of due) explode(G, f.p, f.blast, 'tnt');
    // the blast may break more (and set off more crates)
    const broken = G.W.bodies.filter((b) => b.kind === 'block' && b.dmg >= hpOf(b));
    for (const b of broken) breakBlock(G, b);
}

// ------------------------------------------------------------------ per body
function updateBodies(G, dt) {
    const remove = [];
    for (const b of G.W.bodies) {
        const far = Math.hypot(b.p[0], b.p[2]) > PLAY.bounds || b.p[1] < -5;
        if (b.kind === 'ball') {
            b.age += dt;
            const sp = Math.hypot(b.v[0], b.v[1], b.v[2]);
            if (!b.live) b.restT = sp < 0.8 || b.sl ? b.restT + dt : 0;
            if (far || b.age > PLAY.ballLife || b.restT > PLAY.ballRest) remove.push(b);
            else if (b.live && b.age > 6) b.live = false;
        } else if (b.kind === 'char') {
            if (!b.bonked) {
                const up = P.upOf(b);
                if (far) bonk(G, b, 'fall');
                else if (up[1] < BONK.tiltUp) bonk(G, b, 'tip');
                else if (b.dmg >= CHARS[b.role].hp) bonk(G, b, 'hit');
                else if (b.p[1] - b.h[1] < b.y0 - BONK.fall && Math.abs(b.v[1]) < 0.5) bonk(G, b, 'fall');
            } else {
                b.bT += dt;
                if (b.bT > BONK.poof || far) remove.push(b);
            }
        } else if (b.kind === 'block') {
            if (!b.knocked && dist3(b.p, b.s0) > BREAK.knockDist) {
                b.knocked = true;
                G.stats.knocked++;
                G.score += Math.round(MATS[b.mat].score * SCORE.knock);
            }
            if (far) remove.push(b);
        }
    }
    for (const b of remove) {
        if (b.kind === 'char') G.events.push({ type: 'poof', id: b.id, role: b.role, p: [...b.p] });
        removeBody(G, b);
    }
}

function updateState(G) {
    if (G.state === 'aim') {
        if (G.bonked >= G.targets) { G.state = 'clearing'; G.stateT = 0; G.events.push({ type: 'allbonked' }); return; }
        if (ammoLeft(G) === 0 && !G.W.bodies.some((b) => b.kind === 'ball') && !G.fuses.length) {
            const since = G.t - G.lastShot;
            const still = !G.W.bodies.some((b) => !b.sl && !b.st && Math.hypot(b.v[0], b.v[1], b.v[2]) > 0.5);
            if (since > PLAY.failWait || (since > 2 && still)) finish(G, false);
        }
    } else if (G.state === 'clearing') {
        if (G.stateT >= PLAY.clearDelay) finish(G, true);
    }
}

function finish(G, won) {
    G.over = true;
    G.won = won;
    G.state = won ? 'won' : 'lost';
    let bonus = 0;
    if (won) {
        bonus = ammoLeft(G) * SCORE.spareBall;
        G.score += bonus;
        const st = LEVELS[G.level].stars || [Infinity, Infinity];
        G.stars = 1 + (G.score >= st[0] ? 1 : 0) + (G.score >= st[1] ? 1 : 0);
    }
    G.events.push({ type: 'over', won, score: G.score, stars: G.stars, bonus, spare: won ? ammoLeft(G) : 0 });
}

/** Wake every body (tests: a castle must stand on its own). */
export function wakeAll(G) { for (const b of G.W.bodies) P.wake(b); }

export function serialize(G) {
    const { rng, events, W, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, W: { bodies: W.bodies.map(P.cleanBody), cache: W.cache, nextId: W.nextId }, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1 || !d.W || !LEVELS[d.level]) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
