// Keyboard, gamepad and pointer, merged. Key presses go into an ordered queue (one is consumed per
// frame, so "Down, Down, Enter" at 2 fps never collapses); the canvas gets drag-to-turn,
// pinch / wheel to zoom and tap to inspect a tile.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 3: 'KeyM', 2: 'Tab' };

export class Input {
    constructor(canvas) {
        this.queue = [];
        this.pad = { prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.onDrag = null;      // (dx, dy)
        this.onZoom = null;      // (factor)
        this.onTap = null;       // (clientX, clientY)
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (e.code === 'Escape') e.target.blur(); return; }
            // Space and the arrows must not scroll the page, but Space must still press a focused button
            if (NO_SCROLL.includes(e.code) && !((e.code === 'Space' || e.code === 'Enter') && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat && !e.code.startsWith('Arrow')) return;
            this.queue.push({ key: e.code, onButton: tag === 'BUTTON' && e.target.getClientRects().length > 0 });
        });
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
        // the canvas: one finger drags, two pinch, a short press is a tap
        const pts = new Map();
        let moved = 0, pinch = 0, downT = 0;
        canvas.addEventListener('pointerdown', (e) => {
            pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pts.size === 1) { moved = 0; downT = performance.now(); }
            if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
            try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        });
        canvas.addEventListener('pointermove', (e) => {
            const p = pts.get(e.pointerId);
            if (!p) return;
            const dx = e.clientX - p.x, dy = e.clientY - p.y;
            p.x = e.clientX; p.y = e.clientY;
            if (pts.size === 1) { moved += Math.abs(dx) + Math.abs(dy); if (moved > 10) this.onDrag?.(dx, dy); }
            else if (pts.size === 2) {
                const [a, b] = [...pts.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                if (pinch > 0) this.onZoom?.(pinch / Math.max(1, d));
                pinch = d; moved = 99;
            }
        });
        const up = (e) => {
            if (!pts.has(e.pointerId)) return;
            const single = pts.size === 1;
            pts.delete(e.pointerId);
            if (single && moved < 10 && performance.now() - downT < 500) this.onTap?.(e.clientX, e.clientY);
        };
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
        canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.onZoom?.(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    }

    pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        for (const i in PAD_KEYS) {
            const on = !!gp.buttons[+i]?.pressed;
            if (on && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = on;
        }
    }

    next() { this.pollPad(); return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
