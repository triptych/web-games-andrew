// Keyboard, gamepad and touch merged into one state, { x, y, run, a, cam }, plus an ordered queue
// of presses for the menus.
//
// - Held directions are read every frame.
// - The action press is an *edge* that stays set until a simulation step consumes it: a frame
//   shorter than the fixed step runs no step, and a tap made in it must not be lost.
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.

const ACTION_KEYS = ['Space', 'KeyZ', 'KeyJ'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 3: 'Tab' };

export class Input {
    constructor(canvas) {
        this.keys = new Set();
        this.queue = [];
        this.edges = { a: false };
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, prev: [] };
        this.runBtn = false;
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.onDrag = null;          // (dx, dy) one finger on the canvas
        this.onZoom = null;          // (factor)
        this.onTap = null;           // (clientX, clientY)

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (e.code === 'Escape' || e.code === 'Enter') e.target.blur(); return; }
            // Space and the arrows must not scroll the page, but Space and Enter must still press a focused button
            if (NO_SCROLL.includes(e.code) && !((e.code === 'Space' || e.code === 'Enter') && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) { return; }
            this.queue.push({ key: e.code, onButton: tag === 'BUTTON' && e.target.getClientRects().length > 0 });
            // a press on a focused button, or while a screen is up, belongs to that screen, not the field
            if (ACTION_KEYS.includes(e.code) && !(this.canAct && !this.canAct()) && tag !== 'BUTTON') this.edges.a = true;
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        // Capture phase, so a touch on any menu switches the touch deck on before play starts.
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });

        // the canvas: one finger drags the camera, two pinch, a short press is a tap
        const pts = new Map();
        let moved = 0, pinch = 0, downT = 0;
        canvas.addEventListener('pointerdown', (e) => {
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pts.size === 1) { moved = 0; downT = performance.now(); }
            if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
            try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        canvas.addEventListener('pointermove', (e) => {
            const p = pts.get(e.pointerId);
            if (!p) return;
            const dx = e.clientX - p.x, dy = e.clientY - p.y;
            p.x = e.clientX; p.y = e.clientY;
            if (pts.size === 1) { moved += Math.abs(dx) + Math.abs(dy); if (moved > 10) this.onDrag?.(dx, dy); }
            else if (pts.size === 2) {
                const [a, b] = [...pts.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                if (pinch > 0) this.onZoom?.(pinch / Math.max(1, d));
                pinch = d; moved = 99;
            }
        });
        const up = (e) => {
            if (!pts.has(e.pointerId)) return;
            const single = pts.size === 1;
            pts.delete(e.pointerId);
            if (single && moved < 10 && performance.now() - downT < 500) this.onTap?.(e.clientX, e.clientY);
        };
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
        canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.onZoom?.(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    }

    /** A floating stick: zone captures the thumb, el is the visual ring, knob follows the thumb. */
    bindStick(zone, el, knob) {
        const R = () => Math.min(70, Math.max(48, window.innerWidth * 0.12));
        const end = (e) => {
            if (e.pointerId !== this.stick.id) return;
            this.stick.active = false;
            this.stick.x = this.stick.y = 0;
            knob.style.transform = '';
            el.classList.remove('on');
        };
        zone.addEventListener('pointerdown', (e) => {
            if (this.stick.active) return;
            e.preventDefault();
            const r = zone.getBoundingClientRect();
            Object.assign(this.stick, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
            el.style.left = `${e.clientX - r.left}px`;
            el.style.top = `${e.clientY - r.top}px`;
            el.style.bottom = 'auto';
            el.classList.add('on');
            try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        zone.addEventListener('pointermove', (e) => {
            if (!this.stick.active || e.pointerId !== this.stick.id) return;
            e.preventDefault();
            const rad = R();
            let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
            const d = Math.hypot(dx, dy);
            if (d > rad) {
                const k = (d - rad) / d;
                this.stick.ox += dx * k; this.stick.oy += dy * k;
                const r = zone.getBoundingClientRect();
                el.style.left = `${this.stick.ox - r.left}px`;
                el.style.top = `${this.stick.oy - r.top}px`;
                dx = e.clientX - this.stick.ox; dy = e.clientY - this.stick.oy;
            }
            this.stick.x = dx / rad; this.stick.y = dy / rad;
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, end);
    }

    /** A touch button that acts on finger-down (a click waits for the lift and feels late). */
    bindButton(btn, onPress) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(); });
    }
    bindHold(btn, set) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); try { btn.setPointerCapture(e.pointerId); } catch { /* */ } });
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, () => set(false));
    }

    pressA() { this.edges.a = true; }

    pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.25 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        if (b(0) && !this.pad.prev.a) this.edges.a = true;
        this.pad.prev.a = b(0);
        this.pad.run = b(2) || b(7);
    }

    /** The held state for this frame. The action edge stays set until consumeEdges(). */
    state() {
        this.pollPad();
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        if (this.stick.active && Math.hypot(this.stick.x, this.stick.y) > 0.2) { x = this.stick.x; y = this.stick.y; }
        const run = k.has('ShiftLeft') || k.has('ShiftRight') || this.runBtn || !!this.pad.run || (this.stick.active && Math.hypot(this.stick.x, this.stick.y) > 0.85);
        const cam = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
        return { x, y, run, a: this.edges.a, cam };
    }

    consumeEdges() { this.edges.a = false; }
    next() { this.pollPad(); return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.edges.a = false; }
    clear() {
        this.keys.clear();
        this.flush();
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
        this.runBtn = false;
    }
}
