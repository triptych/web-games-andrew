// Keyboard, gamepad and touch merged into one state, { x, y, jump, jumpHeld, fire, flare }, plus an
// ordered queue of presses for the menus. y is UP here (the sim's convention).
//
// - Held directions and buttons are read every frame.
// - Presses (jump, a fire tap, flare) are *edges* that stay set until a simulation step consumes
//   them: a frame shorter than the fixed step runs no step, and a tap made in it must not be lost.
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.

const JUMP_KEYS = ['Space', 'KeyZ', 'KeyK'];
const FIRE_KEYS = ['KeyX', 'KeyJ'];
const FLARE_KEYS = ['KeyC', 'KeyL'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_MENU = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.edges = { jump: false, fire: false, flare: false };
        this.held = { jump: false, fire: false };           // touch buttons
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, prev: [], jump: false, fire: false };
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.autofire = false;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (JUMP_KEYS.includes(e.code)) this.edges.jump = true;
            if (FIRE_KEYS.includes(e.code)) this.edges.fire = true;
            if (FLARE_KEYS.includes(e.code)) this.edges.flare = true;
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

    /** A touch button held for `key` (jump, fire) or tapped (flare). Acts on finger-down. */
    bindHold(btn, key) {
        let id = null;
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            id = e.pointerId;
            this.edges[key] = true;
            if (key in this.held) this.held[key] = true;
            btn.classList.add('on');
            try { btn.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        const up = (e) => {
            if (e.pointerId !== id) return;
            id = null;
            if (key in this.held) this.held[key] = false;
            btn.classList.remove('on');
        };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, up);
    }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; this.pad.jump = this.pad.fire = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.3 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        const edge = (i) => b(i) && !this.pad.prev[i];
        for (const i in PAD_MENU) if (edge(+i)) { this.queue.push({ key: PAD_MENU[i], pad: true }); this.lastDevice = 'pad'; }
        if (edge(0)) this.edges.jump = true;
        if (edge(2) || edge(3) || edge(7)) this.edges.fire = true;
        if (edge(1) || edge(5) || edge(4)) this.edges.flare = true;
        this.pad.jump = b(0);
        this.pad.fire = b(2) || b(3) || b(7);
        for (let i = 0; i < gp.buttons.length; i++) this.pad.prev[i] = b(i);
    }

    /** The state for this frame. Edges stay set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = -this.pad.y; }
        if (this.stick.active) {
            const sx = this.stick.x, sy = this.stick.y;
            if (Math.hypot(sx, sy) > 0.3) {
                // snap the stick to eight directions, like a d-pad: aiming is what it is for
                const a = Math.atan2(-sy, sx), s = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
                x = Math.round(Math.cos(s)); y = Math.round(Math.sin(s));
            }
        }
        const jumpHeld = JUMP_KEYS.some((c) => k.has(c)) || this.held.jump || this.pad.jump;
        const fireHeld = FIRE_KEYS.some((c) => k.has(c)) || this.held.fire || this.pad.fire || this.autofire;
        return { x, y, jump: this.edges.jump, jumpHeld: jumpHeld || this.edges.jump, fire: fireHeld || this.edges.fire, flare: this.edges.flare };
    }

    consumeEdges() { this.edges.jump = this.edges.fire = this.edges.flare = false; }
    /** The next queued press, or null. Menus take one per frame. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; this.consumeEdges(); }
    clear() {
        this.keys.clear();
        this.flush();
        this.held.jump = this.held.fire = false;
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
    }
}
