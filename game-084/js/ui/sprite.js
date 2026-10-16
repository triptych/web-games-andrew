// SPRITES: the pixel editor. An 8 × 8 canvas, a palette (as many colours as the DAC has
// recovered), tools, tile flags and the 64-slot sheet.

import { V } from '../runtime/index.js';
import { el, paintSprite } from './dom.js';

const TOOLS = [
    ['pen', '✏', 'Pencil'], ['erase', '⌫', 'Eraser'], ['fill', '▧', 'Fill'], ['pick', '⊙', 'Pick colour'],
];

export class SpriteEditor {
    constructor(bench) {
        this.b = bench;
        this.tool = 'pen';
        this.color = 3;
        this.clip = null;
    }

    get cart() { return this.b.cart; }
    get n() { return this.b.spr; }

    mount(root) {
        this.root = root;
        root.innerHTML = '';
        const size = Math.max(200, Math.min(336, (root.clientWidth || 360) - 24));
        this.cv = el('canvas', { width: 8 * 32, height: 8 * 32, class: 'px', style: { width: size + 'px', height: size + 'px', cursor: 'crosshair' }, 'aria-label': 'Sprite canvas' });
        this.cv.addEventListener('contextmenu', (e) => e.preventDefault());
        this.bindDraw();
        this.label = el('div', { class: 'hint' });
        const tools = el('div', { class: 'toolbar' }, [
            ...TOOLS.map(([id, ic, name]) => el('button', { class: 'tool', 'data-tool': id, title: name, 'aria-label': name, onclick: () => { this.tool = id; this.refresh(); } }, ic)),
            el('button', { class: 'tool', title: 'Flip left-right', 'aria-label': 'Flip left-right', onclick: () => this.transform((x, y) => [7 - x, y]) }, '⇋'),
            el('button', { class: 'tool', title: 'Flip up-down', 'aria-label': 'Flip up-down', onclick: () => this.transform((x, y) => [x, 7 - y]) }, '⇵'),
            el('button', { class: 'tool', title: 'Rotate', 'aria-label': 'Rotate', onclick: () => this.transform((x, y) => [y, 7 - x]) }, '↻'),
            el('button', { class: 'tool', title: 'Shift left', 'aria-label': 'Shift left', onclick: () => this.transform((x, y) => [(x + 1) % 8, y]) }, '←'),
            el('button', { class: 'tool', title: 'Shift up', 'aria-label': 'Shift up', onclick: () => this.transform((x, y) => [x, (y + 1) % 8]) }, '↑'),
        ]);
        const tools2 = el('div', { class: 'toolbar' }, [
            el('button', { class: 'tool', onclick: () => { this.clip = this.cart.sprites[this.n]; this.b.toast('Sprite copied.'); } }, el('small', {}, 'Copy')),
            el('button', { class: 'tool', onclick: () => { if (this.clip) this.setSprite(this.clip); } }, el('small', {}, 'Paste')),
            el('button', { class: 'tool', onclick: () => this.setSprite('0'.repeat(64)) }, el('small', {}, 'Clear')),
            el('button', { class: 'tool', onclick: () => this.b.undo(), 'aria-label': 'Undo' }, el('small', {}, 'Undo')),
            el('button', { class: 'tool', onclick: () => this.b.redo(), 'aria-label': 'Redo' }, el('small', {}, 'Redo')),
        ]);
        this.swatches = el('div', { class: 'swatches' });
        this.flags = el('div', { class: 'flagrow' });
        this.sheet = el('canvas', { width: 64, height: 64, class: 'px', style: { width: '256px', height: '256px', cursor: 'pointer' }, 'aria-label': 'Sprite sheet' });
        this.sheet.addEventListener('click', (e) => {
            const r = this.sheet.getBoundingClientRect();
            const x = Math.floor(((e.clientX - r.left) / r.width) * 8), y = Math.floor(((e.clientY - r.top) / r.height) * 8);
            this.b.spr = Math.max(0, Math.min(63, y * 8 + x));
            this.b.audio.ui('tab');
            this.refresh();
        });
        this.preview = el('canvas', { width: 24, height: 24, class: 'px', style: { width: '96px', height: '96px' } });
        this.uses = el('div', { class: 'hint' });
        root.append(el('div', { class: 'ed' }, [
            el('div', { class: 'ed-col' }, [
                el('div', { class: 'panel' }, [el('h4', {}, 'Sprite'), this.label, this.cv, tools, tools2]),
            ]),
            el('div', { class: 'ed-col' }, [
                el('div', { class: 'panel' }, [el('h4', {}, 'Palette'), this.swatches]),
                el('div', { class: 'panel' }, [el('h4', {}, 'Tile flags'), this.flags, el('div', { class: 'hint', style: { marginTop: '6px' } }, 'Flags decide what this sprite does when you paint it on the map.')]),
                el('div', { class: 'panel' }, [el('h4', {}, 'Sheet · tap a slot'), this.sheet]),
                el('div', { class: 'panel' }, [el('h4', {}, 'Tiled preview'), this.preview, this.uses]),
            ]),
        ]));
        this.refresh();
    }

    bindDraw() {
        let drawing = false, last = null;
        const cell = (e) => {
            const r = this.cv.getBoundingClientRect();
            return [Math.floor(((e.clientX - r.left) / r.width) * 8), Math.floor(((e.clientY - r.top) / r.height) * 8)];
        };
        this.cv.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const [x, y] = cell(e);
            if (x < 0 || y < 0 || x > 7 || y > 7) return;
            const tool = e.button === 2 ? 'erase' : this.tool;
            if (tool === 'pick') { this.color = this.get(x, y); this.tool = 'pen'; this.refresh(); return; }
            this.b.snapshot();
            if (tool === 'fill') { this.fill(x, y); return; }
            drawing = tool;
            last = [x, y];
            this.plot(x, y, drawing);
            try { this.cv.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        });
        this.cv.addEventListener('pointermove', (e) => {
            if (!drawing) return;
            const [x, y] = cell(e);
            // join the dots so a fast stroke has no gaps
            let [x0, y0] = last;
            const dx = Math.abs(x - x0), dy = -Math.abs(y - y0), sx = x0 < x ? 1 : -1, sy = y0 < y ? 1 : -1;
            let err = dx + dy;
            for (let i = 0; i < 32; i++) {
                if (x0 >= 0 && y0 >= 0 && x0 < 8 && y0 < 8) this.plot(x0, y0, drawing);
                if (x0 === x && y0 === y) break;
                const e2 = 2 * err;
                if (e2 >= dy) { err += dy; x0 += sx; }
                if (e2 <= dx) { err += dx; y0 += sy; }
            }
            last = [x, y];
        });
        const end = () => { if (drawing) { drawing = false; this.b.changed('sprite'); } };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) this.cv.addEventListener(ev, end);
    }

    get(x, y) { return parseInt(this.cart.sprites[this.n][y * 8 + x], 16) || 0; }
    plot(x, y, tool) {
        const c = tool === 'erase' ? 0 : this.color;
        if (this.get(x, y) === c) return;
        const s = this.cart.sprites[this.n];
        const i = y * 8 + x;
        this.cart.sprites[this.n] = s.slice(0, i) + c.toString(16) + s.slice(i + 1);
        if (c) this.b.stat('pixels', 1);
        this.b.audio.ui('pix');
        this.refresh(true);
    }
    fill(x, y) {
        const from = this.get(x, y), to = this.color;
        if (from === to) return;
        const a = [...this.cart.sprites[this.n]];
        const st = [[x, y]];
        let n = 0;
        while (st.length) {
            const [cx, cy] = st.pop();
            if (cx < 0 || cy < 0 || cx > 7 || cy > 7 || (parseInt(a[cy * 8 + cx], 16) || 0) !== from) continue;
            a[cy * 8 + cx] = to.toString(16);
            n++;
            st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
        this.cart.sprites[this.n] = a.join('');
        if (to) this.b.stat('pixels', n);
        this.b.changed('sprite');
        this.refresh();
    }
    transform(f) {
        this.b.snapshot();
        const src = this.cart.sprites[this.n], out = new Array(64).fill('0');
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const [nx, ny] = f(x, y); out[ny * 8 + nx] = src[y * 8 + x]; }
        this.cart.sprites[this.n] = out.join('');
        this.b.changed('sprite');
        this.refresh();
    }
    setSprite(s) {
        this.b.snapshot();
        this.cart.sprites[this.n] = s;
        this.b.changed('sprite');
        this.refresh();
    }

    refresh(fast = false) {
        if (!this.cv) return;
        const pal = this.b.paletteSize();
        if (this.color >= pal) this.color = pal - 1;
        // the big canvas, with a checker for transparency and a pixel grid
        const g = this.cv.getContext('2d');
        const s = this.cart.sprites[this.n];
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const v = parseInt(s[y * 8 + x], 16) || 0;
            g.fillStyle = v ? V.PALETTE[v] : ((x + y) % 2 ? '#10131f' : '#0a0c16');
            g.fillRect(x * 32, y * 32, 32, 32);
        }
        g.strokeStyle = 'rgba(95,240,255,0.18)'; g.lineWidth = 1;
        for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * 32 + 0.5, 0); g.lineTo(i * 32 + 0.5, 256); g.moveTo(0, i * 32 + 0.5); g.lineTo(256, i * 32 + 0.5); g.stroke(); }
        g.strokeStyle = 'rgba(95,240,255,0.4)';
        g.beginPath(); g.moveTo(128.5, 0); g.lineTo(128.5, 256); g.moveTo(0, 128.5); g.lineTo(256, 128.5); g.stroke();
        this.drawSheet();
        this.drawPreview();
        if (fast) return;
        this.label.textContent = `Slot ${this.n}` + (this.n === 0 ? ' — slot 0 is "nothing" on the map' : '');
        for (const b of this.root.querySelectorAll('[data-tool]')) b.classList.toggle('on', b.dataset.tool === this.tool);
        this.swatches.innerHTML = '';
        for (let i = 0; i < 16; i++) {
            const locked = i >= pal;
            this.swatches.append(el('button', {
                class: 'swatch' + (i === this.color ? ' on' : '') + (locked ? ' locked' : ''),
                style: { background: i === 0 ? 'repeating-conic-gradient(#222 0 25%, #111 0 50%) 0 0/12px 12px' : V.PALETTE[i] },
                title: locked ? 'This colour comes back when more of the colour DAC is restored' : `Colour ${i}` + (i === 0 ? ' (see-through)' : ''),
                'aria-label': `Colour ${i}`,
                onclick: () => { if (locked) { this.b.toast('That colour sector is still offline. Restore more cartridges.'); return; } this.color = i; if (this.tool === 'erase' || this.tool === 'pick') this.tool = 'pen'; this.refresh(); },
            }, el('span', { class: 'n' }, i)));
        }
        this.flags.innerHTML = '';
        V.FLAG_NAMES.forEach((name) => {
            const bit = V.FLAG[name];
            const locked = name !== 'solid' && !this.b.feature('flags');
            const on = (this.cart.flags[this.n] & bit) !== 0;
            this.flags.append(el('button', {
                class: `chip ${name}` + (on ? ' on' : ''), disabled: locked, 'aria-pressed': on ? 'true' : 'false',
                title: locked ? 'Comes back with ROAD HOP' : '',
                onclick: () => { this.b.snapshot(); this.cart.flags[this.n] ^= bit; this.b.changed('flags'); this.refresh(); },
            }, (on ? '■ ' : '□ ') + name));
        });
        const users = this.cart.types.filter((t) => t.spr === this.n || t.frames.includes(this.n)).map((t) => t.name);
        this.uses.textContent = users.length ? 'Used by: ' + users.join(', ') : 'Not used by any object.';
    }
    drawSheet() {
        const g = this.sheet.getContext('2d');
        const img = g.createImageData(64, 64);
        const sheet = V.decodeSheet(this.cart.sprites);
        for (let i = 0; i < 64 * 64; i++) {
            const v = sheet[i], x = i % 64, y = i >> 6;
            const p = v ? V.PAL_RGB[v] : (((x >> 3) + (y >> 3)) % 2 ? [16, 19, 31] : [10, 12, 22]);
            img.data.set([p[0], p[1], p[2], 255], i * 4);
        }
        g.putImageData(img, 0, 0);
        const x = (this.n % 8) * 8, y = Math.floor(this.n / 8) * 8;
        g.strokeStyle = '#ffb347'; g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, 7, 7);
    }
    drawPreview() {
        const g = this.preview.getContext('2d');
        const c = document.createElement('canvas'); c.width = 8; c.height = 8;
        paintSprite(c, this.cart, this.n);
        g.fillStyle = V.PALETTE[this.cart.bg]; g.fillRect(0, 0, 24, 24);
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) g.drawImage(c, x * 8, y * 8);
    }
}
