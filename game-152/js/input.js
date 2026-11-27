// Keyboard, gamepad and touch merged into one state, { x, y, fire, jump, missile }, plus an ordered queue of presses.
//
// - Held directions are read every frame.
// - Jump and missile presses are *edges* that stay set until a simulation step consumes them: a frame shorter than
//   the fixed step runs no step, and a tap made in it must not be lost (game-059, game-071).
// - Fire is held, but latched too: a key pressed and released inside one frame still fires once (game-079).
// - Menu presses go into a FIFO, one consumed per frame (game-074).

const JUMP_KEYS = ['Space', 'ShiftLeft', 'ShiftRight'];
const FIRE_KEYS = ['KeyJ', 'KeyZ', 'Enter', 'NumpadEnter'];
const MISSILE_KEYS = ['KeyK', 'KeyX'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.edges = { jump: false, missile: false, fire: false };
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, fire: false, prev: [] };
        this.touchFire = false;
        this.autoFire = false;          // set by main.js from the settings
        this.lastDevice = 'keys';
        this.onTouch = null;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a slider or a select keeps its own keys, but Escape must still close the sheet it sits in (game-117)
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // Space must still press a focused button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (JUMP_KEYS.includes(e.code)) this.edges.jump = true;
            if (MISSILE_KEYS.includes(e.code)) this.edges.missile = true;
            if (FIRE_KEYS.includes(e.code)) this.edges.fire = true;
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

    /** A touch button that acts on finger-down. onUp is optional (for held buttons). */
    bindButton(btn, onDown, onUp) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.classList.add('down'); onDown(); });
        const up = () => { btn.classList.remove('down'); onUp?.(); };
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, up);
    }

    pressJump() { this.edges.jump = true; }
    pressMissile() { this.edges.missile = true; }
    holdFire(on) { this.touchFire = on; if (on) this.edges.fire = true; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; this.pad.fire = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.22 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        if (b(0) && !this.pad.prev.a) this.edges.jump = true;
        if ((b(1) || b(4)) && !this.pad.prev.m) this.edges.missile = true;
        this.pad.prev.a = b(0);
        this.pad.prev.m = b(1) || b(4);
        this.pad.fire = b(2) || b(5) || b(7);
    }

    /** The state for this frame. Edges stay set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        if (this.stick.active) {
            const sx = this.stick.x, sy = this.stick.y;
            if (Math.abs(sx) > 0.12 || Math.abs(sy) > 0.35) { x = Math.abs(sx) > 0.12 ? Math.max(-1, Math.min(1, sx * 1.25)) : 0; y = Math.abs(sy) > 0.35 ? sy : 0; }
        }
        const held = FIRE_KEYS.some((c) => k.has(c)) || this.pad.fire || this.touchFire;
        return { x, y, fire: this.autoFire || held || this.edges.fire, jump: this.edges.jump, missile: this.edges.missile };
    }

    consumeEdges() { this.edges.jump = this.edges.missile = this.edges.fire = false; }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.consumeEdges(); }
    clear() {
        this.keys.clear();
        this.flush();
        this.touchFire = false;
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
    }
}
