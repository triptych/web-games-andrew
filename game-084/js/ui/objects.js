// OBJECTS: kinds of thing in the game. Pick one and set how it looks, moves, falls and bounces.
// Its script lives in CODE.

import { V } from '../runtime/index.js';
import { el, spriteCanvas } from './dom.js';

const CONTROL_FEATURE = { platform: 'platform', grid: 'grid', maze: 'grid', chase: 'ai', homing: 'ai', patrol: 'ai', wander: 'ai' };

export class ObjectEditor {
    constructor(bench) { this.b = bench; this.sel = null; }
    get cart() { return this.b.cart; }
    get T() { return this.cart.types.find((t) => t.name === this.sel); }

    mount(root) {
        this.root = root;
        if (!this.T) this.sel = this.cart.types[0]?.name || null;
        root.innerHTML = '';
        this.list = el('div', { class: 'list' });
        this.form = el('div');
        root.append(el('div', { class: 'ed' }, [
            el('div', { class: 'ed-col', style: { minWidth: '180px', flex: '0 1 220px' } }, [
                el('div', { class: 'panel' }, [
                    el('h4', {}, 'Object types'), this.list,
                    el('div', { class: 'btnrow', style: { marginTop: '8px' } }, [
                        el('button', { class: 'btn small', onclick: () => this.add() }, '＋ New'),
                        el('button', { class: 'btn small', onclick: () => this.dup() }, 'Copy'),
                        el('button', { class: 'btn small danger', onclick: () => this.del() }, 'Delete'),
                    ]),
                ]),
            ]),
            el('div', { class: 'ed-col', style: { flex: '1 1 320px' } }, [this.form]),
        ]));
        this.refresh();
    }

    refresh() {
        this.list.innerHTML = '';
        for (const T of this.cart.types) {
            const placed = this.cart.levels.reduce((n, L) => n + L.objs.filter((o) => o.t === T.name).length, 0);
            this.list.append(el('button', { class: T.name === this.sel ? 'on' : '', onclick: () => { this.sel = T.name; this.b.audio.ui('tab'); this.refresh(); } }, [
                spriteCanvas(this.cart, T.frames[0] ?? T.spr, 32),
                el('span', {}, [T.name, el('br'), el('span', { class: 'hint' }, `${V.isPlayerControl(T.control) ? 'player · ' : ''}${placed} placed`)]),
            ]));
        }
        if (!this.cart.types.length) this.list.append(el('div', { class: 'hint' }, 'No objects yet. Make one with ＋ New.'));
        this.buildForm();
    }

    buildForm() {
        const T = this.T, f = this.form;
        f.innerHTML = '';
        if (!T) return;
        const set = (k, v, redraw) => { this.b.snapshot(true); T[k] = v; this.b.changed('objects'); if (redraw) this.refresh(); };
        const grid = el('div', { class: 'formgrid' });
        const row = (label, ctl, hint) => { grid.append(el('label', {}, label), el('div', { class: 'val' }, [ctl, hint ? el('span', { class: 'hint' }, hint) : null])); };
        const slider = (k, lo, hi, step, hint) => {
            const out = el('output', {}, T[k]);
            const inp = el('input', { type: 'range', min: lo, max: hi, step, value: T[k], 'aria-label': k, oninput: (e) => { out.textContent = e.target.value; }, onchange: (e) => set(k, +e.target.value) });
            row(k[0].toUpperCase() + k.slice(1), el('span', { class: 'val' }, [inp, out]), hint);
        };
        const check = (k, label, hint) => row(label, el('input', { type: 'checkbox', checked: !!T[k], 'aria-label': label, onchange: (e) => set(k, e.target.checked) }), hint);
        const select = (k, label, opts, hint) => {
            const s = el('select', { 'aria-label': label, onchange: (e) => set(k, e.target.value, true) }, opts.map(([v, t, dis]) => el('option', { value: v, selected: T[k] === v, disabled: dis && T[k] !== v }, t + (dis ? ' 🔒' : ''))));
            row(label, s, hint);
        };
        const name = el('input', { type: 'text', value: T.name, maxlength: 16, 'aria-label': 'Name', onchange: (e) => this.rename(e.target.value) });
        row('Name', name, 'used in scripts: "' + T.name + '"');
        // looks
        const sprBtn = el('button', { class: 'btn small', onclick: () => this.pickSprite((n) => set('spr', n, true)) }, [spriteCanvas(this.cart, T.spr, 28), ` sprite ${T.spr}`]);
        row('Sprite', sprBtn);
        if (this.b.feature('frames')) {
            const fr = el('span', { class: 'val' });
            T.frames.forEach((n, i) => fr.append(el('button', { class: 'chip', title: 'Remove this frame', onclick: () => { const a = T.frames.slice(); a.splice(i, 1); set('frames', a, true); } }, [spriteCanvas(this.cart, n, 20), ' ✖'])));
            if (T.frames.length < 8) fr.append(el('button', { class: 'chip', onclick: () => this.pickSprite((n) => set('frames', (T.frames.length ? T.frames : [T.spr]).concat(n), true)) }, '＋ frame'));
            row('Frames', fr, T.frames.length > 1 ? 'they take turns' : 'add two or more to animate');
            if (T.frames.length > 1) { slider('anim', 1, 30, 1, 'frames per picture'); check('animMove', 'Only while moving'); }
        }
        select('sw', 'Width', [1, 2, 3, 4].map((n) => [n, n + ' tile' + (n > 1 ? 's' : '')]));
        select('sh', 'Height', [1, 2, 3, 4].map((n) => [n, n + ' tile' + (n > 1 ? 's' : '')]));
        grid.querySelectorAll('select').forEach((s, i) => { if (i < 2) s.onchange = (e) => set(i ? 'sh' : 'sw', +e.target.value, true); });
        // movement
        select('control', 'Control', Object.entries(V.CONTROLS).map(([k, t]) => [k, t, CONTROL_FEATURE[k] && !this.b.feature(CONTROL_FEATURE[k])]));
        slider('speed', 0, 4, 0.1, 'pixels per frame');
        if (T.control === 'platform' || this.b.feature('platform')) slider('jump', 0, 6, 0.1, 'for run & jump');
        slider('gravity', 0, 0.5, 0.01, '0 floats');
        slider('bounce', 0, 1, 0.05, '1 bounces fully');
        check('walls', 'Stops at solid tiles');
        check('solid', 'Solid to others', 'things that stop at walls stop at it');
        select('edge', 'At the map edge', Object.entries(V.EDGES).map(([k, t]) => [k, t]));
        if (T.control === 'patrol') check('ledge', 'Turns at ledges');
        check('autoflip', 'Faces where it moves', 'flips the sprite left and right');
        slider('hp', 1, 20, 1, 'for hurt()');
        select('hitbox', 'Hitbox', [['snug', 'Snug: the drawn pixels'], ['full', 'Full tiles']]);
        const placed = this.cart.levels.reduce((n, L) => n + L.objs.filter((o) => o.t === T.name).length, 0);
        f.append(el('div', { class: 'panel' }, [
            el('h4', {}, T.name),
            grid,
            el('div', { class: 'btnrow', style: { marginTop: '10px' } }, [
                el('button', { class: 'btn small', onclick: () => this.b.openScript(T.name) }, '⌨ Edit its script'),
                el('button', { class: 'btn small', onclick: () => this.b.openTab('map', { type: T.name }) }, `◉ Place it (${placed} placed)`),
            ]),
        ]));
    }

    pickSprite(cb) {
        const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px' } });
        for (let n = 0; n < 64; n++) grid.append(el('button', { class: 'chip', style: { padding: '2px', minHeight: '40px', justifyContent: 'center' }, title: `Sprite ${n}`, onclick: () => { this.b.closeAsk(); cb(n); } }, spriteCanvas(this.cart, n, 30)));
        this.b.ask('Pick a sprite', grid, []);
    }

    uniqueName(base) {
        let n = base, i = 2;
        while (this.cart.types.some((t) => t.name === n)) n = base + i++;
        return n;
    }
    add() {
        if (this.cart.types.length >= 32) { this.b.toast('The VESTA-8 holds 32 object types.'); return; }
        this.b.snapshot();
        const T = { ...V.defaultType(this.uniqueName('thing')), spr: this.b.spr || 1 };
        this.cart.types.push(T);
        this.sel = T.name;
        this.b.changed('objects');
        this.refresh();
    }
    dup() {
        const T = this.T;
        if (!T || this.cart.types.length >= 32) return;
        this.b.snapshot();
        const C = { ...JSON.parse(JSON.stringify(T)), name: this.uniqueName(T.name) };
        this.cart.types.push(C);
        this.sel = C.name;
        this.b.changed('objects');
        this.refresh();
    }
    del() {
        const T = this.T;
        if (!T) return;
        this.b.ask(`Delete "${T.name}"?`, 'Every placed one goes too, and scripts that mention it will need changing.', [['Delete', () => {
            this.b.snapshot();
            this.cart.types = this.cart.types.filter((t) => t !== T);
            for (const L of this.cart.levels) L.objs = L.objs.filter((o) => o.t !== T.name);
            this.sel = this.cart.types[0]?.name || null;
            this.b.changed('objects');
            this.refresh();
        }, 'danger']]);
    }
    rename(v) {
        const T = this.T;
        const nm = String(v).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16);
        if (!nm || nm === T.name) { this.refresh(); return; }
        if (this.cart.types.some((t) => t.name === nm)) { this.b.toast(`There is already a "${nm}".`); this.refresh(); return; }
        this.b.snapshot();
        const old = T.name;
        T.name = nm;
        for (const L of this.cart.levels) for (const o of L.objs) if (o.t === old) o.t = nm;
        if (this.cart.camera.follow === old) this.cart.camera.follow = nm;
        this.sel = nm;
        this.b.changed('objects');
        this.b.toast(`Renamed. Scripts that say "${old}" need updating.`);
        this.refresh();
    }
}
