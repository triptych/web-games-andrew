// Keyboard, gamepad and pointer, merged into two things the game reads each frame:
//
//  - a FIFO of key presses (`next()`), one consumed per frame, so at 2 fps "Down, Down, Enter"
//    never collapses into one frame's worth of keys;
//  - a FIFO of pointer events in client px (`nextPointer()`), which main.js maps through the
//    canvas rect and the CRT bend to the board or to a menu item.
//
// Menus and the board both use the key queue: arrows move, Space/Enter act, Escape/P pause.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
const ALIASES = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight', Space: 'Enter', NumpadEnter: 'Enter' };

export class Input {
    constructor(target) {
        this.target = target;
        this.queue = [];                   // { key, raw, pad?, ch? }
        this.pointers = [];                // { type: 'down' | 'move' | 'up' | 'cancel', x, y, id, touch }
        this.down = new Set();
        this.padPrev = [];
        this.lastDevice = 'keys';
        this.gesture = false;              // has the player pressed anything yet (audio unlock)
        this.onGesture = null;

        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (NO_SCROLL.includes(e.code)) e.preventDefault();
            this.lastDevice = 'keys';
            this._gesture();
            if (e.repeat) return;
            const key = ALIASES[e.code] || e.code;
            this.down.add(key);
            this.queue.push({ key, raw: e.code, ch: e.key && e.key.length === 1 ? e.key : '' });
        });
        window.addEventListener('keyup', (e) => this.down.delete(ALIASES[e.code] || e.code));
        window.addEventListener('blur', () => this.clear());

        const ptr = (type) => (e) => {
            if (e.pointerType === 'mouse' && type !== 'move' && e.button !== 0) return;
            const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
            if (type === 'down') { this.lastDevice = touch ? 'touch' : 'mouse'; this._gesture(); }
            if (type === 'move' && !this.dragging && touch) return;
            this.pointers.push({ type, x: e.clientX, y: e.clientY, id: e.pointerId, touch });
        };
        this.dragging = false;
        target.addEventListener('pointerdown', (e) => {
            this.dragging = true;
            try { target.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
            ptr('down')(e);
        });
        target.addEventListener('pointermove', ptr('move'));
        for (const t of ['pointerup', 'pointercancel']) {
            target.addEventListener(t, (e) => { this.dragging = false; ptr(t === 'pointerup' ? 'up' : 'cancel')(e); });
        }
        target.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _gesture() {
        if (this.gesture) return;
        this.gesture = true;
        this.onGesture?.();
    }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) return;
        const b = (i) => !!gp.buttons[i]?.pressed;
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const virt = { 14: ax < -0.5, 15: ax > 0.5, 12: ay < -0.5, 13: ay > 0.5 };
        for (const i in PAD_KEYS) {
            const on = b(+i) || virt[i] || false;
            if (on && !this.padPrev[i]) {
                this.queue.push({ key: PAD_KEYS[i], raw: PAD_KEYS[i], pad: true });
                this.lastDevice = 'pad';
                this._gesture();
            }
            this.padPrev[i] = on;
        }
    }

    /** The next queued key press, or null. One per frame. */
    next() { this._pollPad(); return this.queue.shift() || null; }
    nextPointer() { return this.pointers.shift() || null; }
    held(key) { return this.down.has(key); }
    flush() { this.queue.length = 0; this.pointers.length = 0; }
    clear() { this.down.clear(); this.flush(); this.dragging = false; }
}
