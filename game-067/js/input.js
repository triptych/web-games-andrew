/**
 * input.js — pointer gestures on the 3D canvas.
 *
 *   mouse     left drag = the tool (or pan in Play), right/middle drag = turn the camera, wheel = zoom
 *   touch     one finger = the tool (or pan in Play), two fingers = pan + pinch zoom + twist
 *
 * A touch doesn't start the tool until it has moved a little or been held briefly, so a second finger
 * landing a moment later turns it into a camera gesture instead of a stray stroke. If a stroke had
 * already started, it's cancelled (the world rewinds it).
 *
 * In 'pan' mode (Play, Build, Trains) a drag always moves the camera and only a press that never
 * wandered more than a few pixels counts as a tap.
 *
 * Handler h: { mode(): 'tool' | 'pan', down(p), move(p), up(p, tap), cancel(), hover(p),
 *              pan(dxPx, dyPx), orbit(dxPx, dyPx), zoom(factor), twist(rad), gesture() }
 */

export function initInput(el, h) {
    const pts = new Map();
    let mode = 'none';        // 'pending' | 'tool' | 'pan' | 'orbit' | 'multi' | 'none'
    let start = null, pendT = 0, maxMove = 0;
    let multi = null;

    const P = (e) => ({ x: e.clientX, y: e.clientY, button: e.button, touch: e.pointerType === 'touch', shift: e.shiftKey });

    function begin(p) {
        const m = h.mode();
        if (m === 'tool') { mode = 'tool'; h.down(start); if (p !== start) h.move(p); }
        else { mode = 'pan'; h.gesture(); }
    }

    function twoInfo() {
        const [a, b] = [...pts.values()];
        return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
    }

    el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        const p = P(e);
        pts.set(e.pointerId, { x: p.x, y: p.y });
        if (pts.size === 1) {
            start = p;
            pendT = performance.now();
            maxMove = 0;
            if (!p.touch && (e.button === 1 || e.button === 2)) { mode = 'orbit'; h.gesture(); }
            else if (!p.touch) begin(p);
            else mode = 'pending';
        } else if (pts.size === 2) {
            if (mode === 'tool') h.cancel();
            mode = 'multi';
            multi = twoInfo();
            h.gesture();
        }
    });

    el.addEventListener('pointermove', (e) => {
        const p = P(e);
        const prev = pts.get(e.pointerId);
        if (!prev) { if (e.pointerType === 'mouse') h.hover(p); return; }
        const dx = p.x - prev.x, dy = p.y - prev.y;
        prev.x = p.x; prev.y = p.y;
        if (start && pts.size === 1) maxMove = Math.max(maxMove, Math.hypot(p.x - start.x, p.y - start.y));
        if (mode === 'pending') {
            const far = Math.hypot(p.x - start.x, p.y - start.y) > 9;
            if (far || performance.now() - pendT > 160) begin(p);
            return;
        }
        if (mode === 'tool') h.move(p);
        else if (mode === 'pan') h.pan(dx, dy);
        else if (mode === 'orbit') h.orbit(dx, dy);
        else if (mode === 'multi' && pts.size >= 2) {
            const now = twoInfo();
            h.pan(now.mx - multi.mx, now.my - multi.my);
            if (multi.d > 10 && now.d > 10) h.zoom(multi.d / now.d);
            let da = now.ang - multi.ang;
            if (da > Math.PI) da -= Math.PI * 2;
            if (da < -Math.PI) da += Math.PI * 2;
            h.twist(da);
            multi = now;
        }
    });

    const end = (e) => {
        if (!pts.has(e.pointerId)) return;
        const p = P(e);
        pts.delete(e.pointerId);
        if (mode === 'pending') {
            // a quick tap: in Play it's a tap, with a tool it's a one-tile stroke
            if (h.mode() === 'tool') { h.down(start); h.up(p, true); }
            else h.up(p, true);
            mode = 'none';
        } else if (mode === 'tool') {
            const tap = Math.hypot(p.x - start.x, p.y - start.y) < 6;
            h.up(p, tap);
            mode = 'none';
        } else if (mode === 'pan') {
            // A tap is a press that never wandered (a drag that comes back is still a drag).
            const tap = maxMove < 10 && performance.now() - pendT < 900;
            if (tap) h.up(p, true);
            mode = 'none';
        } else if (mode === 'multi') {
            // the remaining finger is ignored until it lifts
            mode = pts.size ? 'none' : 'none';
        } else if (mode === 'orbit') mode = 'none';
        if (!pts.size) mode = 'none';
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', (e) => { if (mode === 'tool') h.cancel(); pts.delete(e.pointerId); if (!pts.size) mode = 'none'; });
    el.addEventListener('lostpointercapture', (e) => { if (pts.has(e.pointerId)) end(e); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => {
        e.preventDefault();
        const f = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0018);
        h.zoom(f);
    }, { passive: false });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pts.size) h.hover(null); });
}
