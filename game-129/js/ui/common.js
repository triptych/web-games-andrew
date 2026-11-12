// HOLLOWDEEP — small DOM helpers shared by the UI modules.

import { itemDef, gearStats } from '../sim/data/items.js';

export const $ = (id) => document.getElementById(id);

/** el('div.card', { onclick }, [children...]) — a tag with optional .classes, attributes/handlers and children. */
export function el(spec, attrs = {}, kids = []) {
    const [tag, ...cls] = spec.split('.');
    const e = document.createElement(tag || 'div');
    if (cls.length) e.className = cls.join(' ');
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'style') e.style.cssText = v;
        else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of [].concat(kids)) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
}

export const porUrl = (id) => `art/por/${id}.webp`;
export const monUrl = (mid) => `art/mon/${mid}.webp`;

/** A 32 px icon from the 4x4 atlases (64 px cells). */
export function icon(id) {
    const d = itemDef(id) || {};
    const [sheet, cell] = d.icon || ['misc', 15];
    return el('i.icon', { style: `background-image:url(art/icons/${sheet}.webp);background-position:${-(cell % 4) * 32}px ${-Math.floor(cell / 4) * 32}px`, 'aria-hidden': 'true' });
}

export function itemName(entry) {
    const d = gearStats(entry);
    return d.name || entry.id;
}

/** One line describing what a piece of gear does. */
export function gearLine(entry) {
    const g = gearStats(entry);
    const bits = [];
    for (const [k, l] of [['atk', 'ATK'], ['def', 'DEF'], ['mag', 'MAG'], ['res', 'RES'], ['hp', 'HP'], ['mp', 'MP'], ['spd', 'SPD'], ['luk', 'LUK']]) {
        if (g[k]) bits.push(`${l} ${g[k] > 0 ? '+' : ''}${g[k]}`);
    }
    if (g.crit) bits.push(`crit +${Math.round(g.crit * 100)}%`);
    if (g.ranged) bits.push('ranged');
    return g.desc && g.type !== 'gear' ? g.desc : bits.join(' · ') || g.desc || '';
}

export function toast(text, big = false) {
    const t = el('div.toast' + (big ? '.big' : ''), { text });
    $('toasts').append(t);
    setTimeout(() => t.remove(), 3100);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}

/** A number that floats up from a point on the screen. */
export function floatText(x, y, text, cls = '') {
    const f = el('div.float' + (cls ? '.' + cls.split(' ').join('.') : ''), { text, style: `left:${x}px;top:${y}px` });
    document.body.append(f);
    setTimeout(() => f.remove(), 950);
}

let fader = null;
/** Fade to black, run fn, fade back. */
export function fadeThrough(fn, ms = 350) {
    if (!fader) { fader = el('div.fade'); document.body.append(fader); }
    fader.classList.add('on');
    return new Promise((res) => setTimeout(() => { fn(); fader.classList.remove('on'); setTimeout(res, ms); }, ms));
}

export const STATUS_ICON = { poison: '☠', sleep: '💤', paralyze: '⚡', stun: '✶', blind: '◌', curse: '⛧', slow: '🐢', might: '⚔', guard: '🛡', regen: '✚', taunt: '!', marked: '◎', charm: '♥', haste: '»' };
export const statusText = (st) => Object.keys(st || {}).map((k) => STATUS_ICON[k] || '').join('');
