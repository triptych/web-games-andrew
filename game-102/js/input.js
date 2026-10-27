// Keyboard, gamepad, mouse and touch merged into one state, plus an ordered queue of presses.
//
//   state() → { adjA, adjP, aim, fire, act }
//     adjA, adjP  held nudges of the aim angle and power, from the keys or a stick
//     aim         null, or { angle, power } while a finger or mouse is pulling the sling back
//     fire        an edge: the pull was let go with enough power
//     act         an edge: Space/Z/A or a tap. It fires when ready and uses the special in flight.
//
// - Edges stay set until a simulation step consumes them: a frame shorter than the fixed step
//   runs no step, and a tap made in it must not be lost.
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.
// - The pull is measured in world units through the view (screenToWorld), which maps through the
//   canvas's getBoundingClientRect(), so it lands under the finger on any phone.

import { SLING } from './config.js';

const ACTION_KEYS = ['Space', 'KeyZ', 'KeyJ'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };
const TAP_SLOP = 10;                      // px a press may wander and still be a tap

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];                    // { key } in the order they were pressed
        this.edges = { act: false, fire: false };
        this.pull = { active: false, id: null, sx: 0, sy: 0, moved: 0, angle: 0, power: 0 };
        this.lastAim = null;                // the aim at the moment of release
        this.pad = { x: 0, y: 0, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;                // called once when a touch is first seen
        this.screenToWorld = null;          // set by main: (clientX, clientY) → { x, y }
        this.canPull = () => true;          // set by main: aiming is allowed right now
        this.inFlight = () => false;        // set by main: a tap should use the special

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (ACTION_KEYS.includes(e.code)) this.edges.act = true;
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        // Capture phase, so a touch on any menu switches the touch deck on before play starts.
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    /** Drag anywhere on the canvas to pull the sling back; let go to fire. A tap in flight is the special. */
    bindCanvas(canvas) {
        const aimFrom = (e) => {
            const w = this.screenToWorld?.(e.clientX, e.clientY);
            if (!w) return;
            const dx = SLING.x - w.x, dy = SLING.y - w.y;
            this.pull.angle = Math.atan2(dy, dx);
            this.pull.power = Math.min(1, Math.hypot(dx, dy) / SLING.maxPull);
        };
        const end = (e, release) => {
            if (!this.pull.active || e.pointerId !== this.pull.id) return;
            this.pull.active = false;
            if (release && this.pull.power >= SLING.minPower) {
                this.lastAim = { angle: this.pull.angle, power: this.pull.power };
                this.edges.fire = true;
            }
        };
        canvas.addEventListener('pointerdown', (e) => {
            if (e.button > 0) return;
            e.preventDefault();
            if (this.inFlight()) { this.edges.act = true; return; }
            if (!this.canPull() || this.pull.active) return;
            Object.assign(this.pull, { active: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: 0 });
            aimFrom(e);
            try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!this.pull.active || e.pointerId !== this.pull.id) return;
            e.preventDefault();
            this.pull.moved = Math.max(this.pull.moved, Math.hypot(e.clientX - this.pull.sx, e.clientY - this.pull.sy));
            aimFrom(e);
        });
        canvas.addEventListener('pointerup', (e) => end(e, this.pull.moved > TAP_SLOP));
        canvas.addEventListener('pointercancel', (e) => end(e, false));
        canvas.addEventListener('lostpointercapture', (e) => end(e, false));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /** A touch button that acts on finger-down (a click waits for the lift and feels late). */
    bindButton(btn, onPress) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(); });
    }

    pressAct() { this.edges.act = true; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.25 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        if (b(0) && !this.pad.prev.a) { this.edges.act = true; this.queue.push({ key: 'Enter', pad: true }); this.lastDevice = 'pad'; }
        this.pad.prev.a = b(0);
    }

    /** The state for this frame. Edges stay set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        // up/down turn the aim, left/right trade power for finesse
        let adjA = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
        let adjP = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        if (this.pad.x || this.pad.y) { adjP = this.pad.x; adjA = -this.pad.y; }
        let aim = null;
        if (this.pull.active) aim = { angle: this.pull.angle, power: this.pull.power };
        else if (this.edges.fire && this.lastAim) aim = this.lastAim;
        return { adjA, adjP, aim, fire: this.edges.fire, act: this.edges.act };
    }

    consumeEdges() { this.edges.act = false; this.edges.fire = false; }
    /** The next queued press, or null. Menus take one per frame. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; this.edges.act = false; this.edges.fire = false; this.pull.active = false; }
    clear() {
        this.keys.clear();
        this.flush();
    }
}
