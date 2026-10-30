// Keyboard and gamepad presses, in the order they happened. An idle game has no held directions: every key is a
// press, queued until main.js handles it, so a fast tap is never lost between frames and two never merge.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
const PAD_KEYS = { 0: 'Space', 1: 'Escape', 2: 'KeyC', 3: 'KeyV', 4: 'KeyQ', 5: 'KeyE', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown' };

export class Input {
    constructor() {
        this.queue = [];
        this.pad = { prev: [] };
        this.lastDevice = 'keys';
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused button: preventDefault()
            // on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;                    // holding a key is not an auto-clicker
            this.queue.push({ key: e.code, onButton: tag === 'BUTTON' });
        });
        window.addEventListener('blur', () => this.flush());
    }

    poll() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        for (const i in PAD_KEYS) {
            const on = !!gp.buttons[+i]?.pressed;
            if (on && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = on;
        }
    }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
