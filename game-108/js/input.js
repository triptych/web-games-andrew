// Keyboard and gamepad presses as an ordered queue, plus taps and swipes on the board.
//
// - Presses go into a FIFO and one is consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.
// - A board tap selects; a tap on a neighbour of the selection swaps; a swipe that starts on a token
//   swaps it with the neighbour it was dragged toward. A press that wandered less than ~10 px is a
//   tap; one that wandered further without crossing into a neighbour does nothing.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 2: 'KeyH', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 4: 'Digit1', 5: 'Digit2', 6: 'Digit3', 7: 'Digit4' };

export class Input {
    constructor() {
        this.queue = [];                    // { key, pad? } in the order they were pressed
        this.pad = { prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;                // called once when a touch is first seen
        this.onBoard = null;                // ({ kind: 'tap' | 'swipe', cell, dir }) from the board

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat && !e.code.startsWith('Arrow')) return;
            this.queue.push({ key: e.code, onButton: tag === 'BUTTON' });
        });
        window.addEventListener('blur', () => this.flush());
        // Capture phase, so a touch on any menu switches the touch layout on before play starts.
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    /** Taps and swipes on the canvas. pick(clientX, clientY) → { x, y } cell or null; cellPx() → a cell's width on screen. */
    bindBoard(canvas, pick, cellPx = () => 40) {
        let down = null;
        canvas.addEventListener('pointerdown', (e) => {
            if (e.button > 0) return;
            const cell = pick(e.clientX, e.clientY);
            down = { id: e.pointerId, x: e.clientX, y: e.clientY, cell, done: false };
            try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
            e.preventDefault();
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!down || e.pointerId !== down.id || down.done || !down.cell) return;
            const dx = e.clientX - down.x, dy = e.clientY - down.y;
            const need = Math.max(8, Math.min(30, cellPx() * 0.35));
            if (Math.hypot(dx, dy) < need) return;
            down.done = true;
            const dir = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
            this.onBoard?.({ kind: 'swipe', cell: down.cell, dir });
        });
        const end = (e) => {
            if (!down || e.pointerId !== down.id) return;
            const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
            if (!down.done && moved < Math.max(10, cellPx() * 0.3) && e.type === 'pointerup') this.onBoard?.({ kind: 'tap', cell: down.cell });
            down = null;
        };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /** A button that acts on finger-down (a click waits for the lift and feels late). */
    bindButton(btn, onPress) {
        btn.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); onPress(); });
        btn.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); onPress(); } });
    }

    pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        const b = (i) => !!gp.buttons[i]?.pressed;
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        // the left stick nudges the cursor once per push
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const dir = Math.abs(ax) > 0.6 ? (ax > 0 ? 'ArrowRight' : 'ArrowLeft') : Math.abs(ay) > 0.6 ? (ay > 0 ? 'ArrowDown' : 'ArrowUp') : null;
        if (dir && dir !== this.pad.stick) this.queue.push({ key: dir, pad: true });
        this.pad.stick = dir;
    }

    /** The next queued press, or null. Menus and the board take one per frame. */
    next() { this.pollPad(); return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; }
}
