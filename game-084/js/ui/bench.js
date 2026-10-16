// The workbench: tabs for every tool, undo and redo, and VESTA's checklist for the cartridge on
// the bench. Editors change bench.cart in place and call changed(); the host saves and re-checks.

import { el, $ } from './dom.js';
import { SpriteEditor } from './sprite.js';
import { MapEditor } from './map.js';
import { ObjectEditor } from './objects.js';
import { CodeEditor } from './code.js';
import { SoundEditor, MusicEditor } from './sound.js';
import { CartEditor } from './cart.js';

const TABS = [
    ['sprites', 'Sprites', 'sprites'], ['map', 'Map', 'map'], ['objects', 'Objects', 'objects'], ['code', 'Code', 'code'],
    ['sound', 'Sound', 'sound'], ['music', 'Music', 'music'], ['cart', 'Cart', null],
];

export class Bench {
    constructor(host) {
        this.h = host;
        this.audio = host.audio;
        this.view = host.view;
        this.spr = 1;
        this.undoStack = [];
        this.redoStack = [];
        this.lastSnap = 0;
        this.editors = {
            sprites: new SpriteEditor(this), map: new MapEditor(this), objects: new ObjectEditor(this),
            code: new CodeEditor(this), sound: new SoundEditor(this), music: new MusicEditor(this), cart: new CartEditor(this),
        };
        this.objects = this.editors.objects;
        this.tab = 'sprites';
        $('bench-back').addEventListener('click', () => { this.audio.ui('close'); host.onBack(); });
        $('bench-play').addEventListener('click', () => { this.audio.ui('click'); host.onPlay(); });
        $('tasks-toggle').addEventListener('click', () => {
            const t = $('tasks');
            t.classList.toggle('collapsed');
            $('tasks-toggle').setAttribute('aria-expanded', t.classList.contains('collapsed') ? 'false' : 'true');
        });
        window.addEventListener('keydown', (e) => {
            if ($('bench').hidden || !(e.ctrlKey || e.metaKey)) return;
            const tag = e.target?.tagName;
            if (tag === 'TEXTAREA' || tag === 'INPUT') return;
            if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
            else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); this.redo(); }
        });
    }

    /** Put a cart on the bench. opts: { cart, mode: 'mission' | 'studio', mission, title }. */
    open(opts) {
        this.cart = opts.cart;
        this.mode = opts.mode;
        this.mission = opts.mission || null;
        this.undoStack = []; this.redoStack = [];
        this.spr = 1;
        $('bench-kind').textContent = this.mode === 'studio' ? 'STUDIO CARTRIDGE' : this.mission.final ? 'THE LAST CARTRIDGE' : `CARTRIDGE ${this.mission.n} · ${this.mission.year} · AFTER ${this.mission.after}`;
        this.setTitle(this.cart.title);
        $('bench').hidden = false;
        // start on the tab the first unfinished task needs
        const first = this.mission ? this.h.taskStates().map((s, i) => [s, this.mission.tasks[i]]).find(([s]) => !s.done) : null;
        const want = opts.tab || (first && first[1].tool) || this.tab;
        this.openTab(this.tabOk(want) ? want : 'sprites');
        this.renderTasks();
    }
    close() {
        this.current?.unmount?.();
        $('bench').hidden = true;
    }
    setTitle(t) { $('bench-title').textContent = t || 'UNTITLED'; }

    feature(f) { return this.h.feature(f); }
    paletteSize() { return this.h.paletteSize(); }
    tabOk(id) { const t = TABS.find((x) => x[0] === id); return t && (!t[2] || this.feature(t[2])); }

    renderTabs() {
        const nav = $('bench-tabs');
        nav.innerHTML = '';
        for (const [id, label, feat] of TABS) {
            const ok = !feat || this.feature(feat);
            nav.append(el('button', {
                class: (id === this.tab ? 'on' : '') + (ok ? '' : ' locked'), role: 'tab', 'aria-selected': id === this.tab ? 'true' : 'false', 'data-tab': id,
                onclick: () => {
                    if (!ok) { this.toast(`${label} comes back as you restore more cartridges.`); this.audio.ui('error'); return; }
                    this.audio.ui('tab');
                    this.openTab(id);
                },
            }, [label, ok ? null : el('span', { class: 'lk' }, '🔒')]));
        }
    }
    openTab(id, opts = {}) {
        if (!this.tabOk(id)) return;
        this.current?.unmount?.();
        this.tab = id;
        this.renderTabs();
        const main = $('bench-main');
        main.scrollTop = 0;
        const ed = this.editors[id];
        if (id === 'map' && opts.type) { ed.type = opts.type; ed.tool = 'place'; }
        this.current = ed;
        ed.mount(main);
    }
    openScript(name) { this.editors.code.which = name; this.openTab('code'); }
    openCodex(t) { this.h.openCodex(t); }

    // ------------------------------------------------------------------ undo
    /** Remember the cart before a change. coalesce: typing and sliders make one step per second. */
    snapshot(coalesce = false) {
        const now = performance.now();
        if (coalesce && now - this.lastSnap < 1000) return;
        this.lastSnap = coalesce ? now : 0;
        this.undoStack.push(JSON.stringify(this.cart));
        if (this.undoStack.length > 60) this.undoStack.shift();
        this.redoStack.length = 0;
    }
    undo(silent) {
        const s = this.undoStack.pop();
        if (!s) { if (!silent) this.toast('Nothing to undo.'); return; }
        if (!silent) this.redoStack.push(JSON.stringify(this.cart));
        this.restore(s);
    }
    redo() {
        const s = this.redoStack.pop();
        if (!s) { this.toast('Nothing to redo.'); return; }
        this.undoStack.push(JSON.stringify(this.cart));
        this.restore(s);
    }
    restore(s) {
        const c = JSON.parse(s);
        // keep the same object: the host holds a reference to it
        for (const k of Object.keys(this.cart)) delete this.cart[k];
        Object.assign(this.cart, c);
        this.setTitle(this.cart.title);
        this.lastSnap = 0;
        this.changed('undo');
        this.openTab(this.tab);
    }
    replaceCart(c) {
        for (const k of Object.keys(this.cart)) delete this.cart[k];
        Object.assign(this.cart, JSON.parse(JSON.stringify(c)));
        this.setTitle(this.cart.title);
        this.changed('load');
        this.openTab(this.tab);
    }

    changed(kind) {
        this.h.onChange(kind);
        clearTimeout(this.taskT);
        this.taskT = setTimeout(() => this.renderTasks(), 120);
    }
    stat(k, n) { this.h.stat(k, n); }
    toast(msg, good) { this.h.ui.toast(msg, good); }
    ask(title, body, buttons) { this.h.ui.ask(title, body, buttons); }
    closeAsk() { this.h.ui.closeAsk(); }
    copyToStudio() { this.h.onCopyToStudio(); }
    resetMission() {
        this.ask('Restore the cartridge as it was found?', 'Everything you changed on this cartridge is undone. Ticked tasks stay ticked only if they are still true.', [['Restore it', () => { this.snapshot(); this.h.onResetMission(); }, 'danger']]);
    }

    // ------------------------------------------------------------------ VESTA's checklist
    renderTasks() {
        const body = $('tasks-body');
        if (!body || $('bench').hidden) return;
        body.innerHTML = '';
        if (this.mode === 'studio') {
            $('tasks-count').textContent = 'VESTA · STUDIO';
            body.append(
                el('p', { class: 'tasks-note' }, 'No checklist here: this cartridge is yours. Some ideas:'),
                ...[
                    'Draw a hero in SPRITES, then give it a Control in OBJECTS.',
                    'Tick SOLID on a sprite and paint walls with it in MAP.',
                    'In CODE: on hit coin → destroy(other) and score += 1.',
                    'Call win() when the player has done it. Every game needs an ending.',
                    'CART → Export to share it as one HTML file.',
                ].map((t) => el('div', { class: 'task' }, el('div', { class: 't-text' }, [el('span', { class: 't-box' }, '✦'), el('span', {}, t)]))),
            );
            this.renderLog(body);
            return;
        }
        const states = this.h.taskStates();
        const done = states.filter((s) => s.done).length;
        $('tasks-count').textContent = `VESTA · ${done}/${states.length} repaired`;
        this.mission.tasks.forEach((t, i) => {
            const s = states[i];
            const hint = el('div', { class: 't-hint', hidden: true }, t.hint);
            const acts = el('div', { class: 't-acts', hidden: s.done });
            if (t.tool && this.tabOk(t.tool) && !s.done) acts.append(el('button', { class: 'btn small ghost', onclick: () => { this.audio.ui('tab'); this.openTab(t.tool); } }, 'Go to ' + t.tool));
            if (t.play && !s.done) acts.append(el('button', { class: 'btn small play', onclick: () => this.h.onPlay() }, '▶ Play'));
            if (t.fix && !s.done) acts.append(el('button', { class: 'btn small ghost', onclick: () => this.confirmRepair(t) }, '🔧 VESTA, repair it'));
            const box = el('div', { class: 'task' + (s.done ? ' done' : ''), 'data-task': t.id }, [
                el('div', { class: 't-text', style: { cursor: 'pointer' }, onclick: () => { hint.hidden = !hint.hidden; } }, [el('span', { class: 't-box' }, s.done ? '☑' : '☐'), el('span', {}, t.text)]),
                s.need && !s.done ? el('div', { class: 't-prog' }, `${s.have} / ${s.need}`) : null,
                hint, acts,
            ]);
            body.append(box);
        });
        body.append(el('p', { class: 'tasks-note' }, 'Tap a task for a hint.'));
        this.renderLog(body);
    }
    renderLog(body) {
        const log = this.h.lastLog?.() || [];
        if (log.length) body.append(el('div', { class: 'console' }, log.slice(-12).join('\n')));
    }
    confirmRepair(t) {
        this.ask('Ask VESTA to repair this?', 'VESTA will patch it from its memory banks. You can still do everything else yourself — but the Hands On commendation needs a cartridge you fixed alone.', [['Repair it', () => { this.snapshot(); this.h.onRepair(t.id); this.openTab(this.tab); }]]);
    }
}
