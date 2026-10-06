// DOM helpers shared by every panel: escaping, type chips, bars, portraits, and spatial keyboard
// navigation (arrow keys move between the buttons of the top panel, A presses, B backs out).

import { TYPE_INFO } from '../sim/data/types.js';
import { STATUS } from '../config.js';

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function typeChip(t, small = false) {
    const T = TYPE_INFO[t];
    if (!T) return '';
    return `<span class="type${small ? ' sm' : ''}" style="--tc:${T.color}">${T.icon} ${T.name}</span>`;
}
export function statusChip(st) {
    if (!st) return '';
    const S = STATUS[st];
    return `<span class="status" style="--sc:${S.color}">${S.short}</span>`;
}
export function hpColor(f) { return f > 0.5 ? 'var(--hp-hi)' : f > 0.2 ? 'var(--hp-mid)' : 'var(--hp-lo)'; }
export function bar(f, cls = '') { const k = Math.max(0, Math.min(1, f)); return `<div class="bar ${cls}"><b style="width:${(k * 100).toFixed(1)}%;background:${cls === 'xp' ? '' : hpColor(k)}"></b></div>`; }

/** <img> for a bot portrait that fills in when the portrait renders. */
let portraits = null;
export function setPortraits(p) { portraits = p; }
export function botImg(sp, gilded = false, cls = '', hidden = false) {
    const id = `pi${Math.random().toString(36).slice(2, 9)}`;
    const url = portraits ? portraits.bot(sp, gilded, (u) => { const el = document.getElementById(id); if (el) el.src = u; }) : null;
    return `<img id="${id}" class="pimg ${cls}${hidden ? ' unseen' : ''}" alt="" ${url ? `src="${url}"` : ''} draggable="false">`;
}
export function personImg(look, seed, cls = '') {
    const id = `pp${Math.random().toString(36).slice(2, 9)}`;
    const url = portraits ? portraits.person(look, seed, (u) => { const el = document.getElementById(id); if (el) el.src = u; }) : null;
    return `<img id="${id}" class="pimg ${cls}" alt="" ${url ? `src="${url}"` : ''} draggable="false">`;
}

export function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

// ------------------------------------------------------------------ spatial navigation
/** Move focus between the visible, enabled buttons inside root, in a direction. */
export function navMove(root, dir) {
    const items = [...root.querySelectorAll('button:not([disabled]), [data-nav]:not([disabled])')].filter((b) => b.offsetParent !== null && !b.closest('.hidden'));
    if (!items.length) return;
    const cur = document.activeElement && items.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) { items[0].focus(); return; }
    const r0 = cur.getBoundingClientRect();
    const c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 };
    let best = null, bs = Infinity;
    for (const b of items) {
        if (b === cur) continue;
        const r = b.getBoundingClientRect();
        const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        const dx = c.x - c0.x, dy = c.y - c0.y;
        const ok = dir === 'up' ? dy < -4 : dir === 'down' ? dy > 4 : dir === 'left' ? dx < -4 : dx > 4;
        if (!ok) continue;
        const main = dir === 'up' || dir === 'down' ? Math.abs(dy) : Math.abs(dx);
        const off = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
        const s = main + off * 2.2;
        if (s < bs) { bs = s; best = b; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); }
}
export function focusFirst(root) {
    const b = root.querySelector('button.default:not([disabled])') || root.querySelector('button:not([disabled]), [data-nav]');
    if (b) b.focus({ preventScroll: true });
}

export const fmtCogs = (n) => `⚙${Math.floor(n).toLocaleString('en-US')}`;
export function fmtTime(s) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h}:${String(m).padStart(2, '0')}`; }
