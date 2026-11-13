// An auto-player. It plays through the same input record the player uses and follows the same target() the HUD
// arrow shows, so the tests, the balance table and the title-screen demo all exercise the real rules. Pure.
//
// skill 1 drives flat out and times the crane hook well; lower skill drives slower, dawdles and mistimes the hook.

import { RADIUS, WORK } from '../config.js';
import { makeRng } from '../rng.js';
import { JOBS } from './data/jobs.js';
import { BUILDINGS, ZONES } from './data/city.js';
import { current, target } from './game.js';
import { dist, wrapAngle, local, distRect, clamp } from './world.js';
import { staticGrid, withDebris, nearestFree, findPath, lineFree, centre } from './nav.js';

export function makeBot({ skill = 1, seed = 1 } = {}) {
    return {
        skill, rng: makeRng(seed + 7919),
        grids: { rev: -1 }, g: null, path: null, pathKey: '', planAt: 0,
        did: null, phase: 'approach', phaseAt: 0, spot: null,
        mv: 0, cx: 0, cy: 0, checkAt: 0, backUntil: 0, backSteer: 0,
        sec: -1, pauseUntil: 0, err: 0,
    };
}

function grid(G, bot, pad) {
    if (bot.grids.rev !== G.rev) bot.grids = { rev: G.rev };
    return (bot.grids[pad] ||= staticGrid(G, pad));
}

/** Steer toward a goal along a planned path. Returns true once within `arrive` of it. */
function driveTo(G, bot, out, goal, { arrive = 0, skip = -1, pad = 0.35, slow = 1 } = {}) {
    const p = G.p, dg = dist(p, goal);
    if (dg <= arrive) { bot.mv = 0; return true; }
    bot.mv++;
    const key = `${Math.round(goal.x)},${Math.round(goal.y)},${skip},${pad},${G.rev}`;
    if (key !== bot.pathKey || G.t >= bot.planAt) {
        bot.g = withDebris(G, grid(G, bot, pad), skip);
        const cells = findPath(bot.g, nearestFree(bot.g, p.x, p.y), nearestFree(bot.g, goal.x, goal.y));
        bot.path = cells ? cells.map(centre) : null;
        bot.pathKey = key; bot.planAt = G.t + 0.6;
    }
    let aim = goal;
    if (bot.path && !lineFree(bot.g, p.x, p.y, goal.x, goal.y)) {
        aim = bot.path[Math.min(1, bot.path.length - 1)];
        for (let i = bot.path.length - 1; i > 0; i--) if (lineFree(bot.g, p.x, p.y, bot.path[i].x, bot.path[i].y)) { aim = bot.path[i]; break; }
    }
    steer(G, bot, out, aim, slow);
    if (arrive > 0) out.y = Math.max(out.y, -Math.max(0.35, (dg - arrive) / 4));
    return false;
}

function steer(G, bot, out, aim, slow = 1) {
    const p = G.p, da = wrapAngle(Math.atan2(aim.y - p.y, aim.x - p.x) - p.a), ad = Math.abs(da);
    out.x = clamp(da * 2.5, -1, 1);
    out.y = -(ad > 1.1 ? 0.2 : ad > 0.5 ? 0.6 : 1) * slow * (0.55 + 0.45 * bot.skill);
}

export function botInput(G, bot) {
    const out = { x: 0, y: 0, a: false, h: false, veh: null, job: null };
    const c = current(G), p = G.p;
    if (!c) {
        const j = JOBS.find((x) => G.jobs[x.id].st === 'open');
        if (j) out.job = j.id;
        return out;
    }
    const { job, st, pr } = c;
    if (G.veh !== st.veh) { out.veh = st.veh; return out; }

    // a less skilled player dawdles
    const sec = Math.floor(G.t);
    if (sec !== bot.sec) { bot.sec = sec; if (bot.rng() < (1 - bot.skill) * 0.3) bot.pauseUntil = G.t + 1; }
    if (G.t < bot.pauseUntil) return out;
    const slowNow = Math.abs(p.v) < WORK.loadSpeed;

    if (st.kind === 'haul') {
        if (!G.cargo.dump) { const z = ZONES[st.from]; driveTo(G, bot, out, z, { arrive: z.r - 1.8 }); }
        else { driveTo(G, bot, out, st.site, { arrive: st.site.r - 1.2 }); if (dist(p, st.site) < st.site.r - 0.3) out.a = true; }
    } else if (st.kind === 'roll') {
        const tg = target(G);
        if (tg) driveTo(G, bot, out, tg, { arrive: 0 });
    } else if (st.kind === 'push') {
        const mine = G.debris.filter((d) => d.job === job.id);
        let d = mine.find((x) => x.id === bot.did);
        if (!d && mine.length) { d = mine.reduce((b, x) => (dist(p, x) < dist(p, b) ? x : b)); bot.did = d.id; bot.phase = 'approach'; bot.spot = null; }
        if (d) {
            const { f, l } = local(p, d), reach = RADIUS + d.r;
            if (f > 0 && Math.abs(l) < WORK.bladeHalf - 0.3 && f < reach + 0.25) {
                bot.phase = 'ram'; bot.phaseAt = G.t;
                driveTo(G, bot, out, st.zone, { arrive: 0, skip: d.id, pad: 1.3, slow: 0.85 });
            } else if (bot.phase === 'approach') {
                // get behind the piece, on the side away from where it has to go
                if (!bot.spot || G.t >= bot.spot.at) {
                    const zx = d.x - st.zone.x, zy = d.y - st.zone.y, zl = Math.hypot(zx, zy) || 1;
                    const g = withDebris(G, grid(G, bot, 0.35));
                    const k = nearestFree(g, d.x + (zx / zl) * (reach + 1.6), d.y + (zy / zl) * (reach + 1.6));
                    bot.spot = { ...(k >= 0 ? centre(k) : { x: d.x, y: d.y }), at: G.t + 1 };
                }
                if (driveTo(G, bot, out, bot.spot, { arrive: 1.1 })) { bot.phase = 'ram'; bot.phaseAt = G.t; }
            } else {
                steer(G, bot, out, d, 0.8); bot.mv++;
                if (dist(p, d) > reach + 6 || G.t - bot.phaseAt > 4) { bot.phase = 'approach'; bot.spot = null; bot.did = null; }
            }
        }
    } else if (st.kind === 'scoop') {
        const tg = target(G);
        if (tg && tg.what === 'tip') {
            driveTo(G, bot, out, st.zone, { arrive: st.zone.r + 0.8 });
            if (dist(p, st.zone) < st.zone.r + 1.8) out.a = true;
        } else if (tg) {
            const mine = G.debris.filter((d) => d.job === job.id);
            let d = mine.find((x) => x.id === bot.did);
            if (!d) { d = mine.find((x) => x.id === tg.id); bot.did = d.id; }
            driveTo(G, bot, out, d, { arrive: 0, skip: d.id });
        }
    } else if (st.kind === 'dig' || st.kind === 'pour') {
        const tg = target(G);
        if (tg) { if (driveTo(G, bot, out, tg, { arrive: WORK.workReach - 1.2 })) out.h = true; }
    } else if (st.kind === 'lift') {
        const s = st.sites[pr.n % st.sites.length];
        if (driveTo(G, bot, out, s, { arrive: s.r - 1.6 }) && slowNow && G.missCd <= 0
            && Math.abs(Math.sin(G.hookT + bot.err)) < WORK.hookWindow * 0.45) {
            out.a = true;
            bot.err = (1 - bot.skill) * 0.9 * (bot.rng() * 2 - 1);
        }
    } else if (st.kind === 'wreck') {
        const b = BUILDINGS.find((x) => x.id === st.building);
        if (distRect(p, b) - RADIUS <= WORK.wreckReach - 0.6) { bot.mv = 0; if (G.swing <= 0) out.a = true; }
        else {
            const off = RADIUS + 2.2, g = grid(G, bot, 0.35);
            const spots = [{ x: b.x + b.w / 2, y: b.y - off }, { x: b.x + b.w / 2, y: b.y + b.h + off }, { x: b.x - off, y: b.y + b.h / 2 }, { x: b.x + b.w + off, y: b.y + b.h / 2 }]
                .filter((s) => nearestFree(g, s.x, s.y, 0) >= 0);
            const s = spots.reduce((best, x) => (!best || dist(p, x) < dist(p, best) ? x : best), null);
            if (s) driveTo(G, bot, out, s, { arrive: 0.8 });
        }
    }

    // wedged against something: back off and try again
    if (G.t < bot.backUntil) { out.y = 0.9; out.x = bot.backSteer; out.a = false; out.h = false; }
    else if (G.t >= bot.checkAt) {
        if (bot.mv > 100 && Math.hypot(p.x - bot.cx, p.y - bot.cy) < 0.5) {
            bot.backUntil = G.t + 0.8; bot.backSteer = bot.rng() < 0.5 ? -1 : 1;
            bot.pathKey = ''; bot.phase = 'approach'; bot.spot = null;
        }
        bot.cx = p.x; bot.cy = p.y; bot.checkAt = G.t + 1.2;
    }
    return out;
}
