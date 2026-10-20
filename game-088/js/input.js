// Keyboard and gamepad as an ordered queue of presses. Touch and mouse go straight to the views
// (drag to swap on the board, drag to turn the museum) and to the DOM buttons.
//
// Presses go into a FIFO and main.js takes one per frame: at 2 fps "Down, Down, Enter" must not
// collapse into one frame's worth of keys. Starting a dig flushes the queue.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 2: 'KeyH', 3: 'KeyX', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.queue = [];
        this.padPrev = [];
        this.lastDevice = 'mouse';
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat && !e.code.startsWith('Arrow')) return;
            this.queue.push({ key: e.code, target: tag });
        });
        window.addEventListener('pointerdown', (e) => { this.lastDevice = e.pointerType === 'touch' ? 'touch' : 'mouse'; }, { capture: true });
        window.addEventListener('blur', () => this.flush());
    }

    pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        for (const i in PAD_KEYS) {
            const on = !!gp.buttons[i]?.pressed;
            if (on && !this.padPrev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.padPrev[i] = on;
        }
        // the left stick as a d-pad, with a little hysteresis
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const dir = Math.abs(ax) > 0.6 ? (ax > 0 ? 'ArrowRight' : 'ArrowLeft') : Math.abs(ay) > 0.6 ? (ay > 0 ? 'ArrowDown' : 'ArrowUp') : null;
        if (dir && dir !== this.stickPrev) this.queue.push({ key: dir, pad: true });
        this.stickPrev = dir;
    }

    /** The next queued press, or null. One per frame. */
    next() { this.pollPad(); return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
