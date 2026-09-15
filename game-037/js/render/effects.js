// ============================================================
// render/effects.js - the animation queue (GDD §25.6)
// Animations never affect the model. A new input fast-forwards them.
// ============================================================
import { ANIM_BUDGET_MS } from '../data/constants.js';

export const effects = {
  queue: [],
  shake: { mag: 0, until: 0 },
  reducedMotion: false,
};

const MAX_QUEUE = 96;

export function push(e) {
  if (effects.reducedMotion && e.kind === 'shake') return;
  e.start = performance.now();
  if (effects.reducedMotion) e.ms = Math.round((e.ms || 100) * 0.5);
  effects.queue.push(e);

  // One turn's animations are capped at the budget: if the queue would run
  // past it, monsters move together rather than one after another.
  const first = effects.queue[0];
  if (first && (e.start - first.start) + (e.ms || 0) > ANIM_BUDGET_MS) {
    const half = ANIM_BUDGET_MS / 2;
    for (const q of effects.queue) if ((q.ms || 100) > half) q.ms = half;
  }

  // The queue is drained by the frame loop. If no frame runs - a background
  // tab, a scripted run - it must still not grow without bound.
  if (effects.queue.length > MAX_QUEUE) effects.queue.splice(0, effects.queue.length - MAX_QUEUE);
}

export function fastForward() {
  effects.queue.length = 0;
  effects.shake.until = 0;
}

/** Returns true while anything is still animating. */
export function tick(now) {
  for (let i = effects.queue.length - 1; i >= 0; i--) {
    const e = effects.queue[i];
    if (now - e.start >= (e.ms || 100)) effects.queue.splice(i, 1);
  }
  return effects.queue.length > 0 || now < effects.shake.until;
}

export function progressOf(e, now) {
  return Math.max(0, Math.min(1, (now - e.start) / (e.ms || 100)));
}

export function addShake(mag, ms) {
  if (effects.reducedMotion) return;
  effects.shake.mag = Math.max(effects.shake.mag, mag);
  effects.shake.until = performance.now() + ms;
}

export function shakeOffset(now) {
  if (now >= effects.shake.until) return [0, 0];
  const m = effects.shake.mag;
  return [(Math.random() - 0.5) * m * 2, (Math.random() - 0.5) * m * 2];
}

export const floaters = () => effects.queue.filter(e => e.kind === 'float');
export const moves = () => effects.queue.filter(e => e.kind === 'lerpMove');
export const flashes = () => effects.queue.filter(e => e.kind === 'hitFlash');
