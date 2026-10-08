/**
 * input.js — mouse, touch and keys on the canvas.
 *
 * A tap (a press that never wanders more than a few px, measured as the *maximum* distance from
 * where it started) builds, deploys or selects. A drag pans the view and builds nothing (the
 * game-067 lesson). Two fingers pinch to zoom. The mouse wheel zooms; hovering shows where a
 * station would go.
 */

const TAP_PX = 9;

export class Input {
    constructor(canvas, act) {
        this.canvas = canvas;
        this.act = act;
        this.ptrs = new Map();
        this.pinch = null;
        canvas.addEventListener('pointerdown', (e) => this.down(e));
        window.addEventListener('pointermove', (e) => this.move(e));
        window.addEventListener('pointerup', (e) => this.up(e));
        window.addEventListener('pointercancel', (e) => this.up(e, true));
        canvas.addEventListener('wheel', (e) => { e.preventDefault(); act.zoom(e.deltaY > 0 ? 1.1 : 1 / 1.1); }, { passive: false });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        window.addEventListener('keydown', (e) => this.key(e));
    }

    down(e) {
        try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointers can't be captured */ }
        this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, max: 0, type: e.pointerType });
        if (this.ptrs.size === 2) {
            const [a, b] = [...this.ptrs.values()];
            this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
            for (const p of this.ptrs.values()) p.max = 99;   // a pinch is never a tap
        }
        this.act.pointerDown?.(e.clientX, e.clientY);
    }

    move(e) {
        const p = this.ptrs.get(e.pointerId);
        if (!p) {
            if (e.pointerType === 'mouse' && e.target === this.canvas) this.act.hover(e.clientX, e.clientY);
            return;
        }
        const px = p.x, py = p.y;
        p.x = e.clientX; p.y = e.clientY;
        p.max = Math.max(p.max, Math.hypot(p.x - p.sx, p.y - p.sy));
        if (this.ptrs.size >= 2 && this.pinch) {
            const [a, b] = [...this.ptrs.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d > 10 && this.pinch.d > 10) this.act.zoom(this.pinch.d / d);
            this.pinch.d = d;
            return;
        }
        if (p.max > TAP_PX) this.act.drag(px, py, p.x, p.y);
        else if (p.type === 'mouse') this.act.hover(p.x, p.y);
    }

    up(e, cancel = false) {
        const p = this.ptrs.get(e.pointerId);
        if (!p) return;
        this.ptrs.delete(e.pointerId);
        if (this.ptrs.size < 2) this.pinch = null;
        if (!cancel && p.max <= TAP_PX && this.ptrs.size === 0) this.act.tap(p.x, p.y, p.type);
    }

    key(e) {
        if (e.key !== 'Escape' && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
        const k = e.key;
        if (k >= '1' && k <= '9') { this.act.toolKey(Number(k) - 1); return; }
        switch (k.toLowerCase()) {
            case ' ': e.preventDefault(); this.act.gate(); break;
            case 'f': this.act.speed(); break;
            case 'p': this.act.pause(); break;
            case 'm': this.act.toggleSound(); break;
            case 'h': this.act.recentre(); break;
            case 'u': this.act.upgradeSelected?.(); break;
            case 'escape': this.act.escape(); break;
            case '+': case '=': this.act.zoom(1 / 1.15); break;
            case '-': case '_': this.act.zoom(1.15); break;
            default: break;
        }
    }
}
