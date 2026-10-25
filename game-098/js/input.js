// Keyboard and gamepad as an ordered queue of presses. The map is played by tapping or clicking
// (handled by the battle controller); this is for the cursor, menus and shortcuts.
//
// Presses go into a FIFO and one is consumed per frame: at 2 fps "Down, Down, Enter" must not
// collapse into one frame's worth of keys.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 2: 'Tab', 3: 'KeyE', 4: 'KeyQ', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
const ALIAS = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight', KeyZ: 'Enter', NumpadEnter: 'Enter', KeyX: 'Escape', Backspace: 'Escape' };

export class Input {
    constructor() {
        this.queue = [];                    // { key, pad?, raw } in the order they were pressed
        this.prev = [];
        this.lastDevice = 'keys';
        this.onTouch = null;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat && !e.code.startsWith('Arrow')) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            this.queue.push({ key: ALIAS[e.code] || e.code, raw: e.code, onButton: tag === 'BUTTON' });
        });
        window.addEventListener('blur', () => this.flush());
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        for (const i in PAD_KEYS) {
            const down = !!gp.buttons[i]?.pressed;
            if (down && !this.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.prev[i] = down;
        }
    }

    next() { this._pollPad(); return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
