/**
 * progress.js — the rules of Colorverse. Pure: no DOM, no storage, no clock, no randomness.
 *
 * A page's progress is `cells`: a Uint8Array where 0 is unpainted and k+1 means "painted with
 * palette colour k". A pixel painted with its own number is correct and locked; a pixel
 * painted with another colour is a mistake that can be painted over.
 *
 * Every change goes through a stroke (one drag, one pour, one burst) so it can be undone whole.
 */
import { GLIMMER, STARBURST, FLOURISH_AT, GILDED, SAVE_VERSION } from './config.js';
import { has, brushLevel, maxCharges, SKILL_BY_ID } from './skills.js';
import { CHAPTERS, EXTRAS, STORY_PAGES, extraOf } from './story.js';

/** The extra colours offered in the Freestyle Studio, after the mosaic's own palette. */
export const STUDIO_COLORS = [
    '#ffffff', '#d9d4e8', '#8f8aa8', '#3c3852', '#14121f', '#ff5a6e', '#ff9f43', '#ffd84f',
    '#c4ff6a', '#5fd38a', '#2fa2a0', '#7ff0e0', '#4fa3ff', '#2f4fd8', '#a77bf2', '#ff8fd0',
    '#ffd6a8', '#c77a3a', '#7a4a2a', '#ffb3c8', '#b8f0ff', '#e8e2a0',
];
export const studioPalette = (art) => [...art.palette.map((p) => p.hex), ...STUDIO_COLORS];

export function newGame() {
    return {
        v: SAVE_VERSION,
        glimmer: 0,
        earned: 0,
        skills: ['spark'],
        pages: {},
        free: {},
        seen: [],
        charges: 0,
        chargeProgress: 0,
        streak: 0,
        settings: { sound: true, grid: true },
        stats: { pixels: 0, mistakes: 0 },
    };
}

export function blankPage(art) {
    return { cells: new Uint8Array(art.total), mistakes: 0, done: false, correct: 0, earned: 0, order: [] };
}

export function pageOf(state, art) {
    if (!state.pages[art.id]) state.pages[art.id] = blankPage(art);
    return state.pages[art.id];
}

export const isCorrect = (art, ps, i) => ps.cells[i] === art.cells[i] + 1;
export const fraction = (art, ps) => (ps ? ps.correct / art.total : 0);

/* ───────────── unlocking ───────────── */

export function isPageUnlocked(state, artId) {
    const extra = extraOf(artId);
    if (extra) return has(state, extra.skill);
    const i = STORY_PAGES.indexOf(artId);
    if (i < 0) return false;
    return i === 0 || !!state.pages[STORY_PAGES[i - 1]]?.done;
}

export function chapterDone(state, ch) {
    return ch.pages.every((id) => state.pages[id]?.done);
}

/** The first unlocked page that isn't finished: where "Continue" should go. */
export function nextPage(state) {
    return STORY_PAGES.find((id) => isPageUnlocked(state, id) && !state.pages[id]?.done)
        ?? EXTRAS.filter((e) => has(state, e.skill)).flatMap((e) => e.pages).find((id) => !state.pages[id]?.done);
}

export const storyDone = (state) => STORY_PAGES.every((id) => state.pages[id]?.done);

/* ───────────── which pixels a tool touches ───────────── */

const BRUSH_OFFSETS = [
    [[0, 0]],
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
    (() => {
        const o = [];
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) o.push([dx, dy]);
        return o.sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2));
    })(),
];

/**
 * The pixels a brush dab at (x, y) paints. The centre is always included; with `smart`, the
 * rest of the brush only takes pixels whose number is `color`.
 */
export function brushCells(art, x, y, level, color, smart = true) {
    const out = [];
    for (const [dx, dy] of BRUSH_OFFSETS[level]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= art.w || ny >= art.h) continue;
        const i = ny * art.w + nx;
        if (dx === 0 && dy === 0) out.push(i);
        else if (!smart || art.cells[i] === color) out.push(i);
    }
    return out;
}

/** Every pixel connected to (x, y) through pixels that share its number (4-way). */
export function pourCells(art, x, y) {
    const start = y * art.w + x, want = art.cells[start];
    const seen = new Uint8Array(art.total), out = [], stack = [start];
    seen[start] = 1;
    while (stack.length) {
        const i = stack.pop();
        out.push(i);
        const cx = i % art.w, cy = (i - cx) / art.w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= art.w || ny >= art.h) continue;
            const j = ny * art.w + nx;
            if (!seen[j] && art.cells[j] === want) { seen[j] = 1; stack.push(j); }
        }
    }
    return out;
}

/** Freestyle pour: the region connected through pixels currently the same colour. */
export function freePourCells(w, h, cells, x, y) {
    const start = y * w + x, want = cells[start];
    const seen = new Uint8Array(w * h), out = [], stack = [start];
    seen[start] = 1;
    while (stack.length) {
        const i = stack.pop();
        out.push(i);
        const cx = i % w, cy = (i - cx) / w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (!seen[j] && cells[j] === want) { seen[j] = 1; stack.push(j); }
        }
    }
    return out;
}

export function burstCells(art, x, y, color, r = STARBURST.radius) {
    const out = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + r) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= art.w || ny >= art.h) continue;
        const i = ny * art.w + nx;
        if (art.cells[i] === color) out.push(i);
    }
    return out;
}

export function remainingOf(art, ps, color) {
    let n = 0;
    for (let i = 0; i < art.total; i++) if (art.cells[i] === color && ps.cells[i] !== color + 1) n++;
    return n;
}

export function remainingCells(art, ps, color) {
    const out = [];
    for (let i = 0; i < art.total; i++) if (art.cells[i] === color && ps.cells[i] !== color + 1) out.push(i);
    return out;
}

/** The unfinished pixel of `color` nearest to (x, y) in pixel units, or -1. */
export function nearestRemaining(art, ps, color, x, y) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < art.total; i++) {
        if (art.cells[i] !== color || ps.cells[i] === color + 1) continue;
        const cx = (i % art.w) + 0.5, cy = Math.floor(i / art.w) + 0.5;
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bd) { bd = d; best = i; }
    }
    return best;
}

/** The first colour (by number) that still has pixels to paint, or -1. */
export function firstUnfinishedColor(art, ps, after = -1) {
    const n = art.palette.length;
    for (let k = 1; k <= n; k++) {
        const c = (after + k) % n;
        if (remainingOf(art, ps, c) > 0) return c;
    }
    return -1;
}

export const brushLevelFor = brushLevel;

/* ───────────── painting ───────────── */

export function glimmerPerPixel(state) {
    let g = GLIMMER.perPixel;
    if (has(state, 'catcher')) g *= 1 + GLIMMER.catcherBonus;
    if (has(state, 'streak')) g *= 1 + (GLIMMER.streakMax * Math.min(state.streak, GLIMMER.streakCap)) / GLIMMER.streakCap;
    return g;
}

export function beginStroke(state, art, ps) {
    return {
        art: art.id, changes: [], glimmer: 0, mistakes: 0, correct: 0, orderLen: ps.order.length,
        before: { charges: state.charges, chargeProgress: state.chargeProgress, streak: state.streak },
    };
}

/**
 * Paint `indices` with `color`, recording into `stroke`.
 * Returns { correct: [i...], wrong: [i...], glimmer }.
 */
export function paintCells(state, art, ps, indices, color, stroke) {
    const out = { correct: [], wrong: [], glimmer: 0 };
    if (ps.done) return out;
    const guard = has(state, 'truehand');
    for (const i of indices) {
        const target = art.cells[i], cur = ps.cells[i];
        if (cur === target + 1) continue;
        if (color === target) {
            const g = glimmerPerPixel(state);
            ps.cells[i] = color + 1;
            ps.order.push(i);
            ps.correct++;
            ps.earned += g;
            state.glimmer += g;
            state.earned += g;
            state.streak++;
            if (has(state, 'burst') && state.charges < maxCharges(state)) {
                if (++state.chargeProgress >= STARBURST.pixelsPerCharge) { state.charges++; state.chargeProgress = 0; }
            }
            stroke.changes.push([i, cur]);
            stroke.glimmer += g;
            stroke.correct++;
            out.correct.push(i);
            out.glimmer += g;
        } else {
            if (guard || cur === color + 1) continue;
            ps.cells[i] = color + 1;
            ps.mistakes++;
            state.streak = 0;
            stroke.changes.push([i, cur]);
            stroke.mistakes++;
            out.wrong.push(i);
        }
    }
    return out;
}

/** Undo a whole stroke. Returns the pixel indices that changed. */
export function undoStroke(state, art, ps, stroke) {
    if (ps.done) return [];
    const changed = [];
    for (let k = stroke.changes.length - 1; k >= 0; k--) {
        const [i, before] = stroke.changes[k];
        if (ps.cells[i] === art.cells[i] + 1) ps.correct--;
        ps.cells[i] = before;
        changed.push(i);
    }
    ps.order.length = stroke.orderLen;
    ps.mistakes = Math.max(0, ps.mistakes - stroke.mistakes);
    ps.earned = Math.max(0, ps.earned - stroke.glimmer);
    state.glimmer = Math.max(0, state.glimmer - stroke.glimmer);
    state.earned = Math.max(0, state.earned - stroke.glimmer);
    Object.assign(state, stroke.before);
    return changed;
}

export const canFlourish = (state, art, ps) => has(state, 'flourish') && !ps.done && ps.correct / art.total >= FLOURISH_AT;

export function useCharge(state) {
    if (state.charges <= 0) return false;
    state.charges--;
    return true;
}

/**
 * If the page is now complete, mark it done and pay the completion rewards.
 * Returns null, or { pixels, earned, complete, flawless, chapter, chapterTitle, total }.
 */
export function finishIfComplete(state, art, ps) {
    if (ps.done || ps.correct < art.total) return null;
    ps.done = true;
    const gild = has(state, 'gilded') ? GILDED : 1;
    const complete = Math.round(art.total * GLIMMER.completeBonus * gild);
    const flawless = ps.mistakes === 0 ? Math.round(art.total * GLIMMER.flawlessBonus * gild) : 0;
    const ch = CHAPTERS.find((c) => c.pages.includes(art.id));
    const chapter = ch && chapterDone(state, ch) ? GLIMMER.chapterBonus * ch.n : 0;
    const bonus = complete + flawless + chapter;
    state.glimmer += bonus;
    state.earned += bonus;
    state.stats.pixels += art.total;
    state.stats.mistakes += ps.mistakes;
    return { pixels: art.total, earned: Math.round(ps.earned), complete, flawless, chapter, chapterTitle: chapter ? ch.title : '', total: Math.round(ps.earned) + bonus };
}

/* ───────────── saving ───────────── */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function encodeCells(cells) {
    let s = '';
    for (let i = 0; i < cells.length; i++) s += cells[i].toString(36);
    return s;
}

export function decodeCells(str, length, max) {
    if (typeof str !== 'string' || str.length !== length) return null;
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        const v = parseInt(str[i], 36);
        if (!(v >= 0 && v <= max)) return null;
        out[i] = v;
    }
    return out;
}

export function encodeOrder(order) {
    let s = '';
    for (const i of order) s += B64[(i >> 6) & 63] + B64[i & 63];
    return s;
}

export function decodeOrder(str, total) {
    if (typeof str !== 'string' || str.length % 2) return [];
    const out = [];
    for (let k = 0; k < str.length; k += 2) {
        const a = B64.indexOf(str[k]), b = B64.indexOf(str[k + 1]);
        if (a < 0 || b < 0) return [];
        const i = a * 64 + b;
        if (i < total) out.push(i);
    }
    return out;
}

export function serialize(state) {
    const pages = {};
    for (const [id, ps] of Object.entries(state.pages)) {
        pages[id] = { c: encodeCells(ps.cells), m: ps.mistakes, d: ps.done ? 1 : 0, e: Math.round(ps.earned * 100) / 100, o: encodeOrder(ps.order) };
    }
    const free = {};
    for (const [id, cells] of Object.entries(state.free)) free[id] = encodeCells(cells);
    return JSON.stringify({
        v: SAVE_VERSION, glimmer: Math.round(state.glimmer * 100) / 100, earned: Math.round(state.earned * 100) / 100,
        skills: state.skills, pages, free, seen: state.seen, charges: state.charges, chargeProgress: state.chargeProgress,
        settings: state.settings, stats: state.stats,
    });
}

const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** Rebuild a state from saved JSON text. Anything unknown, broken or from another version is dropped. */
export function deserialize(text, artById) {
    let raw;
    try { raw = JSON.parse(text); } catch { return null; }
    if (!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION) return null;
    const state = newGame();
    state.glimmer = num(raw.glimmer, 0, 1e9, 0);
    state.earned = num(raw.earned, 0, 1e9, 0);
    if (Array.isArray(raw.skills)) {
        // keep skills in an order where every prerequisite comes first
        const want = new Set(raw.skills.filter((s) => typeof s === 'string' && SKILL_BY_ID[s]));
        let grew = true;
        while (grew) {
            grew = false;
            for (const id of want) {
                if (!state.skills.includes(id) && SKILL_BY_ID[id].req.every((r) => state.skills.includes(r))) { state.skills.push(id); grew = true; }
            }
        }
    }
    if (raw.pages && typeof raw.pages === 'object') {
        for (const [id, p] of Object.entries(raw.pages)) {
            const art = artById[id];
            if (!art || !p) continue;
            const cells = decodeCells(p.c, art.total, art.palette.length);
            if (!cells) continue;
            const ps = blankPage(art);
            ps.cells = cells;
            for (let i = 0; i < art.total; i++) if (cells[i] === art.cells[i] + 1) ps.correct++;
            ps.mistakes = Math.round(num(p.m, 0, 1e6, 0));
            ps.done = ps.correct === art.total && p.d === 1;
            ps.earned = num(p.e, 0, 1e7, 0);
            ps.order = decodeOrder(p.o, art.total).filter((i) => cells[i] === art.cells[i] + 1);
            state.pages[id] = ps;
        }
    }
    if (raw.free && typeof raw.free === 'object') {
        for (const [id, s] of Object.entries(raw.free)) {
            const art = artById[id];
            if (!art) continue;
            const cells = decodeCells(s, art.total, studioPalette(art).length);
            if (cells && !cells.includes(0)) state.free[id] = cells;
        }
    }
    if (Array.isArray(raw.seen)) state.seen = raw.seen.filter((s) => typeof s === 'string').slice(0, 200);
    state.charges = Math.round(num(raw.charges, 0, maxCharges(state), 0));
    state.chargeProgress = Math.round(num(raw.chargeProgress, 0, STARBURST.pixelsPerCharge - 1, 0));
    if (raw.settings && typeof raw.settings === 'object') {
        state.settings.sound = raw.settings.sound !== false;
        state.settings.grid = raw.settings.grid !== false;
    }
    if (raw.stats && typeof raw.stats === 'object') {
        state.stats.pixels = Math.round(num(raw.stats.pixels, 0, 1e9, 0));
        state.stats.mistakes = Math.round(num(raw.stats.mistakes, 0, 1e9, 0));
    }
    return state;
}
