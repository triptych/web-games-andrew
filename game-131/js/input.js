// Keyboard, mouse, gamepad and touch merged into one state for the sim, { x, y, turn, dyaw, run, a, cmd }, plus an
// ordered queue of presses for the menus.
//
// - Held directions are read every frame.
// - Presses (interact, a command) are *edges* that stay set until a simulation step consumes them: a frame
//   shorter than the fixed step runs no step, and a tap made in it must not be lost.
// - Looking is accumulated as radians (dyaw) and handed to the sim once; pitch is the view's alone.
// - Menu presses go into a FIFO, one consumed per frame.

const ACTION_KEYS = ['Space', 'KeyE', 'KeyF', 'Enter'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
const PAD_KEYS = { 1: 'Escape', 2: 'KeyH', 3: 'KeyJ', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.queue = [];                    // { key } in the order they were pressed
        this.edges = { a: false, cmd: null };
        this.dyaw = 0;                      // radians turned since the last sim step
        this.pitch = 0;                     // the view's up/down look
        this.sens = 1;
        this.invert = false;
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.lookTouch = { id: null, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, rx: 0, ry: 0, run: false, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;                // called once when a touch is first seen
        this.locked = false;
        this.drag = false;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a slider or a select keeps its own keys, but Escape must still close the sheet it sits in
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // Space and the arrows must not scroll the page, but Space and Enter must still press a focused button
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (ACTION_KEYS.includes(e.code) && tag !== 'BUTTON') this.edges.a = true;
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

        // mouse look: click the view to capture the mouse; or hold a button and drag
        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || this.lastDevice === 'touch') return;
            this.drag = true;
            if (this.wantLock && !this.locked) canvas.requestPointerLock?.()?.catch?.(() => {});
        });
        window.addEventListener('mouseup', () => { this.drag = false; });
        document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
        window.addEventListener('mousemove', (e) => {
            if (!this.locked && !this.drag) return;
            this.look(e.movementX * 0.0024, e.movementY * 0.0024);
        });
    }

    look(dx, dy) {
        this.dyaw += dx * this.sens;
        this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - dy * this.sens * (this.invert ? -1 : 1)));
    }
    releaseMouse() { if (this.locked) document.exitPointerLock?.(); this.drag = false; }

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
                const k = (d - rad) / d;          // drag the base along so the thumb never runs off the end
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

    /** The right half of the screen: drag a finger to look about. */
    bindLook(zone) {
        zone.addEventListener('pointerdown', (e) => {
            if (this.lookTouch.id !== null) return;
            e.preventDefault();
            this.lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
            try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        zone.addEventListener('pointermove', (e) => {
            if (e.pointerId !== this.lookTouch.id) return;
            e.preventDefault();
            this.look((e.clientX - this.lookTouch.x) * 0.0062, (e.clientY - this.lookTouch.y) * 0.0062);
            this.lookTouch.x = e.clientX; this.lookTouch.y = e.clientY;
        });
        const end = (e) => { if (e.pointerId === this.lookTouch.id) this.lookTouch.id = null; };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, end);
    }

    /** A touch button that acts on finger-down (a click waits for the lift and feels late). */
    bindButton(btn, onPress) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(); });
    }

    pressA() { this.edges.a = true; }
    command(cmd) { this.edges.cmd = cmd; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = this.pad.rx = this.pad.ry = 0; this.pad.run = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.22 ? v : 0);
        this.pad.x = dead(gp.axes[0] || 0); this.pad.y = dead(gp.axes[1] || 0);
        this.pad.rx = dead(gp.axes[2] || 0); this.pad.ry = dead(gp.axes[3] || 0);
        this.pad.run = b(7) || b(5) || b(10);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        if (b(0) && !this.pad.prev.a) { this.edges.a = true; this.queue.push({ key: 'Enter', pad: true }); this.lastDevice = 'pad'; }
        this.pad.prev.a = b(0);
    }

    /** The held state for this frame (dt is real seconds, for stick-driven looking). Edges stay set until consumeEdges(). */
    state(dt = 0) {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
        let turn = (k.has('ArrowRight') || k.has('KeyX') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyZ') ? 1 : 0);
        let run = k.has('ShiftLeft') || k.has('ShiftRight');
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        if (this.pad.rx) turn = this.pad.rx;
        if (this.pad.ry) this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - this.pad.ry * dt * 1.6 * (this.invert ? -1 : 1)));
        if (this.pad.run) run = true;
        if (this.stick.active) {
            const sx = this.stick.x, sy = this.stick.y, m = Math.hypot(sx, sy);
            if (m > 0.18) { x = sx; y = sy; run = m > 0.92; }
        }
        return { x, y, turn, run, dyaw: this.dyaw, a: this.edges.a, cmd: this.edges.cmd };
    }

    consumeEdges() { this.edges.a = false; this.edges.cmd = null; this.dyaw = 0; }
    /** The next queued press, or null. Menus take one per frame. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; this.edges.a = false; this.edges.cmd = null; this.dyaw = 0; }
    clear() {
        this.keys.clear();
        this.flush();
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
        this.drag = false;
    }
}
