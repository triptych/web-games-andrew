// Keyboard + mouse (pointer lock), touch (stick, look pad, buttons) and gamepad, merged into one
// sim input: { mx, my, dyaw, dpitch, fire, jump, kick, reload, use, bomb, over, last, slot, cycle }.
//
// - Held things are read every frame.
// - Presses (kick, reload, …) and look deltas stay set until a simulation step consumes them: a
//   frame shorter than the fixed step runs no step, and a tap or a flick made in it must not be lost.
// - Menu presses go into a FIFO, one consumed per frame.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };
const EDGE_KEYS = { KeyV: 'kick', KeyR: 'reload', KeyE: 'use', KeyG: 'bomb', KeyF: 'over', KeyQ: 'last' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.edges = { kick: false, reload: false, use: false, bomb: false, over: false, last: false, slot: -1, cycle: 0 };
        // held inputs that are also latched, so a tap shorter than one sim step still counts
        this.tap = { fire: false, jump: false };
        this.look = { yaw: 0, pitch: 0 };
        this.lookFrame = { x: 0, y: 0 };      // this frame's look, for gun sway
        this.mouseFire = false;
        this.touchFire = false; this.touchJump = false;
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.lookTouch = { id: null, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, lx: 0, ly: 0, fire: false, jump: false, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.sens = 1; this.invert = false;
        this.locked = false;
        this.canvas = null;
        this.enabled = false;              // gameplay input (menus always get the queue)

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            this.keys.add(e.code);
            if (!this.enabled) return;
            if (EDGE_KEYS[e.code]) this.edges[EDGE_KEYS[e.code]] = true;
            if (e.code === 'Space') this.tap.jump = true;
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.tap.fire = true;
            if (/^Digit[1-5]$/.test(e.code)) this.edges.slot = +e.code.slice(5) - 1;
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
        document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === this.canvas; if (!this.locked) this.mouseFire = false; });
        window.addEventListener('mousemove', (e) => {
            if (!this.locked || !this.enabled) return;
            const k = 0.0022 * this.sens;
            this.look.yaw += e.movementX * k;
            this.look.pitch -= e.movementY * k * (this.invert ? -1 : 1);
            this.lookFrame.x += e.movementX * k; this.lookFrame.y -= e.movementY * k;
        });
        window.addEventListener('wheel', (e) => { if (this.enabled && this.locked) this.edges.cycle = e.deltaY > 0 ? 1 : -1; }, { passive: true });
    }

    bindCanvas(canvas, onLockRequest) {
        this.canvas = canvas;
        canvas.addEventListener('mousedown', (e) => {
            if (!this.enabled) return;
            if (!this.locked) { onLockRequest?.(); return; }
            this.lastDevice = 'keys';
            if (e.button === 0) { this.mouseFire = true; this.tap.fire = true; }
            if (e.button === 2) this.edges.kick = true;
        });
        window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseFire = false; });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    requestLock() {
        if (!this.canvas || this.locked) return;
        try {
            const p = this.canvas.requestPointerLock?.();
            if (p && p.catch) p.catch(() => { /* refused: arrow keys still turn */ });
        } catch { /* no pointer lock (headless, iframe) */ }
    }
    exitLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* */ } }

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

    /** A relative look pad: drag anywhere on it to turn. Also used by the FIRE button (drag to aim). */
    bindLook(el, onDown = null, onUp = null) {
        const st = { id: null, x: 0, y: 0 };
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (st.id !== null) return;
            st.id = e.pointerId; st.x = e.clientX; st.y = e.clientY;
            try { el.setPointerCapture(e.pointerId); } catch { /* */ }
            onDown?.();
        });
        el.addEventListener('pointermove', (e) => {
            if (e.pointerId !== st.id) return;
            e.preventDefault();
            const k = 0.0062 * this.sens;
            const dx = e.clientX - st.x, dy = e.clientY - st.y;
            st.x = e.clientX; st.y = e.clientY;
            if (!this.enabled) return;
            this.look.yaw += dx * k;
            this.look.pitch -= dy * k * (this.invert ? -1 : 1);
            this.lookFrame.x += dx * k; this.lookFrame.y -= dy * k;
        });
        const end = (e) => { if (e.pointerId !== st.id) return; st.id = null; onUp?.(); };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, end);
    }

    /** A touch button that acts on finger-down (a click waits for the lift and feels late). */
    bindButton(btn, onPress, onRelease = null) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.classList.add('held'); onPress(); });
        const up = () => { btn.classList.remove('held'); onRelease?.(); };
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, up);
    }

    press(name) { if (this.enabled) this.edges[name] = true; }
    /** A touch button that is held, but whose quick tap must still reach a step. */
    hold(name, on) { if (name === 'fire') this.touchFire = on; else this.touchJump = on; if (on && this.enabled) this.tap[name] = true; }
    cycle(d) { if (this.enabled) this.edges.cycle = d; }

    _pollPad(dt) {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = this.pad.lx = this.pad.ly = 0; this.pad.fire = this.pad.jump = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.2 ? (v - Math.sign(v) * 0.2) / 0.8 : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        this.pad.lx = dead(gp.axes[2] || 0); this.pad.ly = dead(gp.axes[3] || 0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
        }
        const edge = (i, name) => { if (b(i) && !this.pad.prev[i] && this.enabled) { if (name === 'cycle') this.edges.cycle = 1; else this.edges[name] = true; } };
        edge(1, 'kick'); edge(2, 'reload'); edge(2, 'use'); edge(3, 'cycle'); edge(4, 'bomb'); edge(5, 'over');
        this.pad.fire = b(7) || (gp.buttons[7]?.value || 0) > 0.3;
        this.pad.jump = b(0);
        for (let i = 0; i < 16; i++) this.pad.prev[i] = b(i);
        if (this.pad.lx || this.pad.ly) {
            const r = 3.0 * this.sens * dt;
            const curve = (v) => Math.sign(v) * v * v;
            this.look.yaw += curve(this.pad.lx) * r;
            this.look.pitch -= curve(this.pad.ly) * r * 0.7 * (this.invert ? -1 : 1);
            this.lookFrame.x += curve(this.pad.lx) * r; this.lookFrame.y -= curve(this.pad.ly) * r;
            this.lastDevice = 'pad';
        }
    }

    /** Once per frame: gamepad and held turn keys add to the look accumulators. */
    frame(dt) {
        this._pollPad(dt);
        if (!this.enabled) return;
        const k = this.keys;
        const turn = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
        if (turn) { this.look.yaw += turn * 2.6 * dt * this.sens; this.lookFrame.x += turn * 2.6 * dt; }
        const tilt = (k.has('PageUp') ? 1 : 0) - (k.has('PageDown') ? 1 : 0);
        if (tilt) this.look.pitch += tilt * 1.6 * dt;
    }

    /** The input for the next sim step. Presses and look stay set until consumeEdges(). */
    state() {
        const k = this.keys;
        let mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
        let my = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
        if (this.pad.x || this.pad.y) { mx = this.pad.x; my = -this.pad.y; }
        if (this.stick.active && Math.hypot(this.stick.x, this.stick.y) > 0.15) { mx = this.stick.x; my = -this.stick.y; }
        const fire = this.enabled && (this.tap.fire || this.mouseFire || k.has('ControlLeft') || k.has('ControlRight') || this.touchFire || this.pad.fire);
        const jump = this.enabled && (this.tap.jump || k.has('Space') || this.touchJump || this.pad.jump);
        if (!this.enabled) { mx = 0; my = 0; }
        return { mx, my, dyaw: this.look.yaw, dpitch: this.look.pitch, fire, jump, ...this.edges };
    }

    /** This frame's look movement (for gun sway), zeroed once read. */
    takeLookFrame() { const o = { x: this.lookFrame.x, y: this.lookFrame.y }; this.lookFrame.x = this.lookFrame.y = 0; return o; }

    consumeEdges() {
        for (const n of ['kick', 'reload', 'use', 'bomb', 'over', 'last']) this.edges[n] = false;
        this.edges.slot = -1; this.edges.cycle = 0;
        this.tap.fire = this.tap.jump = false;
        this.look.yaw = 0; this.look.pitch = 0;
    }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.consumeEdges(); this.mouseFire = false; }
    clear() {
        this.keys.clear();
        this.flush();
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
        this.touchFire = this.touchJump = false;
    }
}
