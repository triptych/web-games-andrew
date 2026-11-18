// Keyboard and gamepad presses as an ordered queue (menus take one per frame, so at 2 fps "Down, Down, Enter"
// never collapses), plus the touch flag. Pointer play on the board is handled by the view's picking in main.js.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 2: 'KeyF', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.queue = [];
        this.pad = { prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a slider or a select keeps its own keys, but Escape must still close the sheet it sits in (game-117)
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // Space must still press a focused button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat && !['Space', 'Enter'].includes(e.code)) return;
            this.queue.push({ key: e.code, tag });
        });
        window.addEventListener('blur', () => this.flush());
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    poll() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        for (const i in PAD_KEYS) {
            const b = !!gp.buttons[+i]?.pressed;
            if (b && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b;
        }
    }

    next() { this.poll(); return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
