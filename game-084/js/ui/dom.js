// Small DOM helpers shared by the screens and the editors.

import { V } from '../runtime/index.js';

/** el('div', { class: 'x', onclick: fn }, [children or text]) */
export function el(tag, attrs = {}, kids = []) {
    const e = document.createElement(tag);
    for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (v === true) e.setAttribute(k, '');
        else e.setAttribute(k, v);
    }
    for (const c of [].concat(kids)) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return e;
}
export const $ = (id) => document.getElementById(id);

/** Paint sprite n of a cart into a canvas (8 × 8 backing store, CSS scales it up pixelated). */
export function spriteCanvas(cart, n, size = 32, sheet) {
    const c = el('canvas', { width: 8, height: 8, class: 'px', style: { width: size + 'px', height: size + 'px' } });
    paintSprite(c, cart, n, sheet);
    return c;
}
export function paintSprite(c, cart, n, sheet) {
    const g = c.getContext('2d');
    const img = g.createImageData(8, 8);
    const s = cart.sprites[n] || '';
    for (let i = 0; i < 64; i++) {
        const v = parseInt(s[i] || '0', 16) || 0;
        const p = V.PAL_RGB[v];
        img.data[i * 4] = p[0]; img.data[i * 4 + 1] = p[1]; img.data[i * 4 + 2] = p[2]; img.data[i * 4 + 3] = v ? 255 : 0;
    }
    g.clearRect(0, 0, 8, 8);
    g.putImageData(img, 0, 0);
    void sheet;
}
/** Download text as a file. */
export function download(name, text, type = 'application/json') {
    const blob = new Blob([text], { type });
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export const slug = (s) => String(s || 'cart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cart';
