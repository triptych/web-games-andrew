/**
 * dom.js — tiny DOM helpers: element builder, toasts, floating numbers and banners.
 */

export const $ = (id) => document.getElementById(id);

/** h('div.cls#id', { onclick, style, ... }, children...) */
export function h(sel, attrs, ...kids) {
    const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
    const el = document.createElement(m[1] || 'div');
    for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) {
        if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
            if (v === undefined || v === null || v === false) continue;
            if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
            else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
            else if (k === 'html') el.innerHTML = v;
            else if (k === 'text') el.textContent = v;
            else if (k in el && k !== 'list') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
            else el.setAttribute(k, v === true ? '' : v);
        }
    }
    for (const k of kids.flat(3)) {
        if (k === null || k === undefined || k === false) continue;
        el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
}

export function fmt(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k';
    return String(n);
}

export function toast(text, ms = 2400) {
    const el = h('div.toast', text);
    $('toasts').append(el);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms);
}

export function floatText(x, y, text, color = '#fff', cls = '') {
    const el = h('div.float' + (cls ? '.' + cls : ''), { style: { left: x + 'px', top: y + 'px', color } }, text);
    $('floats').append(el);
    setTimeout(() => el.remove(), 1150);
    return el;
}

let bannerTimer = 0;
export function banner(text, gold = false) {
    const b = $('banner');
    b.hidden = false;
    b.className = gold ? 'gold' : '';
    b.textContent = text;
    // restart the animation
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { b.hidden = true; }, 1300);
}
export function clearBanner() { $('banner').hidden = true; }

export function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Render a cost object as chips; short amounts in red. */
export function costView(cost, res, RES_INFO) {
    return h('span.cost', Object.entries(cost).map(([k, v]) => h('span' + ((res[k] || 0) < v ? '.short' : ''), `${RES_INFO[k]?.icon || k} ${fmt(v)}`)));
}
