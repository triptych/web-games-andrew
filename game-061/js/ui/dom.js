// Tiny DOM helpers.

import { ITEMS } from '../config.js';

export const $ = (id) => document.getElementById(id);

// h('div.card.on', { onclick }, child, 'text', [children]) — filters null/false children.
export function h(sel, attrs, ...kids) {
    if (attrs == null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) { kids.unshift(attrs); attrs = {}; }
    const [tag, ...classes] = sel.split('.');
    const el = document.createElement(tag || 'div');
    if (classes.length) el.className = classes.join(' ');
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className += ' ' + v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (c) => {
        if (c == null || c === false) return;
        if (Array.isArray(c)) c.forEach(add);
        else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    return el;
}

export const fmt = (n) => {
    n = Math.floor(n);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return n.toLocaleString('en-US');
};
export const fmtDist = (d) => (d >= 1000 ? `${(d / 1000).toFixed(d >= 10000 ? 0 : 1)} km` : `${Math.round(d)} m`);
export const itemName = (id) => (id === 'credits' ? 'Credits' : ITEMS[id]?.name || id);
export const swatch = (id) => h('span.sw', { style: { background: ITEMS[id]?.color || '#888' } });

// Cost list with have/need colouring. `have(id)` returns the amount available.
export function costList(cost, have) {
    if (!cost) return null;
    return h('div.cost', Object.entries(cost).map(([k, v]) => {
        const hv = have(k);
        return h(`span.${hv >= v ? 'yes' : 'no'}`, k === 'credits' ? `◆ ${fmt(v)}` : [swatch(k), `${v} ${itemName(k)}`], hv < v && k !== 'credits' ? h('small.muted', ` (${Math.floor(hv)})`) : null);
    }));
}

export function pips(n, max) { return h('div.pips', Array.from({ length: max }, (_, i) => h(`i${i < n ? '.on' : ''}`))); }
