// Raw input: mouse (click to move / attack, right button for the secondary skill), keyboard,
// and touch (a floating stick, tap to act, skill buttons). main.js turns this into world actions.

const $ = (id) => document.getElementById(id);

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.isTouch = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
        this.mouse = { x: innerWidth / 2, y: innerHeight / 2, left: false, right: false, leftPressed: false, rightPressed: false, moved: false, inside: false };
        this.keys = new Set();
        this.pressed = new Set();
        this.stick = { x: 0, y: 0, active: false, id: null, ox: 0, oy: 0 };
        this.taps = [];
        this.tbtn = new Map();
        this.wheel = 0;
        this.blockGame = true;

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        canvas.addEventListener('pointerdown', (e) => this.down(e));
        addEventListener('pointerup', (e) => this.up(e));
        addEventListener('pointercancel', (e) => this.up(e));
        addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = true; this.mouse.inside = e.target === canvas || e.target.closest?.('.layer') !== null; } });
        canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
        addEventListener('keydown', (e) => {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
            if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'AltLeft', 'AltRight'].includes(e.code)) e.preventDefault();
            if (!this.keys.has(e.code)) this.pressed.add(e.code);
            this.keys.add(e.code);
        });
        addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault(); });
        addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });

        // Floating stick.
        const zone = $('stick-zone'), base = $('stick-base'), knob = $('stick-knob');
        zone.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.stick.id = e.pointerId; this.stick.active = true; this.stick.ox = e.clientX; this.stick.oy = e.clientY;
            const r = zone.getBoundingClientRect();
            base.style.left = `${e.clientX - r.left}px`; base.style.top = `${e.clientY - r.top}px`;
            base.classList.add('on'); knob.style.transform = '';
            zone.setPointerCapture?.(e.pointerId);
        });
        zone.addEventListener('pointermove', (e) => {
            if (e.pointerId !== this.stick.id) return;
            let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
            const d = Math.hypot(dx, dy), max = 50;
            if (d > max) { dx *= max / d; dy *= max / d; }
            this.stick.x = dx / max; this.stick.y = dy / max;
            if (Math.hypot(this.stick.x, this.stick.y) < 0.18) this.stick.x = this.stick.y = 0;
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        const end = (e) => { if (e.pointerId !== this.stick.id) return; this.stick = { x: 0, y: 0, active: false, id: null }; base.classList.remove('on'); knob.style.transform = ''; };
        zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
        // Touch buttons.
        for (const b of document.querySelectorAll('#tbtns .tb')) {
            const key = b.id === 'tb-attack' ? 'attack' : 'slot' + b.dataset.slot;
            this.tbtn.set(key, { down: false, pressed: false, el: b });
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); const s = this.tbtn.get(key); s.down = true; s.pressed = true; b.classList.add('down'); b.setPointerCapture?.(e.pointerId); });
            const up = () => { const s = this.tbtn.get(key); s.down = false; b.classList.remove('down'); };
            b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
        }
    }

    down(e) {
        if (e.pointerType === 'mouse') {
            this.mouse.x = e.clientX; this.mouse.y = e.clientY;
            if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
            if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
            this.mouse.shift = e.shiftKey;
        } else {
            this.touchStart = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
        }
    }
    up(e) {
        if (e.pointerType === 'mouse') {
            if (e.button === 0) this.mouse.left = false;
            if (e.button === 2) this.mouse.right = false;
        } else if (this.touchStart && this.touchStart.id === e.pointerId) {
            const ts = this.touchStart;
            this.touchStart = null;
            if (Math.hypot(e.clientX - ts.x, e.clientY - ts.y) < 24 && performance.now() - ts.t < 600 && e.target === this.canvas) this.taps.push({ x: e.clientX, y: e.clientY });
        }
    }

    key(code) { return this.keys.has(code); }
    hit(code) { return this.pressed.has(code); }
    /** Movement from WASD / arrows / stick, in screen space (x right, y down). */
    moveVec() {
        let x = 0, y = 0;
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
        if (this.stick.active) { x += this.stick.x; y += this.stick.y; }
        return { x, y };
    }
    clearEdges() {
        this.pressed.clear();
        this.mouse.leftPressed = this.mouse.rightPressed = false;
        this.taps.length = 0;
        this.wheel = 0;
        for (const s of this.tbtn.values()) s.pressed = false;
    }
}
