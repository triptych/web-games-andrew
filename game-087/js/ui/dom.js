// Small DOM helpers shared by every room: an element builder, toasts, modals, confirmations and downloads.

export const $ = (id) => document.getElementById(id);

/** h('div', { class: 'x', onclick: fn, dataset: {}, style: {}, html: '…' }, ...children) */
export function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) {
        if (kid === null || kid === undefined || kid === false) continue;
        el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
}

/** Markup-lite → safe inline HTML for Thalion's lines (only *italic* and **bold**). */
export function rich(text) {
    const esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
}

export const fmt = (n) => Math.floor(n).toLocaleString('en');

// ------------------------------------------------------------------ toasts

let toastHost = null;
export function toast(text, { kind = '', icon = '', ms = 3200 } = {}) {
    toastHost ||= $('toasts');
    const el = h('div', { class: `toast ${kind}`, role: 'status' }, icon ? h('span', { class: 'toast-ic', html: icon }) : null, h('span', { html: rich(text) }));
    toastHost.append(el);
    while (toastHost.children.length > 4) toastHost.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
    return el;
}

// ------------------------------------------------------------------ modals

const stack = [];
/** Open a modal; build(card, close) fills it. Returns close(). Escape and the backdrop close it. */
export function modal(build, { wide = false, label = 'Dialog', onClose = null, sticky = false } = {}) {
    const root = $('modals');
    const card = h('div', { class: `modal-card${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
    const back = h('div', { class: 'modal' }, card);
    let downOnBack = false;
    back.addEventListener('pointerdown', (e) => { downOnBack = e.target === back; });
    back.addEventListener('click', (e) => { if (!sticky && e.target === back && downOnBack) close(); });
    const prev = document.activeElement;
    const close = () => {
        if (!back.isConnected) return;
        back.remove();
        const i = stack.indexOf(close);
        if (i >= 0) stack.splice(i, 1);
        onClose?.();
        if (prev && prev.isConnected) prev.focus?.({ preventScroll: true });
    };
    close.sticky = sticky;
    stack.push(close);
    root.append(back);
    build(card, close);
    const first = card.querySelector('[autofocus]') || card.querySelector('input, textarea, select, button');
    first?.focus({ preventScroll: true });
    return close;
}
export const modalOpen = () => stack.length > 0;
export function closeTopModal() {
    const top = stack[stack.length - 1];
    if (top && !top.sticky) { top(); return true; }
    return false;
}

export function confirmBox(title, text, { ok = 'Yes', cancel = 'Cancel', danger = false } = {}) {
    return new Promise((resolve) => {
        let answered = false;
        modal((card, close) => {
            card.append(
                h('h2', {}, title),
                h('p', { html: rich(text) }),
                h('div', { class: 'row-end' },
                    h('button', { class: 'btn', onclick: () => { answered = true; close(); resolve(false); } }, cancel),
                    h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { answered = true; close(); resolve(true); } }, ok)),
            );
        }, { label: title, onClose: () => { if (!answered) resolve(false); } });
    });
}

export function promptBox(title, { value = '', label = '', ok = 'Done', placeholder = '' } = {}) {
    return new Promise((resolve) => {
        let answered = false;
        modal((card, close) => {
            const input = h('input', { type: 'text', value, placeholder, 'aria-label': label || title, autofocus: true, maxlength: 120 });
            const done = () => { answered = true; close(); resolve(input.value.trim()); };
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } });
            card.append(h('h2', {}, title), label ? h('label', { class: 'lbl' }, label) : null, input,
                h('div', { class: 'row-end' }, h('button', { class: 'btn', onclick: () => { answered = true; close(); resolve(null); } }, 'Cancel'), h('button', { class: 'btn primary', onclick: done }, ok)));
            setTimeout(() => input.select(), 0);
        }, { label: title, onClose: () => { if (!answered) resolve(null); } });
    });
}

// ------------------------------------------------------------------ files

export function download(name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name, style: { display: 'none' } });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

export function pickFile(accept) {
    return new Promise((resolve) => {
        const input = h('input', { type: 'file', accept, style: { display: 'none' } });
        input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); });
        document.body.append(input);
        input.click();
    });
}

/** Debounce: the last call wins after ms; .flush() runs it now. */
export function debounce(fn, ms) {
    let t = 0, args = null;
    const run = () => { t = 0; const a = args; args = null; if (a) fn(...a); };
    const d = (...a) => { args = a; clearTimeout(t); t = setTimeout(run, ms); };
    d.flush = () => { clearTimeout(t); run(); };
    d.pending = () => !!args;
    return d;
}

/** A labelled field. */
export function field(label, input, hint = '') {
    return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), input, hint ? h('span', { class: 'hint', html: rich(hint) }) : null);
}

/** An auto-growing textarea. */
export function grow(ta) {
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 900) + 'px'; };
    ta.addEventListener('input', fit);
    requestAnimationFrame(fit);
    return ta;
}
