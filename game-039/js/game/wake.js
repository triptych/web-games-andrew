/**
 * The wake: the field of frozen echoes the probe leaves behind.
 *
 * This is the core system. An echo is a single instant of the probe — a position
 * plus the polarity the probe held at that moment — that persists after the probe
 * has flown on, and exerts the same force on motes the probe does.
 *
 * Motes are queried against the wake every frame, so echo lookup goes through a
 * uniform-grid spatial hash sized to ECHO_REACH; with a few hundred echoes and a
 * few dozen motes a brute-force scan would be tens of thousands of distance tests
 * per frame.
 */

import {
    ECHO_INTERVAL, ECHO_MIN_GAP, ECHO_LIFE, ECHO_MAX, ECHO_FORCE, ECHO_REACH,
    ECHO_RECLAIM_R, FLUX_PER_ECHO, FLUX_RECLAIM
} from './constants.js';
import { bus, EV } from '../core/bus.js';
import { dist2 } from '../core/util.js';

const CELL = ECHO_REACH;            // one cell wide enough that 3x3 covers reach
const REACH2 = ECHO_REACH * ECHO_REACH;
const MIN_GAP2 = ECHO_MIN_GAP * ECHO_MIN_GAP;

/**
 * An echo must be at least this old before the probe can reclaim it. The
 * reclaim radius (4.5px) is deliberately wider than the gap between fresh
 * echoes (3.4px) so that deliberately re-flying an old path is forgiving — but
 * that also means a probe would instantly re-absorb the echo it just dropped.
 * At PROBE_MAX_SPEED the probe clears the reclaim radius in ~0.07s, so a window
 * comfortably longer than that lets the wake survive being laid down while
 * still feeling immediate when the player doubles back.
 */
const RECLAIM_MIN_AGE = 0.45;

/** Echoes are plain objects so save/load can serialise them directly. */
let echoes = [];
let shedTimer = 0;

/** Spatial hash rebuilt each frame: key "cx,cy" -> array of echoes. */
let grid = new Map();

const keyFor = (x, y) => ((x / CELL) | 0) + ',' + ((y / CELL) | 0);

export function resetWake() {
    echoes = [];
    shedTimer = 0;
    grid.clear();
}

export function getEchoes() {
    return echoes;
}

export function echoCount() {
    return echoes.length;
}

/** Restore from a save. Echoes arrive as {x, y, pol, age}. */
export function loadEchoes(list) {
    echoes = list.map((e) => ({ x: e.x, y: e.y, pol: e.pol, age: e.age }));
    shedTimer = 0;
    rebuildGrid();
}

function rebuildGrid() {
    grid.clear();
    for (const e of echoes) {
        const k = keyFor(e.x, e.y);
        let cell = grid.get(k);
        if (!cell) { cell = []; grid.set(k, cell); }
        cell.push(e);
    }
}

/**
 * Advance echo ages and drop the dead. Called once per frame before force queries
 * so the grid matches the live set.
 */
export function updateWake(dt, probe, input) {
    for (let i = echoes.length - 1; i >= 0; i--) {
        const e = echoes[i];
        e.age += dt;
        if (e.age >= ECHO_LIFE) {
            echoes.splice(i, 1);
        }
    }

    shedTimer -= dt;
    const moving = probe.vx * probe.vx + probe.vy * probe.vy > 4;

    // Silent running: reposition without laying down new field.
    if (!input.silent && moving && shedTimer <= 0 && probe.flux >= FLUX_PER_ECHO) {
        if (shedEcho(probe)) {
            probe.flux -= FLUX_PER_ECHO;
            shedTimer = ECHO_INTERVAL;
        }
    }

    reclaimAt(probe);
    rebuildGrid();
}

/**
 * Lay down one echo at the probe. Refuses if an echo of the same polarity is
 * already within ECHO_MIN_GAP, so hovering in place does not stack a hot spot.
 */
function shedEcho(probe) {
    // Scan only the probe's own neighbourhood via the grid built last frame.
    const cx = (probe.x / CELL) | 0;
    const cy = (probe.y / CELL) | 0;
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
            const cell = grid.get(gx + ',' + gy);
            if (!cell) continue;
            for (const e of cell) {
                if (dist2(e.x, e.y, probe.x, probe.y) >= MIN_GAP2) continue;
                // Sitting on an echo of our own polarity: nothing to add.
                if (e.pol === probe.pol) return false;
                // Sitting on an opposite echo: overwrite it rather than stack.
                e.pol = probe.pol;
                e.age = 0;
                return true;
            }
        }
    }

    if (echoes.length >= ECHO_MAX) echoes.shift();
    echoes.push({ x: probe.x, y: probe.y, pol: probe.pol, age: 0 });
    bus.emit(EV.ECHO_SHED, null);
    return true;
}

/**
 * Flying back through your own wake reclaims it: the echo is removed and part of
 * its flux comes back. This is how the player edits their own past.
 *
 * The reclaim radius is wider than the spacing between freshly shed echoes, so
 * this must ignore anything young enough to still be under the probe — without
 * that guard the probe eats its own wake as fast as it lays it and no lattice
 * can ever be built.
 */
function reclaimAt(probe) {
    const r2 = ECHO_RECLAIM_R * ECHO_RECLAIM_R;
    for (let i = echoes.length - 1; i >= 0; i--) {
        const e = echoes[i];
        if (e.age < RECLAIM_MIN_AGE) continue;
        if (dist2(e.x, e.y, probe.x, probe.y) < r2) {
            echoes.splice(i, 1);
            probe.flux = Math.min(probe.fluxMax, probe.flux + FLUX_RECLAIM);
            bus.emit(EV.ECHO_RECLAIMED, { x: e.x, y: e.y, pol: e.pol });
        }
    }
}

/**
 * Accumulate the wake's force on a point of the given polarity.
 *
 * Like polarity repels, opposite attracts. Falloff is inverse-square, softened
 * near zero so a mote sitting on an echo does not get flung to infinity, and cut
 * off hard at ECHO_REACH so the field stays local and readable.
 *
 * Returns the force added into out = {fx, fy}; also reports the nearest opposite
 * echo so leeches know what to hunt.
 */
export function wakeForceAt(x, y, pol, out) {
    let fx = 0, fy = 0;
    const cx = (x / CELL) | 0;
    const cy = (y / CELL) | 0;

    for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
            const cell = grid.get(gx + ',' + gy);
            if (!cell) continue;
            for (let i = 0; i < cell.length; i++) {
                const e = cell[i];
                const dx = x - e.x;
                const dy = y - e.y;
                const d2 = dx * dx + dy * dy;
                if (d2 > REACH2 || d2 === 0) continue;

                // Softened inverse-square, faded out over the echo's last moments.
                const soft = d2 + 6;
                const life = e.age > ECHO_LIFE - 2 ? (ECHO_LIFE - e.age) / 2 : 1;
                const mag = (ECHO_FORCE * life) / (soft * Math.sqrt(d2));

                // Same polarity pushes the mote away (dx points away from echo).
                const sign = e.pol === pol ? 1 : -1;
                fx += dx * mag * sign;
                fy += dy * mag * sign;
            }
        }
    }

    out.fx += fx;
    out.fy += fy;
    return out;
}

/** Nearest echo to a point within maxR, or null. Used by leech motes. */
export function nearestEcho(x, y, maxR) {
    const cx = (x / CELL) | 0;
    const cy = (y / CELL) | 0;
    const span = Math.max(1, Math.ceil(maxR / CELL));
    let best = null;
    let bestD2 = maxR * maxR;

    for (let gx = cx - span; gx <= cx + span; gx++) {
        for (let gy = cy - span; gy <= cy + span; gy++) {
            const cell = grid.get(gx + ',' + gy);
            if (!cell) continue;
            for (const e of cell) {
                const d2 = dist2(e.x, e.y, x, y);
                if (d2 < bestD2) { bestD2 = d2; best = e; }
            }
        }
    }
    return best;
}

/** Remove a specific echo (a leech ate it). */
export function consumeEcho(echo) {
    const i = echoes.indexOf(echo);
    if (i >= 0) {
        echoes.splice(i, 1);
        bus.emit(EV.ECHO_EATEN, { x: echo.x, y: echo.y });
    }
}

/** Serialise for save slots. Rounded to keep saves small. */
export function serialiseWake() {
    return echoes.map((e) => ({
        x: +e.x.toFixed(2),
        y: +e.y.toFixed(2),
        pol: e.pol,
        age: +e.age.toFixed(2)
    }));
}
