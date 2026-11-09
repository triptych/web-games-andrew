// SEEDFALL input: keyboard + mouse (pointer lock or drag), touch (stick, look pad, buttons) and gamepad, merged
// into one state { x, y, turn, pitch, a, b, c, r } plus an ordered queue of presses for menus and dialogue.
//
// - Look deltas and action presses stay set until a simulation step consumes them: a frame shorter than the
//   fixed step runs no step, and a flick or a tap made in it must not be lost.
// - Enter and Space on a focused button are the browser's own click; they are not also queued (game-121).

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
const STRIKE = ['Space', 'KeyJ'], SHOOT = ['KeyK', 'ShiftLeft', 'ShiftRight'], GATHER = ['KeyE', 'KeyF'];

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.look = { yaw: 0, pitch: 0 };
        this.edge = { a: false, c: false, b: false };
        this.touchHold = { a: false, b: false, c: false, r: false };
        this.mouse = { a: false, c: false };
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, lx: 0, ly: 0, a: false, b: false, c: false, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.sens = 1; this.invert = false;
        this.locked = false; this.canvas = null;
        this.world = false;               // true while walking or driving (menus get only the queue)

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            const onButton = (tag === 'BUTTON' || tag === 'A') && e.target.offsetParent !== null;
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && onButton)) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            if (!(onButton && (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter'))) this.queue.push({ key: e.code, t: performance.now() });
            if (this.world) {
                if (STRIKE.includes(e.code)) this.edge.a = true;
                if (SHOOT.includes(e.code)) this.edge.c = true;
                if (GATHER.includes(e.code)) this.edge.b = true;
            }
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
            if (!this.world) return;
            if (this.locked) {
                const k = 0.0022 * this.sens;
                this.look.yaw += e.movementX * k;
                this.look.pitch -= e.movementY * k * (this.invert ? -1 : 1);
            } else if ((e.buttons & 2) || ((e.buttons & 1) && this.dragging)) {
                const k = 0.005 * this.sens;
                this.look.yaw += (e.movementX || 0) * k;
                this.look.pitch -= (e.movementY || 0) * k * (this.invert ? -1 : 1);
            }
        });
        window.addEventListener('mouseup', (e) => { if (e.button === 0) { this.mouse.a = false; this.dragging = false; } if (e.button === 2) this.mouse.c = false; });
        window.addEventListener('contextmenu', (e) => { if (e.target === this.canvas) e.preventDefault(); });
    }

    bindCanvas(canvas) {
        this.canvas = canvas;
        canvas.addEventListener('mousedown', (e) => {
            if (!this.world) return;
            if (e.button === 0) { if (this.locked) { this.mouse.a = true; this.edge.a = true; } else this.dragging = true; }
            if (e.button === 2 && this.locked) { this.mouse.c = true; this.edge.c = true; }
        });
    }
    requestLock() {
        if (!this.canvas || this.locked || this.lastDevice === 'touch') return;
        try { const p = this.canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => {}); } catch { /* headless, iframes */ }
    }
    exitLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* */ } }

    bindStick(zone, el, knob) {
        const R = () => Math.min(70, Math.max(48, window.innerWidth * 0.12));
        const end = (e) => {
            if (e.pointerId !== this.stick.id) return;
            this.stick.active = false; this.stick.x = this.stick.y = 0;
            knob.style.transform = ''; el.classList.remove('on');
        };
        zone.addEventListener('pointerdown', (e) => {
            if (this.stick.active) return;
            e.preventDefault();
            const r = zone.getBoundingClientRect();
            Object.assign(this.stick, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
            el.style.left = `${e.clientX - r.left}px`; el.style.top = `${e.clientY - r.top}px`; el.style.bottom = 'auto';
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
                el.style.left = `${this.stick.ox - r.left}px`; el.style.top = `${this.stick.oy - r.top}px`;
                dx = e.clientX - this.stick.ox; dy = e.clientY - this.stick.oy;
            }
            this.stick.x = dx / rad; this.stick.y = dy / rad;
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, end);
    }

    /** A relative look pad: drag anywhere on it to turn. */
    bindLook(el) {
        const st = { id: null, x: 0, y: 0 };
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (st.id !== null) return;
            Object.assign(st, { id: e.pointerId, x: e.clientX, y: e.clientY });
            try { el.setPointerCapture(e.pointerId); } catch { /* */ }
        });
        el.addEventListener('pointermove', (e) => {
            if (e.pointerId !== st.id) return;
            e.preventDefault();
            const k = 0.0065 * this.sens, dx = e.clientX - st.x, dy = e.clientY - st.y;
            st.x = e.clientX; st.y = e.clientY;
            if (!this.world) return;
            this.look.yaw += dx * k;
            this.look.pitch -= dy * k * (this.invert ? -1 : 1);
        });
        const end = (e) => { if (e.pointerId === st.id) st.id = null; };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, end);
    }

    /** A touch button held for `key` (a, b, c, r); a press also latches an edge so a quick tap still counts. */
    bindHold(btn, key, onPress = null) {
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault(); e.stopPropagation();
            btn.classList.add('held');
            this.touchHold[key] = true;
            if (key in this.edge) this.edge[key] = true;
            onPress?.();
        });
        const up = () => { btn.classList.remove('held'); this.touchHold[key] = false; };
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, up);
        btn.addEventListener('click', (e) => { if (e.detail === 0) { if (key in this.edge) this.edge[key] = true; onPress?.(); } });
    }

    _pollPad(dt) {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { Object.assign(this.pad, { x: 0, y: 0, lx: 0, ly: 0, a: false, b: false, c: false }); return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.2 ? (v - Math.sign(v) * 0.2) / 0.8 : 0);
        this.pad.x = dead(gp.axes[0] || 0); this.pad.y = dead(gp.axes[1] || 0);
        this.pad.lx = dead(gp.axes[2] || 0); this.pad.ly = dead(gp.axes[3] || 0);
        this.pad.a = b(0) || b(7); this.pad.c = b(2) || b(6); this.pad.b = b(3) || b(5);
        if (this.world) { if (this.pad.a && !this.pad.prev[0]) this.edge.a = true; if (this.pad.c && !this.pad.prev[2]) this.edge.c = true; if (this.pad.b && !this.pad.prev[3]) this.edge.b = true; }
        for (const i in PAD_KEYS) if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
        for (let i = 0; i < 16; i++) this.pad.prev[i] = b(i);
        this.pad.prev[0] = this.pad.a; this.pad.prev[2] = this.pad.c; this.pad.prev[3] = this.pad.b;
        if ((this.pad.lx || this.pad.ly) && this.world) {
            const r = 2.8 * this.sens * dt, curve = (v) => Math.sign(v) * v * v;
            this.look.yaw += curve(this.pad.lx) * r;
            this.look.pitch -= curve(this.pad.ly) * r * 0.7 * (this.invert ? -1 : 1);
            this.lastDevice = 'pad';
        }
    }

    /** Once per frame: gamepad and the arrow keys add to the look accumulators. */
    frame(dt) {
        this._pollPad(dt);
        if (!this.world) return;
        const k = this.keys;
        const turn = (k.has('ArrowRight') || k.has('KeyL') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyH') ? 1 : 0);
        if (turn) this.look.yaw += turn * 2.4 * dt * this.sens;
    }

    /** The input for the next sim step. Look deltas and edges stay set until consumeEdges(). */
    state() {
        if (!this.world) return { x: 0, y: 0, turn: 0, pitch: 0, a: false, b: false, c: false, r: false };
        const k = this.keys;
        let x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
        let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = -this.pad.y; }
        if (this.stick.active && Math.hypot(this.stick.x, this.stick.y) > 0.15) { x = this.stick.x; y = -this.stick.y; }
        const T = this.touchHold;
        return {
            x, y, turn: this.look.yaw, pitch: this.look.pitch,
            a: this.edge.a || STRIKE.some((c) => k.has(c)) || this.mouse.a || this.pad.a || T.a,
            c: this.edge.c || SHOOT.some((c) => k.has(c)) || this.mouse.c || this.pad.c || T.c,
            b: this.edge.b || GATHER.some((c) => k.has(c)) || this.pad.b || T.b,
            r: k.has('KeyR') || T.r,
        };
    }
    consumeEdges() { this.look.yaw = 0; this.look.pitch = 0; this.edge.a = this.edge.b = this.edge.c = false; }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.consumeEdges(); }
    clear() {
        this.keys.clear(); this.flush();
        this.stick.active = false; this.stick.x = this.stick.y = 0;
        for (const k in this.touchHold) this.touchHold[k] = false;
        this.mouse.a = this.mouse.c = false;
    }
}
