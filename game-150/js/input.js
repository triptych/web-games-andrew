// Keyboard and gamepad merged into one ordered queue of presses ({ key, pad }), one consumed per frame so a burst of
// keys at 2 fps never merges. Taps on the shop are handled in main, where the view can say what is under the finger.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
// d-pad and face buttons → the keyboard keys they stand for
const PAD_KEYS = { 0: 'Space', 1: 'KeyZ', 2: 'KeyH', 3: 'KeyG', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.queue = [];
        this.prev = [];
        this.lastDevice = 'keys';
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a slider keeps its own keys, but Escape must still close the sheet it sits in (game-117, game-118)
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused button (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            if (e.code === 'Backspace' && tag !== 'INPUT') e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat && !e.code.startsWith('Arrow')) return;
            this.queue.push({ key: e.code, onButton: tag === 'BUTTON' });
        });
        window.addEventListener('pointerdown', (e) => { this.lastDevice = e.pointerType === 'touch' ? 'touch' : 'mouse'; }, { capture: true });
        window.addEventListener('blur', () => this.flush());
    }

    poll() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        const b = (i) => !!gp.buttons[i]?.pressed;
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.prev[i] = b(+i);
        }
        // the stick as a d-pad, with a dead zone and one press per push
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const dir = Math.abs(ax) > 0.6 ? (ax > 0 ? 'ArrowRight' : 'ArrowLeft') : Math.abs(ay) > 0.6 ? (ay > 0 ? 'ArrowDown' : 'ArrowUp') : '';
        if (dir && dir !== this.prevDir) this.queue.push({ key: dir, pad: true });
        this.prevDir = dir;
    }

    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
