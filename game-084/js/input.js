// Keyboard, gamepad and the touch pad merged into one VESTA-8 button mask, plus an ordered queue
// of presses for menus. A button pressed and released between two frames still counts once
// (it is latched until the console has seen it).

import { V } from './runtime/index.js';

const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down', KeyZ: 'a', Space: 'a', KeyJ: 'a', KeyX: 'b', KeyK: 'b',
};

export class Input {
    constructor() {
        this.keys = new Set();
        this.latch = 0;
        this.touch = {};
        this.queue = [];
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.capture = false;            // true while a cart is playing: game keys don't scroll or type
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            this.lastDevice = 'keys';
            const b = KEYMAP[e.code];
            // Space and the arrows must not scroll, but Space must still press a focused button
            if (this.capture && b && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (b && this.capture) { this.latch |= V.BTN[b]; this.keys.add(b); }
        });
        window.addEventListener('keyup', (e) => { const b = KEYMAP[e.code]; if (b) this.keys.delete(b); });
        window.addEventListener('blur', () => this.clear());
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
        this.padPrev = {};
    }

    /** Wire the on-screen pad: each button acts on finger-down. */
    bindPad(root) {
        for (const el of root.querySelectorAll('[data-b]')) {
            const b = el.dataset.b;
            const down = (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ } this.touch[b] = true; this.latch |= V.BTN[b]; el.classList.add('on'); };
            const up = (e) => { e.preventDefault(); this.touch[b] = false; el.classList.remove('on'); };
            el.addEventListener('pointerdown', down);
            for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, up);
            el.addEventListener('contextmenu', (e) => e.preventDefault());
        }
    }

    _pad() {
        let m = 0;
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of pads) {
            if (!gp || !gp.connected) continue;
            const pb = (i) => !!gp.buttons[i]?.pressed;
            const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
            if (pb(14) || ax < -0.4) m |= V.BTN.left;
            if (pb(15) || ax > 0.4) m |= V.BTN.right;
            if (pb(12) || ay < -0.4) m |= V.BTN.up;
            if (pb(13) || ay > 0.4) m |= V.BTN.down;
            if (pb(0)) m |= V.BTN.a;
            if (pb(1) || pb(2)) m |= V.BTN.b;
            if (pb(9) && !this.padPrev.start) this.queue.push({ key: 'Escape', pad: true });
            this.padPrev.start = pb(9);
        }
        if (m) this.lastDevice = 'pad';
        return m;
    }

    /** Buttons held this console frame (and any pressed since the last one). */
    mask() {
        let m = this._pad() | this.latch;
        for (const k of this.keys) m |= V.BTN[k];
        for (const k in this.touch) if (this.touch[k]) m |= V.BTN[k];
        return m;
    }
    consume() { this.latch = 0; }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.latch = 0; }
    clear() { this.keys.clear(); this.touch = {}; this.flush(); }
}
