// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// Input record: { x, y, a, h, veh, job }
//   x steer (-1 left .. 1 right), y throttle (-1 forward .. 1 reverse), a = action pressed since the last step,
//   h = action held, veh = a vehicle id to climb into, job = a job id to take from the board.

import { WORLD, RADIUS, VEH, DRIVE, WORK, STAR2 } from '../config.js';
import { makeRng } from '../rng.js';
import { JOBS, JOB } from './data/jobs.js';
import { ZONES, SPAWN, BUILDINGS } from './data/city.js';
import { clamp, dist, wrapAngle, obstacles, pushOut, distRect, cellsOf, local } from './world.js';

const MAX_EVENTS = 400;                       // a headless run that never drains must not grow without bound
const ev = (G, type, data) => { if (G.events.length < MAX_EVENTS) G.events.push({ type, ...data }); };

export function newGame(seed = 1) {
    const G = {
        v: 1, seed, rng: makeRng(seed), t: 0,
        rev: 0,                               // bumps whenever the town changes (a step completes)
        veh: 'dump',
        p: { x: SPAWN.x, y: SPAWN.y, a: SPAWN.a, v: 0 },
        cargo: { dump: 0, loader: 0 }, cargoJob: null,
        jobs: {}, active: null,
        debris: [], nextId: 1,                // { id, job, kind, x, y, r }
        load: 0, hookT: 0, missCd: 0, swing: 0, tick: 0,
        switchCd: 0, honkCd: 0, touching: false,
        stars: 0, finished: false, odo: 0,
        events: [],                           // { type, ... } since the last drain; never saved
    };
    for (const j of JOBS) G.jobs[j.id] = { st: j.needs.length ? 'locked' : 'open', step: 0, time: 0, stars: 0, prog: null };
    return G;
}

// ------------------------------------------------------------------------------------------------ jobs
function initStep(G, job, js) {
    const st = job.steps[js.step];
    if (st.kind === 'roll') js.prog = { n: 0, cells: cellsOf(st.rect, WORK.rollCell).map(() => 0) };
    else if (st.kind === 'dig' || st.kind === 'pour') js.prog = { n: 0, spots: st.spots.map(() => 0) };
    else if (st.kind === 'wreck') js.prog = { n: 0, hp: st.hp };
    else if (st.kind === 'push' || st.kind === 'scoop') {
        let total = 0;
        const obs = obstacles(G);
        for (const it of st.items) for (let i = 0; i < it.n; i++) {
            const r = WORK.debrisR[it.kind];
            let x = st.at.x, y = st.at.y;
            for (let tries = 0; tries < 300; tries++) {
                const ang = G.rng() * Math.PI * 2, rad = Math.sqrt(G.rng()) * st.at.r;
                x = st.at.x + Math.cos(ang) * rad; y = st.at.y + Math.sin(ang) * rad;
                const clear = G.debris.every((d) => Math.hypot(d.x - x, d.y - y) > d.r + r + 0.3)
                    && obs.every((o) => distRect({ x, y }, o) > r + WORK.wallMargin)
                    && Math.hypot(x - st.zone.x, y - st.zone.y) > st.zone.r + r;
                if (clear) break;
            }
            G.debris.push({ id: G.nextId++, job: job.id, kind: it.kind, x, y, r });
            total++;
        }
        js.prog = { n: 0, total };
    } else js.prog = { n: 0 };
}

function takeJob(G, id) {
    const js = G.jobs[id];
    if (!js || js.st !== 'open' || G.active === id) return;
    G.active = id;
    const first = !js.prog;
    if (first) initStep(G, JOB[id], js);
    ev(G, 'jobStart', { job: id, first: first && js.step === 0 });
}

function completeStep(G, job, js) {
    const st = job.steps[js.step];
    ev(G, 'stepDone', { job: job.id, step: js.step, kind: st.kind });
    js.step++; js.prog = null; G.rev++;
    G.load = 0; G.swing = 0;
    if (js.step < job.steps.length) { initStep(G, job, js); return; }
    js.st = 'done';
    js.stars = js.time <= job.par ? 3 : js.time <= job.par * STAR2 ? 2 : 1;
    G.stars += js.stars;
    G.active = null;
    ev(G, 'jobDone', { job: job.id, stars: js.stars, time: js.time });
    for (const j of JOBS) {
        const s = G.jobs[j.id];
        if (s.st === 'locked' && j.needs.every((n) => G.jobs[n].st === 'done')) { s.st = 'open'; ev(G, 'unlock', { job: j.id }); }
    }
    if (JOBS.every((j) => G.jobs[j.id].st === 'done')) { G.finished = true; ev(G, 'allDone', { stars: G.stars }); }
}

/** The step in hand: { job, js, st, pr } or null. */
export function current(G) {
    if (!G.active) return null;
    const job = JOB[G.active], js = G.jobs[G.active];
    return { job, js, st: job.steps[js.step], pr: js.prog };
}

/** How far the step in hand has got: { n, total }. */
export function progress(G) {
    const c = current(G);
    if (!c) return null;
    const { st, pr } = c;
    const total = st.kind === 'roll' ? pr.cells.length : st.kind === 'dig' || st.kind === 'pour' ? st.spots.length
        : st.kind === 'wreck' ? st.hp : st.kind === 'push' || st.kind === 'scoop' ? pr.total : st.n;
    return { n: Math.min(pr.n, total), total };
}

/**
 * Where to go next for the step in hand: { x, y, r, veh, what } or null. The HUD arrow, the beacon and the bot all
 * use this, so the hint the player sees is the plan the test bot follows.
 */
export function target(G) {
    const c = current(G);
    if (!c) return null;
    const { st, pr, job } = c, p = G.p;
    const out = (pt, r, what) => ({ x: pt.x, y: pt.y, r, veh: st.veh, what });
    const nearest = (list) => list.reduce((b, d) => (!b || dist(p, d) < dist(p, b) ? d : b), null);
    if (st.kind === 'haul') return G.cargo.dump ? out(st.site, st.site.r, 'tip') : out(ZONES[st.from], ZONES[st.from].r, 'load');
    if (st.kind === 'roll') {
        const left = cellsOf(st.rect, WORK.rollCell).filter((_, i) => !pr.cells[i]);
        return left.length ? out(nearest(left), WORK.rollReach, 'roll') : null;
    }
    if (st.kind === 'push' || st.kind === 'scoop') {
        const mine = G.debris.filter((d) => d.job === job.id);
        const full = st.kind === 'scoop' && G.cargoJob === job.id && (G.cargo.loader >= WORK.bucket || (!mine.length && G.cargo.loader > 0));
        if (full || !mine.length) return out(st.zone, st.zone.r, 'tip');
        const d = nearest(mine);
        return { ...out(d, d.r, st.kind), id: d.id, zone: st.zone };
    }
    if (st.kind === 'dig' || st.kind === 'pour') {
        const i = pr.spots.findIndex((v) => v < 1);
        return i < 0 ? null : { ...out(st.spots[i], WORK.workReach, st.kind), i };
    }
    if (st.kind === 'lift') { const s = st.sites[pr.n % st.sites.length]; return out(s, s.r, 'lift'); }
    if (st.kind === 'wreck') {
        const b = BUILDINGS.find((x) => x.id === st.building);
        return { ...out({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, Math.max(b.w, b.h) / 2 + WORK.wreckReach, 'wreck'), building: b.id };
    }
    return null;
}

// ------------------------------------------------------------------------------------------------ driving
function drive(G, inp, dt) {
    const V = VEH[G.veh], p = G.p;
    const thr = clamp(-(inp.y || 0), -1, 1), steer = clamp(inp.x || 0, -1, 1);
    const want = thr >= 0 ? thr * V.vmax : thr * V.vmax * DRIVE.reverse;
    const rate = V.acc * (want === 0 || want * p.v < 0 ? 1.8 : 1);
    p.v += clamp(want - p.v, -rate * dt, rate * dt);
    const ts = V.pivot ? 1 : DRIVE.spotTurn + (1 - DRIVE.spotTurn) * Math.min(1, Math.abs(p.v) / DRIVE.turnSpeed);
    p.a = wrapAngle(p.a + steer * V.turn * ts * (p.v < -0.3 ? -1 : 1) * dt);
    p.x += Math.cos(p.a) * p.v * dt;
    p.y += Math.sin(p.a) * p.v * dt;
    G.odo += Math.abs(p.v) * dt;
}

function collide(G, dt) {
    const p = G.p, obs = obstacles(G);
    let hit = false;
    for (const r of obs) if (pushOut(p, RADIUS, r)) hit = true;
    const bx = clamp(p.x, RADIUS, WORLD.w - RADIUS), by = clamp(p.y, RADIUS, WORLD.h - RADIUS);
    if (bx !== p.x || by !== p.y) { p.x = bx; p.y = by; hit = true; }

    // the dozer's blade carries what is in front of it; the loader's bucket picks small pieces up
    for (let i = G.debris.length - 1; i >= 0; i--) {
        const d = G.debris[i], reach = RADIUS + d.r;
        const { f, l } = local(p, d);
        if (f <= 0 || Math.abs(l) >= WORK.bladeHalf) continue;
        if (G.veh === 'loader' && (d.kind === 'rubble' || d.kind === 'rock') && f < reach + 0.2
            && G.cargo.loader < WORK.bucket && (G.cargo.loader === 0 || G.cargoJob === d.job)) {
            G.debris.splice(i, 1);
            G.cargo.loader++; G.cargoJob = d.job;
            ev(G, 'scoop', { x: d.x, y: d.y, n: G.cargo.loader });
        } else if (G.veh === 'dozer' && f < reach && p.v > -0.1) {
            const nl = l - l * Math.min(1, 1.5 * dt), c = Math.cos(p.a), s = Math.sin(p.a);
            d.x = p.x + reach * c - nl * s;
            d.y = p.y + reach * s + nl * c;
        }
    }
    // debris against walls (and drifting clear of them, so nothing can be wedged in a corner), the edge and each other
    const probe = { x: 0, y: 0 };
    for (const d of G.debris) {
        for (const r of obs) {
            pushOut(d, d.r, r);
            probe.x = d.x; probe.y = d.y;
            if (pushOut(probe, d.r + WORK.wallMargin, r)) {
                const dx = probe.x - d.x, dy = probe.y - d.y, len = Math.hypot(dx, dy) || 1, k = Math.min(len, WORK.wallDrift * dt) / len;
                d.x += dx * k; d.y += dy * k;
            }
        }
        d.x = clamp(d.x, d.r + 1, WORLD.w - d.r - 1); d.y = clamp(d.y, d.r + 1, WORLD.h - d.r - 1);
    }
    for (let i = 0; i < G.debris.length; i++) for (let j = i + 1; j < G.debris.length; j++) {
        const a = G.debris[i], b = G.debris[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
        if (d < min && d > 1e-6) { const k = (min - d) / d / 2; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
    }
    // anything still overlapping the vehicle blocks it
    for (const d of G.debris) {
        const dx = p.x - d.x, dy = p.y - d.y, dd = Math.hypot(dx, dy), min = RADIUS + d.r - 0.001;
        if (dd < min && dd > 1e-6) { p.x = d.x + (dx / dd) * min; p.y = d.y + (dy / dd) * min; hit = true; }
    }
    if (hit) {
        if (!G.touching) { if (Math.abs(p.v) > 3) ev(G, 'bump', { x: p.x, y: p.y }); p.v *= DRIVE.bump; }
        else p.v *= Math.max(0, 1 - 3 * dt);
    }
    G.touching = hit;
}

// ------------------------------------------------------------------------------------------------ work
function work(G, inp, dt) {
    const p = G.p, a = !!inp.a, hold = a || !!inp.h, slow = Math.abs(p.v) < WORK.loadSpeed;
    let used = false;
    const c = current(G);
    if (c) {
        const { job, js, st, pr } = c, on = G.veh === st.veh;
        js.time += dt;
        let done = false;
        if (st.kind === 'haul') {
            const z = ZONES[st.from];
            if (on && !G.cargo.dump && slow && dist(p, z) < z.r) {
                G.load += dt;
                if (G.load >= WORK.loadTime) { G.cargo.dump = 1; G.load = 0; ev(G, 'loaded', { x: z.x, y: z.y }); }
            } else G.load = 0;
            if (on && a && G.cargo.dump && dist(p, st.site) < st.site.r) {
                G.cargo.dump = 0; pr.n++; used = true;
                ev(G, 'dumped', { x: st.site.x, y: st.site.y, n: pr.n });
            }
            done = pr.n >= st.n;
        } else if (st.kind === 'roll') {
            if (on) cellsOf(st.rect, WORK.rollCell).forEach((cell, i) => {
                if (!pr.cells[i] && dist(p, cell) < WORK.rollReach) { pr.cells[i] = 1; pr.n++; ev(G, 'rolled', { x: cell.x, y: cell.y, i }); }
            });
            done = pr.n >= pr.cells.length;
        } else if (st.kind === 'push' || st.kind === 'scoop') {
            if (st.kind === 'scoop' && on && a && G.cargo.loader > 0 && G.cargoJob === job.id && dist(p, st.zone) < st.zone.r + 2) {
                pr.n += G.cargo.loader; used = true;
                ev(G, 'dumped', { x: st.zone.x, y: st.zone.y, n: G.cargo.loader });
                G.cargo.loader = 0; G.cargoJob = null;
            }
            for (let i = G.debris.length - 1; i >= 0; i--) {
                const d = G.debris[i];
                if (d.job === job.id && dist(d, st.zone) < st.zone.r - 0.2) {
                    G.debris.splice(i, 1); pr.n++;
                    ev(G, 'cleared', { x: d.x, y: d.y, kind: d.kind });
                }
            }
            done = pr.n >= pr.total;
        } else if (st.kind === 'dig' || st.kind === 'pour') {
            if (on && hold && slow) {
                let best = -1;
                st.spots.forEach((s, i) => { if (pr.spots[i] < 1 && dist(p, s) < WORK.workReach && (best < 0 || dist(p, s) < dist(p, st.spots[best]))) best = i; });
                if (best >= 0) {
                    used = true;
                    const s = st.spots[best];
                    pr.spots[best] += dt / (st.kind === 'dig' ? WORK.digTime : WORK.pourTime);
                    G.tick += dt;
                    if (G.tick >= 0.4) { G.tick = 0; ev(G, st.kind === 'dig' ? 'digTick' : 'pourTick', { x: s.x, y: s.y }); }
                    if (pr.spots[best] >= 1) { pr.spots[best] = 1; pr.n++; ev(G, st.kind === 'dig' ? 'dug' : 'poured', { x: s.x, y: s.y, i: best }); }
                }
            }
            done = pr.n >= st.spots.length;
        } else if (st.kind === 'lift') {
            const s = st.sites[pr.n % st.sites.length];
            G.hookT += dt * (WORK.hookSpeed + WORK.hookRamp * pr.n);
            if (on && a && slow && dist(p, s) < s.r) {
                used = true;
                if (G.missCd <= 0) {
                    if (Math.abs(Math.sin(G.hookT)) < WORK.hookWindow) { pr.n++; G.missCd = WORK.placeCd; ev(G, 'placed', { x: s.x, y: s.y, n: pr.n }); }
                    else { G.missCd = WORK.missCd; ev(G, 'miss', {}); }
                }
            }
            done = pr.n >= st.n;
        } else if (st.kind === 'wreck') {
            const b = BUILDINGS.find((x) => x.id === st.building), near = on && distRect(p, b) - RADIUS <= WORK.wreckReach;
            if (G.swing > 0) {
                G.swing -= dt;
                if (G.swing <= 0) {
                    G.swing = 0;
                    if (near) { pr.hp--; pr.n++; ev(G, 'smash', { x: b.x + b.w / 2, y: b.y + b.h / 2, left: pr.hp }); }
                }
            } else if (near && a) { G.swing = WORK.swingTime; used = true; ev(G, 'swing', {}); }
            done = pr.hp <= 0;
            if (done) ev(G, 'collapse', { x: b.x + b.w / 2, y: b.y + b.h / 2, building: b.id });
        }
        if (done) completeStep(G, job, js);
    }
    if (a && !used) {
        // a loader anywhere else tips one piece back out, so a bucket is never stuck full
        if (G.veh === 'loader' && G.cargo.loader > 0) {
            const kind = G.cargoJob && JOB[G.cargoJob].steps.find((s) => s.kind === 'scoop')?.items[0].kind || 'rubble';
            const r = WORK.debrisR[kind], f = RADIUS + r + 1;
            G.debris.push({ id: G.nextId++, job: G.cargoJob, kind, x: p.x + Math.cos(p.a) * f, y: p.y + Math.sin(p.a) * f, r });
            if (--G.cargo.loader === 0) G.cargoJob = null;
            ev(G, 'drop', { x: p.x, y: p.y });
        } else if (G.honkCd <= 0) { G.honkCd = DRIVE.honkCd; ev(G, 'honk', {}); }
    }
}

/** Advance one fixed step. */
export function step(G, inp, dt) {
    G.t += dt;
    G.switchCd = Math.max(0, G.switchCd - dt);
    G.honkCd = Math.max(0, G.honkCd - dt);
    G.missCd = Math.max(0, G.missCd - dt);
    if (inp.veh && inp.veh !== G.veh && VEH[inp.veh] && G.switchCd <= 0) {
        G.veh = inp.veh; G.switchCd = DRIVE.switchCd; G.load = 0; G.swing = 0;
        ev(G, 'switch', { veh: G.veh });
    }
    if (inp.job) takeJob(G, inp.job);
    drive(G, inp, dt);
    collide(G, dt);
    const rev = G.rev;
    work(G, inp, dt);
    // the town just changed (a house went up, a statue appeared): nobody is left standing inside a wall
    if (G.rev !== rev) for (const r of obstacles(G)) pushOut(G.p, RADIUS, r);
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
