// Small DOM helpers and the shared pieces every screen uses: element builder, bars, element
// chips, portrait images and the way a skill or an affinity is shown.

import { EL } from '../config.js';
import { SKILLS } from '../sim/data/skills.js';
import { DAEMONS, RACE_INFO } from '../sim/data/daemons.js';

export const $ = (id) => document.getElementById(id);

/** h('div.cls#id', { onclick, text, html, data-x }, ...children) */
export function h(spec, attrs, ...kids) {
    const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(spec);
    const el = document.createElement(m && m[1] ? m[1] : 'div');
    for (const part of (m ? m[2] : '').match(/[.#][\w-]+/g) || []) {
        if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
    if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
        for (const [k, v] of Object.entries(attrs)) {
            if (v == null || v === false) continue;
            if (k === 'text') el.textContent = v;
            else if (k === 'html') el.innerHTML = v;
            else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
            else if (k === 'class') el.className += ' ' + v;
            else el.setAttribute(k, v === true ? '' : v);
        }
    } else if (attrs != null) kids.unshift(attrs);
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export function bar(frac, kind = '') {
    const f = Math.max(0, Math.min(1, frac));
    return h(`div.bar${kind ? '.' + kind : ''}${kind === '' && f < 0.3 ? '.lo' : ''}`, h('i', { style: `width:${(f * 100).toFixed(1)}%` }));
}

export function elChip(el, extra = '') {
    const e = EL[el] || EL.root;
    return h('span.chip', { text: e.tag, style: `background:${e.color}22;color:${e.color};box-shadow:inset 0 0 0 1px ${e.color}88`, title: e.name + extra });
}
const AFF_NAME = { w: 'Weak', r: 'Resist', n: 'Null', d: 'Drain', p: 'Repel' };
const AFF_COL = { w: '#ffd86a', r: '#8fb0c0', n: '#cfe8ff', d: '#9dffb0', p: '#ff7ae0' };
/** An affinity chip: element tag coloured by what it does to the holder. */
export function affChip(el, kind, known = true) {
    if (!known) return h('span.chip.unk', { text: EL[el].tag, title: EL[el].name + ': unknown' });
    return h('span.chip' + (kind === 'w' ? '.w' : ''), { text: `${EL[el].tag}${kind.toUpperCase()}`, style: `color:${AFF_COL[kind]};background:${AFF_COL[kind]}22;box-shadow:inset 0 0 0 1px ${AFF_COL[kind]}88`, title: `${AFF_NAME[kind]} to ${EL[el].name}` });
}
export const AFF_ORDER = ['strike', 'gun', 'pyre', 'rime', 'volt', 'gale', 'lumen', 'hex'];

/** The affinity row of a species for the player: known ones coloured, unknown shown dim. */
export function affRow(G, spId, revealAll = false) {
    const sp = DAEMONS[spId], dex = G.dex[spId];
    const row = h('div.affs');
    for (const el of AFF_ORDER) {
        const k = sp.aff[el];
        const known = revealAll || !!(dex && dex.aff[el]) || (!!dex && dex.scanned);
        if (k && known) row.append(affChip(el, k));
        else if (!k && known) row.append(h('span.chip', { text: EL[el].tag, style: 'background:#16241f;color:#6a8a7e', title: EL[el].name + ': no special reaction' }));
        else row.append(affChip(el, 'w', false));
    }
    return row;
}

export function skillCost(sk) {
    if (sk.mp) return `${sk.mp} MP`;
    if (sk.hp) return `${sk.hp}% HP`;
    return sk.kind === 'pass' ? 'PASSIVE' : '—';
}
export function skillTag(sk) {
    if (sk.kind === 'atk') return elChip(sk.el);
    return h('span.chip', { text: { heal: 'HEAL', revive: 'REV', cure: 'CURE', buff: 'BUFF', debuff: 'DEBUF', ail: 'AIL', scan: 'SCAN', charge: 'CHRG', focus: 'FOCS', dispel: 'DISP', pass: 'PASS' }[sk.kind] || '—', style: 'background:#1c3a34;color:#7affd0' });
}
export function skillRow(id, onclick = null) {
    const sk = SKILLS[id];
    return h('div', { onclick }, skillTag(sk), h('span', { text: sk.name }), h('small', { text: skillCost(sk) }));
}

export const raceName = (r) => RACE_INFO[r].name;

/** A cached portrait as an <img>. make() returns a canvas the first time. */
const urls = new Map();
export function portraitImg(key, make, cls = 'pf') {
    if (!urls.has(key)) { const c = make(); urls.set(key, c ? c.toDataURL('image/png') : ''); }
    const u = urls.get(key);
    return u ? h(`img.${cls}`, { src: u, alt: '' }) : h(`div.${cls}`);
}
