// Keyboard and gamepad as an ordered queue of presses. Menus and the battle take one press per frame,
// so at 2 fps "Down, Down, Enter" still arrives as three presses. Pointer and touch go straight to
// the board and the DOM (main.js, play.js).

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
// standard gamepad: A, B, X, Y, LB, RB, …, Start, …, d-pad up/down/left/right
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 2: 'KeyQ', 3: 'KeyE', 4: 'BracketLeft', 5: 'BracketRight', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.queue = [];
        this.pad = { prev: [] };
        this.lastDevice = 'mouse';
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused button
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            if (e.code === 'Tab' && !document.querySelector('.screen:not([hidden])')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat && !NO_SCROLL.includes(e.code)) return;
            this.queue.push({ key: e.code, shift: e.shiftKey, target: tag });
        });
        window.addEventListener('blur', () => this.flush());
        window.addEventListener('pointerdown', (e) => { this.lastDevice = e.pointerType === 'touch' ? 'touch' : 'mouse'; }, { capture: true });
    }

    poll() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        const b = (i) => !!gp.buttons[i]?.pressed;
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
    }

    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
