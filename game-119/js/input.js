// Keyboard and gamepad as an ordered queue of presses. Menus take one press per frame, so at 2 fps
// "Down, Down, Enter" never collapses into a single frame. Touch needs nothing here: everything is a button.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'PadA', 1: 'Escape', 3: 'KeyI', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.queue = [];
        this.pad = { prev: [] };
        this.lastDevice = 'keys';
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (e.code === 'Escape') { e.target.blur(); this.queue.push({ key: 'Escape' }); } return; }
            // arrows and Space must not scroll the page, but Space must still press a focused button
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            this.queue.push({ key: e.code });
        });
        window.addEventListener('blur', () => this.flush());
    }
    poll() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        for (const i in PAD_KEYS) {
            const down = !!gp.buttons[i]?.pressed;
            if (down && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = down;
        }
    }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
