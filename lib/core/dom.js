// lib/core/dom.js — small DOM and formatting helpers that 45–90 games each redefine.
//
//   import { $, esc, toast, fmtTime } from '../lib/core/dom.js';

/** getElementById (the form ~100 games use: `$('hud')`). */
export const $ = (id) => document.getElementById(id);
/** querySelectorAll as an array. */
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escape text for innerHTML (45 games carry this one-liner). */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Make an element: el('button', { class: 'btn', dataset: { act: 'new' }, onclick }, 'New game'). */
export function el(tag, props = {}, ...children) {
    const e = document.createElement(tag);
    for (const k in props) {
        const v = props[k];
        if (k === 'class') e.className = v;
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (k in e) e[k] = v;
        else e.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
    return e;
}

/**
 * A toast in `container` (an element or its id), at most `max` on screen, gone after `ms`.
 * Uses textContent, so player-made names can't inject markup. Also sent to lib/a11y.js's live region.
 */
export function toast(container, text, { cls = '', max = 3, ms = 3300 } = {}) {
    const box = typeof container === 'string' ? document.getElementById(container) : container;
    if (!box) return null;
    const t = document.createElement('div');
    t.className = ('toast ' + cls).trim();
    t.textContent = text;
    box.appendChild(t);
    while (box.children.length > max) box.firstChild.remove();
    setTimeout(() => t.remove(), ms);
    window.A11Y?.announce?.(text);
    return t;
}

/** 75 → "1m 15s", 3700 → "1h 1m", 9 → "9s". */
export function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
}

/** 75 → "1:15", 3700 → "1:01:40" (a race clock). */
export function fmtClock(sec, { tenths = false } = {}) {
    const neg = sec < 0; sec = Math.abs(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    const pad = (n) => String(n).padStart(2, '0');
    let out = h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    if (tenths) out += '.' + Math.floor((sec % 1) * 10);
    return (neg ? '-' : '') + out;
}

/** 1234567 → "1,234,567"; with `short`, 1234567 → "1.2M" (idle games). */
export function fmtNum(n, { short = false } = {}) {
    if (!short || Math.abs(n) < 10000) return Math.round(n).toLocaleString('en-US');
    const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
    let i = -1;
    while (Math.abs(n) >= 1000 && i < units.length - 1) { n /= 1000; i++; }
    return (Math.abs(n) < 100 ? n.toFixed(1).replace(/\.0$/, '') : Math.round(n)) + units[i];
}

/** "#ff8800" → [255, 136, 0]. Accepts "#f80" too. */
export function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** Mix two hex colours, t = 0 → a, 1 → b. */
export function mixHex(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
/** Lighten (k > 0) toward white or darken (k < 0) toward black. */
export const shade = (hex, k) => mixHex(hex, k >= 0 ? '#ffffff' : '#000000', Math.abs(k));
