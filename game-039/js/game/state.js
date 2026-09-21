/**
 * Run state: the single source of truth for a playthrough, plus the glue that
 * wires game events to score, containment and audio.
 */

import { CONTAINMENT_MAX, WAVE_BREAK, DRAIN_GRACE } from './constants.js';
import { bus, EV } from '../core/bus.js';
import { makeRng, newSeedString } from '../core/rand.js';
import { makeProbe, serialiseProbe, deserialiseProbe } from './probe.js';
import { resetWake, serialiseWake, loadEchoes } from './wake.js';
import { resetMotes, serialiseMotes, loadMotes } from './motes.js';
import { makeScore, scoreAbsorb, waveBonus } from './scoring.js';
import { buildWave, difficultyFor } from './waves.js';

export const PHASE = {
    BREAK: 'break',       // between waves
    ACTIVE: 'active',     // wave spawning and in play
    DRAINING: 'draining', // all spawned, waiting for the board to clear
    OVER: 'over'
};

/** Creates a fresh run. `seed` may be supplied to replay a specific board. */
export function newRun(seed) {
    const s = seed || newSeedString();
    const rng = makeRng(s);
    return {
        seed: s,
        rng,
        // A second stream for wave composition so cosmetic generation does not
        // desync wave rolls between a fresh run and a loaded one.
        waveRng: makeRng(s + ':waves'),
        probe: makeProbe(),
        score: makeScore(),
        run: {
            wave: 1,
            containment: CONTAINMENT_MAX,
            containmentMax: CONTAINMENT_MAX,
            phase: PHASE.BREAK,
            phaseT: WAVE_BREAK,
            drainT: DRAIN_GRACE,
            elapsed: 0
        },
        waveObj: null,
        difficulty: difficultyFor(1),
        banner: null,
        bannerT: 0
    };
}

export function setBanner(rs, text, seconds = 1.6) {
    rs.banner = text;
    rs.bannerT = seconds;
}

/** Wire event handlers for a run. Returns a teardown function. */
export function bindRunEvents(rs, fx) {
    const offs = [];

    offs.push(bus.on(EV.MOTE_ABSORBED, (p) => {
        const gained = scoreAbsorb(rs.score, p.kind);
        fx.onAbsorb(p, rs.score.chain, gained);
    }));

    offs.push(bus.on(EV.MOTE_HIT_CORE, (p) => {
        rs.run.containment = Math.max(0, rs.run.containment - 1);
        fx.onCoreHit(p, rs.run.containment);
        if (rs.run.containment <= 0) {
            rs.run.phase = PHASE.OVER;
            bus.emit(EV.GAME_OVER, { score: rs.score.score, wave: rs.run.wave });
        }
    }));

    offs.push(bus.on(EV.MOTE_SPLIT, (p) => fx.onSplit(p)));
    offs.push(bus.on(EV.POLARITY_FLIP, (p) => fx.onFlip(p)));
    offs.push(bus.on(EV.ECHO_SHED, () => fx.onShed()));
    offs.push(bus.on(EV.ECHO_RECLAIMED, (p) => fx.onReclaim(p)));
    offs.push(bus.on(EV.ECHO_EATEN, (p) => fx.onEchoEaten(p)));
    offs.push(bus.on(EV.CHAIN_BREAK, () => fx.onChainBreak()));
    offs.push(bus.on(EV.FLUX_EMPTY, () => fx.onFluxEmpty()));
    offs.push(bus.on(EV.WAVE_START, (p) => fx.onWaveStart(p)));
    offs.push(bus.on(EV.SURGE, (p) => fx.onSurge(p)));

    return () => offs.forEach((off) => off());
}

/** Advance the wave state machine. Board updates happen in main.js. */
export function advancePhase(rs, dt, boardEmpty) {
    const r = rs.run;
    r.elapsed += dt;
    if (rs.bannerT > 0) {
        rs.bannerT -= dt;
        if (rs.bannerT <= 0) rs.banner = null;
    }

    // A wave ends when the board clears, but a skilled player can hold motes in
    // traps indefinitely — which would stall the run at wave 1 forever. The
    // drain phase is therefore time-limited: harvest your traps inside the
    // grace period or the next wave arrives on top of what you are still
    // holding. Hoarding is a gamble, not a way to stop the clock.
    if (r.phase === PHASE.DRAINING) {
        r.drainT = (r.drainT ?? DRAIN_GRACE) - dt;
        if (r.drainT <= 0) {
            r.drainT = DRAIN_GRACE;
            return { forceNextWave: true };
        }
    }

    if (r.phase === PHASE.BREAK) {
        r.phaseT -= dt;
        if (r.phaseT <= 0) {
            rs.waveObj = buildWave(r.wave, rs.waveRng);
            rs.difficulty = difficultyFor(r.wave);
            r.phase = PHASE.ACTIVE;
            bus.emit(EV.WAVE_START, { wave: r.wave, surge: rs.waveObj.surge });
            if (rs.waveObj.surge) bus.emit(EV.SURGE, { wave: r.wave });
        }
    }
}

/**
 * Finish the current wave. `clean` is false when the drain grace period expired
 * with motes still on the board — the wave still advances, but the clear bonus
 * is withheld, so stalling costs score rather than buying safety.
 */
export function completeWave(rs, clean = true) {
    const bonus = clean ? waveBonus(rs.score, rs.run.wave, rs.run.containment) : 0;
    bus.emit(EV.WAVE_CLEAR, { wave: rs.run.wave, bonus });
    rs.run.wave++;
    rs.run.phase = PHASE.BREAK;
    rs.run.phaseT = WAVE_BREAK;
    rs.run.drainT = DRAIN_GRACE;
    // A little containment repair every few waves, so a long run stays alive.
    // Only a clean clear earns it.
    if (clean && rs.run.wave % 4 === 0 && rs.run.containment < rs.run.containmentMax) {
        rs.run.containment++;
    }
    return bonus;
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

export function serialiseRun(rs) {
    return {
        seed: rs.seed,
        probe: serialiseProbe(rs.probe),
        echoes: serialiseWake(),
        motes: serialiseMotes(),
        score: {
            score: rs.score.score,
            chain: rs.score.chain,
            chainT: +rs.score.chainT.toFixed(2),
            best: rs.score.best,
            absorbed: rs.score.absorbed
        },
        run: {
            wave: rs.run.wave,
            containment: rs.run.containment,
            containmentMax: rs.run.containmentMax,
            phase: rs.run.phase === PHASE.OVER ? PHASE.BREAK : rs.run.phase,
            phaseT: +rs.run.phaseT.toFixed(2),
            drainT: +(rs.run.drainT ?? DRAIN_GRACE).toFixed(2),
            elapsed: +rs.run.elapsed.toFixed(2)
        },
        // The wave schedule is restored verbatim so a mid-wave save resumes
        // with exactly the spawns that were still pending.
        waveObj: rs.waveObj
            ? {
                wave: rs.waveObj.wave,
                surge: rs.waveObj.surge,
                spawns: rs.waveObj.spawns,
                duration: rs.waveObj.duration,
                cursor: rs.waveObj.cursor,
                clock: +rs.waveObj.clock.toFixed(2)
            }
            : null
    };
}

export function deserialiseRun(data) {
    const rs = newRun(data.seed);
    rs.probe = deserialiseProbe(data.probe);
    resetWake();
    resetMotes();
    loadEchoes(data.echoes || []);
    loadMotes(data.motes || []);

    Object.assign(rs.score, data.score || {});
    Object.assign(rs.run, data.run || {});
    rs.waveObj = data.waveObj || null;
    rs.difficulty = difficultyFor(rs.run.wave);

    // Re-roll the wave stream forward so future waves match a fresh run of this
    // seed rather than repeating wave 1.
    for (let w = 1; w < rs.run.wave; w++) buildWave(w, rs.waveRng);

    return rs;
}
