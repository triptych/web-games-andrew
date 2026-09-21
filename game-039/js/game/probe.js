/**
 * The player probe. It has no weapon. Its only capability is inverting its own
 * polarity, which is also what decides the polarity of every echo it sheds.
 */

import {
    PROBE_ACCEL, PROBE_DRAG, PROBE_MAX_SPEED, PROBE_R,
    FLUX_MAX, FLUX_REGEN, FLUX_PER_FLIP,
    CORE_X, CORE_Y, CORE_R, RING_R, POS
} from './constants.js';
import { bus, EV } from '../core/bus.js';
import { limit } from '../core/util.js';

export function makeProbe() {
    return {
        x: CORE_X,
        y: CORE_Y + (CORE_R + RING_R) / 2,
        vx: 0,
        vy: 0,
        pol: POS,
        flux: FLUX_MAX,
        fluxMax: FLUX_MAX,
        r: PROBE_R,
        flipCooldown: 0,
        /** Drives the sprite flash right after a flip. */
        flashT: 0,
        /** Set while the player is holding silent running, for rendering. */
        silent: false
    };
}

export function updateProbe(probe, input, dt) {
    probe.silent = input.silent;

    if (probe.flipCooldown > 0) probe.flipCooldown -= dt;
    if (probe.flashT > 0) probe.flashT -= dt;

    // --- polarity inversion: the one verb ---
    if (input.flip && probe.flipCooldown <= 0) {
        if (probe.flux >= FLUX_PER_FLIP) {
            probe.pol = -probe.pol;
            probe.flux -= FLUX_PER_FLIP;
            probe.flipCooldown = 0.08;
            probe.flashT = 0.16;
            bus.emit(EV.POLARITY_FLIP, { pol: probe.pol });
        } else {
            bus.emit(EV.FLUX_EMPTY, null);
        }
    }

    // --- thrust ---
    probe.vx += input.axis.x * PROBE_ACCEL * dt;
    probe.vy += input.axis.y * PROBE_ACCEL * dt;

    // Drag, frame-rate independent.
    const damp = Math.exp(-PROBE_DRAG * dt);
    probe.vx *= damp;
    probe.vy *= damp;

    [probe.vx, probe.vy] = limit(probe.vx, probe.vy, PROBE_MAX_SPEED);

    probe.x += probe.vx * dt;
    probe.y += probe.vy * dt;

    constrainToRing(probe);

    // --- flux regen ---
    // Silent running regenerates faster: the cost of not building is the payoff.
    const regen = FLUX_REGEN * (input.silent ? 1.7 : 1);
    probe.flux = Math.min(probe.fluxMax, probe.flux + regen * dt);
}

/**
 * The probe lives in the annulus between the core and the ring wall. Both
 * boundaries bounce rather than clamp, so the player keeps a sense of momentum.
 */
function constrainToRing(probe) {
    const dx = probe.x - CORE_X;
    const dy = probe.y - CORE_Y;
    const d = Math.hypot(dx, dy) || 0.0001;
    const nx = dx / d;
    const ny = dy / d;

    const inner = CORE_R + probe.r;
    const outer = RING_R - probe.r;

    if (d < inner) {
        probe.x = CORE_X + nx * inner;
        probe.y = CORE_Y + ny * inner;
        const vn = probe.vx * nx + probe.vy * ny;
        probe.vx -= 1.6 * vn * nx;
        probe.vy -= 1.6 * vn * ny;
    } else if (d > outer) {
        probe.x = CORE_X + nx * outer;
        probe.y = CORE_Y + ny * outer;
        const vn = probe.vx * nx + probe.vy * ny;
        probe.vx -= 1.6 * vn * nx;
        probe.vy -= 1.6 * vn * ny;
    }
}

export function serialiseProbe(p) {
    return {
        x: +p.x.toFixed(2), y: +p.y.toFixed(2),
        vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2),
        pol: p.pol, flux: +p.flux.toFixed(2), fluxMax: p.fluxMax
    };
}

export function deserialiseProbe(data) {
    const p = makeProbe();
    p.x = data.x; p.y = data.y;
    p.vx = data.vx; p.vy = data.vy;
    p.pol = data.pol;
    p.flux = data.flux;
    p.fluxMax = data.fluxMax ?? FLUX_MAX;
    return p;
}
