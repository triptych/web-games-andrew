// anim.js — a tiny promise-based tween runner driven by the render loop.
// `speed` lets tests (and impatient captains) fast-forward every animation.

const tweens = new Set();
let speed = 1;
export const setAnimSpeed = (s) => { speed = s; };
export const animSpeed = () => speed;

export const ease = {
    linear: (t) => t,
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    backOut: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

/** Run fn(k) for k from 0 to 1 over `dur` seconds. Resolves when done. */
export function tween(dur, fn, easing = ease.inOut) {
    return new Promise((resolve) => {
        const tw = { t: 0, dur: Math.max(0.0001, dur), fn, easing, resolve };
        tweens.add(tw);
        fn(easing(0), 0);
    });
}

export const wait = (sec) => tween(sec, () => {}, ease.linear);

export function updateTweens(dt) {
    for (const tw of [...tweens]) {
        tw.t += dt * speed;
        const k = Math.min(1, tw.t / tw.dur);
        tw.fn(tw.easing(k), k);
        if (k >= 1) { tweens.delete(tw); tw.resolve(); }
    }
}

export const activeTweens = () => tweens.size;

/** Finish everything immediately (used when a new game interrupts an animation). */
export function flushTweens() {
    for (let i = 0; i < 20 && tweens.size; i++) updateTweens(1000);
}

export const lerp = (a, b, k) => a + (b - a) * k;
export function lerpAngle(a, b, k) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * k;
}
