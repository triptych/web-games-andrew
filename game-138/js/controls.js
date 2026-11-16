// The builder's pointer controls on the canvas: one finger or the left button drags to turn the dungeon, the right
// button or Shift drags to slide it, two fingers pinch to zoom and slide, the wheel zooms. A press that never wandered
// more than ~10 px is a tap (paint, place, tidy); a drag never also paints (game-067). Hover reports the cell under
// the mouse so the cursor can follow it.

const TAP_PX = 10;

export function bindBuilderControls(canvas, view, { onTap, onHover, active }) {
    const pts = new Map();
    let mode = null, moved = 0, pinch = null, tapCandidate = null;

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
        if (!active()) return;
        canvas.focus?.({ preventScroll: true });
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        if (pts.size === 1) {
            mode = e.button === 2 || e.shiftKey ? 'pan' : 'rotate';
            moved = 0;
            tapCandidate = { x: e.clientX, y: e.clientY, t: performance.now() };
        } else if (pts.size === 2) {
            const [a, b] = [...pts.values()];
            pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
            tapCandidate = null;
            mode = 'pinch';
        }
    });
    canvas.addEventListener('pointermove', (e) => {
        if (!active()) return;
        const p = pts.get(e.pointerId);
        if (!p) { if (e.pointerType === 'mouse') onHover(e.clientX, e.clientY); return; }
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (mode === 'pinch' && pts.size >= 2) {
            const [a, b] = [...pts.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            if (pinch.d > 0) view.zoom(pinch.d / Math.max(1, d));
            view.pan(mx - pinch.mx, my - pinch.my);
            pinch = { d, mx, my };
            return;
        }
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved < TAP_PX) return;
        tapCandidate = null;
        if (mode === 'pan') view.pan(dx, dy);
        else if (mode === 'rotate') view.rotate(dx, dy);
        if (e.pointerType === 'mouse') onHover(e.clientX, e.clientY);
    });
    const end = (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.delete(e.pointerId);
        if (tapCandidate && pts.size === 0 && moved < TAP_PX && active()) onTap(tapCandidate.x, tapCandidate.y, e.pointerType);
        if (pts.size === 0) { mode = null; tapCandidate = null; pinch = null; }
        else if (pts.size === 1) { mode = 'rotate'; moved = TAP_PX; }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); tapCandidate = null; if (!pts.size) mode = null; });
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pts.size) onHover(null); });
    canvas.addEventListener('wheel', (e) => {
        if (!active()) return;
        e.preventDefault();
        view.zoom(Math.exp(e.deltaY * 0.0012));
    }, { passive: false });
}
