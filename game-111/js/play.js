// The play controller: turns drags, taps, keys and gamepad presses into sim commands, and tells
// the view what to preview (the glyph being dragged, its ghost, the lines it would clear).
//
// - Drag a glyph from the hand and drop it. On touch it floats above the finger, so the finger never
//   hides where it lands.
// - Or tap a glyph to choose it, then tap the lattice: the glyph is centred on the tapped cell.
// - Or choose with 1 2 3 / Tab, move it with the arrows and place it with Space or Enter.

import { N } from './config.js';
import { sizeOf } from './sim/pieces.js';
import { canPlace, fitsAnywhere, wouldClear, powerUsable } from './sim/game.js';
import { ARCANA, POWERS } from './sim/arcana.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Controller {
    constructor({ view, audio, ui, getG, enabled, act }) {
        this.view = view;
        this.audio = audio;
        this.ui = ui;
        this.getG = getG;
        this.enabled = enabled;          // () => true while the player may act
        this.doAct = act;                // (cmd) => bool
        this.reset();
        const c = view.canvas;
        c.addEventListener('pointerdown', (e) => this.down(e));
        window.addEventListener('pointermove', (e) => this.move(e));
        window.addEventListener('pointerup', (e) => this.up(e));
        window.addEventListener('pointercancel', (e) => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; });
        c.addEventListener('pointerleave', () => { this.hover = null; });
    }

    reset() {
        this.sel = -1;
        this.cursor = { x: 3, y: 3 };
        this.drag = null;
        this.target = null;              // 'strike' | 'lantern' while aiming a power
        this.hover = null;               // the cell under a mouse
        this.aim = 'pointer';            // which input last aimed: 'pointer' or 'keys'
        this.fitKey = '';
        this.fits = [true, true, true];
    }

    piece(slot) { return this.getG().hand[slot] || null; }
    firstSlot(from = 0) {
        const G = this.getG();
        for (let k = 0; k < G.hand.length; k++) { const i = (from + k) % G.hand.length; if (G.hand[i]) return i; }
        return -1;
    }

    // ------------------------------------------------------------------ pointers

    down(e) {
        if (!this.enabled()) { this.view.skipCine(); return; }
        const G = this.getG();
        const p = this.view.pick(e.clientX, e.clientY);
        const onBoard = p.fx >= 0 && p.fy >= 0 && p.fx < N && p.fy < N;
        this.aim = 'pointer';
        if (this.target) {
            if (onBoard) { this.fire(Math.floor(p.fx), Math.floor(p.fy)); return; }
            this.target = null;
        }
        if (p.slot >= 0 && G.hand[p.slot]) {
            e.preventDefault();
            const h = G.hand[p.slot];
            this.sel = p.slot;
            this.drag = { slot: p.slot, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, touch: e.pointerType === 'touch', t0: performance.now(), s: this.view.board.handScale, ...this.dragCentre(p, h, e.pointerType === 'touch') };
            try { this.view.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
            this.audio.ui('pick');
            return;
        }
        if (onBoard && this.sel >= 0 && this.piece(this.sel)) {
            // tap-to-place: centre the chosen glyph on the tapped cell
            const a = this.centreAnchor(this.piece(this.sel), Math.floor(p.fx), Math.floor(p.fy));
            this.place(this.sel, a.x, a.y);
        }
    }

    /** Where a dragged glyph's centre sits for a pointer at p: under a mouse, above a finger. */
    dragCentre(p, h, touch) {
        const { h: hh } = sizeOf(h.cells);
        return { cx: p.fx, cy: touch ? p.fy - (hh / 2 + 1.1) : p.fy };
    }

    centreAnchor(h, cx, cy) {
        const { w, h: hh } = sizeOf(h.cells);
        return { x: clamp(cx - Math.floor((w - 1) / 2), 0, N - w), y: clamp(cy - Math.floor((hh - 1) / 2), 0, N - hh) };
    }

    dragAnchor() {
        const d = this.drag, h = this.piece(d.slot);
        const { w, h: hh } = sizeOf(h.cells);
        return { x: Math.round(d.cx - w / 2), y: Math.round(d.cy - hh / 2) };
    }

    move(e) {
        const d = this.drag;
        if (d && e.pointerId === d.id) {
            const h = this.piece(d.slot);
            if (!h) { this.drag = null; return; }
            if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) d.moved = true;
            Object.assign(d, this.dragCentre(this.view.pick(e.clientX, e.clientY), h, d.touch));
            return;
        }
        if (e.pointerType === 'mouse' && e.target === this.view.canvas) {
            const p = this.view.pick(e.clientX, e.clientY);
            this.hover = p.fx >= 0 && p.fy >= 0 && p.fx < N && p.fy < N ? { x: Math.floor(p.fx), y: Math.floor(p.fy) } : null;
            if (this.hover) this.aim = 'pointer';
        }
    }

    up(e) {
        const d = this.drag;
        if (!d || e.pointerId !== d.id) return;
        if (!this.piece(d.slot) || !this.enabled()) { this.drag = null; return; }
        const a = this.dragAnchor();
        this.drag = null;
        if (!d.moved && performance.now() - d.t0 < 450) {
            // a tap: the glyph stays chosen, for a tap on the lattice or the arrow keys
            this.cursor = this.bestCursor(d.slot);
            return;
        }
        const G = this.getG();
        if (canPlace(G, this.piece(d.slot).cells, a.x, a.y)) this.place(d.slot, a.x, a.y);
        else if (a.x > -3 && a.y > -3 && a.x < N && a.y < N) this.audio.ui('deny');
    }

    place(slot, x, y) {
        const ok = this.doAct({ t: 'place', i: slot, x, y });
        if (ok) {
            this.sel = -1;
            this.hover = null;
            const G = this.getG();
            // keep a keyboard player's hands busy: choose the next glyph straight away
            if (this.aim === 'keys') { this.sel = this.firstSlot(slot + 1); if (this.sel >= 0) this.cursor = this.bestCursor(this.sel, this.cursor); }
            if (G.over) this.sel = -1;
        }
        return ok;
    }

    /** A sensible starting spot for a chosen glyph: near the last cursor, legal if possible. */
    bestCursor(slot, near = { x: 3, y: 3 }) {
        const G = this.getG(), h = G.hand[slot];
        if (!h) return near;
        const { w, h: hh } = sizeOf(h.cells);
        let best = { x: clamp(near.x, 0, N - w), y: clamp(near.y, 0, N - hh) }, bd = Infinity;
        for (let y = 0; y + hh <= N; y++) for (let x = 0; x + w <= N; x++) {
            if (!canPlace(G, h.cells, x, y)) continue;
            const d = (x - near.x) ** 2 + (y - near.y) ** 2;
            if (d < bd) { bd = d; best = { x, y }; }
        }
        return best;
    }

    // ------------------------------------------------------------------ powers

    power(p) {
        if (!this.enabled()) return;
        const G = this.getG();
        const P = POWERS[p];
        if (this.target === p) { this.target = null; this.audio.ui('close'); return; }
        if (!G.owned.includes(p)) { this.ui.toast(`Rekindle ${ARCANA[P.from].name} (${ARCANA[P.from].numeral}) to awaken ${P.name}.`); this.audio.ui('deny'); return; }
        if (G.sparks < P.cost) { this.ui.toast(`${P.name} needs ${P.cost} spark${P.cost > 1 ? 's' : ''}.`); this.audio.ui('deny'); return; }
        if (!powerUsable(G, p)) { this.ui.toast(`${P.name} would do nothing now.`); this.audio.ui('deny'); return; }
        if (p === 'transmute' || p === 'starfall') { this.doAct({ t: 'power', p }); this.sel = -1; return; }
        if (p === 'turn') {
            const slot = this.sel >= 0 && G.hand[this.sel] ? this.sel : this.firstSlot();
            if (slot < 0) return;
            this.doAct({ t: 'power', p, i: slot });
            this.sel = slot;
            const h = G.hand[slot];
            const { w, h: hh } = sizeOf(h.cells);
            this.cursor = { x: clamp(this.cursor.x, 0, N - w), y: clamp(this.cursor.y, 0, N - hh) };
            return;
        }
        // lantern and strike aim at a cell first
        this.target = p;
        this.sel = -1;
        this.cursor = { x: clamp(this.cursor.x, 0, N - 1), y: clamp(this.cursor.y, 0, N - 1) };
        this.audio.ui('open');
        this.ui.hint(p === 'strike' ? 'Tower Strike: choose the centre of a 3×3 to shatter.' : 'Lantern: choose an empty cell to light.');
    }

    fire(x, y) {
        const p = this.target;
        const ok = this.doAct({ t: 'power', p, x, y });
        if (ok) { this.target = null; this.ui.hint(null); }
        return ok;
    }

    // ------------------------------------------------------------------ keys

    /** Handle one queued press in play. Returns 'pause' to ask for the pause menu. */
    key(k) {
        const G = this.getG();
        if (!this.enabled()) { this.view.skipCine(); return null; }
        const dirs = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
        if (k === 'KeyP') return 'pause';
        if (k === 'Escape') {
            if (this.target) { this.target = null; this.ui.hint(null); return null; }
            if (this.sel >= 0) { this.sel = -1; return null; }
            return 'pause';
        }
        const powers = { KeyT: 'transmute', KeyL: 'lantern', KeyR: 'turn', KeyB: 'strike', KeyF: 'starfall' };
        if (powers[k]) { this.aim = 'keys'; this.power(powers[k]); return null; }
        const digit = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[k];
        if (digit !== undefined) {
            if (G.hand[digit]) { this.choose(digit); this.audio.ui('pick'); } else this.audio.ui('deny');
            return null;
        }
        if (k === 'Tab') {
            const s = this.firstSlot(this.sel + 1);
            if (s >= 0) { this.choose(s); this.audio.ui('pick'); }
            return null;
        }
        if (dirs[k]) {
            this.aim = 'keys';
            if (!this.target && (this.sel < 0 || !G.hand[this.sel])) {
                const s = this.firstSlot();
                if (s < 0) return null;
                this.choose(s);
                return null;
            }
            const [dx, dy] = dirs[k];
            const lim = this.target ? { w: 1, h: 1 } : sizeOf(G.hand[this.sel].cells);
            this.cursor = { x: clamp(this.cursor.x + dx, 0, N - lim.w), y: clamp(this.cursor.y + dy, 0, N - lim.h) };
            this.audio.ui('move');
            return null;
        }
        if (k === 'Space' || k === 'Enter' || k === 'NumpadEnter' || k === 'KeyZ') {
            this.aim = 'keys';
            if (this.target) { if (!this.fire(this.cursor.x, this.cursor.y)) this.audio.ui('deny'); return null; }
            if (this.sel < 0 || !G.hand[this.sel]) { const s = this.firstSlot(); if (s >= 0) this.choose(s); return null; }
            const h = G.hand[this.sel];
            if (canPlace(G, h.cells, this.cursor.x, this.cursor.y)) this.place(this.sel, this.cursor.x, this.cursor.y);
            else this.audio.ui('deny');
        }
        return null;
    }

    choose(slot) {
        this.aim = 'keys';
        this.target = null;
        this.ui.hint(null);
        this.sel = slot;
        this.cursor = this.bestCursor(slot, this.cursor);
    }

    // ------------------------------------------------------------------ what the view should show

    viewState(time) {
        const G = this.getG();
        const fk = `${G.moves}:${G.hand.map((h) => h?.uid + ':' + h?.cells.length + ':' + h?.cells[0]).join(',')}:${G.cells.join('')}`;
        if (fk !== this.fitKey) { this.fitKey = fk; this.fits = G.hand.map((h) => !!h && fitsAnywhere(G, h.cells)); }
        const s = { sel: this.sel, fits: this.fits, drag: null, ghost: null, lines: null, hide: null };
        if (G.over) return s;
        let anchor = null, slot = -1;
        const d = this.drag;
        if (d && this.piece(d.slot)) {
            const k = Math.min(1, (performance.now() - d.t0) / 120);
            d.s = this.view.board.handScale + (1 - this.view.board.handScale) * k;
            s.drag = { slot: d.slot, cx: d.cx, cy: d.cy, s: d.s };
            s.hide = new Set([d.slot]);
            slot = d.slot;
            if (d.moved) {
                anchor = this.dragAnchor();
                const { w, h } = sizeOf(this.piece(d.slot).cells);
                if (anchor.x < -w || anchor.y < -h || anchor.x > N || anchor.y > N) anchor = null;
            }
        } else if (this.target) {
            const c = this.aim === 'keys' ? this.cursor : this.hover;
            if (c) {
                const cells = [];
                if (this.target === 'strike') { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cells.push([c.x + dx, c.y + dy]); }
                else cells.push([c.x, c.y]);
                const filled = cells.some(([x, y]) => x >= 0 && y >= 0 && x < N && y < N && G.cells[y * N + x]);
                const valid = this.target === 'strike' ? filled : !G.cells[c.y * N + c.x];
                s.ghost = { cells, color: this.target === 'strike' ? 2 : 3, valid };
            }
            return s;
        } else if (this.sel >= 0 && G.hand[this.sel]) {
            slot = this.sel;
            if (this.aim === 'keys') anchor = this.cursor;
            else if (this.hover) anchor = this.centreAnchor(G.hand[this.sel], this.hover.x, this.hover.y);
        }
        if (anchor && slot >= 0) {
            const h = G.hand[slot];
            const valid = canPlace(G, h.cells, anchor.x, anchor.y);
            s.ghost = { cells: h.cells.map(([x, y]) => [anchor.x + x, anchor.y + y]), color: h.color, valid };
            if (valid) {
                const L = wouldClear(G, h.cells, anchor.x, anchor.y);
                if (L.rows.length || L.cols.length) s.lines = { ...L, color: h.color };
            }
        }
        return s;
    }
}
