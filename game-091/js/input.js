// Keyboard, gamepad and touch merged into one ordered queue of presses. STARSPIN is turn-based,
// so there is no held state: every press is an edge, kept until the frame loop consumes it.
//
// Presses go into a FIFO and one is consumed per frame: at 2 fps "Down, Down, Enter" must not
// collapse into one frame's worth of keys.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 2: 'KeyR', 3: 'KeyC', 4: 'KeyQ', 5: 'KeyT', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.queue = [];                    // { key, pad? } in the order they were pressed
        this.pad = { prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;                // called once when a touch is first seen

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            // a focused button gets its own click from Space and Enter; don't also queue them
            if (tag === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter')) return;
            this.queue.push({ key: e.code });
        });
        window.addEventListener('blur', () => this.flush());
        // Capture phase, so a touch on any menu switches the touch layout on before play starts.
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    /** A button that acts on finger-down (a click waits for the lift and feels late); keyboard
     *  clicks (detail 0) still work. */
    bindButton(btn, onPress) {
        btn.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); onPress(); });
        btn.addEventListener('click', (e) => { if (e.detail === 0) onPress(); });
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

    /** The next queued press, or null. Take one per frame: presses never merge. */
    next() { this.poll(); return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; }
}
