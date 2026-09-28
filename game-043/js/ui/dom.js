// Tiny DOM helpers.
export const $ = s => document.querySelector(s);
export function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs ?? {})) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.startsWith('on')) el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) { if (k == null || k === false) continue; el.append(k instanceof Node ? k : String(k)); }
    return el;
}
export const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export function iconEl(sprites, id, size = 32) {
    const img = document.createElement('img');
    img.src = sprites.itemURL(id); img.width = size; img.height = size; img.alt = '';
    img.className = 'icon'; img.style.width = size + 'px'; img.style.height = size + 'px';
    return img;
}
export function canvasEl(src, w, h2) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    c.style.width = w + 'px'; c.style.height = (h2 ?? w) + 'px'; c.style.imageRendering = 'pixelated';
    return c;
}
