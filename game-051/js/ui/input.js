/**
 * input.js — pointer helpers: drag / tap / pinch / wheel on the 3D canvas.
 */

/** Attaches gesture handlers to an element; returns a detach function. */
export function gestures(el, h) {
    const pts = new Map();
    let start = null, moved = false, pinch0 = 0;
    const down = (e) => {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = false; }
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
        try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const move = (e) => {
        const p = pts.get(e.pointerId);
        if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (pts.size === 2 && h.onPinch) {
            const [a, b] = [...pts.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinch0) h.onPinch(pinch0 / d);
            pinch0 = d;
            moved = true;
            return;
        }
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) moved = true;
        if (moved && h.onDrag) h.onDrag(dx, dy);
    };
    const up = (e) => {
        const had = pts.has(e.pointerId);
        pts.delete(e.pointerId);
        if (had && !moved && start && pts.size === 0 && h.onTap && performance.now() - start.t < 600) h.onTap(e.clientX, e.clientY);
        if (pts.size === 0) start = null;
    };
    const wheel = (e) => { if (h.onPinch) { e.preventDefault(); h.onPinch(e.deltaY > 0 ? 1.08 : 0.92); } };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        el.removeEventListener('wheel', wheel);
    };
}

export function canvasEl() { return document.querySelector('#gl-host canvas'); }
