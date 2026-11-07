// Pointer, keyboard and gamepad, merged.
//
// On the town view: one finger or the mouse drags the map, a short press with no travel is a tap,
// two fingers pinch to zoom, the wheel zooms. While a building is being placed a mouse follows the
// ghost and a touch drags it. Keys are kept in an ordered queue, one consumed per frame, so
// "Down, Down, Enter" at 2 fps does not collapse into one frame's worth of keys.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 4: 'Digit1', 5: 'Digit3' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.pad = { x: 0, y: 0, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.h = {};                         // handlers, set by main
        this.pointers = new Map();
        this.gesture = null;
        this.placing = () => false;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            // Space and the arrows must not scroll the page, but Space must still press a focused button
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (!e.repeat) this.queue.push({ key: e.code });
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        // capture phase, so any touch switches the touch layout on
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    bindCanvas(canvas) {
        this.canvas = canvas;
        const pos = (e) => ({ x: e.clientX, y: e.clientY });
        canvas.addEventListener('pointerdown', (e) => {
            if (e.button === 2) return;
            canvas.setPointerCapture?.(e.pointerId);
            this.pointers.set(e.pointerId, { ...pos(e), sx: e.clientX, sy: e.clientY, t: e.timeStamp, type: e.pointerType, moved: false });
            if (this.pointers.size === 2) this.beginPinch();
            else if (this.pointers.size === 1) this.gesture = { mode: 'one', moved: false };
            if (e.pointerType === 'touch' && this.placing()) this.h.hover?.(e.clientX, e.clientY, true);
        });
        canvas.addEventListener('pointermove', (e) => {
            const p = this.pointers.get(e.pointerId);
            if (!p) { if (e.pointerType === 'mouse') this.h.hover?.(e.clientX, e.clientY, false); return; }
            const dx = e.clientX - p.x, dy = e.clientY - p.y;
            p.x = e.clientX; p.y = e.clientY;
            if (this.pointers.size >= 2) { this.updatePinch(); return; }
            if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > (p.type === 'touch' ? 10 : 6)) p.moved = true;
            if (this.placing()) { this.h.hover?.(e.clientX, e.clientY, p.type === 'touch'); return; }
            if (p.moved) this.h.pan?.(dx, dy);
        });
        const up = (e) => {
            const p = this.pointers.get(e.pointerId);
            if (!p) return;
            this.pointers.delete(e.pointerId);
            const wasPinch = this.gesture?.mode === 'pinch';
            if (this.pointers.size === 0) {
                // the event's own timestamps: a slow frame between the two events must not turn a tap into a long press
                const quick = e.timeStamp - p.t < 700;
                if (!wasPinch && !p.moved && quick && e.type === 'pointerup') this.h.tap?.(e.clientX, e.clientY, p.type);
                else if (p.type === 'touch' && this.placing() && e.type === 'pointerup') this.h.hover?.(e.clientX, e.clientY, true);
                this.gesture = null;
            } else if (this.pointers.size === 1) {
                const q = [...this.pointers.values()][0];
                q.sx = q.x; q.sy = q.y; q.moved = true; this.gesture = { mode: 'one', moved: true };
            }
        };
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);
        canvas.addEventListener('lostpointercapture', (e) => { if (this.pointers.has(e.pointerId) && this.pointers.size === 1 && !this.pointers.get(e.pointerId).moved) { /* captured away: ignore */ } });
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
            this.h.zoom?.(f, e.clientX, e.clientY);
        }, { passive: false });
        canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.h.cancel?.(); });
    }

    beginPinch() {
        const [a, b] = [...this.pointers.values()];
        this.gesture = { mode: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        for (const p of this.pointers.values()) p.moved = true;
    }
    updatePinch() {
        const g = this.gesture;
        if (!g || g.mode !== 'pinch') return;
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        this.h.zoom?.(d / g.d, cx, cy);
        this.h.pan?.(cx - g.cx, cy - g.cy);
        g.d = d; g.cx = cx; g.cy = cy;
    }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.25 ? v : 0);
        this.pad.x = dead(gp.axes[0] || 0); this.pad.y = dead(gp.axes[1] || 0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
    }

    /** Held pan direction from keys and stick, each in [-1, 1]. */
    pan() {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        return { x, y };
    }
    zoomKey() { return (this.keys.has('Equal') || this.keys.has('NumpadAdd') ? 1 : 0) - (this.keys.has('Minus') || this.keys.has('NumpadSubtract') ? 1 : 0); }

    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
    clear() { this.keys.clear(); this.flush(); this.pointers.clear(); this.gesture = null; }
}
