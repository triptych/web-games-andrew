// Keyboard, gamepad and pointer merged into the siege's input { ax, aim, fire } plus an ordered queue of
// presses for menus and shortcuts.
//
// - Held keys are read every frame. A fire press is latched until a sim step has seen it, so a tap shorter
//   than one step still throws a doily.
// - Pointer aiming is absolute: the view converts a finger or mouse on the field into a field x (setAim).
// - Menu presses go into a FIFO, one consumed per frame.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 3: 'KeyQ', 4: 'Digit1', 5: 'Digit2', 6: 'Digit3', 7: 'Digit4' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.fireLatch = false;
        this.pointer = { down: false, id: null, aim: null };
        this.pad = { ax: 0, fire: false, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyJ') this.fireLatch = true;
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    /** The view calls these while a finger or mouse button is down on the battlefield. */
    pointerDown(id, aim) { this.pointer.down = true; this.pointer.id = id; this.pointer.aim = aim; this.fireLatch = true; }
    pointerMove(id, aim) { if (this.pointer.id === id || this.pointer.id == null) this.pointer.aim = aim; }
    pointerUp(id) { if (this.pointer.id === id) { this.pointer.down = false; this.pointer.id = null; } }
    hoverAim(aim) { if (!this.pointer.down) this.pointer.aim = aim; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.ax = 0; this.pad.fire = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.25 ? v : 0);
        this.pad.ax = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.fire = b(0) || b(2);
        if (this.pad.ax) this.pointer.aim = null;
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        if (this.pad.fire && !this.pad.prev.f) this.fireLatch = true;
        this.pad.prev.f = this.pad.fire;
    }

    /** The siege input for this frame. The fire latch stays set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        let ax = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        if (this.pad.ax) ax = this.pad.ax;
        if (ax) this.pointer.aim = null;     // keys take over from the mouse until it moves again
        const held = k.has('Space') || k.has('KeyZ') || k.has('KeyJ') || this.pad.fire || this.pointer.down;
        return { ax, aim: ax ? null : this.pointer.aim, fire: held || this.fireLatch };
    }

    consumeEdges() { this.fireLatch = false; }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.fireLatch = false; }
    clear() {
        this.keys.clear();
        this.flush();
        this.pointer.down = false; this.pointer.id = null;
    }
}
