// DOM helpers for the Atelier: element builder, modals, toasts, menus, form
// fields and tabs. Text always goes in through textContent, never as HTML.

/** h('div.cls#id', { attrs, on: { click } }, ...children) */
export function h(sel, attrs, ...kids) {
    const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
    const el = document.createElement(m[1] || 'div');
    for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) {
        if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'text') el.textContent = v;
        else if (k === 'class') el.className = v;
        else if (k in el && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    add(el, kids);
    return el;
}
function add(el, kids) {
    for (const k of kids) {
        if (k === null || k === undefined || k === false) continue;
        if (Array.isArray(k)) add(el, k);
        else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
}
export const $ = (s, root) => (root || document).querySelector(s);
export const $$ = (s, root) => [...(root || document).querySelectorAll(s)];
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// ── modals ──────────────────────────────────────────────────────────────────
const stack = [];
/** modal({ title, body, buttons: [{ label, primary, danger, onClick }], wide, full, onClose, cls }) */
export function modal(o) {
    const root = document.getElementById('modal-root');
    const box = h('div.modal' + (o.wide ? '.wide' : '') + (o.full ? '.full' : '') + (o.cls ? '.' + o.cls : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Dialog' });
    const back = h('div.modal-back', box);
    const close = (why) => {
        if (back.dataset.closed) return;
        back.dataset.closed = '1';
        back.remove();
        const i = stack.indexOf(api);
        if (i >= 0) stack.splice(i, 1);
        if (o.onClose) o.onClose(why);
    };
    const head = h('header.modal-head', h('h2', { text: o.title || '' }), o.sticky ? null : h('button.icon.modal-x', { 'aria-label': 'Close', title: 'Close (Esc)', on: { click: () => close('x') } }, '✕'));
    const body = h('div.modal-body');
    if (o.body) add(body, [o.body]);
    box.append(head, body);
    if (o.buttons && o.buttons.length) {
        const foot = h('footer.modal-foot');
        for (const b of o.buttons) {
            foot.appendChild(h('button' + (b.primary ? '.primary' : '') + (b.danger ? '.danger' : ''), { text: b.label, disabled: !!b.disabled, title: b.title || '', on: { click: () => { const r = b.onClick ? b.onClick() : undefined; if (r !== false && !b.keep) close(b.label); } } }));
        }
        box.appendChild(foot);
    }
    back.addEventListener('pointerdown', (e) => { if (e.target === back && !o.sticky) back.dataset.down = '1'; });
    back.addEventListener('click', (e) => { if (e.target === back && back.dataset.down && !o.sticky) close('back'); back.dataset.down = ''; });
    root.appendChild(back);
    const api = { el: box, body, back, close, opts: o };
    stack.push(api);
    setTimeout(() => { const f = box.querySelector('[autofocus], input, select, textarea, button.primary'); if (f && !o.noFocus) f.focus(); }, 30);
    return api;
}
export function topModal() { return stack[stack.length - 1] || null; }
export function anyModal() { return stack.length > 0; }
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !stack.length) return;
    const top = stack[stack.length - 1];
    if (top.opts.sticky) return;
    e.preventDefault(); e.stopPropagation();
    top.close('esc');
}, true);

export function confirmDialog(title, text, okLabel, danger) {
    return new Promise((res) => {
        modal({ title, body: h('p', { text }), buttons: [{ label: 'Cancel', onClick: () => res(false) }, { label: okLabel || 'OK', primary: !danger, danger, onClick: () => res(true) }], onClose: (w) => { if (w === 'x' || w === 'esc' || w === 'back') res(false); } });
    });
}
export function promptDialog(title, label, value, okLabel) {
    return new Promise((res) => {
        const input = h('input', { type: 'text', value: value || '', maxlength: 80, autofocus: true });
        let done = false;
        const m = modal({ title, body: h('label.field', h('span', { text: label }), input), buttons: [{ label: 'Cancel', onClick: () => { done = true; res(null); } }, { label: okLabel || 'OK', primary: true, onClick: () => { done = true; res(input.value.trim()); } }], onClose: () => { if (!done) res(null); } });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { done = true; res(input.value.trim()); m.close('ok'); } });
    });
}

// ── toasts ──────────────────────────────────────────────────────────────────
export function toast(text, kind, opts) {
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = h('div.toast' + (kind ? '.' + String(kind).trim().split(/\s+/).join('.') : ''), opts && opts.icon ? h('span.ticon', { text: opts.icon }) : null, h('div.ttext', opts && opts.title ? h('b', { text: opts.title }) : null, h('span', { text })));
    root.appendChild(el);
    while (root.children.length > 3) root.firstChild.remove();
    setTimeout(() => el.classList.add('out'), (opts && opts.ms) || 3600);
    setTimeout(() => el.remove(), ((opts && opts.ms) || 3600) + 500);
}

// ── dropdown menus ──────────────────────────────────────────────────────────
let openMenu = null;
export function popMenu(anchorOrPoint, items) {
    closeMenu();
    const m = h('div.popmenu', { role: 'menu' });
    for (const it of items) {
        if (it === '-') { m.appendChild(h('hr')); continue; }
        if (it.header) { m.appendChild(h('div.menu-head', { text: it.header })); continue; }
        const b = h('button', { role: 'menuitem', disabled: !!it.disabled, title: it.title || '', on: { click: () => { closeMenu(); if (it.onClick) it.onClick(); } } }, it.icon ? h('span.micon', { text: it.icon }) : null, h('span', { text: it.label }), it.locked ? h('span.lock', { text: '🔒' }) : null, it.key ? h('kbd', { text: it.key }) : null);
        m.appendChild(b);
    }
    document.body.appendChild(m);
    let x, y;
    if (anchorOrPoint instanceof Element) { const r = anchorOrPoint.getBoundingClientRect(); x = r.left; y = r.bottom + 4; }
    else { x = anchorOrPoint.x; y = anchorOrPoint.y; }
    const mw = m.offsetWidth, mh = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(x, innerWidth - mw - 4)) + 'px';
    m.style.top = Math.max(4, Math.min(y, innerHeight - mh - 4)) + 'px';
    openMenu = m;
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
    return m;
}
function outside(e) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }
export function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; document.removeEventListener('pointerdown', outside, true); } }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openMenu) { closeMenu(); e.stopPropagation(); } }, true);

// ── form fields ─────────────────────────────────────────────────────────────
/** A labelled field. kind: text | number | textarea | select | check | color | range */
export function field(label, kind, value, onChange, o) {
    o = o || {};
    let input;
    if (kind === 'textarea') { input = h('textarea', { rows: o.rows || 4, maxlength: o.max || 4000, placeholder: o.placeholder || '' }); input.value = value ?? ''; }
    else if (kind === 'select') {
        input = h('select');
        for (const opt of o.options || []) {
            const [v, l, dis] = Array.isArray(opt) ? opt : [opt, opt];
            const op = h('option', { value: String(v), text: l, disabled: !!dis });
            input.appendChild(op);
        }
        input.value = String(value ?? '');
    } else if (kind === 'check') { input = h('input', { type: 'checkbox' }); input.checked = !!value; }
    else if (kind === 'number') { input = h('input', { type: 'number', step: o.step || 1, min: o.min ?? '', max: o.max ?? '' }); input.value = value ?? 0; }
    else if (kind === 'color') { input = h('input', { type: 'color' }); input.value = (value || '#000000').slice(0, 7); }
    else if (kind === 'range') { input = h('input', { type: 'range', min: o.min ?? 0, max: o.max ?? 1, step: o.step || 0.01 }); input.value = value; }
    else { input = h('input', { type: 'text', maxlength: o.max || 80, placeholder: o.placeholder || '' }); input.value = value ?? ''; }
    const read = () => {
        if (kind === 'check') return input.checked;
        if (kind === 'number') { let n = Number(input.value); if (!Number.isFinite(n)) n = 0; if (o.min !== undefined) n = Math.max(o.min, n); if (o.max !== undefined) n = Math.min(o.max, n); return n; }
        if (kind === 'range') return Number(input.value);
        if (kind === 'select' && o.numeric) return Number(input.value);
        return input.value;
    };
    input.addEventListener(kind === 'text' || kind === 'textarea' ? 'input' : 'change', () => onChange && onChange(read(), input));
    if (o.disabled) input.disabled = true;
    if (o.id) input.id = o.id;
    const wrap = h('label.field' + (kind === 'check' ? '.check' : '') + (o.cls ? '.' + o.cls : ''), { title: o.title || '' }, kind === 'check' ? [input, h('span', { text: label })] : [h('span', { text: label }), input], o.hint ? h('small.hint', { text: o.hint }) : null);
    wrap.input = input;
    return wrap;
}
export function row(...kids) { return h('div.row', ...kids); }
export function section(title, ...kids) { return h('fieldset.section', h('legend', { text: title }), ...kids); }

/** Tabs: [{ id, label, locked, render(el) }] */
export function tabs(list, initial, onSwitch) {
    const bar = h('div.tabs', { role: 'tablist' });
    const body = h('div.tab-body');
    const wrap = h('div.tabwrap', bar, body);
    let cur = null;
    const show = (id) => {
        const t = list.find((x) => x.id === id) || list[0];
        cur = t.id;
        for (const b of bar.children) b.classList.toggle('on', b.dataset.id === t.id);
        clear(body);
        t.render(body);
        if (onSwitch) onSwitch(t.id);
    };
    for (const t of list) bar.appendChild(h('button.tab' + (t.locked ? '.locked' : ''), { role: 'tab', 'data-id': t.id, title: t.locked ? t.locked : '', on: { click: () => (t.locked ? toast(t.locked, 'warn') : show(t.id)) } }, t.label, t.locked ? h('span.lock', { text: ' 🔒' }) : null));
    show(initial || list.find((t) => !t.locked)?.id || list[0].id);
    wrap.show = show;
    wrap.current = () => cur;
    return wrap;
}

/** Draw a canvas into a new canvas element at an integer scale (pixel art). */
export function pixelCanvas(src, scale, cls) {
    const c = h('canvas' + (cls ? '.' + cls : ''));
    c.width = src.width * scale; c.height = src.height * scale;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    return c;
}

export function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'application/octet-stream' });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function slug(s) { return String(s || 'tale').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'tale'; }
