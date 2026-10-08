/**
 * input.js — keyboard, touch buttons and gamepads, turned into driving controls and button presses.
 *
 * Driving: { throttle, brake, steer, drift, nitro }. Keyboard steering eases in and out so a tap is a
 * nudge and a hold is full lock. Touch: the HUD's buttons carry data-ctl="left|right|gas|brake|drift|
 * nitro"; with auto-accelerate on (the default on touch screens) the car drives itself forward and
 * the right thumb only brakes. Presses (pause, reset, camera, mute, confirm, back) go to on() handlers.
 */

const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake',
    Space: 'drift', ShiftLeft: 'nitro', ShiftRight: 'nitro', KeyN: 'nitro', KeyX: 'nitro',
};
const PRESS = {
    Escape: 'pause', KeyP: 'pause', KeyR: 'reset', KeyC: 'camera', KeyM: 'mute',
    Enter: 'confirm', NumpadEnter: 'confirm', Backspace: 'back',
};

export class Input {
    constructor() {
        this.held = new Set();
        this.touchHeld = new Set();
        this.handlers = [];
        this.steer = 0;
        this.autoGas = false;
        this.touch = false;
        this.pads = [];
        this.padPrev = {};
        this.ctl = { throttle: 0, brake: 0, steer: 0, drift: false, nitro: false };
        addEventListener('keydown', (e) => this.key(e, true));
        addEventListener('keyup', (e) => this.key(e, false));
        addEventListener('blur', () => { this.held.clear(); this.touchHeld.clear(); });
        const markTouch = () => { if (!this.touch) { this.touch = true; document.body.classList.add('touch'); this.emit('touchmode'); } };
        addEventListener('touchstart', markTouch, { passive: true, capture: true });
        if (matchMedia('(pointer: coarse)').matches) markTouch();
        // Touch buttons: pointer events on anything with data-ctl, tracked per pointer so sliding a
        // thumb from one button to its neighbour works.
        this.ptr = new Map();
        const find = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('[data-ctl]') : null; };
        const update = () => {
            this.touchHeld.clear();
            for (const el of this.ptr.values()) if (el) this.touchHeld.add(el.dataset.ctl);
            document.querySelectorAll('[data-ctl]').forEach((el) => el.classList.toggle('on', this.touchHeld.has(el.dataset.ctl)));
        };
        addEventListener('pointerdown', (e) => {
            const el = find(e.clientX, e.clientY);
            if (!el) return;
            e.preventDefault();
            this.ptr.set(e.pointerId, el);
            update();
        }, { passive: false });
        addEventListener('pointermove', (e) => {
            if (!this.ptr.has(e.pointerId)) return;
            const el = find(e.clientX, e.clientY);
            if (el !== this.ptr.get(e.pointerId)) { this.ptr.set(e.pointerId, el); update(); }
        });
        const up = (e) => { if (this.ptr.delete(e.pointerId)) update(); };
        addEventListener('pointerup', up);
        addEventListener('pointercancel', up);
    }

    on(fn) { this.handlers.push(fn); return () => { this.handlers = this.handlers.filter((h) => h !== fn); }; }
    emit(a, d = {}) { for (const h of [...this.handlers]) h(a, d); }

    key(e, down) {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const k = KEYS[e.code];
        if (k) {
            if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
            if (down) this.held.add(k); else this.held.delete(k);
        }
        const p = PRESS[e.code];
        if (p && down && !e.repeat) {
            if (p === 'back' || p === 'pause') e.preventDefault();
            this.emit(p, { code: e.code });
        }
        if (down && !e.repeat) this.emit('anykey', { code: e.code });
    }

    pollPads() {
        const list = navigator.getGamepads ? navigator.getGamepads() : [];
        let pad = null;
        for (const p of list) if (p && p.connected) { pad = p; break; }
        if (!pad) return null;
        const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
        const v = (i) => (pad.buttons[i] ? pad.buttons[i].value : 0);
        const edges = { pause: b(9), reset: b(8), camera: b(3), confirm: b(0), back: b(1) };
        for (const [k, on] of Object.entries(edges)) {
            if (on && !this.padPrev[k]) this.emit(k, { pad: true });
            this.padPrev[k] = on;
        }
        let sx = pad.axes[0] || 0;
        if (Math.abs(sx) < 0.15) sx = 0;
        if (b(14)) sx = -1; if (b(15)) sx = 1;
        return { steer: sx, throttle: Math.max(v(7), b(12) ? 1 : 0), brake: Math.max(v(6), b(13) ? 1 : 0), drift: b(0) || b(5), nitro: b(2) || b(1) || b(4) };
    }

    /** Driving controls for this frame. */
    poll(dt) {
        const H = this.held, T = this.touchHeld;
        const pad = this.pollPads();
        const left = H.has('left') || T.has('left'), right = H.has('right') || T.has('right');
        const target = (right ? 1 : 0) - (left ? 1 : 0);
        // Ease the keyboard steer: quick to centre, a little slower to full lock.
        const rate = target === 0 ? 7 : Math.sign(target) !== Math.sign(this.steer) ? 9 : 4.5;
        this.steer += Math.max(-rate * dt, Math.min(rate * dt, target - this.steer));
        const c = this.ctl;
        c.steer = pad && pad.steer ? pad.steer : this.steer;
        const brake = H.has('brake') || T.has('brake') || (pad && pad.brake > 0.2);
        const gas = H.has('gas') || T.has('gas') || (pad && pad.throttle > 0.1) || (this.autoGas && this.touch && !brake);
        c.throttle = pad && pad.throttle > 0.1 ? pad.throttle : gas ? 1 : 0;
        c.brake = pad && pad.brake > 0.2 ? pad.brake : brake ? 1 : 0;
        c.drift = H.has('drift') || T.has('drift') || !!(pad && pad.drift);
        c.nitro = H.has('nitro') || T.has('nitro') || !!(pad && pad.nitro);
        return c;
    }

    clear() { this.held.clear(); this.touchHeld.clear(); this.ptr.clear(); this.steer = 0; }
}
