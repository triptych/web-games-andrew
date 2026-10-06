// Input: keyboard, and on touch screens a D-pad (slide your thumb between directions), A, B and Menu.
// Keys: arrows / WASD move · Z, Space, Enter = A · X, Backspace = B · Esc, M = menu · Shift = run.

const $ = (id) => document.getElementById(id);
const KEYDIR = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };

export class Input {
    constructor() {
        this.isTouch = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
        this.held = [];             // direction stack, most recent last
        this.keys = new Set();
        this.edges = new Set();     // a, b, menu, up/down/left/right (pressed this frame)
        this.touchDir = null;
        this.touchA = false; this.touchB = false;
        addEventListener('keydown', (e) => {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
            const c = e.code;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace'].includes(c)) e.preventDefault();
            if (e.repeat) { if (KEYDIR[c]) this.edges.add(KEYDIR[c] + 'R'); return; }
            this.keys.add(c);
            const d = KEYDIR[c];
            if (d) { this.held = this.held.filter((x) => x !== d); this.held.push(d); this.edges.add(d); }
            if (c === 'KeyZ' || c === 'Space' || c === 'Enter' || c === 'NumpadEnter') this.edges.add('a');
            if (c === 'KeyX' || c === 'Backspace') this.edges.add('b');
            if (c === 'Escape' || c === 'KeyM' || c === 'Tab') this.edges.add('menu');
        });
        addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
            const d = KEYDIR[e.code];
            if (d && !Object.entries(KEYDIR).some(([k, v]) => v === d && this.keys.has(k))) this.held = this.held.filter((x) => x !== d);
        });
        addEventListener('blur', () => { this.keys.clear(); this.held = []; this.touchDir = null; this.touchA = this.touchB = false; });
        this.setupTouch();
    }

    setupTouch() {
        const pad = $('dpad');
        if (!pad) return;
        let pid = null;
        const dirAt = (e) => {
            const r = pad.getBoundingClientRect();
            const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
            if (Math.hypot(dx, dy) < r.width * 0.12) return null;
            return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        };
        const set = (d) => {
            if (d && d !== this.touchDir) this.edges.add(d);
            this.touchDir = d;
            for (const k of ['up', 'down', 'left', 'right']) pad.classList.toggle(k, d === k);
        };
        pad.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        pad.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
        pad.addEventListener('pointerdown', (e) => { e.preventDefault(); pid = e.pointerId; pad.setPointerCapture?.(e.pointerId); set(dirAt(e)); });
        pad.addEventListener('pointermove', (e) => { if (e.pointerId === pid) set(dirAt(e)); });
        const up = (e) => { if (e.pointerId === pid) { pid = null; set(null); } };
        pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up); pad.addEventListener('lostpointercapture', up);
        const btn = (id, edge, flag) => {
            const b = $(id);
            if (!b) return;
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.edges.add(edge); if (flag) this[flag] = true; b.classList.add('down'); b.setPointerCapture?.(e.pointerId); });
            // No synthetic click afterwards: it would land on whatever this press just opened.
            b.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
            b.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
            const off = () => { if (flag) this[flag] = false; b.classList.remove('down'); };
            b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
        };
        btn('tb-a', 'a', 'touchA');
        btn('tb-b', 'b', 'touchB');
        btn('tb-menu', 'menu', null);
    }

    /** The direction being held right now (keyboard or D-pad). */
    dir() { return this.touchDir || this.held[this.held.length - 1] || null; }
    run() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('KeyX') || this.touchB; }
    hit(k) { return this.edges.has(k); }
    clear() { this.edges.clear(); }
}
