// Keyboard and gamepad merged into an ordered queue of presses, plus the Rally edge.
//
// - The Rally press is an edge that stays set until a simulation step consumes it: a frame shorter than the
//   fixed step runs no step, and a tap made in it must not be lost.
// - Menu presses go into a FIFO, one consumed per frame, so at 2 fps "Down, Down, Enter" stays three presses.
// Touch needs no translation here: every touch control is a real button.

const RALLY_KEYS = ['Space', 'KeyZ', 'KeyJ'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 2: 'Space', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.queue = [];
        this.edges = { a: false };
        this.pad = { prev: [] };
        this.lastDevice = 'keys';
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused button
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code, onButton: tag === 'BUTTON' });
        });
        window.addEventListener('blur', () => this.flush());
        window.addEventListener('pointerdown', (e) => { this.lastDevice = e.pointerType === 'touch' ? 'touch' : 'mouse'; }, { capture: true });
    }

    pressA() { this.edges.a = true; }

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

    state() { return { a: this.edges.a }; }
    consumeEdges() { this.edges.a = false; }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.edges.a = false; }
    isRallyKey(key) { return RALLY_KEYS.includes(key); }
}
