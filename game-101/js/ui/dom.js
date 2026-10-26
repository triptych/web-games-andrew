// DOM helpers shared by the HUD and the screens.

import { itemIcon, portraitCanvas } from '../view/sprites.js';
import { RARITY } from '../config.js';
import { statText } from '../sim/items.js';

export function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
        for (const k in props) {
            const v = props[k];
            if (v === undefined || v === null || v === false) continue;
            if (k === 'class') el.className = v;
            else if (k === 'style') el.style.cssText = v;
            else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
            else if (k === 'html') el.innerHTML = v;
            else if (v === true) el.setAttribute(k, '');
            else el.setAttribute(k, v);
        }
    }
    const add = (k) => {
        if (k === null || k === undefined || k === false) return;
        if (Array.isArray(k)) k.forEach(add);
        else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    };
    kids.forEach(add);
    return el;
}

/** Draw a Pix canvas into a fresh <canvas> element (so it can be placed more than once). */
export function canvasEl(src, cls = 'px', w = null, h2 = null) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    c.className = cls;
    if (w) c.style.width = w + 'px';
    if (h2) c.style.height = h2 + 'px';
    return c;
}
export const icon = (it) => canvasEl(itemIcon(it), 'px icon');
export const portrait = (m, size = 36) => canvasEl(portraitCanvas(m), 'px portrait', size, size);

export const rarityClass = (it) => `r${it.rar ?? 0}`;
export function itemName(it) {
    return h('span', { class: rarityClass(it) }, it.name, it.cursed && it.known ? h('span', { class: 'c12' }, ' (cursed)') : '', it.n > 1 ? h('span', { class: 'dim' }, ` ×${it.n}`) : '');
}
export const itemStats = (it) => statText(it).join('  ');

export function bar(frac, col = 10, cls = '') {
    return h('div', { class: `bar ${cls}` }, h('div', { class: 'fill', style: `width:${Math.max(0, Math.min(1, frac)) * 100}%;background:var(--c${col})` }));
}
export const rarityName = (r) => RARITY[r].name;

/** A big button row: icon, label, sub line, right-hand text. */
export function row({ ic, label, sub, right, onClick, disabled, cls = '', title }) {
    return h('button', { class: `row ${cls}`, onclick: disabled ? null : onClick, disabled: !!disabled, title },
        ic || null,
        h('span', { class: 'rowtext' }, h('span', { class: 'rl' }, label), sub ? h('span', { class: 'rs' }, sub) : null),
        right !== undefined ? h('span', { class: 'rr' }, right) : null);
}
export const money = (n) => h('span', { class: 'gold' }, `${Math.round(n).toLocaleString('en-US')}g`);
export const tabs = (list, cur, onPick) => h('div', { class: 'tabs', role: 'tablist' }, list.map(([id, label, badge]) =>
    h('button', { class: `tab ${id === cur ? 'on' : ''}`, role: 'tab', 'aria-selected': id === cur, onclick: () => onPick(id) }, label, badge ? h('span', { class: 'badge' }, badge) : null)));
export const hr = () => h('div', { class: 'hr' });
