// Keyboard, gamepad and touch, merged into one state: { x, up, down } plus a queue of presses.
// Touch: a floating stick on the left of the screen (up = vanes, down = drill).

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, up: false, down: false, prev: [] };
        this.lastDevice = 'keys';
        this.enabled = true;

        window.addEventListener('keydown', (e) => {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
            const k = e.code;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
            this.lastDevice = 'keys';
            if (!this.keys.has(k)) this.queue.push({ key: k });
            this.keys.add(k);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => { this.keys.clear(); this.stick.active = false; this.stick.x = this.stick.y = 0; });
    }

    /** Wire the touch stick. zone: the element that captures the left thumb; el: the visual stick. */
    bindStick(zone, el, knob) {
        this.stickEl = el; this.knob = knob;
        const R = () => Math.min(70, Math.max(48, window.innerWidth * 0.12));
        const start = (e) => {
            if (this.stick.active) return;
            e.preventDefault();
            this.lastDevice = 'touch';
            const r = zone.getBoundingClientRect();
            this.stick.active = true;
            this.stick.id = e.pointerId;
            this.stick.ox = e.clientX; this.stick.oy = e.clientY;
            this.stick.x = this.stick.y = 0;
            el.style.left = `${e.clientX - r.left}px`;
            el.style.top = `${e.clientY - r.top}px`;
            el.classList.add('on');
            try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        };
        const move = (e) => {
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
        };
        const end = (e) => {
            if (e.pointerId !== this.stick.id) return;
            this.stick.active = false;
            this.stick.x = this.stick.y = 0;
            knob.style.transform = 'translate(0px, 0px)';
            el.classList.remove('on');
        };
        zone.addEventListener('pointerdown', start);
        zone.addEventListener('pointermove', move);
        zone.addEventListener('pointerup', end);
        zone.addEventListener('pointercancel', end);
        zone.addEventListener('lostpointercapture', end);
    }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = 0; this.pad.up = this.pad.down = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        let x = Math.abs(ax) > 0.3 ? ax : 0;
        if (b(14)) x = -1;
        if (b(15)) x = 1;
        this.pad.x = x;
        this.pad.up = ay < -0.5 || b(12) || b(7);
        this.pad.down = ay > 0.55 || b(13) || b(6);
        const map = { 0: 'KeyE', 1: 'Escape', 2: 'Digit1', 3: 'Digit4', 4: 'Digit3', 5: 'Digit5', 8: 'KeyJ', 9: 'KeyP' };
        for (const i in map) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: map[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        if (x || this.pad.up || this.pad.down) this.lastDevice = 'pad';
    }

    state() {
        this._pollPad();
        const k = this.keys;
        let x = 0;
        if (k.has('ArrowLeft') || k.has('KeyA')) x -= 1;
        if (k.has('ArrowRight') || k.has('KeyD')) x += 1;
        let up = k.has('ArrowUp') || k.has('KeyW') || k.has('Space');
        let down = k.has('ArrowDown') || k.has('KeyS');
        if (this.pad.x) x = this.pad.x;
        up = up || this.pad.up;
        down = down || this.pad.down;
        if (this.stick.active) {
            const sx = this.stick.x, sy = this.stick.y;
            // a little dead zone, and favour the strongest axis so diagonals don't stall drilling
            if (Math.abs(sx) > 0.3) x = Math.max(-1, Math.min(1, sx * 1.3));
            if (sy < -0.38) up = true;
            if (sy > 0.45 && Math.abs(sx) < 0.65) down = true;
            if (down && Math.abs(sx) < 0.5) x = 0;
        }
        if (!this.enabled) return { x: 0, up: false, down: false };
        return { x, up, down };
    }

    drain() { const q = this.queue; this.queue = []; return q; }
    clear() { this.keys.clear(); this.queue.length = 0; }
}
