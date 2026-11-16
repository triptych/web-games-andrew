// The painted art (fal renders, cut out and sized by dev/art/export.py). Every picture loads in the background;
// until it arrives, or if it never does, the view draws the code-made sprite in its place, so the game is
// playable before a byte of art has landed and a missing file costs one sprite, not the screen.
//
// Pictures are drawn as billboards standing on a point. Each one gets a small chain of halved copies (mips) the
// first time it is drawn small, so a 512 px tree drawn 30 px tall is neither slow nor shimmery, and copies tinted
// for the night, for a hit flash or as a dark silhouette (something not yet met, in the scrapbook).

import { ART_FILES } from '../art-files.js';

const BASE = new URL('../../art/', import.meta.url).href;
const recs = new Map();
let failed = 0;
let off = false;
try { off = new URLSearchParams(location.search).get('art') === '0'; } catch { /* no location in tests */ }

/** True if export.py made this picture (and ?art=0 isn't asking for the code sprites). */
export const has = (name) => !off && Object.prototype.hasOwnProperty.call(ART_FILES, name);

function load(name) {
    let r = recs.get(name);
    if (r) return r;
    r = { img: new Image(), ok: false, vars: {} };
    r.img.decoding = 'async';
    r.img.onload = () => { r.ok = true; };
    r.img.onerror = () => { failed++; };
    r.img.src = BASE + name + '.webp';
    recs.set(name, r);
    return r;
}

/** The loaded picture, or null while it is on its way (or missing). */
export function pic(name) {
    if (!has(name)) return null;
    const r = load(name);
    return r.ok ? r.img : null;
}

/** Start every download now, so the first frames on the road have their pictures. */
export function preload() {
    if (off) return;
    for (const n of Object.keys(ART_FILES)) load(n);
}

/** A promise that settles once every picture has arrived or failed (after preload). */
let settle = null;
export function ready() {
    if (off) return Promise.resolve();
    if (!settle) {
        preload();
        settle = Promise.all([...recs.values()].map((r) => (r.ok ? null : new Promise((res) => {
            r.img.addEventListener('load', res, { once: true });
            r.img.addEventListener('error', res, { once: true });
        }))));
    }
    return settle;
}

/** For the tests: how many pictures were asked for, how many arrived, how many failed. */
export function status() {
    let ok = 0;
    for (const r of recs.values()) if (r.ok) ok++;
    return { total: Object.keys(ART_FILES).length, asked: recs.size, ok, failed };
}

// ------------------------------------------------------------------ tinted copies and mips
const TINT = {
    night: (c) => { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(16,22,52,0.52)'; },
    shadow: (c) => { c.globalCompositeOperation = 'source-atop'; c.fillStyle = '#2a2630'; },
    white: (c) => { c.globalCompositeOperation = 'source-atop'; c.fillStyle = '#ffffff'; },
};

function canvasOf(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w); c.height = Math.max(1, h);
    return c;
}

/** The mip chain for a mode: [full, half, quarter, ...] down to ~24 px tall. */
function chain(r, mode) {
    if (r.vars[mode]) return r.vars[mode];
    const img = r.img;
    let top = img;
    if (mode !== 'day') {
        top = canvasOf(img.naturalWidth, img.naturalHeight);
        const c = top.getContext('2d');
        c.drawImage(img, 0, 0);
        TINT[mode](c);
        c.fillRect(0, 0, top.width, top.height);
    }
    const out = [top];
    let w = img.naturalWidth, h = img.naturalHeight, src = top;
    while (h > 48) {
        w = Math.round(w / 2); h = Math.round(h / 2);
        const c = canvasOf(w, h), g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(src, 0, 0, w, h);
        out.push(c); src = c;
    }
    r.vars[mode] = out;
    return out;
}

/** The source to draw for a target height in device px: the smallest mip at least that tall. */
function source(r, mode, devH) {
    const ch = chain(r, mode);
    let s = ch[0];
    for (const c of ch) { if ((c.height || c.naturalHeight) >= devH) s = c; else break; }
    return s;
}

let dpr = 1;
/** Fallback scale when the context can't report its transform. */
export function setDpr(v) { dpr = v || 1; }

/**
 * Draw a picture standing on (x, y), h px tall (CSS px, in the current transform), centred on x.
 * opts: { mode: 'day'|'night'|'shadow', flip, flash (0..1: white overlay), ax (0..1, anchor across), ay (0..1, anchor up from the base),
 *         byWidth (h is the width instead) }.
 * Returns false (and draws nothing) when the picture isn't there, so the caller can draw its code sprite instead.
 */
export function draw(ctx, name, x, y, h, opts = {}) {
    if (!has(name)) return false;
    const r = load(name);
    if (!r.ok || h < 0.5) return !!r.ok;
    const img = r.img;
    let w = h * img.naturalWidth / img.naturalHeight;
    if (opts.byWidth) { w = h; h = w * img.naturalHeight / img.naturalWidth; }
    const ax = opts.ax ?? 0.5, ay = opts.ay ?? 0;
    const m = ctx.getTransform ? ctx.getTransform() : null;
    const devH = h * (m ? Math.hypot(m.b, m.d) : dpr);
    const src = source(r, opts.mode || 'day', devH);
    const flip = opts.flip;
    if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); x = 0; }
    const left = x - w * ax, top = y - h * (1 - ay);
    ctx.drawImage(src, left, top, w, h);
    if (opts.flash > 0) {
        const a = ctx.globalAlpha;
        ctx.globalAlpha = a * Math.min(1, opts.flash) * 0.8;
        ctx.drawImage(source(r, 'white', devH), left, top, w, h);
        ctx.globalAlpha = a;
    }
    if (flip) ctx.restore();
    return true;
}

/** Width over height of a picture, or null if it isn't loaded. */
export function aspect(name) {
    const img = pic(name);
    return img ? img.naturalWidth / img.naturalHeight : null;
}
