// Keyboard, gamepad (menus) and pointer input merged into queues the game drains once per frame.
//
// - Key presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.
// - Pointer events (down, move, up) are kept in order, but only the latest move per frame matters.
//   Two fingers make a camera gesture (pinch to zoom, drag to pan) and never press anything.
// - The touch deck switches on from a capture-phase pointerdown, so a tap on any menu enables it
//   before play starts.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.queue = [];                    // { key } in the order they were pressed
        this.ptrQueue = [];                 // { t, x, y, id, button, touch }
        this.pointers = new Map();
        this.gesture = null;
        this.gestureOut = { zoom: 0, dx: 0, dy: 0 };
        this.pad = { prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.onWheel = null;
        this.hoverXY = null;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) { return; }
            this.queue.push({ key: e.code, shift: e.shiftKey });
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        canvas.addEventListener('pointerdown', (e) => this.down(e));
        window.addEventListener('pointermove', (e) => this.move(e));
        window.addEventListener('pointerup', (e) => this.up(e));
        window.addEventListener('pointercancel', (e) => this.up(e, true));
        canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.gestureOut.zoom += e.deltaY * (e.deltaMode === 1 ? 33 : 1); }, { passive: false });
        canvas.addEventListener('pointerleave', () => { this.hoverXY = null; });
    }

    down(e) {
        const touch = e.pointerType === 'touch';
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, touch });
        try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        e.preventDefault();
        if (this.pointers.size === 2) {
            // a second finger: end any press and start a camera gesture
            this.ptrQueue.push({ t: 'cancel' });
            const [a, b] = [...this.pointers.values()];
            this.gesture = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
            return;
        }
        if (this.pointers.size > 2) return;
        this.ptrQueue.push({ t: 'down', x: e.clientX, y: e.clientY, id: e.pointerId, button: e.button, touch, shift: e.shiftKey });
    }

    move(e) {
        const p = this.pointers.get(e.pointerId);
        if (p) {
            p.x = e.clientX; p.y = e.clientY;
            if (this.gesture && this.pointers.size === 2) {
                const [a, b] = [...this.pointers.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
                this.gestureOut.zoom += (this.gesture.d - d) * 2.2;
                this.gestureOut.dx += cx - this.gesture.cx; this.gestureOut.dy += cy - this.gesture.cy;
                this.gesture.d = d; this.gesture.cx = cx; this.gesture.cy = cy;
                return;
            }
        }
        if (this.gesture) return;
        if (e.pointerType === 'mouse' || p) {
            const last = this.ptrQueue[this.ptrQueue.length - 1];
            const rec = { t: 'move', x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType === 'touch', held: !!p };
            if (last && last.t === 'move' && last.id === rec.id) this.ptrQueue[this.ptrQueue.length - 1] = rec; else this.ptrQueue.push(rec);
            this.hoverXY = { x: e.clientX, y: e.clientY };
        }
    }

    up(e, cancel = false) {
        const had = this.pointers.delete(e.pointerId);
        if (!had) return;
        if (this.gesture) { if (this.pointers.size < 2) this.gesture = null; return; }
        this.ptrQueue.push({ t: cancel ? 'cancel' : 'up', x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType === 'touch' });
    }

    /** Take the camera gesture (wheel, pinch, two-finger drag) accumulated since last asked. */
    takeGesture() {
        const g = this.gestureOut;
        this.gestureOut = { zoom: 0, dx: 0, dy: 0 };
        return g;
    }

    drainPointer() {
        const q = this.ptrQueue;
        this.ptrQueue = [];
        return q;
    }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        const b = (i) => !!gp.buttons[i]?.pressed;
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
    }

    poll() { this._pollPad(); }

    /** The next queued press, or null. Menus take one per frame. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; this.ptrQueue.length = 0; }
    clear() {
        this.keys.clear();
        this.flush();
        this.pointers.clear();
        this.gesture = null;
    }
}
