// Keyboard and gamepad as an ordered queue of presses. There is nothing to hold in this game, so there are no
// axes: every press is a command, and presses are never merged.
//
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not collapse.
// - Enter and Space on a focused button are the browser's own click, so they are NOT queued (or one press
//   would act twice: once as the click and once as "continue").
// - A slider or select keeps its own keys, but Escape must still close the sheet it sits in.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 3: 'KeyC' };

export class Input {
    /** onArrow(dir) moves focus synchronously: Down then Space in one frame must land on the same button. */
    constructor({ onArrow } = {}) {
        this.queue = [];
        this.pad = { prev: [] };
        this.lastDevice = 'keys';
        this.onArrow = onArrow || null;
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            const onButton = tag === 'BUTTON' || tag === 'A';
            // Space and the arrows must not scroll the page, but Space must still press a focused button:
            // preventDefault() on it cancels the click.
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && onButton)) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            if (onButton && (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter')) return;
            if ((e.code === 'ArrowDown' || e.code === 'ArrowUp') && this.onArrow && this.onArrow(e.code === 'ArrowDown' ? 1 : -1)) return;
            this.queue.push({ key: e.code });
        });
        window.addEventListener('blur', () => this.flush());
        window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this.lastDevice = 'touch'; }, { capture: true });
    }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        for (const i in PAD_KEYS) {
            const down = !!gp.buttons[i]?.pressed;
            if (down && !this.pad.prev[i]) {
                if ((i === '12' || i === '13') && this.onArrow && this.onArrow(i === '13' ? 1 : -1)) { this.lastDevice = 'pad'; }
                else { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            }
            this.pad.prev[i] = down;
        }
    }

    /** The next queued press, or null. One is consumed per frame. */
    next() { this._pollPad(); return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
