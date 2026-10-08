/**
 * ui.js — the overlay menu system: a stack of panels over the game (which pauses underneath),
 * one keyboard / gamepad / touch navigation model, shared widgets (lists, cards, tabs), and the
 * small panels: quick ring, wait, death, settings, credits, save/load, character creation.
 */
import { DIFFICULTY } from '../sim/rules.js';
import { KIN } from '../sim/stats.js';
import { QUALITY } from '../config.js';

const $ = (id) => document.getElementById(id);

/** Tiny element builder: h('div.cls#id', { on: { click }, text, html, style }, ...children) */
export function h(spec, attrs = {}, ...kids) {
    const m = /^([a-z0-9]+)?((?:\.[\w-]+)*)(#[\w-]+)?$/.exec(spec) || [];
    const e = document.createElement(m[1] || 'div');
    if (m[2]) e.className = m[2].slice(1).replace(/\./g, ' ');
    if (m[3]) e.id = m[3].slice(1);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null) continue;
        if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'style') Object.assign(e.style, v);
        else if (k === 'cls') e.className += ` ${v}`;
        else e.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    return e;
}
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const KEY_ACTIONS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Enter: 'ok', KeyE: 'ok', Space: 'ok', NumpadEnter: 'ok', Escape: 'back', Tab: 'back', Backspace: 'back',
    KeyR: 'alt', KeyF: 'fav', KeyQ: 'prevTab', KeyT: 'take', KeyX: 'alt2', KeyZ: 'prevTab', KeyC: 'nextTab', PageUp: 'pgup', PageDown: 'pgdn',
    KeyI: 'inventory', KeyM: 'map', KeyJ: 'journal', KeyP: 'magic', KeyK: 'skills',
};
const PAD_ACTIONS = { padUp: 'up', padDown: 'down', padLeft: 'left', padRight: 'right', jump: 'ok', sneak: 'back', use: 'alt', ready: 'take', favorites: 'prevTab', sigil: 'nextTab', pause: 'back', map: 'back' };

// ------------------------------------------------------------------ list widget
/** A scrolling selectable list. rows: [{ key, label, value, cls, head, data }] */
export class ListView {
    constructor({ onSelect, onActivate, onAlt } = {}) {
        this.el = h('div.list.scroll');
        this.rows = []; this.sel = 0; this.onSelect = onSelect; this.onActivate = onActivate; this.onAlt = onAlt;
    }
    set(rows, keepKey = null) {
        const key = keepKey ?? this.rows[this.sel]?.key;
        this.rows = rows;
        this.el.innerHTML = '';
        rows.forEach((r, i) => {
            const e = h('div.li', { cls: (r.head ? 'head ' : '') + (r.cls || '') });
            if (!r.head) {
                e.appendChild(h('span.eq', { text: r.mark || '' }));
                e.appendChild(h('span.n', { text: r.label }));
                if (r.value != null) e.appendChild(h('span.v', { text: String(r.value) }));
                e.addEventListener('click', () => { if (this.sel === i) this.onActivate?.(r); else this.select(i); });
                e.addEventListener('dblclick', () => this.onActivate?.(r));
                e.addEventListener('contextmenu', (ev) => { ev.preventDefault(); this.select(i); this.onAlt?.(r); });
            } else e.textContent = r.label;
            r._el = e;
            this.el.appendChild(e);
        });
        let idx = rows.findIndex((r) => r.key === key && !r.head);
        if (idx < 0) idx = Math.min(this.sel, rows.length - 1);
        if (rows[idx]?.head) idx = rows.findIndex((r, j) => j > idx && !r.head);
        if (idx < 0) idx = rows.findIndex((r) => !r.head);
        this.select(Math.max(0, idx), true);
    }
    select(i, quiet = false) {
        if (!this.rows.length) { this.onSelect?.(null); return; }
        this.rows[this.sel]?._el?.classList.remove('sel');
        this.sel = Math.max(0, Math.min(this.rows.length - 1, i));
        const r = this.rows[this.sel];
        r._el?.classList.add('sel');
        r._el?.scrollIntoView({ block: 'nearest' });
        this.onSelect?.(r.head ? null : r);
        void quiet;
    }
    move(d) {
        if (!this.rows.length) return;
        let i = this.sel;
        for (let k = 0; k < this.rows.length; k++) { i = (i + d + this.rows.length) % this.rows.length; if (!this.rows[i].head) break; }
        this.select(i);
    }
    get current() { return this.rows[this.sel]?.head ? null : this.rows[this.sel]; }
}

/** Base panel: an overlay element with an action handler. */
export class Panel {
    constructor(ui, cls = '', overlayCls = '') {
        this.ui = ui; this.app = ui.app;
        this.el = h('div.overlay', { cls: overlayCls });
        this.box = h(`div.panel.menu`, { cls: cls });
        this.el.appendChild(this.box);
        // A touch button opens menus on finger-down; lifting that finger then "clicks" whatever is now
        // under it (the backdrop, which closes the menu, or a button). Only accept clicks whose press
        // began on this panel. Keyboard-made clicks have no pointer type and always count. (A touch's
        // stray click can report detail 0 like a keyboard one, so check the pointer type.)
        this.armed = false;
        this.el.addEventListener('pointerdown', () => { this.armed = true; }, true);
        this.el.addEventListener('click', (e) => { if (!this.armed && (e.pointerType || e.detail > 0)) { e.stopPropagation(); e.preventDefault(); } }, true);
        this.el.addEventListener('click', (e) => { if (e.target === this.el && this.closeOnBackdrop !== false) this.ui.pop(); });
    }
    title(text, extra = null) {
        const t = h('div.ptitle', {}, h('span', { text }), h('span.sp'), extra, h('button.xbtn', { text: '✕', 'aria-label': 'Close', on: { click: () => this.ui.pop() } }));
        this.box.appendChild(t);
        return t;
    }
    action() { return false; }
    update() {}
    onOpen() {}
    onClose() {}
}

// ------------------------------------------------------------------ the manager
export class UI {
    constructor(app) {
        this.app = app;
        this.root = $('ui');
        this.stack = [];
        this.panels = {};   // registered constructors: name → (ui, ...args) => Panel
        app.input.onKey((e) => this.key(e));
    }
    get open() { return this.stack.length > 0; }
    get top() { return this.stack[this.stack.length - 1]; }
    register(name, fn) { this.panels[name] = fn; }
    show(name, ...args) { const f = this.panels[name]; if (!f) { console.warn('no panel', name); return null; } return this.push(f(this, ...args)); }
    push(panel) {
        if (!this.open) this.app.setPaused(true, panel.keepRunning);
        this.root.appendChild(panel.el);
        this.stack.push(panel);
        this.app.input.exitLock();
        panel.onOpen();
        this.app.audio?.ui('open');
        return panel;
    }
    pop() {
        const p = this.stack.pop();
        if (!p) return;
        p.el.remove();
        p.onClose();
        this.app.audio?.ui('close');
        if (!this.open) this.app.setPaused(false);
    }
    replace(name, ...args) { const p = this.stack.pop(); if (p) { p.el.remove(); p.onClose(); } return this.show(name, ...args); }
    closeAll() { while (this.stack.length) this.pop(); }
    key(e) {
        if (!this.open) return false;
        if (e.target instanceof HTMLInputElement && e.target.type === 'text' && !['Escape', 'Enter'].includes(e.code)) return false;
        const a = KEY_ACTIONS[e.code];
        if (!a) return true;   // swallow game keys while a menu is up
        if (e.repeat && !['up', 'down', 'left', 'right'].includes(a)) return true;
        this.dispatch(a);
        return true;
    }
    dispatch(a) {
        const top = this.top;
        if (!top) return;
        if (top.action(a)) return;
        if (a === 'back') this.pop();
        else if (['inventory', 'map', 'journal', 'magic', 'skills'].includes(a) && !top.modal) { this.closeAll(); this.app.openMenu(a); }
    }
    /** Called every frame with the input snapshot (gamepad navigation). */
    update(dt, snap) {
        if (!this.open) return;
        for (const k of snap.pressed) { const a = PAD_ACTIONS[k]; if (a && snap.device === 'pad') this.dispatch(a); }
        this.top?.update(dt);
    }
    toast(text) {
        const t = h('div.toast', { text });
        $('toasts').appendChild(t);
        setTimeout(() => t.remove(), 2900);
    }
}

// ------------------------------------------------------------------ quick ring (Tab)
export class RingPanel extends Panel {
    constructor(ui) {
        super(ui, '', 'clear');
        this.box.className = 'ring';
        const b = (cls, text, menu) => h(`button.${cls}`, { text, on: { click: () => { ui.pop(); ui.app.openMenu(menu); } } });
        this.btns = { up: b('up', 'Skills', 'skills'), left: b('left', 'Magic', 'magic'), right: b('right', 'Items', 'inventory'), down: b('down', 'Map', 'map') };
        this.box.append(...Object.values(this.btns), h('button.center', { text: 'Journal', on: { click: () => { ui.pop(); ui.app.openMenu('journal'); } } }));
    }
    action(a) {
        if (this.btns[a]) { this.btns[a].click(); return true; }
        if (a === 'ok') { this.ui.pop(); this.app.openMenu('journal'); return true; }
        return false;
    }
}

// ------------------------------------------------------------------ wait / sleep
export class WaitPanel extends Panel {
    constructor(ui, sleep = false) {
        super(ui, 'small');
        this.sleep = sleep;
        this.hours = sleep ? 8 : 1;
        this.title(sleep ? 'Sleep' : 'Wait');
        const w = ui.app.world;
        this.info = h('p.dim', { style: { padding: '14px 18px 0' } });
        this.val = h('b', { style: { fontSize: '34px', fontFamily: 'var(--display)' } });
        const range = h('input', { type: 'range', min: 1, max: 24, value: this.hours });
        range.addEventListener('input', () => { this.hours = +range.value; this.render(); });
        this.range = range;
        this.box.append(this.info, h('div.form', {}, h('div', { style: { textAlign: 'center' } }, this.val), range),
            h('div.foot', {}, h('span.sp'), h('button.mbtn', { text: 'Cancel', on: { click: () => ui.pop() } }), h('button.mbtn.gold', { text: sleep ? 'Sleep' : 'Wait', on: { click: () => this.go() } })));
        this.w = w;
        this.render();
    }
    render() {
        const t = this.w.time;
        const hr = Math.floor(t.hour), mn = Math.floor((t.hour % 1) * 60);
        this.info.textContent = `It is ${hr}:${String(mn).padStart(2, '0')}, day ${t.day + 1}.`;
        this.val.textContent = `${this.hours} hour${this.hours > 1 ? 's' : ''}`;
        this.range.value = this.hours;
    }
    action(a) {
        if (a === 'left' || a === 'down') { this.hours = Math.max(1, this.hours - 1); this.render(); return true; }
        if (a === 'right' || a === 'up') { this.hours = Math.min(24, this.hours + 1); this.render(); return true; }
        if (a === 'ok') { this.go(); return true; }
        return false;
    }
    go() {
        const app = this.app;
        if (app.world.player.ai?.target || app.inCombat) { this.ui.toast('You cannot rest with enemies nearby.'); return; }
        this.ui.pop();
        app.fade(() => { app.world.wait(this.hours, this.sleep); app.afterWait?.(); });
    }
}

// ------------------------------------------------------------------ death
export class DeathPanel extends Panel {
    constructor(ui) {
        super(ui, '');
        this.modal = true; this.closeOnBackdrop = false;
        this.box.className = 'death';
        this.box.append(h('h1', { text: 'You have fallen' }), h('p.dim', { text: 'The storm-scar dims. But the Frostmarch is not finished with you.' }),
            h('div.row', { style: { justifyContent: 'center' } },
                h('button.mbtn.gold', { text: 'Load last save', on: { click: () => { ui.closeAll(); ui.app.loadLatest(); } } }),
                h('button.mbtn', { text: 'Load…', on: { click: () => ui.show('saves', 'load') } }),
                h('button.mbtn', { text: 'Title screen', on: { click: () => { ui.closeAll(); ui.app.toTitle(); } } })));
    }
    action(a) { if (a === 'ok') { this.ui.closeAll(); this.app.loadLatest(); return true; } return a === 'back'; }
}

// ------------------------------------------------------------------ settings
export class SettingsPanel extends Panel {
    constructor(ui) {
        super(ui, 'medium');
        this.title('Settings');
        const s = ui.app.settings;
        const form = h('div.form.scroll', { style: { flex: '1' } });
        const slider = (label, key, min, max, step, fmt = (v) => Math.round(v * 100) + '%') => {
            const out = h('span.dim', { style: { width: '54px', textAlign: 'right' }, text: fmt(s[key]) });
            const r = h('input', { type: 'range', min, max, step, value: s[key] });
            r.addEventListener('input', () => { s[key] = +r.value; out.textContent = fmt(s[key]); ui.app.applySettings(); });
            form.appendChild(h('label', {}, h('span', { text: label }), r, out));
        };
        const chips = (label, key, opts) => {
            const box = h('div.chips');
            for (const [v, t] of opts) {
                const c = h('button.chip', { text: t, cls: s[key] === v ? 'on' : '', on: { click: () => { s[key] = v; [...box.children].forEach((x) => x.classList.remove('on')); c.classList.add('on'); ui.app.applySettings(); } } });
                box.appendChild(c);
            }
            form.appendChild(h('label', {}, h('span', { text: label }), box));
        };
        form.appendChild(h('div.li.head', { text: 'Sound' }));
        slider('Master', 'master', 0, 1, 0.01); slider('Music', 'music', 0, 1, 0.01); slider('Effects', 'sfx', 0, 1, 0.01); slider('Ambience', 'ambience', 0, 1, 0.01);
        form.appendChild(h('div.li.head', { text: 'Graphics' }));
        chips('Quality', 'quality', [[null, 'Auto'], ...QUALITY.map((q, i) => [i, q.name])]);
        slider('Field of view', 'fov', 55, 95, 1, (v) => `${Math.round(v)}°`);
        form.appendChild(h('div.li.head', { text: 'Controls' }));
        slider('Look speed', 'sensitivity', 0.3, 2.5, 0.05, (v) => v.toFixed(2));
        chips('Invert look', 'invertY', [[false, 'Off'], [true, 'On']]);
        chips('Aim assist', 'aimAssist', [[true, 'On'], [false, 'Off']]);
        form.appendChild(h('div.li.head', { text: 'Game' }));
        chips('Difficulty', 'difficulty', Object.entries(DIFFICULTY).map(([k, v]) => [k, v.name]));
        chips('Subtitles', 'subtitles', [[true, 'On'], [false, 'Off']]);
        chips('Camera', 'thirdPerson', [[null, 'Auto'], [false, 'First person'], [true, 'Third person']]);
        this.box.append(form, h('div.foot', {}, h('span.hint2', { text: 'Settings are saved on this device.' }), h('span.sp'), h('button.mbtn.gold', { text: 'Done', on: { click: () => ui.pop() } })));
    }
    onClose() { this.app.saveSettings(); }
}

export class CreditsPanel extends Panel {
    constructor(ui) {
        super(ui, 'small');
        this.title('Credits');
        this.box.appendChild(h('div.form', {},
            h('p', { html: '<b>FROSTMARCH — Saga of the Stormsworn</b>' }),
            h('p.dim', { text: 'An original open-world fantasy RPG. Every mesh, texture, sound and note is generated in code; no asset files.' }),
            h('p.dim', { text: 'Built with three.js. Designed and written with Claude Code.' }),
            h('p.faint', { text: 'Thank you for playing.' })));
    }
}

// ------------------------------------------------------------------ save / load slots
export class SavesPanel extends Panel {
    constructor(ui, mode = 'load') {
        super(ui, 'medium');
        this.mode = mode;
        this.title(mode === 'save' ? 'Save Game' : 'Load Game');
        this.list = new ListView({ onSelect: (r) => this.show(r), onActivate: (r) => this.go(r) });
        this.info = h('div.detail');
        this.box.append(h('div.split', {}, this.list.el, this.info), h('div.foot', {}, h('span.hint2', { text: mode === 'save' ? 'Enter: save · R: delete' : 'Enter: load · R: delete' }), h('span.sp'), h('button.mbtn', { text: 'Delete', on: { click: () => this.del() } }), h('button.mbtn.gold', { text: mode === 'save' ? 'Save' : 'Load', on: { click: () => this.go(this.list.current) } })));
        this.refresh();
    }
    refresh() {
        const slots = this.app.saves.list();
        const rows = [];
        if (this.mode === 'save') rows.push({ key: 'new', label: '+ New save', data: null });
        for (const s of slots) rows.push({ key: s.slot, label: `${s.meta.name} · Level ${s.meta.level}`, value: s.meta.when, data: s });
        if (!rows.length) rows.push({ key: 'none', label: 'No saved games', cls: 'dim' });
        this.list.set(rows);
    }
    show(r) {
        this.info.innerHTML = '';
        if (!r?.data) { this.info.appendChild(h('p.dim', { text: r?.key === 'new' ? 'Write a new save slot.' : '' })); return; }
        const m = r.data.meta;
        this.info.append(h('div.card', {}, h('h3', { text: m.name }), h('p', { text: `Level ${m.level} ${m.kin || ''}` }), h('p.dim', { text: `${m.place || ''}` }), h('p.faint', { text: `${m.when} · ${m.kind === 'auto' ? 'Autosave' : m.kind === 'quick' ? 'Quicksave' : 'Save'}` })));
    }
    go(r) {
        if (!r) return;
        if (this.mode === 'save') { this.app.saves.save(r.data?.slot || null, 'manual'); this.ui.toast('Game saved.'); this.refresh(); }
        else if (r.data) { this.ui.closeAll(); this.app.loadSlot(r.data.slot); }
    }
    del() { const r = this.list.current; if (r?.data) { this.app.saves.remove(r.data.slot); this.refresh(); } }
    action(a) {
        if (a === 'up') { this.list.move(-1); return true; }
        if (a === 'down') { this.list.move(1); return true; }
        if (a === 'ok') { this.go(this.list.current); return true; }
        if (a === 'alt') { this.del(); return true; }
        return false;
    }
}

// ------------------------------------------------------------------ character creation
export class CharGenPanel extends Panel {
    constructor(ui, onDone) {
        super(ui, '', 'clear');
        this.modal = true; this.closeOnBackdrop = false; this.keepRunning = true;
        this.box.className = 'panel chargen';
        const app = ui.app, p = app.world.player;
        this.look = { ...p.look, sex: p.look.sex || 'm', kin: p.sheet.kin };
        this.name = 'Courier';
        const form = h('div.form.scroll', { style: { flex: '1' } });
        const nameIn = h('input', { type: 'text', value: this.name, maxlength: 24 });
        nameIn.addEventListener('input', () => { this.name = nameIn.value || 'Courier'; });
        form.appendChild(h('label', {}, h('span', { text: 'Name' }), nameIn));
        const chips = (label, key, opts, cb) => {
            const box = h('div.chips');
            for (const [v, t] of opts) {
                const c = h('button.chip', { text: t, cls: this.look[key] === v ? 'on' : '', on: { click: () => { this.look[key] = v; [...box.children].forEach((x) => x.classList.remove('on')); c.classList.add('on'); cb?.(v); this.apply(); } } });
                box.appendChild(c);
            }
            form.appendChild(h('label', {}, h('span', { text: label }), box));
        };
        this.kinDesc = h('p.dim', { style: { fontSize: '14px', lineHeight: '1.4' } });
        chips('Kin', 'kin', Object.entries(KIN).map(([k, v]) => [k, v.name]), () => this.describe());
        form.appendChild(this.kinDesc);
        chips('Body', 'sex', [['m', 'Frame A'], ['f', 'Frame B']]);
        chips('Build', 'build', [[0.92, 'Lean'], [1, 'Average'], [1.1, 'Broad']]);
        chips('Hair', 'hair', [[0, 'Cropped'], [1, 'Short'], [2, 'Long'], [3, 'Bun'], [4, 'Braids'], [5, 'Tail'], [6, 'Shaven']]);
        chips('Hair colour', 'hairCol', [[0x1a1414, 'Black'], [0x3a2a1a, 'Dark'], [0x6a4a2a, 'Brown'], [0xa08050, 'Fair'], [0xc8a870, 'Flaxen'], [0x8a3a1a, 'Red'], [0x9a9690, 'Grey']]);
        chips('Beard', 'beard', [[0, 'None'], [1, 'Stubble'], [2, 'Short'], [3, 'Full'], [4, 'Braided']]);
        chips('Age', 'age', [[0.1, 'Young'], [0.4, 'Grown'], [0.8, 'Elder']]);
        this.box.append(h('div.ptitle', {}, h('span', { text: 'Who are you?' })), form,
            h('div.foot', {}, h('span.hint2', { text: 'Drag to turn the camera.' }), h('span.sp'), h('button.mbtn.gold', { text: 'Begin', on: { click: () => { ui.pop(); onDone({ name: this.name, look: this.look }); } } })));
        this.describe();
        this.apply();
    }
    describe() { const k = KIN[this.look.kin]; this.kinDesc.textContent = k.desc; }
    apply() { this.app.previewLook(this.look); }
    action(a) { return a === 'back'; }
}
