// lib/core/viewport.js — size things from the *visible* viewport and map pointers through the canvas.
//
// On phones 100vh is taller than what you can see, so a canvas sized with it sits lower than where
// taps are mapped and things get built below the finger (game-058, then game-067 a week later).
// 77 games read visualViewport by hand; this is that code once.
//
//   import { viewportSize, onViewportResize, fitCanvas, toCanvas } from '../lib/core/viewport.js';
//   onViewportResize(({ w, h, dpr }) => { renderer.setPixelRatio(dpr); renderer.setSize(w, h); });

/** The visible size in CSS px, and a device pixel ratio capped at `maxDpr`. */
export function viewportSize(maxDpr = 2) {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const w = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
    const h = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
    return { w, h, dpr: Math.min(window.devicePixelRatio || 1, maxDpr), portrait: h > w };
}

/**
 * Call `fn(size)` now and whenever the visible size changes (window resize, the phone's URL bar,
 * rotation, the on-screen keyboard). Coalesced to one call per frame. Returns an unsubscribe.
 */
export function onViewportResize(fn, { maxDpr = 2, immediate = true } = {}) {
    let pending = false, lw = -1, lh = -1, ld = -1;
    const run = () => {
        pending = false;
        const s = viewportSize(maxDpr);
        if (s.w === lw && s.h === lh && s.dpr === ld) return;
        lw = s.w; lh = s.h; ld = s.dpr;
        fn(s);
    };
    const queue = () => { if (!pending) { pending = true; requestAnimationFrame(run); } };
    window.addEventListener('resize', queue);
    window.addEventListener('orientationchange', queue);
    window.visualViewport?.addEventListener('resize', queue);
    if (immediate) run();
    return () => {
        window.removeEventListener('resize', queue);
        window.removeEventListener('orientationchange', queue);
        window.visualViewport?.removeEventListener('resize', queue);
    };
}

/** Size a 2D canvas's backing store and CSS box to w×h CSS px. Returns the 2D context, scaled to CSS px. */
export function fitCanvas(canvas, { w, h, dpr }, { context = '2d' } = {}) {
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (context !== '2d') return null;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
}

/** A pointer event's position in the canvas's CSS px (or its backing pixels with `backing`). */
export function toCanvas(e, canvas, { backing = false } = {}) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (!backing) return { x, y };
    return { x: (x * canvas.width) / r.width, y: (y * canvas.height) / r.height };
}

/** Is this a touch-first device? (Coarse pointer; a game should still switch on the first real touch.) */
export const coarsePointer = () => !!window.matchMedia?.('(pointer: coarse)').matches;
