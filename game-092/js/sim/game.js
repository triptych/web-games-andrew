// The simulation. Pure: no DOM, no renderer, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// Time-driven hazards (rolling logs, crocodile jaws, swinging vines, scorpions) are functions of
// G.t, not stored state, so they cost nothing to save and every rollout of the bot sees them exactly.

import {
    W, SURF, CEIL, TF, N_SCREENS, TUNNEL_STRIDE, TREASURES, TIME_LIMIT, START_SCORE, LIVES,
    HW, BODY_H, HAND, RUN, ACCEL, AIR_ACCEL, CLIMB, GRAV, JUMP_V, COYOTE, BUFFER, STUN, INV_HIT, INV_SPAWN, ENTRY_GRACE,
    LOG, PIT_DEPTH, PIT_FORGIVE, HIT_FORGIVE, LX, HOLE_HW, WALL_X, WALL_W, CROC, VINE,
    TREASURE_VALUES, HIT_PENALTY, TIME_BONUS, STREAK_MAX, LIFE_EVERY, LIVES_MAX,
} from '../config.js';
import { getWorld } from './world.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// floor kinds on the surface
export const F_GROUND = 0, F_CROC = 1, F_PIT = 2, F_HOLE = 3;
let croc_i = -1;                       // which crocodile floorAt() found

// ---------------------------------------------------------------- time-driven things
export function logX(L, t) {
    const m = (((L.v * t + L.phase) % L.P) + L.P) % L.P;
    return W + 12 - m;
}
/**
 * Logs are f(G.t + G.logShift). When Harry arrives on a screen (or respawns on it) the shift is
 * chosen so that no log comes within CALM px of where he will be for the next CALM_T seconds,
 * whether he runs on or stands still: nothing rolling may hurt him the moment he arrives.
 * If no phase is that clear, the clearest one is used.
 */
const CALM = 46, CALM_T = 1.5, STILL_T = 1.1;
function calmShift(G, scr, x, dir, delay = 0) {
    if (!scr.logs.length) return 0;
    let maxP = 0;
    for (const L of scr.logs) maxP = Math.max(maxP, L.P / L.v);
    let best = 0, bestGap = -1;
    for (let k = 0; k * 0.1 <= maxP + 0.1; k++) {
        const sh = k * 0.1;
        let gap = Infinity;
        for (let tau = 0; tau <= (delay || CALM_T) + (delay ? 1 : 0); tau += 0.1) {
            for (const L of scr.logs) {
                const lx = logX(L, G.t + sh + tau);
                if (delay) gap = Math.min(gap, Math.abs(lx - (x + dir * RUN * Math.max(0, tau - delay))));   // stands, then runs on
                else gap = Math.min(gap, Math.abs(lx - (x + dir * RUN * tau)), tau <= STILL_T ? Math.abs(lx - x) : Infinity);   // runs on, or stands
            }
        }
        if (gap >= CALM) return sh;
        if (gap > bestGap) { bestGap = gap; best = sh; }
    }
    return best;
}
export const logTime = (G) => G.t + (G.logShift || 0);

export function scorpPos(sc, t) {
    const len = sc.x1 - sc.x0;
    const m = (((sc.v * t + sc.phase) % (2 * len)) + 2 * len) % (2 * len);
    return { x: sc.x0 + (m < len ? m : 2 * len - m), dir: m < len ? 1 : -1 };
}
export function vineTheta(v, t) { return v.A * Math.sin((TAU * t) / v.T + v.phi); }
export function vineOmega(v, t) { return v.A * (TAU / v.T) * Math.cos((TAU * t) / v.T + v.phi); }
export function crocPhase(c, t) { return (((t + c.phase) % CROC.period) + CROC.period) % CROC.period; }
export function crocOpen(c, t) { return crocPhase(c, t) >= CROC.closed; }
export function crocWarn(c, t) { const m = crocPhase(c, t); return m >= CROC.closed - CROC.warn && m < CROC.closed; }

// ---------------------------------------------------------------- geometry
/** The pit or hole whose edges (unshrunk) hold x, or null. */
export function regionAt(scr, x) {
    if (scr.ladder && Math.abs(x - LX) <= HOLE_HW) return { x0: LX - HOLE_HW, x1: LX + HOLE_HW, type: 'hole' };
    for (const p of scr.pits) if (x >= p.x0 && x <= p.x1) return p;
    return null;
}
/** What is under a body at x on the surface. Pits are PIT_FORGIVE narrower than they look. */
export function floorAt(scr, x) {
    if (scr.ladder && Math.abs(x - LX) < HOLE_HW - PIT_FORGIVE) return F_HOLE;
    for (const p of scr.pits) {
        if (x > p.x0 + PIT_FORGIVE && x < p.x1 - PIT_FORGIVE) {
            if (p.type === 'water') {
                for (let i = 0; i < scr.crocs.length; i++) {
                    if (Math.abs(x - scr.crocs[i].x) <= CROC.hw + 1) { croc_i = i; return F_CROC; }
                }
            }
            return F_PIT;
        }
    }
    return F_GROUND;
}

// ---------------------------------------------------------------- new game, save, clone
function newPlayer(layer, x) {
    return {
        x, y: layer === 'tunnel' ? TF : SURF, vx: 0, vy: 0, face: 1, st: 'ground', layer,
        timer: 0, coy: 0, buf: 0, inv: 0, stun: 0, cool: 0, vineS: 0, anim: 0, dk: '', stepAcc: 0, climbAcc: 0,
    };
}

export function newGame(seed = 1) {
    const w = getWorld(seed);
    const G = {
        v: 1,
        seed,
        t: 0,
        left: TIME_LIMIT,
        sec: TIME_LIMIT,
        hurry: 0,
        logShift: 0,
        score: START_SCORE,
        lives: LIVES,
        streak: 0,
        screen: w.start,
        got: new Array(TREASURES).fill(0),
        visited: new Array(N_SCREENS).fill(0),
        p: newPlayer('surface', 40),
        over: false,
        won: false,
        reason: '',
        stats: { hits: 0, deaths: 0, jumps: 0, vines: 0, screens: 0 },
        events: [],                 // { type, ... } since the last drain; never saved
    };
    G.visited[G.screen] = 1;
    return G;
}

/** A cheap copy for look-ahead (the bot). The world is shared, never copied. */
export function cloneGame(G) {
    return {
        ...G, p: { ...G.p }, got: G.got.slice(), visited: G.visited.slice(), stats: { ...G.stats }, events: [],
    };
}

export function serialize(G) {
    const { events, ...rest } = G;
    return JSON.parse(JSON.stringify(rest));
}

export function deserialize(d) {
    if (!d || d.v !== 1 || typeof d.seed !== 'number' || !d.p || !Array.isArray(d.got)) throw new Error('unknown save version');
    const G = JSON.parse(JSON.stringify(d));
    G.events = [];
    return G;
}

// ---------------------------------------------------------------- events
const ev = (G, type, o) => { G.events.push(o ? Object.assign({ type }, o) : { type }); };

function end(G, reason) {
    G.over = true;
    G.won = reason === 'won';
    G.reason = reason;
    ev(G, 'over', { reason, score: G.score, treasures: G.got.reduce((a, b) => a + b, 0) });
}

const DEATH_T = { sink: 1.2, drown: 1.0, chomp: 0.9, bite: 0.9, burn: 0.9, sting: 0.9 };

function die(G, kind) {
    const p = G.p;
    if (p.st === 'dead') return;
    p.st = 'dead';
    p.dk = kind;
    p.timer = DEATH_T[kind] || 0.9;
    p.vx = 0;
    p.vy = (kind === 'bite' || kind === 'burn' || kind === 'sting') ? -120 : 0;
    p.stun = 0;
    G.lives--;
    G.streak = 0;
    G.stats.deaths++;
    ev(G, 'death', { kind, x: p.x, y: p.y, layer: p.layer, lives: G.lives });
}

function respawn(G) {
    const layer = p_layer(G.p);
    const keep = G.p.anim;
    G.p = newPlayer(layer, 24);
    G.p.anim = keep;
    G.p.inv = INV_SPAWN;
    if (layer === 'surface') G.logShift = calmShift(G, getWorld(G.seed).screens[G.screen], 24, 1, INV_SPAWN);
    ev(G, 'respawn', { layer });
}
const p_layer = (p) => (p.layer === 'tunnel' ? 'tunnel' : 'surface');

// ---------------------------------------------------------------- movement helpers
function moveX(scr, p, dx) {
    const ox = p.x;
    let nx = ox + dx;
    if (p.layer === 'tunnel') {
        if (scr.tunnel.wall) {
            if (ox <= WALL_X - HW) nx = Math.min(nx, WALL_X - HW);
            else if (ox >= WALL_X + WALL_W + HW) nx = Math.max(nx, WALL_X + WALL_W + HW);
        }
    } else if (p.y > SURF + 2) {
        const r = regionAt(scr, ox);        // in a pit or the shaft: its walls hold you in
        if (r) nx = clamp(nx, r.x0 + HW, r.x1 - HW);
    }
    p.x = nx;
}

function land(G, p, y) {
    const impact = p.vy;
    p.y = y; p.vy = 0; p.st = 'ground'; p.coy = 0;
    ev(G, 'land', { impact, x: p.x, y });
}

function changeScreen(G, dir) {
    const p = G.p;
    const stride = p.layer === 'tunnel' ? TUNNEL_STRIDE : 1;
    const from = G.screen;
    G.screen = (((G.screen + dir * stride) % N_SCREENS) + N_SCREENS) % N_SCREENS;
    p.x = dir > 0 ? 1 : W - 1;
    p.inv = Math.max(p.inv, ENTRY_GRACE);       // a log may be rolling across the edge Harry arrives at
    if (p.layer === 'surface') G.logShift = calmShift(G, getWorld(G.seed).screens[G.screen], p.x, dir);
    G.visited[G.screen] = 1;
    G.stats.screens++;
    ev(G, 'screen', { from, to: G.screen, dir, layer: p.layer });
}

function collect(G, tr) {
    G.got[tr.id] = 1;
    const mult = 1 + 0.25 * Math.min(G.streak, STREAK_MAX);
    const value = Math.round(TREASURE_VALUES[tr.kind] * mult);
    G.score += value;
    G.streak++;
    const n = G.got.reduce((a, b) => a + b, 0);
    ev(G, 'treasure', { id: tr.id, kind: tr.kind, value, mult, x: tr.x, y: tr.layer === 'tunnel' ? TF : SURF, layer: tr.layer, count: n, streak: G.streak });
    if (n % LIFE_EVERY === 0 && G.lives < LIVES_MAX) { G.lives++; ev(G, 'life', { lives: G.lives }); }
    if (n >= TREASURES) {
        const bonus = Math.floor(G.left) * TIME_BONUS;
        G.score += bonus;
        ev(G, 'bonus', { value: bonus });
        end(G, 'won');
    }
}

// ---------------------------------------------------------------- the step
/** Advance one fixed step. inp = { x, y, a }: x, y in [-1, 1] (y down), a = jump pressed since the last step. */
export function step(G, inp, dt) {
    if (G.over) return;
    const world = getWorld(G.seed);
    const p = G.p;

    G.t += dt;
    G.left -= dt;
    if (G.left <= 0) { G.left = 0; end(G, 'time'); return; }
    const sec = Math.ceil(G.left);
    if (sec !== G.sec) {
        G.sec = sec;
        if (sec <= 10) ev(G, 'tick', { sec });
        if (sec === 120 || sec === 60) { G.hurry++; ev(G, 'hurry', { sec }); }
    }

    p.anim += dt;
    p.inv = Math.max(0, p.inv - dt);
    p.cool = Math.max(0, p.cool - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.buf = inp.a ? BUFFER : Math.max(0, p.buf - dt);

    const ctl = p.stun <= 0 && p.st !== 'dead';
    const dirX = ctl ? (inp.x > 0.3 ? 1 : inp.x < -0.3 ? -1 : 0) : 0;
    const dirY = ctl ? (inp.y > 0.4 ? 1 : inp.y < -0.4 ? -1 : 0) : 0;
    if (dirX) p.face = dirX;
    const scr = world.screens[G.screen];

    switch (p.st) {
        case 'dead': {
            p.timer -= dt;
            if (p.dk === 'sink') p.y += 12 * dt;
            else if (p.dk === 'drown') p.y += 26 * dt;
            else if (p.dk === 'bite' || p.dk === 'burn' || p.dk === 'sting') {
                p.vy += GRAV * dt;
                p.y = Math.min(p.layer === 'tunnel' ? TF : SURF, p.y + p.vy * dt);
            }
            if (p.timer <= 0) { if (G.lives <= 0) end(G, 'lives'); else respawn(G); }
            return;
        }
        case 'vine': {
            const v = scr.vine;
            const th = vineTheta(v, G.t);
            p.x = v.x + p.vineS * Math.sin(th);
            p.y = v.y0 + p.vineS * Math.cos(th) + HAND;
            if (p.buf > 0 || dirY > 0) {
                const vt = p.vineS * vineOmega(v, G.t);
                p.vx = vt * Math.cos(th) * (dirY > 0 && p.buf <= 0 ? 0.5 : VINE.boost);
                p.vy = -vt * Math.sin(th) - VINE.hop;
                p.st = 'air';
                p.cool = VINE.cool;
                p.coy = 0;
                p.buf = 0;
                ev(G, 'release', { x: p.x, y: p.y, vx: p.vx });
            }
            return;
        }
        case 'ladder': {
            p.x += clamp(LX - p.x, -90 * dt, 90 * dt);
            const dy = dirY * CLIMB * dt;
            p.y += dy;
            p.buf = 0;
            p.climbAcc += Math.abs(dy);
            if (p.climbAcc >= 6) { p.climbAcc = 0; ev(G, 'rung', { x: p.x, y: p.y }); }
            if (p.y <= SURF) {
                // out of the hole and onto the bank, with a small hop
                p.y = SURF; p.layer = 'surface'; p.st = 'air'; p.vy = -70; p.coy = 0;
                p.x = LX + (p.face >= 0 ? 1 : -1) * (HOLE_HW + 3);
                p.vx = 0;
                ev(G, 'ladder', { dir: -1, x: p.x });
            } else if (p.y >= TF) {
                p.y = TF; p.layer = 'tunnel'; p.st = 'ground'; p.vx = 0;
                ev(G, 'ladder', { dir: 1, x: p.x });
            }
            return;
        }
        default: break;
    }

    // ---- on the ground or in the air
    if (p.st === 'ground') {
        // climbing: Down beside a hole on the surface, Up under the ladder in a tunnel
        if (scr.ladder && dirY !== 0) {
            if (p.layer === 'surface' && dirY > 0 && Math.abs(p.x - LX) <= HOLE_HW + 3) { p.st = 'ladder'; p.vx = 0; p.climbAcc = 0; return; }
            if (p.layer === 'tunnel' && dirY < 0 && Math.abs(p.x - LX) <= 8) { p.st = 'ladder'; p.vx = 0; p.climbAcc = 0; return; }
        }
        p.vx += clamp(dirX * RUN - p.vx, -ACCEL * dt, ACCEL * dt);
        moveX(scr, p, p.vx * dt);

        let fl = F_GROUND;
        if (p.layer === 'surface') fl = floorAt(scr, p.x);
        if (fl === F_PIT || fl === F_HOLE) {
            p.st = 'air'; p.vy = 0; p.coy = COYOTE;
        } else {
            if (fl === F_CROC && crocOpen(scr.crocs[croc_i], G.t)) { die(G, 'chomp'); return; }
            if (p.buf > 0 && ctl) {
                p.vy = -JUMP_V; p.st = 'air'; p.buf = 0; p.coy = 0; G.stats.jumps++;
                ev(G, 'jump', { x: p.x, y: p.y });
            } else if (Math.abs(p.vx) > 12) {
                p.stepAcc += Math.abs(p.vx) * dt;
                if (p.stepAcc >= 9) { p.stepAcc = 0; ev(G, 'step', { x: p.x, y: p.y }); }
            }
        }
    }

    if (p.st === 'air') {
        p.coy = Math.max(0, p.coy - dt);
        if (p.buf > 0 && p.coy > 0 && ctl) {
            p.vy = -JUMP_V; p.buf = 0; p.coy = 0; G.stats.jumps++;
            ev(G, 'jump', { x: p.x, y: p.y });
        }
        // momentum is kept; steering only speeds you up to a run, never slows a faster flight
        if (dirX && !(p.vx * dirX > RUN)) p.vx += clamp(dirX * RUN - p.vx, -AIR_ACCEL * dt, AIR_ACCEL * dt);
        moveX(scr, p, p.vx * dt);
        const py = p.y;
        p.vy = Math.min(420, p.vy + GRAV * dt);
        p.y += p.vy * dt;

        if (p.layer === 'surface') {
            if (p.vy >= 0 && py <= SURF && p.y >= SURF) {
                const f = floorAt(scr, p.x);
                if (f === F_GROUND) land(G, p, SURF);
                else if (f === F_CROC) {
                    if (crocOpen(scr.crocs[croc_i], G.t)) { p.y = SURF; die(G, 'chomp'); return; }
                    land(G, p, SURF);
                }
            }
            if (p.st === 'air' && p.y > SURF) {
                const r = regionAt(scr, p.x);
                if (!r) land(G, p, SURF);
                else if (r.type === 'hole') { if (p.y - BODY_H > CEIL) p.layer = 'tunnel'; }
                else if (p.y > SURF + PIT_DEPTH) { die(G, r.type === 'water' ? 'drown' : 'sink'); return; }
            }
            // grab a vine: the chest touches the rope
            if (p.st === 'air' && scr.vine && p.cool <= 0 && ctl) {
                const v = scr.vine;
                const th = vineTheta(v, G.t), sn = Math.sin(th), cs = Math.cos(th);
                const cx = p.x, cy = p.y - HAND;
                const s = clamp((cx - v.x) * sn + (cy - v.y0) * cs, v.L * 0.5, v.L);
                if (Math.hypot(cx - (v.x + s * sn), cy - (v.y0 + s * cs)) < VINE.grab) {
                    p.st = 'vine'; p.vineS = s; p.vx = 0; p.vy = 0; G.stats.vines++;
                    ev(G, 'grab', { x: cx, y: cy, s });
                    return;
                }
            }
        } else if (p.vy >= 0 && p.y >= TF) land(G, p, TF);
    }

    // ---- hazards (pits and crocodiles are handled above)
    if (p.inv <= 0 && p.st !== 'dead') {
        if (p.layer === 'surface') {
            for (const L of scr.logs) {
                const lx = logX(L, G.t + (G.logShift || 0));
                if (lx < -14 || lx > W + 14) continue;
                if (Math.abs(p.x - lx) < LOG.r + HW - HIT_FORGIVE && p.y > SURF - LOG.h + 1) {
                    G.score = Math.max(0, G.score - HIT_PENALTY);
                    G.stats.hits++;
                    p.stun = STUN;
                    p.inv = STUN + INV_HIT;
                    p.vx = (p.x < lx ? -1 : 1) * 70;
                    p.vy = -110;
                    p.st = 'air'; p.coy = 0;
                    ev(G, 'hit', { what: 'log', x: p.x, y: p.y, lx });
                    break;
                }
            }
            if (p.st !== 'dead') {
                for (const c of scr.cobras) if (Math.abs(p.x - c.x) < 3.5 + HW && p.y > SURF - 12) { die(G, 'bite'); return; }
                for (const f of scr.fires) if (Math.abs(p.x - f.x) < 4 + HW && p.y > SURF - 12) { die(G, 'burn'); return; }
            }
        } else if (scr.tunnel.scorp) {
            const sp = scorpPos(scr.tunnel.scorp, G.t);
            if (Math.abs(p.x - sp.x) < 6 + HW - HIT_FORGIVE && p.y > TF - 8) { die(G, 'sting'); return; }
        }
    }

    // ---- treasure
    const tr = scr.treasure;
    if (tr && !G.got[tr.id] && tr.layer === p.layer && Math.abs(p.x - tr.x) < 9
        && p.y > (tr.layer === 'tunnel' ? TF : SURF) - 20) {
        collect(G, tr);
        if (G.over) return;
    }

    // ---- off the edge of the screen
    if (p.x >= W) changeScreen(G, 1);
    else if (p.x <= 0) changeScreen(G, -1);
}
