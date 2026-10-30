// Keyboard, gamepad and touch merged into one state, { x, y, fire, bomb }, plus an ordered queue of presses.
//
// - Held directions and the fire button are read every frame.
// - Fire and bomb presses are also *edges* that stay set until a simulation step consumes them: a frame
//   shorter than the fixed step runs no step, and a tap made in it must not be lost (a keydown and keyup
//   in the same frame still fires once).
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.

const FIRE_KEYS = ['Space', 'KeyZ', 'KeyJ'];
const BOMB_KEYS = ['KeyX', 'KeyB', 'KeyK', 'ShiftLeft', 'ShiftRight'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];                    // { key } in the order they were pressed
        this.edges = { fire: false, bomb: false };
        this.touchFire = false;             // the on-screen FIRE button is held
        this.autofire = false;              // fire is always on (touch default)
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, fire: false, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;                // called once when a touch is first seen

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (FIRE_KEYS.includes(e.code)) this.edges.fire = true;
            if (BOMB_KEYS.includes(e.code)) this.edges.bomb = true;
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

    /** A floating stick: zone (the whole screen; buttons sit above it) captures the thumb, el is the visual ring, knob follows the thumb. */
    bindStick(zone, el, knob) {
        // a short throw: full speed after ~30 px of drag, so the ship answers a small movement at once
        const R = () => Math.min(40, Math.max(26, window.innerWidth * 0.07));
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

    /** The on-screen FIRE button: held while the finger is down, and a tap always fires at least once. */
    bindFire(btn) {
        const down = (e) => { e.preventDefault(); this.touchFire = true; this.edges.fire = true; btn.classList.add('down'); try { btn.setPointerCapture(e.pointerId); } catch { /* */ } };
        const up = () => { this.touchFire = false; btn.classList.remove('down'); };
        btn.addEventListener('pointerdown', down);
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, up);
    }

    /** A touch button that acts on finger-down (a click waits for the lift and feels late). */
    bindButton(btn, onPress) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(); });
    }

    pressBomb() { this.edges.bomb = true; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; this.pad.fire = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.25 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        this.pad.fire = b(0) || b(5) || b(7);
        if (this.pad.fire && !this.pad.prev.fire) this.edges.fire = true;
        this.pad.prev.fire = this.pad.fire;
        const bomb = b(1) || b(2) || b(3) || b(4) || b(6);
        if (bomb && !this.pad.prev.bomb) this.edges.bomb = true;
        this.pad.prev.bomb = bomb;
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
            // a small dead zone, then a response curve that gets to full speed early
            const m = Math.hypot(sx, sy);
            if (m > 0.08) { const f = Math.min(1, m * 1.3) / m; x = sx * f; y = sy * f; }
        }
        const held = FIRE_KEYS.some((c) => k.has(c)) || this.pad.fire || this.touchFire || this.autofire;
        return { x, y, fire: held || this.edges.fire, bomb: this.edges.bomb };
    }

    consumeEdges() { this.edges.fire = false; this.edges.bomb = false; }
    /** The next queued press, or null. Menus take one per frame. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; this.edges.fire = false; this.edges.bomb = false; }
    clear() {
        this.keys.clear();
        this.flush();
        this.touchFire = false;
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
    }
}
