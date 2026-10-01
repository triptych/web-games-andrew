/** dom.js — small DOM helpers, toasts, banners and the KISMET bark bubble. */

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => [...document.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return e;
}

export function show(e, on = true) { (typeof e === 'string' ? $(e) : e).classList.toggle('hidden', !on); }
export const hide = (e) => show(e, false);

export function toast(html, kind = '') {
    const box = $('#toasts');
    const t = el('div', { class: `toast ${kind}`, html });
    box.append(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
}

/** Big centre banner. kind: chain | od | jackpot | win | lose | big | phase | info */
export function banner(html, kind = 'info', ms = 1200) {
    const b = $('#banner');
    const n = el('div', { class: `bn ${kind}`, html });
    b.append(n);
    while (b.children.length > 3) b.firstChild.remove();
    setTimeout(() => n.classList.add('out'), ms);
    setTimeout(() => n.remove(), ms + 450);
}

let barkTimer = null;
export function bark(text) {
    const b = $('#bark');
    if (!b) return;
    b.querySelector('.bark-text').textContent = text;
    b.classList.remove('hidden');
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    clearTimeout(barkTimer);
    barkTimer = setTimeout(() => b.classList.add('hidden'), 2600);
}

/** Count a number element up to `to` over ms. */
export function countUp(node, from, to, ms, fmtFn) {
    const t0 = performance.now();
    const step = (t) => {
        const u = Math.min(1, (t - t0) / ms);
        const e = 1 - Math.pow(1 - u, 3);
        node.textContent = fmtFn(from + (to - from) * e);
        if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}
