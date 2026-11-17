// The play controller (adapted from NEON ARCANA, game-111): turns drags, taps, keys and gamepad
// presses into level commands, and tells the view what to preview (the tile being dragged, its ghost,
// the lines it would clear).
//
// - Drag a tile from the hand and drop it. On touch it floats above the finger, so the finger never
//   hides where it lands.
// - Or tap a tile to choose it, then tap the lattice: the tile is centred on the tapped cell.
// - Or choose with 1 2 3 / Tab, move it with the arrows and place it with Space or Enter.
// - Items (4–8, or the item bar) and skills (R turn, Q redraw, E reclaim) work the same way; the
//   ones that need a target (a cell, or a tile in the hand) wait for it.

import { N } from './config.js';
import { sizeOf } from './sim/data/shapes.js';
import { canPlace, fitsAnywhere, wouldClear, itemUsable, skillUsable, live, has } from './sim/level.js';
import { ITEMS } from './sim/data/potions.js';
import { SKILLS } from './sim/data/skills.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const ITEM_KEYS = { Digit4: 'dissolvent', Digit5: 'catalyst', Digit6: 'vial', Digit7: 'salts', Digit8: 'tonic' };
const SKILL_KEYS = { KeyR: 'swap', KeyQ: 'affinity', KeyE: 'reclaim' };

export class Controller {
    constructor({ view, audio, ui, getL, enabled, act }) {
        this.view = view;
        this.audio = audio;
        this.ui = ui;
        this.getL = getL;
        this.enabled = enabled;
        this.doAct = act;
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
        this.cursor = { x: 4, y: 4 };
        this.drag = null;
        this.target = null;              // an item waiting for a cell ('dissolvent', 'salts') or a tile ('vial', 'swap')
        this.hover = null;
        this.aim = 'pointer';
        this.fitKey = '';
        this.fits = [true, true, true];
    }

    piece(slot) { return this.getL()?.hand[slot] || null; }
    firstSlot(from = 0) {
        const L = this.getL();
        for (let k = 0; k < L.hand.length; k++) { const i = (((from + k) % L.hand.length) + L.hand.length) % L.hand.length; if (L.hand[i]) return i; }
        return -1;
    }

    // ------------------------------------------------------------------ pointers

    down(e) {
        if (!this.enabled()) return;
        const L = this.getL();
        const p = this.view.pick(e.clientX, e.clientY);
        const onBoard = p.fx >= 0 && p.fy >= 0 && p.fx < N && p.fy < N;
        this.aim = 'pointer';
        if (this.target) {
            const kind = this.targetKind();
            if (kind === 'cell' && onBoard) { this.fire({ x: Math.floor(p.fx), y: Math.floor(p.fy) }); return; }
            if (kind === 'shape' && p.slot >= 0 && L.hand[p.slot]) { this.fire({ i: p.slot }); return; }
            this.cancelTarget();
        }
        if (p.slot >= 0 && L.hand[p.slot]) {
            e.preventDefault();
            const h = L.hand[p.slot];
            this.sel = p.slot;
            this.drag = { slot: p.slot, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, touch: e.pointerType === 'touch', t0: performance.now(), s: this.view.board.handScale, ...this.dragCentre(p, h, e.pointerType === 'touch') };
            try { this.view.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
            this.audio.ui('pick');
            return;
        }
        if (onBoard && this.sel >= 0 && this.piece(this.sel)) {
            const a = this.centreAnchor(this.piece(this.sel), Math.floor(p.fx), Math.floor(p.fy));
            if (!this.place(this.sel, a.x, a.y)) this.audio.ui('deny');
        }
    }

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
        if (e.pointerType === 'mouse' && e.target === this.view.canvas && this.getL()) {
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
        if (!d.moved && performance.now() - d.t0 < 450) { this.cursor = this.bestCursor(d.slot); return; }
        if (canPlace(this.getL(), this.piece(d.slot).cells, a.x, a.y)) this.place(d.slot, a.x, a.y);
        else if (a.x > -3 && a.y > -3 && a.x < N && a.y < N) this.audio.ui('deny');
    }

    place(slot, x, y) {
        const ok = this.doAct({ t: 'place', i: slot, x, y });
        if (ok) {
            this.sel = -1;
            this.hover = null;
            const L = this.getL();
            if (this.aim === 'keys' && L && live(L)) { this.sel = this.firstSlot(slot + 1); if (this.sel >= 0) this.cursor = this.bestCursor(this.sel, this.cursor); }
        }
        return ok;
    }

    bestCursor(slot, near = { x: 4, y: 4 }) {
        const L = this.getL(), h = L.hand[slot];
        if (!h) return near;
        const { w, h: hh } = sizeOf(h.cells);
        let best = { x: clamp(near.x, 0, N - w), y: clamp(near.y, 0, N - hh) }, bd = Infinity;
        for (let y = 0; y + hh <= N; y++) for (let x = 0; x + w <= N; x++) {
            if (!canPlace(L, h.cells, x, y)) continue;
            const d = (x - near.x) ** 2 + (y - near.y) ** 2;
            if (d < bd) { bd = d; best = { x, y }; }
        }
        return best;
    }

    // ------------------------------------------------------------------ items and skills

    targetKind() {
        const t = this.target;
        if (!t) return null;
        if (t.skill) return 'shape';
        return ITEMS[t.item].target;
    }

    item(id) {
        if (!this.enabled()) return;
        const L = this.getL();
        if (this.target?.item === id) { this.cancelTarget(); this.audio.ui('close'); return; }
        if (!(L.items[id] > 0)) { this.ui.toast(`No ${ITEMS[id].name} left. Pellerin sells them.`); this.audio.ui('deny'); return; }
        if (!itemUsable(L, id)) { this.ui.toast(`${ITEMS[id].name} would do nothing now.`); this.audio.ui('deny'); return; }
        const kind = ITEMS[id].target;
        if (kind === 'none') { this.doAct({ t: 'item', id }); this.sel = -1; return; }
        if (kind === 'shape') {
            const slot = this.sel >= 0 && L.hand[this.sel]?.cells.length > 1 ? this.sel : L.hand.findIndex((h) => h && h.cells.length > 1);
            if (slot >= 0 && this.sel === slot) { this.doAct({ t: 'item', id, i: slot }); return; }
        }
        this.target = { item: id };
        this.sel = -1;
        this.audio.ui('open');
        this.ui.hint(kind === 'cell' ? (id === 'salts' ? 'Reveal Salts: choose a covered deposit.' : 'Dissolvent: choose a filled cell to dissolve.') : `${ITEMS[id].name}: choose a tile in your hand.`);
    }

    skill(id) {
        if (!this.enabled()) return;
        const L = this.getL();
        if (!has(L, id)) { this.ui.toast(`Learn ${SKILLS[id].name} in the skill tree first.`); this.audio.ui('deny'); return; }
        if (!skillUsable(L, id)) { this.ui.toast(id === 'swap' && L.swapCd > 0 ? `Tile Swap is ready in ${L.swapCd} placements.` : `${SKILLS[id].name} can't be used now.`); this.audio.ui('deny'); return; }
        if (id !== 'swap') { this.doAct({ t: 'skill', id }); this.sel = -1; return; }
        const slot = this.sel >= 0 && L.hand[this.sel]?.cells.length > 1 ? this.sel : -1;
        if (slot >= 0) {
            this.doAct({ t: 'skill', id, i: slot });
            const h = L.hand[slot];
            const { w, h: hh } = sizeOf(h.cells);
            this.cursor = { x: clamp(this.cursor.x, 0, N - w), y: clamp(this.cursor.y, 0, N - hh) };
            return;
        }
        this.target = { skill: id };
        this.audio.ui('open');
        this.ui.hint('Tile Swap: choose a tile in your hand to turn.');
    }

    fire(arg) {
        const t = this.target;
        const cmd = t.skill ? { t: 'skill', id: t.skill, ...arg } : { t: 'item', id: t.item, ...arg };
        const ok = this.doAct(cmd);
        if (ok) { this.target = null; this.ui.hint(null); if (arg.i !== undefined) this.sel = arg.i; }
        else this.audio.ui('deny');
        return ok;
    }
    cancelTarget() { this.target = null; this.ui.hint(null); }

    // ------------------------------------------------------------------ keys

    /** Handle one queued press in play. Returns 'pause' to ask for the pause menu. */
    key(k) {
        const L = this.getL();
        if (!this.enabled()) return null;
        const dirs = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
        if (k === 'KeyP') return 'pause';
        if (k === 'Escape') {
            if (this.target) { this.cancelTarget(); return null; }
            if (this.sel >= 0) { this.sel = -1; return null; }
            return 'pause';
        }
        if (ITEM_KEYS[k]) { this.aim = 'keys'; this.item(ITEM_KEYS[k]); return null; }
        if (SKILL_KEYS[k]) { this.aim = 'keys'; this.skill(SKILL_KEYS[k]); return null; }
        const digit = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[k];
        if (digit !== undefined) {
            if (this.target && this.targetKind() === 'shape') { if (L.hand[digit]) this.fire({ i: digit }); return null; }
            if (L.hand[digit]) { this.choose(digit); this.audio.ui('pick'); } else this.audio.ui('deny');
            return null;
        }
        if (k === 'Tab') {
            const s = this.firstSlot(this.sel + 1);
            if (s >= 0) { this.choose(s); this.audio.ui('pick'); }
            return null;
        }
        if (dirs[k]) {
            this.aim = 'keys';
            const kind = this.targetKind();
            if (kind === 'shape') return null;
            if (!kind && (this.sel < 0 || !L.hand[this.sel])) {
                const s = this.firstSlot();
                if (s >= 0) this.choose(s);
                return null;
            }
            const [dx, dy] = dirs[k];
            const lim = kind === 'cell' ? { w: 1, h: 1 } : sizeOf(L.hand[this.sel].cells);
            this.cursor = { x: clamp(this.cursor.x + dx, 0, N - lim.w), y: clamp(this.cursor.y + dy, 0, N - lim.h) };
            this.audio.ui('move');
            return null;
        }
        if (k === 'Space' || k === 'Enter' || k === 'NumpadEnter' || k === 'KeyZ') {
            this.aim = 'keys';
            const kind = this.targetKind();
            if (kind === 'cell') { this.fire({ x: this.cursor.x, y: this.cursor.y }); return null; }
            if (kind === 'shape') { const s = this.sel >= 0 ? this.sel : this.firstSlot(); if (s >= 0) this.fire({ i: s }); return null; }
            if (this.sel < 0 || !L.hand[this.sel]) { const s = this.firstSlot(); if (s >= 0) this.choose(s); return null; }
            const h = L.hand[this.sel];
            if (canPlace(L, h.cells, this.cursor.x, this.cursor.y)) this.place(this.sel, this.cursor.x, this.cursor.y);
            else this.audio.ui('deny');
        }
        return null;
    }

    choose(slot) {
        this.aim = 'keys';
        if (this.targetKind() !== 'shape') this.cancelTarget();
        this.sel = slot;
        this.cursor = this.bestCursor(slot, this.cursor);
    }

    // ------------------------------------------------------------------ what the view should show

    viewState() {
        const L = this.getL();
        const fk = `${L.moves}:${L.hand.map((h) => h?.uid + ':' + h?.cells.length + ':' + h?.cells[0]).join(',')}:${L.cells.join('')}:${L.foeAt.join('')}`;
        if (fk !== this.fitKey) { this.fitKey = fk; this.fits = L.hand.map((h) => !!h && fitsAnywhere(L, h.cells)); }
        const s = { sel: this.sel, fits: this.fits, drag: null, ghost: null, lines: null, hide: null };
        if (!live(L)) return s;
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
        } else if (this.targetKind() === 'cell') {
            const c = this.aim === 'keys' ? this.cursor : this.hover;
            if (c) {
                const i = c.y * N + c.x;
                const valid = this.target.item === 'salts' ? L.cover[i] > 0 : L.cells[i] > 0;
                s.ghost = { cells: [[c.x, c.y]], el: this.target.item === 'salts' ? 'salt' : 'dew', valid };
            }
            return s;
        } else if (this.sel >= 0 && L.hand[this.sel]) {
            slot = this.sel;
            if (this.aim === 'keys') anchor = this.cursor;
            else if (this.hover) anchor = this.centreAnchor(L.hand[this.sel], this.hover.x, this.hover.y);
        }
        if (anchor && slot >= 0) {
            const h = L.hand[slot];
            const valid = canPlace(L, h.cells, anchor.x, anchor.y);
            s.ghost = { cells: h.cells.map(([x, y]) => [anchor.x + x, anchor.y + y]), el: h.el, valid };
            if (valid) {
                const W = wouldClear(L, h.cells, anchor.x, anchor.y);
                if (W.rows.length || W.cols.length) s.lines = { ...W, el: h.el };
            }
        }
        return s;
    }
}
