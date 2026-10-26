// Keyboard, gamepad and the touch pad merged into an ordered queue of key presses.
//
// - Every press is queued (a FIFO, one consumed per frame): at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.
// - Held movement keys auto-repeat after a short delay, so you can walk down a corridor.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 2: 'KeyF', 3: 'KeyM', 8: 'KeyI', 9: 'KeyI', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
export const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'];

export class Input {
    constructor() {
        this.queue = [];
        this.held = new Map();          // key → ms of the first press
        this.nextRepeat = 0;
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.pad = { prev: [], x: 0, y: 0, nextAxis: 0 };

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (e.code === 'Escape') e.target.blur(); return; }
            // arrows and Space must not scroll the page, but Space must still press a focused button
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.push(e.code, !(e.code === 'Space' && tag === 'BUTTON'));
            if (MOVE_KEYS.includes(e.code)) this.held.set(e.code, performance.now());
        });
        window.addEventListener('keyup', (e) => this.held.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }
    push(key, real = true) { if (real) this.queue.push({ key }); }
    /** A touch-deck button: acts on finger-down, repeats while held. */
    bindButton(btn, key, repeat = false) {
        const up = () => this.held.delete('btn:' + key);
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.push(key); if (repeat) this.held.set('btn:' + key, performance.now()); });
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, up);
    }
    next() { return this.queue.shift() || null; }
    peek() { return this.queue[0] || null; }
    flush() { this.queue.length = 0; }
    clear() { this.held.clear(); this.flush(); }

    /** Auto-repeat for held movement keys; returns key codes to act on this frame. */
    repeats(now) {
        const out = [];
        if (now < this.nextRepeat) return out;
        for (const [k, t] of this.held) {
            if (now - t > 320) { out.push(k.replace('btn:', '')); this.nextRepeat = now + 150; break; }
        }
        return out;
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
        const now = performance.now();
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        if ((Math.abs(ax) > 0.55 || Math.abs(ay) > 0.55) && now > this.pad.nextAxis) {
            this.pad.nextAxis = now + 190;
            this.queue.push({ key: Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'ArrowRight' : 'ArrowLeft') : (ay > 0 ? 'ArrowDown' : 'ArrowUp'), pad: true });
        }
    }
}
