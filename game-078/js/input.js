// Keyboard, gamepad, mouse and touch merged into one state, { dx, aimClient, drop }, plus an
// ordered queue of presses for the menus.
//
// - Aiming: arrows / A D / the stick move the dropper; a mouse over the canvas or a finger on
//   it puts the dropper under it. Whichever was used last wins.
// - Dropping: Space / ↓ / S / Z, gamepad A, a mouse click, or lifting a finger that went down
//   on the canvas. A drop is an *edge* that stays set until a simulation step consumes it: a
//   frame shorter than the fixed step runs no step, and a tap made in it must not be lost.
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.

const DROP_KEYS = ['Space', 'ArrowDown', 'KeyS', 'KeyZ', 'KeyJ'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];                    // { key } in the order they were pressed
        this.edges = { drop: false };
        this.pointer = { id: null, x: 0 };  // a press that began on the canvas
        this.aimClient = null;              // client x the dropper should follow, or null
        this.pad = { x: 0, prev: [] };
        this.lastDevice = 'keys';

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space still presses a focused button
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (DROP_KEYS.includes(e.code)) this.edges.drop = true;
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        window.addEventListener('pointerdown', (e) => { this.lastDevice = e.pointerType === 'touch' ? 'touch' : 'mouse'; }, { capture: true });
    }

    /** Aim and drop on the canvas. A finger drags to aim and drops when it lifts; a mouse aims by hovering. */
    bindCanvas(canvas) {
        canvas.addEventListener('pointerdown', (e) => {
            if (e.button > 0 || this.pointer.id !== null) return;
            e.preventDefault();
            this.pointer.id = e.pointerId;
            this.aimClient = e.clientX;
            try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        canvas.addEventListener('pointermove', (e) => {
            if (this.pointer.id !== null && e.pointerId !== this.pointer.id) return;
            if (this.pointer.id === null && e.pointerType === 'touch') return;
            this.aimClient = e.clientX;
        });
        const end = (e, drop) => {
            if (e.pointerId !== this.pointer.id) return;
            this.pointer.id = null;
            if (drop) { this.aimClient = e.clientX; this.edges.drop = true; }
        };
        canvas.addEventListener('pointerup', (e) => end(e, true));
        canvas.addEventListener('pointercancel', (e) => end(e, false));
    }

    pressDrop() { this.edges.drop = true; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = 0; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.25 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        if (b(0) && !this.pad.prev.a) this.edges.drop = true;
        this.pad.prev.a = b(0);
    }

    /** The held state for this frame. The drop edge stays set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        let dx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        if (this.pad.x) dx = this.pad.x;
        // keys or the stick take over from the pointer until the pointer moves again
        if (dx && this.pointer.id === null) this.aimClient = null;
        return { dx, aimClient: this.aimClient, drop: this.edges.drop };
    }

    consumeEdges() { this.edges.drop = false; }
    /** The next queued press, or null. Menus take one per frame. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; this.edges.drop = false; }
    clear() {
        this.keys.clear();
        this.flush();
        this.pointer.id = null;
    }
}
