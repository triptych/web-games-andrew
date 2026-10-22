// An auto-player. It plays through the same input the player uses, so the tests, the balance
// table and the title screen's demo all exercise the real rules. Pure, like the rest of js/sim.
//
// How it plays: it picks the nearest treasure, then drives along the ring toward it. Every time it
// has to decide how to cross something, it runs the REAL simulation forward on a cloned game for
// each candidate (run on, or run/stand then jump at step j) and takes the candidate that survives
// and loses the least time. Logs, crocodile jaws, vines and scorpions are functions of the clock,
// so the forecast is exact; a worse bot (skill < 1) jitters when it jumps.

import { step, cloneGame, floorAt, vineTheta, vineOmega, F_GROUND } from './game.js';
import { getWorld } from './world.js';
import { makeRng } from '../rng.js';
import { STEP, W, SURF, N_SCREENS, GRAV, VINE, LX, RUN } from '../config.js';

const IDLE = { x: 0, y: 0, a: false };
const RING = N_SCREENS * W;
const PER_STEP = RUN * STEP;                 // px a run covers in one step
const TAIL = 14;                              // steps played after a landing; the next decision handles what comes after

export function makeBot({ skill = 1, seed = 1 } = {}) {
    return { skill, rng: makeRng(seed * 977 + 13), n: 0, script: null, dir: 1 };
}

const ringPos = (G) => G.screen * W + G.p.x;
const wrap = (d) => { d %= RING; if (d > RING / 2) d -= RING; else if (d < -RING / 2) d += RING; return d; };

/** Should Harry let go of the vine now? Yes if the flight lands on solid ground beyond the pivot. */
function vineRelease(G, dir) {
    const p = G.p, scr = getWorld(G.seed).screens[G.screen], v = scr.vine;
    if (!v) return true;
    const th = vineTheta(v, G.t);
    const vt = p.vineS * vineOmega(v, G.t);
    const vx = vt * Math.cos(th) * VINE.boost;
    const vy = -vt * Math.sin(th) - VINE.hop;
    if (vx * dir < 20) return false;
    const disc = vy * vy + 2 * GRAV * (SURF - p.y);
    if (disc < 0) return false;
    const tau = (-vy + Math.sqrt(disc)) / GRAV;
    const lx = p.x + vx * tau;
    if ((lx - v.x) * dir < 12) return false;
    if (lx < 8 || lx > W - 8) return true;
    return floorAt(scr, lx) === F_GROUND && floorAt(scr, lx - 5) === F_GROUND && floorAt(scr, lx + 5) === F_GROUND;
}

/**
 * Run the game forward from G0 with "move dx, jump at step jumpAt" and report what happened.
 * After the jump has landed it plays TAIL more steps, so a landing on a hazard still counts against it.
 */
function rollout(G0, dx, jumpAt, o) {
    const c = cloneGame(G0);
    const start = ringPos(c);
    let landed = -1, hit = false, n = 0;
    for (; n < o.cap; n++) {
        const vine = c.p.st === 'vine';
        const a = vine ? vineRelease(c, o.dir) : n === jumpAt;
        step(c, { x: vine ? 0 : dx, y: 0, a }, STEP);
        if (c.events.length) {
            for (const e of c.events) {
                if (e.type === 'death') return { dead: true, steps: n, progress: 0 };
                if (e.type === 'hit') hit = true;
            }
            c.events.length = 0;
        }
        if (c.over) break;
        if (!o.allowDrop && c.p.layer !== o.layer) return { dead: true, steps: n, progress: 0, fell: true };
        if (c.screen === o.screen && Math.abs(c.p.x - o.goalX) < 2.5) { n++; break; }
        if (jumpAt >= 0 && n > jumpAt && c.p.st === 'ground') {
            if (landed < 0) landed = n;
            else if (n - landed >= TAIL) { n++; break; }
        }
    }
    return { dead: false, hit, steps: n, progress: wrap(ringPos(c) - start) * o.dir };
}

const JUMPS = [-1, 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 84, 96, 108, 120, 132, 144, 168, 192, 216, 240, 264, 288, 312, 336, 360];

function plan(G, bot, goalX, dir, allowDrop) {
    const p = G.p;
    const o = { dir, goalX, allowDrop, layer: p.layer, screen: G.screen, cap: 75 };
    // the common case: running on is fine
    const r0 = rollout(G, dir, -1, o);
    if (!r0.dead && !r0.hit) return { dx: dir, jumpN: -1, until: bot.n + 10 };

    const scr = getWorld(G.seed).screens[G.screen];
    const tail = scr.vine ? 620 : 200;
    let best = null, bestScore = -Infinity, fallback = null, fallbackScore = -Infinity;
    for (const dx of [dir, 0]) {
        for (const j of JUMPS) {
            if (dx === 0 && j < 0) continue;
            o.cap = j < 0 ? 140 : j + tail;
            const r = rollout(G, dx, j, o);
            if (r.dead) {
                if (r.steps > fallbackScore) { fallbackScore = r.steps; fallback = { dx, j }; }
                continue;
            }
            const lost = PER_STEP * r.steps - r.progress;
            const score = -lost - (r.hit ? 400 : 0);
            if (score > bestScore) { bestScore = score; best = { dx, j }; }
        }
    }
    const pick = best || fallback || { dx: 0, j: -1 };
    let j = pick.j;
    if (j >= 0 && bot.skill < 1) j = Math.max(0, j + Math.round((bot.rng() - 0.5) * (1 - bot.skill) * 60));
    return { dx: pick.dx, jumpN: j < 0 ? -1 : bot.n + j, until: j < 0 ? bot.n + 10 : bot.n + j + 200 };
}

/** Walk toward goalX on the current screen (or off its edge), jumping what needs jumping. */
function drive(G, bot, goalX, allowDrop) {
    const p = G.p;
    const d = goalX - p.x;
    if (Math.abs(d) < 2.5) return IDLE;
    const dir = d > 0 ? 1 : -1;
    bot.dir = dir;
    let s = bot.script;
    if (s) {
        const done = bot.n >= s.until || (s.jumpN >= 0 && bot.n > s.jumpN + 2 && p.st === 'ground') || s.dir !== dir || s.layer !== p.layer || s.screen !== G.screen;
        if (done) s = bot.script = null;
    }
    if (!s) {
        s = bot.script = plan(G, bot, goalX, dir, allowDrop);
        s.dir = dir; s.layer = p.layer; s.screen = G.screen;
    }
    return { x: s.dx, y: 0, a: bot.n === s.jumpN };
}

/** The nearest treasure by ring distance, with a little extra for the tunnels. */
export function chooseGoal(G) {
    const world = getWorld(G.seed);
    let best = null, bc = Infinity;
    for (const t of world.treasures) {
        if (G.got[t.id]) continue;
        const f = (t.screen - G.screen + N_SCREENS) % N_SCREENS, b = N_SCREENS - f;
        const dist = Math.min(f, b);
        const cost = dist * 4 + (t.layer === 'tunnel' ? 5 : 0);
        if (cost < bc) { bc = cost; best = { t, dist: f === 0 ? 0 : dist, dir: f <= b ? 1 : -1 }; }
    }
    return best;
}

export function botInput(G, bot) {
    bot.n++;
    const p = G.p;
    if (G.over || p.st === 'dead') return IDLE;
    if (p.st === 'vine') return { x: 0, y: 0, a: vineRelease(G, bot.dir) };
    if (p.st === 'ladder') return { x: 0, y: p.layer === 'tunnel' ? -1 : 1, a: false };
    if (p.stun > 0) return IDLE;
    const g = chooseGoal(G);
    if (!g) return IDLE;
    const scr = getWorld(G.seed).screens[G.screen];

    if (p.layer === 'tunnel') {
        if (g.dist === 0 && g.t.layer === 'tunnel') return drive(G, bot, g.t.x, false);
        if (scr.ladder) {
            if (Math.abs(p.x - LX) <= 6) return { x: 0, y: -1, a: false };
            return drive(G, bot, LX, false);
        }
        return drive(G, bot, g.dir > 0 ? W + 8 : -8, false);
    }
    if (g.dist === 0) {
        if (g.t.layer === 'surface') return drive(G, bot, g.t.x, false);
        // an underground treasure: step into the hole
        return drive(G, bot, LX, true);
    }
    return drive(G, bot, g.dir > 0 ? W + 8 : -8, false);
}

/** Drive off the edge of the screen in one direction (the crossing test uses this). */
export function driveEdge(G, bot, dir) {
    bot.n++;
    const p = G.p;
    if (G.over || p.st === 'dead' || p.stun > 0) return IDLE;
    if (p.st === 'vine') return { x: 0, y: 0, a: vineRelease(G, dir) };
    return drive(G, bot, dir > 0 ? W + 8 : -8, false);
}
export { rollout, JUMPS };
