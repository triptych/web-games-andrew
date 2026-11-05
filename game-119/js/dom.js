// A tiny element builder: h('button.btn.primary', { onclick }, 'Label', child, ...)

export function h(sel, props, ...kids) {
    const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
    const el = document.createElement(m[1] || 'div');
    for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) { if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1); }
    if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = null; }
    for (const [k, v] of Object.entries(props || {})) {
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') v.split(' ').forEach((c) => c && el.classList.add(c));
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (k) => {
        if (k == null || k === false) return;
        if (Array.isArray(k)) k.forEach(add);
        else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    };
    kids.forEach(add);
    return el;
}
export const $ = (id) => document.getElementById(id);
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
