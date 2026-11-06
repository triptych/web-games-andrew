// Keyboard, gamepad, mouse and touch merged into one state, plus an ordered queue of presses.
//
// - Steering: arrows/WASD, a gamepad stick, or a finger (or held mouse button) on the window:
//   the drop is drawn toward the point under it. main.js turns that point into a direction,
//   since it knows where the drop is.
// - The tap is an *edge* that stays set until a simulation step consumes it: a frame shorter than
//   the fixed step runs no step, and a press made in it must not be lost.
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.

const ACTION_KEYS = ['Space', 'KeyZ', 'KeyJ', 'KeyT'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];                    // { key } in the order they were pressed
        this.edges = { a: false };
        this.point = null;                  // { id, x, y } in client px while a finger/button is down
        this.pad = { x: 0, y: 0, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;                // called once when a touch is first seen

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a slider or a select keeps its own keys, but Escape must still close the sheet it sits in
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused button
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (ACTION_KEYS.includes(e.code) && tag !== 'BUTTON') this.edges.a = true;
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        // Capture phase, so a touch on any menu switches the touch deck on before play starts.
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    /** Steering by finger or held mouse button on the game canvas. */
    bindPointer(el) {
        el.addEventListener('pointerdown', (e) => {
            if (e.button > 0) return;
            e.preventDefault();
            this.point = { id: e.pointerId, x: e.clientX, y: e.clientY };
            if (e.pointerType === 'mouse') this.lastDevice = 'mouse';
            try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        el.addEventListener('pointermove', (e) => {
            if (!this.point || e.pointerId !== this.point.id) return;
            this.point.x = e.clientX; this.point.y = e.clientY;
        });
        const end = (e) => { if (this.point && e.pointerId === this.point.id) this.point = null; };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, end);
        el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /** A touch button that acts on finger-down (a click waits for the lift and feels late). */
    bindButton(btn, onPress) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onPress(); });
    }

    pressA() { this.edges.a = true; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.2 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        if ((b(0) || b(2)) && !this.pad.prev.a) this.edges.a = true;
        this.pad.prev.a = b(0) || b(2);
    }

    /** Held steering from keys and pad for this frame; the pointer is handled by main.js. */
    state() {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        return { x, y, a: this.edges.a };
    }

    consumeEdges() { this.edges.a = false; }
    /** The next queued press, or null. Menus take one per frame. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; this.edges.a = false; }
    clear() {
        this.keys.clear();
        this.flush();
        this.point = null;
    }
}
