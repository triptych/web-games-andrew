// Keyboard, gamepad and touch merged into one state, plus an ordered queue of presses.
//
// - Held directions are read every frame.
// - Button presses are *edges* that stay set until a simulation step consumes them: a frame
//   shorter than the fixed step runs no step, and a tap made in it must not be lost. A button
//   that is held reports `ah` / `bh` as well, so hold-to-fire works.
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.
// - A tap on the picture is an edge too: { x, y } in cells, consumed by the next step.

const A_KEYS = ['Space', 'KeyZ', 'KeyJ'];
const B_KEYS = ['KeyX', 'KeyK'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];                    // { key } in the order they were pressed
        this.edges = { a: false, b: false, tap: null };
        this.touchHeld = { a: false, b: false };
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, a: false, b: false, prev: [] };
        this.virtual = { x: 0, y: 0 };      // the on-screen d-pad of the Press's test stage
        this.lastDevice = 'keys';
        this.onTouch = null;                // called once when a touch is first seen

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click.
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (A_KEYS.includes(e.code)) this.edges.a = true;
            if (B_KEYS.includes(e.code)) this.edges.b = true;
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
                // drag the base along so the thumb never runs off the end
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

    /** A touch button that acts on finger-down (a click waits for the lift and feels late) and reports held. */
    bindButton(btn, which) {
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.edges[which] = true;
            this.touchHeld[which] = true;
            try { btn.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, () => { this.touchHeld[which] = false; });
    }

    /** A direction button of the Press's on-screen pad. */
    bindPad(btn, dx, dy) {
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.virtual.x += dx; this.virtual.y += dy;
            btn._on = true;
            try { btn.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        const off = () => { if (btn._on) { btn._on = false; this.virtual.x -= dx; this.virtual.y -= dy; } };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, off);
    }

    press(which) { this.edges[which] = true; }
    tap(cell) { this.edges.tap = cell; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; this.pad.a = this.pad.b = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.25 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        if (b(0) && !this.pad.a) this.edges.a = true;
        if (b(2) && !this.pad.b) this.edges.b = true;
        this.pad.a = b(0); this.pad.b = b(2);
    }

    /** The state for this frame. Edges stay set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
        if (this.virtual.x || this.virtual.y) { x = this.virtual.x; y = this.virtual.y; }
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        if (this.stick.active) {
            const sx = this.stick.x, sy = this.stick.y;
            if (Math.hypot(sx, sy) > 0.2) { x = sx; y = sy; }
        }
        const ah = A_KEYS.some((c) => k.has(c)) || this.touchHeld.a || this.pad.a;
        const bh = B_KEYS.some((c) => k.has(c)) || this.touchHeld.b || this.pad.b;
        return { x, y, a: this.edges.a, b: this.edges.b, ah, bh, tap: this.edges.tap };
    }

    consumeEdges() { this.edges.a = false; this.edges.b = false; this.edges.tap = null; }
    /** The next queued press, or null. Menus take one per frame. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; this.consumeEdges(); }
    clear() {
        this.keys.clear();
        this.flush();
        this.touchHeld.a = this.touchHeld.b = false;
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
    }
}
