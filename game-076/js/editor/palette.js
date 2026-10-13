// The tile palette: the current map's tileset drawn at 2×, click to pick a
// tile, drag to pick a block. Corner marks show the layer a tile belongs on
// (D decor, O over) and a red dot marks tiles that block movement.
import { h } from './ui.js';
import { store } from './store.js';

const T = 16, S = 2;

export class Palette {
    constructor(el, onPick) {
        this.el = el;
        this.onPick = onPick;
        this.canvas = h('canvas.palette', { 'aria-label': 'Tile palette' });
        this.info = h('div.palinfo', { text: 'Pick a tile' });
        el.append(this.canvas, this.info);
        this.set = null;
        this.sel = { x: 0, y: 0, w: 1, h: 1 };
        this.cols = 8;
        let drag = null;
        const cell = (e) => {
            const r = this.canvas.getBoundingClientRect();
            const k = r.width / this.canvas.width;
            return { x: Math.floor((e.clientX - r.left) / (T * S * k)), y: Math.floor((e.clientY - r.top) / (T * S * k)) };
        };
        this.canvas.addEventListener('pointerdown', (e) => { const c = cell(e); if (!this.valid(c)) return; drag = c; this.canvas.setPointerCapture(e.pointerId); this.select(c, c); });
        this.canvas.addEventListener('pointermove', (e) => {
            const c = cell(e);
            if (drag) { this.select(drag, c); return; }
            const n = this.valid(c) ? c.y * this.cols + c.x + 1 : 0;
            const d = n && store.TW.tiles.def(this.set, n);
            this.canvas.title = d ? d.n + (d.s ? ' — blocks' : '') + (d.c ? ' — counter' : '') + (d.k === 'd' ? ' — Decor layer' : d.k === 'o' ? ' — Over layer (above characters)' : '') : '';
        });
        this.canvas.addEventListener('pointerup', () => { if (drag) { drag = null; this.emit(); } });
    }
    count() { const ts = store.TW.tiles.TILESETS[this.set]; return ts ? ts.tiles.length : 0; }
    valid(c) { return c.x >= 0 && c.y >= 0 && c.x < this.cols && c.y * this.cols + c.x < this.count(); }
    select(a, b) {
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        this.sel = { x, y, w: Math.min(6, Math.abs(a.x - b.x) + 1), h: Math.min(6, Math.abs(a.y - b.y) + 1) };
        this.draw();
    }
    /** The brush for the selection: tile numbers (0 where the block runs past the set). */
    brush() {
        const { x, y, w, h: hh } = this.sel, n = this.count(), tiles = [];
        for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) { const k = (y + j) * this.cols + x + i + 1; tiles.push(k <= n && x + i < this.cols ? k : 0); }
        return { w, h: hh, tiles };
    }
    emit() {
        const b = this.brush();
        const d = store.TW.tiles.def(this.set, b.tiles[0]);
        this.info.textContent = b.w * b.h > 1 ? b.w + '×' + b.h + ' block' : d ? d.n + (d.s ? ' · blocks' : ' · walkable') : '';
        this.onPick(b, d);
    }
    setTileset(id) {
        if (this.set === id) return;
        this.set = id;
        this.sel = { x: 0, y: 0, w: 1, h: 1 };
        this.draw();
        this.emit();
    }
    /** Select a single tile by number (from the eyedropper). */
    show(n) {
        if (!n) return;
        this.sel = { x: (n - 1) % this.cols, y: Math.floor((n - 1) / this.cols), w: 1, h: 1 };
        this.draw();
        const d = store.TW.tiles.def(this.set, n);
        this.info.textContent = d ? d.n : '';
    }
    draw() {
        const TWt = store.TW.tiles, n = this.count();
        const rows = Math.ceil(n / this.cols);
        const c = this.canvas;
        c.width = this.cols * T * S; c.height = Math.max(1, rows) * T * S;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.fillStyle = '#16142a'; g.fillRect(0, 0, c.width, c.height);
        for (let i = 0; i < n; i++) {
            const x = (i % this.cols) * T * S, y = Math.floor(i / this.cols) * T * S;
            const def = TWt.def(this.set, i + 1);
            if (def.k === 'd' || def.k === 'o') { g.fillStyle = (i + Math.floor(i / this.cols)) % 2 ? '#2a2744' : '#232038'; g.fillRect(x, y, T * S, T * S); }
            g.drawImage(TWt.tileCanvas(this.set, i + 1, 0, 0), x, y, T * S, T * S);
            if (def.k === 'd' || def.k === 'o') {
                g.fillStyle = def.k === 'o' ? '#5ad0ff' : '#ffd060';
                g.font = 'bold 9px system-ui'; g.textBaseline = 'top';
                g.fillRect(x, y, 9, 10); g.fillStyle = '#000'; g.fillText(def.k === 'o' ? 'O' : 'D', x + 1.5, y + 1);
            }
            if (def.s) { g.fillStyle = '#ff4a6a'; g.fillRect(x + T * S - 5, y + 1, 4, 4); }
        }
        const s = this.sel;
        g.strokeStyle = '#ffe066'; g.lineWidth = 2;
        g.strokeRect(s.x * T * S + 1, s.y * T * S + 1, s.w * T * S - 2, s.h * T * S - 2);
    }
}
