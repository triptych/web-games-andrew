// Keyboard, gamepad and touch merged into one state for the sim, plus an ordered queue of menu presses.
//
// - Held directions are read every frame.
// - Jump, Spin, Power and shell swaps are *edges* that stay set until a simulation step consumes them:
//   a frame shorter than the fixed step runs no step, and a tap made in it must not be lost.
// - A held button is latched too: a key pressed and released inside one frame still counts as held for
//   one step (otherwise a quick tap on Power would never charge a hop or raise the shield).
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not collapse.

const KEYS = {
    jump: ['Space', 'KeyZ', 'KeyK'],
    spin: ['KeyX', 'KeyJ', 'KeyF'],
    power: ['KeyC', 'KeyL', 'ShiftLeft', 'ShiftRight'],
};
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
const PAD_MENU = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.edge = { jump: false, spin: false, power: false, swap: 0, sel: 0 };
        this.touchHeld = { jump: false, power: false };
        this.latch = { jump: false, power: false };
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, prev: [], jump: false, power: false };
        this.lastDevice = 'keys';
        this.onTouch = null;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused button:
            // preventDefault() on it would cancel the click (game-078).
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (KEYS.jump.includes(e.code)) { this.edge.jump = true; this.latch.jump = true; }
            if (KEYS.spin.includes(e.code)) this.edge.spin = true;
            if (KEYS.power.includes(e.code)) { this.edge.power = true; this.latch.power = true; }
            if (e.code === 'KeyQ') this.edge.swap = -1;
            if (e.code === 'KeyE' || e.code === 'Tab') this.edge.swap = 1;
            if (/^Digit[1-5]$/.test(e.code)) this.edge.sel = +e.code.slice(5);
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        // Capture phase, so a touch on any menu switches the touch deck on before play starts (game-074).
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    /** A floating stick: the zone captures the thumb, el is the ring, knob follows the thumb. */
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
                const k = (d - rad) / d;                // drag the base along so the thumb never runs off the end
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

    /** A touch button that acts on finger-down. hold: also report it as held until the finger lifts. */
    bindButton(btn, name, { hold = false } = {}) {
        const down = (e) => {
            e.preventDefault();
            if (name === 'swap') this.edge.swap = 1;
            else { this.edge[name] = true; if (hold) { this.touchHeld[name] = true; this.latch[name] = true; } }
            btn.classList.add('down');
            try { btn.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        };
        const up = () => { if (hold) this.touchHeld[name] = false; btn.classList.remove('down'); };
        btn.addEventListener('pointerdown', down);
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, up);
    }

    press(name) { if (name === 'swap') this.edge.swap = 1; else this.edge[name] = true; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; this.pad.jump = this.pad.power = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.22 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        for (const i in PAD_MENU) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_MENU[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        const jump = b(0), power = b(1) || b(7), spin = b(2), next = b(5) || b(3), prev = b(4);
        if (jump && !this.pad.jump) { this.edge.jump = true; this.latch.jump = true; }
        if (power && !this.pad.power) { this.edge.power = true; this.latch.power = true; }
        if (spin && !this.pad.spin) this.edge.spin = true;
        if (next && !this.pad.next) this.edge.swap = 1;
        if (prev && !this.pad.back) this.edge.swap = -1;
        this.pad.jump = jump; this.pad.power = power; this.pad.spin = spin; this.pad.next = next; this.pad.back = prev;
    }

    /** The state for this frame, in the shape the sim wants. Edges stay set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        if (this.stick.active && Math.hypot(this.stick.x, this.stick.y) > 0.18) { x = this.stick.x; y = this.stick.y; }
        const held = (list) => list.some((c) => k.has(c));
        const jumpHeld = held(KEYS.jump) || this.pad.jump || this.touchHeld.jump || this.latch.jump;
        const powerHeld = held(KEYS.power) || this.pad.power || this.touchHeld.power || this.latch.power;
        return {
            x, y,
            jump: this.edge.jump, jumpHeld,
            spin: this.edge.spin,
            power: this.edge.power, powerHeld,
            swap: this.edge.swap, sel: this.edge.sel,
        };
    }

    /** Once a simulation step has seen the edges they can go. The latches clear too, so a held key is read from keys. */
    consumeEdges() {
        this.edge.jump = this.edge.spin = this.edge.power = false;
        this.edge.swap = 0; this.edge.sel = 0;
        this.latch.jump = this.latch.power = false;
    }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.consumeEdges(); }
    clear() {
        this.keys.clear();
        this.flush();
        this.touchHeld.jump = this.touchHeld.power = false;
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
    }
}
