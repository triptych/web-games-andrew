// The map view: a canvas under a transparent scroller (so scrolling is native),
// three baked layer canvases redrawn per cell as you paint, the tools, events
// on the map, the start flag, zoom, panning, and touch (one finger paints, two
// pan, a long press opens the menu).
import { h, toast, popMenu } from './ui.js';
import { store } from './store.js';
import { bus } from './bus.js';
import { meta } from '../meta/progress.js';
import { startPageIndex, isEmpty } from './pages.js';

const T = 16;
export const ZOOMS = [1, 1.5, 2, 3, 4];
export const TOOLS = [
    { id: 'pencil', label: 'Pencil', icon: '✎', key: 'b', f: 'tool.pencil' },
    { id: 'rect', label: 'Rectangle', icon: '▭', key: 'r', f: 'tool.rect' },
    { id: 'fill', label: 'Fill', icon: '◉', key: 'g', f: 'tool.fill' },
    { id: 'eraser', label: 'Eraser', icon: '⌫', key: 'e', f: 'tool.eraser' },
    { id: 'picker', label: 'Eyedropper', icon: '💧', key: 'i', f: 'tool.picker' },
    { id: 'event', label: 'Events', icon: '★', key: 'v', f: 'events' },
    { id: 'start', label: 'Hero start', icon: '⚑', key: '', f: 'start' },
];
export const LAYERS = [
    { id: 0, label: 'Ground', f: null },
    { id: 1, label: 'Decor', f: 'layer.decor' },
    { id: 2, label: 'Over', f: 'layer.over' },
    { id: 3, label: 'Events', f: 'events' },
];

export class MapView {
    constructor(stage, hooks) {
        this.stage = stage;
        this.hooks = hooks || {};
        this.canvas = h('canvas.mapcanvas');
        this.scroller = h('div.mapscroll', { tabindex: 0, 'aria-label': 'Map' });
        this.spacer = h('div.mapspacer');
        this.scroller.appendChild(this.spacer);
        stage.append(this.canvas, this.scroller);
        this.g = this.canvas.getContext('2d');
        this.map = null;
        this.tool = 'pencil';
        this.layer = 0;
        this.zoom = 2;
        this.grid = true;
        this.dim = true;
        this.brush = { w: 1, h: 1, tiles: [1] };
        this.hover = null;
        this.sel = null;          // selected event id
        this.selCell = null;
        this.layersC = [];
        this.pointers = new Map();
        this.bind();
        new ResizeObserver(() => this.render()).observe(stage);
    }

    get TW() { return store.TW; }

    setMap(map) {
        this.map = map;
        this.sel = null;
        this.rebuild();
    }

    // ── baking ──
    rebuild() {
        const m = this.map;
        if (!m) return;
        this.layersC = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = m.w * T; c.height = m.h * T; return c; });
        for (let li = 0; li < 3; li++) {
            const g = this.layersC[li].getContext('2d');
            g.imageSmoothingEnabled = false;
            this.TW.tiles.drawLayers(g, m, 0, [li]);
        }
        this.spacer.style.width = m.w * T * this.zoom + 'px';
        this.spacer.style.height = m.h * T * this.zoom + 'px';
        this.render();
    }
    redrawCells(x0, y0, x1, y1) {
        const m = this.map;
        x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(m.w, x1 + 2); y1 = Math.min(m.h, y1 + 2);
        for (let li = 0; li < 3; li++) {
            const g = this.layersC[li].getContext('2d');
            g.imageSmoothingEnabled = false;
            g.clearRect(x0 * T, y0 * T, (x1 - x0) * T, (y1 - y0) * T);
            this.TW.tiles.drawLayers(g, m, 0, [li], x0, y0, x1, y1);
        }
    }

    // ── geometry ──
    origin() {
        const m = this.map, z = this.zoom;
        const vw = this.scroller.clientWidth, vh = this.scroller.clientHeight;
        const mw = m.w * T * z, mh = m.h * T * z;
        return { x: mw < vw ? Math.floor((vw - mw) / 2) : -this.scroller.scrollLeft, y: mh < vh ? Math.floor((vh - mh) / 2) : -this.scroller.scrollTop };
    }
    cellAt(e) {
        const r = this.scroller.getBoundingClientRect(), o = this.origin(), z = this.zoom;
        const x = Math.floor((e.clientX - r.left - o.x) / (T * z)), y = Math.floor((e.clientY - r.top - o.y) / (T * z));
        return { x, y, inside: this.map && x >= 0 && y >= 0 && x < this.map.w && y < this.map.h };
    }
    setZoom(z, anchor) {
        if (!this.map) return;
        const old = this.zoom;
        z = Math.max(ZOOMS[0], Math.min(ZOOMS[ZOOMS.length - 1], z));
        if (z === old) return;
        const r = this.scroller.getBoundingClientRect();
        const ax = anchor ? anchor.clientX - r.left : r.width / 2, ay = anchor ? anchor.clientY - r.top : r.height / 2;
        const mx = (this.scroller.scrollLeft + ax) / old, my = (this.scroller.scrollTop + ay) / old;
        this.zoom = z;
        this.spacer.style.width = this.map.w * T * z + 'px';
        this.spacer.style.height = this.map.h * T * z + 'px';
        this.scroller.scrollLeft = mx * z - ax; this.scroller.scrollTop = my * z - ay;
        this.render();
        if (this.hooks.onZoom) this.hooks.onZoom(z);
    }
    zoomStep(d) { const i = ZOOMS.indexOf(this.zoom); this.setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 2 : i) + d))]); }

    // ── drawing ──
    render() {
        const m = this.map;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const vw = this.scroller.clientWidth, vh = this.scroller.clientHeight;
        if (!vw || !vh) return;
        if (this.canvas.width !== Math.round(vw * dpr) || this.canvas.height !== Math.round(vh * dpr)) {
            this.canvas.width = Math.round(vw * dpr); this.canvas.height = Math.round(vh * dpr);
            this.canvas.style.width = vw + 'px'; this.canvas.style.height = vh + 'px';
        }
        const g = this.g;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, vw, vh);
        if (!m) return;
        const z = this.zoom, o = this.origin();
        const mw = m.w * T * z, mh = m.h * T * z;
        // checkerboard behind the map
        g.fillStyle = '#1b1830'; g.fillRect(o.x, o.y, mw, mh);
        for (let li = 0; li < 3; li++) {
            const dimmed = this.dim && this.layer < 3 && li !== this.layer && !(li === 0 && this.layer === 1);
            g.globalAlpha = this.layer === 3 ? 1 : dimmed ? (li > this.layer ? 0.35 : 0.6) : 1;
            g.drawImage(this.layersC[li], o.x, o.y, mw, mh);
        }
        g.globalAlpha = 1;
        // events
        const ts = T * z;
        for (const e of m.events) {
            // draw the event as it looks when a new game starts (the last page with no
            // conditions), not just page 1, so what you see here is what the game shows
            const si = startPageIndex(e);
            const pg = si >= 0 ? e.pages[si] : null;
            const x = o.x + e.x * ts, y = o.y + e.y * ts;
            if (x > vw || y > vh || x + ts < 0 || y + ts < 0) continue;
            g.globalAlpha = this.layer === 3 ? 1 : 0.8;
            const gf = pg && pg.gfx;
            if (gf && gf.kind === 'char') drawScaledChar(g, this.TW, gf, x, y, z);
            else if (gf && gf.kind === 'obj') g.drawImage(this.TW.sprites.object(gf.id, 0), x, y, ts, ts);
            g.globalAlpha = 1;
            g.lineWidth = 1;
            g.strokeStyle = this.sel === e.id ? '#ffe066' : 'rgba(255,255,255,0.75)';
            g.fillStyle = gf && gf.kind !== 'none' ? 'rgba(0,0,0,0)' : 'rgba(120,90,255,0.35)';
            g.fillRect(x + 1, y + 1, ts - 2, ts - 2);
            g.strokeRect(x + 1.5, y + 1.5, ts - 3, ts - 3);
            if (this.sel === e.id) { g.lineWidth = 2; g.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1); }
            const gone = !pg || isEmpty(pg);
            if (gone) {
                // nothing will be there when the game starts: say so plainly
                g.fillStyle = 'rgba(255,74,106,0.25)'; g.fillRect(x + 1, y + 1, ts - 2, ts - 2);
                g.setLineDash([3, 2]); g.strokeStyle = '#ff4a6a'; g.lineWidth = 1.5; g.strokeRect(x + 1.5, y + 1.5, ts - 3, ts - 3); g.setLineDash([]);
                g.fillStyle = '#fff'; g.font = 'bold ' + Math.max(8, 6 * z) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(pg ? '∅' : '?', x + ts / 2, y + ts / 2);
            } else if (!gf || gf.kind === 'none') { g.fillStyle = '#fff'; g.font = 'bold ' + Math.max(7, 5 * z) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EV', x + ts / 2, y + ts / 2); }
        }
        // the hero's start
        const s = store.project.system;
        if (s.startSet && s.startMap === m.id) {
            const x = o.x + s.startX * ts, y = o.y + s.startY * ts;
            g.fillStyle = 'rgba(255,60,110,0.35)'; g.fillRect(x, y, ts, ts);
            g.strokeStyle = '#ff3a6e'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
            g.fillStyle = '#fff'; g.font = 'bold ' + Math.max(8, 7 * z) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⚑', x + ts / 2, y + ts / 2);
        }
        // grid
        if (this.grid && z >= 1.5) {
            g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1;
            g.beginPath();
            const x0 = Math.max(0, Math.floor(-o.x / ts)), y0 = Math.max(0, Math.floor(-o.y / ts));
            const x1 = Math.min(m.w, Math.ceil((vw - o.x) / ts)), y1 = Math.min(m.h, Math.ceil((vh - o.y) / ts));
            for (let x = x0; x <= x1; x++) { g.moveTo(Math.round(o.x + x * ts) + 0.5, Math.max(0, o.y)); g.lineTo(Math.round(o.x + x * ts) + 0.5, Math.min(vh, o.y + mh)); }
            for (let y = y0; y <= y1; y++) { g.moveTo(Math.max(0, o.x), Math.round(o.y + y * ts) + 0.5); g.lineTo(Math.min(vw, o.x + mw), Math.round(o.y + y * ts) + 0.5); }
            g.stroke();
        }
        // the cursor: brush preview, rectangle preview or the cell
        const hv = this.hover;
        if (this.rectDrag) {
            const r = normRect(this.rectDrag.a, this.rectDrag.b);
            g.fillStyle = 'rgba(255,224,102,0.25)'; g.fillRect(o.x + r.x * ts, o.y + r.y * ts, r.w * ts, r.h * ts);
            g.strokeStyle = '#ffe066'; g.lineWidth = 2; g.strokeRect(o.x + r.x * ts + 1, o.y + r.y * ts + 1, r.w * ts - 2, r.h * ts - 2);
        } else if (hv && hv.inside) {
            const paint = this.tool === 'pencil' && this.layer < 3;
            const w = paint ? this.brush.w : 1, hh = paint ? this.brush.h : 1;
            if (paint) {
                g.globalAlpha = 0.6;
                for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
                    const t = this.brush.tiles[j * w + i];
                    const c = t && this.TW.tiles.tileCanvas(m.tileset, t, 0, 0);
                    if (c) g.drawImage(c, o.x + (hv.x + i) * ts, o.y + (hv.y + j) * ts, ts, ts);
                }
                g.globalAlpha = 1;
            }
            g.strokeStyle = this.tool === 'eraser' ? '#ff5a7a' : '#ffffff'; g.lineWidth = 2;
            g.strokeRect(o.x + hv.x * ts + 1, o.y + hv.y * ts + 1, w * ts - 2, hh * ts - 2);
        }
        if (this.selCell && this.layer === 3 && !this.sel) {
            g.strokeStyle = '#ffe066'; g.setLineDash([3, 3]); g.lineWidth = 1.5;
            g.strokeRect(o.x + this.selCell.x * ts + 1, o.y + this.selCell.y * ts + 1, ts - 2, ts - 2);
            g.setLineDash([]);
        }
    }

    // ── editing ──
    canUse(tool) {
        const t = TOOLS.find((x) => x.id === tool);
        return !t || meta.has(t.f);
    }
    effectiveTool() { return this.layer === 3 && this.tool !== 'start' ? 'event' : this.tool; }

    set(li, x, y, v) {
        const m = this.map;
        if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
        const i = y * m.w + x;
        if (li === 0 && !v) v = 1;
        if (m.layers[li][i] === v) return false;
        if (this.stroke && !this.stroke.old.has(li * 1e6 + i)) this.stroke.old.set(li * 1e6 + i, m.layers[li][i]);
        m.layers[li][i] = v;
        return true;
    }
    stamp(cx, cy) {
        const b = this.brush;
        let n = 0;
        for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) if (this.set(this.layer, cx + i, cy + j, b.tiles[j * b.w + i] || 0)) n++;
        if (n) this.redrawCells(cx, cy, cx + b.w - 1, cy + b.h - 1);
        return n;
    }
    beginStroke() { this.stroke = { old: new Map(), n: 0 }; }
    endStroke(kind) {
        const s = this.stroke;
        this.stroke = null;
        if (!s || !s.old.size) return;
        store.commit(kind === 'erase' ? 'Erase' : 'Paint', { map: this.map.id });
        bus.emit('edit', { kind, n: s.old.size, layer: this.layer, map: this.map });
    }
    cancelStroke() {
        const s = this.stroke;
        if (!s) return;
        for (const [k, v] of s.old) { const li = Math.floor(k / 1e6), i = k % 1e6; this.map.layers[li][i] = v; }
        this.stroke = null;
        this.rebuild();
    }
    fill(cx, cy) {
        const m = this.map, L = m.layers[this.layer], W = m.w;
        const from = L[cy * W + cx];
        const to = this.tool === 'eraser' ? (this.layer === 0 ? 1 : 0) : this.brush.tiles[0] || (this.layer === 0 ? 1 : 0);
        if (from === to) return;
        this.beginStroke();
        const q = [cy * W + cx], seen = new Uint8Array(W * m.h);
        seen[q[0]] = 1;
        let x0 = cx, y0 = cy, x1 = cx, y1 = cy;
        while (q.length && this.stroke.old.size < 15000) {
            const i = q.pop(), x = i % W, y = (i / W) | 0;
            this.set(this.layer, x, y, to);
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy, ni = ny * W + nx;
                if (nx < 0 || ny < 0 || nx >= W || ny >= m.h || seen[ni] || L[ni] !== from) continue;
                seen[ni] = 1; q.push(ni);
            }
        }
        this.redrawCells(x0, y0, x1, y1);
        bus.emit('edit', { kind: 'fill', n: this.stroke.old.size });
        this.endStroke('paint');
        this.render();
    }
    rectFill(a, b) {
        const r = normRect(a, b), br = this.brush;
        this.beginStroke();
        for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) {
            const v = this.tool === 'eraser' ? 0 : br.tiles[(j % br.h) * br.w + (i % br.w)] || 0;
            this.set(this.layer, r.x + i, r.y + j, v);
        }
        this.redrawCells(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1);
        this.endStroke(this.tool === 'eraser' ? 'erase' : 'paint');
        this.render();
    }
    pick(c) {
        const m = this.map, i = c.y * m.w + c.x;
        let li = this.layer < 3 ? this.layer : 2;
        while (li > 0 && !m.layers[li][i]) li--;
        const t = m.layers[li][i];
        this.brush = { w: 1, h: 1, tiles: [t] };
        if (li !== this.layer && this.hooks.onLayer && meta.has(LAYERS[li].f)) this.hooks.onLayer(li);
        if (this.hooks.onBrush) this.hooks.onBrush(this.brush);
        bus.emit('edit', { kind: 'pick' });
    }
    eventAt(x, y) { return this.map.events.find((e) => e.x === x && e.y === y) || null; }
    setStart(c) {
        const s = store.project.system;
        s.startMap = this.map.id; s.startX = c.x; s.startY = c.y; s.startSet = true;
        store.commit('Set start');
        bus.emit('edit', { kind: 'start' });
        toast('The hero will start here.', 'ok', { icon: '⚑' });
        this.render();
    }

    // ── input ──
    bind() {
        const sc = this.scroller;
        sc.addEventListener('scroll', () => this.render());
        // Open the menu from the contextmenu event itself. Opening it on pointerdown let
        // Windows (which fires contextmenu on mouse-up) aim the event at our popup, which
        // sat under the cursor by then, so the browser's own menu appeared on top of it.
        sc.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (Date.now() - (this.lpAt || 0) < 800) return;   // a touch long-press already opened it
            const c = this.cellAt(e);
            if (c.inside && this.map) this.context(e, c);
        });
        sc.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(this.zoom) + (e.deltaY < 0 ? 1 : -1)))], e); }
        }, { passive: false });
        sc.addEventListener('pointerdown', (e) => this.down(e));
        sc.addEventListener('pointermove', (e) => this.move(e));
        sc.addEventListener('pointerup', (e) => this.up(e));
        sc.addEventListener('pointercancel', (e) => { this.pointers.delete(e.pointerId); this.cancelStroke(); this.drag = null; this.rectDrag = null; });
        sc.addEventListener('pointerleave', () => { if (!this.drag) { this.hover = null; this.render(); } });
        sc.addEventListener('dblclick', (e) => {
            const c = this.cellAt(e);
            if (!c.inside || this.effectiveTool() !== 'event') return;
            const ev = this.eventAt(c.x, c.y);
            if (ev) this.hooks.onEditEvent && this.hooks.onEditEvent(this.map, ev);
            else this.hooks.onNewEvent && this.hooks.onNewEvent(this.map, c.x, c.y);
        });
    }
    down(e) {
        if (!this.map) return;
        this.scroller.focus({ preventScroll: true });
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        // two fingers, the middle button or Space: pan
        if (this.pointers.size === 2) { this.cancelStroke(); this.rectDrag = null; this.drag = { pan: true, sx: this.scroller.scrollLeft, sy: this.scroller.scrollTop, ...this.mid() }; clearTimeout(this.lpTimer); return; }
        if (e.button === 1 || this.spaceDown) { e.preventDefault(); this.drag = { pan: true, sx: this.scroller.scrollLeft, sy: this.scroller.scrollTop, x: e.clientX, y: e.clientY }; return; }
        const c = this.cellAt(e);
        if (e.button === 2) return;   // the contextmenu event opens the menu
        if (!c.inside) return;
        try { this.scroller.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
        if (e.pointerType === 'touch') {
            clearTimeout(this.lpTimer);
            this.lpTimer = setTimeout(() => { if (this.drag && !this.drag.moved) { this.cancelStroke(); this.rectDrag = null; this.drag = null; this.lpAt = Date.now(); this.context({ clientX: e.clientX, clientY: e.clientY }, c); } }, 550);
        }
        const tool = e.altKey ? 'picker' : this.effectiveTool();
        if (!this.canUse(tool)) { toast(TOOLS.find((t) => t.id === tool).label + ': ' + meta.why(TOOLS.find((t) => t.id === tool).f), 'warn'); return; }
        if (this.layer < 3 && !meta.has(LAYERS[this.layer].f)) { toast(LAYERS[this.layer].label + ' layer: ' + meta.why(LAYERS[this.layer].f), 'warn'); return; }
        this.drag = { tool, start: c, x: e.clientX, y: e.clientY, moved: false, last: c };
        if (tool === 'pencil' || tool === 'eraser') {
            this.beginStroke();
            if (tool === 'eraser') { if (this.set(this.layer, c.x, c.y, 0)) this.redrawCells(c.x, c.y, c.x, c.y); }
            else this.stamp(c.x, c.y);
            this.render();
        } else if (tool === 'rect') this.rectDrag = { a: c, b: c };
        else if (tool === 'fill') { this.fill(c.x, c.y); this.drag = null; }
        else if (tool === 'picker') { this.pick(c); this.drag = null; }
        else if (tool === 'start') { this.setStart(c); this.drag = null; }
        else if (tool === 'event') {
            const ev = this.eventAt(c.x, c.y);
            this.sel = ev ? ev.id : null;
            this.selCell = c;
            this.drag.ev = ev;
            if (this.hooks.onSelect) this.hooks.onSelect(ev, c);
            this.render();
        }
    }
    mid() { const ps = [...this.pointers.values()]; return { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 }; }
    move(e) {
        if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const c = this.cellAt(e);
        const d = this.drag;
        if (d && d.pan) {
            const p = this.pointers.size === 2 ? this.mid() : { x: e.clientX, y: e.clientY };
            this.scroller.scrollLeft = d.sx - (p.x - d.x); this.scroller.scrollTop = d.sy - (p.y - d.y);
            return;
        }
        const changed = !this.hover || this.hover.x !== c.x || this.hover.y !== c.y;
        this.hover = c;
        if (d) {
            if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true;
            if (c.inside && (c.x !== d.last.x || c.y !== d.last.y)) {
                if (d.tool === 'pencil' || d.tool === 'eraser') {
                    // walk the line between cells so fast strokes have no gaps
                    const steps = Math.max(Math.abs(c.x - d.last.x), Math.abs(c.y - d.last.y));
                    for (let s = 1; s <= steps; s++) {
                        const x = Math.round(d.last.x + (c.x - d.last.x) * s / steps), y = Math.round(d.last.y + (c.y - d.last.y) * s / steps);
                        if (d.tool === 'eraser') { if (this.set(this.layer, x, y, 0)) this.redrawCells(x, y, x, y); }
                        else this.stamp(x, y);
                    }
                }
                if (d.tool === 'rect') this.rectDrag.b = c;
                if (d.tool === 'event' && d.ev && !this.eventAt(c.x, c.y)) { d.ev.x = c.x; d.ev.y = c.y; d.evMoved = true; }
                d.last = c;
            }
        }
        if (changed || d) this.render();
        if (this.hooks.onHover) this.hooks.onHover(c);
    }
    up(e) {
        this.pointers.delete(e.pointerId);
        clearTimeout(this.lpTimer);
        const d = this.drag;
        this.drag = null;
        if (!d) return;
        if (d.pan) return;
        if (d.tool === 'pencil') this.endStroke('paint');
        if (d.tool === 'eraser') this.endStroke('erase');
        if (d.tool === 'rect' && this.rectDrag) { const r = this.rectDrag; this.rectDrag = null; this.rectFill(r.a, r.b); }
        if (d.tool === 'event' && d.evMoved) { store.commit('Move event'); bus.emit('edit', { kind: 'eventMove' }); }
        this.render();
    }
    context(e, c) {
        this.selCell = c;
        const ev = this.eventAt(c.x, c.y);
        this.sel = ev ? ev.id : null;
        this.render();
        if (this.hooks.onContext) this.hooks.onContext({ x: e.clientX, y: e.clientY }, this.map, c, ev);
    }
}

function drawScaledChar(g, TW, gf, x, y, z) {
    g.save();
    g.translate(x, y - 4 * z);
    g.scale(z, z);
    TW.sprites.drawChar(g, gf.id, gf.dir || 2, 1, 0, 0);
    g.restore();
}
function normRect(a, b) { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 }; }
