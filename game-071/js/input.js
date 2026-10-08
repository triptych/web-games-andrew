/**
 * input.js — keyboard + mouse (pointer lock), gamepad and touch → one action snapshot.
 *
 * Held actions live in `held`; one-shot presses in `pressed` (consumed each frame). Look deltas
 * accumulate in radians. The game decides what an action means in the current mode.
 */
import { IS_TOUCH } from './config.js';

const KEYMAP = {
    KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump', KeyC: 'sneak', ControlLeft: 'sneak', KeyE: 'use', KeyF: 'use',
    KeyR: 'ready', KeyV: 'camera', Tab: 'tween', KeyI: 'inventory', KeyM: 'map', KeyJ: 'journal', KeyP: 'magic', KeyK: 'skills',
    KeyT: 'wait', Escape: 'pause', KeyQ: 'favorites', KeyZ: 'sigil', CapsLock: 'walk', F5: 'quicksave', F9: 'quickload',
    Digit1: 'hot1', Digit2: 'hot2', Digit3: 'hot3', Digit4: 'hot4', Digit5: 'hot5', Digit6: 'hot6', Digit7: 'hot7', Digit8: 'hot8',
    Enter: 'confirm', Backspace: 'back2', KeyX: 'sheathe', KeyB: 'debug',
};
const NO_DEFAULT = new Set(['Tab', 'Space', 'F5', 'F9', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace']);

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.held = new Set();
        this.pressed = new Set();
        this.released = new Set();
        this.look = { dx: 0, dy: 0 };
        this.move = { x: 0, y: 0 };
        this.sens = 1;
        this.invertY = false;
        this.wheel = 0;
        this.locked = false;
        this.wantLock = false;      // the game sets this while playing on desktop
        this.lastDevice = IS_TOUCH ? 'touch' : 'kb';
        this.keyListeners = [];     // UI can listen to raw keys
        this.touch = { stick: null, look: null, lookId: null, stickId: null, stickVec: { x: 0, y: 0 }, sprint: false };
        this.gp = { prev: [] };
        this.walkToggle = false;
        this._bind();
    }

    onKey(fn) { this.keyListeners.push(fn); return () => { this.keyListeners = this.keyListeners.filter((f) => f !== fn); }; }

    _press(a) { if (!this.held.has(a)) this.pressed.add(a); this.held.add(a); }
    _release(a) { if (this.held.has(a)) this.released.add(a); this.held.delete(a); }

    _bind() {
        window.addEventListener('keydown', (e) => {
            this.lastDevice = 'kb';
            for (const fn of this.keyListeners) if (fn(e) === true) { e.preventDefault(); return; }
            const a = KEYMAP[e.code];
            if (NO_DEFAULT.has(e.code) || (a && e.target === document.body)) e.preventDefault();
            if (!a || e.repeat) return;
            if (a === 'walk') { this.walkToggle = !this.walkToggle; return; }
            this._press(a);
        });
        window.addEventListener('keyup', (e) => {
            const a = KEYMAP[e.code];
            if (a) this._release(a);
        });
        window.addEventListener('blur', () => { for (const a of [...this.held]) this._release(a); });

        const c = this.canvas;
        c.addEventListener('mousedown', (e) => {
            if (e.pointerType === 'touch') return;
            this.lastDevice = 'kb';
            if (this.wantLock && !this.locked) { this.requestLock(); return; }
            if (!this.locked) return;
            if (e.button === 0) this._press('attack');
            if (e.button === 2) this._press('block');
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this._release('attack');
            if (e.button === 2) this._release('block');
        });
        c.addEventListener('contextmenu', (e) => e.preventDefault());
        window.addEventListener('mousemove', (e) => {
            if (!this.locked) return;
            this.look.dx += e.movementX * 0.0022 * this.sens;
            this.look.dy += e.movementY * 0.0022 * this.sens * (this.invertY ? -1 : 1);
        });
        window.addEventListener('wheel', (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
        document.addEventListener('pointerlockchange', () => {
            const was = this.locked;
            this.locked = document.pointerLockElement === c;
            if (was && !this.locked && this.onUnlock) this.onUnlock();
        });
    }

    requestLock() {
        if (IS_TOUCH || this.locked) return;
        try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* not allowed */ }
    }
    exitLock() { if (this.locked) document.exitPointerLock(); }

    // ---------------------------------------------------------------- touch
    bindTouch(root) {
        this.touchRoot = root;
        const look = root.querySelector('#t-look');
        const stickZone = root.querySelector('#t-stickzone');
        const base = root.querySelector('#t-stick');
        const knob = root.querySelector('#t-knob');
        const T = this.touch;
        const R = 52;
        const setKnob = (x, y) => { knob.style.transform = `translate(${x}px, ${y}px)`; };
        stickZone.addEventListener('pointerdown', (e) => {
            if (T.stickId !== null) return;
            this.lastDevice = 'touch';
            T.stickId = e.pointerId;
            T.sx = e.clientX; T.sy = e.clientY;
            base.style.left = `${e.clientX - 64}px`; base.style.top = `${e.clientY - 64}px`;
            base.classList.add('on');
            try { stickZone.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
            e.preventDefault();
        });
        const moveStick = (e) => {
            if (e.pointerId !== T.stickId) return;
            let dx = e.clientX - T.sx, dy = e.clientY - T.sy;
            const l = Math.hypot(dx, dy);
            T.sprint = l > R * 1.45;
            if (l > R) { dx *= R / l; dy *= R / l; }
            T.stickVec.x = dx / R; T.stickVec.y = -dy / R;
            setKnob(dx, dy);
            base.classList.toggle('sprint', T.sprint);
        };
        const endStick = (e) => {
            if (e.pointerId !== T.stickId) return;
            T.stickId = null; T.stickVec.x = 0; T.stickVec.y = 0; T.sprint = false;
            setKnob(0, 0);
            base.classList.remove('on', 'sprint');
        };
        stickZone.addEventListener('pointermove', moveStick);
        stickZone.addEventListener('pointerup', endStick);
        stickZone.addEventListener('pointercancel', endStick);

        look.addEventListener('pointerdown', (e) => {
            if (T.lookId !== null) return;
            this.lastDevice = 'touch';
            T.lookId = e.pointerId; T.lx = e.clientX; T.ly = e.clientY; T.lookStart = performance.now(); T.lookMoved = 0;
            try { look.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
            e.preventDefault();
        });
        look.addEventListener('pointermove', (e) => {
            if (e.pointerId !== T.lookId) return;
            const dx = e.clientX - T.lx, dy = e.clientY - T.ly;
            T.lx = e.clientX; T.ly = e.clientY;
            T.lookMoved += Math.abs(dx) + Math.abs(dy);
            this.look.dx += dx * 0.0058 * this.sens;
            this.look.dy += dy * 0.0058 * this.sens * (this.invertY ? -1 : 1);
        });
        const endLook = (e) => {
            if (e.pointerId !== T.lookId) return;
            // a quick tap on the world = use (talk, take, open)
            if (T.lookMoved < 10 && performance.now() - T.lookStart < 260) this.pressed.add('tapUse');
            T.lookId = null;
        };
        look.addEventListener('pointerup', endLook);
        look.addEventListener('pointercancel', endLook);

        for (const btn of root.querySelectorAll('[data-act]')) {
            const act = btn.dataset.act;
            const down = (e) => {
                e.preventDefault(); e.stopPropagation();
                this.lastDevice = 'touch';
                btn.classList.add('down');
                if (act === 'sneak') { this.pressed.add('sneak'); return; }
                this._press(act);
                // allow look-drag while holding attack: capture so the release is seen
                try { btn.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
            };
            const up = (e) => { btn.classList.remove('down'); if (act !== 'sneak') this._release(act); e.preventDefault(); };
            btn.addEventListener('pointerdown', down);
            btn.addEventListener('pointerup', up);
            btn.addEventListener('pointercancel', up);
            // dragging a finger off the attack button still turns the camera
            btn.addEventListener('pointermove', (e) => {
                if (!btn.classList.contains('down') || e.pointerType !== 'touch') return;
                if (btn._lx != null) {
                    this.look.dx += (e.clientX - btn._lx) * 0.0058 * this.sens;
                    this.look.dy += (e.clientY - btn._ly) * 0.0058 * this.sens * (this.invertY ? -1 : 1);
                }
                btn._lx = e.clientX; btn._ly = e.clientY;
            });
            btn.addEventListener('pointerup', () => { btn._lx = null; });
        }
    }

    // ---------------------------------------------------------------- gamepad
    pollGamepad(dt) {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = pads && [...pads].find((p) => p && p.connected);
        if (!gp) return null;
        const dz = (v) => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
        const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
        if (lx || ly || rx || ry) this.lastDevice = 'pad';
        this.look.dx += Math.sign(rx) * rx * rx * 3.2 * dt * this.sens;
        this.look.dy += Math.sign(ry) * ry * ry * 2.4 * dt * this.sens * (this.invertY ? -1 : 1);
        const map = { 0: 'jump', 1: 'sneak', 2: 'use', 3: 'ready', 4: 'favorites', 5: 'sigil', 6: 'block', 7: 'attack', 8: 'map', 9: 'pause', 10: 'sprint', 11: 'camera', 12: 'padUp', 13: 'padDown', 14: 'padLeft', 15: 'padRight' };
        gp.buttons.forEach((b, i) => {
            const a = map[i]; if (!a) return;
            const on = b.pressed || b.value > 0.5;
            if (on && !this.gp.prev[i]) { this.lastDevice = 'pad'; this._press(a); }
            if (!on && this.gp.prev[i]) this._release(a);
            this.gp.prev[i] = on;
        });
        return { x: lx, y: -ly };
    }

    /** Snapshot for this frame; clears one-shot presses and look deltas. */
    consume(dt) {
        const pad = this.pollGamepad(dt);
        let x = 0, y = 0;
        if (this.held.has('fwd')) y += 1;
        if (this.held.has('back')) y -= 1;
        if (this.held.has('right')) x += 1;
        if (this.held.has('left')) x -= 1;
        const l = Math.hypot(x, y);
        if (l > 1) { x /= l; y /= l; }
        let sprint = this.held.has('sprint');
        if (this.touch.stickId !== null) { x = this.touch.stickVec.x; y = this.touch.stickVec.y; sprint = sprint || this.touch.sprint; }
        if (pad && (pad.x || pad.y)) { x = pad.x; y = pad.y; }
        const snap = {
            move: { x, y },
            look: { dx: this.look.dx, dy: this.look.dy },
            held: new Set(this.held),
            pressed: new Set(this.pressed),
            released: new Set(this.released),
            sprint,
            walk: this.walkToggle,
            wheel: this.wheel,
            device: this.lastDevice,
        };
        this.look.dx = 0; this.look.dy = 0; this.wheel = 0;
        this.pressed.clear(); this.released.clear();
        return snap;
    }
}
