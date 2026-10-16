// Keyboard, mouse, gamepad and touch merged into one state, { x, y, a, abs }, plus an ordered
// queue of menu presses.
//
// - Held directions are read every frame. On foot x turns and y walks; on the wing x and y move
//   the targeting cross. abs is true when a stick, the gamepad or the mouse *places* the cross
//   (and it springs home when let go); keys push it instead.
// - Fire is held for autofire, and a press is also an edge that stays set until a sim step
//   consumes it: a tap shorter than the fixed step must still fire once (game-059, game-079).
// - Mouse look: a click on the view captures the mouse (pointer lock). On foot its sideways
//   movement turns the dragon, carried to the sim as `turn` (radians) and kept until a step uses
//   it, like a press; in flight its movement steers the cross. Without the lock, the cross in
//   flight sits under the pointer.
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.

const FIRE_KEYS = ['Space', 'KeyZ', 'KeyJ', 'KeyF', 'ControlLeft', 'ControlRight'];
const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];                    // { key } in the order they were pressed
        this.edges = { a: false };
        this.btnFire = false;
        this.mouseDown = false;
        this.mouse = { active: false, x: 0, y: 0 };
        this.look = { locked: false, free: false, turn: 0, ax: 0, ay: 0, sens: 1, lx: null, ly: null };
        this.onLockChange = null;           // called with true / false when the mouse is captured / let go
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, fire: false, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;                // called once when a touch is first seen

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (MOVE_KEYS.includes(e.code)) this.mouse.active = false;
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (FIRE_KEYS.includes(e.code)) this.edges.a = true;
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        // Capture phase, so a touch on any menu switches the touch deck on before play starts.
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.mouse.active = false;
            this.onTouch?.();
        }, { capture: true });
    }

    /**
     * The mouse over the game view: a click captures it for mouse look (when canLock() says play is
     * running), its movement looks or aims, and its button fires.
     */
    bindMouse(canvas, canLock = () => true) {
        this.canvas = canvas;
        canvas.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            const L = this.look;
            // captured, the motion is movementX/Y (the pointer itself stays put); free, it is the
            // pointer's own step, so a lock refused or a browser without movement still looks
            const dx = L.locked ? e.movementX || 0 : L.lx === null ? 0 : e.clientX - L.lx;
            const dy = L.locked ? e.movementY || 0 : L.ly === null ? 0 : e.clientY - L.ly;
            L.lx = e.clientX; L.ly = e.clientY;
            this.mouse.x = e.clientX; this.mouse.y = e.clientY;
            this.mouse.active = true;
            this.lastDevice = 'mouse';
            if (L.locked || (L.free && canLock())) this.moveLook(dx, dy);
        });
        canvas.addEventListener('pointerleave', () => { this.look.lx = this.look.ly = null; });
        canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            this.mouseDown = true;
            this.edges.a = true;
            this.mouse.x = e.clientX; this.mouse.y = e.clientY;
            this.mouse.active = true;
            this.lastDevice = 'mouse';
            if (!this.look.locked && canLock()) this.lock();
        });
        document.addEventListener('pointerlockchange', () => {
            const on = document.pointerLockElement === canvas;
            if (on === this.look.locked) return;
            this.look.locked = on;
            this.look.turn = 0;
            this.onLockChange?.(on);
        });
        // the lock refused (a sandboxed frame, say): look with the free pointer instead
        document.addEventListener('pointerlockerror', () => { this.look.locked = false; this.look.free = true; });
        window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') this.mouseDown = false; });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /** Capture the mouse. Needs a user gesture; a refusal (or no Pointer Lock at all) just leaves it free. */
    lock() {
        const c = this.canvas;
        if (!c?.requestPointerLock) { this.look.free = true; return; }
        try {
            const r = c.requestPointerLock();
            r?.catch?.(() => { this.look.free = true; });
        } catch { this.look.free = true; }
    }
    unlock() {
        if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    }

    /** Mouse movement while captured: turn on foot, steer the cross in flight (both are kept; the act picks). */
    moveLook(dx, dy) {
        const L = this.look;
        // about 0.0035 rad per pixel at speed 1: a 900 px sweep turns the dragon half round
        L.turn += dx * 0.0035 * L.sens;
        L.ax = Math.max(-1, Math.min(1, L.ax + dx * 0.004 * L.sens));
        L.ay = Math.max(-1, Math.min(1, L.ay - dy * 0.004 * L.sens));
    }

    /** A floating stick: zone captures the thumb, el is the visual ring, knob follows the thumb. */
    bindStick(zone, el, knob) {
        const R = () => Math.min(64, Math.max(44, window.innerWidth * 0.11));
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

    /** The fire button: acts on finger-down (a click waits for the lift and feels late), held for autofire. */
    bindFire(btn) {
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.btnFire = true;
            this.edges.a = true;
            btn.classList.add('down');
            try { btn.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        const up = () => { this.btnFire = false; btn.classList.remove('down'); };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, up);
    }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; this.pad.fire = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.2 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        const fire = b(0) || b(7) || b(5);
        if (fire && !this.pad.fire) this.edges.a = true;
        this.pad.fire = fire;
        if (this.pad.x || this.pad.y) this.lastDevice = 'pad';
    }

    /**
     * The held state for this frame. Edges stay set until consumeEdges().
     * flight: aiming rules apply; aimAt(clientX, clientY) → {x, y} maps the mouse to the cross.
     */
    state(flight = false, aimAt = null, invertY = false) {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
        let abs = false;
        if (this.lastDevice === 'pad') { x = this.pad.x; y = this.pad.y; abs = flight; }
        if (this.stick.active || this.lastDevice === 'touch') {
            const sx = this.stick.x, sy = this.stick.y;
            if (flight) { x = Math.max(-1, Math.min(1, sx)); y = Math.max(-1, Math.min(1, sy)); abs = true; }
            else if (Math.hypot(sx, sy) > 0.2) { x = sx; y = sy; }
        }
        if (flight && invertY) y = -y;
        if (flight && this.mouse.active && !x && !y && this.lastDevice !== 'touch') {
            if (this.look.locked || this.look.free) {
                // captured: the mouse steers the cross, which stays where it is left
                x = this.look.ax; y = -(invertY ? -this.look.ay : this.look.ay); abs = true;
            } else if (aimAt) {
                const a = aimAt(this.mouse.x, this.mouse.y);
                x = a.x; y = -a.y; abs = true;
            }
        }
        const held = FIRE_KEYS.some((c) => k.has(c)) || this.btnFire || this.mouseDown || this.pad.fire;
        return { x, y, a: this.edges.a || held, abs, turn: flight ? 0 : this.look.turn };
    }

    /** Start the captured cross where the game's cross already is, so it doesn't jump. */
    syncAim(ax, ay) { this.look.ax = ax; this.look.ay = ay; }

    consumeEdges() { this.edges.a = false; this.look.turn = 0; }
    /** The next queued press, or null. Menus take one per frame. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; this.edges.a = false; this.look.turn = 0; }
    clear() {
        this.keys.clear();
        this.flush();
        this.btnFire = false;
        this.mouseDown = false;
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
    }
}
