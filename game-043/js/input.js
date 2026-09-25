// ============================================================
// Keyboard + touch. A floating joystick appears where the left
// thumb lands; A is the smart action, B is run (hold) / cancel.
// ============================================================

export class Input {
    constructor() {
        this.keys = new Set();
        this.stick = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.a = false; this.b = false;
        this.edges = [];
        this.handlers = {};
        this.touchMode = false;
        this.bindKeys();
    }
    on(name, fn) { this.handlers[name] = fn; }
    fire(name, arg) { this.handlers[name]?.(arg); }

    bindKeys() {
        addEventListener('keydown', e => {
            if (e.target instanceof HTMLInputElement) return;
            const k = e.key.toLowerCase();
            if (!this.keys.has(k)) this.edges.push(k);
            this.keys.add(k);
            if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
            this.fire('key', k);
        });
        addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
        addEventListener('blur', () => { this.keys.clear(); this.a = this.b = false; this.stick.on = false; });
    }

    bindTouch(zone, stickEl, knobEl, aBtn, bBtn) {
        this.stickEl = stickEl; this.knobEl = knobEl;
        const R = 50;
        zone.addEventListener('pointerdown', e => {
            if (this.stick.on) return;
            this.touchMode = true;
            zone.setPointerCapture?.(e.pointerId);
            const s = this.stick;
            s.on = true; s.id = e.pointerId; s.ox = e.clientX; s.oy = e.clientY; s.x = 0; s.y = 0;
            const zr = zone.getBoundingClientRect();
            stickEl.style.left = (e.clientX - zr.left) + 'px'; stickEl.style.top = (e.clientY - zr.top) + 'px';
            stickEl.classList.add('on'); knobEl.style.transform = '';
            e.preventDefault();
        });
        zone.addEventListener('pointermove', e => {
            const s = this.stick;
            if (!s.on || e.pointerId !== s.id) return;
            let dx = e.clientX - s.ox, dy = e.clientY - s.oy;
            const d = Math.hypot(dx, dy);
            if (d > R) {
                // drag the anchor along so reversing direction is instant
                const k = (d - R) / d; s.ox += dx * k; s.oy += dy * k; dx *= R / d; dy *= R / d;
                const zr = zone.getBoundingClientRect();
                stickEl.style.left = (s.ox - zr.left) + 'px'; stickEl.style.top = (s.oy - zr.top) + 'px';
            }
            s.x = dx / R; s.y = dy / R;
            knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
            e.preventDefault();
        });
        const end = e => { const s = this.stick; if (e.pointerId !== s.id) return; s.on = false; s.x = s.y = 0; stickEl.classList.remove('on'); };
        zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); zone.addEventListener('lostpointercapture', end);
        const btn = (el, name) => {
            el.addEventListener('pointerdown', e => { this.touchMode = true; this[name] = true; el.classList.add('on'); this.edges.push(name === 'a' ? 'btn-a' : 'btn-b'); e.preventDefault(); });
            const up = () => { this[name] = false; el.classList.remove('on'); };
            el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
        };
        btn(aBtn, 'a'); btn(bBtn, 'b');
    }

    /** Movement vector and flags for this frame. */
    read() {
        const k = this.keys;
        let mx = 0, my = 0;
        if (k.has('arrowleft') || k.has('a')) mx -= 1;
        if (k.has('arrowright') || k.has('d')) mx += 1;
        if (k.has('arrowup') || k.has('w')) my -= 1;
        if (k.has('arrowdown') || k.has('s')) my += 1;
        if (this.stick.on) {
            const d = Math.hypot(this.stick.x, this.stick.y);
            if (d > 0.18) { mx = this.stick.x; my = this.stick.y; }
        }
        const edges = this.edges; this.edges = [];
        const act = edges.some(e => e === ' ' || e === 'e' || e === 'j' || e === 'enter' || e === 'btn-a');
        const cancel = edges.some(e => e === 'escape' || e === 'btn-b' || e === 'x');
        const run = k.has('shift') || k.has('k') || this.b;
        return { mx, my, run, act, cancel, edges };
    }
    clear() { this.edges = []; }
}
