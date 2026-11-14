// The keyboard and gamepad as an ordered queue of presses, one consumed per frame (at 2 fps
// "Down, Down, Enter" must not collapse into one frame's worth of keys). The pointer is handled
// in main.js, where it meets the view's picking.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 2: 'KeyR', 3: 'KeyC', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 4: 'KeyZ', 5: 'KeyF' };

export class Input {
    constructor() {
        this.queue = [];
        this.pad = { prev: [] };
        this.lastDevice = 'keys';
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a slider, a select or the caption box keeps its own keys, but Escape still closes the sheet (game-117)
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // arrows and Space must not scroll, but Space must still press a focused button (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat && !e.code.startsWith('Arrow')) return;
            this.queue.push({ key: e.code, ctrl: e.ctrlKey || e.metaKey, button: tag === 'BUTTON' });
        });
        window.addEventListener('blur', () => this.flush());
        window.addEventListener('pointerdown', (e) => { this.lastDevice = e.pointerType === 'touch' ? 'touch' : 'mouse'; }, { capture: true });
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
