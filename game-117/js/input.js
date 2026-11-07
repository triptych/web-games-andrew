// Keyboard, mouse, gamepad and touch merged into one twin-stick state:
//   { x, y }   move, screen terms, y down
//   { ax, ay } aim, screen terms, y down
//   fire       held, or pressed since the last sim step (a tap that comes and goes inside one
//              frame still fires once)
//   dash       an edge that stays set until a sim step consumes it
// plus an ordered queue of presses for the menus (one consumed per frame, so at 2 fps
// "Down, Down, Enter" doesn't collapse into one frame's worth of keys).

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const AIM_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyI', 'KeyJ', 'KeyK', 'KeyL'];
const DASH_KEYS = ['Space', 'ShiftLeft', 'ShiftRight'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.edges = { dash: false, fire: false };
        this.sticks = {
            move: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 },
            aim: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 },
        };
        this.pad = { x: 0, y: 0, ax: 0, ay: 0, fire: false, prev: [] };
        this.mouse = { x: 0, y: 0, down: false, moved: -1e9, inside: false };
        this.lastDevice = 'keys';
        this.onTouch = null;          // called when a touch is first seen
        this.aimFrom = null;          // (clientX, clientY) => [ax, ay] | null, from the view
        this.lastAim = [0, -1];
        this.enabled = true;          // false while a menu is up: the canvas ignores the mouse

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a focused slider or list keeps its arrow keys, but Escape still closes the screen
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (e.code === 'Escape' && !e.repeat) this.queue.push({ key: e.code }); return; }
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (DASH_KEYS.includes(e.code) && tag !== 'BUTTON') this.edges.dash = true;
            if (AIM_KEYS.includes(e.code)) this.edges.fire = true;
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

    /** Mouse aiming over the canvas: point to aim, hold the button to fire. */
    bindMouse(canvas) {
        const mv = (e) => {
            if (e.pointerType === 'touch') return;
            this.mouse.x = e.clientX; this.mouse.y = e.clientY;
            this.mouse.moved = performance.now();
            this.mouse.inside = true;
            if (this.lastDevice !== 'keys' || !this.keysAiming()) this.lastDevice = 'mouse';
        };
        canvas.addEventListener('pointermove', mv);
        canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch' || !this.enabled) return;
            mv(e);
            if (e.button === 0) { this.mouse.down = true; this.edges.fire = true; }
            if (e.button === 2) this.edges.dash = true;
        });
        window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch' && e.button === 0) this.mouse.down = false; });
        canvas.addEventListener('pointerleave', () => { this.mouse.inside = false; });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    keysAiming() { return AIM_KEYS.some((k) => this.keys.has(k)); }

    /** A floating stick: zone captures the thumb, el is the visual ring, knob follows the thumb. */
    bindStick(which, zone, el, knob) {
        const st = this.sticks[which];
        const R = () => Math.min(70, Math.max(46, window.innerWidth * 0.11));
        const place = (x, y) => {
            const r = zone.getBoundingClientRect();
            el.style.left = `${x - r.left}px`;
            el.style.top = `${y - r.top}px`;
            el.style.bottom = 'auto';
            el.style.right = 'auto';
        };
        const end = (e) => {
            if (e.pointerId !== st.id) return;
            st.active = false;
            st.x = st.y = 0;
            knob.style.transform = '';
            el.classList.remove('on');
        };
        zone.addEventListener('pointerdown', (e) => {
            if (st.active) return;
            e.preventDefault();
            Object.assign(st, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
            place(e.clientX, e.clientY);
            el.classList.add('on');
            try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        zone.addEventListener('pointermove', (e) => {
            if (!st.active || e.pointerId !== st.id) return;
            e.preventDefault();
            const rad = R();
            let dx = e.clientX - st.ox, dy = e.clientY - st.oy;
            const d = Math.hypot(dx, dy);
            if (d > rad) {
                // drag the base along so the thumb never runs off the end
                const k = (d - rad) / d;
                st.ox += dx * k; st.oy += dy * k;
                place(st.ox, st.oy);
                dx = e.clientX - st.ox; dy = e.clientY - st.oy;
            }
            st.x = dx / rad; st.y = dy / rad;
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, end);
    }

    /** A touch button that acts on finger-down (a click waits for the lift and feels late). */
    bindButton(btn, onPress) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(); });
    }

    pressDash() { this.edges.dash = true; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = this.pad.ax = this.pad.ay = 0; this.pad.fire = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.22 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        this.pad.ax = dead(gp.axes[2] || 0);
        this.pad.ay = dead(gp.axes[3] || 0);
        const fireBtn = b(7) || b(5);
        this.pad.fire = Math.hypot(this.pad.ax, this.pad.ay) > 0.5 || fireBtn;
        if (this.pad.x || this.pad.y || this.pad.ax || this.pad.ay) this.lastDevice = 'pad';
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        const dashBtn = b(0) || b(4) || b(6);
        if (dashBtn && !this.pad.prev.dash) this.edges.dash = true;
        this.pad.prev.dash = dashBtn;
        if (fireBtn && !this.pad.prev.fire) this.edges.fire = true;
        this.pad.prev.fire = fireBtn;
    }

    /** The held state for this frame. Edges stay set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
        let y = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
        let ax = (k.has('ArrowRight') || k.has('KeyL') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyJ') ? 1 : 0);
        let ay = (k.has('ArrowDown') || k.has('KeyK') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyI') ? 1 : 0);
        let fire = !!(ax || ay) || k.has('KeyF');
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        if (this.pad.ax || this.pad.ay) { ax = this.pad.ax; ay = this.pad.ay; }
        fire = fire || this.pad.fire;
        const ms = this.sticks.move, as = this.sticks.aim;
        if (ms.active && Math.hypot(ms.x, ms.y) > 0.18) { x = ms.x; y = ms.y; }
        if (as.active && Math.hypot(as.x, as.y) > 0.25) { ax = as.x; ay = as.y; fire = fire || Math.hypot(as.x, as.y) > 0.45; }
        // the mouse aims when it was the last thing to move and nothing else is aiming
        if (!ax && !ay && this.aimFrom && (this.lastDevice === 'mouse' || this.mouse.down) && this.mouse.inside !== false) {
            const a = this.aimFrom(this.mouse.x, this.mouse.y);
            if (a) { ax = a[0]; ay = a[1]; }
        }
        fire = fire || (this.mouse.down && this.enabled) || this.edges.fire;
        if (ax || ay) this.lastAim = [ax, ay];
        return { x, y, ax, ay, fire, dash: this.edges.dash };
    }

    consumeEdges() { this.edges.dash = false; this.edges.fire = false; }
    /** The next queued press, or null. Menus take one per frame. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; this.edges.dash = false; this.edges.fire = false; }
    clear() {
        this.keys.clear();
        this.flush();
        this.mouse.down = false;
        for (const st of Object.values(this.sticks)) { st.active = false; st.x = st.y = 0; }
    }
}
