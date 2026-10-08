// The planet's mountain range: a fixed jagged profile around the whole world,
// sampled every STEP units. Deterministic, so the scanner, the view and the sim
// (meteor impacts) all agree. Heights are above the ground line.

import { WORLD_W } from '../config.js';
import { makeRng } from '../rng.js';

export const STEP = 32;
const N = WORLD_W / STEP;

function build(seed, lo, hi, rough) {
    const rng = makeRng(seed);
    const h = new Float32Array(N);
    // a few broad ridges plus jitter, smoothed around the wrap
    let peak = rng.range(lo, hi);
    for (let i = 0; i < N; i++) {
        if (i % 6 === 0) peak = rng.range(lo, hi);
        h[i] = peak * (0.55 + 0.45 * Math.abs(Math.sin(i * 0.9 + rng() * 0.6))) + rng.range(-rough, rough);
    }
    // jagged peaks: alternate up and down so it reads as a mountain line
    for (let i = 0; i < N; i += 2) h[i] *= 0.55;
    for (let i = 0; i < N; i++) h[i] = Math.max(2, h[i]);
    return h;
}

export const NEAR = build(1982, 18, 62, 5);
export const FAR = build(2084, 26, 78, 7);

/** Height of a profile at world x (linear between samples, wraps). */
export function heightAt(prof, x) {
    const u = ((x % WORLD_W) + WORLD_W) % WORLD_W / STEP;
    const i = Math.floor(u), f = u - i;
    return prof[i % N] * (1 - f) + prof[(i + 1) % N] * f;
}

export const SAMPLES = N;
