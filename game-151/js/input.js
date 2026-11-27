// Keyboard and gamepad presses in one ordered queue. Menus and the board take one press per frame, so at 2 fps
// "Down, Down, Enter" never collapses into one frame's worth of keys (game-074). Touch and mouse go straight to
// the board and the buttons; this only notes which device was used last.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
// gamepad: A picks/confirms, B backs out, X or Y fires, Start pauses, the d-pad moves
const PAD_KEYS = { 0: 'Space', 1: 'Escape', 2: 'KeyF', 3: 'KeyF', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.queue = [];
        this.prev = [];
        this.lastDevice = 'keys';
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a slider or a select keeps its own keys, but Escape must still close the sheet it sits in (game-117)
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // Space and the arrows must not scroll, but Space must still press a focused button (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code, onButton: tag === 'BUTTON' });
        });
        window.addEventListener('blur', () => this.flush());
        window.addEventListener('pointerdown', (e) => { this.lastDevice = e.pointerType || 'mouse'; }, { capture: true });
    }

    poll() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const stick = { 12: ay < -0.6, 13: ay > 0.6, 14: ax < -0.6, 15: ax > 0.6 };
        for (const i in PAD_KEYS) {
            const down = !!gp.buttons[i]?.pressed || !!stick[i];
            if (down && !this.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.prev[i] = down;
        }
    }

    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
