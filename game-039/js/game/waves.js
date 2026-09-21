/**
 * Wave composition. Waves introduce mote classes on a fixed schedule so the
 * player meets one new idea at a time, then escalate density and speed.
 *
 * A wave is a list of scheduled spawns; the wave is clear when every scheduled
 * mote has spawned and the board is empty.
 */

import { MOTE_KIND, SURGE_EVERY, WAVE_BREAK, POS, NEG } from './constants.js';
import { spawnAtAngle } from './motes.js';
import { bus, EV } from '../core/bus.js';
import { TAU } from '../core/util.js';

/** Which classes are unlocked by a given wave number. */
function poolFor(wave) {
    const pool = [MOTE_KIND.DRIFTER];
    if (wave >= 3) pool.push(MOTE_KIND.SPLITTER);
    if (wave >= 5) pool.push(MOTE_KIND.INVERTER);
    if (wave >= 8) pool.push(MOTE_KIND.LEECH);
    if (wave >= 11) pool.push(MOTE_KIND.ANCHOR);
    return pool;
}

/**
 * Difficulty curve, read by the mote integrator.
 *
 * The early waves are deliberately slow. A wall of echoes only spans about
 * 26px of a ring roughly 540px around, so the player can never fence off the
 * whole board — they have to read where motes are coming from and build there.
 * That decision needs time to make, so waves 1-3 drift gently and only then
 * does the pressure ramp.
 */
export function difficultyFor(wave) {
    const ramp = Math.max(0, wave - 3);
    return {
        driftMult: 0.72 + Math.min(1.5, ramp * 0.085),
        speedMult: 0.85 + Math.min(0.9, ramp * 0.055)
    };
}

/**
 * Build the spawn schedule for a wave. Returns
 *   { wave, surge, spawns: [{t, angle, kind, pol, speed}], duration }
 */
export function buildWave(wave, rng) {
    const surge = wave % SURGE_EVERY === 0;
    const pool = poolFor(wave);
    const count = surge
        ? Math.round(10 + wave * 1.9)
        : Math.round(4 + wave * 1.35);

    const spawns = [];

    if (surge) {
        // A surge is a dense burst out of one arc — a wall of motes at once.
        const arcCentre = rng() * TAU;
        const arcWidth = 0.9 + rng() * 0.5;
        for (let i = 0; i < count; i++) {
            const t = 0.35 + (i / count) * 2.8 + rng() * 0.18;
            const angle = arcCentre + (rng() - 0.5) * arcWidth;
            spawns.push({
                t,
                angle,
                kind: rng() < 0.75 ? MOTE_KIND.DRIFTER : rng.pick(pool),
                pol: rng() < 0.5 ? POS : NEG,
                speed: 8 + rng() * 5
            });
        }
    } else {
        // Wide spacing early: motes arrive one at a time so a new player can
        // watch a single mote bend around a wall and understand the mechanic.
        const spacing = Math.max(0.42, 2.4 - wave * 0.085);
        for (let i = 0; i < count; i++) {
            // Golden-angle spread so successive motes arrive well separated.
            const angle = (i * 2.399963 + rng() * 0.5) % TAU;
            spawns.push({
                t: 0.5 + i * spacing + rng() * 0.3,
                angle,
                kind: pickKind(pool, wave, rng),
                pol: rng() < 0.5 ? POS : NEG,
                speed: 5 + rng() * 4
            });
        }
    }

    spawns.sort((a, b) => a.t - b.t);
    const duration = spawns.length ? spawns[spawns.length - 1].t : 0;
    return { wave, surge, spawns, duration, cursor: 0, clock: 0 };
}

/** Weighted pick: drifters stay common, exotic classes stay a minority. */
function pickKind(pool, wave, rng) {
    const roll = rng();
    if (roll < 0.55) return MOTE_KIND.DRIFTER;
    const exotic = pool.filter((k) => k !== MOTE_KIND.DRIFTER);
    if (!exotic.length) return MOTE_KIND.DRIFTER;
    return exotic[Math.floor(rng() * exotic.length)];
}

/**
 * Advance a wave schedule, spawning anything due. Returns true once every
 * scheduled mote has been released.
 */
export function tickWave(waveObj, dt) {
    waveObj.clock += dt;
    while (waveObj.cursor < waveObj.spawns.length &&
           waveObj.spawns[waveObj.cursor].t <= waveObj.clock) {
        const s = waveObj.spawns[waveObj.cursor];
        spawnAtAngle(s.angle, s.kind, s.pol, s.speed);
        waveObj.cursor++;
    }
    return waveObj.cursor >= waveObj.spawns.length;
}

export function announceWave(waveObj) {
    bus.emit(EV.WAVE_START, { wave: waveObj.wave, surge: waveObj.surge });
    if (waveObj.surge) bus.emit(EV.SURGE, { wave: waveObj.wave });
}

export { WAVE_BREAK };
