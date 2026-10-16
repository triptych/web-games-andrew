// Keyboard, gamepad and touch merged into one state, { x, jump, fire, fireP }, plus an ordered
// queue of presses for the menus.
//
// - Directions and held buttons are read every step.
// - Jump and blow are also *latched* on the way down and stay set until a sim step consumes them:
//   a tap whose press and release land in one frame shorter than a step must still count (game-079).
// - Menu presses go into a timestamped FIFO, one consumed per frame (game-074, game-075); when play
//   resumes, only presses older than the moment the menu closed are dropped (game-081).

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const JUMP_KEYS = ['Space', 'KeyZ', 'ArrowUp', 'KeyW'];
const FIRE_KEYS = ['KeyX', 'KeyJ', 'KeyK'];
const PAD_KEYS = { 0: 'Enter', 1: 'PadB', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.tap = { jump: false, fire: false };
        this.touch = { x: 0, id: null, jump: false, fire: false };
        this.pad = { x: 0, jump: false, fire: false, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            const onButton = tag === 'BUTTON' && e.target.offsetParent !== null;
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && onButton)) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code, onButton, t: performance.now() });
            if (JUMP_KEYS.includes(e.code)) this.tap.jump = true;
            if (FIRE_KEYS.includes(e.code)) this.tap.fire = true;
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        // Capture phase, so a touch on any menu switches the touch deck on before play starts (game-074).
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    /** ◀ ▶ as one zone: the finger can slide from one to the other without lifting. */
    bindDpad(zone, left, right) {
        const read = (e) => {
            const r = zone.getBoundingClientRect();
            const dx = e.clientX - (r.left + r.width / 2);
            this.touch.x = dx < -6 ? -1 : dx > 6 ? 1 : 0;
            left.classList.toggle('on', this.touch.x < 0);
            right.classList.toggle('on', this.touch.x > 0);
        };
        zone.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.touch.id = e.pointerId;
            try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
            read(e);
        });
        zone.addEventListener('pointermove', (e) => { if (e.pointerId === this.touch.id) { e.preventDefault(); read(e); } });
        const end = (e) => {
            if (e.pointerId !== this.touch.id) return;
            this.touch.id = null; this.touch.x = 0;
            left.classList.remove('on'); right.classList.remove('on');
        };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, end);
    }

    /** A touch button that acts on finger-down and counts as held until the finger lifts. */
    bindButton(btn, what) {
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.touch[what] = true;
            this.tap[what] = true;
            btn.classList.add('held');
            try { btn.setPointerCapture(e.pointerId); } catch { /* */ }
        });
        const up = () => { this.touch[what] = false; btn.classList.remove('held'); };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, up);
    }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = 0; this.pad.jump = this.pad.fire = false; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const ax = gp.axes[0] || 0;
        this.pad.x = b(14) ? -1 : b(15) ? 1 : Math.abs(ax) > 0.35 ? Math.sign(ax) : 0;
        const jump = b(0), fire = b(1) || b(2);
        if (jump && !this.pad.jump) this.tap.jump = true;
        if (fire && !this.pad.fire) this.tap.fire = true;
        this.pad.jump = jump; this.pad.fire = fire;
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true, t: performance.now() }); this.lastDevice = 'pad'; }
        }
        for (let i = 0; i < 16; i++) this.pad.prev[i] = b(i);
        if (this.pad.x || jump || fire) this.lastDevice = 'pad';
    }

    /** Once per frame. */
    frame() { this._pollPad(); }

    /** The input for the next sim step. Taps stay set until consumeEdges(). */
    state() {
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        if (this.pad.x) x = this.pad.x;
        if (this.touch.x) x = this.touch.x;
        const heldJump = JUMP_KEYS.some((c) => k.has(c)) || this.pad.jump || this.touch.jump;
        const heldFire = FIRE_KEYS.some((c) => k.has(c)) || this.pad.fire || this.touch.fire;
        return { x, jump: this.tap.jump || heldJump, fire: this.tap.fire || heldFire, fireP: this.tap.fire };
    }

    consumeEdges() { this.tap.jump = false; this.tap.fire = false; }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.consumeEdges(); }
    /** Drop presses made before time t (the press that closed a menu), keep later ones. */
    dropBefore(t) { this.queue = this.queue.filter((p) => (p.t ?? 0) > t); this.consumeEdges(); }
    clear() {
        this.keys.clear();
        this.flush();
        this.touch.x = 0; this.touch.jump = this.touch.fire = false;
    }
}
