// Keyboard and gamepad as one ordered queue of key presses. Mouse and touch go through board-input.js.
//
// Presses are never lost or merged: they go into a FIFO and the game takes one per frame, so at 2 fps
// "Down, Down, Enter" still arrives as three separate presses.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 8: 'KeyP', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 2: 'KeyC' };

export class Input {
    constructor() {
        this.queue = [];                    // { key, pad? } in the order they were pressed
        this.prev = [];
        this.lastDevice = 'mouse';
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a slider or a select keeps its own keys, but Escape must still close the sheet it sits in
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
            this.lastDevice = 'keys';
            this.queue.push({ key: e.code, onButton: tag === 'BUTTON' });
        });
        window.addEventListener('blur', () => this.flush());
    }

    pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        for (const i in PAD_KEYS) {
            const down = !!gp.buttons[i]?.pressed;
            if (down && !this.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.prev[i] = down;
        }
    }

    /** The next queued press, or null. The game takes one per frame. */
    next() { this.pollPad(); return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; }
}
