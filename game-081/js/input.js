// Keyboard + mouse (pointer lock), touch (stick, look pad, buttons) and gamepad, merged into one
// walking input: { mx, my, dyaw, dpitch, sprint }, plus an ordered queue of presses.
//
// - Held directions are read every frame.
// - Look deltas and presses stay set until a simulation step consumes them: a frame shorter than
//   the fixed step runs no step, and a flick or a tap made in it must not be lost.
// - Menu, dialogue and scan presses go into a FIFO; one is consumed per frame.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 2: 'KeyH', 3: 'KeyJ', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 4: 'Backspace', 5: 'KeyE' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.look = { yaw: 0, pitch: 0 };
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, sprint: false, lastTap: 0 };
        this.pad = { x: 0, y: 0, lx: 0, ly: 0, sprint: false, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.sens = 1; this.invert = false;
        this.locked = false;
        this.canvas = null;
        this.look_enabled = false;            // world look/walk input (menus always get the queue)

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            const onButton = tag === 'BUTTON' && e.target.offsetParent !== null;
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && onButton)) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code, onButton, t: performance.now() });
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
        document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === this.canvas; });
        window.addEventListener('mousemove', (e) => {
            if (!this.locked || !this.look_enabled) return;
            const k = 0.0022 * this.sens;
            this.look.yaw += e.movementX * k;
            this.look.pitch -= e.movementY * k * (this.invert ? -1 : 1);
        });
    }

    bindCanvas(canvas) { this.canvas = canvas; }

    requestLock() {
        if (!this.canvas || this.locked) return;
        try {
            const p = this.canvas.requestPointerLock?.();
            if (p && p.catch) p.catch(() => { /* refused: arrow keys still turn */ });
        } catch { /* no pointer lock (headless, iframe) */ }
    }
    exitLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* */ } }

    /** A floating stick; a quick double tap and hold sprints. */
    bindStick(zone, el, knob) {
        const R = () => Math.min(70, Math.max(48, window.innerWidth * 0.12));
        const end = (e) => {
            if (e.pointerId !== this.stick.id) return;
            this.stick.active = false;
            this.stick.x = this.stick.y = 0;
            this.stick.sprint = false;
            knob.style.transform = '';
            el.classList.remove('on');
        };
        zone.addEventListener('pointerdown', (e) => {
            if (this.stick.active) return;
            e.preventDefault();
            const now = performance.now();
            const r = zone.getBoundingClientRect();
            Object.assign(this.stick, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0, sprint: now - this.stick.lastTap < 300 });
            this.stick.lastTap = now;
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

    /** A relative look pad: drag anywhere on it to turn. A short tap on it presses `onTap`. */
    bindLook(el, onTap = null) {
        const st = { id: null, x: 0, y: 0, moved: 0, t: 0 };
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (st.id !== null) return;
            Object.assign(st, { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, t: performance.now() });
            try { el.setPointerCapture(e.pointerId); } catch { /* */ }
        });
        el.addEventListener('pointermove', (e) => {
            if (e.pointerId !== st.id) return;
            e.preventDefault();
            const k = 0.0062 * this.sens;
            const dx = e.clientX - st.x, dy = e.clientY - st.y;
            st.x = e.clientX; st.y = e.clientY;
            st.moved += Math.abs(dx) + Math.abs(dy);
            if (!this.look_enabled) return;
            this.look.yaw += dx * k;
            this.look.pitch -= dy * k * (this.invert ? -1 : 1);
        });
        const end = (e) => {
            if (e.pointerId !== st.id) return;
            st.id = null;
            if (e.type === 'pointerup' && st.moved < 10 && performance.now() - st.t < 350) onTap?.();
        };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, end);
    }

    /** A touch button that acts on finger-down (a click waits for the lift and feels late). */
    bindButton(btn, onPress) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); btn.classList.add('held'); onPress(); });
        const up = () => btn.classList.remove('held');
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, up);
        // keyboard activation of the same button
        btn.addEventListener('click', (e) => { if (e.detail === 0) onPress(); });
    }

    push(key) { this.queue.push({ key }); }

    _pollPad(dt) {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = this.pad.lx = this.pad.ly = 0; this.pad.sprint = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.2 ? (v - Math.sign(v) * 0.2) / 0.8 : 0);
        this.pad.x = dead(gp.axes[0] || 0);
        this.pad.y = dead(gp.axes[1] || 0);
        this.pad.lx = dead(gp.axes[2] || 0); this.pad.ly = dead(gp.axes[3] || 0);
        this.pad.sprint = b(10) || b(6);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
        }
        for (let i = 0; i < 16; i++) this.pad.prev[i] = b(i);
        if ((this.pad.lx || this.pad.ly) && this.look_enabled) {
            const r = 2.8 * this.sens * dt;
            const curve = (v) => Math.sign(v) * v * v;
            this.look.yaw += curve(this.pad.lx) * r;
            this.look.pitch -= curve(this.pad.ly) * r * 0.7 * (this.invert ? -1 : 1);
            this.lastDevice = 'pad';
        }
    }

    /** Once per frame: gamepad and held turn keys add to the look accumulators. */
    frame(dt, turnKeys = true) {
        this._pollPad(dt);
        if (!this.look_enabled) return;
        const k = this.keys;
        if (turnKeys) {
            const turn = (k.has('ArrowRight') || k.has('KeyL') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyK') ? 1 : 0);
            if (turn) this.look.yaw += turn * 2.4 * dt * this.sens;
        }
    }

    /** The walking input for the next sim step. Look deltas stay set until consumeEdges(). */
    state() {
        const k = this.keys;
        let mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
        let my = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
        if (this.pad.x || this.pad.y) { mx = this.pad.x; my = -this.pad.y; }
        if (this.stick.active && Math.hypot(this.stick.x, this.stick.y) > 0.15) { mx = this.stick.x; my = -this.stick.y; }
        const sprint = k.has('ShiftLeft') || k.has('ShiftRight') || this.pad.sprint || this.stick.sprint;
        if (!this.look_enabled) return { mx: 0, my: 0, dyaw: 0, dpitch: 0, sprint: false };
        return { mx, my, dyaw: this.look.yaw, dpitch: this.look.pitch, sprint };
    }

    moving() { const s = this.state(); return Math.hypot(s.mx, s.my) > 0.1; }

    consumeEdges() { this.look.yaw = 0; this.look.pitch = 0; }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.consumeEdges(); }
    /** Drop presses made before time t (the press that closed a menu), keep later ones. */
    dropBefore(t) { this.queue = this.queue.filter((p) => (p.t ?? 0) > t); this.consumeEdges(); }
    clear() {
        this.keys.clear();
        this.flush();
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
    }
}
