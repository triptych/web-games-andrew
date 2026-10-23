// Keyboard presses as an ordered queue. A text adventure has no held keys, only presses, and they
// must never merge: at 2 fps "2, 1, Enter" must arrive as three presses, one consumed per frame.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'Space'];
const MODS = ['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'CapsLock'];

export class Input {
    constructor() {
        this.queue = [];                    // { key: e.code, ch: e.key } in the order they were pressed
        // Moving focus must happen at once, not on the next frame: Space on a focused button acts natively
        // on key-up, so a Down and a Space pressed within a frame would otherwise go down on one button
        // and up on another, and click neither. Return true to say the arrow was handled.
        this.onArrow = null;                // (dir: -1 | 1) => boolean
        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            // typing in a form control is not for us, except Escape: it must still close a screen
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            if (e.ctrlKey || e.metaKey || e.altKey || MODS.includes(e.code)) return;
            const onButton = tag === 'BUTTON';
            // Space and the arrows must not scroll the page, but Space and Enter must still press a
            // focused button: preventDefault() on Space cancels the click (game-078).
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && onButton)) e.preventDefault();
            if (e.repeat) return;
            if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && this.onArrow?.(e.code === 'ArrowDown' ? 1 : -1)) return;
            // the browser's own click handles Enter and Space on a focused button
            if (onButton && (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter')) return;
            this.queue.push({ key: e.code, ch: e.key });
        });
        window.addEventListener('blur', () => this.flush());
    }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; }
}
