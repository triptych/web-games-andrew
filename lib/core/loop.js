// lib/core/loop.js — the fixed-step accumulator and the ?debug=1&fast=N switches that every
// sim/view game writes into main.js. Pure apart from reading location.search in debugFlags().
//
//   import { makeStepper, debugFlags } from '../lib/core/loop.js';
//   const { DEBUG, FAST } = debugFlags();
//   const stepper = makeStepper({ step: 1 / 120, maxFrame: 0.05, fast: FAST });
//   function frame(dt) {
//       if (running) stepper.advance(dt, (STEP) => { step(G, input.state(), STEP); input.consumeEdges(); });
//       else stepper.reset();
//   }

/** Read ?debug=1 and &fast=N (1..40, only honoured with debug). */
export function debugFlags(search = typeof location !== 'undefined' ? location.search : '') {
    const p = new URLSearchParams(search);
    const DEBUG = p.get('debug') === '1';
    const FAST = DEBUG ? Math.max(1, Math.min(40, +(p.get('fast') || 1) || 1)) : 1;
    return { DEBUG, FAST, params: p };
}

/**
 * A fixed-step runner. advance(dt, fn) clamps dt to maxFrame, adds fast×dt to the accumulator and
 * calls fn(step) for each whole step, at most maxSteps×fast times (so a slow machine slows the game
 * down instead of spiralling). Returns the number of steps run; `alpha` is the leftover fraction
 * for interpolation.
 */
export function makeStepper({ step = 1 / 120, maxFrame = 0.05, fast = 1, maxSteps = 12 } = {}) {
    let acc = 0;
    const s = {
        step,
        get alpha() { return acc / step; },
        advance(dt, fn) {
            acc += Math.min(maxFrame, Math.max(0, dt)) * fast;
            let n = 0;
            while (acc >= step && n < maxSteps * fast) { fn(step); acc -= step; n++; }
            if (n >= maxSteps * fast) acc = Math.min(acc, step);
            return n;
        },
        reset() { acc = 0; },
    };
    return s;
}

/**
 * requestAnimationFrame with dt in seconds (capped at maxFrame) and total time. Returns stop().
 * The first frame gets dt = 0 rather than the time since page load.
 */
export function runFrames(fn, { maxFrame = 0.05 } = {}) {
    let last = null, time = 0, id = 0, live = true;
    const tick = (now) => {
        if (!live) return;
        id = requestAnimationFrame(tick);
        const dt = last === null ? 0 : Math.min(maxFrame, (now - last) / 1000);
        last = now;
        time += dt;
        fn(dt, time);
    };
    id = requestAnimationFrame(tick);
    return () => { live = false; cancelAnimationFrame(id); };
}

/** Drain G.events once per frame to each listener, counting types for the tests. */
export function makeEventPump(...listeners) {
    const seen = {};
    return {
        seen,
        drain(G) {
            if (!G.events?.length) return [];
            const ev = G.events.splice(0);
            for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
            for (const l of listeners) l(G, ev);
            return ev;
        },
    };
}
