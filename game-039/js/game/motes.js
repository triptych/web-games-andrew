/**
 * Motes: the charged fragments drifting in toward the core.
 *
 * Every mote is pushed by three things — a constant inward drift, the wake, and
 * the live probe (which pulls harder than any single echo). The five classes
 * exist to attack different weaknesses in a lattice:
 *
 *   drifter   the baseline; obeys the field completely
 *   splitter  repelled too hard and it breaks into two, so brute-force walls backfire
 *   inverter  flips its own polarity on a timer, so a single-polarity wall leaks
 *   leech     hunts and eats echoes, punishing a lattice you built and abandoned
 *   anchor    immune to the field entirely; must be collected by hand
 */

import {
    CORE_X, CORE_Y, CORE_R, RING_R, MOTE_R, MOTE_DRIFT, MOTE_MAX_SPEED, MOTE_DRAG,
    MOTE_ABSORB_R, PROBE_FORCE_MULT, MOTE_KIND, ECHO_FORCE, ECHO_REACH,
    FLUX_ABSORB_BONUS, POS, NEG
} from './constants.js';
import { bus, EV } from '../core/bus.js';
import { wakeForceAt, nearestEcho, consumeEcho } from './wake.js';
import { limit, dist2, TAU } from '../core/util.js';

let motes = [];
let idSeq = 1;

export function resetMotes() {
    motes = [];
    idSeq = 1;
}

export function getMotes() {
    return motes;
}

export function moteCount() {
    return motes.length;
}

export function spawnMote(opts) {
    const m = {
        id: idSeq++,
        kind: opts.kind || MOTE_KIND.DRIFTER,
        x: opts.x,
        y: opts.y,
        vx: opts.vx || 0,
        vy: opts.vy || 0,
        pol: opts.pol ?? POS,
        r: opts.r ?? MOTE_R,
        /** Splitters remember whether they already divided. */
        generation: opts.generation ?? 0,
        /** Inverters count down to their next self-flip. */
        flipT: opts.flipT ?? 2.2,
        /** Purely cosmetic animation phase, seeded from position. */
        phase: opts.phase ?? (opts.x * 0.7 + opts.y * 1.3) % TAU,
        /** Set while a leech is locked onto an echo. */
        targetX: 0,
        targetY: 0,
        hasTarget: false
    };
    motes.push(m);
    return m;
}

/** Spawn just outside the ring at a given angle, aimed inward. */
export function spawnAtAngle(angle, kind, pol, speed) {
    const r = RING_R - 2;
    const x = CORE_X + Math.cos(angle) * r;
    const y = CORE_Y + Math.sin(angle) * r;
    const s = speed ?? 6;
    return spawnMote({
        kind,
        pol,
        x,
        y,
        vx: -Math.cos(angle) * s,
        vy: -Math.sin(angle) * s
    });
}

const force = { fx: 0, fy: 0 };

export function updateMotes(motesDt, probe, difficulty) {
    const dt = motesDt;
    const drift = MOTE_DRIFT * (difficulty?.driftMult ?? 1);

    for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i];
        force.fx = 0;
        force.fy = 0;

        // --- inward drift toward the core ---
        const dxc = CORE_X - m.x;
        const dyc = CORE_Y - m.y;
        const dc = Math.hypot(dxc, dyc) || 0.0001;
        force.fx += (dxc / dc) * drift;
        force.fy += (dyc / dc) * drift;

        const immune = m.kind === MOTE_KIND.ANCHOR;

        if (!immune) {
            // --- the wake ---
            wakeForceAt(m.x, m.y, m.pol, force);

            // --- the live probe, a stronger version of one echo ---
            const dxp = m.x - probe.x;
            const dyp = m.y - probe.y;
            const dp2 = dxp * dxp + dyp * dyp;
            if (dp2 < ECHO_REACH * ECHO_REACH * 1.6 && dp2 > 0) {
                const soft = dp2 + 6;
                const mag = (ECHO_FORCE * PROBE_FORCE_MULT) / (soft * Math.sqrt(dp2));
                const sign = probe.pol === m.pol ? 1 : -1;
                force.fx += dxp * mag * sign;
                force.fy += dyp * mag * sign;
            }
        }

        // --- class behaviour ---
        if (m.kind === MOTE_KIND.INVERTER) {
            m.flipT -= dt;
            if (m.flipT <= 0) {
                m.pol = -m.pol;
                m.flipT = 1.8 + (m.id % 5) * 0.3;
            }
        } else if (m.kind === MOTE_KIND.LEECH) {
            const target = nearestEcho(m.x, m.y, 46);
            m.hasTarget = !!target;
            if (target) {
                m.targetX = target.x;
                m.targetY = target.y;
                const dx = target.x - m.x;
                const dy = target.y - m.y;
                const d = Math.hypot(dx, dy) || 0.0001;
                // Hunger overrides the polarity field: leeches home in regardless.
                force.fx += (dx / d) * 34;
                force.fy += (dy / d) * 34;
                if (d < m.r + 2) {
                    consumeEcho(target);
                    m.hasTarget = false;
                }
            }
        }

        // --- integrate ---
        m.vx += force.fx * dt;
        m.vy += force.fy * dt;

        const damp = Math.exp(-MOTE_DRAG * dt);
        m.vx *= damp;
        m.vy *= damp;

        const cap = MOTE_MAX_SPEED * (difficulty?.speedMult ?? 1);
        const speedBefore = Math.hypot(m.vx, m.vy);
        [m.vx, m.vy] = limit(m.vx, m.vy, cap);

        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.phase += dt * 6;

        // --- splitters divide when shoved hard ---
        if (m.kind === MOTE_KIND.SPLITTER && m.generation === 0 && speedBefore > cap * 0.86) {
            splitMote(m, i);
            continue;
        }

        // --- absorbed by the probe? opposite polarity only ---
        // Anchors are inert to the field but can still be collected by contact.
        const canAbsorb = immune || probe.pol !== m.pol;
        if (canAbsorb && dist2(m.x, m.y, probe.x, probe.y) < MOTE_ABSORB_R * MOTE_ABSORB_R) {
            motes.splice(i, 1);
            probe.flux = Math.min(probe.fluxMax, probe.flux + FLUX_ABSORB_BONUS);
            bus.emit(EV.MOTE_ABSORBED, { kind: m.kind, x: m.x, y: m.y, pol: m.pol });
            continue;
        }

        // --- reached the core? ---
        if (dist2(m.x, m.y, CORE_X, CORE_Y) < (CORE_R + m.r) * (CORE_R + m.r)) {
            motes.splice(i, 1);
            bus.emit(EV.MOTE_HIT_CORE, { kind: m.kind, x: m.x, y: m.y });
            continue;
        }

        // --- pushed back out through the ring? it escapes, no score, no damage ---
        if (dist2(m.x, m.y, CORE_X, CORE_Y) > (RING_R + 8) * (RING_R + 8)) {
            motes.splice(i, 1);
        }
    }
}

/** A splitter shoved past its tolerance breaks into two weaker, faster halves. */
function splitMote(m, index) {
    motes.splice(index, 1);
    const base = Math.atan2(m.vy, m.vx);
    for (const off of [-0.6, 0.6]) {
        const a = base + off;
        const s = Math.hypot(m.vx, m.vy) * 0.55;
        spawnMote({
            kind: MOTE_KIND.DRIFTER,
            pol: m.pol,
            x: m.x + Math.cos(a) * 3,
            y: m.y + Math.sin(a) * 3,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            r: MOTE_R * 0.8,
            generation: 1
        });
    }
    bus.emit(EV.MOTE_SPLIT, { x: m.x, y: m.y });
}

export function serialiseMotes() {
    return motes.map((m) => ({
        k: m.kind,
        x: +m.x.toFixed(2), y: +m.y.toFixed(2),
        vx: +m.vx.toFixed(2), vy: +m.vy.toFixed(2),
        p: m.pol, r: +m.r.toFixed(2), g: m.generation, f: +m.flipT.toFixed(2)
    }));
}

export function loadMotes(list) {
    resetMotes();
    for (const d of list) {
        spawnMote({
            kind: d.k, x: d.x, y: d.y, vx: d.vx, vy: d.vy,
            pol: d.p, r: d.r, generation: d.g, flipT: d.f
        });
    }
}

export { POS, NEG };
