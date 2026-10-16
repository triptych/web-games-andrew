// CART: the cartridge itself. Its title and label, the background, the camera, the built-in HUD,
// and the burner: save it as a file, load one, or export a standalone HTML game.

import { V, exportHTML, importCart } from '../runtime/index.js';
import { VERSION } from '../config.js';
import { el, spriteCanvas, download, slug } from './dom.js';

export class CartEditor {
    constructor(bench) { this.b = bench; }
    get cart() { return this.b.cart; }

    mount(root) {
        this.root = root;
        root.innerHTML = '';
        const c = this.cart;
        const set = (fn) => { this.b.snapshot(true); fn(); this.b.changed('cart'); };
        const text = (k, label, max) => el('input', { type: 'text', value: c[k], maxlength: max, 'aria-label': label, oninput: (e) => set(() => { c[k] = e.target.value; if (k === 'title') this.b.setTitle(c.title); }) });
        const grid = el('div', { class: 'formgrid' });
        const row = (label, ctl, hint) => grid.append(el('label', {}, label), el('div', { class: 'val' }, [ctl, hint ? el('span', { class: 'hint' }, hint) : null]));
        row('Title', text('title', 'Title', 24));
        row('Author', text('author', 'Author', 24));
        row('About', el('textarea', { rows: 2, maxlength: 400, style: { width: '100%', minHeight: '60px' }, 'aria-label': 'About', oninput: (e) => set(() => { c.desc = e.target.value; }) }, c.desc));
        const pal = this.b.paletteSize();
        const bg = el('div', { class: 'swatches' });
        for (let i = 0; i < 16; i++) bg.append(el('button', { class: 'swatch' + (i === c.bg ? ' on' : '') + (i >= pal ? ' locked' : ''), style: { background: V.PALETTE[i] }, 'aria-label': `Background colour ${i}`, onclick: () => { if (i >= pal) return; set(() => { c.bg = i; }); this.mount(root); } }));
        row('Background', bg);
        row('Label sprite', el('button', { class: 'btn small', onclick: () => this.b.objects.pickSprite((n) => { set(() => { c.label = n; }); this.mount(root); }) }, [spriteCanvas(c, c.label, 28), ' sprite ' + c.label]), 'shown on the cartridge');
        if (this.b.feature('bigmap') || c.camera.follow) {
            row('Camera follows', el('select', { 'aria-label': 'Camera follows', onchange: (e) => set(() => { c.camera.follow = e.target.value; }) }, [el('option', { value: '' }, '— nobody (fixed)'), ...c.types.map((T) => el('option', { value: T.name, selected: c.camera.follow === T.name }, T.name))]), 'for maps bigger than the screen');
        }
        row('Show score', el('input', { type: 'checkbox', checked: c.hud.score, onchange: (e) => set(() => { c.hud.score = e.target.checked; }) }), 'the global "score"');
        row('Show lives', el('input', { type: 'checkbox', checked: c.hud.lives, onchange: (e) => set(() => { c.hud.lives = e.target.checked; }) }), 'hearts for "lives"');
        row('Starting lives', el('input', { type: 'number', min: 0, max: 99, value: c.start.lives, style: { width: '80px' }, onchange: (e) => set(() => { c.start.lives = Math.max(0, Math.min(99, e.target.value | 0)); }) }));

        const studio = this.b.mode === 'studio';
        const exportOk = this.b.feature('export');
        const fileIn = el('input', { type: 'file', accept: '.json,.html,.htm', hidden: true, onchange: (e) => this.load(e.target.files[0]) });
        root.append(el('div', { class: 'ed' }, [
            el('div', { class: 'ed-col', style: { flex: '1 1 360px' } }, [el('div', { class: 'panel' }, [el('h4', {}, 'Cartridge'), grid])]),
            el('div', { class: 'ed-col', style: { flex: '1 1 260px' } }, [
                el('div', { class: 'panel' }, [
                    el('h4', {}, 'The burner'),
                    el('div', { class: 'menu' }, [
                        el('button', { class: 'btn primary', disabled: !exportOk, onclick: () => this.export() }, exportOk ? '⤓ Export playable HTML' : '🔒 Export (after RALLY)'),
                        el('button', { class: 'btn', onclick: () => this.save() }, '💾 Save cart file (.vesta.json)'),
                        studio ? el('button', { class: 'btn', onclick: () => fileIn.click() }, '📂 Load a cart into this slot') : null,
                        el('button', { class: 'btn', onclick: () => this.b.copyToStudio() }, '✦ Copy to the Studio'),
                        !studio ? el('button', { class: 'btn danger', onclick: () => this.b.resetMission() }, '⟲ Restore the cartridge as found') : null,
                        fileIn,
                    ]),
                    el('p', { class: 'hint', style: { marginTop: '10px' } }, 'An exported game is one HTML file with the VESTA-8 inside it: it plays offline, on phones, from a USB stick or on itch.io. Cart files load back into the Studio; so do exported HTML files.'),
                ]),
                el('div', { class: 'panel' }, [el('h4', {}, 'Contents'), el('div', { class: 'hint' }, this.summary())]),
            ]),
        ]));
    }
    summary() {
        const c = this.cart;
        const spr = c.sprites.filter((s) => /[1-9a-f]/.test(s)).length;
        const tiles = c.levels.reduce((n, L) => n + [...L.tiles].filter((t) => t !== '.').length, 0);
        const lines = [c.script, ...c.types.map((t) => t.script)].reduce((n, s) => n + s.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--')).length, 0);
        return `${spr} sprites · ${c.levels.length} level${c.levels.length > 1 ? 's' : ''} · ${tiles} tiles · ${c.types.length} object types · ${lines} lines of script`;
    }
    save() {
        download(slug(this.cart.title) + '.vesta.json', JSON.stringify({ format: 'vesta-8 cart', version: VERSION, cart: this.cart }, null, 1));
        this.b.toast('Cart file saved.');
    }
    export() {
        const P = V.prepare(this.cart);
        if (P.errors.length) { const e = P.errors[0]; this.b.toast(`Fix the script error first: ${e.where} line ${e.line}.`); return; }
        download(slug(this.cart.title) + '.html', exportHTML(this.cart, { version: VERSION }), 'text/html');
        this.b.stat('exports', 1);
        this.b.toast('Burned! Open the HTML file anywhere to play.', true);
    }
    async load(file) {
        if (!file) return;
        const c = importCart(await file.text());
        if (!c) { this.b.toast('That file doesn\'t hold a VESTA-8 cart.'); return; }
        this.b.snapshot();
        this.b.replaceCart(c);
        this.b.toast(`Loaded “${c.title}”.`, true);
    }
}
