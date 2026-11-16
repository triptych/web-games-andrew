// Dungeon params and the share link. Pure: no `location`, no DOM. main.js reads and writes the URL hash.
//
// A link holds everything that makes a dungeon, so whoever opens it gets the same one:
//   #s=mossy-badger-27&z=m&n=3&m=5543&e=556544&t=wsrcg&p=0.4.5.c_1.3.3.t&k=0.12.7.slime&x=0.20.9
//   s seed phrase · z size (s m l) · n levels · m mix (tunnels chambers water pits, a digit each)
//   e elements (monsters hoards lights cozy flora windows) · t a theme letter per level
//   p painted pins level.x.y.brush · k stamped elements level.mx.my.kind · x erased level.mx.my

import { SIZES, MAX_LEVELS, DEFAULT_MIX, DEFAULT_EL } from '../config.js';
import { THEMES, THEME_IDS, THEME_BY_CODE, DEFAULT_THEMES } from './data/themes.js';
import { ELEMENTS, CATEGORY_IDS } from './data/elements.js';
import { BRUSHES } from './tiles.js';

const MIX_KEYS = ['tunnels', 'chambers', 'water', 'pits'];
const EL_KEYS = CATEGORY_IDS;            // monsters hoards lights cozy flora windows
const BRUSH_CODE = { chamber: 'c', tunnel: 't', water: 'w', well: 'o', rock: 'r' };
const CODE_BRUSH = Object.fromEntries(Object.entries(BRUSH_CODE).map(([k, v]) => [v, k]));
const MAX_EDITS = 400;

const ADJ = ['mossy', 'amber', 'sleepy', 'cozy', 'honey', 'velvet', 'misty', 'lantern', 'fern', 'cinder', 'maple', 'pebble', 'clover', 'dusky', 'toasty', 'willow', 'snug', 'copper', 'starry', 'drowsy'];
const NOUN = ['badger', 'otter', 'hearth', 'kettle', 'teacup', 'mole', 'acorn', 'candle', 'hedgehog', 'toadstool', 'quilt', 'burrow', 'wren', 'pudding', 'lantern', 'scone', 'mitten', 'pinecone', 'dormouse', 'biscuit'];

/** A friendly seed phrase like "mossy-badger-27". */
export function seedPhrase(rng) {
    return `${rng.pick(ADJ)}-${rng.pick(NOUN)}-${rng.int(1, 99)}`;
}

const clampInt = (v, lo, hi, def) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
};
const cleanSeed = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'cozy-hearth-1';

/** Fill in and clamp params, so every part of the game can trust them. */
export function normalize(p = {}) {
    const levels = clampInt(p.levels, 1, MAX_LEVELS, 3);
    const size = SIZES[p.size] ? p.size : 'm';
    const { w, h } = SIZES[size];
    const mix = {}, el = {};
    for (const k of MIX_KEYS) mix[k] = clampInt(p.mix?.[k], 0, 9, DEFAULT_MIX[k]);
    for (const k of EL_KEYS) el[k] = clampInt(p.el?.[k], 0, 9, DEFAULT_EL[k]);
    const themes = [];
    for (let i = 0; i < levels; i++) {
        const t = p.themes?.[i];
        themes.push(THEMES[t] ? t : DEFAULT_THEMES[i % DEFAULT_THEMES.length]);
    }
    const inLevels = (e) => Number.isInteger(e.l) && e.l >= 0 && e.l < levels;
    const pins = [];
    for (const e of Array.isArray(p.pins) ? p.pins : []) {
        if (!inLevels(e) || !BRUSHES[e.b] || !(e.x >= 0 && e.x < w && e.y >= 0 && e.y < h)) continue;
        const i = pins.findIndex((q) => q.l === e.l && q.x === e.x && q.y === e.y);
        if (i >= 0) pins.splice(i, 1);        // the latest paint on a cell wins
        pins.push({ l: e.l, x: e.x | 0, y: e.y | 0, b: e.b });
    }
    const inMicro = (e) => inLevels(e) && Number.isInteger(e.x) && Number.isInteger(e.y) && e.x >= 0 && e.y >= 0 && e.x < w * 3 && e.y < h * 3;
    const stamps = [];
    for (const e of Array.isArray(p.stamps) ? p.stamps : []) {
        if (!inMicro(e) || !ELEMENTS[e.k]) continue;
        const i = stamps.findIndex((q) => q.l === e.l && q.x === e.x && q.y === e.y);
        if (i >= 0) stamps.splice(i, 1);
        stamps.push({ l: e.l, x: e.x, y: e.y, k: e.k });
    }
    const erased = [];
    for (const e of Array.isArray(p.erased) ? p.erased : []) {
        if (inMicro(e) && !erased.some((q) => q.l === e.l && q.x === e.x && q.y === e.y)) erased.push({ l: e.l, x: e.x, y: e.y });
    }
    return {
        seed: cleanSeed(p.seed), size, levels, mix, el, themes,
        pins: pins.slice(-MAX_EDITS), stamps: stamps.slice(-MAX_EDITS), erased: erased.slice(-MAX_EDITS),
    };
}

/** params → the text after '#' in a share link. */
export function encode(p) {
    p = normalize(p);
    const parts = [
        `s=${p.seed}`, `z=${p.size}`, `n=${p.levels}`,
        `m=${MIX_KEYS.map((k) => p.mix[k]).join('')}`,
        `e=${EL_KEYS.map((k) => p.el[k]).join('')}`,
        `t=${p.themes.map((t) => THEMES[t].code).join('')}`,
    ];
    if (p.pins.length) parts.push(`p=${p.pins.map((e) => `${e.l}.${e.x}.${e.y}.${BRUSH_CODE[e.b]}`).join('_')}`);
    if (p.stamps.length) parts.push(`k=${p.stamps.map((e) => `${e.l}.${e.x}.${e.y}.${e.k}`).join('_')}`);
    if (p.erased.length) parts.push(`x=${p.erased.map((e) => `${e.l}.${e.x}.${e.y}`).join('_')}`);
    return parts.join('&');
}

/** The text after '#' → params, or null when it holds no seed. Garbage is dropped, never trusted. */
export function decode(hash) {
    const s = String(hash || '').replace(/^#/, '');
    if (!s) return null;
    const q = {};
    for (const kv of s.split('&')) {
        const i = kv.indexOf('=');
        if (i > 0) { try { q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch { /* a bad escape */ } }
    }
    if (!q.s) return null;
    const digits = (str, keys) => Object.fromEntries(keys.map((k, i) => [k, str?.[i] !== undefined ? +str[i] : undefined]));
    const list = (str, n) => (str ? str.split('_').map((x) => x.split('.')).filter((a) => a.length === n) : []);
    return normalize({
        seed: q.s, size: q.z, levels: +q.n,
        mix: digits(q.m, MIX_KEYS), el: digits(q.e, EL_KEYS),
        themes: [...(q.t || '')].map((c) => THEME_BY_CODE[c]),
        pins: list(q.p, 4).map(([l, x, y, b]) => ({ l: +l, x: +x, y: +y, b: CODE_BRUSH[b] })),
        stamps: list(q.k, 4).map(([l, x, y, k]) => ({ l: +l, x: +x, y: +y, k })),
        erased: list(q.x, 3).map(([l, x, y]) => ({ l: +l, x: +x, y: +y })),
    });
}

export { MIX_KEYS, EL_KEYS, THEME_IDS };
