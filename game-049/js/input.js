/**
 * input.js — one keyboard listener and one pointer layer, translated into
 * commands for main.js. Taps, long-presses (inspect), right-clicks, hover,
 * mouse-wheel and two-finger pinch zoom.
 */

const KEYMOVE = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    k: [0, -1], j: null, h: [-1, 0], l: [1, 0], y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
    q: null, e: [1, -1], z: [-1, 1], c: [1, 1],
    Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0], Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
    Home: [-1, -1], PageUp: [1, -1], End: [-1, 1], PageDown: [1, 1],
};

export function initInput(H) {
    window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        let cmd = null;
        if (e.code && e.code.startsWith('Numpad') && KEYMOVE[e.code]) cmd = { c: 'move', d: KEYMOVE[e.code] };
        else if (key === 'Escape' || key === 'p') cmd = { c: 'cancel' };
        else if (key === ' ' || key === '.' || e.code === 'Numpad5') cmd = { c: 'wait' };
        else if (key === 'x') cmd = { c: 'explore' };
        else if (key === '>' || key === 'Enter') cmd = { c: key === 'Enter' ? 'confirm' : 'stairs' };
        else if (key === 'i') cmd = { c: 'bag' };
        else if (key === 'j' && !e.shiftKey) cmd = { c: 'journal' };
        else if (key === 'm') cmd = { c: 'map' };
        else if (key === 'q') cmd = { c: 'heal' };
        else if (key === 'f') cmd = { c: 'fire' };
        else if (key === 'g' || key === ',') cmd = { c: 'pickup' };
        else if (key === 'Tab') cmd = { c: 'cycle', back: e.shiftKey };
        else if (key === 'o') cmd = { c: 'oil' };
        else if (key >= '1' && key <= '4') cmd = { c: 'skill', i: +key - 1 };
        else if (key === '?' || key === 'F1') cmd = { c: 'help' };
        else if (key === '+' || key === '=') cmd = { c: 'zoom', f: 1.12 };
        else if (key === '-') cmd = { c: 'zoom', f: 1 / 1.12 };
        else if (KEYMOVE[key]) cmd = { c: 'move', d: KEYMOVE[key] };
        if (!cmd) return;
        if (H.onKey(cmd, e)) e.preventDefault();
    });

    const layer = document.getElementById('touch-layer');
    const pts = new Map();
    let press = null, pinch = null;
    layer.addEventListener('contextmenu', (e) => e.preventDefault());
    layer.addEventListener('pointerdown', (e) => {
        H.onGesture && H.onGesture();
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (e.button === 2) { H.onInspect(e.clientX, e.clientY); return; }
        if (pts.size === 2) {
            const [a, b] = [...pts.values()];
            pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
            if (press) { clearTimeout(press.timer); press = null; }
            return;
        }
        press = { x: e.clientX, y: e.clientY, t: performance.now(), long: false, touch: e.pointerType === 'touch' };
        press.timer = setTimeout(() => { if (press) { press.long = true; H.onInspect(press.x, press.y, true); } }, 480);
        try { layer.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    layer.addEventListener('pointermove', (e) => {
        if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && pts.size === 2) {
            const [a, b] = [...pts.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d > 10) { H.onZoom(d / pinch.d); pinch.d = d; }
            return;
        }
        if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 14) { clearTimeout(press.timer); press = null; }
        if (e.pointerType === 'mouse') H.onHover(e.clientX, e.clientY);
    });
    const end = (e) => {
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
        if (!press) return;
        clearTimeout(press.timer);
        if (!press.long && e.type === 'pointerup' && e.button !== 2) H.onTap(press.x, press.y, press.touch);
        else if (press.long) H.onInspectEnd && H.onInspectEnd();
        press = null;
    };
    layer.addEventListener('pointerup', end);
    layer.addEventListener('pointercancel', end);
    layer.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') H.onHover(-1, -1); });
    layer.addEventListener('wheel', (e) => { e.preventDefault(); H.onZoom(e.deltaY > 0 ? 1 / 1.1 : 1.1); }, { passive: false });
}
