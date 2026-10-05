/**
 * input.js — keyboard, gamepad and touch, merged into one per-frame snapshot:
 *   { x, z, run, atk, jump, spec, ovr, specHeld, pause }  (edges are one-shot)
 * plus menu navigation events (up/down/left/right/ok/back) for the UI.
 *
 * Keyboard: WASD/arrows move (up = into the screen), J/Z attack, K/X/Space
 * jump, L/C special, I/V overdrive, double-tap left/right to run, Esc/P pause.
 * Touch: a floating stick on the left half (push it all the way to run) and
 * ATK / JUMP / SPECIAL / OVERDRIVE buttons on the right.
 */

const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    KeyJ: 'atk', KeyZ: 'atk', KeyK: 'jump', KeyX: 'jump', Space: 'jump', KeyL: 'spec', KeyC: 'spec', KeyI: 'ovr', KeyV: 'ovr', KeyF: 'ovr',
    Escape: 'pause', KeyP: 'pause',
};

export class Input {
    constructor() {
        this.held = new Set();
        this.edges = {};
        this.lastTap = { left: 0, right: 0 };
        this.runDir = 0;
        this.menuQueue = [];
        this.touch = { active: false, stickId: null, sx: 0, sy: 0, x: 0, y: 0, mag: 0, btn: {}, fullT: 0 };
        this.usingTouch = false;
        this.padPrev = {};
        this.listeners = [];
        this.enabled = true;
        this._bind();
    }

    _bind() {
        window.addEventListener('keydown', (e) => {
            const a = KEYMAP[e.code];
            if (e.code === 'Tab') e.preventDefault();
            if (a) {
                if (!e.repeat) {
                    this.edges[a] = true;
                    if (a === 'left' || a === 'right') {
                        const now = performance.now();
                        if (now - this.lastTap[a] < 260) this.runDir = a === 'left' ? -1 : 1;
                        this.lastTap[a] = now;
                    }
                }
                this.held.add(a);
                if (['up', 'down', 'left', 'right', 'jump'].includes(a) || e.code === 'Space') e.preventDefault();
            }
            const nav = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Enter: 'ok', Space: 'ok', KeyJ: 'ok', KeyZ: 'ok', Escape: 'back', Backspace: 'back', KeyX: 'back' }[e.code];
            if (nav && !e.repeat) this.menuQueue.push(nav);
            this.usingTouch = false;
            for (const fn of this.listeners) fn('key', e);
        });
        window.addEventListener('keyup', (e) => {
            const a = KEYMAP[e.code];
            if (a) {
                this.held.delete(a);
                if ((a === 'left' && this.runDir < 0) || (a === 'right' && this.runDir > 0)) this.runDir = 0;
            }
        });
        window.addEventListener('blur', () => { this.held.clear(); this.runDir = 0; });
    }

    onAny(fn) { this.listeners.push(fn); }

    // ---------------------------------------------------------------- touch
    bindTouch(root) {
        const T = this.touch;
        const zone = root.querySelector('#t-stickzone');
        const base = root.querySelector('#t-stick');
        const knob = root.querySelector('#t-knob');
        const R = () => Math.max(40, Math.min(70, window.innerWidth * 0.08));
        const show = (on) => { base.classList.toggle('on', on); };
        zone.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.usingTouch = true;
            if (T.stickId !== null) return;
            T.stickId = e.pointerId; T.sx = e.clientX; T.sy = e.clientY; T.x = 0; T.y = 0; T.mag = 0;
            base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px'; show(true);
            knob.style.transform = 'translate(-50%,-50%)';
            zone.setPointerCapture?.(e.pointerId);
        });
        zone.addEventListener('pointermove', (e) => {
            if (e.pointerId !== T.stickId) return;
            const r = R();
            let dx = e.clientX - T.sx, dy = e.clientY - T.sy;
            const d = Math.hypot(dx, dy);
            if (d > r) { // drag the base along so the stick never "runs out"
                T.sx += dx * (1 - r / d); T.sy += dy * (1 - r / d);
                base.style.left = T.sx + 'px'; base.style.top = T.sy + 'px';
                dx = e.clientX - T.sx; dy = e.clientY - T.sy;
            }
            T.x = dx / r; T.y = dy / r; T.mag = Math.min(1, Math.hypot(T.x, T.y));
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        });
        const end = (e) => { if (e.pointerId !== T.stickId) return; T.stickId = null; T.x = T.y = T.mag = 0; show(false); };
        zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);

        for (const el of root.querySelectorAll('[data-btn]')) {
            const a = el.dataset.btn;
            el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.usingTouch = true; this.edges[a] = true; T.btn[a] = true; el.classList.add('down'); if (navigator.vibrate) try { navigator.vibrate(8); } catch { /* ignore */ } });
            const up = (e) => { e.preventDefault(); T.btn[a] = false; el.classList.remove('down'); };
            el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
        }
    }

    // ---------------------------------------------------------------- gamepad
    _pad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = pads && [...pads].find((p) => p && p.connected);
        if (!gp) return null;
        const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
        const st = { a: b(0), b: b(1), x: b(2), y: b(3), lb: b(4), rb: b(5), lt: b(6), rt: b(7), back: b(8), start: b(9), up: b(12), down: b(13), left: b(14), right: b(15) };
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const out = { x: Math.abs(ax) > 0.25 ? ax : 0, y: Math.abs(ay) > 0.25 ? ay : 0, st };
        if (st.left) out.x = -1; if (st.right) out.x = 1; if (st.up) out.y = -1; if (st.down) out.y = 1;
        const P = this.padPrev;
        const edge = (k) => st[k] && !P[k];
        if (edge('a')) this.edges.jump = true;
        if (edge('x')) this.edges.atk = true;
        if (edge('b')) this.edges.spec = true;
        if (edge('y') || edge('rt') || edge('rb')) this.edges.ovr = true;
        if (edge('start')) this.edges.pause = true;
        // menu nav
        if (edge('a') || edge('start')) this.menuQueue.push('ok');
        if (edge('b') || edge('back')) this.menuQueue.push('back');
        const dirs = { up: out.y < -0.6, down: out.y > 0.6, left: out.x < -0.6, right: out.x > 0.6 };
        for (const k of Object.keys(dirs)) { if (dirs[k] && !P['n' + k]) this.menuQueue.push(k); P['n' + k] = dirs[k]; }
        out.specHeld = st.b;
        out.run = st.lb || st.lt || Math.abs(ax) > 0.95;
        Object.assign(P, st);
        return out;
    }

    /** One snapshot per frame. Edges are consumed. */
    poll(dt) {
        const pad = this._pad();
        const h = this.held;
        let x = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0);
        let z = (h.has('up') ? 1 : 0) - (h.has('down') ? 1 : 0);
        let run = this.runDir !== 0 && Math.sign(x) === this.runDir;
        let specHeld = h.has('spec');
        const T = this.touch;
        if (T.stickId !== null) {
            const tx = Math.abs(T.x) > 0.22 ? Math.max(-1, Math.min(1, T.x)) : 0;
            const tz = Math.abs(T.y) > 0.3 ? -Math.max(-1, Math.min(1, T.y)) : 0;
            x = tx; z = tz;
            if (Math.abs(T.x) > 0.88) T.fullT += dt; else T.fullT = 0;
            run = T.fullT > 0.12;
        }
        if (T.btn.spec) specHeld = true;
        if (pad) {
            if (pad.x) x = pad.x; if (pad.y) z = -pad.y;
            if (pad.run && Math.abs(x) > 0.5) run = true;
            if (pad.specHeld) specHeld = true;
        }
        const e = this.edges;
        const snap = { x: Math.max(-1, Math.min(1, x)), z: Math.max(-1, Math.min(1, z)), run, specHeld, atk: !!e.atk, jump: !!e.jump, spec: !!e.spec, ovr: !!e.ovr, pause: !!e.pause };
        this.edges = {};
        return snap;
    }

    takeMenu() { const q = this.menuQueue; this.menuQueue = []; this._pad(); return q; }
    clear() { this.edges = {}; this.menuQueue = []; }
}
