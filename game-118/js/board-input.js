// Mouse, touch and keyboard on the board, turned into sim commands. Never writes G itself.
//
//   tap an item     select it (lifted, ringed); tap another cell to move or merge it there
//   tap a generator harvest it
//   drag            pick the item up; drop on a cell (move, merge or swap), on a guest card (serve it)
//                   or on the compost bin. On touch the item rides above the finger so it stays visible.
//   arrows + Space  a cursor on the board; Space/Enter acts like a tap, Delete or C composts
//
// A press that wandered a few pixels is a drag, not a tap (a drag that moves things never also taps).

import { COLS, ROWS } from './config.js';
import { isOpen, idx, colOf, rowOf } from './sim/game.js';

const DRAG_PX = { touch: 9, mouse: 5, pen: 6 };

export class BoardInput {
    constructor({ canvas, view, getG, act, canPlay, audio }) {
        Object.assign(this, { canvas, view, getG, act, canPlay, audio });
        this.selected = -1;
        this.cursor = -1;
        this.hover = -1;
        this.press = null;
        this.lastTouch = performance.now();
        this.dragging = false;

        canvas.addEventListener('pointerdown', (e) => this.down(e));
        canvas.addEventListener('pointermove', (e) => this.move(e));
        canvas.addEventListener('pointerup', (e) => this.up(e));
        canvas.addEventListener('pointercancel', (e) => this.cancel(e));
        canvas.addEventListener('lostpointercapture', (e) => this.cancel(e));
        canvas.addEventListener('pointerleave', () => { this.hover = -1; });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /** Anything the player does calls this, so the idle hint waits. */
    touch() { this.lastTouch = performance.now(); }
    idleFor() { return (performance.now() - this.lastTouch) / 1000; }

    clearSelection() { this.selected = -1; }
    reset() { this.selected = -1; this.cursor = -1; this.hover = -1; this.press = null; this.dragging = false; this.view.endDrag(); this.clearHot(); }

    down(e) {
        if (!this.canPlay()) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        this.touch();
        const G = this.getG();
        const cell = this.view.cellAt(e.clientX, e.clientY);
        if (cell < 0 || !isOpen(G, cell)) { this.selected = -1; return; }
        this.press = { id: e.pointerId, cell, x: e.clientX, y: e.clientY, drag: false, type: e.pointerType || 'mouse' };
        this.cursor = -1;
        try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    }

    move(e) {
        const p = this.press;
        if (!p || e.pointerId !== p.id) {
            if (e.pointerType === 'mouse' && this.canPlay()) this.hover = this.view.cellAt(e.clientX, e.clientY);
            return;
        }
        this.touch();
        const G = this.getG();
        if (!p.drag) {
            if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < (DRAG_PX[p.type] || 6)) return;
            if (!G.cells[p.cell]) return;
            p.drag = this.view.beginDrag(G, p.cell, e.clientX, e.clientY, p.type === 'touch');
            if (p.drag) { this.selected = -1; this.dragging = true; this.audio.ui('pick'); }
            return;
        }
        this.view.moveDrag(e.clientX, e.clientY);
        this.updateHot(e.clientX, e.clientY);
    }

    up(e) {
        const p = this.press;
        if (!p || e.pointerId !== p.id) return;
        this.press = null;
        this.touch();
        const G = this.getG();
        if (!p.drag) { if (this.canPlay()) this.tap(p.cell); return; }
        // dropped on a DOM target (a guest, the compost bin) or on the board
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const target = el && el.closest('[data-drop],[data-q]');
        const it = G.cells[p.cell];
        let cmd = null;
        if (target && target.dataset.drop === 'compost') cmd = it && it.k === 'item' ? { t: 'compost', cell: p.cell } : null;
        else if (target && target.dataset.q) cmd = it && it.k === 'item' ? { t: 'serve', q: +target.dataset.q, prefer: p.cell } : null;
        else {
            const to = this.view.dragCell();
            if (to >= 0 && isOpen(G, to) && to !== p.cell) cmd = { t: 'move', from: p.cell, to };
        }
        this.view.endDrag();
        this.dragging = false;
        this.clearHot();
        if (cmd) this.act(cmd);
    }

    cancel(e) {
        const p = this.press;
        if (!p || (e && e.pointerId !== p.id)) return;
        this.press = null;
        this.view.endDrag();
        this.dragging = false;
        this.clearHot();
    }

    updateHot(x, y) {
        const el = document.elementFromPoint(x, y);
        const hot = el && el.closest('[data-drop],[data-q]');
        for (const n of document.querySelectorAll('.hot')) if (n !== hot) n.classList.remove('hot');
        if (hot) hot.classList.add('hot');
    }
    clearHot() { for (const n of document.querySelectorAll('.hot')) n.classList.remove('hot'); }

    /** A tap, or Space on the cursor: harvest a generator, select an item, or move the selection here. */
    tap(cell) {
        const G = this.getG();
        const it = G.cells[cell];
        if (it && it.k === 'gen' && this.selected < 0) { this.act({ t: 'tap', cell }); return; }
        if (this.selected >= 0) {
            const from = this.selected;
            this.selected = -1;
            if (from !== cell) this.act({ t: 'move', from, to: cell });
            return;
        }
        if (it) { this.selected = cell; this.audio.ui('select'); }
    }

    /** A key press when no screen is open. Returns true if it was used. */
    key(code) {
        const G = this.getG();
        const open = (i) => i >= 0 && isOpen(G, i);
        const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
        this.touch();
        if (dirs[code]) {
            if (this.cursor < 0) { this.cursor = open(this.selected) ? this.selected : idx(2, 3); return true; }
            let c = colOf(this.cursor), r = rowOf(this.cursor);
            const [dx, dy] = dirs[code];
            for (let k = 0; k < Math.max(COLS, ROWS); k++) {
                c += dx; r += dy;
                if (c < 0 || c >= COLS || r < 0 || r >= ROWS) break;
                if (open(idx(c, r))) { this.cursor = idx(c, r); this.audio.ui('select'); break; }
            }
            return true;
        }
        if (code === 'Enter' || code === 'Space') {
            if (this.cursor < 0) this.cursor = idx(2, 3);
            this.tap(this.cursor);
            return true;
        }
        if (code === 'Escape' && this.selected >= 0) { this.selected = -1; this.audio.ui('close'); return true; }
        if (code === 'Delete' || code === 'Backspace' || code === 'KeyC') {
            const cell = this.selected >= 0 ? this.selected : this.cursor;
            if (cell >= 0 && G.cells[cell] && G.cells[cell].k === 'item') { this.selected = -1; this.act({ t: 'compost', cell }); }
            return true;
        }
        return false;
    }

    marks() {
        return { cursor: this.cursor, selected: this.selected, hover: this.hover };
    }
}
