// Keyboard and gamepad as an ordered queue of presses. Mouse and touch go straight to main.js
// (taps on the scene, the pack and the buttons are plain DOM events).
//
// Presses go into a FIFO and main.js takes one per frame: at 2 fps "Right, Right, Enter" must not
// collapse into one frame's worth of keys. Starting a game flushes the queue.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 3: 'KeyH', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.queue = [];
        this.padPrev = [];
        this.lastDevice = 'mouse';
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code, onButton: tag === 'BUTTON' });
        });
        window.addEventListener('blur', () => this.flush());
        window.addEventListener('pointerdown', (e) => { this.lastDevice = e.pointerType === 'touch' ? 'touch' : 'mouse'; }, { capture: true });
    }

    pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        const down = (i) => !!gp.buttons[i]?.pressed;
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const virt = { 12: ay < -0.6, 13: ay > 0.6, 14: ax < -0.6, 15: ax > 0.6 };
        for (const i in PAD_KEYS) {
            const now = down(+i) || virt[i];
            if (now && !this.padPrev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.padPrev[i] = now;
        }
    }

    /** The next queued press, or null. The frame loop takes one per frame. */
    next() { this.pollPad(); return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; }
}
