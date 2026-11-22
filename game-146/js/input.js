// Keyboard, mouse, touch and gamepad merged into one simulation input, plus an ordered queue of menu presses.
//
// - Aiming: a pointer over the board aims at it (mouse hover, or a finger held down); keys and sticks turn the aim.
// - Shooting: a click, a finger lifted over the board, Space or the A button. The fire press stays latched until a
//   simulation step has actually fired it (it could arrive during the cool-down after the last shot, or in a frame
//   too short to run a step), and expires after half a second so a stale press never fires a surprise shot.
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not merge.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };
const FIRE_KEYS = ['Space', 'ArrowUp', 'KeyW'];
const SWAP_KEYS = ['ArrowDown', 'KeyS'];
const USE_KEYS = { KeyQ: 0, KeyE: 1, KeyR: 2 };
const SLOT_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2 };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.fire = 0;                      // time the fire press was latched (0 = none)
        this.edges = { swap: -1, cycle: false, use: -1 };
        this.aimAt = null;                  // absolute aim from a pointer, set when it moves
        this.pointer = { down: false, id: null, over: false };
        this.pad = { x: 0, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.toAim = null;                  // (clientX, clientY) -> { angle, onBoard } (set by main from the view)
        this.enabled = false;               // only aim/shoot while a level is running

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused button (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (this.enabled && tag !== 'BUTTON') {
                if (FIRE_KEYS.includes(e.code)) this.pressFire();
                if (SWAP_KEYS.includes(e.code)) this.edges.cycle = true;
                if (e.code in USE_KEYS) this.edges.use = USE_KEYS[e.code];
                if (e.code in SLOT_KEYS) this.edges.swap = SLOT_KEYS[e.code];
            }
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

    /** Pointer aiming and shooting on the canvas. */
    bindBoard(canvas) {
        const aim = (e) => {
            if (!this.toAim) return null;
            const a = this.toAim(e.clientX, e.clientY);
            if (a) this.aimAt = a.angle;
            return a;
        };
        canvas.addEventListener('pointerdown', (e) => {
            if (!this.enabled || this.pointer.down) return;
            e.preventDefault();
            if (e.pointerType !== 'mouse') this.lastDevice = 'touch';
            this.pointer.down = true;
            this.pointer.id = e.pointerId;
            aim(e);
            try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!this.enabled) return;
            if (this.pointer.down && e.pointerId !== this.pointer.id) return;
            if (!this.pointer.down && e.pointerType !== 'mouse') return;
            aim(e);
        });
        const up = (e, cancel) => {
            if (!this.pointer.down || e.pointerId !== this.pointer.id) return;
            this.pointer.down = false;
            const a = aim(e);
            // let go over the board to shoot; drag back down below the launcher to cancel
            if (!cancel && this.enabled && a && a.onBoard) this.pressFire();
        };
        canvas.addEventListener('pointerup', (e) => up(e, false));
        canvas.addEventListener('pointercancel', (e) => up(e, true));
    }

    pressFire() { this.fire = performance.now(); }
    pressSwap(i) { this.edges.swap = i; }
    pressUse(i) { this.edges.use = i; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = 0; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const ax = gp.axes[0] || 0;
        this.pad.x = b(14) ? -1 : b(15) ? 1 : Math.abs(ax) > 0.2 ? ax : 0;
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
        }
        const edge = (i) => b(i) && !this.pad.prev[i];
        if (this.enabled) {
            if (edge(0)) this.pressFire();
            if (edge(2)) this.edges.cycle = true;
            if (edge(3)) this.edges.use = 0;
            if (edge(4)) this.edges.use = 1;
            if (edge(5)) this.edges.use = 2;
        }
        for (let i = 0; i < 16; i++) this.pad.prev[i] = b(i);
    }

    /** The input for the next simulation step. */
    state() {
        this._pollPad();
        const k = this.keys;
        let turn = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        if (this.pad.x) turn = this.pad.x;
        if (k.has('ShiftLeft') || k.has('ShiftRight')) turn *= 0.3;
        if (this.fire && performance.now() - this.fire > 500) this.fire = 0;
        const s = { aim: this.aimAt, turn, fire: this.fire > 0, swap: this.edges.swap, cycle: this.edges.cycle, use: this.edges.use };
        return s;
    }

    /** After a step: the edges it saw are spent; the fire press only once a step actually fired. */
    consume(fired) {
        this.aimAt = null;
        this.edges.swap = -1; this.edges.cycle = false; this.edges.use = -1;
        if (fired) this.fire = 0;
    }

    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.fire = 0; this.edges.swap = -1; this.edges.cycle = false; this.edges.use = -1; this.pointer.down = false; }
    clear() { this.keys.clear(); this.flush(); }
}
