/**
 * dom.js — small DOM helpers shared by every screen: element builder, the SVG
 * icon set, card thumbnails (painted by cardArt.js), tooltips, floating
 * numbers, banners and toasts.
 */

import { faceTextures, cardKey } from '../view/cardArt.js';
import { cardName, cardText, ENCHANTS, ARCANA } from '../sim/cards.js';

export const $ = (id) => document.getElementById(id);

export function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (k === 'style') e.style.cssText = v;
        else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
}

// ------------------------------------------------------------------ icons (24×24 viewBox, currentColor)

const P = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="currentColor" ${extra}>${d}</svg>`;
export const ICON = {
    battle: P('<path d="M4 3l6 6-1.5 1.5L7 9l-2 2 1.5 1.5L5 14l-2-2 2-2-1.5-1.5L3 9zM20 3l-9.5 9.5 1.5 1.5L21.5 4.5V3zM10 15l-5 5 1.5 1.5 5-5zM14.5 12.5L13 14l7 7 1.5-1.5z"/>'),
    elite: P('<path d="M12 2c-4.4 0-8 3.1-8 7.5 0 2.4 1.1 4.3 2.8 5.5L6 20h3v-2h2v2h2v-2h2v2h3l-.8-5c1.7-1.2 2.8-3.1 2.8-5.5C20 5.1 16.4 2 12 2zm-3.5 10a2 2 0 110-4 2 2 0 010 4zm7 0a2 2 0 110-4 2 2 0 010 4z"/>'),
    event: P('<path d="M12 2a7 7 0 00-7 7h3a4 4 0 118 0c0 2-3 2.6-3.6 5.4L12 16h-1.5l.1-1.8C11.2 10.8 13 10 13 9a1 1 0 10-2 0H8a4 4 0 118 0c0 2.6-2.6 3.7-3.2 5.6H12v1.4h-1V15zm-1.5 17h3v3h-3z"/>'),
    shop: P('<circle cx="12" cy="12" r="9" opacity=".25"/><path d="M12 4a8 8 0 100 16 8 8 0 000-16zm1 12.9V18h-2v-1.1c-1.5-.3-2.6-1.3-2.7-2.7h1.9c.1.7.8 1.2 1.8 1.2 1.1 0 1.6-.5 1.6-1.1 0-.7-.6-1-2.1-1.4-1.9-.5-2.9-1.2-2.9-2.6 0-1.2 1-2.2 2.4-2.5V6.7h2v1.1c1.4.3 2.3 1.3 2.4 2.6h-1.9c-.1-.7-.7-1.1-1.6-1.1-.9 0-1.4.4-1.4 1s.6.9 2 1.3c1.9.5 3 1.2 3 2.7 0 1.3-1 2.3-2.5 2.6z"/>'),
    rest: P('<path d="M12 2s5 5 5 10a5 5 0 01-10 0c0-2 1-3.5 1-3.5S9 10 10 10c0-3 2-8 2-8zm0 16a2.5 2.5 0 002.5-2.5C14.5 13.5 12 11 12 11s-2.5 2.5-2.5 4.5A2.5 2.5 0 0012 18zM3 20h18v2H3z"/>'),
    treasure: P('<path d="M3 10a4 4 0 014-4h10a4 4 0 014 4v2H3zm0 3h8v2h2v-2h8v7H3z"/><rect x="10.5" y="11" width="3" height="5" rx="1" fill="#000" opacity=".5"/>'),
    boss: P('<path d="M2 18l2-11 5 5 3-8 3 8 5-5 2 11zm1 2h18v2H3z"/>'),
    deck: P('<path d="M7 3h11a2 2 0 012 2v13h-2V5H7zM4 7h11a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z"/>'),
    ranks: P('<path d="M4 4h16v3H4zm0 6.5h16v3H4zM4 17h16v3H4z" opacity=".3"/><path d="M5 4.5h7v2H5zm0 6.5h10v2H5zm0 6.5h13v2H5z"/>'),
    chron: P('<path d="M5 3h11l3 3v15H5zm2 4v2h10V7zm0 4v2h10v-2zm0 4v2h7v-2z"/>'),
    menu: P('<path d="M3 6h18v2.5H3zm0 5h18v2.5H3zm0 5h18v2.5H3z"/>'),
    attack: P('<path d="M3 21l3-1 9-9-2-2-9 9zM14 8l2 2 5-5V3h-2zM5 13l6 6-1 1-6-6z"/>'),
    defend: P('<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/>'),
    buff: P('<path d="M12 3l7 8h-4v9H9v-9H5z"/>'),
    debuff: P('<path d="M12 21l-7-8h4V4h6v9h4z"/>'),
    curse: P('<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 3l2 5h5l-4 3 1.6 5L12 15l-4.6 3 1.6-5-4-3h5z"/>'),
    heal: P('<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z"/>'),
    summon: P('<path d="M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8z"/><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
    charge: P('<path d="M6 2h12v3l-4 7 4 7v3H6v-3l4-7-4-7zm2 2v1l4 6.5L16 5V4z"/>'),
    unknown: P('<text x="12" y="17" text-anchor="middle" font-size="16" font-weight="bold">?</text>'),
    relic: P('<path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>'),
    crown: P('<path d="M2 18l2-11 5 5 3-8 3 8 5-5 2 11z"/>'),
    sword: P('<path d="M20 2l-9 9 2 2 9-9V2zM4 20l4-1 3-3-2-2-3 3z"/>'),
    staff: P('<path d="M17 2a3 3 0 11-2.1 5.1L6 16l-2 6-1-1 3-5 8.9-8.9A3 3 0 0117 2z"/>'),
    ring: P('<circle cx="12" cy="14" r="7" fill="none" stroke="currentColor" stroke-width="3"/><path d="M9 3h6l-3 4z"/>'),
    heart: P('<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z"/>'),
    die: P('<rect x="3" y="3" width="18" height="18" rx="4"/><g fill="#000" opacity=".6"><circle cx="8" cy="8" r="1.8"/><circle cx="16" cy="16" r="1.8"/><circle cx="12" cy="12" r="1.8"/></g>'),
    face: P('<circle cx="12" cy="10" r="6"/><path d="M4 22c0-4.4 3.6-7 8-7s8 2.6 8 7z"/>'),
    stones: P('<circle cx="8" cy="14" r="5"/><circle cx="16" cy="10" r="5" opacity=".7"/>'),
    seal: P('<circle cx="12" cy="12" r="9"/><path d="M12 6l1.8 4h4.2l-3.4 2.5 1.3 4L12 14l-3.9 2.5 1.3-4L6 10h4.2z" fill="#000" opacity=".5"/>'),
    stair: P('<path d="M3 20h5v-4h4v-4h4V8h5V4h-2v2h-5v4h-4v4H6v4H3z"/>'),
    mirror: P('<ellipse cx="12" cy="10" rx="6" ry="8" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M11 18h2v4h-2z"/>'),
    house: P('<path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/>'),
    cross: P('<path d="M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8z"/>'),
    compass: P('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8l-2.5 5.5L8 16l2.5-5.5z"/>'),
    candle: P('<path d="M12 2s2 2.5 2 4a2 2 0 01-4 0c0-1.5 2-4 2-4zM9 9h6v13H9z"/>'),
    lantern: P('<path d="M10 2h4v2h2l1 3v10l-2 3H9l-2-3V7l1-3h2z"/><circle cx="12" cy="12" r="3" fill="#fff" opacity=".6"/>'),
    hourglass: P('<path d="M6 2h12v3l-4 7 4 7v3H6v-3l4-7-4-7z"/>'),
    bag: P('<path d="M8 6a4 4 0 118 0h3l1 15H4L5 6zm2 0h4a2 2 0 00-4 0z"/>'),
    hand: P('<path d="M8 2h2v9h1V3h2v8h1V4h2v8h1V7h2v8c0 4-3 7-7 7s-6-2-7-5l-2-5 2-1 2 3z"/>'),
    quill: P('<path d="M20 2C10 4 6 10 5 17l-2 5 2-1 2-4c6 0 11-5 13-15z"/>'),
    shield: P('<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/>'),
    vial: P('<path d="M9 2h6v2h-1v5l5 9a3 3 0 01-2.6 4H7.6A3 3 0 015 18l5-9V4H9z"/>'),
    leaf: P('<path d="M20 3C10 3 4 8 4 15c0 2 .6 3.6 1.5 5L4 22h2l1.2-1.3C8.6 21.6 10.2 22 12 22c6 0 9-8 8-19z"/>'),
    cup: P('<path d="M5 3h14c0 5-2.5 8-6 8.8V18h3v3H8v-3h3v-6.2C7.5 11 5 8 5 3z"/>'),
    fang: P('<path d="M5 3h14l-3 9-4 10-4-10z"/>'),
    thorn: P('<path d="M12 2l2 6 6-2-4 5 5 3-6 1 1 7-4-5-4 5 1-7-6-1 5-3-4-5 6 2z"/>'),
    feather: P('<path d="M21 3C13 3 7 8 6 15l-3 7h2l2-4c7 0 12-6 14-15zm-11 12l6-6"/>'),
    flame: P('<path d="M12 2s6 5 6 11a6 6 0 01-12 0c0-3 2-5 2-5s0 3 2 3c0-4 2-9 2-9z"/>'),
    horn: P('<path d="M3 20c8-1 14-7 18-17l1 1c-2 10-8 17-17 18z"/>'),
    veil: P('<path d="M12 2c5 0 8 4 8 9v11l-3-2-2 2-3-2-3 2-2-2-3 2V11c0-5 3-9 8-9z"/>'),
    bone: P('<path d="M7 4a2.5 2.5 0 012.3 3.4l7.3 7.3A2.5 2.5 0 1120 17a2.5 2.5 0 11-3.4 2.3l-7.3-7.3A2.5 2.5 0 117 7a2.5 2.5 0 010-3z"/>'),
    idol: P('<path d="M12 2a4 4 0 014 4c0 2-1 3-2 3.5V11h4l-2 11H8L6 11h4V9.5C9 9 8 8 8 6a4 4 0 014-4z"/>'),
    coin: P('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6" fill="#000" opacity=".25"/>'),
    pillow: P('<path d="M3 8c0-2 2-3 4-3h10c2 0 4 1 4 3v8c0 2-2 3-4 3H7c-2 0-4-1-4-3z"/>'),
    eye: P('<path d="M12 5c5 0 9 4 10 7-1 3-5 7-10 7S3 15 2 12c1-3 5-7 10-7zm0 3.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z"/>'),
    kettle: P('<path d="M6 9h11a3 3 0 013 3v1a4 4 0 01-4 4H7a4 4 0 01-4-4v-1a3 3 0 013-3zm2-4h7v3H8zM4 19h16v2H4z"/>'),
    joker: P('<path d="M4 4l4 5 4-6 4 6 4-5-2 10H6zm2 12h12v3a2 2 0 01-2 2H8a2 2 0 01-2-2z"/>'),
    ward: P('<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/>'),
    gold: P('<circle cx="12" cy="12" r="9"/>'),
};

export function icon(name) { return ICON[name] ?? ICON.relic; }

// ------------------------------------------------------------------ card thumbnails

const urlCache = new Map();
export function cardURL(c) {
    const k = cardKey(c);
    if (!urlCache.has(k)) urlCache.set(k, faceTextures(c).map.image.toDataURL('image/jpeg', 0.86));
    return urlCache.get(k);
}

export function cardImg(c, cls = 'cardimg') {
    const img = el('img', { class: cls, src: cardURL(c), alt: cardName(c), draggable: 'false' });
    attachTip(img, () => cardTipHTML(c));
    return img;
}

export function cardTipHTML(c) {
    let h = `<b>${cardName(c)}</b><br>${cardText(c)}`;
    if (c.kind === 'arcana') h += `<br><span class="dim">Arcana · costs ${c.up ? ARCANA[c.id].upCost : ARCANA[c.id].cost} Deal${(c.up ? ARCANA[c.id].upCost : ARCANA[c.id].cost) === 1 ? '' : 's'}${ARCANA[c.id].exhaust ? ' · exhausts' : ''}</span>`;
    else if (c.ench) h += `<br><span class="dim" style="color:${ENCHANTS[c.ench].color}">${ENCHANTS[c.ench].name}</span>`;
    if (c.temp) h += '<br><span class="dim">Temporary: vanishes after combat.</span>';
    return h;
}

// ------------------------------------------------------------------ tooltips

let tipFor = null;
export function attachTip(node, html) {
    node.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(typeof html === 'function' ? html() : html, e.clientX, e.clientY, node); });
    node.addEventListener('pointermove', (e) => { if (tipFor === node) placeTip(e.clientX, e.clientY); });
    node.addEventListener('pointerleave', () => { if (tipFor === node) hideTip(); });
    node.addEventListener('contextmenu', (e) => e.preventDefault());
    // touch: long-press shows the tip
    let timer = null;
    node.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        timer = setTimeout(() => { showTip(typeof html === 'function' ? html() : html, e.clientX, e.clientY - 40, node); }, 380);
    });
    const cancel = () => { clearTimeout(timer); if (tipFor === node) setTimeout(hideTip, 1600); };
    node.addEventListener('pointerup', cancel);
    node.addEventListener('pointercancel', cancel);
}

export function showTip(html, x, y, owner = null) {
    const t = $('tip');
    t.innerHTML = html;
    t.classList.remove('hidden');
    tipFor = owner;
    placeTip(x, y);
}
export function placeTip(x, y) {
    const t = $('tip');
    const w = t.offsetWidth, h = t.offsetHeight;
    let px = x + 14, py = y + 14;
    if (px + w > window.innerWidth - 6) px = x - w - 14;
    if (py + h > window.innerHeight - 6) py = y - h - 14;
    t.style.left = Math.max(6, px) + 'px';
    t.style.top = Math.max(6, py) + 'px';
}
export function hideTip() { $('tip').classList.add('hidden'); tipFor = null; }

// ------------------------------------------------------------------ numbers, banners, toasts

export function floatNum(x, y, text, cls = 'dmg') {
    const n = el('div', { class: `num ${cls}`, text, style: `left:${x}px;top:${y}px` });
    $('numbers').append(n);
    setTimeout(() => n.remove(), 1200);
}

export function banner(head, sub = '', cls = '') {
    const b = $('banner');
    b.innerHTML = '';
    b.append(el('div', { class: `ban ${cls}` }, el('div', { class: 'h', text: head }), sub ? el('div', { class: 's', text: sub }) : null));
}

export function toast(text) {
    const t = el('div', { class: 'toast', text });
    $('toasts').append(t);
    setTimeout(() => t.remove(), 3100);
}

export function fade(on) { $('fade').classList.toggle('on', on); }
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
