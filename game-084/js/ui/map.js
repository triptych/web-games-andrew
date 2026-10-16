// MAP: the level maker. Paint sprites as tiles, place and drag objects, pan and zoom with two
// fingers or the mouse wheel. Up to four levels and maps up to 128 × 64 once those return.

import { V } from '../runtime/index.js';
import { el, spriteCanvas } from './dom.js';

const TOOLS = [
    ['paint', '✏', 'Paint tiles'], ['erase', '⌫', 'Erase tiles'], ['rect', '▭', 'Fill a rectangle'], ['fill', '▧', 'Flood fill'],
    ['place', '◉', 'Place or drag objects'], ['remove', '✖', 'Remove objects'], ['pan', '✥', 'Pan'],
];

export class MapEditor {
    constructor(bench) {
        this.b = bench;
        this.tool = 'paint';
        this.tile = 1;
        this.type = null;
        this.zoom = 0;
        this.px = 0; this.py = 0;
        this.li = 0;
    }
    get cart() { return this.b.cart; }
    get L() { return this.cart.levels[this.li] || this.cart.levels[0]; }

    mount(root) {
        this.root = root;
        root.innerHTML = '';
        if (this.li >= this.cart.levels.length) this.li = 0;
        this.levelBar = el('div', { class: 'toolbar' });
        this.tools = el('div', { class: 'toolbar' }, TOOLS.map(([id, ic, name]) => el('button', { class: 'tool', 'data-tool': id, title: name, 'aria-label': name, onclick: () => { this.tool = id; this.refreshUI(); } }, ic)).concat([
            el('button', { class: 'tool', title: 'Zoom out', 'aria-label': 'Zoom out', onclick: () => this.zoomBy(1 / 1.4) }, '−'),
            el('button', { class: 'tool', title: 'Zoom in', 'aria-label': 'Zoom in', onclick: () => this.zoomBy(1.4) }, '+'),
            el('button', { class: 'tool', title: 'Undo', 'aria-label': 'Undo', onclick: () => this.b.undo() }, '↶'),
        ]));
        this.tileStrip = el('div', { class: 'strip' });
        this.objStrip = el('div', { class: 'strip' });
        this.wrap = el('div', { class: 'map-wrap' });
        this.cv = el('canvas');
        this.wrap.append(this.cv);
        this.status = el('div', { class: 'hint' });
        root.append(el('div', { class: 'ed', style: { flexDirection: 'column', flexWrap: 'nowrap' } }, [
            el('div', { class: 'panel', style: { width: '100%' } }, [this.levelBar, this.tools]),
            el('div', { class: 'panel', style: { width: '100%' } }, [el('h4', {}, 'Tiles'), this.tileStrip, el('h4', {}, 'Objects'), this.objStrip]),
            this.wrap, this.status,
        ]));
        this.bindPointers();
        this.bake();
        this.fit();
        this.refreshUI();
        this.ro = new ResizeObserver(() => this.draw());
        this.ro.observe(this.wrap);
    }
    unmount() { this.ro?.disconnect(); }

    refreshUI() {
        // level tabs and size
        this.levelBar.innerHTML = '';
        const levels = this.b.feature('levels');
        this.cart.levels.forEach((L, i) => this.levelBar.append(el('button', { class: 'tool' + (i === this.li ? ' on' : ''), onclick: () => { this.li = i; this.bake(); this.fit(); this.refreshUI(); } }, el('small', {}, 'Level ' + (i + 1)))));
        if (levels && this.cart.levels.length < V.MAX_LEVELS) this.levelBar.append(el('button', { class: 'tool', title: 'Add a level', onclick: () => { this.b.snapshot(); this.cart.levels.push(V.blankLevel(this.L.w, this.L.h)); this.li = this.cart.levels.length - 1; this.b.changed('map'); this.bake(); this.fit(); this.refreshUI(); } }, el('small', {}, '＋ Level')));
        if (levels && this.cart.levels.length > 1) this.levelBar.append(el('button', { class: 'tool', title: 'Delete this level', onclick: () => this.b.ask('Delete level ' + (this.li + 1) + '?', 'Its tiles and objects go too.', [['Delete', () => { this.b.snapshot(); this.cart.levels.splice(this.li, 1); this.li = 0; this.b.changed('map'); this.bake(); this.fit(); this.refreshUI(); }, 'danger']]) }, el('small', {}, 'Delete')));
        if (this.b.feature('bigmap')) {
            const size = (k, lo, hi) => el('input', { type: 'number', min: lo, max: hi, value: this.L[k], style: { width: '70px' }, 'aria-label': k === 'w' ? 'Map width' : 'Map height', onchange: (e) => this.resizeMap(k, +e.target.value) });
            this.levelBar.append(el('span', { class: 'hint', style: { alignSelf: 'center', marginLeft: '8px' } }, 'Size'), size('w', 4, 128), el('span', { class: 'hint', style: { alignSelf: 'center' } }, '×'), size('h', 4, 64));
        } else this.levelBar.append(el('span', { class: 'hint', style: { alignSelf: 'center', marginLeft: '8px' } }, `${this.L.w} × ${this.L.h} · one screen`));
        for (const b of this.tools.querySelectorAll('[data-tool]')) b.classList.toggle('on', b.dataset.tool === this.tool);
        // tile strip: every sprite that has something drawn, plus the current one
        this.tileStrip.innerHTML = '';
        for (let n = 1; n < 64; n++) {
            if (!/[1-9a-f]/.test(this.cart.sprites[n]) && n !== this.tile) continue;
            const f = this.cart.flags[n];
            const tag = f & V.FLAG.solid ? 'solid' : f & V.FLAG.hazard ? 'hazard' : f & V.FLAG.ladder ? 'ladder' : f & V.FLAG.oneway ? '1-way' : n;
            this.tileStrip.append(el('button', { class: n === this.tile ? 'on' : '', title: `Sprite ${n}`, onclick: () => { this.tile = n; if (!['paint', 'rect', 'fill'].includes(this.tool)) this.tool = 'paint'; this.refreshUI(); } }, [spriteCanvas(this.cart, n, 36), el('span', { class: 'lbl' }, tag)]));
        }
        if (!this.tileStrip.children.length) this.tileStrip.append(el('span', { class: 'hint' }, 'Draw some sprites first.'));
        this.objStrip.innerHTML = '';
        if (!this.type || !this.cart.types.find((t) => t.name === this.type)) this.type = this.cart.types[0]?.name || null;
        for (const T of this.cart.types) {
            this.objStrip.append(el('button', { class: T.name === this.type ? 'on' : '', title: T.name, onclick: () => { this.type = T.name; this.tool = 'place'; this.refreshUI(); } }, [spriteCanvas(this.cart, T.frames[0] ?? T.spr, 36), el('span', { class: 'lbl' }, T.name)]));
        }
        if (!this.cart.types.length) this.objStrip.append(el('span', { class: 'hint' }, 'Make objects in OBJECTS, then place them here.'));
        this.draw();
    }

    resizeMap(k, v) {
        const L = this.L;
        v = Math.max(4, Math.min(k === 'w' ? 128 : 64, v | 0));
        if (v === L[k]) return;
        this.b.snapshot();
        const w = k === 'w' ? v : L.w, h = k === 'h' ? v : L.h;
        const t = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) t.push(x < L.w && y < L.h ? L.tiles[y * L.w + x] : '.');
        L.w = w; L.h = h; L.tiles = t.join('');
        L.objs = L.objs.filter((o) => o.x < w * 8 && o.y < h * 8);
        this.b.changed('map');
        this.bake(); this.fit(); this.refreshUI();
    }

    // ------------------------------------------------------------------ the picture
    bake() {
        const L = this.L;
        this.sheet = V.decodeSheet(this.cart.sprites);
        this.base = document.createElement('canvas');
        this.base.width = L.w * 8; this.base.height = L.h * 8;
        this.bctx = this.base.getContext('2d');
        this.bimg = this.bctx.createImageData(L.w * 8, L.h * 8);
        for (let cy = 0; cy < L.h; cy++) for (let cx = 0; cx < L.w; cx++) this.bakeCell(cx, cy);
        this.bctx.putImageData(this.bimg, 0, 0);
    }
    bakeCell(cx, cy) {
        const L = this.L, t = V.tileAtLevel(L, cx, cy), W = L.w * 8, bg = V.PAL_RGB[this.cart.bg];
        const ox = (t % 8) * 8, oy = Math.floor(t / 8) * 8;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const v = t ? this.sheet[(oy + y) * 64 + ox + x] : 0;
            const p = v ? V.PAL_RGB[v] : bg;
            this.bimg.data.set([p[0], p[1], p[2], 255], ((cy * 8 + y) * W + cx * 8 + x) * 4);
        }
    }
    fit() {
        const r = this.wrap.getBoundingClientRect();
        const W = this.L.w * 8, H = this.L.h * 8;
        this.zoom = Math.max(1, Math.min(8, Math.floor(Math.min((r.width - 8) / Math.min(W, 160), (r.height - 8) / Math.min(H, 120)) * 10) / 10 || 2));
        this.px = 0; this.py = 0;
        this.clampPan();
    }
    clampPan() {
        const r = this.wrap.getBoundingClientRect();
        const W = this.L.w * 8, H = this.L.h * 8;
        const vw = r.width / this.zoom, vh = r.height / this.zoom;
        this.px = vw >= W ? -(vw - W) / 2 : Math.max(-16, Math.min(W - vw + 16, this.px));
        this.py = vh >= H ? -(vh - H) / 2 : Math.max(-16, Math.min(H - vh + 16, this.py));
    }
    zoomBy(k, cx, cy) {
        const r = this.wrap.getBoundingClientRect();
        cx = cx ?? r.width / 2; cy = cy ?? r.height / 2;
        const mx = this.px + cx / this.zoom, my = this.py + cy / this.zoom;
        this.zoom = Math.max(0.5, Math.min(12, this.zoom * k));
        this.px = mx - cx / this.zoom; this.py = my - cy / this.zoom;
        this.clampPan();
        this.draw();
    }
    draw() {
        if (!this.wrap) return;
        const r = this.wrap.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
        if (this.cv.width !== w * dpr || this.cv.height !== h * dpr) {
            this.cv.width = w * dpr; this.cv.height = h * dpr;
            this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
        }
        const g = this.cv.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.imageSmoothingEnabled = false;
        g.fillStyle = '#01020a'; g.fillRect(0, 0, w, h);
        const z = this.zoom, L = this.L;
        g.save();
        g.translate(-this.px * z, -this.py * z);
        g.scale(z, z);
        g.drawImage(this.base, 0, 0);
        // objects
        for (const o of L.objs) {
            const T = this.cart.types.find((t) => t.name === o.t);
            if (!T) continue;
            const c = this.objImage(T);
            for (let j = 0; j < T.sh; j++) for (let i = 0; i < T.sw; i++) g.drawImage(c, o.x + i * 8, o.y + j * 8);
            g.strokeStyle = V.isPlayerControl(T.control) ? 'rgba(125,255,176,0.9)' : 'rgba(255,179,71,0.7)';
            g.lineWidth = 1 / z;
            g.strokeRect(o.x, o.y, T.sw * 8, T.sh * 8);
        }
        // grid when zoomed in, and the first screen's outline
        if (z >= 3) {
            g.strokeStyle = 'rgba(95,240,255,0.10)'; g.lineWidth = 1 / z;
            g.beginPath();
            for (let x = 0; x <= L.w; x++) { g.moveTo(x * 8, 0); g.lineTo(x * 8, L.h * 8); }
            for (let y = 0; y <= L.h; y++) { g.moveTo(0, y * 8); g.lineTo(L.w * 8, y * 8); }
            g.stroke();
        }
        g.strokeStyle = 'rgba(255,79,216,0.6)'; g.lineWidth = 2 / z; g.setLineDash([4 / z, 3 / z]);
        g.strokeRect(0, 0, Math.min(160, L.w * 8), Math.min(120, L.h * 8));
        g.setLineDash([]);
        g.strokeStyle = 'rgba(95,240,255,0.5)'; g.lineWidth = 1 / z;
        g.strokeRect(0, 0, L.w * 8, L.h * 8);
        if (this.rectSel) {
            const [x0, y0, x1, y1] = this.rectSel;
            g.fillStyle = 'rgba(255,179,71,0.3)';
            g.fillRect(Math.min(x0, x1) * 8, Math.min(y0, y1) * 8, (Math.abs(x1 - x0) + 1) * 8, (Math.abs(y1 - y0) + 1) * 8);
        }
        if (this.hover) { g.strokeStyle = '#ffb347'; g.lineWidth = 1.5 / z; g.strokeRect(this.hover[0] * 8, this.hover[1] * 8, 8, 8); }
        g.restore();
    }
    objImage(T) {
        const c = document.createElement('canvas'); c.width = 8; c.height = 8;
        const g = c.getContext('2d'), img = g.createImageData(8, 8);
        const s = this.cart.sprites[T.frames[0] ?? T.spr];
        for (let i = 0; i < 64; i++) { const v = parseInt(s[i], 16) || 0; if (v) img.data.set([...V.PAL_RGB[v], 255], i * 4); }
        g.putImageData(img, 0, 0);
        return c;
    }

    // ------------------------------------------------------------------ pointers
    toMap(e) {
        const r = this.cv.getBoundingClientRect();
        return [this.px + (e.clientX - r.left) / this.zoom, this.py + (e.clientY - r.top) / this.zoom];
    }
    bindPointers() {
        const pts = new Map();
        let act = null, pinch = null;
        this.cv.addEventListener('contextmenu', (e) => e.preventDefault());
        this.cv.addEventListener('wheel', (e) => {
            e.preventDefault();
            const r = this.cv.getBoundingClientRect();
            if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 2 && !e.shiftKey) this.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
            else { this.px += e.deltaX / this.zoom; this.py += e.deltaY / this.zoom; this.clampPan(); this.draw(); }
        }, { passive: false });
        this.cv.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            try { this.cv.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pts.size === 2) {
                // second finger: cancel the stroke and pinch instead
                if (act && act.snap) this.b.undo(true);
                act = null; this.rectSel = null;
                const [a, b] = [...pts.values()];
                pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
                return;
            }
            const [mx, my] = this.toMap(e);
            const cx = Math.floor(mx / 8), cy = Math.floor(my / 8);
            const tool = e.button === 1 || e.button === 2 && this.tool !== 'paint' ? 'pan' : e.button === 2 ? 'erase' : this.tool;
            act = { tool, sx: e.clientX, sy: e.clientY, px: this.px, py: this.py, last: null };
            if (tool === 'pan') return;
            if (tool === 'place') {
                const hit = this.objAt(mx, my);
                this.b.snapshot(); act.snap = true;
                if (hit) { act.drag = hit; act.ox = mx - hit.x; act.oy = my - hit.y; return; }
                if (!this.type) { this.b.toast('Make an object type first.'); act = null; return; }
                const o = { t: this.type, x: cx * 8, y: cy * 8 };
                this.L.objs.push(o);
                act.drag = o; act.ox = mx - o.x; act.oy = my - o.y;
                this.b.audio.ui('click');
                this.draw();
                return;
            }
            if (tool === 'remove') {
                const hit = this.objAt(mx, my);
                if (hit) { this.b.snapshot(); this.L.objs.splice(this.L.objs.indexOf(hit), 1); this.b.changed('map'); this.draw(); }
                act = null;
                return;
            }
            this.b.snapshot(); act.snap = true;
            if (tool === 'fill') { this.flood(cx, cy); act = null; return; }
            if (tool === 'rect') { this.rectSel = [cx, cy, cx, cy]; this.draw(); return; }
            this.paintAt(cx, cy, tool);
            act.last = [cx, cy];
        });
        this.cv.addEventListener('pointermove', (e) => {
            if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const [mx, my] = this.toMap(e);
            const cx = Math.floor(mx / 8), cy = Math.floor(my / 8);
            this.status.textContent = `cell ${cx}, ${cy} · pixel ${Math.floor(mx)}, ${Math.floor(my)} · level ${this.li + 1} · ${this.L.objs.length} objects`;
            if (pinch && pts.size >= 2) {
                const [a, b] = [...pts.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y), nmx = (a.x + b.x) / 2, nmy = (a.y + b.y) / 2;
                const r = this.cv.getBoundingClientRect();
                this.px -= (nmx - pinch.mx) / this.zoom; this.py -= (nmy - pinch.my) / this.zoom;
                this.zoomBy(d / Math.max(1, pinch.d), nmx - r.left, nmy - r.top);
                pinch = { d, mx: nmx, my: nmy };
                return;
            }
            if (!act) { this.hover = [cx, cy]; this.draw(); return; }
            if (act.tool === 'pan') {
                this.px = act.px - (e.clientX - act.sx) / this.zoom; this.py = act.py - (e.clientY - act.sy) / this.zoom;
                this.clampPan(); this.draw();
            } else if (act.drag) {
                act.drag.x = Math.round((mx - act.ox) / 4) * 4; act.drag.y = Math.round((my - act.oy) / 4) * 4;
                this.draw();
            } else if (act.tool === 'rect') {
                this.rectSel[2] = cx; this.rectSel[3] = cy; this.draw();
            } else if ((act.tool === 'paint' || act.tool === 'erase') && act.last && (cx !== act.last[0] || cy !== act.last[1])) {
                // a line from the last cell, so a quick swipe leaves no gaps
                let [x0, y0] = act.last;
                const dx = Math.abs(cx - x0), dy = -Math.abs(cy - y0), sx = x0 < cx ? 1 : -1, sy = y0 < cy ? 1 : -1;
                let err = dx + dy;
                for (let i = 0; i < 400; i++) {
                    this.paintAt(x0, y0, act.tool, true);
                    if (x0 === cx && y0 === cy) break;
                    const e2 = 2 * err;
                    if (e2 >= dy) { err += dy; x0 += sx; }
                    if (e2 <= dx) { err += dx; y0 += sy; }
                }
                this.bctx.putImageData(this.bimg, 0, 0);
                act.last = [cx, cy];
                this.draw();
            }
        });
        const end = (e) => {
            pts.delete(e.pointerId);
            if (pts.size < 2) pinch = null;
            if (!act) return;
            if (act.tool === 'rect' && this.rectSel) {
                const [x0, y0, x1, y1] = this.rectSel;
                for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.paintAt(x, y, 'paint', true);
                this.bctx.putImageData(this.bimg, 0, 0);
                this.rectSel = null;
            }
            if (act.drag) {
                const o = act.drag, W = this.L.w * 8, H = this.L.h * 8;
                if (o.x < -8 || o.y < -8 || o.x > W || o.y > H) this.L.objs.splice(this.L.objs.indexOf(o), 1);
            }
            if (act.tool !== 'pan') this.b.changed('map');
            act = null;
            this.draw();
        };
        for (const ev of ['pointerup', 'pointercancel']) this.cv.addEventListener(ev, end);
        this.cv.addEventListener('pointerleave', () => { this.hover = null; this.draw(); });
    }
    objAt(mx, my) {
        const objs = this.L.objs;
        for (let i = objs.length - 1; i >= 0; i--) {
            const o = objs[i], T = this.cart.types.find((t) => t.name === o.t);
            const w = (T ? T.sw : 1) * 8, h = (T ? T.sh : 1) * 8;
            if (mx >= o.x && my >= o.y && mx < o.x + w && my < o.y + h) return o;
        }
        return null;
    }
    paintAt(cx, cy, tool, batch) {
        const L = this.L;
        if (cx < 0 || cy < 0 || cx >= L.w || cy >= L.h) return;
        const id = tool === 'erase' ? 0 : this.tile;
        if (V.tileAtLevel(L, cx, cy) === id) return;
        V.setTileLevel(L, cx, cy, id);
        if (id) this.b.stat('tiles', 1);
        this.bakeCell(cx, cy);
        if (!batch) { this.bctx.putImageData(this.bimg, 0, 0); this.draw(); }
    }
    flood(cx, cy) {
        const L = this.L;
        const from = V.tileAtLevel(L, cx, cy), to = this.tile;
        if (from === to || cx < 0 || cy < 0 || cx >= L.w || cy >= L.h) return;
        const st = [[cx, cy]];
        let n = 0;
        while (st.length && n < 8192) {
            const [x, y] = st.pop();
            if (x < 0 || y < 0 || x >= L.w || y >= L.h || V.tileAtLevel(L, x, y) !== from) continue;
            V.setTileLevel(L, x, y, to);
            n++;
            st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        if (to) this.b.stat('tiles', n);
        this.bake();
        this.b.changed('map');
        this.draw();
    }
}
