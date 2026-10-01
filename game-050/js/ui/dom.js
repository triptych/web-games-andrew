/**
 * dom.js — tiny DOM toolkit and the shared widgets every screen uses:
 * buttons, modals, toasts, hero/gear cards, reward chips, bars.
 */

import { icon, elIcon, clsIcon } from './icons.js';
import { num, pct, cap } from '../core/fmt.js';
import { RARITY, ELEMENT, STAT_SHORT } from '../data/core.js';
import { CLASSES } from '../data/classes.js';
import { GEAR_RARITY, SETS, SLOT, ORES, JEWELS, CROPS, ITEMS, ESSENCE_NAME, STAT_LABEL, PCT_KEYS, BUFFS } from '../data/items.js';
import { SIGILS } from '../sim/summon.js';
import { mainValue } from '../sim/gear.js';
import { portraitSrc, requestPortrait } from './portraits.js';
import { sfx } from '../audio.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** h('div.cls#id', {attrs}, ...children) */
export function h(tag, attrs = {}, ...kids) {
    const m = tag.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) for (const t of m[2].match(/[.#][\w-]+/g) || []) { if (t[0] === '.') el.classList.add(t.slice(1)); else el.id = t.slice(1); }
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = {}; }
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className += ' ' + v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'data') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
        else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
        if (kid === null || kid === undefined || kid === false) continue;
        el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
}

/** el.append() that skips null/false children (DOM append would print "null"). */
export function app(el, ...kids) { el.append(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false)); return el; }

export const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };

export function btn(label, onClick, cls = '', opts = {}) {
    const b = h('button.btn', { class: cls, type: 'button', disabled: opts.disabled ? true : null, title: opts.title || null, 'aria-label': opts.aria || null });
    b.innerHTML = label;
    b.addEventListener('click', (e) => {
        if (b.disabled) return;
        if (!opts.silent) sfx('click');
        onClick && onClick(e);
    });
    return b;
}

export function stars(n, max = 0, awake = false) {
    let s = '';
    for (let i = 0; i < n; i++) s += `<span class="star${awake ? ' awake' : ''}">★</span>`;
    for (let i = n; i < max; i++) s += '<span class="star off">★</span>';
    return `<span class="stars r${n}">${s}</span>`;
}

export function rarityName(n) { return RARITY[n] ? RARITY[n].name : ''; }

// ---------------------------------------------------------------- modals & toasts

let modalStack = [];

/**
 * modal({ title, body, buttons:[{label, cls, onClick, keep}], cls, onClose, dismiss=true })
 * returns { el, close }
 */
export function modal(o) {
    const root = $('#modal-root');
    const back = h('div.modal-back');
    const card = h('div.modal', { class: o.cls || '', role: 'dialog', 'aria-modal': 'true' });
    if (o.title) card.append(h('div.modal-head', h('h2.modal-title', { html: o.title }), o.dismiss === false ? null : h('button.icon-btn.modal-x', { 'aria-label': 'Close', html: icon('close'), onclick: () => close() })));
    const body = h('div.modal-body');
    if (o.body instanceof Node) body.append(o.body); else if (o.body) body.innerHTML = o.body;
    card.append(body);
    if (o.buttons && o.buttons.length) {
        const row = h('div.modal-btns');
        for (const b of o.buttons) row.append(btn(b.label, () => { const r = b.onClick && b.onClick(); if (!b.keep && r !== false) close(); }, b.cls || '', { disabled: b.disabled }));
        card.append(row);
    }
    back.append(card);
    root.append(back);
    requestAnimationFrame(() => back.classList.add('on'));
    if (o.dismiss !== false) back.addEventListener('click', (e) => { if (e.target === back) close(); });
    let closed = false;
    function close() {
        if (closed) return;
        closed = true;
        back.classList.remove('on');
        modalStack = modalStack.filter((m) => m !== api);
        setTimeout(() => back.remove(), 200);
        o.onClose && o.onClose();
    }
    const api = { el: card, body, close };
    modalStack.push(api);
    return api;
}

export function closeAllModals() { for (const m of [...modalStack]) m.close(); }
export function modalOpen() { return modalStack.length > 0; }

export function confirmBox(text, yes = 'Confirm', no = 'Cancel', cls = 'gold') {
    return new Promise((res) => {
        modal({ title: 'Are you sure?', body: h('p.center', { html: text }), buttons: [{ label: no, cls: 'ghost', onClick: () => res(false) }, { label: yes, cls, onClick: () => res(true) }], onClose: () => res(false) });
    });
}

export function toast(text, kind = '') {
    const t = h('div.toast', { class: kind, html: text });
    $('#toasts').append(t);
    requestAnimationFrame(() => t.classList.add('on'));
    setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 300); }, 2600);
}

// ---------------------------------------------------------------- bars

export function bar(frac, cls = '', label = '') {
    return h('div.bar', { class: cls }, h('div.bar-fill', { style: { width: Math.max(0, Math.min(1, frac)) * 100 + '%' } }), label ? h('span.bar-text', { html: label }) : null);
}

// ---------------------------------------------------------------- cards

export function portrait(hero, cls = '') {
    const src = portraitSrc(hero);
    const img = h('img.portrait', { class: cls, alt: hero.name, draggable: 'false', src: src || 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', data: { pk: String(hero.seed) } });
    if (!src) requestPortrait(hero, (url) => { img.src = url; });
    return img;
}

/**
 * heroCard(hero, { onClick, power, tag, selected, dim, compact })
 */
export function heroCard(hero, o = {}) {
    const c = h('button.hero-card', { type: 'button', class: `r${hero.star}${hero.radiant ? ' radiant' : ''}${o.selected ? ' selected' : ''}${o.dim ? ' dim' : ''}${o.compact ? ' compact' : ''}`, 'aria-label': `${hero.name}, ${hero.star} star ${CLASSES[hero.cls].name}` });
    c.append(
        portrait(hero),
        h('div.hc-el', { html: elIcon(hero.el) }),
        h('div.hc-cls', { html: clsIcon(hero.cls) }),
        h('div.hc-lv', `Lv ${hero.level}`),
        h('div.hc-stars', { html: stars(hero.star, 0, hero.awake) }),
    );
    if (!o.compact) c.append(h('div.hc-name', hero.name));
    if (o.tag) c.append(h('div.hc-tag', { html: o.tag }));
    if (hero.locked) c.append(h('div.hc-lock', { html: icon('lock') }));
    if (hero.isNew) c.append(h('div.hc-new', 'NEW'));
    if (o.onClick) c.addEventListener('click', () => { sfx('click'); o.onClick(hero); });
    return c;
}

export function gearIcon(g) {
    return h('div.gear-icon', { class: `gr${g.rarity}`, style: { '--set': SETS[g.set].color } }, h('span.gi-ico', { html: icon(SLOT[g.slot].icon) }), h('span.gi-tier', 'T' + g.tier), g.level ? h('span.gi-lv', '+' + g.level) : null);
}

export function statLine(stat, v) {
    const label = STAT_LABEL[stat] || stat;
    const val = PCT_KEYS.has(stat) ? `+${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%` : `+${num(v)}`;
    return `<span class="sl-k">${label}</span><span class="sl-v">${val}</span>`;
}

export function gearCard(g, o = {}) {
    const c = h('button.gear-card', { type: 'button', class: `gr${g.rarity}${o.selected ? ' selected' : ''}` });
    c.append(gearIcon(g), h('div.gc-body',
        h('div.gc-name', { style: { color: GEAR_RARITY[g.rarity].color } }, g.name),
        h('div.gc-main', { html: statLine(g.main, mainValue(g)) }),
        o.compact ? null : h('div.gc-subs', { html: g.subs.map((s) => `<div class="gc-sub">${statLine(s.s, s.v)}${s.r ? ` <span class="gc-r">${'▲'.repeat(s.r)}</span>` : ''}</div>`).join('') }),
    ));
    if (g.owner && o.ownerName) c.append(h('div.gc-owner', o.ownerName));
    if (g.locked) c.append(h('div.hc-lock', { html: icon('lock') }));
    if (o.onClick) c.addEventListener('click', () => { sfx('click'); o.onClick(g); });
    return c;
}

// ---------------------------------------------------------------- rewards

const ESS_COLORS = { lo: '#9fe0ff', mid: '#c89aff', hi: '#ffd24a' };

/** Describes one entry of a grant list: { ico (html), label, n, cls, color } */
export function describe(e) {
    switch (e.kind) {
        case 'gold': return { ico: icon('gold'), label: 'Gold', n: e.n };
        case 'gems': return { ico: icon('gem'), label: 'Gems', n: e.n, cls: 'rare' };
        case 'dust': return { ico: icon('dust'), label: 'Soul Dust', n: e.n };
        case 'shards': return { ico: icon('shard'), label: 'Sigil Shards', n: e.n };
        case 'tomes': return { ico: icon('tome'), label: 'Skill Tome', n: e.n, cls: 'rare' };
        case 'arenaTokens': return { ico: icon('arena'), label: 'Arena Tokens', n: e.n };
        case 'spireTokens': return { ico: icon('spire'), label: 'Spire Tokens', n: e.n };
        case 'stamina': return { ico: icon('stamina'), label: 'Stamina', n: e.n };
        case 'xp': return { ico: icon('xp'), label: 'Overlord XP', n: e.n };
        case 'olLevel': return { ico: icon('crown'), label: 'Overlord Level Up!', n: e.n, cls: 'epic' };
        case 'sigils': return { ico: `<span style="color:${SIGILS[e.id].color}">${icon('sigil')}</span>`, label: SIGILS[e.id].name, n: e.n, cls: e.id === 'legend' ? 'legend' : e.id === 'common' ? '' : 'rare' };
        case 'ores': return { ico: `<span class="tint" style="--c:${ORES[e.id].color}">${icon('ore')}</span>`, label: ORES[e.id].name, n: e.n };
        case 'jewels': return { ico: `<span class="tint" style="--c:${JEWELS[e.id].color}">${icon('jewel')}</span>`, label: JEWELS[e.id].name, n: e.n, cls: 'rare' };
        case 'crops': return { ico: `<span class="tint" style="--c:${CROPS[e.id].color}">${icon('crop')}</span>`, label: CROPS[e.id].name, n: e.n };
        case 'seeds': return { ico: icon('seed'), label: CROPS[e.id].name + ' Seeds', n: e.n };
        case 'items': return { ico: e.id === 'chest' ? icon('chest') : e.id === 'seedPack' ? icon('seed') : e.id === 'tome' ? icon('tome') : `<span class="tint" style="--c:${ITEMS[e.id].color}">${icon('elixir')}</span>`, label: ITEMS[e.id].name, n: e.n };
        case 'essences': return { ico: `<span class="tint" style="--c:${ESS_COLORS[e.tier]}">${icon('essence')}</span>`, label: `${ESSENCE_NAME[e.tier]} ${ELEMENT[e.id].name} Essence`, n: e.n, cls: e.tier === 'hi' ? 'epic' : '' };
        case 'gear': return { ico: '', gear: e.gear, label: e.gear.name, n: 1, cls: 'gr' + e.gear.rarity };
        case 'hero': return { ico: '', hero: e.hero, label: e.hero.name, n: 1, cls: 'r' + e.hero.nat };
        case 'buff': return { ico: icon(BUFFS[e.id].icon), label: `${BUFFS[e.id].name}: ${BUFFS[e.id].desc}`, n: e.n, cls: 'rare', suffix: ' min' };
        default: return { ico: icon('info'), label: e.kind, n: e.n };
    }
}

export function rewardChip(e, delay = 0) {
    const d = describe(e);
    const c = h('div.reward', { class: d.cls || '', style: { animationDelay: delay + 'ms' }, title: d.label });
    if (d.gear) c.append(gearIcon(d.gear));
    else if (d.hero) c.append(portrait(d.hero, 'small'), h('div.rw-stars', { html: stars(d.hero.nat) }));
    else c.append(h('div.rw-ico', { html: d.ico }));
    c.append(h('div.rw-n', d.gear || d.hero ? '' : '×' + num(d.n) + (d.suffix || '')), h('div.rw-label', d.label));
    return c;
}

/** Merges duplicate entries (same kind/id/tier) for display. */
export function mergeRewards(list) {
    const out = [];
    for (const e of list || []) {
        if (e.kind === 'gear' || e.kind === 'hero') { out.push(e); continue; }
        const f = out.find((x) => x.kind === e.kind && x.id === e.id && x.tier === e.tier);
        if (f) f.n += e.n; else out.push({ ...e });
    }
    return out;
}

export function rewardGrid(list) {
    const g = h('div.reward-grid');
    mergeRewards(list).forEach((e, i) => g.append(rewardChip(e, i * 60)));
    return g;
}

export function showRewards(title, list, extra) {
    if (!list || !list.length) return null;
    sfx('reward');
    const body = h('div', extra || null, rewardGrid(list));
    return modal({ title, body, cls: 'rewards-modal', buttons: [{ label: 'Collect', cls: 'gold' }] });
}

/** cost chip: e.g. costLine({gold: 500, gems: 20}) */
export function costLine(cost, S) {
    const parts = [];
    const have = (k, v, sub) => !S ? true : sub ? (S.res[k][sub] || 0) >= v : (S.res[k] || 0) >= v;
    for (const [k, v] of Object.entries(cost || {})) {
        if (!v) continue;
        if (typeof v === 'number') {
            const ic = { gold: 'gold', gems: 'gem', dust: 'dust', shards: 'shard', tomes: 'tome', arenaTokens: 'arena', spireTokens: 'spire', stamina: 'stamina' }[k] || 'info';
            parts.push(`<span class="cost ${have(k, v) ? '' : 'short'}">${icon(ic)}${num(v)}</span>`);
        } else if (k === 'essences') {
            for (const [el, tiers] of Object.entries(v)) for (const [t, n] of Object.entries(tiers)) if (n) parts.push(`<span class="cost ${!S || S.res.essences[el][t] >= n ? '' : 'short'}"><span class="tint" style="--c:${ESS_COLORS[t]}">${icon('essence')}</span>${n}</span>`);
        } else {
            for (const [id, n] of Object.entries(v)) {
                const ic = k === 'ores' ? `<span class="tint" style="--c:${ORES[id].color}">${icon('ore')}</span>` : k === 'jewels' ? `<span class="tint" style="--c:${JEWELS[id].color}">${icon('jewel')}</span>` : k === 'crops' ? `<span class="tint" style="--c:${CROPS[id].color}">${icon('crop')}</span>` : k === 'sigils' ? icon('sigil') : icon('info');
                parts.push(`<span class="cost ${have(k, n, id) ? '' : 'short'}">${ic}${num(n)}</span>`);
            }
        }
    }
    return parts.join('');
}

export function elBadge(el) { return `<span class="el-badge" style="--c:${ELEMENT[el].color}">${elIcon(el)}${ELEMENT[el].name}</span>`; }
export function clsBadge(c) { return `<span class="cls-badge">${clsIcon(c)}${CLASSES[c].name}</span>`; }

export { icon, elIcon, clsIcon, num, pct, cap, STAT_SHORT };
