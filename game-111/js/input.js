// Keyboard and gamepad presses as an ordered queue. Pointers (drag, tap) are handled by the play
// controller, which needs the view to pick cells. Presses are never merged: at 2 fps "Down, Down,
// Enter" must still be three presses, one consumed per frame.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
// gamepad button → the key it stands for
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 2: 'Tab', 3: 'KeyR', 4: 'KeyT', 5: 'KeyB', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.queue = [];                    // { key, pad? } in the order they were pressed
        this.pad = { prev: [], axisT: 0, ax: 0, ay: 0 };
        this.lastDevice = 'keys';
        this.onTouch = null;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            const onButton = tag === 'BUTTON' || tag === 'A';
            if (NO_SCROLL.includes(e.code) && !(onButton && (e.code === 'Space' || e.code === 'Tab'))) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat && !e.code.startsWith('Arrow') && !/^Key[WASD]$/.test(e.code)) return;
            this.queue.push({ key: e.code, onButton });
        });
        window.addEventListener('blur', () => this.flush());
        window.addEventListener('pointerdown', (e) => {
            this.lastDevice = e.pointerType === 'touch' ? 'touch' : 'mouse';
            if (e.pointerType === 'touch') this.onTouch?.();
        }, { capture: true });
    }

    pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        const b = (i) => !!gp.buttons[i]?.pressed;
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        // the left stick nudges the cursor, repeating while held
        const ax = Math.abs(gp.axes[0] || 0) > 0.5 ? Math.sign(gp.axes[0]) : 0;
        const ay = Math.abs(gp.axes[1] || 0) > 0.5 ? Math.sign(gp.axes[1]) : 0;
        const now = performance.now();
        if ((ax || ay) && (ax !== this.pad.ax || ay !== this.pad.ay || now > this.pad.axisT)) {
            if (ax) this.queue.push({ key: ax > 0 ? 'ArrowRight' : 'ArrowLeft', pad: true });
            if (ay) this.queue.push({ key: ay > 0 ? 'ArrowDown' : 'ArrowUp', pad: true });
            this.pad.axisT = now + (ax !== this.pad.ax || ay !== this.pad.ay ? 320 : 120);
            this.lastDevice = 'pad';
        }
        this.pad.ax = ax; this.pad.ay = ay;
    }

    /** The next queued press, or null. One per frame: presses never merge. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; }
}
