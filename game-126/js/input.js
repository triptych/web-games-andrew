// Keyboard and gamepad presses, queued in order and consumed one per frame, so "Down, Down, Enter" at a low frame
// rate still means three presses. Touch and mouse go straight to the DOM buttons and the battle canvas.

const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 2: 'KeyA' };

export class Input {
    constructor() {
        this.queue = [];
        this.pad = [];
        this.lastDevice = 'keys';
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // a slider or a select keeps its own keys, but Escape must still close the sheet it sits in
            if ((tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') && e.code !== 'Escape') return;
            // arrows must not scroll the page; Space must still press a focused button (preventDefault would cancel it)
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
            if (e.code === 'Space' && tag !== 'BUTTON') e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat && !e.code.startsWith('Arrow')) return;
            this.queue.push({ key: e.code, target: tag });
        });
        window.addEventListener('blur', () => this.flush());
    }
    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        for (const i in PAD_KEYS) {
            const b = !!gp.buttons[i]?.pressed;
            if (b && !this.pad[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad[i] = b;
        }
    }
    next() { this._pollPad(); return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
