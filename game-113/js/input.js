// Keyboard, gamepad and touch, merged.
//
// - Held directions are read every frame (the field).
// - The confirm press (A) is an edge that stays set until a sim step consumes it: a frame shorter than the fixed step
//   runs no step, and a tap made in it must not be lost.
// - Battle lane presses are kept with the time they were made (performance.now ms), so main.js can hand the sim the exact
//   song time of each press; a frame's timing never costs accuracy. Lane releases end held notes.
// - Menu presses go into a FIFO, one consumed per frame.

export const LANE_KEYS = { KeyD: 0, ArrowLeft: 0, KeyF: 1, ArrowDown: 1, KeyJ: 2, ArrowUp: 2, KeyK: 3, ArrowRight: 3 };
const CONFIRM = ['Space', 'Enter', 'KeyZ', 'NumpadEnter'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
// gamepad: lanes on the d-pad left/down and X/B (or the shoulders); A confirms / Crescendo; Start pauses; Y the menu
const PAD_LANE = { 14: 0, 4: 0, 13: 1, 6: 1, 2: 2, 7: 2, 1: 3, 5: 3 };
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 3: 'KeyM', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];
        this.edges = { a: false, b: false };
        this.lanePresses = [];          // { lane, at }
        this.laneHeld = [false, false, false, false];
        this.keyLane = new Map();       // which key is holding which lane
        this.touchLane = new Map();     // pointerId → lane
        this.cres = null;               // { at }
        this.battle = false;            // main.js sets this: lane keys mean lanes, not directions
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll, but Space/Enter must still press a focused button (game-078)
            if (NO_SCROLL.includes(e.code) && !((e.code === 'Space' || e.code === 'Enter') && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.keys.add(e.code);
            if (this.battle && e.code in LANE_KEYS) {
                const lane = LANE_KEYS[e.code];
                this.lanePresses.push({ lane, at: e.timeStamp || performance.now() });
                this.keyLane.set(e.code, lane);
                this.refreshHeld();
                return;
            }
            if (this.battle && e.code === 'Space') { this.cres = { at: e.timeStamp || performance.now() }; this.edges.a = true; return; }
            this.queue.push({ key: e.code, target: tag });
            if (CONFIRM.includes(e.code) && tag !== 'BUTTON') this.edges.a = true;
            if (e.code === 'Escape' || e.code === 'KeyX') this.edges.b = true;
        });
        window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (this.keyLane.has(e.code)) { this.keyLane.delete(e.code); this.refreshHeld(); } });
        window.addEventListener('blur', () => this.clear());
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    refreshHeld() {
        for (let l = 0; l < 4; l++) this.laneHeld[l] = false;
        for (const l of this.keyLane.values()) this.laneHeld[l] = true;
        for (const l of this.touchLane.values()) this.laneHeld[l] = true;
        if (this.padLanes) for (const l of this.padLanes) this.laneHeld[l] = true;
    }

    /** The four lane pads: finger-down presses, finger-up releases, many fingers at once. */
    bindLanes(els) {
        els.forEach((el, lane) => {
            el.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.lanePresses.push({ lane, at: e.timeStamp || performance.now() });
                this.touchLane.set(e.pointerId, lane);
                this.refreshHeld();
                try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
                el.classList.add('down');
            });
            const up = (e) => { if (this.touchLane.get(e.pointerId) !== lane) return; this.touchLane.delete(e.pointerId); this.refreshHeld(); el.classList.remove('down'); };
            for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, up);
        });
    }

    bindStick(zone, el, knob) {
        const R = () => Math.min(70, Math.max(48, window.innerWidth * 0.12));
        const end = (e) => {
            if (e.pointerId !== this.stick.id) return;
            this.stick.active = false; this.stick.x = this.stick.y = 0;
            knob.style.transform = ''; el.classList.remove('on');
        };
        zone.addEventListener('pointerdown', (e) => {
            if (this.stick.active) return;
            e.preventDefault();
            const r = zone.getBoundingClientRect();
            Object.assign(this.stick, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
            el.style.left = `${e.clientX - r.left}px`; el.style.top = `${e.clientY - r.top}px`; el.style.bottom = 'auto';
            el.classList.add('on');
            try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        zone.addEventListener('pointermove', (e) => {
            if (!this.stick.active || e.pointerId !== this.stick.id) return;
            e.preventDefault();
            const rad = R();
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

    /** A touch button that acts on finger-down. */
    bindButton(btn, onPress) { btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(e); }); }

    pressA() { this.edges.a = true; }
    pressCres(at = performance.now()) { this.cres = { at }; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; this.padLanes = null; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.25 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        const now = performance.now();
        if (this.battle) {
            const held = [];
            for (const i in PAD_LANE) {
                if (b(+i) && !this.pad.prev[i]) this.lanePresses.push({ lane: PAD_LANE[i], at: now });
                if (b(+i)) held.push(PAD_LANE[i]);
            }
            this.padLanes = held;
            if ((b(0) && !this.pad.prev[0]) || (b(3) && !this.pad.prev[3])) { this.cres = { at: now }; this.edges.a = true; }
            if (b(9) && !this.pad.prev[9]) this.queue.push({ key: 'KeyP', pad: true });
            this.refreshHeld();
        } else {
            for (const i in PAD_KEYS) if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            if (b(0) && !this.pad.prev[0]) this.edges.a = true;
            if (b(1) && !this.pad.prev[1]) this.edges.b = true;
        }
        for (let i = 0; i < 17; i++) this.pad.prev[i] = b(i);
    }

    /** Held directions for this frame (the field). Edges stay set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        let x = 0, y = 0;
        if (!this.battle) {
            x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
            y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
            if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
            if (this.stick.active && Math.hypot(this.stick.x, this.stick.y) > 0.2) { x = this.stick.x; y = this.stick.y; }
        }
        return { x, y, a: this.edges.a, b: this.edges.b };
    }
    consumeEdges() { this.edges.a = false; this.edges.b = false; }
    takeLanePresses() { const p = this.lanePresses; this.lanePresses = []; return p; }
    takeCres() { const c = this.cres; this.cres = null; return c; }
    next() { return this.queue.shift() || null; }
    flush() { this.queue.length = 0; this.edges.a = this.edges.b = false; this.lanePresses = []; this.cres = null; }
    clear() {
        this.keys.clear(); this.keyLane.clear(); this.touchLane.clear();
        this.flush();
        this.refreshHeld();
        this.stick.active = false; this.stick.x = this.stick.y = 0;
    }
}
