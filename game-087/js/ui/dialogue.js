// Thalion speaks: the dialogue overlay (prologue, quests, finale) with its three prompts (pen name, sigil,
// calling), and the small non-blocking "pop" bubble for level-ups, first visits and asides.

import { $, h, rich } from './dom.js';
import { thalionSvg } from '../view/portrait.js';
import { sigilSvg, SIGIL_FIELDS, SIGIL_TINCTURES, SIGIL_SHAPES, CHARGES, CHARGE_NAMES } from '../view/art.js';
import { CALLINGS } from '../sim/data/guild.js';
import * as A from '../sim/actions.js';
import { active } from '../sim/state.js';
import { rankName } from '../sim/progress.js';

let playing = null;
export const dialogueOpen = () => !!playing;

export function fill(text, app, extra = {}) {
    const S = app.S;
    const vars = { name: S.player.name || 'apprentice', title: active(S)?.title || 'your book', rank: rankName(S), ...extra };
    return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

/** Play a list of lines. Resolves when the last one is dismissed. Scenes never overlap: a second one
 *  waits for the first to finish. */
let chain = Promise.resolve();
export function playScene(lines, app, extra = {}) {
    if (!lines?.length) return chain;
    chain = chain.then(() => runScene(lines, app, extra));
    return chain;
}

function runScene(lines, app, extra) {
    return new Promise((resolve) => {
        const root = $('dialogue');
        root.hidden = false;
        root.innerHTML = '';
        const face = h('div', { class: 'dlg-face' });
        const who = h('div', { class: 'dlg-who' });
        const text = h('div', { class: 'dlg-text', 'aria-live': 'polite' });
        const extraBox = h('div', { class: 'dlg-extra' });
        const next = h('button', { class: 'btn primary dlg-next', id: 'dlg-next' }, 'Continue ▸');
        const skip = h('button', { class: 'btn ghost dlg-skip', title: 'Skip to the end' }, 'Skip');
        const box = h('div', { class: 'dlg-box' }, h('div', { class: 'dlg-head' }, who, skip), text, extraBox, h('div', { class: 'dlg-foot' }, next));
        root.append(h('div', { class: 'dlg-wrap' }, face, box));
        let i = -1, typing = 0, full = '', waitAsk = false;
        const fast = app.fastText;

        const finish = () => {
            cancelAnimationFrame(typing);
            root.hidden = true;
            root.innerHTML = '';
            playing = null;
            document.removeEventListener('keydown', onKey, true);
            resolve();
        };
        const showAll = () => { cancelAnimationFrame(typing); typing = 0; text.innerHTML = rich(full); };
        const step = () => {
            if (typing) { showAll(); return; }
            if (waitAsk) return;
            i++;
            if (i >= lines.length) { finish(); return; }
            const line = lines[i];
            extraBox.innerHTML = '';
            next.hidden = false;
            if (line.ask) { ask(line.ask); return; }
            app.sound.blip();
            const narr = line.who === 'narrator';
            root.classList.toggle('narrating', narr);
            who.textContent = narr ? '' : 'Thalion Silverquill';
            if (!narr) face.innerHTML = thalionSvg(line.mood || 'smile');
            full = fill(line.text, app, extra);
            if (fast) { text.innerHTML = rich(full); return; }
            // a quick typewriter: whole words at a time, so markup never shows half-open
            const words = full.split(/(\s+)/);
            let k = 0;
            const t0 = performance.now();
            const tick = (now) => {
                const want = Math.floor((now - t0) / 22);
                if (want > k) { k = want; text.innerHTML = rich(words.slice(0, k).join('')); }
                if (k >= words.length) { typing = 0; text.innerHTML = rich(full); return; }
                typing = requestAnimationFrame(tick);
            };
            text.innerHTML = '';
            typing = requestAnimationFrame(tick);
        };

        const ask = (kind) => {
            waitAsk = true;
            next.hidden = true;
            who.textContent = '';
            const done = () => { waitAsk = false; app.after(); step(); };
            if (kind === 'name') text.innerHTML = '', extraBox.append(askName(app, done));
            else if (kind === 'sigil') text.innerHTML = '', extraBox.append(askSigil(app, done));
            else if (kind === 'calling') text.innerHTML = '', extraBox.append(askCalling(app, done));
        };

        const onKey = (e) => {
            if (waitAsk) return;
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
                if (e.target?.tagName === 'BUTTON' && e.target !== next) return;
                e.preventDefault();
                e.stopPropagation();
                step();
            }
        };
        document.addEventListener('keydown', onKey, true);
        next.addEventListener('click', step);
        skip.addEventListener('click', () => {
            // skipping never skips a question
            showAll();
            while (i + 1 < lines.length && !lines[i + 1].ask) i++;
            step();
        });
        playing = { finish };
        step();
        next.focus({ preventScroll: true });
    });
}

function askName(app, done) {
    const input = h('input', { type: 'text', id: 'ask-name', maxlength: 40, placeholder: 'Your pen name', value: app.S.player.name || '', autocomplete: 'off', 'aria-label': 'Your pen name' });
    const go = () => {
        const v = input.value.trim();
        if (!v) { input.focus(); input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400); return; }
        A.setIdentity(app.S, { name: v }, app.ctx());
        done();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    setTimeout(() => input.focus(), 30);
    return h('div', { class: 'ask' }, h('p', { class: 'ask-q' }, 'Write your pen name, the name for the spines of your books.'), input, h('button', { class: 'btn primary', id: 'ask-name-ok', onclick: go }, 'That is my name'));
}

/** The sigil designer; also used by the Sheet. onDone(sigil). */
export function sigilDesigner(start, onChange) {
    const sg = { ...start };
    const prev = h('div', { class: 'sigil-preview' });
    const paint = () => { prev.innerHTML = sigilSvg(sg, { label: 'Your sigil' }); onChange?.(sg); };
    const row = (label, items, key, render) => h('div', { class: 'sig-row' }, h('span', { class: 'lbl' }, label),
        h('div', { class: 'sig-opts', role: 'radiogroup', 'aria-label': label }, items.map((v) => {
            const b = h('button', { class: `sig-opt${sg[key] === v ? ' on' : ''}`, role: 'radio', 'aria-checked': String(sg[key] === v), 'aria-label': `${label}: ${CHARGE_NAMES[v] || v}`, dataset: { v } });
            b.innerHTML = render(v);
            b.addEventListener('click', () => {
                sg[key] = v;
                for (const o of b.parentNode.children) { o.classList.toggle('on', o === b); o.setAttribute('aria-checked', String(o === b)); }
                paint();
            });
            return b;
        })));
    const box = h('div', { class: 'sigil-designer' }, prev, h('div', { class: 'sig-rows' },
        row('Shape', SIGIL_SHAPES, 'shape', (v) => sigilSvg({ ...sg, shape: v, charge: 'star' }, { label: v })),
        row('Charge', Object.keys(CHARGES), 'charge', (v) => sigilSvg({ shape: 'round', field: '#2a2533', tincture: '#e8c565', charge: v }, { label: v })),
        row('Field', SIGIL_FIELDS, 'field', (v) => `<span class="swatch" style="background:${v}"></span>`),
        row('Metal', SIGIL_TINCTURES, 'tincture', (v) => `<span class="swatch" style="background:${v}"></span>`)));
    paint();
    box.value = () => sg;
    return box;
}

function askSigil(app, done) {
    const d = sigilDesigner(app.S.player.sigil);
    return h('div', { class: 'ask' }, h('p', { class: 'ask-q' }, 'Choose your sigil: a shield, a charge and two colours.'), d,
        h('button', { class: 'btn primary', id: 'ask-sigil-ok', onclick: () => { A.setIdentity(app.S, { sigil: d.value() }, app.ctx()); done(); } }, 'Seal it'));
}

function askCalling(app, done) {
    return h('div', { class: 'ask' }, h('p', { class: 'ask-q' }, 'Which part of the craft calls to you first?'),
        h('div', { class: 'callings' }, CALLINGS.map((c) => h('button', {
            class: 'calling', dataset: { calling: c.id },
            onclick: () => { A.setIdentity(app.S, { calling: c.id }, app.ctx()); done(); },
        }, h('strong', {}, c.title), h('span', {}, c.blurb), h('em', {}, c.perk)))));
}

// ------------------------------------------------------------------ the pop

let popTimer = 0;
// typing anywhere sends Thalion's aside away: it must never sit on the page you are writing on
document.addEventListener('keydown', (e) => {
    const t = e.target?.tagName;
    if ((t === 'TEXTAREA' || t === 'INPUT') && !document.getElementById('pop').hidden) document.getElementById('pop').hidden = true;
}, true);
document.addEventListener('input', (e) => {
    if (e.target?.tagName === 'TEXTAREA' && !document.getElementById('pop').hidden) document.getElementById('pop').hidden = true;
}, true);
export function pop(app, text, mood = 'smile', { ms = 7000 } = {}) {
    const root = $('pop');
    clearTimeout(popTimer);
    root.innerHTML = '';
    const close = () => { root.hidden = true; root.innerHTML = ''; };
    root.append(h('div', { class: 'pop-face', html: thalionSvg(mood) }), h('div', { class: 'pop-text', html: rich(fill(text, app)) }),
        h('button', { class: 'pop-x', 'aria-label': 'Dismiss', onclick: close }, '×'));
    root.hidden = false;
    popTimer = setTimeout(close, ms);
}
