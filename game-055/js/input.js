// Keyboard, gamepad and pointer input folded into the simulation's input
// record: analog direction (mx, my), a drag delta in field units (dx, dy),
// held focus/fire, and edge-triggered bomb/overdrive/pause.
//
// Touch and mouse both use relative dragging: the helicopter moves with the
// finger, wherever the finger is, so it never hides under it.

export class Input {
    constructor(target) {
        this.keys = new Set();
        this.edges = new Set();
        this.drag = { x: 0, y: 0 };
        this.pointers = new Map();
        this.scale = 1;          // CSS px per field unit
        this.sens = 1.2;
        this.autofire = true;
        this.focusToggle = false;
        this.touchUsed = false;
        this.enabled = false;
        this.padPrev = {};
        this.onPause = null;
        this.onAny = null;

        addEventListener('keydown', (e) => {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
            const k = e.code;
            if (!this.keys.has(k)) this.edges.add(k);
            this.keys.add(k);
            if (this.enabled && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
            if ((k === 'Escape' || k === 'KeyP') && this.onPause) this.onPause();
            if (this.onAny) this.onAny('key');
        });
        addEventListener('keyup', (e) => this.keys.delete(e.code));
        addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); });

        target.addEventListener('pointerdown', (e) => {
            if (!this.enabled) return;
            if (e.pointerType === 'touch') this.touchUsed = true;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
            try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            if (this.onAny) this.onAny(e.pointerType);
            e.preventDefault();
        }, { passive: false });
        target.addEventListener('pointermove', (e) => {
            const p = this.pointers.get(e.pointerId);
            if (!p) return;
            // only the first pointer steers; others are ignored (buttons have their own)
            const first = this.pointers.keys().next().value;
            if (e.pointerId === first) {
                this.drag.x += (e.clientX - p.x) / this.scale * this.sens;
                this.drag.y += (e.clientY - p.y) / this.scale * this.sens;
            }
            p.x = e.clientX; p.y = e.clientY;
            e.preventDefault();
        }, { passive: false });
        const up = (e) => { this.pointers.delete(e.pointerId); };
        target.addEventListener('pointerup', up);
        target.addEventListener('pointercancel', up);
        target.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    edge(code) { if (this.edges.has(code)) { this.edges.delete(code); return true; } return false; }
    press(name) { this.edges.add('virt:' + name); }

    /** Build the input record for one rendered frame (consumed over its sim steps). */
    sample() {
        const k = this.keys;
        let mx = 0, my = 0;
        if (k.has('ArrowLeft') || k.has('KeyA')) mx -= 1;
        if (k.has('ArrowRight') || k.has('KeyD')) mx += 1;
        if (k.has('ArrowUp') || k.has('KeyW')) my -= 1;
        if (k.has('ArrowDown') || k.has('KeyS')) my += 1;
        let focus = k.has('ShiftLeft') || k.has('ShiftRight') || this.focusToggle;
        let fire = this.autofire || k.has('KeyZ') || k.has('KeyJ') || k.has('Space') || this.pointers.size > 0;
        let bomb = this.edge('KeyX') || this.edge('KeyK') || this.edge('virt:bomb');
        let od = this.edge('KeyC') || this.edge('KeyL') || this.edge('virt:od');
        // gamepad
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of pads) {
            if (!gp) continue;
            const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
            if (Math.hypot(ax, ay) > 0.18) { mx += ax; my += ay; }
            const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
            if (b(14)) mx -= 1; if (b(15)) mx += 1; if (b(12)) my -= 1; if (b(13)) my += 1;
            if (b(4) || b(6)) focus = true;
            if (b(0)) fire = true;
            const was = this.padPrev;
            if (b(1) && !was[1]) bomb = true;
            if ((b(3) || b(7)) && !was[3]) od = true;
            if (b(9) && !was[9] && this.onPause) this.onPause();
            this.padPrev = { 1: b(1), 3: b(3) || b(7), 9: b(9) };
            if ((b(0) || b(1) || Math.abs(ax) > 0.5) && this.onAny) this.onAny('pad');
        }
        const dx = this.drag.x, dy = this.drag.y;
        this.drag.x = 0; this.drag.y = 0;
        return { mx, my, dx, dy, focus, fire, bomb, od };
    }

    clear() { this.edges.clear(); this.drag.x = this.drag.y = 0; }
}
