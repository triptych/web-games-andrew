// Keyboard, gamepad and touch merged into one state, { x, y, focus, bomb, warp, burst }, plus an ordered queue of
// presses for the menus and scenes.
//
// - Held directions and focus are read every frame.
// - Bomb, warp and burst are *edges* that stay set until a simulation step consumes them: a frame shorter than the
//   fixed step runs no step, and a tap made in it must not be lost.
// - Menu presses go into a FIFO, one consumed per frame.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const KEYS = { bomb: ['KeyX', 'KeyK'], warp: ['KeyC', 'KeyL'], burst: ['Space', 'KeyV'] };
const FOCUS = ['ShiftLeft', 'ShiftRight', 'KeyZ', 'KeyJ'];
// standard gamepad: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 9 Start, 12-15 d-pad
const PAD_MENU = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.edges = { bomb: false, warp: false, burst: false };
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, focus: false, prev: [] };
        this.touchFocus = false;
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.onAny = null;                  // any press (scenes advance on it)

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused button
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            for (const [k, codes] of Object.entries(KEYS)) if (codes.includes(e.code)) this.edges[k] = true;
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    /** A floating stick: zone captures the thumb, el is the ring, knob follows the thumb. */
    bindStick(zone, el, knob) {
        const R = () => Math.min(70, Math.max(44, window.innerWidth * 0.11));
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

    /** A touch button that acts on finger-down. */
    bindButton(btn, onPress) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(); });
    }
    /** A touch button held for as long as the finger stays on it. */
    bindHold(btn, set) {
        const on = (e) => { e.preventDefault(); set(true); btn.classList.add('on'); };
        const off = () => { set(false); btn.classList.remove('on'); };
        btn.addEventListener('pointerdown', on);
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, off);
    }

    press(k) { this.edges[k] = true; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; this.pad.focus = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.22 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        this.pad.focus = b(5) || b(7) || b(2);
        const edge = (i) => b(i) && !this.pad.prev[i];
        for (const i in PAD_MENU) if (edge(+i)) { this.queue.push({ key: PAD_MENU[i], pad: true }); this.lastDevice = 'pad'; }
        if (edge(0)) this.edges.bomb = true;
        if (edge(1)) this.edges.warp = true;
        if (edge(3)) this.edges.burst = true;
        for (let i = 0; i < 16; i++) this.pad.prev[i] = b(i);
    }

    /** The held state for this frame. Edges stay set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        if (this.stick.active) {
            const sx = this.stick.x, sy = this.stick.y;
            if (Math.hypot(sx, sy) > 0.15) { x = sx; y = sy; } else { x = 0; y = 0; }
        }
        const focus = FOCUS.some((c) => k.has(c)) || this.pad.focus || this.touchFocus;
        return { x, y, focus, bomb: this.edges.bomb, warp: this.edges.warp, burst: this.edges.burst };
    }

    consumeEdges() { this.edges.bomb = this.edges.warp = this.edges.burst = false; }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.consumeEdges(); }
    clear() {
        this.keys.clear();
        this.flush();
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
        this.touchFocus = false;
    }
}
