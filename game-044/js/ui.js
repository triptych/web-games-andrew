/**
 * ui.js — every piece of DOM: the narration and dialogue box, choices, the
 * verb bar and inventory, toasts, the Book of Tales, the menu, and the full
 * page "storybook" screens used for the prologue, deaths and endings.
 *
 * Each modal returns a Promise, so scripts read top to bottom:
 *     await ui.say({ text: 'The well is deep.' });
 *     const pick = await ui.choose(['Climb down', 'Better not']);
 */

import { state, MAX_SCORE, ENDINGS, endingsFound, prefs, savePrefs } from './state.js';
import { events } from './events.js';
import { ITEMS, itemIcon, verbIcon } from './items.js';
import { sfx, setSound, soundOn } from './sounds.js';

const $ = (id) => document.getElementById(id);

// Speaker colours for dialogue name tags.
const WHO_COLOR = {
    Gran: '#f0a878', Pell: '#c86f8f', Gubbins: '#74b94a', Tatters: '#a8c8e8',
    Wenna: '#b6d97a', Graniteface: '#c3c7d0', Brimble: '#cfa168', Corvin: '#f4c542',
    Elsie: '#fbe7a1', Rowan: '#6fc7c0', Button: '#cfa168',
};

let P = prefs();

export function getPrefs() { return P; }

// --- text formatting -------------------------------------------------------

function esc(s) {
    return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** *italic* and paragraph breaks; tolerant of an unclosed * mid-typewriter. */
function format(text) {
    let out = '', italic = false;
    for (const para of esc(text).split('\n\n')) {
        let p = '';
        for (const ch of para) {
            if (ch === '*') { p += italic ? '</em>' : '<em>'; italic = !italic; } else if (ch === '\n') p += '<br>';
            else p += ch;
        }
        if (italic) { p += '</em>'; italic = false; }
        out += `<p>${p}</p>`;
    }
    return out;
}

// --- the message box -----------------------------------------------------------

let msgResolve = null, typing = null;

/**
 * Show narration (no `who`) or a line of speech. Resolves when dismissed.
 * The first click finishes the typewriter; the second dismisses.
 */
export function say({ who = null, text }) {
    return new Promise((resolve) => {
        const box = $('msg');
        box.hidden = false;
        box.classList.toggle('speech', !!who);
        $('msg-who').textContent = who || '';
        $('msg-who').hidden = !who;
        $('msg-who').style.color = WHO_COLOR[who] || '#f4c542';
        $('msg-choices').innerHTML = '';
        $('msg-more').hidden = true;
        const el = $('msg-text');
        const speed = [0, 45, 90, 400][P.textSpeed ?? 2] ?? 90;
        if (!speed || text.length < 2) {
            el.innerHTML = format(text);
            $('msg-more').hidden = false;
        } else {
            let n = 0;
            const start = performance.now();
            const step = () => {
                n = Math.min(text.length, Math.floor((performance.now() - start) / 1000 * speed) + 1);
                el.innerHTML = format(text.slice(0, n));
                if (n >= text.length) { typing = null; $('msg-more').hidden = false; return; }
                typing = requestAnimationFrame(step);
            };
            typing = requestAnimationFrame(step);
            typing = typing || 1;
            box._finish = () => {
                if (typing) cancelAnimationFrame(typing);
                typing = null;
                el.innerHTML = format(text);
                $('msg-more').hidden = false;
            };
        }
        msgResolve = () => {
            box.hidden = true;
            msgResolve = null;
            resolve();
        };
    });
}

function advance() {
    const box = $('msg');
    if (box.hidden || $('msg-choices').childElementCount) return;
    if (typing) { box._finish?.(); return; }
    if (msgResolve) { sfx.click(); msgResolve(); }
}

/**
 * Show choices. `options` is an array of strings. Optional `prompt` text is
 * shown above them. Resolves with the chosen index.
 */
export function choose(options, prompt = null, who = null) {
    return new Promise((resolve) => {
        const box = $('msg');
        box.hidden = false;
        box.classList.toggle('speech', !!who);
        $('msg-who').textContent = who || '';
        $('msg-who').hidden = !who;
        $('msg-who').style.color = WHO_COLOR[who] || '#f4c542';
        $('msg-text').innerHTML = prompt ? format(prompt) : '';
        $('msg-more').hidden = true;
        const list = $('msg-choices');
        list.innerHTML = '';
        options.forEach((o, i) => {
            const b = document.createElement('button');
            b.className = 'choice';
            b.innerHTML = `<span class="num">${i + 1}</span><span class="ct">${format(o).replace(/^<p>|<\/p>$/g, '')}</span>`;
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                sfx.click();
                list.innerHTML = '';
                box.hidden = true;
                choiceKeys = null;
                resolve(i);
            });
            list.appendChild(b);
        });
        choiceKeys = (n) => { const b = list.children[n]; if (b) b.click(); };
        setTimeout(() => list.firstElementChild?.focus(), 0);
    });
}
let choiceKeys = null;

// --- toasts ---------------------------------------------------------------------

export function toast(html, cls = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + cls;
    t.innerHTML = html;
    $('toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2400);
    setTimeout(() => t.remove(), 3000);
}

// --- verb bar & inventory ---------------------------------------------------

let currentVerb = 'walk', currentItem = null;
let onVerbChange = () => {};

export function initBar({ verbChanged, itemClicked }) {
    onVerbChange = verbChanged;
    for (const v of ['walk', 'look', 'use', 'talk']) {
        const b = $('v-' + v);
        const ic = verbIcon(v);
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        c.getContext('2d').drawImage(ic, 0, 0);
        b.prepend(c);
        b.addEventListener('click', () => { sfx.verb(); setVerb(v); });
    }
    $('inv').addEventListener('click', (e) => {
        const slot = e.target.closest('.slot');
        if (slot && slot.dataset.item) itemClicked(slot.dataset.item);
    });
    events.on('inventory', renderInventory);
    events.on('score', (total, gained) => {
        $('score').textContent = `${total} / ${MAX_SCORE}`;
        if (gained > 0) {
            sfx.points();
            toast(`+${gained} points`, 'pts');
            $('score').classList.remove('bump');
            void $('score').offsetWidth;
            $('score').classList.add('bump');
        }
    });
    events.on('chronicle', () => {
        const n = state.chronicle.length;
        $('b-book').dataset.count = n || '';
    });
    renderInventory();
}

export function setVerb(v, item = null) {
    currentVerb = v;
    currentItem = item;
    for (const k of ['walk', 'look', 'use', 'talk']) $('v-' + k).classList.toggle('on', !item && k === v);
    renderInventory();
    onVerbChange(currentVerb, currentItem);
}

export function verb() { return currentVerb; }
export function item() { return currentItem; }

export function renderInventory() {
    const inv = $('inv');
    inv.innerHTML = '';
    const n = Math.max(8, state.inv.length);
    for (let i = 0; i < n; i++) {
        const id = state.inv[i];
        const s = document.createElement('button');
        s.className = 'slot';
        if (id) {
            s.dataset.item = id;
            s.title = ITEMS[id].name;
            s.setAttribute('aria-label', ITEMS[id].name);
            const c = document.createElement('canvas');
            c.width = 16; c.height = 16;
            c.getContext('2d').drawImage(itemIcon(id), 0, 0);
            s.appendChild(c);
            if (id === currentItem) s.classList.add('on');
        } else {
            s.disabled = true;
            s.setAttribute('aria-hidden', 'true');
        }
        inv.appendChild(s);
    }
    if (currentItem && !state.has(currentItem)) setVerb('walk');
}

// --- hover label ------------------------------------------------------------------

export function hoverLabel(text, x = null, y = null) {
    const el = $('hover');
    if (!text) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = text;
    if (x !== null) {
        const vp = $('viewport').getBoundingClientRect();
        const w = el.offsetWidth;
        el.style.left = Math.max(4, Math.min(vp.width - w - 4, x - w / 2)) + 'px';
        el.style.top = Math.max(4, y - 34) + 'px';
    }
}

// --- the Book of Tales ------------------------------------------------------------

export function openBook() {
    const body = $('book-body');
    body.innerHTML = '';
    const head = document.createElement('h2');
    head.textContent = 'The Book of Tales';
    body.appendChild(head);
    const sub = document.createElement('div');
    sub.className = 'book-sub';
    sub.textContent = state.chronicle.length
        ? 'being the true account of one longest night, as it wrote itself'
        : 'Every page is blank.';
    body.appendChild(sub);
    for (const c of state.chronicle) {
        const p = document.createElement('div');
        p.className = 'entry';
        p.innerHTML = format(c.text);
        body.appendChild(p);
    }
    if (state.chronicle.length) {
        const end = document.createElement('div');
        end.className = 'book-end';
        end.textContent = '— the ink is still wet —';
        body.appendChild(end);
    }
    $('book').hidden = false;
    setTimeout(() => { body.scrollTop = body.scrollHeight; $('book-close').focus(); }, 0);
}

export function closeBook() {
    $('book').hidden = true;
    if (bookWaiter) { const r = bookWaiter; bookWaiter = null; r(); }
}
let bookWaiter = null;

/** Open the book over the ending page; resolves when it's closed. */
export function openBookAndWait() {
    return new Promise((r) => { bookWaiter = r; openBook(); });
}

// --- menu ------------------------------------------------------------------------------

export function openMenu(handlers) {
    const m = $('menu');
    m.hidden = false;
    $('m-sound').textContent = 'Sound: ' + (soundOn() ? 'On' : 'Off');
    $('m-speed').textContent = 'Text: ' + ['Instant', 'Slow', 'Normal', 'Fast'][P.textSpeed ?? 2];
    m.onclick = (e) => {
        const b = e.target.closest('button');
        if (!b) { if (e.target === m) closeMenu(); return; }
        sfx.click();
        const act = b.dataset.act;
        if (act === 'sound') {
            P.sound = !soundOn(); setSound(P.sound); savePrefs(P);
            b.textContent = 'Sound: ' + (P.sound ? 'On' : 'Off');
        } else if (act === 'speed') {
            P.textSpeed = ((P.textSpeed ?? 2) + 1) % 4; savePrefs(P);
            b.textContent = 'Text: ' + ['Instant', 'Slow', 'Normal', 'Fast'][P.textSpeed];
        } else if (act === 'close') closeMenu();
        else { closeMenu(); handlers[act]?.(); }
    };
    setTimeout(() => m.querySelector('button').focus(), 0);
}

export function closeMenu() { $('menu').hidden = true; }

// --- full-page storybook screens ---------------------------------------------------

/**
 * Show a sequence of pages. Each page: { title?, text, art?: canvas, cls? }.
 * `buttons` (optional) are shown on the last page instead of "continue";
 * resolves with the chosen button index (or -1 when there were none).
 */
export function pages(list, buttons = null) {
    return new Promise((resolve) => {
        const el = $('pages');
        el.hidden = false;
        let i = 0;
        const show = () => {
            const pg = list[i];
            el.className = 'pages ' + (pg.cls || '');
            $('pg-title').textContent = pg.title || '';
            $('pg-title').hidden = !pg.title;
            const art = $('pg-art');
            art.innerHTML = '';
            if (pg.art) {
                pg.art.classList.add('pg-canvas');
                art.appendChild(pg.art);
            }
            art.hidden = !pg.art;
            $('pg-text').innerHTML = format(pg.text);
            const btns = $('pg-btns');
            btns.innerHTML = '';
            const last = i === list.length - 1;
            const opts = last && buttons ? buttons : [last ? 'Continue' : 'Turn the page'];
            opts.forEach((label, n) => {
                const b = document.createElement('button');
                b.textContent = label;
                b.addEventListener('click', () => {
                    sfx.click();
                    if (!last) { i++; show(); return; }
                    el.hidden = true;
                    pageKeys = null;
                    resolve(buttons ? n : -1);
                });
                btns.appendChild(b);
            });
            pageKeys = (k) => { if (k === 'next') btns.firstElementChild?.click(); };
            setTimeout(() => btns.firstElementChild?.focus(), 0);
            el.scrollTop = 0;
        };
        show();
    });
}
let pageKeys = null;

export function endingsList() {
    const found = endingsFound();
    return Object.entries(ENDINGS).map(([id, e]) =>
        found.includes(id) ? `✦ ${e.title}` : `✧ ??? — *${e.hint}*`).join('\n');
}

// --- keyboard --------------------------------------------------------------------------

export function initKeys(handlers) {
    window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        const k = e.key;
        if (!$('pages').hidden) {
            if (k === ' ' || k === 'Enter') { e.preventDefault(); pageKeys?.('next'); }
            return;
        }
        if (!$('msg').hidden) {
            if ($('msg-choices').childElementCount) {
                if (/^[1-9]$/.test(k)) { e.preventDefault(); choiceKeys?.(+k - 1); }
                return;
            }
            if (k === ' ' || k === 'Enter' || k === 'Escape') { e.preventDefault(); advance(); }
            return;
        }
        if (!$('book').hidden) { if (k === 'Escape' || k === 'b' || k === 'B') closeBook(); return; }
        if (!$('menu').hidden) { if (k === 'Escape') closeMenu(); return; }
        handlers.key?.(k, e);
    });
    $('msg').addEventListener('click', advance);
    $('book-close').addEventListener('click', () => { sfx.click(); closeBook(); });
    $('book').addEventListener('click', (e) => { if (e.target === $('book')) closeBook(); });
}

export function anyModalOpen() {
    return !$('msg').hidden || !$('book').hidden || !$('menu').hidden || !$('pages').hidden || !$('title').hidden;
}

// --- fades -----------------------------------------------------------------------------

export function fade(to, ms = 350, color = '#0d0b14') {
    const f = $('fade');
    f.style.background = color;
    f.style.transition = `opacity ${ms}ms`;
    f.style.opacity = to ? '1' : '0';
    return new Promise(r => setTimeout(r, ms));
}
