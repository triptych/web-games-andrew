// Walking input: keyboard, mouse look (pointer lock, or drag when the lock is refused), touch (a stick and a look
// pad) and gamepad, merged into { fx, sx, run } held each frame plus look deltas that wait for the next sim step.
// Key presses also go into an ordered queue for shortcuts and menus, one consumed per frame.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'PageUp', 'PageDown'];

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.queue = [];
        this.look = { dx: 0, dy: 0 };
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.lookTouch = null;
        this.run = false;
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.walking = false;
        this.drag = null;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a slider, a select or the seed box keeps its own keys, but Escape still closes things (game-117)
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // Space must still press a focused button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (!e.repeat) this.queue.push({ key: e.code, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey });
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });

        // mouse look: pointer lock when walking; a drag works too
        document.addEventListener('mousemove', (e) => {
            if (!this.walking) return;
            if (document.pointerLockElement === canvas) { this.look.dx += e.movementX; this.look.dy += e.movementY; }
        });
        canvas.addEventListener('pointerdown', (e) => {
            if (!this.walking || e.pointerType === 'touch') return;
            this.drag = { x: e.clientX, y: e.clientY };
            if (document.pointerLockElement !== canvas) { try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* refused */ } }
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!this.walking || !this.drag || document.pointerLockElement === canvas || e.pointerType === 'touch') return;
            this.look.dx += e.clientX - this.drag.x; this.look.dy += e.clientY - this.drag.y;
            this.drag = { x: e.clientX, y: e.clientY };
        });
        window.addEventListener('pointerup', () => { this.drag = null; });
    }

    get locked() { return document.pointerLockElement === this.canvas; }
    unlock() { if (this.locked) document.exitPointerLock?.(); }

    /** The floating stick for walking. */
    bindStick(zone, el, knob) {
        const R = () => Math.min(64, Math.max(46, window.innerWidth * 0.12));
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

    /** The right side of the screen: drag to look around. */
    bindLook(zone) {
        zone.addEventListener('pointerdown', (e) => {
            if (this.lookTouch) return;
            e.preventDefault();
            this.lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
            try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        });
        zone.addEventListener('pointermove', (e) => {
            const t = this.lookTouch;
            if (!t || t.id !== e.pointerId) return;
            e.preventDefault();
            this.look.dx += (e.clientX - t.x) * 1.6; this.look.dy += (e.clientY - t.y) * 1.6;
            t.x = e.clientX; t.y = e.clientY;
        });
        const end = (e) => { if (this.lookTouch?.id === e.pointerId) this.lookTouch = null; };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, end);
    }

    pad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return null;
        const dead = (v) => (Math.abs(v) > 0.2 ? v : 0);
        if (gp.buttons[1]?.pressed && !this.padB) this.queue.push({ key: 'Escape', pad: true });
        this.padB = gp.buttons[1]?.pressed;
        return { x: dead(gp.axes[0] || 0), y: dead(gp.axes[1] || 0), lx: dead(gp.axes[2] || 0), ly: dead(gp.axes[3] || 0), run: !!gp.buttons[10]?.pressed || !!gp.buttons[6]?.pressed };
    }

    /** Held movement this frame: { fx, sx, turn, run }. turn is the arrow keys' turning (radians per second, ±1). */
    state() {
        const k = this.keys;
        let fx = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
        let sx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
        const turn = (k.has('ArrowRight') || k.has('KeyE') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyQ') ? 1 : 0);
        let run = k.has('ShiftLeft') || k.has('ShiftRight') || this.run;
        const p = this.pad();
        if (p) {
            if (p.x || p.y) { sx = p.x; fx = -p.y; }
            this.look.dx += p.lx * 14; this.look.dy += p.ly * 10;
            run = run || p.run;
        }
        if (this.stick.active && Math.hypot(this.stick.x, this.stick.y) > 0.15) { sx = this.stick.x; fx = -this.stick.y; run = run || Math.hypot(this.stick.x, this.stick.y) > 0.95 && this.run; }
        return { fx, sx, turn, run };
    }

    /** Look movement since the last call, in pixels. */
    takeLook() { const l = { ...this.look }; this.look.dx = this.look.dy = 0; return l; }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.look.dx = this.look.dy = 0; }
    clear() {
        this.keys.clear(); this.flush();
        this.stick.active = false; this.stick.x = this.stick.y = 0; this.lookTouch = null;
    }
}
