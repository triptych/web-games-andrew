// A tiny DOM builder and the focus navigation every screen shares.

export const $ = (id) => document.getElementById(id);

export function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
}

export const visible = (el) => !el.hidden && el.getClientRects().length > 0;
export const focusables = (root) => [...root.querySelectorAll('.btn:not([disabled]), input, select, button.tbtn')].filter(visible);

/** Move focus to the nearest control in a direction (arrow keys, d-pad): works for lists and grids alike. */
export function moveFocus(root, dir) {
    const list = focusables(root);
    if (!list.length) return null;
    const cur = document.activeElement && list.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) { list[0].focus({ preventScroll: false }); return list[0]; }
    const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bs = Infinity;
    for (const el of list) {
        if (el === cur) continue;
        const q = el.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
        const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
        const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
        if (along <= 2) continue;
        const s = along + across * 2.2;
        if (s < bs) { bs = s; best = el; }
    }
    if (!best) {
        // wrap around within a single column
        if (dir === 'down' || dir === 'right') best = list[(list.indexOf(cur) + 1) % list.length]; else best = list[(list.indexOf(cur) - 1 + list.length) % list.length];
    }
    best.focus({ preventScroll: false });
    best.scrollIntoView?.({ block: 'nearest' });
    return best;
}

export function typeChip(code, color) { return h('span', { class: 'tag', style: `background:${color}` }, code); }
export function bar(kind, frac, extra = '') { return h('div', { class: `bar ${kind} ${extra}` }, h('i', { style: `width:${Math.max(0, Math.min(1, frac)) * 100}%` })); }
export const fmtTime = (s) => `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
