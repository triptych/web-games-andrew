/**
 * canvas.js — the one full-screen stage canvas, DPR handling, and the battle
 * layout (where the arena, the reels and the mechs go for this screen shape).
 */

export const stage = {
    el: null, ctx: null, w: 0, h: 0, dpr: 1, quality: 2,
    layout: null,
};

export function initStage(el) {
    stage.el = el;
    stage.ctx = el.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    return stage;
}

export function setQuality(q) {
    stage.quality = q;
    resize();
}

export function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const maxDpr = stage.quality >= 2 ? 2 : stage.quality === 1 ? 1.5 : 1;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    stage.w = w; stage.h = h; stage.dpr = dpr;
    stage.el.width = Math.round(w * dpr);
    stage.el.height = Math.round(h * dpr);
    stage.el.style.width = `${w}px`;
    stage.el.style.height = `${h}px`;
    stage.layout = null;
}

/**
 * Battle layout. topH/bottomH are the DOM bars' heights (measured by the caller).
 * Returns { arena, reels, cell, side } in CSS pixels.
 */
export function battleLayout(cols, rows, topH, bottomH) {
    const { w, h } = stage;
    const side = w / h > 1.6 && h < 560;
    const avail = { x: 0, y: topH, w, h: h - topH - bottomH };
    let arena, reelBox;
    if (side) {
        arena = { x: 0, y: avail.y, w: w * 0.5, h: avail.h };
        reelBox = { x: w * 0.5, y: avail.y, w: w * 0.5, h: avail.h };
    } else {
        const ah = Math.round(avail.h * (h > w ? 0.4 : 0.45));
        arena = { x: 0, y: avail.y, w, h: ah };
        reelBox = { x: 0, y: avail.y + ah, w, h: avail.h - ah };
    }
    const pad = 14;
    const maxW = Math.min(reelBox.w - pad * 2, 760);
    const cell = Math.floor(Math.min(maxW / (cols + 0.5), (reelBox.h - pad * 2 - 18) / rows, 132));
    const rw = cell * cols, rh = cell * rows;
    const reels = {
        x: Math.round(reelBox.x + (reelBox.w - rw) / 2),
        y: Math.round(reelBox.y + (reelBox.h - rh) / 2 + 4),
        w: rw, h: rh,
    };
    return { arena, reelBox, reels, cell, side };
}
