// Keyboard, mouse, gamepad and touch merged into one raw state, plus an ordered queue of presses for menus.
// main.js turns this into the sim's input record (it needs the view to turn the mouse into a world point).
//
// - Held keys and buttons are read every frame.
// - Presses (skills, potion, portal, interact) are *edges* that stay set until a simulation step consumes them:
//   a frame shorter than the fixed step runs no step, and a tap made in it must not be lost. A press and release
//   inside one frame still counts once.
// - Menu presses go into a FIFO, one consumed per frame.

const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
// gamepad: A X Y B RB → slots, LT potion, Back portal, Start pause, d-pad menus
const PAD_SLOTS = [0, 2, 3, 1, 5];
const PAD_KEYS = { 9: 'Escape', 8: 'KeyT', 12: 'ArrowUp', 13: 'ArrowDown', 4: 'KeyI' };

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.queue = [];
        this.edges = { slots: [false, false, false, false, false], potion: false, portal: false, interact: false, tap: null };
        this.touchHeld = [false, false, false, false, false];
        this.mouse = { x: -1, y: -1, left: false, right: false, leftPress: false, rightPress: false, over: false };
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, prev: [], held: [false, false, false, false, false] };
        this.lastDevice = 'keys';
        this.onTouch = null;
        this.labels = false;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.code !== 'Escape') return;
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            if (e.code === 'AltLeft' || e.code === 'AltRight') { e.preventDefault(); this.labels = true; }
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            const si = SLOT_KEYS.indexOf(e.code);
            if (si >= 0) this.edges.slots[si] = true;
            if (e.code === 'KeyQ') this.edges.potion = true;
            if (e.code === 'KeyT') this.edges.portal = true;
            if (e.code === 'KeyE') this.edges.interact = true;
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
            if (e.code === 'AltLeft' || e.code === 'AltRight') this.labels = false;
        });
        window.addEventListener('blur', () => this.clear());
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });

        // the mouse on the game view
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') return;
            this.lastDevice = 'mouse';
            this.mouse.x = e.clientX; this.mouse.y = e.clientY;
            if (e.button === 0) { this.mouse.left = true; this.mouse.leftPress = true; }
            if (e.button === 2) { this.mouse.right = true; this.mouse.rightPress = true; }
            try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        });
        // a finger on the game view (outside the stick and the buttons): a short tap that barely moved is a tap on
        // whatever is there (a person, the stash, a waystone, a dropped item)
        const taps = new Map();
        canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp }); });
        canvas.addEventListener('pointerup', (e) => {
            const d = taps.get(e.pointerId);
            taps.delete(e.pointerId);
            if (e.pointerType !== 'touch' || !d) return;
            if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 14 && e.timeStamp - d.t < 500) this.edges.tap = { x: e.clientX, y: e.clientY };
        });
        canvas.addEventListener('pointercancel', (e) => taps.delete(e.pointerId));
        canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.over = true; });
        const up = (e) => {
            if (e.pointerType === 'touch') return;
            if (e.button === 0) this.mouse.left = false;
            if (e.button === 2) this.mouse.right = false;
        };
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', () => { this.mouse.left = this.mouse.right = false; });
        canvas.addEventListener('pointerleave', () => { this.mouse.over = false; });
    }

    /** A floating stick: zone captures the thumb, el is the visual ring, knob follows the thumb. */
    bindStick(zone, el, knob) {
        const R = () => Math.min(70, Math.max(48, window.innerWidth * 0.12));
        const end = (e) => {
            if (e.pointerId !== this.stick.id || !this.stick.active) return;
            // a quick touch that never moved was a tap on the world under the stick zone, not a walk
            const st = this.stick;
            if (e.type === 'pointerup' && st.moved < 14 && e.timeStamp - st.t0 < 500) this.edges.tap = { x: st.sx, y: st.sy };
            this.stick.active = false; this.stick.x = this.stick.y = 0;
            knob.style.transform = ''; el.classList.remove('on');
        };
        zone.addEventListener('pointerdown', (e) => {
            if (this.stick.active) return;
            e.preventDefault();
            const r = zone.getBoundingClientRect();
            Object.assign(this.stick, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0, sx: e.clientX, sy: e.clientY, t0: e.timeStamp, moved: 0 });
            el.style.left = `${e.clientX - r.left}px`; el.style.top = `${e.clientY - r.top}px`; el.style.bottom = 'auto';
            el.classList.add('on');
            try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        });
        zone.addEventListener('pointermove', (e) => {
            if (!this.stick.active || e.pointerId !== this.stick.id) return;
            e.preventDefault();
            const rad = R();
            this.stick.moved = Math.max(this.stick.moved, Math.hypot(e.clientX - this.stick.sx, e.clientY - this.stick.sy));
            let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
            const d = Math.hypot(dx, dy);
            if (d > rad) {
                const k = (d - rad) / d;
                this.stick.ox += dx * k; this.stick.oy += dy * k;
                const r = zone.getBoundingClientRect();
                el.style.left = `${this.stick.ox - r.left}px`; el.style.top = `${this.stick.oy - r.top}px`;
                dx = e.clientX - this.stick.ox; dy = e.clientY - this.stick.oy;
            }
            this.stick.x = dx / rad; this.stick.y = dy / rad;
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, end);
    }

    /** A touch skill button: acts on finger-down (a press edge) and holds while the finger stays. */
    bindSkillButton(btn, i) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.edges.slots[i] = true; this.touchHeld[i] = true; try { btn.setPointerCapture(e.pointerId); } catch { /* */ } });
        const up = () => { this.touchHeld[i] = false; };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, up);
    }
    bindButton(btn, onPress) { btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(); }); }

    pressSlot(i) { this.edges.slots[i] = true; }
    pressPotion() { this.edges.potion = true; }
    pressPortal() { this.edges.portal = true; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; this.pad.held.fill(false); return; }
        const b = (i) => !!gp.buttons[i]?.pressed || (gp.buttons[i]?.value || 0) > 0.5;
        const dead = (v) => (Math.abs(v) > 0.22 ? v : 0);
        this.pad.x = dead(gp.axes[0] || 0); this.pad.y = dead(gp.axes[1] || 0);
        PAD_SLOTS.forEach((bi, si) => {
            const on = b(bi);
            if (on && !this.pad.prev[bi]) { this.edges.slots[si] = true; this.lastDevice = 'pad'; }
            this.pad.held[si] = on;
        });
        if (b(6) && !this.pad.prev[6]) this.edges.potion = true;
        if (b(8) && !this.pad.prev[8]) this.edges.portal = true;
        for (const i in PAD_KEYS) if (b(+i) && !this.pad.prev[i]) this.queue.push({ key: PAD_KEYS[i], pad: true });
        if (b(0) && !this.pad.prev[0]) this.queue.push({ key: 'Enter', pad: true });
        for (let i = 0; i < 17; i++) this.pad.prev[i] = b(i);
    }

    /** The held state this frame: a move vector and which slots are held. */
    state() {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
        let y = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        if (this.stick.active && Math.hypot(this.stick.x, this.stick.y) > 0.2) { x = this.stick.x; y = this.stick.y; }
        const held = SLOT_KEYS.map((c, i) => k.has(c) || this.pad.held[i] || this.touchHeld[i]);
        return { x, y, held, stand: k.has('ShiftLeft') || k.has('ShiftRight') };
    }

    consumeEdges() {
        this.edges.slots.fill(false);
        this.edges.potion = this.edges.portal = this.edges.interact = false;
        this.edges.tap = null;
        this.mouse.leftPress = this.mouse.rightPress = false;
    }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.consumeEdges(); }
    clear() {
        this.keys.clear(); this.flush();
        this.mouse.left = this.mouse.right = false;
        this.stick.active = false; this.stick.x = this.stick.y = 0;
        this.touchHeld.fill(false);
        this.labels = false;
    }
}
