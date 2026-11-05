// Keyboard, mouse, gamepad and touch merged into one state, plus an ordered queue of menu presses.
//
// - Held directions are read every frame.
// - Fire, missile and jump presses are *edges* that stay set until a simulation step consumes them: a
//   frame shorter than the fixed step runs no step, and a tap or a click made in it must not be lost.
//   A fire press that is released before any step still fires once (game-079).
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not collapse.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };

class Stick {
    constructor(zone, el, knob, input) {
        this.zone = zone; this.el = el; this.knob = knob; this.input = input;
        Object.assign(this, { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 });
        const R = () => Math.min(70, Math.max(48, window.innerWidth * 0.12));
        const end = (e) => {
            if (e.pointerId !== this.id) return;
            this.active = false; this.x = this.y = 0; knob.style.transform = ''; el.classList.remove('on');
        };
        zone.addEventListener('pointerdown', (e) => {
            if (this.active) return;
            e.preventDefault();
            const r = zone.getBoundingClientRect();
            Object.assign(this, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
            el.style.left = `${e.clientX - r.left}px`; el.style.top = `${e.clientY - r.top}px`; el.style.bottom = 'auto'; el.style.right = 'auto';
            el.classList.add('on');
            try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        zone.addEventListener('pointermove', (e) => {
            if (!this.active || e.pointerId !== this.id) return;
            e.preventDefault();
            const rad = R();
            let dx = e.clientX - this.ox, dy = e.clientY - this.oy;
            const d = Math.hypot(dx, dy);
            if (d > rad) {          // drag the base along so the thumb never runs off the end
                const k = (d - rad) / d;
                this.ox += dx * k; this.oy += dy * k;
                const r = zone.getBoundingClientRect();
                el.style.left = `${this.ox - r.left}px`; el.style.top = `${this.oy - r.top}px`;
                dx = e.clientX - this.ox; dy = e.clientY - this.oy;
            }
            this.x = dx / rad; this.y = dy / rad;
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, end);
    }
}

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.queue = [];
        this.edges = { fire: false, msl: false, jump: false };
        this.mouse = { x: 0, y: 0, down: false, seen: false };
        this.btn = { fire: false, boost: false, jump: false };
        this.pad = { x: 0, y: 0, ax: 0, az: 0, fire: false, boost: false, jet: false, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.move = null; this.aimS = null;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a slider or a select keeps its own keys, but Escape must still close the sheet it sits in (game-117, game-118)
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused button (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            if (this.lastDevice !== 'mouse' || !e.code.startsWith('Arrow')) this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (e.code === 'Space') this.edges.jump = true;
            if (e.code === 'KeyE' || e.code === 'KeyK') this.edges.msl = true;
            if (e.code === 'KeyJ' || e.code === 'KeyZ' || e.code.startsWith('Arrow')) this.edges.fire = true;
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        // Capture phase, so a touch on any menu switches the touch deck on before play starts.
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch' && this.lastDevice !== 'touch') { this.lastDevice = 'touch'; this.onTouch?.(); }
        }, { capture: true });
        window.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse') { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.seen = true; this.lastDevice = 'mouse'; }
        });
        canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'mouse') return;
            this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.seen = true; this.lastDevice = 'mouse';
            if (e.button === 0) { this.mouse.down = true; this.edges.fire = true; } else if (e.button === 2) this.edges.msl = true;
        });
        window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) this.mouse.down = false; });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    bindTouch(els) {
        this.move = new Stick(els.moveZone, els.moveStick, els.moveStick.querySelector('.knob'), this);
        this.aimS = new Stick(els.aimZone, els.aimStick, els.aimStick.querySelector('.knob'), this);
        const hold = (btn, name, edge) => {
            const on = (e) => { e.preventDefault(); this.btn[name] = true; btn.classList.add('held'); if (edge) this.edges[edge] = true; try { btn.setPointerCapture(e.pointerId); } catch { /* */ } };
            const off = () => { this.btn[name] = false; btn.classList.remove('held'); };
            btn.addEventListener('pointerdown', on);
            for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, off);
        };
        hold(els.fire, 'fire', 'fire'); hold(els.boost, 'boost'); hold(els.jump, 'jump', 'jump');
        els.msl.addEventListener('pointerdown', (e) => { e.preventDefault(); this.edges.msl = true; els.msl.classList.add('held'); });
        for (const ev of ['pointerup', 'pointercancel']) els.msl.addEventListener(ev, () => els.msl.classList.remove('held'));
    }

    pressJump() { this.edges.jump = true; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        const P = this.pad;
        if (!gp) { P.x = P.y = P.ax = P.az = 0; P.fire = P.boost = P.jet = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed, dead = (v) => (Math.abs(v) > 0.22 ? v : 0);
        P.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0); P.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        P.ax = dead(gp.axes[2] || 0); P.az = dead(gp.axes[3] || 0);
        P.fire = b(7) || b(5) || Math.hypot(P.ax, P.az) > 0.6; P.boost = b(4) || b(6); P.jet = b(0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !P.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            P.prev[i] = b(+i);
        }
        if (b(0) && !P.prev.a) this.edges.jump = true; P.prev.a = b(0);
        if (b(1) && !P.prev.b) this.edges.msl = true; P.prev.b = b(1);
        if (b(7) && !P.prev.r) this.edges.fire = true; P.prev.r = b(7);
        if (Math.hypot(P.x, P.y, P.ax, P.az) > 0) this.lastDevice = 'pad';
    }

    /** The held state for this frame. Aim from the mouse is filled in by main.js (it needs the camera). */
    state() {
        this._pollPad();
        const k = this.keys, P = this.pad;
        let x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), y = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
        let aim = null, fire = false;
        const ax = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0), az = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0);
        if (ax || az) { aim = { x: ax, z: az, dev: 'keys' }; fire = true; }
        if (P.x || P.y) { x = P.x; y = P.y; }
        if (Math.hypot(P.ax, P.az) > 0.3) { aim = { x: P.ax, z: P.az, dev: 'pad' }; }
        fire = fire || P.fire;
        const m = this.move, a = this.aimS;
        if (m?.active && Math.hypot(m.x, m.y) > 0.15) { x = m.x; y = m.y; }
        if (a?.active) { if (Math.hypot(a.x, a.y) > 0.25) { aim = { x: a.x, z: a.y, dev: 'touch' }; fire = true; } }
        fire = fire || this.btn.fire || this.mouse.down;
        const len = Math.hypot(x, y); if (len > 1) { x /= len; y /= len; }
        const jetHeld = k.has('Space') || this.btn.jump || P.jet;
        return { x, y, aim, mouse: this.lastDevice === 'mouse' && this.mouse.seen, fire: fire || this.edges.fire, msl: this.edges.msl, jump: this.edges.jump, jet: jetHeld,
            boost: k.has('ShiftLeft') || k.has('ShiftRight') || this.btn.boost || P.boost };
    }

    consumeEdges() { this.edges.fire = false; this.edges.msl = false; this.edges.jump = false; }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.consumeEdges(); }
    clear() { this.keys.clear(); this.flush(); this.mouse.down = false; this.btn.fire = this.btn.boost = this.btn.jump = false; }
}
